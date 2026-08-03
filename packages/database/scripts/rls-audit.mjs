import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

function readEnvironment(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

const environment = readEnvironment(resolve(process.cwd(), '../../.env'));
const connection = {
  host: '127.0.0.1',
  port: Number(environment.POSTGRES_PORT ?? 55435),
  database: 'promptlens',
};
const owner = new pg.Client({
  ...connection,
  user: 'promptlens_owner',
  password: environment.POSTGRES_PASSWORD,
});
const app = new pg.Client({
  ...connection,
  user: 'promptlens_app',
  password: environment.POSTGRES_APP_PASSWORD,
});

const tenantA = randomUUID();
const tenantB = randomUUID();
const projectA = randomUUID();
const projectB = randomUUID();
const actor = randomUUID();
const suffix = randomUUID().slice(0, 8);
const protectedTables = [
  'memberships',
  'projects',
  'connector_installations',
  'prompts',
  'prompt_versions',
  'tags',
  'prompt_tags',
  'analyses',
  'usage_records',
  'audit_events',
  'outbox_events',
  'support_grants',
];

try {
  await owner.connect();
  await app.connect();
  await owner.query(
    `INSERT INTO tenants (id, name, slug, updated_at)
     VALUES ($1, 'RLS Audit A', $2, now()), ($3, 'RLS Audit B', $4, now())`,
    [tenantA, `rls-a-${suffix}`, tenantB, `rls-b-${suffix}`],
  );
  await owner.query(
    `INSERT INTO projects (id, tenant_id, name, updated_at)
     VALUES ($1, $2, 'RLS Project A', now()), ($3, $4, 'RLS Project B', now())`,
    [projectA, tenantA, projectB, tenantB],
  );

  const role = await app.query(
    `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
     FROM pg_roles WHERE rolname = current_user`,
  );
  assert.deepEqual(role.rows[0], {
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  });
  const rowSecurity = await app.query(`SHOW row_security`);
  assert.equal(rowSecurity.rows[0].row_security, 'on');

  const catalog = await app.query(
    `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, count(p.policyname)::int AS policies
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
     GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity`,
    [protectedTables],
  );
  assert.equal(catalog.rows.length, protectedTables.length);
  for (const table of catalog.rows) {
    assert.equal(table.relrowsecurity, true, `${table.relname} must enable RLS`);
    assert.equal(table.relforcerowsecurity, true, `${table.relname} must force RLS`);
    assert.ok(table.policies >= 1, `${table.relname} must have a policy`);
  }

  const unscoped = await app.query(`SELECT id FROM projects WHERE id = ANY($1::uuid[])`, [
    [projectA, projectB],
  ]);
  assert.equal(unscoped.rowCount, 0);

  await app.query('BEGIN');
  await app.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
  await app.query(`SELECT set_config('app.user_id', $1, true)`, [actor]);
  const scoped = await app.query(`SELECT id FROM projects WHERE id = ANY($1::uuid[]) ORDER BY id`, [
    [projectA, projectB],
  ]);
  assert.deepEqual(
    scoped.rows.map(({ id }) => id),
    [projectA],
  );
  await app.query('ROLLBACK');

  await app.query('BEGIN');
  await app.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantA]);
  await app.query(`SELECT set_config('app.user_id', $1, true)`, [actor]);
  await assert.rejects(
    app.query(`INSERT INTO projects (tenant_id, name) VALUES ($1, 'Cross-tenant insert')`, [
      tenantB,
    ]),
    (error) => error?.code === '42501',
  );
  await app.query('ROLLBACK');

  await assert.rejects(app.query('SET ROLE promptlens_owner'), (error) => error?.code === '42501');
  process.stdout.write(
    `${JSON.stringify({ rls: true, protectedTables: protectedTables.length, crossTenantReadBlocked: true, crossTenantWriteBlocked: true, roleEscalationBlocked: true })}\n`,
  );
} finally {
  if (owner._connected) {
    await owner.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [[tenantA, tenantB]]);
  }
  await Promise.allSettled([owner.end(), app.end()]);
}
