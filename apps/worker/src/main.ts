import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { parseRuntimeConfig } from '@promptlens/config';
import {
  AnalysisStatus,
  PromptVersionKind,
  createPrismaClient,
  withTenantContext,
} from '@promptlens/database';
import { createLogger, startTelemetry } from '@promptlens/observability';
import type { AnalysisProvider } from './analysis/analysis-provider.js';
import { AnalysisControlError, AnalysisControls } from './analysis/analysis-controls.js';
import { classifyAnalysisError } from './analysis/analysis-errors.js';
import { AnthropicAnalysisProvider } from './analysis/anthropic-analysis.provider.js';
import { FakeAnalysisProvider } from './analysis/fake-analysis.provider.js';
import { OpenAiAnalysisProvider } from './analysis/openai-analysis.provider.js';
import { NvidiaAnalysisProvider } from './analysis/nvidia-analysis.provider.js';
import { calculateScore } from './analysis/rubric.js';

interface AnalysisJobData {
  readonly tenantId: string;
  readonly promptId: string;
  readonly analysisId: string;
}

const config = parseRuntimeConfig(process.env);
const stopTelemetry = await startTelemetry({
  serviceName: 'promptlens-worker',
  serviceVersion: '1.0.0',
  ...(config.OTEL_EXPORTER_OTLP_ENDPOINT ? { endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
});
const logger = createLogger('worker', config.LOG_LEVEL);
const database = createPrismaClient(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<AnalysisJobData>('prompt-analysis', { connection: redis });
const providerCache = new Map<string, AnalysisProvider>();
const WORKER_HEARTBEAT_KEY = 'promptlens:worker:heartbeat';
const LIFECYCLE_LOCK_KEY = 'promptlens:lifecycle:lock';

async function heartbeat(): Promise<void> {
  await redis.set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), 'EX', 45);
}

function provider(name: string, model: string): AnalysisProvider {
  const cacheKey = `${name}:${model}`;
  const cached = providerCache.get(cacheKey);
  if (cached) return cached;
  let selected: AnalysisProvider;
  if (name === 'anthropic') {
    if (!config.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for the Anthropic provider.');
    }
    selected = new AnthropicAnalysisProvider(config.ANTHROPIC_API_KEY, model);
  } else if (name === 'openai') {
    if (!config.OPENAI_API_KEY)
      throw new Error('OPENAI_API_KEY is required for the OpenAI provider.');
    selected = new OpenAiAnalysisProvider(config.OPENAI_API_KEY, model);
  } else if (name === 'nvidia') {
    if (!config.NVIDIA_API_KEY) {
      throw new Error('NVIDIA_API_KEY is required for the NVIDIA provider.');
    }
    selected = new NvidiaAnalysisProvider(config.NVIDIA_API_KEY, model, config.NVIDIA_BASE_URL);
  } else {
    selected = new FakeAnalysisProvider();
  }
  providerCache.set(cacheKey, selected);
  return selected;
}

const analysisControls = new AnalysisControls(redis, {
  requestsPerMinute: config.AI_TENANT_REQUESTS_PER_MINUTE,
  failureThreshold: config.AI_CIRCUIT_FAILURE_THRESHOLD,
  consumedTokens: async (tenantId, monthStart) => {
    const usage = await withTenantContext(
      database,
      { tenantId, userId: '00000000-0000-0000-0000-000000000000' },
      (transaction) =>
        transaction.usageRecord.aggregate({
          where: { tenantId, createdAt: { gte: monthStart } },
          _sum: { inputTokens: true, outputTokens: true },
        }),
    );
    return (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0);
  },
});

async function processAnalysis(job: Job<AnalysisJobData>): Promise<void> {
  const { tenantId, promptId, analysisId } = job.data;
  const context = { tenantId, userId: '00000000-0000-0000-0000-000000000000' };
  const work = await withTenantContext(database, context, (transaction) =>
    transaction.analysis.findFirst({
      where: { id: analysisId, tenantId, promptId },
      include: { prompt: true },
    }),
  );
  if (!work) throw new Error(`Analysis ${analysisId} not found.`);
  const tenant = await database.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiModel: true, aiMonthlyTokenBudget: true },
  });
  if (!tenant) throw new UnrecoverableError(`Tenant ${tenantId} not found.`);
  const analysisProvider = provider(tenant.aiProvider, tenant.aiModel);
  if (work.status === AnalysisStatus.COMPLETED) {
    logger.info({ analysisId, promptId }, 'Duplicate completed analysis delivery ignored');
    return;
  }
  const claimed = await withTenantContext(database, context, (transaction) =>
    transaction.analysis.updateMany({
      where: { id: analysisId, status: { in: [AnalysisStatus.QUEUED, AnalysisStatus.FAILED] } },
      data: { status: AnalysisStatus.RUNNING, startedAt: new Date(), errorCode: null },
    }),
  );
  if (claimed.count !== 1) return;
  const started = Date.now();
  try {
    await analysisControls.enforce(tenantId, analysisProvider.name, tenant.aiMonthlyTokenBudget);
    const result = await analysisProvider.analyze(work.prompt.content);
    const score = calculateScore(result.dimensions);
    await withTenantContext(database, context, async (transaction) => {
      await transaction.analysis.update({
        where: { id: analysisId },
        data: {
          status: AnalysisStatus.COMPLETED,
          provider: analysisProvider.name,
          model: analysisProvider.model,
          score,
          strengths: [...result.strengths],
          weaknesses: [...result.weaknesses],
          suggestions: [...result.suggestions],
          completedAt: new Date(),
        },
      });
      await transaction.promptVersion.create({
        data: {
          tenantId,
          promptId,
          analysisId,
          kind: PromptVersionKind.IMPROVED,
          content: result.improvedPrompt,
        },
      });
      await transaction.usageRecord.create({
        data: {
          tenantId,
          analysisId,
          provider: analysisProvider.name,
          model: analysisProvider.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: Date.now() - started,
        },
      });
    });
    logger.info({ analysisId, promptId, score }, 'Analysis completed');
  } catch (error: unknown) {
    const providerFailure =
      error instanceof AnalysisControlError ? null : classifyAnalysisError(error);
    const errorCode = error instanceof AnalysisControlError ? error.code : providerFailure!.code;
    await withTenantContext(database, context, (transaction) =>
      transaction.analysis.update({
        where: { id: analysisId },
        data: { status: AnalysisStatus.FAILED, errorCode },
      }),
    );
    if (providerFailure) await analysisControls.recordProviderFailure(analysisProvider.name);
    if (error instanceof AnalysisControlError && error.code === 'BUDGET_EXCEEDED') {
      throw new UnrecoverableError(error.code);
    }
    if (providerFailure && !providerFailure.retryable) {
      throw new UnrecoverableError(providerFailure.code);
    }
    throw error;
  }
}

