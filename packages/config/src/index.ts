import { z } from 'zod';

export const runtimeConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DEPLOYMENT_MODE: z.enum(['local', 'public']).default('local'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    DATABASE_URL: z
      .url()
      .default('postgresql://promptlens:local-development-only@localhost:55435/promptlens'),
    SESSION_HASH_SECRET: z.string().min(32).default('local-development-session-secret-32'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.url().optional(),
    ),
    REDIS_URL: z.url().default('redis://localhost:6379'),
    AI_PROVIDER: z.enum(['fake', 'openai', 'anthropic', 'nvidia']).default('fake'),
    AI_MODEL: z.string().min(1).default('gpt-5.6-luna'),
    OPENAI_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(20).optional(),
    ),
    ANTHROPIC_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(20).optional(),
    ),
    ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5'),
    NVIDIA_API_KEY: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(20).optional(),
    ),
    NVIDIA_BASE_URL: z.url().default('https://integrate.api.nvidia.com/v1'),
    AI_TENANT_MONTHLY_TOKEN_BUDGET: z.coerce.number().int().positive().default(1_000_000),
    AI_TENANT_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(60),
    AI_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
    EMAIL_VERIFICATION_REQUIRED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_HOST: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.preprocess((value) => (value === '' ? undefined : value), z.string().optional()),
    SMTP_PASSWORD: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().optional(),
    ),
    SMTP_FROM: z.string().default('PromptLens <noreply@localhost>'),
  })
  .superRefine((config, context) => {
    if (config.EMAIL_VERIFICATION_REQUIRED && !config.SMTP_HOST) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'SMTP_HOST is required when email verification is enabled.',
      });
    }
    if (Boolean(config.SMTP_USER) !== Boolean(config.SMTP_PASSWORD)) {
      context.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER and SMTP_PASSWORD must be configured together.',
      });
    }
    if (config.NODE_ENV === 'production' && config.DEPLOYMENT_MODE === 'public') {
      if (new URL(config.WEB_ORIGIN).protocol !== 'https:') {
        context.addIssue({
          code: 'custom',
          path: ['WEB_ORIGIN'],
          message: 'WEB_ORIGIN must use HTTPS for a public production deployment.',
        });
      }
      if (!config.TRUST_PROXY) {
        context.addIssue({
          code: 'custom',
          path: ['TRUST_PROXY'],
          message: 'TRUST_PROXY must be enabled for a public production deployment.',
        });
      }
      if (!config.EMAIL_VERIFICATION_REQUIRED || !config.SMTP_HOST) {
        context.addIssue({
          code: 'custom',
          path: ['EMAIL_VERIFICATION_REQUIRED'],
          message: 'Email verification and SMTP are required for a public production deployment.',
        });
      }
      if (config.SESSION_HASH_SECRET === 'local-development-session-secret-32') {
        context.addIssue({
          code: 'custom',
          path: ['SESSION_HASH_SECRET'],
          message: 'The local session secret cannot be used for a public production deployment.',
        });
      }
    }
  });

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function parseRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>>,
): RuntimeConfig {
  return runtimeConfigSchema.parse(environment);
}
