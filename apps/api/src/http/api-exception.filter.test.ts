import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';

function hostFor(requestId: string) {
  const send = vi.fn();
  const code = vi.fn(() => ({ send }));
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ id: requestId }),
      getResponse: () => ({ code, send }),
    }),
  } as unknown as ArgumentsHost;
  return { host, code, send };
}

describe('ApiExceptionFilter', () => {
  it('returns the stable validation error envelope', () => {
    const logger = { error: vi.fn() };
    const filter = new ApiExceptionFilter(logger);
    const { host, code, send } = hostFor('request-123');

    filter.catch(
      new BadRequestException({
        message: 'Request validation failed.',
        errors: [{ path: 'email', message: 'Invalid email' }],
      }),
      host,
    );

    expect(code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      requestId: 'request-123',
      details: [{ path: 'email', message: 'Invalid email' }],
    });
  });

  it('does not expose unexpected exception details', () => {
    const logger = { error: vi.fn() };
    const filter = new ApiExceptionFilter(logger);
    const { host, code, send } = hostFor('request-500');

    filter.catch(new Error('database password leaked'), host);

    expect(code).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      requestId: 'request-500',
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
