import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import {
  createProjectRequestSchema,
  type CreateProjectRequest,
  type UpdateProjectRequest,
  updateProjectRequestSchema,
} from '@promptlens/contracts';
import type { FastifyRequest } from 'fastify';
import { AuthService } from '../auth/auth.service.js';
import { parseBody } from '../http/parse-body.js';
import { ProjectsService } from './projects.service.js';

const COOKIE_NAME = 'promptlens_session';

@Controller('projects')
export class ProjectsController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(@Req() request: FastifyRequest) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.projects.list(actor);
  }

  @Post()
  async create(@Req() request: FastifyRequest, @Body() body: CreateProjectRequest) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.projects.create(actor, parseBody(createProjectRequestSchema, body));
  }

  @Patch(':id')
  async update(
    @Req() request: FastifyRequest,
    @Param('id') projectId: string,
    @Body() body: UpdateProjectRequest,
  ) {
    const actor = await this.auth.authenticate(request.cookies[COOKIE_NAME]);
    return this.projects.update(actor, projectId, parseBody(updateProjectRequestSchema, body));
  }
}
