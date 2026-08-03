import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@promptlens/contracts';

@Injectable()
export class HealthService {
  liveness(now = new Date()): HealthResponse {
    return {
      status: 'ok',
      service: 'api',
      version: '0.0.0',
      timestamp: now.toISOString(),
    };
  }
}
