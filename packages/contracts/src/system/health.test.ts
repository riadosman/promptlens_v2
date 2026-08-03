import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts the public health contract', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      service: 'api',
      version: '0.0.0',
      timestamp: '2026-07-30T10:00:00.000Z',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown health states', () => {
    expect(healthResponseSchema.safeParse({ status: 'degraded' }).success).toBe(false);
  });
});
