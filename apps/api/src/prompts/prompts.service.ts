import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { IngestPromptRequest, PromptResponse } from '@promptlens/contracts';
import { AnalysisStatus, Prisma, PromptVersionKind, withTenantContext } from '@promptlens/database';
import { DatabaseService } from '../database/database.service.js';
import type { AuthenticatedConnector } from '../connectors/connector-auth.types.js';

@Injectable()
export class PromptsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async ingest(
    connector: AuthenticatedConnector,
    input: IngestPromptRequest,
    retriedAfterConflict = false,
  ): Promise<PromptResponse> {
    if (input.projectId !== connector.defaultProjectId) {
      throw new ForbiddenException('Connector is not authorized for this project.');
    }
    if (input.platform !== connector.platform) {
      throw new ForbiddenException('Prompt platform does not match the connector.');
    }
    if (new Date(input.occurredAt).getTime() > Date.now() + 5 * 60 * 1_000) {
      throw new BadRequestException('Prompt timestamp is too far in the future.');
    }
    const eventHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    try {
      return await withTenantContext(this.database.client, connector, async (transaction) => {
        const duplicate = await transaction.prompt.findUnique({
          where: {
            connectorInstallationId_clientEventId: {
              connectorInstallationId: connector.installationId,
              clientEventId: input.clientEventId,
            },
          },
          include: { analyses: { orderBy: { createdAt: 'asc' }, take: 1 } },
        });
        if (duplicate?.analyses[0]) {
          if (duplicate.clientEventHash && duplicate.clientEventHash !== eventHash) {
            throw new ConflictException(
              'The idempotency key was already used for a different event.',
            );
          }
          return {
            id: duplicate.id,
            projectId: duplicate.projectId,
            clientEventId: duplicate.clientEventId,
            analysisId: duplicate.analyses[0].id,
            analysisStatus: AnalysisStatus.QUEUED,
            duplicate: true,
            createdAt: duplicate.createdAt.toISOString(),
          };
        }
        const project = await transaction.project.findFirst({
          where: { id: input.projectId, tenantId: connector.tenantId, status: 'ACTIVE' },
        });
        if (!project) throw new ForbiddenException('Project is unavailable.');

        const prompt = await transaction.prompt.create({
          data: {
            tenantId: connector.tenantId,
            projectId: project.id,
            userId: connector.userId,
            connectorInstallationId: connector.installationId,
            clientEventId: input.clientEventId,
            clientEventHash: eventHash,
            content: input.content,
            platform: input.platform,
            model: input.model,
            occurredAt: new Date(input.occurredAt),
            timezone: input.timezone,
            metadata: input.context as Prisma.InputJsonValue,
            versions: {
              create: {
                tenantId: connector.tenantId,
                kind: PromptVersionKind.ORIGINAL,
                content: input.content,
              },
            },
          },
        });

        const normalizedTags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))];
        for (const name of normalizedTags) {
          const tag = await transaction.tag.upsert({
            where: { tenantId_name: { tenantId: connector.tenantId, name } },
            create: { tenantId: connector.tenantId, name },
            update: {},
          });
          await transaction.promptTag.create({
            data: { tenantId: connector.tenantId, promptId: prompt.id, tagId: tag.id },
          });
        }

        const analysis = await transaction.analysis.create({
          data: {
            tenantId: connector.tenantId,
            promptId: prompt.id,
            status: AnalysisStatus.QUEUED,
            rubricVersion: '1.0.0',
          },
        });
        await transaction.outboxEvent.create({
          data: {
            tenantId: connector.tenantId,
            aggregateType: 'prompt',
            aggregateId: prompt.id,
            eventType: 'PromptCreated',
            eventVersion: 1,
            payload: { promptId: prompt.id, analysisId: analysis.id },
          },
        });
        return {
          id: prompt.id,
          projectId: prompt.projectId,
          clientEventId: prompt.clientEventId,
          analysisId: analysis.id,
          analysisStatus: AnalysisStatus.QUEUED,
          duplicate: false,
          createdAt: prompt.createdAt.toISOString(),
        };
      });
    } catch (error: unknown) {
      if (
        !retriedAfterConflict &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.ingest(connector, input, true);
      }
      throw error;
    }
  }
}
