import { createHash, randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const api = process.env.ACCEPTANCE_API_URL ?? 'http://localhost:4000/v1';
const origin = process.env.ACCEPTANCE_WEB_ORIGIN ?? 'http://localhost:3000';
let cookie = '';

async function call(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  if (options.method && !['GET', 'HEAD'].includes(options.method) && cookie)
    headers.set('origin', origin);
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';', 1)[0];
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

const email = `acceptance-${randomUUID()}@example.test`;
const password = 'Acceptance-Production-Password-42!';
const openApi = await call('/openapi.json');
assert.equal(openApi.response.status, 200);
assert.equal(openApi.body.info.version, '1.0.0');
assert.ok(openApi.body.paths['/v1/auth/register']);
assert.ok(openApi.body.components.schemas.IngestPromptRequest);
assert.ok(openApi.body.components.schemas.TenantSettingsRequest);
const registration = await call('/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email,
    password,
    displayName: 'Acceptance Owner',
    tenantName: 'Acceptance Workspace',
  }),
});
assert.equal(registration.response.status, 201);
assert.ok(cookie.startsWith('promptlens_session='));
const originalCookie = cookie;
const secondLogin = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
assert.equal(secondLogin.response.status, 200);
const secondaryCookie = cookie;
const secondarySessions = await call('/auth/sessions');
assert.equal(secondarySessions.response.status, 200);
const secondarySession = secondarySessions.body.find((session) => session.current);
assert.ok(secondarySession);
cookie = originalCookie;
const sessionRevoke = await call(`/auth/sessions/${secondarySession.id}`, { method: 'DELETE' });
assert.equal(sessionRevoke.response.status, 204);
cookie = secondaryCookie;
const revokedSession = await call('/auth/session');
assert.equal(revokedSession.response.status, 401);
cookie = originalCookie;

const projects = await call('/projects');
assert.equal(projects.response.status, 200);
assert.equal(projects.body.length, 1);
const projectId = projects.body[0].id;
const codeVerifier = randomBytes(32).toString('base64url');
const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

const authorization = await call('/connectors/device/authorization', {
  method: 'POST',
  body: JSON.stringify({
    platform: 'acceptance',
    displayName: 'Acceptance Connector',
    protocolVersion: '1.0',
    codeChallenge,
    codeChallengeMethod: 'S256',
  }),
});
assert.equal(authorization.response.status, 201);

const approval = await call('/connectors/device/approve', {
  method: 'POST',
  body: JSON.stringify({ userCode: authorization.body.userCode, projectId }),
});
assert.equal(approval.response.status, 204);

const token = await call('/connectors/device/token', {
  method: 'POST',
  body: JSON.stringify({ deviceCode: authorization.body.deviceCode, codeVerifier }),
});
assert.equal(token.response.status, 200);
assert.equal(token.body.projectId, projectId);
const bearer = { authorization: `Bearer ${token.body.accessToken}` };
const clientEventId = randomUUID();
const event = {
  clientEventId,
  projectId,
  content: 'Create a secure release plan with measurable rollback criteria.',
  platform: 'acceptance',
  model: 'fake-provider',
  occurredAt: new Date().toISOString(),
  timezone: 'UTC',
  tags: ['acceptance', 'security'],
  context: { suite: 'v1' },
};

const ingest = await call('/ingest/prompts', {
  method: 'POST',
  headers: bearer,
  body: JSON.stringify(event),
});
assert.equal(ingest.response.status, 202);
assert.equal(ingest.body.duplicate, false);
const duplicate = await call('/ingest/prompts', {
  method: 'POST',
  headers: bearer,
  body: JSON.stringify(event),
});
assert.equal(duplicate.response.status, 202);
assert.equal(duplicate.body.duplicate, true);
assert.equal(duplicate.body.id, ingest.body.id);

const conflict = await call('/ingest/prompts', {
  method: 'POST',
  headers: bearer,
  body: JSON.stringify({ ...event, content: 'Different content with the same idempotency key.' }),
});
assert.equal(conflict.response.status, 409);
const futureTimestamp = await call('/ingest/prompts', {
  method: 'POST',
  headers: bearer,
  body: JSON.stringify({
    ...event,
    clientEventId: randomUUID(),
    occurredAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
  }),
});
assert.equal(futureTimestamp.response.status, 400);

let detail;
const deadline = Date.now() + 30_000;
do {
  await new Promise((resolve) => setTimeout(resolve, 500));
  detail = await call(`/prompts/${ingest.body.id}`);
} while (detail.body.analysis?.status !== 'COMPLETED' && Date.now() < deadline);
assert.equal(detail.body.analysis.status, 'COMPLETED');
assert.equal(typeof detail.body.analysis.score, 'number');
assert.ok(detail.body.analysis.improvedPrompt.length > 0);

