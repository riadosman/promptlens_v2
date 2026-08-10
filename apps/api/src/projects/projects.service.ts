import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectRequest,
  ProjectResponse,
  UpdateProjectRequest,
} from '@promptlens/contracts';
import { MembershipRole, Prisma, ProjectStatus, withTenantContext } from '@promptlens/database';
import { DatabaseService } from '../database/database.service.js';
import type { AuthenticatedActor } from '../auth/auth.types.js';

const WRITE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MEMBER,
]);

function toResponse(project: {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProjectsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  list(actor: AuthenticatedActor): Promise<ProjectResponse[]> {
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const [projects, metrics] = await Promise.all([
        transaction.project.findMany({
          where: { tenantId: actor.tenantId },
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        }),
        transaction.$queryRaw<
          Array<{
            id: string;
            prompt_count: bigint;
            average_score: number | null;
            low_score_count: bigint;
            last_activity_at: Date | null;
          }>
        >(Prisma.sql`
          SELECT projects.id,
            count(prompts.id) AS prompt_count,
            round(avg(latest.score), 1)::float AS average_score,
            count(prompts.id) FILTER (
              WHERE latest.status = 'COMPLETED' AND latest.score < 60
            ) AS low_score_count,
            max(prompts.occurred_at) AS last_activity_at
          FROM projects
          LEFT JOIN prompts
            ON prompts.project_id = projects.id AND prompts.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT analyses.status, analyses.score
            FROM analyses
            WHERE analyses.prompt_id = prompts.id
            ORDER BY analyses.created_at DESC
            LIMIT 1
          ) latest ON true
          WHERE projects.tenant_id = ${actor.tenantId}::uuid
          GROUP BY projects.id
        `),
      ]);
      const metricsById = new Map(metrics.map((item) => [item.id, item]));
      return projects.map((project) => {
        const projectMetrics = metricsById.get(project.id);
        return {
          ...toResponse(project),
          promptCount: Number(projectMetrics?.prompt_count ?? 0),
          averageScore: projectMetrics?.average_score ?? null,
          lowScoreCount: Number(projectMetrics?.low_score_count ?? 0),
          lastActivityAt: projectMetrics?.last_activity_at?.toISOString() ?? null,
        };
      });
    });
  }

  create(actor: AuthenticatedActor, input: CreateProjectRequest): Promise<ProjectResponse> {
    this.assertCanWrite(actor);
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const project = await transaction.project.create({
        data: {
          tenantId: actor.tenantId,
          name: input.name,
          ...(input.description === undefined ? {} : { description: input.description }),
        },
      });
      return toResponse(project);
    });
  }

  update(
    actor: AuthenticatedActor,
    projectId: string,
    input: UpdateProjectRequest,
  ): Promise<ProjectResponse> {
    this.assertCanWrite(actor);
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const existing = await transaction.project.findFirst({
        where: { id: projectId, tenantId: actor.tenantId },
      });
      if (!existing) throw new NotFoundException('Project not found.');
      const project = await transaction.project.update({
        where: { id: projectId },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.archived === undefined
            ? {}
            : {
                status: input.archived ? ProjectStatus.ARCHIVED : ProjectStatus.ACTIVE,
                archivedAt: input.archived ? new Date() : null,
              }),
        },
      });
      return toResponse(project);
    });
  }

  private assertCanWrite(actor: AuthenticatedActor): void {
    if (!WRITE_ROLES.has(actor.role)) {
      throw new ForbiddenException('This role cannot modify projects.');
    }
  }
}
