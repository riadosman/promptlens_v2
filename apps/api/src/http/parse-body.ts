import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

export function parseBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestException({
      type: 'https://promptlens.dev/problems/validation-error',
      title: 'Request validation failed',
      status: 400,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
}
