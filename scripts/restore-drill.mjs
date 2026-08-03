import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const project = process.env.COMPOSE_PROJECT_NAME ?? 'promptlens-platform';
const composeFile = process.env.PROMPTLENS_COMPOSE_FILE ?? 'infra/compose/compose.full.yaml';
const environmentFile = process.env.PROMPTLENS_ENV_FILE ?? '.env';
const drillContainer = `promptlens-restore-drill-${process.pid}`;
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'promptlens-restore-'));
const localDump = join(temporaryDirectory, 'promptlens.dump');
const containerDump = '/tmp/promptlens.dump';

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function docker(...args) {
  return run('docker', args);
}

function compose(...args) {
  return docker(
    'compose',
    '-p',
    project,
    '--env-file',
    environmentFile,
    '-f',
    composeFile,
    ...args,
  );
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForFinalPostgres(container, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // The official image briefly starts a temporary PostgreSQL server while
      // initializing the data directory. PID 1 becomes `postgres` only after
      // that temporary server has stopped and the final server has started.
      const initProcess = docker('exec', container, 'cat', '/proc/1/comm');
      if (initProcess === 'postgres') {
        const result = docker(
          'exec',
          container,
          'psql',
          '-U',
          'postgres',
          '-d',
          'postgres',
          '-Atqc',
          'SELECT 1',
        );
        if (result === '1') return;
      }
    } catch {
      // Initialization is still in progress. Retry until the bounded timeout.
    }
    await sleep(1_000);
  }

  let logs = '';
  try {
    logs = docker('logs', container);
  } catch {
    logs = 'Container logs were unavailable.';
  }
  throw new Error(`The isolated restore PostgreSQL container did not become ready.\n${logs}`);
}

const countQuery = `SELECT json_build_object(
  'tenants', (SELECT count(*) FROM tenants),
  'memberships', (SELECT count(*) FROM memberships),
  'projects', (SELECT count(*) FROM projects),
  'prompts', (SELECT count(*) FROM prompts),
  'analyses', (SELECT count(*) FROM analyses),
  'audit_events', (SELECT count(*) FROM audit_events),
  'connector_credentials', (SELECT count(*) FROM connector_credentials)
)::text;`;

try {
  const postgresContainer = compose('ps', '-q', 'postgres');
  assert.ok(postgresContainer, 'The PromptLens PostgreSQL container is not running.');
  docker(
    'exec',
    postgresContainer,
    'pg_dump',
    '-U',
    'promptlens_owner',
    '-d',
    'promptlens',
    '--format=custom',
    `--file=${containerDump}`,
  );
  docker('cp', `${postgresContainer}:${containerDump}`, localDump);

  docker(
    'run',
    '-d',
    '--name',
    drillContainer,
    '-e',
    'POSTGRES_PASSWORD=restore-drill-only',
    'postgres:17.6-alpine',
  );
  await waitForFinalPostgres(drillContainer);

  docker('cp', localDump, `${drillContainer}:${containerDump}`);
  docker(
    'exec',
    drillContainer,
    'psql',
    '-U',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'CREATE ROLE promptlens_owner NOLOGIN; CREATE ROLE promptlens_app NOLOGIN; CREATE ROLE promptlens_worker NOLOGIN;',
  );
  docker(
    'exec',
    drillContainer,
    'createdb',
    '-U',
    'postgres',
    '-O',
    'promptlens_owner',
    'promptlens_restore',
  );
  docker(
    'exec',
    drillContainer,
    'pg_restore',
    '-U',
    'postgres',
    '-d',
    'promptlens_restore',
    '--no-owner',
    '--role=promptlens_owner',
    containerDump,
  );

  const sourceCounts = docker(
    'exec',
    postgresContainer,
    'psql',
    '-U',
    'promptlens_owner',
    '-d',
    'promptlens',
    '-Atc',
    countQuery,
  );
  const restoredCounts = docker(
    'exec',
    drillContainer,
    'psql',
    '-U',
    'postgres',
    '-d',
    'promptlens_restore',
    '-Atc',
    countQuery,
  );
  assert.deepEqual(JSON.parse(restoredCounts), JSON.parse(sourceCounts));
  const sha256 = createHash('sha256').update(readFileSync(localDump)).digest('hex');
  process.stdout.write(
    `${JSON.stringify({ restore: true, sha256, counts: JSON.parse(restoredCounts) })}\n`,
  );
} finally {
  try {
    docker('rm', '-f', drillContainer);
  } catch {
    // The container may not have been created.
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
