import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DashboardStats,
  PromptDetailResponse,
  PromptListQuery,
  PromptListResponse,
} from '@promptlens/contracts';
import type { Prisma } from '@promptlens/database';
import { MembershipRole, PromptVersionKind, withTenantContext } from '@promptlens/database';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';

const includePrompt = {
  project: { select: { name: true } },
  tags: { include: { tag: { select: { name: true } } } },
  analyses: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  versions: {
    where: { kind: PromptVersionKind.IMPROVED },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
};

type IncludedPrompt = Prisma.PromptGetPayload<{ include: typeof includePrompt }>;

function stringArray(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapPrompt(prompt: IncludedPrompt): PromptDetailResponse {
  const analysis = prompt.analyses[0];
  return {
    id: prompt.id,
    projectId: prompt.projectId,
    projectName: prompt.project.name,
    content: prompt.content,
    platform: prompt.platform,
    model: prompt.model,
    occurredAt: prompt.occurredAt.toISOString(),
    timezone: prompt.timezone,
    createdAt: prompt.createdAt.toISOString(),
    tags: prompt.tags.map(({ tag }) => tag.name),
    analysis: analysis
      ? {
          id: analysis.id,
          status: analysis.status,
          score: analysis.score,
          strengths: stringArray(analysis.strengths),
          weaknesses: stringArray(analysis.weaknesses),
          suggestions: stringArray(analysis.suggestions),
          improvedPrompt:
            prompt.versions.find((version) => version.analysisId === analysis.id)?.content ?? null,
        }
      : null,
  };
}

@Injectable()
export class PromptHistoryService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  list(actor: AuthenticatedActor, query: PromptListQuery): Promise<PromptListResponse> {
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const cursorPrompt = query.cursor
        ? await transaction.prompt.findFirst({
            where: { id: query.cursor, tenantId: actor.tenantId },
            select: { id: true, occurredAt: true },
          })
        : null;
      if (query.cursor && !cursorPrompt) throw new NotFoundException('Cursor not found.');
      const searchIds = query.q
        ? await transaction.$queryRaw<Array<{ id: string }>>`
            SELECT id
            FROM prompts
            WHERE tenant_id = ${actor.tenantId}::uuid
              AND deleted_at IS NULL
              AND (
                to_tsvector('simple', content) @@ websearch_to_tsquery('simple', ${query.q})
                OR content % ${query.q}
                OR content ILIKE ${`%${query.q}%`}
              )
            ORDER BY occurred_at DESC, id DESC
            LIMIT 1000
          `
        : null;
      const prompts = await transaction.prompt.findMany({
        where: {
          tenantId: actor.tenantId,
          deletedAt: null,
          ...(query.projectId ? { projectId: query.projectId } : {}),
          ...(query.platform ? { platform: query.platform } : {}),
          ...(query.model ? { model: query.model } : {}),
          ...(searchIds ? { id: { in: searchIds.map(({ id }) => id) } } : {}),
          ...(query.tag ? { tags: { some: { tag: { name: query.tag.toLowerCase() } } } } : {}),
          ...(query.minScore !== undefined || query.maxScore !== undefined
            ? {
                analyses: {
                  some: {
                    score: {
                      ...(query.minScore !== undefined ? { gte: query.minScore } : {}),
                      ...(query.maxScore !== undefined ? { lte: query.maxScore } : {}),
                    },
                    status: 'COMPLETED',
                  },
                },
              }
            : {}),
          ...(query.from || query.to
            ? {
                occurredAt: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(query.to) } : {}),
                },
              }
            : {}),
          ...(cursorPrompt
            ? {
                OR: [
                  { occurredAt: { lt: cursorPrompt.occurredAt } },
                  { occurredAt: cursorPrompt.occurredAt, id: { lt: cursorPrompt.id } },
                ],
              }
            : {}),
        },
        include: includePrompt,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      const hasNext = prompts.length > query.limit;
      const items = prompts.slice(0, query.limit);
      return {
        items: items.map(mapPrompt),
        nextCursor: hasNext ? (items.at(-1)?.id ?? null) : null,
      };
    });
  }

  detail(actor: AuthenticatedActor, promptId: string): Promise<PromptDetailResponse> {
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const prompt = await transaction.prompt.findFirst({
        where: { id: promptId, tenantId: actor.tenantId, deletedAt: null },
        include: includePrompt,
      });
      if (!prompt) throw new NotFoundException('Prompt not found.');
      return mapPrompt(prompt);
    });
  }

  stats(actor: AuthenticatedActor): Promise<DashboardStats> {
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000);
      const [
        projects,
        prompts,
        analysesCompleted,
        score,
        promptsLast7Days,
        scoreTrend,
        modelDistribution,
        projectDistribution,
      ] = await Promise.all([
        transaction.project.count({ where: { tenantId: actor.tenantId, status: 'ACTIVE' } }),
        transaction.prompt.count({ where: { tenantId: actor.tenantId, deletedAt: null } }),
        transaction.analysis.count({
          where: { tenantId: actor.tenantId, status: 'COMPLETED' },
        }),
        transaction.analysis.aggregate({
          where: { tenantId: actor.tenantId, status: 'COMPLETED' },
          _avg: { score: true },
        }),
        transaction.prompt.count({
          where: { tenantId: actor.tenantId, deletedAt: null, occurredAt: { gte: weekAgo } },
        }),
        transaction.$queryRaw<Array<{ date: Date; score: number }>>`
          SELECT date_trunc('day', completed_at) AS date, round(avg(score), 1)::float AS score
          FROM analyses
          WHERE tenant_id = ${actor.tenantId}::uuid
            AND status = 'COMPLETED'
            AND completed_at >= now() - interval '14 days'
          GROUP BY 1
          ORDER BY 1
        `,
        transaction.prompt.groupBy({
          by: ['model'],
          where: { tenantId: actor.tenantId, deletedAt: null },
          _count: { _all: true },
          orderBy: { _count: { model: 'desc' } },
          take: 8,
        }),
        transaction.$queryRaw<Array<{ name: string; count: bigint }>>`
          SELECT projects.name, count(prompts.id) AS count
          FROM projects
          LEFT JOIN prompts ON prompts.project_id = projects.id AND prompts.deleted_at IS NULL
          WHERE projects.tenant_id = ${actor.tenantId}::uuid
          GROUP BY projects.id, projects.name
          ORDER BY count DESC, projects.name
          LIMIT 8
        `,
      ]);
      return {
        projects,
        prompts,
        analysesCompleted,
        averageScore: score._avg.score === null ? null : Math.round(score._avg.score * 10) / 10,
        promptsLast7Days,
        scoreTrend: scoreTrend.map((item) => ({
          date: item.date.toISOString().slice(0, 10),
          score: item.score,
        })),
        modelDistribution: modelDistribution.map((item) => ({
          name: item.model,
          count: item._count._all,
        })),
        projectDistribution: projectDistribution.map((item) => ({
          name: item.name,
          count: Number(item.count),
        })),
      };
    });
  }

  async export(actor: AuthenticatedActor, query: PromptListQuery, format: 'json' | 'csv') {
    const items: PromptDetailResponse[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.list(actor, { ...query, limit: 100, ...(cursor ? { cursor } : {}) });
      items.push(
        ...page.items.map((item) => ({ ...item, timezone: '', createdAt: item.occurredAt })),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor && items.length < 1_000);
    const exported = items.slice(0, 1_000);
    await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'prompts.exported',
          targetType: 'prompt_export',
          result: 'success',
          metadata: { format, records: exported.length },
        },
      }),
    );
    if (format === 'json') {
      return {
        body: JSON.stringify(exported, null, 2),
        contentType: 'application/json; charset=utf-8',
        extension: 'json',
      };
    }
    const columns = [
      'id',
      'project',
      'platform',
      'model',
      'occurredAt',
      'score',
      'prompt',
      'improvedPrompt',
    ];
    const escape = (value: string | number | null | undefined): string => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = exported.map((item) =>
      [
        item.id,
        item.projectName,
        item.platform,
        item.model,
        item.occurredAt,
        item.analysis?.score,
        item.content,
        item.analysis?.improvedPrompt,
      ]
        .map(escape)
        .join(','),
    );
    return {
      body: [columns.join(','), ...rows].join('\r\n'),
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
    };
  }

  reanalyze(actor: AuthenticatedActor, promptId: string) {
    if (actor.role === MembershipRole.VIEWER) {
      throw new ForbiddenException('This role cannot request analysis.');
    }
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const prompt = await transaction.prompt.findFirst({
        where: { id: promptId, tenantId: actor.tenantId, deletedAt: null },
      });
      if (!prompt) throw new NotFoundException('Prompt not found.');
      const active = await transaction.analysis.findFirst({
        where: { promptId, status: { in: ['QUEUED', 'RUNNING'] } },
      });
      if (active) throw new ConflictException('An analysis is already active for this prompt.');
      const analysis = await transaction.analysis.create({
        data: {
          tenantId: actor.tenantId,
          promptId,
          status: 'QUEUED',
          rubricVersion: '1.0.0',
        },
      });
      await transaction.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          aggregateType: 'prompt',
          aggregateId: promptId,
          eventType: 'PromptCreated',
          eventVersion: 1,
          payload: { promptId, analysisId: analysis.id },
        },
      });
      return { analysisId: analysis.id, status: analysis.status };
    });
  }

  delete(actor: AuthenticatedActor, promptId: string) {
    if (actor.role === MembershipRole.VIEWER) {
      throw new ForbiddenException('This role cannot delete prompts.');
    }
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const deleted = await transaction.prompt.updateMany({
        where: { id: promptId, tenantId: actor.tenantId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (deleted.count !== 1) throw new NotFoundException('Prompt not found.');
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'prompt.deleted',
          targetType: 'prompt',
          targetId: promptId,
          result: 'success',
          metadata: {},
        },
      });
    });
  }
}
