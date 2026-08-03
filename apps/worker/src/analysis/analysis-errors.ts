import { ZodError } from 'zod';

export interface ClassifiedAnalysisError {
  readonly code:
    | 'PROVIDER_RATE_LIMITED'
    | 'PROVIDER_UNAVAILABLE'
    | 'PROVIDER_TIMEOUT'
    | 'PROVIDER_INVALID_RESPONSE'
    | 'PROVIDER_ERROR';
  readonly retryable: boolean;
}

function numericStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}

export function classifyAnalysisError(error: unknown): ClassifiedAnalysisError {
  if (error instanceof ZodError) {
    return { code: 'PROVIDER_INVALID_RESPONSE', retryable: false };
  }
  const status = numericStatus(error);
  if (status === 429) return { code: 'PROVIDER_RATE_LIMITED', retryable: true };
  if (status !== undefined && status >= 500) {
    return { code: 'PROVIDER_UNAVAILABLE', retryable: true };
  }
  if (
    error instanceof Error &&
    (error.name === 'AbortError' || /timeout|timed out|ETIMEDOUT/i.test(error.message))
  ) {
    return { code: 'PROVIDER_TIMEOUT', retryable: true };
  }
  if (
    error instanceof Error &&
    /no structured analysis|structured analysis.*missing/i.test(error.message)
  ) {
    return { code: 'PROVIDER_INVALID_RESPONSE', retryable: false };
  }
  return { code: 'PROVIDER_ERROR', retryable: true };
}
