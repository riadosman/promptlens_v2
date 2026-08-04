import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  dashboardStatsQuerySchema,
  promptListQuerySchema,
  type DashboardStatsQuery,
  type PromptListQuery,
} from '@promptlens/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../auth/auth.service.js';
import { parseBody } from '../http/parse-body.js';
import { PromptHistoryService } from './prompt-history.service.js';

const COOKIE_NAME = 'promptlens_session';

@Controller()
export class PromptHistoryController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PromptHistoryService) private readonly history: PromptHistoryService,
  ) {}

  @Get('prompts')
  async list(@Req() request: FastifyRequest, @Query() query: PromptListQuery) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.history.list(actor, parseBody(promptListQuerySchema, query));
  }

  @Get('prompts/:id')
  async detail(@Req() request: FastifyRequest, @Param('id') promptId: string) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.history.detail(actor, promptId);
  }

  @Get('prompt-exports')
  async export(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query() query: PromptListQuery & { format?: string },
  ) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    const format = query.format ?? 'json';
    if (format !== 'json' && format !== 'csv')
      throw new BadRequestException('Export format must be json or csv.');
    const result = await this.history.export(
      actor,
      parseBody(promptListQuerySchema, query),
      format,
    );
    reply.header('content-type', result.contentType);
    reply.header(
      'content-disposition',
      `attachment; filename="promptlens-export.${result.extension}"`,
    );
    return result.body;
  }

  @Get('dashboard/stats')
  async stats(@Req() request: FastifyRequest, @Query() query: DashboardStatsQuery) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    const parsed = parseBody(dashboardStatsQuerySchema, query);
    return this.history.stats(actor, parsed.scope);
  }

  @Post('prompts/:id/analyses')
  @HttpCode(202)
  async reanalyze(@Req() request: FastifyRequest, @Param('id') promptId: string) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.history.reanalyze(actor, promptId);
  }

  @Delete('prompts/:id')
  @HttpCode(204)
  async delete(@Req() request: FastifyRequest, @Param('id') promptId: string) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    await this.history.delete(actor, promptId);
  }
}
