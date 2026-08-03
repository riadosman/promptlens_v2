import { describe, expect, it } from 'vitest';
import {
  AnalysisControlError,
  AnalysisControls,
  type AnalysisControlStore,
} from './analysis-controls.js';

class MemoryStore implements AnalysisControlStore {
  readonly values = new Map<string, string>();
  readonly expirations = new Map<string, number>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  incr(key: string): Promise<number> {
    const value = Number(this.values.get(key) ?? '0') + 1;
    this.values.set(key, String(value));
    return Promise.resolve(value);
  }

  expire(key: string, seconds: number): Promise<number> {
    this.expirations.set(key, seconds);
    return Promise.resolve(1);
  }

  set(key: string, value: string, _mode: 'EX', seconds: number): Promise<string> {
    this.values.set(key, value);
    this.expirations.set(key, seconds);
    return Promise.resolve('OK');
  }
}

const now = new Date('2026-07-31T18:30:00.000Z');

function controls(overrides: Partial<ConstructorParameters<typeof AnalysisControls>[1]> = {}) {
  const store = new MemoryStore();
  const consumedTokens = overrides.consumedTokens ?? (() => Promise.resolve(0));
  return {
    store,
    controls: new AnalysisControls(store, {
      requestsPerMinute: 2,
      failureThreshold: 3,
      consumedTokens,
      now: () => now,
      ...overrides,
    }),
  };
}

describe('AnalysisControls', () => {
  it('enforces the tenant/provider minute limit in the production control path', async () => {
    const { controls: subject, store } = controls();
    await subject.enforce('tenant-a', 'fake', 100);
    await subject.enforce('tenant-a', 'fake', 100);
    await expect(subject.enforce('tenant-a', 'fake', 100)).rejects.toEqual(
      new AnalysisControlError('RATE_LIMITED'),
    );
    expect([...store.expirations.values()]).toContain(120);
  });

  it('uses a UTC calendar month and rejects an exhausted tenant budget', async () => {
    let observedStart: Date | undefined;
    const { controls: subject } = controls({
      consumedTokens: (_tenantId, start) => {
        observedStart = start;
        return Promise.resolve(100);
      },
    });
    await expect(subject.enforce('tenant-a', 'fake', 100)).rejects.toEqual(
      new AnalysisControlError('BUDGET_EXCEEDED'),
    );
    expect(observedStart?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('opens a provider circuit at the configured failure threshold', async () => {
    const { controls: subject, store } = controls();
    await subject.recordProviderFailure('fake');
    await subject.recordProviderFailure('fake');
    await subject.recordProviderFailure('fake');
    expect(store.values.get('promptlens:ai:circuit:fake')).toBe('open');
    expect(store.expirations.get('promptlens:ai:circuit:fake')).toBe(60);
    await expect(subject.enforce('tenant-a', 'fake', 100)).rejects.toEqual(
      new AnalysisControlError('CIRCUIT_OPEN'),
    );
  });

  it('isolates rate counters by tenant and provider', async () => {
    const { controls: subject } = controls();
    await subject.enforce('tenant-a', 'fake', 100);
    await subject.enforce('tenant-a', 'openai', 100);
    await subject.enforce('tenant-b', 'fake', 100);
  });
});
