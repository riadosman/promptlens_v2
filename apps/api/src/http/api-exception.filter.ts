import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiErrorResponse } from '@promptlens/contracts';

interface ErrorLogger {
  error(bindings: object, message: string): unknown;
}

interface ErrorRequest {
  readonly id?: string;
}

interface ErrorReply {
  code(status: number): ErrorReply;
  send(payload: ApiErrorResponse): unknown;
}

const STATUS_CODES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'AUTHENTICATION_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ErrorLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorRequest>();
    const reply = http.getResponse<ErrorReply>();
    const requestId = request.id ?? 'unknown';
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const responseObject =
      response && typeof response === 'object' ? (response as Record<string, unknown>) : null;
    const responseMessage = responseObject?.message;
    const message =
      typeof response === 'string'
        ? response
        : typeof responseMessage === 'string'
          ? responseMessage
          : status >= 500
            ? 'An unexpected error occurred.'
            : 'The request could not be completed.';
    const explicitCode = responseObject?.code;
    const payload: ApiErrorResponse = {
      code:
        typeof explicitCode === 'string'
          ? explicitCode
          : responseObject?.errors
            ? 'VALIDATION_ERROR'
            : (STATUS_CODES[status] ?? 'INTERNAL_ERROR'),
      message,
      requestId,
      ...(responseObject?.errors ? { details: responseObject.errors } : {}),
    };

    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error({ err: exception, requestId }, 'API request failed');
    }

    reply.code(status).send(payload);
  }
}
