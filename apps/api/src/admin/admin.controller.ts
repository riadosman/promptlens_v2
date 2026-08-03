import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  addMemberSchema,
  requestSupportGrantSchema,
  scheduleTenantDeletionSchema,
  tenantSettingsSchema,
  updateMemberSchema,
  type AddMemberRequest,
  type RequestSupportGrantRequest,
  type ScheduleTenantDeletionRequest,
  type TenantSettingsRequest,
  type UpdateMemberRequest,
} from '@promptlens/contracts';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { parseBody } from '../http/parse-body.js';
import { AdminService } from './admin.service.js';
import { OperationsService } from './operations.service.js';

const COOKIE_NAME = 'promptlens_session';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(OperationsService) private readonly operations: OperationsService,
  ) {}

  private actor(request: FastifyRequest) {
    return this.auth.authenticate(request.cookies[COOKIE_NAME]);
  }

  @Get('overview')
  async overview(@Req() request: FastifyRequest) {
    return this.admin.overview(await this.actor(request));
  }

  @Get('instance/users')
  async instanceUsers(@Req() request: FastifyRequest) {
    return this.admin.instanceUsers(await this.actor(request));
  }

  @Patch('instance/users/:userId/status')
  @HttpCode(204)
  async updateUserStatus(
    @Req() request: FastifyRequest,
    @Param('userId') userId: string,
    @Body() body: { status?: string },
  ) {
    const input = parseBody(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }), body);
    await this.admin.updateUserStatus(await this.actor(request), userId, input.status);
  }

  @Post('instance/support-requests')
  async requestSupport(@Req() request: FastifyRequest, @Body() body: RequestSupportGrantRequest) {
    return this.admin.requestSupport(
      await this.actor(request),
      parseBody(requestSupportGrantSchema, body),
    );
  }

  @Get('instance/support/:tenantId/metadata')
  async supportMetadata(@Req() request: FastifyRequest, @Param('tenantId') tenantId: string) {
    return this.admin.supportMetadata(await this.actor(request), tenantId);
  }

  @Get('support-requests')
  async supportRequests(@Req() request: FastifyRequest) {
    return this.admin.supportRequests(await this.actor(request));
  }

  @Post('support-requests/:grantId/approve')
  async approveSupport(@Req() request: FastifyRequest, @Param('grantId') grantId: string) {
    return this.admin.approveSupport(await this.actor(request), grantId);
  }

  @Delete('support-requests/:grantId')
  @HttpCode(204)
  async revokeSupport(@Req() request: FastifyRequest, @Param('grantId') grantId: string) {
    await this.admin.revokeSupport(await this.actor(request), grantId);
  }

  @Get('members')
  async members(@Req() request: FastifyRequest) {
    return this.admin.members(await this.actor(request));
  }

  @Get('audit')
  async audit(@Req() request: FastifyRequest) {
    return this.admin.audit(await this.actor(request));
  }

  @Get('usage')
  async usage(@Req() request: FastifyRequest) {
    return this.admin.usage(await this.actor(request));
  }

  @Get('settings')
  async settings(@Req() request: FastifyRequest) {
    return this.admin.settings(await this.actor(request));
  }

  @Patch('settings')
  async updateSettings(@Req() request: FastifyRequest, @Body() body: TenantSettingsRequest) {
    return this.admin.updateSettings(
      await this.actor(request),
      parseBody(tenantSettingsSchema, body),
    );
  }

  @Get('data-export')
  async dataExport(@Req() request: FastifyRequest) {
    return this.admin.dataExport(await this.actor(request));
  }

  @Post('deletion')
  async scheduleDeletion(
    @Req() request: FastifyRequest,
    @Body() body: ScheduleTenantDeletionRequest,
  ) {
    return this.admin.scheduleDeletion(
      await this.actor(request),
      parseBody(scheduleTenantDeletionSchema, body),
    );
  }

  @Delete('deletion')
  @HttpCode(204)
  async cancelDeletion(@Req() request: FastifyRequest) {
    await this.admin.cancelDeletion(await this.actor(request));
  }

  @Post('members')
  addMember(@Req() request: FastifyRequest, @Body() body: AddMemberRequest) {
    return this.actor(request).then((actor) =>
      this.admin.addMember(actor, parseBody(addMemberSchema, body)),
    );
  }

  @Patch('members/:userId')
  updateMember(
    @Req() request: FastifyRequest,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberRequest,
  ) {
    return this.actor(request).then((actor) =>
      this.admin.updateMember(actor, userId, parseBody(updateMemberSchema, body)),
    );
  }

  @Delete('members/:userId')
  @HttpCode(204)
  async removeMember(@Req() request: FastifyRequest, @Param('userId') userId: string) {
    await this.admin.removeMember(await this.actor(request), userId);
  }

  @Get('connectors')
  connectors(@Req() request: FastifyRequest) {
    return this.actor(request).then((actor) => this.admin.connectors(actor));
  }

  @Delete('connectors/:connectorId')
  @HttpCode(204)
  async revokeConnector(@Req() request: FastifyRequest, @Param('connectorId') connectorId: string) {
    await this.admin.revokeConnector(await this.actor(request), connectorId);
  }

  @Get('operations/queue')
  async queueStatus(@Req() request: FastifyRequest) {
    return this.operations.queueStatus(await this.actor(request));
  }

  @Post('operations/queue/:jobId/retry')
  @HttpCode(204)
  async retryJob(@Req() request: FastifyRequest, @Param('jobId') jobId: string) {
    await this.operations.retry(await this.actor(request), jobId);
  }
}
