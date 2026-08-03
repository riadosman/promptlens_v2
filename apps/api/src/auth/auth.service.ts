import { randomBytes, createHash, createHmac } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { parseRuntimeConfig } from '@promptlens/config';
import type {
  LoginRequest,
  RegisterRequest,
  ResetPassword,
  SessionResponse,
} from '@promptlens/contracts';
import { AuthTokenPurpose, MembershipRole, Prisma, withTenantContext } from '@promptlens/database';
import { DatabaseService } from '../database/database.service.js';
import type { AuthenticatedActor } from './auth.types.js';
import { MailService } from './mail.service.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1_000;
const RESET_TTL_MS = 60 * 60 * 1_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function slugPrefix(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return normalized || 'workspace';
}

@Injectable()
export class AuthService {
  private readonly config = parseRuntimeConfig(process.env);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MailService) private readonly mail: MailService,
  ) {}

  async register(
    input: RegisterRequest,
    metadata?: { readonly ip?: string; readonly userAgent?: string },
  ): Promise<{ token: string; response: SessionResponse }> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hash(input.password, {
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const suffix = randomBytes(4).toString('hex');
    const verificationToken = randomBytes(32).toString('base64url');

    try {
      const result = await this.database.client.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promptlens:first-user'))`;
        const existingUsers = await transaction.user.count();
        const user = await transaction.user.create({
          data: {
            email,
            displayName: input.displayName,
            passwordHash,
            isInstanceAdmin: existingUsers === 0,
            emailVerifiedAt:
              !this.config.EMAIL_VERIFICATION_REQUIRED || existingUsers === 0 ? new Date() : null,
          },
        });
        const tenant = await transaction.tenant.create({
          data: { name: input.tenantName, slug: `${slugPrefix(input.tenantName)}-${suffix}` },
        });
        await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
        await transaction.$executeRaw`SELECT set_config('app.user_id', ${user.id}, true)`;
        await transaction.membership.create({
          data: { tenantId: tenant.id, userId: user.id, role: MembershipRole.OWNER },
        });
        await transaction.project.create({
          data: { tenantId: tenant.id, name: 'General', description: 'Default project' },
        });
        const session = await transaction.session.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            tenantId: tenant.id,
            expiresAt,
            ipHash: metadata?.ip ? this.hashIp(metadata.ip) : null,
            userAgent: metadata?.userAgent?.slice(0, 512) ?? null,
          },
        });
        await transaction.auditEvent.create({
          data: {
            tenantId: tenant.id,
            actorId: user.id,
            action: 'auth.registered',
            targetType: 'user',
            targetId: user.id,
            result: 'success',
          },
        });
        if (this.config.EMAIL_VERIFICATION_REQUIRED && existingUsers > 0) {
          await transaction.authToken.create({
            data: {
              userId: user.id,
              tokenHash: hashToken(verificationToken),
              purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
              expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
            },
          });
        }
        return { user, tenant, session };
      });

      if (this.config.EMAIL_VERIFICATION_REQUIRED && !result.user.emailVerifiedAt) {
        await this.mail.sendVerification(result.user.email, verificationToken);
      }

      return {
        token,
        response: {
          user: {
            id: result.user.id,
            email: result.user.email,
            displayName: result.user.displayName,
          },
          tenant: { id: result.tenant.id, name: result.tenant.name, role: MembershipRole.OWNER },
        },
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }
  }

  async login(
    input: LoginRequest,
    metadata?: { readonly ip?: string; readonly userAgent?: string },
  ): Promise<{ token: string; response: SessionResponse }> {
    const user = await this.database.client.user.findUnique({
      where: { email: normalizeEmail(input.email) },
    });

    if (!user || user.status !== 'ACTIVE' || !(await verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (this.config.EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt) {
      throw new ForbiddenException('Email verification is required.');
    }

    const membership = await this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.user_id', ${user.id}, true)`;
      return transaction.membership.findFirst({
        where: { userId: user.id },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      });
    });
    if (!membership) throw new UnauthorizedException('No active workspace membership.');

    const token = randomBytes(32).toString('base64url');
    await this.database.client.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        tenantId: membership.tenantId,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ipHash: metadata?.ip ? this.hashIp(metadata.ip) : null,
        userAgent: metadata?.userAgent?.slice(0, 512) ?? null,
      },
    });

    return {
      token,
      response: {
        user: { id: user.id, email: user.email, displayName: user.displayName },
        tenant: {
          id: membership.tenant.id,
          name: membership.tenant.name,
          role: membership.role,
        },
      },
    };
  }

  async authenticate(token: string | undefined): Promise<AuthenticatedActor> {
    if (!token) throw new UnauthorizedException('Authentication required.');
    const session = await this.database.client.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { isInstanceAdmin: true, status: true } } },
    });
    if (
      !session ||
      session.user.status !== 'ACTIVE' ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session is invalid or expired.');
    }
    const membership = await this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${session.tenantId}, true)`;
      await transaction.$executeRaw`SELECT set_config('app.user_id', ${session.userId}, true)`;
      return transaction.membership.findUnique({
        where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } },
      });
    });
    if (!membership) throw new UnauthorizedException('Workspace access was removed.');
    return {
      userId: session.userId,
      tenantId: session.tenantId,
      role: membership.role,
      sessionId: session.id,
      isInstanceAdmin: session.user.isInstanceAdmin,
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.database.client.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async sessions(actor: AuthenticatedActor) {
    return withTenantContext(this.database.client, actor, async (transaction) => {
      const sessions = await transaction.session.findMany({
        where: {
          userId: actor.userId,
          tenantId: actor.tenantId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return sessions.map((session) => ({
        ...session,
        current: session.id === actor.sessionId,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      }));
    });
  }

  async revokeSession(actor: AuthenticatedActor, sessionId: string): Promise<void> {
    await withTenantContext(this.database.client, actor, async (transaction) => {
      const revoked = await transaction.session.updateMany({
        where: {
          id: sessionId,
          userId: actor.userId,
          tenantId: actor.tenantId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new NotFoundException('Session not found.');
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'session.revoked',
          targetType: 'session',
          targetId: sessionId,
          result: 'success',
          metadata: { current: sessionId === actor.sessionId },
        },
      });
    });
  }

  async tenants(token: string | undefined) {
    const actor = await this.authenticate(token);
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.user_id', ${actor.userId}, true)`;
      return transaction.membership.findMany({
        where: { userId: actor.userId },
        select: { role: true, tenant: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  async switchTenant(
    token: string | undefined,
    tenantId: string,
  ): Promise<{ token: string; response: SessionResponse }> {
    const actor = await this.authenticate(token);
    const nextToken = randomBytes(32).toString('base64url');
    const result = await this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.user_id', ${actor.userId}, true)`;
      await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      const membership = await transaction.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: actor.userId } },
        include: { tenant: true, user: true },
      });
      if (!membership) throw new ForbiddenException('Workspace access is required.');
      const oldSession = await transaction.session.findUniqueOrThrow({
        where: { id: actor.sessionId },
      });
      await transaction.session.update({
        where: { id: actor.sessionId },
        data: { revokedAt: new Date() },
      });
      await transaction.session.create({
        data: {
          tokenHash: hashToken(nextToken),
          userId: actor.userId,
          tenantId,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          ipHash: oldSession.ipHash,
          userAgent: oldSession.userAgent,
        },
      });
      return membership;
    });
    return {
      token: nextToken,
      response: {
        user: {
          id: result.user.id,
          email: result.user.email,
          displayName: result.user.displayName,
        },
        tenant: { id: result.tenant.id, name: result.tenant.name, role: result.role },
      },
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const now = new Date();
    const record = await this.database.client.authToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !record ||
      record.purpose !== AuthTokenPurpose.EMAIL_VERIFICATION ||
      record.usedAt ||
      record.expiresAt <= now
    ) {
      throw new BadRequestException('Verification token is invalid or expired.');
    }
    const consumed = await this.database.client.$transaction(async (transaction) => {
      const claim = await transaction.authToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claim.count !== 1) return false;
      await transaction.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      });
      return true;
    });
    if (!consumed) throw new BadRequestException('Verification token is invalid or expired.');
  }

  async resendVerification(emailInput: string): Promise<void> {
    const user = await this.database.client.user.findUnique({
      where: { email: normalizeEmail(emailInput) },
    });
    if (!user || user.status !== 'ACTIVE' || user.emailVerifiedAt) return;
    const token = randomBytes(32).toString('base64url');
    await this.database.client.$transaction(async (transaction) => {
      await transaction.authToken.updateMany({
        where: {
          userId: user.id,
          purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });
      await transaction.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          purpose: AuthTokenPurpose.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        },
      });
    });
    await this.mail.sendVerification(user.email, token);
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const user = await this.database.client.user.findUnique({
      where: { email: normalizeEmail(emailInput) },
    });
    if (!user || user.status !== 'ACTIVE') return;
    const token = randomBytes(32).toString('base64url');
    await this.database.client.$transaction(async (transaction) => {
      await transaction.authToken.updateMany({
        where: { userId: user.id, purpose: AuthTokenPurpose.PASSWORD_RESET, usedAt: null },
        data: { usedAt: new Date() },
      });
      await transaction.authToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          purpose: AuthTokenPurpose.PASSWORD_RESET,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });
    });
    await this.mail.sendPasswordReset(user.email, token);
  }

  async resetPassword(input: ResetPassword): Promise<void> {
    const now = new Date();
    const record = await this.database.client.authToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (
      !record ||
      record.purpose !== AuthTokenPurpose.PASSWORD_RESET ||
      record.usedAt ||
      record.expiresAt <= now
    ) {
      throw new BadRequestException('Password reset token is invalid or expired.');
    }
    const passwordHash = await hash(input.password, {
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const consumed = await this.database.client.$transaction(async (transaction) => {
      const claim = await transaction.authToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claim.count !== 1) return false;
      await transaction.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await transaction.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
    if (!consumed) throw new BadRequestException('Password reset token is invalid or expired.');
  }

  private hashIp(ip: string): string {
    return createHmac('sha256', this.config.SESSION_HASH_SECRET).update(ip).digest('hex');
  }
}
