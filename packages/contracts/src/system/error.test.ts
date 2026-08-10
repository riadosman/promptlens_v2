import { describe, expect, it } from 'vitest';
import { apiErrorResponseSchema } from './error.js';

describe('apiErrorResponseSchema', () => {
  it('accepts the stable public error envelope', () => {
    expect(
      apiErrorResponseSchema.parse({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        requestId: 'request-123',
        details: [{ path: 'email', message: 'Invalid email' }],
      }),
    ).toBeDefined();
  });
});
