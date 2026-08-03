import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import {
  approveDeviceRequestSchema,
  createDeviceAuthorizationRequestSchema,
  pollDeviceTokenRequestSchema,
  refreshConnectorTokenRequestSchema,
  type ApproveDeviceRequest,
  type CreateDeviceAuthorizationRequest,
  type PollDeviceTokenRequest,
  type RefreshConnectorTokenRequest,
} from '@promptlens/contracts';
import type { FastifyRequest } from 'fastify';
import { AuthService } from '../auth/auth.service.js';
import { parseBody } from '../http/parse-body.js';
import { DeviceAuthorizationService } from './device-authorization.service.js';

const COOKIE_NAME = 'promptlens_session';

@Controller('connectors')
export class DeviceAuthorizationController {
  constructor(
    @Inject(DeviceAuthorizationService) private readonly devices: DeviceAuthorizationService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Post('device/authorization')
  create(@Body() body: CreateDeviceAuthorizationRequest) {
    return this.devices.create(parseBody(createDeviceAuthorizationRequestSchema, body));
  }

  @Post('device/approve')
  @HttpCode(204)
  async approve(@Req() request: FastifyRequest, @Body() body: ApproveDeviceRequest) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    await this.devices.approve(actor, parseBody(approveDeviceRequestSchema, body));
  }

  @Post('device/token')
  @HttpCode(200)
  token(@Body() body: PollDeviceTokenRequest) {
    const input = parseBody(pollDeviceTokenRequestSchema, body);
    return this.devices.poll(input.deviceCode, input.codeVerifier);
  }

  @Post('token/refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshConnectorTokenRequest) {
    const input = parseBody(refreshConnectorTokenRequestSchema, body);
    return this.devices.refresh(input.refreshToken);
  }
}
