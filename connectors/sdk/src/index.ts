export const CONNECTOR_PROTOCOL_VERSION = '1.0';

export interface ConnectorManifest {
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  readonly protocolVersion: typeof CONNECTOR_PROTOCOL_VERSION;
  readonly permissions: readonly ConnectorPermission[];
}

export type ConnectorPermission = 'prompt:write' | 'project:read' | 'connector:health';

export interface CapturedPrompt {
  readonly clientEventId: string;
  readonly projectId: string;
  readonly content: string;
  readonly platform: string;
  readonly model: string;
  readonly occurredAt: string;
  readonly timezone: string;
  readonly tags: readonly string[];
}

export interface ConnectorTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly installationId: string;
  readonly projectId: string;
}

export interface ConnectorStorage {
  loadTokens(): Promise<ConnectorTokens | null>;
  saveTokens(tokens: ConnectorTokens): Promise<void>;
  clearTokens(): Promise<void>;
  loadQueue(): Promise<readonly QueuedPrompt[]>;
  saveQueue(queue: readonly QueuedPrompt[]): Promise<void>;
}

export interface QueuedPrompt {
  readonly prompt: CapturedPrompt;
  readonly attempts: number;
  readonly nextAttemptAt: number;
}

export interface ConnectorHealth {
  readonly authenticated: boolean;
  readonly installationId: string | null;
  readonly queuedPrompts: number;
  readonly oldestQueuedAt: string | null;
}

export interface ConnectorClientOptions {
  readonly apiUrl: string;
  readonly storage: ConnectorStorage;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
  readonly random?: () => number;
}

export interface DeviceAuthorizationStart {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresIn: number;
  readonly interval: number;
  readonly codeVerifier: string;
}

export interface BeginAuthorizationOptions {
  readonly platform: string;
  readonly displayName: string;
}

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  installationId: string;
  projectId: string;
};

export class ConnectorClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly random: () => number;
  private flushPromise: Promise<void> | null = null;

  constructor(private readonly options: ConnectorClientOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  async beginAuthorization(input: BeginAuthorizationOptions): Promise<DeviceAuthorizationStart> {
    const codeVerifier = randomBase64Url(32);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const response = await this.fetcher(`${this.options.apiUrl}/connectors/device/authorization`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...input,
        protocolVersion: CONNECTOR_PROTOCOL_VERSION,
        codeChallenge,
        codeChallengeMethod: 'S256',
      }),
    });
    if (!response.ok) throw new Error(`Device authorization failed with HTTP ${response.status}.`);
    const payload = (await response.json()) as Omit<DeviceAuthorizationStart, 'codeVerifier'>;
    return { ...payload, codeVerifier };
  }

  async pollAuthorization(input: DeviceAuthorizationStart): Promise<boolean> {
    const response = await this.fetcher(`${this.options.apiUrl}/connectors/device/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceCode: input.deviceCode, codeVerifier: input.codeVerifier }),
    });
    if (response.status === 400) {
      const payload = (await response.json()) as { error?: string; message?: { error?: string } };
      const code = payload.error ?? payload.message?.error;
      if (code === 'authorization_pending' || code === 'slow_down') return false;
    }
    if (!response.ok) throw new Error(`Device token exchange failed with HTTP ${response.status}.`);
    const payload = (await response.json()) as TokenResponse;
    await this.options.storage.saveTokens({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: this.now() + payload.expiresIn * 1_000,
      installationId: payload.installationId,
      projectId: payload.projectId,
    });
    return true;
  }

  async enqueue(prompt: CapturedPrompt): Promise<void> {
    const queue = [...(await this.options.storage.loadQueue())];
    if (queue.some((item) => item.prompt.clientEventId === prompt.clientEventId)) return;
    queue.push({ prompt, attempts: 0, nextAttemptAt: this.now() });
    await this.options.storage.saveQueue(queue);
  }

  flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.flushInternal().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  async health(): Promise<ConnectorHealth> {
    const [tokens, queue] = await Promise.all([
      this.options.storage.loadTokens(),
      this.options.storage.loadQueue(),
    ]);
    const oldest = queue.reduce<string | null>((value, item) => {
      if (value === null || item.prompt.occurredAt < value) return item.prompt.occurredAt;
      return value;
    }, null);
    return {
      authenticated: tokens !== null,
      installationId: tokens?.installationId ?? null,
      queuedPrompts: queue.length,
      oldestQueuedAt: oldest,
    };
  }

  private async flushInternal(): Promise<void> {
    const queue = [...(await this.options.storage.loadQueue())];
    const retained: QueuedPrompt[] = [];
    for (const item of queue) {
      if (item.nextAttemptAt > this.now()) {
        retained.push(item);
        continue;
      }
      try {
        await this.send(item.prompt);
      } catch {
        const attempts = item.attempts + 1;
        const exponentialMs = Math.min(60 * 60_000, 1_000 * 2 ** Math.min(attempts, 12));
        retained.push({
          ...item,
          attempts,
          nextAttemptAt: this.now() + exponentialMs * (0.8 + this.random() * 0.4),
        });
      }
    }
    await this.options.storage.saveQueue(retained);
  }

  private async send(prompt: CapturedPrompt): Promise<void> {
    let tokens = await this.options.storage.loadTokens();
    if (!tokens) throw new Error('Connector is not authenticated.');
    if (tokens.expiresAt <= this.now() + 30_000) tokens = await this.refresh(tokens.refreshToken);
    let response = await this.ingest(prompt, tokens.accessToken);
    if (response.status === 401) {
      tokens = await this.refresh(tokens.refreshToken);
      response = await this.ingest(prompt, tokens.accessToken);
    }
    if (!response.ok) throw new Error(`Prompt ingest failed with HTTP ${response.status}.`);
  }

  private ingest(prompt: CapturedPrompt, accessToken: string): Promise<Response> {
    return this.fetcher(`${this.options.apiUrl}/ingest/prompts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...prompt, context: {} }),
    });
  }

  private async refresh(refreshToken: string): Promise<ConnectorTokens> {
    const response = await this.fetcher(`${this.options.apiUrl}/connectors/token/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      if (response.status === 401) await this.options.storage.clearTokens();
      throw new Error(`Token refresh failed with HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as TokenResponse;
    const tokens: ConnectorTokens = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: this.now() + payload.expiresIn * 1_000,
      installationId: payload.installationId,
      projectId: payload.projectId,
    };
    await this.options.storage.saveTokens(tokens);
    return tokens;
  }
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
