import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { parseRuntimeConfig } from '@promptlens/config';
import { Redis } from 'ioredis';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ReadinessService implements OnModuleDestroy {
  private static readonly WORKER_HEARTBEAT_KEY = 'promptlens:worker:heartbeat';
  private readonly redis: Redis;

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {
    const config = parseRuntimeConfig(process.env);
    this.redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    this.redis.on('error', () => undefined);
  }

  async check(): Promise<{
    status: 'ready';
    checks: { postgres: 'ok'; redis: 'ok'; worker: 'ok' };
    timestamp: string;
  }> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await Promise.race([
        Promise.all([
          this.database.client.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`,
          this.redis.ping(),
          this.redis.get(ReadinessService.WORKER_HEARTBEAT_KEY).then((heartbeat) => {
            if (!heartbeat) throw new Error('Worker heartbeat is stale.');
          }),
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Readiness check timed out.')), 2_000),
        ),
      ]);
      return {
        status: 'ready',
        checks: { postgres: 'ok', redis: 'ok', worker: 'ok' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('A required dependency is unavailable.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