const dashboard = await call('/dashboard/stats');
assert.equal(dashboard.response.status, 200);
assert.ok(Array.isArray(dashboard.body.scoreTrend));
assert.ok(dashboard.body.modelDistribution.some((item) => item.name === 'fake-provider'));
const search = await call('/prompts?q=rollback&minScore=0');
assert.equal(search.response.status, 200);
assert.equal(search.body.items[0].id, ingest.body.id);
const exported = await call('/prompt-exports?format=json&q=rollback');
assert.equal(exported.response.status, 200);
assert.equal(exported.body[0].id, ingest.body.id);

const reanalysis = await call(`/prompts/${ingest.body.id}/analyses`, { method: 'POST' });
assert.equal(reanalysis.response.status, 202);

const overview = await call('/admin/overview');
assert.equal(overview.response.status, 200);
assert.ok(overview.body.tenant.prompts >= 1);
let breakGlassSupportTested = false;
const settings = await call('/admin/settings');
assert.equal(settings.response.status, 200);
const settingsUpdate = await call('/admin/settings', {
  method: 'PATCH',
  body: JSON.stringify({
    retentionDays: 730,
    aiProvider: 'fake',
    aiModel: 'deterministic-v1',
    aiMonthlyTokenBudget: 2_000_000,
  }),
});
assert.equal(settingsUpdate.response.status, 200);
assert.equal(settingsUpdate.body.retentionDays, 730);
const workspaceExport = await call('/admin/data-export');
assert.equal(workspaceExport.response.status, 200);
assert.equal(workspaceExport.body.schemaVersion, 1);
assert.ok(workspaceExport.body.prompts.some((prompt) => prompt.id === ingest.body.id));
const scheduledDeletion = await call('/admin/deletion', {
  method: 'POST',
  body: JSON.stringify({ confirmation: `delete ${settings.body.slug}` }),
});
assert.equal(scheduledDeletion.response.status, 201);
assert.ok(scheduledDeletion.body.deletionScheduledAt);
const cancelledDeletion = await call('/admin/deletion', { method: 'DELETE' });
assert.equal(cancelledDeletion.response.status, 204);

const ownerCookie = cookie;
const isolatedEmail = `isolated-${randomUUID()}@example.test`;
cookie = '';
const isolatedRegistration = await call('/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email: isolatedEmail,
    password,
    displayName: 'Isolated User',
    tenantName: 'Isolated Workspace',
  }),
});
assert.equal(isolatedRegistration.response.status, 201);
const isolatedCookie = cookie;
const isolatedTenantId = isolatedRegistration.body.tenant.id;
const isolatedProjects = await call('/projects');
assert.equal(isolatedProjects.response.status, 200);
assert.equal(isolatedProjects.body.length, 1);
const isolatedProjectId = isolatedProjects.body[0].id;
const nonInstanceAdmin = await call('/admin/instance/users');
assert.equal(nonInstanceAdmin.response.status, 403);

cookie = ownerCookie;
const foreignProjectMutation = await call(`/projects/${isolatedProjectId}`, {
  method: 'PATCH',
  body: JSON.stringify({ name: 'Cross-tenant mutation must fail' }),
});
assert.equal(foreignProjectMutation.response.status, 404);
const unauthorizedTenantSwitch = await call('/auth/tenant/switch', {
  method: 'POST',
  body: JSON.stringify({ tenantId: isolatedTenantId }),
});
assert.equal(unauthorizedTenantSwitch.response.status, 403);
const addViewer = await call('/admin/members', {
  method: 'POST',
  body: JSON.stringify({ email: isolatedEmail, role: 'VIEWER' }),
});
assert.equal(addViewer.response.status, 201);

cookie = isolatedCookie;
const viewerSwitch = await call('/auth/tenant/switch', {
  method: 'POST',
  body: JSON.stringify({ tenantId: registration.body.tenant.id }),
});
assert.equal(viewerSwitch.response.status, 200);
const viewerAdmin = await call('/admin/settings');
assert.equal(viewerAdmin.response.status, 403);
const viewerProjectWrite = await call('/projects', {
  method: 'POST',
  body: JSON.stringify({ name: 'Viewer write must fail' }),
});
assert.equal(viewerProjectWrite.response.status, 403);
const viewerProjects = await call('/projects');
assert.equal(viewerProjects.response.status, 200);
assert.ok(viewerProjects.body.every((project) => project.id !== isolatedProjectId));
cookie = ownerCookie;

