/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, expect, it, vi } from 'vitest';
import { ConnectorClient, type ConnectorStorage, type ConnectorTokens } from './index.js';

class MemoryStorage implements ConnectorStorage {
  tokens: ConnectorTokens | null;
  queue: Awaited<ReturnType<ConnectorStorage['loadQueue']>> = [];
  constructor(tokens: ConnectorTokens | null) {
    this.tokens = tokens;
  }
  async loadTokens() {
    return this.tokens;
  }
  async saveTokens(tokens: ConnectorTokens) {
    this.tokens = tokens;
  }
  async clearTokens() {
    this.tokens = null;
  }
  async loadQueue() {
    return this.queue;
  }
  async saveQueue(queue: typeof this.queue) {
    this.queue = [...queue];
  }
}

const prompt = {
  clientEventId: '2e51de79-640a-44f6-b715-e832593640a1',
  projectId: 'e87e8d0a-c601-40db-9f6c-ab95a3b731b5',
  content: 'Create a deployment plan',
  platform: 'test',
  model: 'test-model',
  occurredAt: '2026-07-31T00:00:00.000Z',
  timezone: 'UTC',
  tags: ['deployment'],
};

describe('ConnectorClient', () => {
  it('uses PKCE for device authorization and stores the selected project', async () => {
    const storage = new MemoryStorage(null);
    let challenge = '';
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/device/authorization')) {
        const body = JSON.parse(String(init?.body)) as { codeChallenge: string };
        challenge = body.codeChallenge;
        return new Response(
          JSON.stringify({
            deviceCode: 'd'.repeat(40),
            userCode: 'ABCDEFGH',
            verificationUri: 'https://promptlens.test/connect',
            expiresIn: 600,
            interval: 5,
          }),
          { status: 201 },
        );
      }
      const body = JSON.parse(String(init?.body)) as { codeVerifier: string };
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(body.codeVerifier),
      );
      expect(Buffer.from(digest).toString('base64url')).toBe(challenge);
      return new Response(
        JSON.stringify({
          accessToken: 'access',
          refreshToken: 'refresh',
          expiresIn: 900,
          installationId: 'installation',
          projectId: prompt.projectId,
        }),
        { status: 200 },
      );
    });
    const client = new ConnectorClient({
      apiUrl: 'https://promptlens.test/v1',
      storage,
      fetch: fetcher as typeof fetch,
      now: () => 1_000,
    });
    const authorization = await client.beginAuthorization({
      platform: 'test',
      displayName: 'Test',
    });
    expect(await client.pollAuthorization(authorization)).toBe(true);
    expect(storage.tokens?.projectId).toBe(prompt.projectId);
  });

  it('deduplicates queued events and removes a successful delivery', async () => {
    const storage = new MemoryStorage({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 99_999,
      installationId: 'id',
      projectId: prompt.projectId,
    });
    const fetcher = vi.fn(async () => new Response('{}', { status: 202 }));
    const client = new ConnectorClient({
      apiUrl: 'http://api/v1',
      storage,
      fetch: fetcher,
      now: () => 1_000,
    });
    await client.enqueue(prompt);
    await client.enqueue(prompt);
    expect(storage.queue).toHaveLength(1);
    await client.flush();
    expect(storage.queue).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retains a failed event with exponential backoff', async () => {
    const storage = new MemoryStorage({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 99_999,
      installationId: 'id',
      projectId: prompt.projectId,
    });
    const client = new ConnectorClient({
      apiUrl: 'http://api/v1',
      storage,
      fetch: async () => new Response('{}', { status: 503 }),
      now: () => 1_000,
      random: () => 0.5,
    });
    await client.enqueue(prompt);
    await client.flush();
    expect(storage.queue[0]).toMatchObject({ attempts: 1, nextAttemptAt: 3_000 });
  });

  it('rotates an expiring token before ingest', async () => {
    const storage = new MemoryStorage({
      accessToken: 'old',
      refreshToken: 'refresh',
      expiresAt: 1_001,
      installationId: 'id',
      projectId: prompt.projectId,
    });
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/token/refresh')
        ? new Response(
            JSON.stringify({
              accessToken: 'new',
              refreshToken: 'new-refresh',
              expiresIn: 900,
              installationId: 'id',
              projectId: prompt.projectId,
            }),
            { status: 200 },
          )
        : new Response('{}', { status: 202 }),
    );
    const client = new ConnectorClient({
      apiUrl: 'http://api/v1',
      storage,
      fetch: fetcher as typeof fetch,
      now: () => 1_000,
    });
    await client.enqueue(prompt);
    await client.flush();
    expect(storage.tokens?.accessToken).toBe('new');
    expect(storage.queue).toHaveLength(0);
  });

  it('keeps queued data and clears credentials after a revoked refresh token', async () => {
    const storage = new MemoryStorage({
      accessToken: 'revoked-access',
      refreshToken: 'revoked-refresh',
      expiresAt: 99_999,
      installationId: 'id',
      projectId: prompt.projectId,
    });
    const client = new ConnectorClient({
      apiUrl: 'http://api/v1',
      storage,
      fetch: async (url) =>
        String(url).includes('/token/refresh')
          ? new Response('{}', { status: 401 })
          : new Response('{}', { status: 401 }),
      now: () => 1_000,
      random: () => 0.5,
    });
    await client.enqueue(prompt);
    await client.flush();
    expect(storage.tokens).toBeNull();
    expect(storage.queue).toHaveLength(1);
    expect(storage.queue[0]?.attempts).toBe(1);
  });

  it('coalesces concurrent flushes so an event is delivered once', async () => {
    const storage = new MemoryStorage({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: 99_999,
      installationId: 'id',
      projectId: prompt.projectId,
    });
    const fetcher = vi.fn(async () => new Response('{}', { status: 202 }));
    const client = new ConnectorClient({
      apiUrl: 'http://api/v1',
      storage,
      fetch: fetcher,
      now: () => 1_000,
    });
    await client.enqueue(prompt);
    await Promise.all([client.flush(), client.flush(), client.flush()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(storage.queue).toHaveLength(0);
  });

  it('reports pending device authorization without storing credentials', async () => {
    const storage = new MemoryStorage(null);
    const client = new ConnectorClient({
      apiUrl: 'http://api/v1',
      storage,
      fetch: async () =>
        new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 400 }),
    });
    const pending = await client.pollAuthorization({
      deviceCode: 'd'.repeat(40),
      userCode: 'ABCDEFGH',
      verificationUri: 'http://promptlens.test/connect',
      expiresIn: 600,
      interval: 5,
      codeVerifier: 'v'.repeat(43),
    });
    expect(pending).toBe(false);
    expect(storage.tokens).toBeNull();
  });
});