const analysisWorker = new Worker<AnalysisJobData>('prompt-analysis', processAnalysis, {
  connection: redis,
  concurrency: 4,
});

analysisWorker.on('failed', (job, error) => {
  logger.error({ err: error, jobId: job?.id }, 'Analysis job failed');
});

async function dispatchOutbox(): Promise<void> {
  const events = await database.outboxEvent.findMany({
    where: { publishedAt: null, eventType: 'PromptCreated' },
    orderBy: { occurredAt: 'asc' },
    take: 50,
  });
  for (const event of events) {
    const payload = event.payload as unknown as { promptId: string; analysisId: string };
    await queue.add(
      'analyze',
      { tenantId: event.tenantId!, promptId: payload.promptId, analysisId: payload.analysisId },
      { jobId: event.id, attempts: 5, backoff: { type: 'exponential', delay: 1_000 } },
    );
    await database.outboxEvent.update({
      where: { id: event.id },
      data: { publishedAt: new Date(), attempts: { increment: 1 } },
    });
  }
}

const dispatchTimer = setInterval(() => {
  dispatchOutbox().catch((error: unknown) =>
    logger.error({ err: error }, 'Outbox dispatch failed'),
  );
}, 1_000);

async function enforceDataLifecycle(): Promise<void> {
  const lockToken = randomUUID();
  const acquired = await redis.set(LIFECYCLE_LOCK_KEY, lockToken, 'EX', 55 * 60, 'NX');
  if (!acquired) {
    logger.info('Data lifecycle enforcement skipped because another worker owns the lock');
    return;
  }

  try {
    const tenants = await database.tenant.findMany({
      select: { id: true, retentionDays: true, deletionScheduledAt: true },
    });
    for (const tenant of tenants) {
      if (tenant.deletionScheduledAt && tenant.deletionScheduledAt <= new Date()) {
        await database.tenant.delete({ where: { id: tenant.id } });
        logger.warn({ tenantId: tenant.id }, 'Scheduled tenant deletion completed');
        continue;
      }
      const cutoff = new Date(Date.now() - tenant.retentionDays * 24 * 60 * 60 * 1_000);
      const context = {
        tenantId: tenant.id,
        userId: '00000000-0000-0000-0000-000000000000',
      };
      const deleted = await withTenantContext(database, context, (transaction) =>
        transaction.prompt.deleteMany({
          where: { tenantId: tenant.id, occurredAt: { lt: cutoff } },
        }),
      );
      if (deleted.count > 0) {
        logger.info(
          { tenantId: tenant.id, count: deleted.count, retentionDays: tenant.retentionDays },
          'Retention policy deleted expired prompts',
        );
      }
    }
  } finally {
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      LIFECYCLE_LOCK_KEY,
      lockToken,
    );
  }
}

const lifecycleTimer = setInterval(
  () => {
    enforceDataLifecycle().catch((error: unknown) =>
      logger.error({ err: error }, 'Data lifecycle enforcement failed'),
    );
  },
  60 * 60 * 1_000,
);

const heartbeatTimer = setInterval(() => {
  heartbeat().catch((error: unknown) => logger.error({ err: error }, 'Worker heartbeat failed'));
}, 15_000);

await heartbeat();
await dispatchOutbox();
await enforceDataLifecycle();
logger.info({ defaultProvider: config.AI_PROVIDER }, 'Worker started');

async function shutdown(signal: string): Promise<void> {
  clearInterval(dispatchTimer);
  clearInterval(lifecycleTimer);
  clearInterval(heartbeatTimer);
  logger.info({ signal }, 'Worker stopping');
  await analysisWorker.close();
  await queue.close();
  await redis.del(WORKER_HEARTBEAT_KEY).catch(() => undefined);
  await redis.quit();
  await database.$disconnect();
  await stopTelemetry();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