if (overview.body.instance) {
  const adminCookie = cookie;
  const managedEmail = `managed-${randomUUID()}@example.test`;
  cookie = '';
  const managedRegistration = await call('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: managedEmail,
      password,
      displayName: 'Managed User',
      tenantName: 'Managed Workspace',
    }),
  });
  assert.equal(managedRegistration.response.status, 201);
  const managedCookie = cookie;
  const managedTenantId = managedRegistration.body.tenant.id;
  cookie = adminCookie;
  const instanceUsers = await call('/admin/instance/users');
  assert.equal(instanceUsers.response.status, 200);
  assert.ok(instanceUsers.body.some((user) => user.email === email));
  const managedUser = instanceUsers.body.find((user) => user.email === managedEmail);
  assert.ok(managedUser);
  const suspended = await call(`/admin/instance/users/${managedUser.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'SUSPENDED' }),
  });
  assert.equal(suspended.response.status, 204);
  cookie = '';
  const suspendedLogin = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: managedEmail, password }),
  });
  assert.equal(suspendedLogin.response.status, 401);
  cookie = adminCookie;
  const reactivated = await call(`/admin/instance/users/${managedUser.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  assert.equal(reactivated.response.status, 204);
  // Suspending a user revokes every active session. Re-authenticate after reactivation
  // instead of relying on the intentionally invalidated pre-suspension cookie.
  cookie = '';
  const managedRelogin = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: managedEmail, password }),
  });
  assert.equal(managedRelogin.response.status, 200);
  const managedActiveCookie = cookie;
  cookie = adminCookie;
  const supportRequest = await call('/admin/instance/support-requests', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: managedTenantId,
      reason: 'Acceptance test for metadata-only operational support',
    }),
  });
  assert.equal(supportRequest.response.status, 201);
  cookie = managedActiveCookie;
  const pendingSupport = await call('/admin/support-requests');
  assert.equal(pendingSupport.response.status, 200);
  assert.ok(pendingSupport.body.some((grant) => grant.id === supportRequest.body.id));
  const supportApproval = await call(`/admin/support-requests/${supportRequest.body.id}/approve`, {
    method: 'POST',
  });
  assert.equal(supportApproval.response.status, 201);
  cookie = adminCookie;
  const supportMetadata = await call(`/admin/instance/support/${managedTenantId}/metadata`);
  assert.equal(supportMetadata.response.status, 200);
  assert.equal(supportMetadata.body.tenant.id, managedTenantId);
  assert.equal('content' in supportMetadata.body, false);
  cookie = managedActiveCookie;
  const supportRevoke = await call(`/admin/support-requests/${supportRequest.body.id}`, {
    method: 'DELETE',
  });
  assert.equal(supportRevoke.response.status, 204);
  cookie = adminCookie;
  const revokedSupportMetadata = await call(`/admin/instance/support/${managedTenantId}/metadata`);
  assert.equal(revokedSupportMetadata.response.status, 403);
  breakGlassSupportTested = true;
}

const rotatedToken = await call('/connectors/token/refresh', {
  method: 'POST',
  body: JSON.stringify({ refreshToken: token.body.refreshToken }),
});
assert.equal(rotatedToken.response.status, 200);
const refreshReuse = await call('/connectors/token/refresh', {
  method: 'POST',
  body: JSON.stringify({ refreshToken: token.body.refreshToken }),
});
assert.equal(refreshReuse.response.status, 401);
const familyRevoked = await call('/ingest/prompts', {
  method: 'POST',
  headers: { authorization: `Bearer ${rotatedToken.body.accessToken}` },
  body: JSON.stringify({ ...event, clientEventId: randomUUID() }),
});
assert.equal(familyRevoked.response.status, 401);

const revoke = await call(`/admin/connectors/${token.body.installationId}`, { method: 'DELETE' });
assert.equal(revoke.response.status, 204);
const rejected = await call('/ingest/prompts', {
  method: 'POST',
  headers: bearer,
  body: JSON.stringify({ ...event, clientEventId: randomUUID() }),
});
assert.equal(rejected.response.status, 401);

const deletion = await call(`/prompts/${ingest.body.id}`, { method: 'DELETE' });
assert.equal(deletion.response.status, 204);
const deletedDetail = await call(`/prompts/${ingest.body.id}`);
assert.equal(deletedDetail.response.status, 404);

process.stdout.write(
  JSON.stringify({
    registration: true,
    sessionManagement: true,
    connector: true,
    idempotency: true,
    analysis: true,
    admin: true,
    tenantPolicyAndLifecycle: true,
    tenantIsolationAndRbac: true,
    breakGlassSupport: breakGlassSupportTested,
    dashboard: true,
    searchAndExport: true,
    reanalysis: true,
    deletion: true,
    revoke: true,
    refreshRotationAndReuseDefense: true,
  }) + '\n',
);
