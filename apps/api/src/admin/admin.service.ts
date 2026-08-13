import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddMemberRequest,
  RequestSupportGrantRequest,
  ScheduleTenantDeletionRequest,
  TenantSettingsRequest,
  UpdateMemberRequest,
} from '@promptlens/contracts';
import { MembershipRole, UserStatus, withTenantContext } from '@promptlens/database';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';

const TENANT_ADMIN_ROLES = new Set<MembershipRole>([MembershipRole.OWNER, MembershipRole.ADMIN]);

@Injectable()
export class AdminService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async overview(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    const tenant = await withTenantContext(this.database.client, actor, async (transaction) => {
      const [users, projects, prompts, analyses, connectors, usage] = await Promise.all([
        transaction.membership.count({ where: { tenantId: actor.tenantId } }),
        transaction.project.count({ where: { tenantId: actor.tenantId } }),
        transaction.prompt.count({ where: { tenantId: actor.tenantId, deletedAt: null } }),
        transaction.analysis.count({ where: { tenantId: actor.tenantId } }),
        transaction.connectorInstallation.count({ where: { tenantId: actor.tenantId } }),
        transaction.usageRecord.aggregate({
          where: { tenantId: actor.tenantId },
          _sum: { inputTokens: true, outputTokens: true, costMicros: true },
        }),
      ]);
      return {
        users,
        projects,
        prompts,
        analyses,
        connectors,
        inputTokens: usage._sum.inputTokens ?? 0,
        outputTokens: usage._sum.outputTokens ?? 0,
        costMicros: Number(usage._sum.costMicros ?? 0n),
      };
    });
    if (!actor.isInstanceAdmin) return { tenant, instance: null };
    const [users, tenantIds] = await Promise.all([
      this.database.client.user.count(),
      this.database.client.tenant.findMany({ select: { id: true } }),
    ]);
    const perTenant = await Promise.all(
      tenantIds.map(({ id }) =>
        withTenantContext(
          this.database.client,
          { tenantId: id, userId: actor.userId },
          async (transaction) => {
            const [queuedAnalyses, unpublishedEvents] = await Promise.all([
              transaction.analysis.count({ where: { status: 'QUEUED' } }),
              transaction.outboxEvent.count({ where: { publishedAt: null } }),
            ]);
            return { queuedAnalyses, unpublishedEvents };
          },
        ),
      ),
    );
    return {
      tenant,
      instance: {
        users,
        tenants: tenantIds.length,
        queuedAnalyses: perTenant.reduce((sum, item) => sum + item.queuedAnalyses, 0),
        unpublishedEvents: perTenant.reduce((sum, item) => sum + item.unpublishedEvents, 0),
      },
    };
  }

  async instanceUsers(actor: AuthenticatedActor): Promise<
    Array<{
      id: string;
      email: string;
      displayName: string;
      status: UserStatus;
      isInstanceAdmin: boolean;
      createdAt: Date;
      _count: { memberships: number };
    }>
  > {
    this.assertInstanceAdmin(actor);
    return await this.database.client.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        status: true,
        isInstanceAdmin: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async instanceTenants(actor: AuthenticatedActor) {
    this.assertInstanceAdmin(actor);
    return this.database.client.tenant.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async updateUserStatus(
    actor: AuthenticatedActor,
    userId: string,
    status: UserStatus,
  ): Promise<void> {
    this.assertInstanceAdmin(actor);
    if (userId === actor.userId) throw new BadRequestException('Self-suspension is not allowed.');
    const user = await this.database.client.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    await this.database.client.user.update({ where: { id: userId }, data: { status } });
    if (status !== UserStatus.ACTIVE) {
      const tenants = await this.database.client.tenant.findMany({ select: { id: true } });
      await Promise.all(
        tenants.map(({ id }) =>
          withTenantContext(
            this.database.client,
            { tenantId: id, userId: actor.userId },
            (transaction) =>
              transaction.session.updateMany({
                where: { tenantId: id, userId, revokedAt: null },
                data: { revokedAt: new Date() },
              }),
          ),
        ),
      );
    }
    await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'instance.user_status_changed',
          targetType: 'user',
          targetId: userId,
          result: 'success',
          metadata: { from: user.status, to: status },
        },
      }),
    );
  }

  async requestSupport(actor: AuthenticatedActor, input: RequestSupportGrantRequest) {
    this.assertInstanceAdmin(actor);
    const tenant = await this.database.client.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Workspace not found.');
    return withTenantContext(
      this.database.client,
      { tenantId: input.tenantId, userId: actor.userId },
      async (transaction) => {
        const existing = await transaction.supportGrant.findFirst({
          where: {
            tenantId: input.tenantId,
            requestedById: actor.userId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        });
        if (existing) throw new ConflictException('An active support request already exists.');
        const grant = await transaction.supportGrant.create({
          data: {
            tenantId: input.tenantId,
            requestedById: actor.userId,
            reason: input.reason,
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: input.tenantId,
            actorId: actor.userId,
            action: 'support.access_requested',
            targetType: 'support_grant',
            targetId: grant.id,
            result: 'success',
            metadata: { reason: input.reason },
          },
        });
        return grant;
      },
    );
  }

  supportRequests(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    return withTenantContext(this.database.client, actor, (transaction) =>
      transaction.supportGrant.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async approveSupport(actor: AuthenticatedActor, grantId: string) {
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a workspace owner can approve support access.');
    }
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const grant = await transaction.supportGrant.findFirst({
        where: { id: grantId, tenantId: actor.tenantId, revokedAt: null },
      });
      if (!grant) throw new NotFoundException('Support request not found.');
      if (grant.expiresAt && grant.expiresAt > new Date()) {
        throw new ConflictException('Support request is already approved.');
      }
      const requester = await this.database.client.user.findUnique({
        where: { id: grant.requestedById },
        select: { isInstanceAdmin: true, status: true },
      });
      if (!requester?.isInstanceAdmin || requester.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('Requester is no longer an active instance administrator.');
      }
      const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
      const approved = await transaction.supportGrant.update({
        where: { id: grant.id },
        data: { approvedById: actor.userId, expiresAt },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'support.access_approved',
          targetType: 'support_grant',
          targetId: grant.id,
          result: 'success',
          metadata: { expiresAt: expiresAt.toISOString() },
        },
      });
      return approved;
    });
  }

  async revokeSupport(actor: AuthenticatedActor, grantId: string): Promise<void> {
    this.assertTenantAdmin(actor);
    await withTenantContext(this.database.client, actor, async (transaction) => {
      const grant = await transaction.supportGrant.findFirst({
        where: { id: grantId, tenantId: actor.tenantId, revokedAt: null },
      });
      if (!grant) throw new NotFoundException('Support request not found.');
      await transaction.supportGrant.update({
        where: { id: grant.id },
        data: { revokedAt: new Date() },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'support.access_revoked',
          targetType: 'support_grant',
          targetId: grant.id,
          result: 'success',
        },
      });
    });
  }

  async supportMetadata(
    actor: AuthenticatedActor,
    tenantId: string,
  ): Promise<{
    tenant: { id: string; name: string; slug: string } | null;
    members: number;
    projects: number;
    prompts: number;
    analyses: Array<{ status: string; count: number }>;
    connectors: Array<{
      id: string;
      platform: string;
      status: string;
      lastSeenAt: Date | null;
    }>;
    expiresAt: Date | null;
  }> {
    this.assertInstanceAdmin(actor);
    return withTenantContext(
      this.database.client,
      { tenantId, userId: actor.userId },
      async (transaction) => {
        const grant = await transaction.supportGrant.findFirst({
          where: {
            tenantId,
            requestedById: actor.userId,
            approvedById: { not: null },
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!grant)
          throw new ForbiddenException('Active owner-approved support access is required.');
        const [tenant, members, projects, prompts, analyses, connectors] = await Promise.all([
          transaction.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, name: true, slug: true },
          }),
          transaction.membership.count({ where: { tenantId } }),
          transaction.project.count({ where: { tenantId } }),
          transaction.prompt.count({ where: { tenantId, deletedAt: null } }),
          transaction.analysis.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
          transaction.connectorInstallation.findMany({
            where: { tenantId },
            select: { id: true, platform: true, status: true, lastSeenAt: true },
          }),
        ]);
        await transaction.auditEvent.create({
          data: {
            tenantId,
            actorId: actor.userId,
            action: 'support.metadata_viewed',
            targetType: 'support_grant',
            targetId: grant.id,
            result: 'success',
          },
        });
        return {
          tenant,
          members,
          projects,
          prompts,
          analyses: analyses.map((item) => ({ status: item.status, count: item._count })),
          connectors,
          expiresAt: grant.expiresAt,
        };
      },
    );
  }

  members(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    return withTenantContext(this.database.client, actor, (transaction) =>
      transaction.membership.findMany({
        where: { tenantId: actor.tenantId },
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, email: true, displayName: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  audit(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    return withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async usage(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    const records = await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.usageRecord.findMany({
        where: { tenantId: actor.tenantId },
        select: {
          id: true,
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          costMicros: true,
          latencyMs: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
    return records.map((record) => ({ ...record, costMicros: Number(record.costMicros) }));
  }

  async settings(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    const tenant = await this.database.client.tenant.findUnique({
      where: { id: actor.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        retentionDays: true,
        aiProvider: true,
        aiModel: true,
        aiMonthlyTokenBudget: true,
        deletionScheduledAt: true,
      },
    });
    if (!tenant) throw new NotFoundException('Workspace not found.');
    return tenant;
  }

  async updateSettings(actor: AuthenticatedActor, input: TenantSettingsRequest) {
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a workspace owner can update workspace settings.');
    }
    const updated = await this.database.client.tenant.update({
      where: { id: actor.tenantId },
      data: input,
      select: {
        id: true,
        retentionDays: true,
        aiProvider: true,
        aiModel: true,
        aiMonthlyTokenBudget: true,
        deletionScheduledAt: true,
      },
    });
    await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'tenant.settings_updated',
          targetType: 'tenant',
          targetId: actor.tenantId,
          result: 'success',
          metadata: input,
        },
      }),
    );
    return updated;
  }

  async dataExport(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    const data = await withTenantContext(this.database.client, actor, async (transaction) => {
      const [tenant, members, projects, prompts, analyses, usage, connectors, audit] =
        await Promise.all([
          transaction.tenant.findUnique({ where: { id: actor.tenantId } }),
          transaction.membership.findMany({
            where: { tenantId: actor.tenantId },
            select: {
              role: true,
              createdAt: true,
              user: { select: { id: true, email: true, displayName: true, status: true } },
            },
          }),
          transaction.project.findMany({ where: { tenantId: actor.tenantId } }),
          transaction.prompt.findMany({
            where: { tenantId: actor.tenantId },
            include: { tags: { include: { tag: true } }, versions: true },
          }),
          transaction.analysis.findMany({ where: { tenantId: actor.tenantId } }),
          transaction.usageRecord.findMany({ where: { tenantId: actor.tenantId } }),
          transaction.connectorInstallation.findMany({
            where: { tenantId: actor.tenantId },
            select: {
              id: true,
              platform: true,
              protocolVersion: true,
              displayName: true,
              defaultProjectId: true,
              status: true,
              lastSeenAt: true,
              createdAt: true,
            },
          }),
          transaction.auditEvent.findMany({ where: { tenantId: actor.tenantId } }),
        ]);
      return {
        schemaVersion: 1,
        exportedAt: new Date(),
        tenant,
        members,
        projects,
        prompts,
        analyses,
        usage: usage.map((item) => ({ ...item, costMicros: Number(item.costMicros) })),
        connectors,
        audit,
      };
    });
    await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'tenant.data_exported',
          targetType: 'tenant',
          targetId: actor.tenantId,
          result: 'success',
        },
      }),
    );
    return data;
  }

  async scheduleDeletion(actor: AuthenticatedActor, input: ScheduleTenantDeletionRequest) {
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a workspace owner can schedule deletion.');
    }
    const tenant = await this.database.client.tenant.findUnique({
      where: { id: actor.tenantId },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Workspace not found.');
    if (input.confirmation !== `delete ${tenant.slug}`) {
      throw new BadRequestException(`Confirmation must exactly match: delete ${tenant.slug}`);
    }
    const deletionScheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
    await this.database.client.tenant.update({
      where: { id: actor.tenantId },
      data: { deletionScheduledAt },
    });
    await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'tenant.deletion_scheduled',
          targetType: 'tenant',
          targetId: actor.tenantId,
          result: 'success',
          metadata: { deletionScheduledAt: deletionScheduledAt.toISOString() },
        },
      }),
    );
    return { deletionScheduledAt };
  }

  async cancelDeletion(actor: AuthenticatedActor): Promise<void> {
    if (actor.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('Only a workspace owner can cancel deletion.');
    }
    await this.database.client.tenant.update({
      where: { id: actor.tenantId },
      data: { deletionScheduledAt: null },
    });
    await withTenantContext(this.database.client, actor, (transaction) =>
      transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'tenant.deletion_cancelled',
          targetType: 'tenant',
          targetId: actor.tenantId,
          result: 'success',
        },
      }),
    );
  }

  async addMember(actor: AuthenticatedActor, input: AddMemberRequest) {
    this.assertTenantAdmin(actor);
    const user = await this.database.client.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new NotFoundException('An active account with this email was not found.');
    }
    try {
      return await withTenantContext(this.database.client, actor, async (transaction) => {
        const membership = await transaction.membership.create({
          data: { tenantId: actor.tenantId, userId: user.id, role: input.role },
          select: {
            role: true,
            createdAt: true,
            user: { select: { id: true, email: true, displayName: true, status: true } },
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            action: 'membership.added',
            targetType: 'user',
            targetId: user.id,
            result: 'success',
            metadata: { role: input.role },
          },
        });
        return membership;
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('The user is already a workspace member.');
      }
      throw error;
    }
  }

  async updateMember(actor: AuthenticatedActor, userId: string, input: UpdateMemberRequest) {
    this.assertTenantAdmin(actor);
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const membership = await transaction.membership.findUnique({
        where: { tenantId_userId: { tenantId: actor.tenantId, userId } },
      });
      if (!membership) throw new NotFoundException('Workspace member not found.');
      if (
        (membership.role === MembershipRole.OWNER || input.role === MembershipRole.OWNER) &&
        actor.role !== MembershipRole.OWNER
      ) {
        throw new ForbiddenException('Only an owner can change owner membership.');
      }
      if (membership.role === MembershipRole.OWNER && input.role !== MembershipRole.OWNER) {
        const owners = await transaction.membership.count({
          where: { tenantId: actor.tenantId, role: MembershipRole.OWNER },
        });
        if (owners <= 1)
          throw new BadRequestException('A workspace must retain at least one owner.');
      }
      const updated = await transaction.membership.update({
        where: { tenantId_userId: { tenantId: actor.tenantId, userId } },
        data: { role: input.role },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'membership.role_changed',
          targetType: 'user',
          targetId: userId,
          result: 'success',
          metadata: { from: membership.role, to: input.role },
        },
      });
      return updated;
    });
  }

  async removeMember(actor: AuthenticatedActor, userId: string): Promise<void> {
    this.assertTenantAdmin(actor);
    if (userId === actor.userId)
      throw new BadRequestException('Use owner transfer before leaving this workspace.');
    await withTenantContext(this.database.client, actor, async (transaction) => {
      const membership = await transaction.membership.findUnique({
        where: { tenantId_userId: { tenantId: actor.tenantId, userId } },
      });
      if (!membership) throw new NotFoundException('Workspace member not found.');
      if (membership.role === MembershipRole.OWNER && actor.role !== MembershipRole.OWNER)
        throw new ForbiddenException('Only an owner can remove another owner.');
      await transaction.membership.delete({
        where: { tenantId_userId: { tenantId: actor.tenantId, userId } },
      });
      await transaction.session.updateMany({
        where: { tenantId: actor.tenantId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'membership.removed',
          targetType: 'user',
          targetId: userId,
          result: 'success',
        },
      });
    });
  }

  connectors(actor: AuthenticatedActor) {
    this.assertTenantAdmin(actor);
    return withTenantContext(this.database.client, actor, (transaction) =>
      transaction.connectorInstallation.findMany({
        where: { tenantId: actor.tenantId },
        select: {
          id: true,
          platform: true,
          displayName: true,
          protocolVersion: true,
          status: true,
          lastSeenAt: true,
          createdAt: true,
          defaultProjectId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async revokeConnector(actor: AuthenticatedActor, connectorId: string): Promise<void> {
    this.assertTenantAdmin(actor);
    await withTenantContext(this.database.client, actor, async (transaction) => {
      const connector = await transaction.connectorInstallation.findFirst({
        where: { id: connectorId, tenantId: actor.tenantId },
      });
      if (!connector) throw new NotFoundException('Connector not found.');
      const now = new Date();
      await transaction.connectorInstallation.update({
        where: { id: connector.id },
        data: { status: 'REVOKED', revokedAt: now },
      });
      await transaction.connectorCredential.updateMany({
        where: { installationId: connector.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'connector.revoked',
          targetType: 'connector',
          targetId: connector.id,
          result: 'success',
        },
      });
    });
  }

  private assertTenantAdmin(actor: AuthenticatedActor): void {
    if (!TENANT_ADMIN_ROLES.has(actor.role)) {
      throw new ForbiddenException('Tenant administrator access is required.');
    }
  }

  private assertInstanceAdmin(actor: AuthenticatedActor): void {
    if (!actor.isInstanceAdmin) throw new ForbiddenException('Instance administrator required.');
  }
}
