import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  loginRequestSchema,
  requestPasswordResetSchema,
  registerRequestSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  switchTenantSchema,
  verifyEmailSchema,
  type LoginRequest,
  type RequestPasswordReset,
  type RegisterRequest,
  type ResendVerification,
  type ResetPassword,
  type SwitchTenantRequest,
  type VerifyEmail,
} from '@promptlens/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseBody } from '../http/parse-body.js';
import { AuthService } from './auth.service.js';

const COOKIE_NAME = 'promptlens_session';
const webOrigin = new URL(process.env.WEB_ORIGIN ?? 'http://localhost:3000');
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: webOrigin.protocol === 'https:',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60,
};

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Req() request: FastifyRequest,
    @Body() body: RegisterRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.register(parseBody(registerRequestSchema, body), {
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });
    reply.setCookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    return result.response;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Req() request: FastifyRequest,
    @Body() body: LoginRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(parseBody(loginRequestSchema, body), {
      ip: request.ip,
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });
    reply.setCookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    return result.response;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(request.cookies[COOKIE_NAME]);
    reply.clearCookie(COOKIE_NAME, { path: '/' });
  }

  @Post('email/verify')
  @HttpCode(204)
  async verifyEmail(@Body() body: VerifyEmail) {
    const input = parseBody(verifyEmailSchema, body);
    await this.auth.verifyEmail(input.token);
  }

  @Post('email/resend')
  @HttpCode(204)
  async resendVerification(@Body() body: ResendVerification) {
    const input = parseBody(resendVerificationSchema, body);
    await this.auth.resendVerification(input.email);
  }

  @Post('password/forgot')
  @HttpCode(204)
  async forgotPassword(@Body() body: RequestPasswordReset) {
    const input = parseBody(requestPasswordResetSchema, body);
    await this.auth.requestPasswordReset(input.email);
  }

  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body() body: ResetPassword) {
    await this.auth.resetPassword(parseBody(resetPasswordSchema, body));
  }

  @Get('session')
  async session(@Req() request: FastifyRequest) {
    return this.auth.authenticate(request.cookies[COOKIE_NAME]);
  }

  @Get('sessions')
  async sessions(@Req() request: FastifyRequest) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.auth.sessions(actor);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@Req() request: FastifyRequest, @Param('id') sessionId: string) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    await this.auth.revokeSession(actor, sessionId);
  }

  @Get('tenants')
  tenants(@Req() request: FastifyRequest) {
    return this.auth.tenants(request.cookies[COOKIE_NAME]);
  }

  @Post('tenant/switch')
  @HttpCode(200)
  async switchTenant(
    @Req() request: FastifyRequest,
    @Body() body: SwitchTenantRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const input = parseBody(switchTenantSchema, body);
    const result = await this.auth.switchTenant(request.cookies[COOKIE_NAME], input.tenantId);
    reply.setCookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    return result.response;
  }
}
