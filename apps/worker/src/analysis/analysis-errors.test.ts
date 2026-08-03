import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { classifyAnalysisError } from './analysis-errors.js';

describe('classifyAnalysisError', () => {
  it.each([
    [{ status: 429 }, 'PROVIDER_RATE_LIMITED', true],
    [{ status: 503 }, 'PROVIDER_UNAVAILABLE', true],
    [new Error('request timed out'), 'PROVIDER_TIMEOUT', true],
    [new Error('AI provider returned no structured analysis.'), 'PROVIDER_INVALID_RESPONSE', false],
  ] as const)('classifies provider failures', (error, code, retryable) => {
    expect(classifyAnalysisError(error)).toEqual({ code, retryable });
  });

  it('does not retry schema-invalid provider output', () => {
    let failure: unknown;
    try {
      z.object({ score: z.number().min(0).max(100) }).parse({ score: 101 });
    } catch (error: unknown) {
      failure = error;
    }
    expect(classifyAnalysisError(failure)).toEqual({
      code: 'PROVIDER_INVALID_RESPONSE',
      retryable: false,
    });
  });
});
