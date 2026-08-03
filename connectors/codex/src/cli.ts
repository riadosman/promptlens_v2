#!/usr/bin/env node
import { ConnectorClient } from '@promptlens/connector-sdk';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { installHook } from './install.js';
import { SecureConnectorStorage } from './storage.js';

const storage = new SecureConnectorStorage();
const client = new ConnectorClient({
  apiUrl: process.env.PROMPTLENS_API_URL ?? 'http://localhost:4000/v1',
  storage,
});

function openBrowser(url: string): void {
  if (process.platform === 'win32') execFile('explorer.exe', [url], { windowsHide: true }).unref();
  else if (process.platform === 'darwin') execFile('open', [url]).unref();
  else execFile('xdg-open', [url]).unref();
}

async function connect(): Promise<void> {
  const authorization = await client.beginAuthorization({
    platform: 'codex',
    displayName: `Codex on ${hostname()}`,
  });
  const url = `${authorization.verificationUri}?code=${encodeURIComponent(authorization.userCode)}`;
  process.stdout.write(`Authorize PromptLens at ${url}\nCode: ${authorization.userCode}\n`);
  try {
    openBrowser(url);
  } catch {
    /* Printed URL is the fallback. */
  }
  const deadline = Date.now() + authorization.expiresIn * 1_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, authorization.interval * 1_000));
    if (await client.pollAuthorization(authorization)) {
      process.stdout.write('Codex connector authenticated. Review and trust it with /hooks.\n');
      return;
    }
  }
  throw new Error('Device authorization expired.');
}

async function capture(): Promise<void> {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw) as { prompt?: string; cwd?: string; turn_id?: string };
  const tokens = await storage.loadTokens();
  if (!tokens || !input.prompt?.trim()) return;
  await client.enqueue({
    clientEventId: input.turn_id ?? randomUUID(),
    projectId: tokens.projectId,
    content: input.prompt,
    platform: 'codex',
    model: 'codex',
    occurredAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    tags: input.cwd ? [`workspace:${input.cwd.split(/[\\/]/u).at(-1) ?? 'unknown'}`] : [],
  });
  await client.flush();
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'help';
  if (command === 'install')
    process.stdout.write(`Installed Codex hook in ${await installHook()}\n`);
  else if (command === 'connect') await connect();
  else if (command === 'capture') await capture();
  else if (command === 'status')
    process.stdout.write(`${JSON.stringify(await client.health(), null, 2)}\n`);
  else process.stdout.write('Usage: promptlens-codex <install|connect|capture|status>\n');
}

main().catch((error: unknown) => {
  if (process.argv[2] !== 'capture') {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
});
