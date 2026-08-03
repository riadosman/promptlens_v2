import { Entry } from '@napi-rs/keyring';
import type { ConnectorStorage, ConnectorTokens, QueuedPrompt } from '@promptlens/connector-sdk';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export class SecureConnectorStorage implements ConnectorStorage {
  private readonly statePath = join(homedir(), '.promptlens', 'codex', 'state.json');
  private readonly keyring = new Entry('PromptLens', 'codex');

  async loadTokens(): Promise<ConnectorTokens | null> {
    const value = await Promise.resolve(this.keyring.getPassword());
    return value ? (JSON.parse(value) as ConnectorTokens) : null;
  }
  async saveTokens(tokens: ConnectorTokens): Promise<void> {
    await Promise.resolve(this.keyring.setPassword(JSON.stringify(tokens)));
  }
  async clearTokens(): Promise<void> {
    try {
      await Promise.resolve(this.keyring.deletePassword());
    } catch {
      // Missing keyring entries are already cleared.
    }
  }
  async loadQueue(): Promise<readonly QueuedPrompt[]> {
    return this.withLock(async () => {
      try {
        return (JSON.parse(await readFile(this.statePath, 'utf8')) as { queue: QueuedPrompt[] })
          .queue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
      }
    });
  }
  async saveQueue(queue: readonly QueuedPrompt[]): Promise<void> {
    await this.withLock(async () => {
      const temporary = `${this.statePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ queue }), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.statePath);
    });
  }
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
    const lockPath = `${this.statePath}.lock`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const handle = await open(lockPath, 'wx', 0o600);
        try {
          return await operation();
        } finally {
          await handle.close();
          await rm(lockPath, { force: true });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    throw new Error('Connector state is busy.');
  }
}
