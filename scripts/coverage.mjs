import { spawnSync } from 'node:child_process';

const suites = [
  ['@promptlens/config', ['src/index.test.ts']],
  ['@promptlens/contracts', ['src/system/error.test.ts', 'src/system/health.test.ts']],
  ['@promptlens/domain', ['src/projects/project-name.test.ts']],
  ['@promptlens/connector-sdk', ['src/connector-client.test.ts']],
  [
    '@promptlens/api',
    ['src/http/api-exception.filter.test.ts', 'src/system/health.service.test.ts'],
  ],
  [
    '@promptlens/worker',
    [
      'src/analysis/analysis-controls.test.ts',
      'src/analysis/analysis-errors.test.ts',
      'src/analysis/fake-analysis.provider.test.ts',
      'src/analysis/rubric.test.ts',
    ],
  ],
  ['@promptlens/web', ['lib/dashboard-url.test.ts']],
];

for (const [workspace, files] of suites) {
  const pnpmExecutable = process.env.npm_execpath;
  if (!pnpmExecutable) throw new Error('pnpm executable path is unavailable.');
  const result = spawnSync(
    process.execPath,
    [
      pnpmExecutable,
      '--filter',
      workspace,
      'exec',
      'vitest',
      'run',
      ...files,
      '--coverage',
      '--coverage.thresholds.lines=80',
      '--coverage.thresholds.functions=80',
      '--coverage.thresholds.statements=80',
      '--coverage.thresholds.branches=70',
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
