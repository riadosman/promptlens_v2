import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { parseRuntimeConfig } from '@promptlens/config';
import type { AuthenticatedActor } from '../auth/auth.types.js';

interface AnalysisJobData {
  readonly tenantId: string;
  readonly promptId: string;
  readonly analysisId: string;
}

@Injectable()
export class OperationsService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly queue: Queue<AnalysisJobData>;

  constructor() {
    const config = parseRuntimeConfig(process.env);
    this.redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue('prompt-analysis', { connection: this.redis });
  }

  async queueStatus(actor: AuthenticatedActor) {
    this.assertInstanceAdmin(actor);
    const [counts, failed] = await Promise.all([
      this.queue.getJobCounts('active', 'waiting', 'delayed', 'completed', 'failed'),
      this.queue.getFailed(0, 49),
    ]);
    return {
      counts,
      failed: failed.map((job) => ({
        id: job.id,
        tenantId: typeof job.data?.tenantId === 'string' ? job.data.tenantId : null,
        analysisId: typeof job.data?.analysisId === 'string' ? job.data.analysisId : null,
        attemptsMade: job.attemptsMade,
        failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        errorCode: 'ANALYSIS_JOB_FAILED',
      })),
    };
  }

  async retry(actor: AuthenticatedActor, jobId: string): Promise<void> {
    this.assertInstanceAdmin(actor);
    const job = await this.queue.getJob(jobId);
    if (!job || (await job.getState()) !== 'failed') {
      throw new NotFoundException('Failed job not found.');
    }
    await job.retry('failed');
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.redis.quit();
  }

  private assertInstanceAdmin(actor: AuthenticatedActor): void {
    if (!actor.isInstanceAdmin) {
      throw new ForbiddenException('Instance administrator access is required.');
    }
  }
}
