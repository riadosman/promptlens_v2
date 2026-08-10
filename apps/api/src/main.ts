import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { parseRuntimeConfig } from '@promptlens/config';
import {
  createDeviceAuthorizationRequestSchema,
  createProjectRequestSchema,
  ingestPromptRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  requestSupportGrantSchema,
  tenantSettingsSchema,
} from '@promptlens/contracts';
import { createLogger, startTelemetry } from '@promptlens/observability';
import { z } from 'zod';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './http/api-exception.filter.js';

const config = parseRuntimeConfig(process.env);
const logger = createLogger('api', config.LOG_LEVEL);

const sensitiveLimits: ReadonlyArray<{
  readonly suffix: string;
  readonly max: number;
  readonly timeWindow: string;
  readonly groupId: string;
}> = [
  { suffix: '/auth/login', max: 10, timeWindow: '1 minute', groupId: 'auth-login' },
  { suffix: '/auth/register', max: 5, timeWindow: '10 minutes', groupId: 'auth-register' },
  { suffix: '/auth/password/forgot', max: 5, timeWindow: '15 minutes', groupId: 'auth-recovery' },
  { suffix: '/auth/email/resend', max: 5, timeWindow: '15 minutes', groupId: 'auth-recovery' },
  {
    suffix: '/connectors/device/authorization',
    max: 20,
    timeWindow: '1 minute',
    groupId: 'device-auth',
  },
  { suffix: '/connectors/device/token', max: 60, timeWindow: '1 minute', groupId: 'device-token' },
  { suffix: '/ingest/prompts', max: 300, timeWindow: '1 minute', groupId: 'prompt-ingest' },
];

async function bootstrap(): Promise<void> {
  const stopTelemetry = await startTelemetry({
    serviceName: 'promptlens-api',
    serviceVersion: '1.0.0',
    ...(config.OTEL_EXPORTER_OTLP_ENDPOINT ? { endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 256 * 1024,
      requestIdHeader: 'x-request-id',
      trustProxy: config.TRUST_PROXY,
    }),
    { bufferLogs: true },
  );

  app.enableShutdownHooks();
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  await app.register(cookie);
  await app.register(helmet);
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  redis.on('error', (error) => logger.warn({ err: error }, 'Rate-limit Redis unavailable'));
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRoute', (route) => {
    const limit = sensitiveLimits.find(({ suffix }) => route.url.endsWith(suffix));
    if (!limit) return;
    route.config = { ...route.config, rateLimit: limit };
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    ban: 3,
    keyGenerator: (request) => request.ip,
    allowList: (request) => request.url === '/v1/health/live' || request.url === '/v1/health/ready',
    redis,
  });
  fastify.addHook('onClose', async () => {
    await redis.quit();
    await stopTelemetry();
  });
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id || randomUUID());
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const hasSession = Boolean(request.cookies.promptlens_session);
    if (unsafe && hasSession && request.headers.origin !== config.WEB_ORIGIN) {
      void reply.code(403).send({ statusCode: 403, message: 'Origin validation failed.' });
      return;
    }
    done();
  });
  app.setGlobalPrefix('v1');
  const openApiConfig = new DocumentBuilder()
    .setTitle('PromptLens API')
    .setDescription('Versioned API for PromptLens web clients and prompt connectors.')
    .setVersion('1.0.0')
    .setOpenAPIVersion('3.1.0')
    .addCookieAuth('promptlens_session')
    .addBearerAuth()
    .build();
  const documentFactory = () => {
    const document = SwaggerModule.createDocument(app, openApiConfig, {
      deepScanRoutes: true,
    });
    document.components ??= {};
    const contractSchemas = {
      ...document.components.schemas,
      RegisterRequest: z.toJSONSchema(registerRequestSchema, { target: 'draft-7' }),
      LoginRequest: z.toJSONSchema(loginRequestSchema, { target: 'draft-7' }),
      CreateProjectRequest: z.toJSONSchema(createProjectRequestSchema, { target: 'draft-7' }),
      DeviceAuthorizationRequest: z.toJSONSchema(createDeviceAuthorizationRequestSchema, {
        target: 'draft-7',
      }),
      IngestPromptRequest: z.toJSONSchema(ingestPromptRequestSchema, { target: 'draft-7' }),
      TenantSettingsRequest: z.toJSONSchema(tenantSettingsSchema, { target: 'draft-7' }),
      SupportGrantRequest: z.toJSONSchema(requestSupportGrantSchema, { target: 'draft-7' }),
    };
    document.components.schemas = contractSchemas as unknown as NonNullable<
      typeof document.components.schemas
    >;
    return document;
  };
  SwaggerModule.setup('openapi', app, documentFactory, {
    useGlobalPrefix: true,
    ui: false,
    raw: ['json'],
    jsonDocumentUrl: 'openapi.json',
  });
  await app.listen(config.API_PORT, config.API_HOST);
  logger.info({ port: config.API_PORT }, 'API listening');
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exitCode = 1;
});
