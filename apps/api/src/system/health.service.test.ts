import { describe, expect, it } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('returns deterministic liveness metadata', () => {
    const response = new HealthService().liveness(new Date('2026-07-30T10:00:00.000Z'));

    expect(response).toEqual({
      status: 'ok',
      service: 'api',
      version: '0.0.0',
      timestamp: '2026-07-30T10:00:00.000Z',
    });
  });
});
