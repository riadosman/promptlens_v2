import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type HookGroup = {
  matcher?: string;
  hooks: Array<{ type: string; command: string; timeout?: number }>;
};
type CodexHooks = { description?: string; hooks?: Record<string, HookGroup[]> };
const LEGACY_COMMAND = 'promptlens-codex capture';
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
  const path = join(homedir(), '.codex', 'hooks.json');
  await mkdir(dirname(path), { recursive: true });
  let config: CodexHooks = { description: 'User-level PromptLens lifecycle hooks.' };
  try {
    config = JSON.parse(await readFile(path, 'utf8')) as CodexHooks;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const hooks = { ...(config.hooks ?? {}) };
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
  const installed = groups.some((group) => group.hooks.some((hook) => hook.command === command));
  if (!installed) {
    groups.push({ hooks: [{ type: 'command', command, timeout: 5 }] });
  }
  if (!installed || legacyInstalled) {
    hooks.UserPromptSubmit = groups;
    config.hooks = hooks;
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    try {
      await writeFile(`${path}.promptlens-backup`, await readFile(path));
    } catch {
      // A new hooks file does not need a backup.
    }
    await rename(temporary, path);
  }
  return path;
}
