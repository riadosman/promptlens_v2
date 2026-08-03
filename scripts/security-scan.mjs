import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
if (files.error) throw new Error(`git ls-files could not start: ${files.error.message}`);
if (files.status !== 0) {
  throw new Error(files.stderr.trim() || `git ls-files failed with exit code ${files.status}`);
}
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bsk-(?:proj-|live-)[A-Za-z0-9_-]{20,}\b/u,
  /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/u,
];
const findings = [];
for (const file of files.stdout.split('\0').filter(Boolean)) {
  if (file === 'pnpm-lock.yaml' || file.startsWith('artifacts/')) continue;
  let content;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of patterns) if (pattern.test(content)) findings.push(`${file}: ${pattern}`);
}
if (findings.length) throw new Error(`Potential committed secrets:\n${findings.join('\n')}`);
process.stdout.write('No high-confidence committed secrets found.\n');
