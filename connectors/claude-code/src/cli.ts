#!/usr/bin/env node
import { ConnectorClient } from '@promptlens/connector-sdk';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { installHook } from './install.js';
import { SecureConnectorStorage } from './storage.js';

const storage = new SecureConnectorStorage();
const apiUrl = process.env.PROMPTLENS_API_URL ?? 'http://localhost:4000/v1';
const client = new ConnectorClient({ apiUrl, storage });

function openBrowser(url: string): void {
  if (process.platform === 'win32') {
    execFile('explorer.exe', [url], { windowsHide: true }).unref();
  } else if (process.platform === 'darwin') {
    execFile('open', [url]).unref();
  } else {
    execFile('xdg-open', [url]).unref();
  }
}

async function connect(): Promise<void> {
  const authorization = await client.beginAuthorization({
    platform: 'claude-code',
    displayName: `Claude Code on ${hostname()}`,
  });
  const url = `${authorization.verificationUri}?code=${encodeURIComponent(authorization.userCode)}`;
  process.stdout.write(`Authorize PromptLens at ${url}\nCode: ${authorization.userCode}\n`);
  try {
    openBrowser(url);
  } catch {
    // The printed URL remains available when a desktop opener is unavailable.
  }
  const deadline = Date.now() + authorization.expiresIn * 1_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, authorization.interval * 1_000));
    if (await client.pollAuthorization(authorization)) {
      process.stdout.write('Claude Code connector authenticated.\n');
      return;
    }
  }
  throw new Error('Device authorization expired.');
}

async function capture(): Promise<void> {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw) as { prompt?: string; cwd?: string };
  if (!input.prompt?.trim()) return;
  const tokens = await storage.loadTokens();
  if (!tokens) return;
  await client.enqueue({
    clientEventId: randomUUID(),
    projectId: tokens.projectId,
    content: input.prompt,
    platform: 'claude-code',
    model: 'claude-code',
    occurredAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    tags: input.cwd ? [`workspace:${input.cwd.split(/[\\/]/u).at(-1) ?? 'unknown'}`] : [],
  });
  await client.flush();
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'help';
  if (command === 'install') {
    process.stdout.write(`Installed Claude Code hook in ${await installHook()}\n`);
    return;
  }
  if (command === 'connect') return connect();
  if (command === 'capture') return capture();
  if (command === 'status') {
    process.stdout.write(`${JSON.stringify(await client.health(), null, 2)}\n`);
    return;
  }
  process.stdout.write('Usage: promptlens-claude <install|connect|capture|status>\n');
}

main().catch((error: unknown) => {
  if (process.argv[2] !== 'capture') {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
});
