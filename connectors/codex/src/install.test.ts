import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { captureCommand, installHook } from './install.js';

let temporaryHome: string | undefined;
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;

afterEach(async () => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  if (temporaryHome) await rm(temporaryHome, { recursive: true, force: true });
  temporaryHome = undefined;
});

describe('Codex hook installer', () => {
  it('installs an absolute, idempotent capture command', async () => {
    temporaryHome = await mkdtemp(join(tmpdir(), 'promptlens-codex-hook-'));
    process.env.HOME = temporaryHome;
    process.env.USERPROFILE = temporaryHome;
    await installHook();
    await installHook();
    const settings = JSON.parse(
      await readFile(join(temporaryHome, '.codex', 'hooks.json'), 'utf8'),
    ) as { hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> } };
    const commands = settings.hooks.UserPromptSubmit.flatMap((group) =>
      group.hooks.map((hook) => hook.command),
    );
    expect(commands).toEqual([captureCommand()]);
    expect(commands[0]).toContain(process.execPath);
    expect(commands[0]).toMatch(/codex.+src.+cli\.js.+capture/u);
    expect(captureCommand(pathToFileURL(join(temporaryHome, 'dist', 'install.js')).href)).toMatch(
      /dist.+cli\.js/u,
    );
  });
});
