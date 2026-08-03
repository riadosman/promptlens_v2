import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Hook = { type: string; command: string; timeout?: number };
type HookGroup = { matcher?: string; hooks: Hook[] };
type ClaudeSettings = { hooks?: Record<string, HookGroup[]>; [key: string]: unknown };
const LEGACY_COMMAND = 'promptlens-claude capture';

function shellQuote(value: string): string {
  return process.platform === 'win32'
    ? `"${value.replaceAll('"', '\\"')}"`
    : `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function captureCommand(moduleUrl = import.meta.url): string {
  const cli = join(dirname(fileURLToPath(moduleUrl)), 'cli.js');
  return `${shellQuote(process.execPath)} ${shellQuote(cli)} capture`;
}

export async function installHook(): Promise<string> {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  await mkdir(dirname(settingsPath), { recursive: true });
  let settings: ClaudeSettings = {};
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf8')) as ClaudeSettings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const hooks = { ...(settings.hooks ?? {}) };
  const legacyInstalled = (hooks.UserPromptSubmit ?? []).some((group) =>
    group.hooks.some((hook) => hook.command === LEGACY_COMMAND),
  );
  const groups = (hooks.UserPromptSubmit ?? [])
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((hook) => hook.command !== LEGACY_COMMAND),
    }))
    .filter((group) => group.hooks.length > 0);
  const command = captureCommand();
  const installed = groups.some((group) =>
    group.hooks.some((hook) => hook.type === 'command' && hook.command === command),
  );
  if (!installed) {
    groups.push({ matcher: '', hooks: [{ type: 'command', command, timeout: 5 }] });
  }
  if (!installed || legacyInstalled) {
    hooks.UserPromptSubmit = groups;
    settings.hooks = hooks;
    const temporary = `${settingsPath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    try {
      await readFile(settingsPath);
      await writeFile(`${settingsPath}.promptlens-backup`, await readFile(settingsPath));
    } catch {
      // A new settings file does not need a backup.
    }
    await rename(temporary, settingsPath);
  }
  return settingsPath;
}
