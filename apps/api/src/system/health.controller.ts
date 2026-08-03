import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@promptlens/contracts';
import { HealthService } from './health.service.js';
import { ReadinessService } from './readiness.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
    @Inject(ReadinessService) private readonly readinessService: ReadinessService,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return this.healthService.liveness();
  }

  @Get('ready')
  ready() {
    return this.readinessService.check();
  }
}
