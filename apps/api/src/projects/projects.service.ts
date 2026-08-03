import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectRequest,
  ProjectResponse,
  UpdateProjectRequest,
} from '@promptlens/contracts';
import { MembershipRole, ProjectStatus, withTenantContext } from '@promptlens/database';
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
      const projects = await transaction.project.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      });
      return projects.map(toResponse);
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
