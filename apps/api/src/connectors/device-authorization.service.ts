import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { parseRuntimeConfig } from '@promptlens/config';
import type {
  ApproveDeviceRequest,
  ConnectorTokenResponse,
  CreateDeviceAuthorizationRequest,
  DeviceAuthorizationResponse,
} from '@promptlens/contracts';
import {
  ConnectorStatus,
  DeviceAuthorizationStatus,
  withTenantContext,
} from '@promptlens/database';
import type { AuthenticatedActor } from '../auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import type { AuthenticatedConnector } from './connector-auth.types.js';

const DEVICE_TTL_SECONDS = 600;
const POLL_INTERVAL_SECONDS = 5;
const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function pkceChallenge(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

function opaqueToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

function userCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

@Injectable()
export class DeviceAuthorizationService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(input: CreateDeviceAuthorizationRequest): Promise<DeviceAuthorizationResponse> {
    const deviceCode = opaqueToken('pld');
    const code = userCode();
    await this.database.client.deviceAuthorization.create({
      data: {
        deviceCodeHash: digest(deviceCode),
        userCode: code,
        platform: input.platform,
        displayName: input.displayName,
        protocolVersion: input.protocolVersion,
        ...(input.codeChallenge ? { codeChallenge: input.codeChallenge } : {}),
        expiresAt: new Date(Date.now() + DEVICE_TTL_SECONDS * 1_000),
      },
    });
    const config = parseRuntimeConfig(process.env);
    return {
      deviceCode,
      userCode: code,
      verificationUri: `${config.WEB_ORIGIN}/connect`,
      expiresIn: DEVICE_TTL_SECONDS,
      interval: POLL_INTERVAL_SECONDS,
    };
  }

  async approve(actor: AuthenticatedActor, input: ApproveDeviceRequest): Promise<void> {
    await withTenantContext(this.database.client, actor, async (transaction) => {
      const authorization = await transaction.deviceAuthorization.findUnique({
        where: { userCode: input.userCode.toUpperCase() },
      });
      if (!authorization) throw new NotFoundException('Device authorization not found.');
      if (authorization.status !== DeviceAuthorizationStatus.PENDING) {
        throw new BadRequestException('Device authorization is no longer pending.');
      }
      if (authorization.expiresAt <= new Date()) {
        await transaction.deviceAuthorization.update({
          where: { id: authorization.id },
          data: { status: DeviceAuthorizationStatus.EXPIRED },
        });
        throw new BadRequestException('Device authorization expired.');
      }
      const project = await transaction.project.findFirst({
        where: { id: input.projectId, tenantId: actor.tenantId, status: 'ACTIVE' },
      });
      if (!project) throw new ForbiddenException('Project is not available to this workspace.');
      const installation = await transaction.connectorInstallation.create({
        data: {
          tenantId: actor.tenantId,
          createdById: actor.userId,
          platform: authorization.platform,
          protocolVersion: authorization.protocolVersion,
          displayName: authorization.displayName,
          defaultProjectId: project.id,
          status: ConnectorStatus.ACTIVE,
        },
      });
      await transaction.deviceAuthorization.update({
        where: { id: authorization.id },
        data: {
          status: DeviceAuthorizationStatus.APPROVED,
          tenantId: actor.tenantId,
          userId: actor.userId,
          projectId: project.id,
          installationId: installation.id,
        },
      });
      await transaction.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorId: actor.userId,
          action: 'connector.approved',
          targetType: 'connector',
          targetId: installation.id,
          result: 'success',
          metadata: { platform: authorization.platform },
        },
      });
    });
  }

  async poll(deviceCode: string, codeVerifier?: string): Promise<ConnectorTokenResponse> {
    const now = new Date();
    const accessToken = opaqueToken('pla');
    const refreshToken = opaqueToken('plr');
    const result = await this.database.client.$transaction(async (transaction) => {
      const authorization = await transaction.deviceAuthorization.findUnique({
        where: { deviceCodeHash: digest(deviceCode) },
      });
      if (!authorization) return { state: 'invalid' as const };
      if (
        authorization.codeChallenge &&
        (!codeVerifier || pkceChallenge(codeVerifier) !== authorization.codeChallenge)
      ) {
        return { state: 'invalid_verifier' as const };
      }
      if (authorization.expiresAt <= now) {
        await transaction.deviceAuthorization.updateMany({
          where: { id: authorization.id, status: DeviceAuthorizationStatus.PENDING },
          data: { status: DeviceAuthorizationStatus.EXPIRED },
        });
        return { state: 'expired' as const };
      }
      if (
        authorization.lastPolledAt &&
        now.getTime() - authorization.lastPolledAt.getTime() < POLL_INTERVAL_SECONDS * 1_000
      ) {
        return { state: 'slow_down' as const };
      }
      if (authorization.status === DeviceAuthorizationStatus.PENDING) {
        await transaction.deviceAuthorization.update({
          where: { id: authorization.id },
          data: { lastPolledAt: now },
        });
        return { state: 'pending' as const };
      }
      if (
        authorization.status !== DeviceAuthorizationStatus.APPROVED ||
        !authorization.installationId
      ) {
        return { state: 'denied' as const };
      }
      const claimed = await transaction.deviceAuthorization.updateMany({
        where: { id: authorization.id, status: DeviceAuthorizationStatus.APPROVED },
        data: { status: DeviceAuthorizationStatus.CONSUMED, lastPolledAt: now },
      });
      if (claimed.count !== 1) return { state: 'denied' as const };
      await transaction.connectorCredential.create({
        data: {
          tenantId: authorization.tenantId!,
          installationId: authorization.installationId,
          accessTokenHash: digest(accessToken),
          refreshTokenHash: digest(refreshToken),
          familyId: randomUUID(),
          accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_SECONDS * 1_000),
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1_000),
        },
      });
      return {
        state: 'issued' as const,
        installationId: authorization.installationId,
        projectId: authorization.projectId!,
      };
    });

    if (result.state === 'invalid') throw new UnauthorizedException('Invalid device code.');
    if (result.state === 'invalid_verifier') {
      throw new UnauthorizedException('Invalid PKCE code verifier.');
    }
    if (result.state === 'expired') throw new BadRequestException('Device code expired.');
    if (result.state === 'slow_down') throw new BadRequestException({ error: 'slow_down' });
    if (result.state === 'pending')
      throw new BadRequestException({ error: 'authorization_pending' });
    if (result.state === 'denied') throw new BadRequestException({ error: 'access_denied' });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TTL_SECONDS,
      installationId: result.installationId,
      projectId: result.projectId,
    };
  }

  async refresh(refreshToken: string): Promise<ConnectorTokenResponse> {
    const now = new Date();
    const nextAccessToken = opaqueToken('pla');
    const nextRefreshToken = opaqueToken('plr');
    const result = await this.database.client.$transaction(async (transaction) => {
      const credential = await transaction.connectorCredential.findUnique({
        where: { refreshTokenHash: digest(refreshToken) },
      });
      if (!credential || credential.revokedAt || credential.refreshExpiresAt <= now) {
        return { state: 'invalid' as const };
      }
      await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${credential.tenantId}, true)`;
      await transaction.$executeRaw`SELECT set_config('app.user_id', ${'00000000-0000-0000-0000-000000000000'}, true)`;
      const claimed = await transaction.connectorCredential.updateMany({
        where: { id: credential.id, usedAt: null, revokedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) {
        await transaction.connectorCredential.updateMany({
          where: { familyId: credential.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { state: 'reuse' as const };
      }
      const replacement = await transaction.connectorCredential.create({
        data: {
          tenantId: credential.tenantId,
          installationId: credential.installationId,
          accessTokenHash: digest(nextAccessToken),
          refreshTokenHash: digest(nextRefreshToken),
          familyId: credential.familyId,
          accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_SECONDS * 1_000),
          refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS * 1_000),
        },
      });
      await transaction.connectorCredential.update({
        where: { id: credential.id },
        data: { replacedById: replacement.id },
      });
      const installation = await transaction.connectorInstallation.findUniqueOrThrow({
        where: { id: credential.installationId },
        select: { defaultProjectId: true },
      });
      return {
        state: 'issued' as const,
        installationId: credential.installationId,
        projectId: installation.defaultProjectId,
      };
    });
    if (result.state === 'invalid')
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    if (result.state === 'reuse') throw new UnauthorizedException('Refresh token reuse detected.');
    return {
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TTL_SECONDS,
      installationId: result.installationId,
      projectId: result.projectId,
    };
  }

  async authenticate(accessToken: string | undefined): Promise<AuthenticatedConnector> {
    if (!accessToken) throw new UnauthorizedException('Connector token required.');
    const credential = await this.database.client.connectorCredential.findUnique({
      where: { accessTokenHash: digest(accessToken) },
    });
    const installation = credential
      ? await withTenantContext(
          this.database.client,
          { tenantId: credential.tenantId, userId: '00000000-0000-0000-0000-000000000000' },
          (transaction) =>
            transaction.connectorInstallation.findUnique({
              where: { id: credential.installationId },
            }),
        )
      : null;
    if (
      !credential ||
      credential.revokedAt ||
      credential.accessExpiresAt <= new Date() ||
      !installation ||
      installation.status !== ConnectorStatus.ACTIVE
    ) {
      throw new UnauthorizedException('Connector token is invalid or expired.');
    }
    return {
      installationId: installation.id,
      tenantId: installation.tenantId,
      userId: installation.createdById,
      defaultProjectId: installation.defaultProjectId,
      platform: installation.platform,
    };
  }
}
