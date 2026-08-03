import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import type { Prisma } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 20,
  });

  return new PrismaClient({ adapter });
}

export type PromptLensDatabase = PrismaClient;

export interface DatabaseActorContext {
  readonly tenantId: string;
  readonly userId: string;
}

export async function withTenantContext<T>(
  database: PrismaClient,
  context: DatabaseActorContext,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
    await transaction.$executeRaw`SELECT set_config('app.user_id', ${context.userId}, true)`;
    return operation(transaction);
  });
}
