export class AnalysisControlError extends Error {
  constructor(readonly code: 'BUDGET_EXCEEDED' | 'RATE_LIMITED' | 'CIRCUIT_OPEN') {
    super(code);
  }
}

export interface AnalysisControlStore {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export interface AnalysisControlOptions {
  readonly requestsPerMinute: number;
  readonly failureThreshold: number;
  readonly consumedTokens: (tenantId: string, monthStart: Date) => Promise<number>;
  readonly now?: () => Date;
}

export class AnalysisControls {
  private readonly now: () => Date;

  constructor(
    private readonly store: AnalysisControlStore,
    private readonly options: AnalysisControlOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async enforce(tenantId: string, providerName: string, monthlyTokenBudget: number): Promise<void> {
    if (await this.store.get(this.circuitKey(providerName))) {
      throw new AnalysisControlError('CIRCUIT_OPEN');
    }

    const now = this.now();
    const minute = Math.floor(now.getTime() / 60_000);
    const rateKey = `promptlens:ai:rate:${tenantId}:${providerName}:${minute}`;
    const count = await this.store.incr(rateKey);
    if (count === 1) await this.store.expire(rateKey, 120);
    if (count > this.options.requestsPerMinute) {
      throw new AnalysisControlError('RATE_LIMITED');
    }

    const monthStart = new Date(now);
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    if ((await this.options.consumedTokens(tenantId, monthStart)) >= monthlyTokenBudget) {
      throw new AnalysisControlError('BUDGET_EXCEEDED');
    }
  }

  async recordProviderFailure(providerName: string): Promise<void> {
    const failuresKey = `promptlens:ai:failures:${providerName}`;
    const failures = await this.store.incr(failuresKey);
    if (failures === 1) await this.store.expire(failuresKey, 60);
    if (failures >= this.options.failureThreshold) {
      await this.store.set(this.circuitKey(providerName), 'open', 'EX', 60);
    }
  }

  private circuitKey(providerName: string): string {
    return `promptlens:ai:circuit:${providerName}`;
  }
}
