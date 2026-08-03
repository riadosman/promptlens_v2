import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { parseRuntimeConfig } from '@promptlens/config';
import { createPrismaClient, type PromptLensDatabase } from '@promptlens/database';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PromptLensDatabase;

  constructor() {
    const config = parseRuntimeConfig(process.env);
    this.client = createPrismaClient(config.DATABASE_URL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
