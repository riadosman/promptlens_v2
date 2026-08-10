'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiRequest } from '../lib/api';
import { WorkspaceShell } from './workspace-shell';

interface AdminOverview {
  tenant: {
    users: number;
    projects: number;
    prompts: number;
    analyses: number;
    connectors: number;
    inputTokens: number;
    outputTokens: number;
    costMicros: number;
  };
  instance: null | {
    users: number;
    tenants: number;
    queuedAnalyses: number;
    unpublishedEvents: number;
  };
}

interface MemberRecord {
  role: string;
  createdAt: string;
  user: { id: string; email: string; displayName: string; status: string };
}

interface AuditRecord {
  id: string;
  action: string;
  result: string;
  targetType: string | null;
  createdAt: string;
}

interface ConnectorRecord {
  id: string;
  displayName: string;
  platform: string;
  protocolVersion: string;
  status: string;
}

interface QueueStatus {
  counts: Record<string, number>;
  failed: Array<{
    id: string;
    tenantId: string | null;
    analysisId: string | null;
    attemptsMade: number;
  }>;
}

interface InstanceUser {
  id: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  isInstanceAdmin: boolean;
  _count: { memberships: number };
}

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  retentionDays: number;
  aiProvider: 'fake' | 'openai' | 'anthropic' | 'nvidia';
  aiModel: string;
  aiMonthlyTokenBudget: number;
  deletionScheduledAt: string | null;
}

interface SupportGrant {
  id: string;
  requestedById: string;
  reason: string;
  approvedById: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function AdminClient() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRecord[]>([]);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [instanceUsers, setInstanceUsers] = useState<InstanceUser[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [supportGrants, setSupportGrants] = useState<SupportGrant[]>([]);
  const [supportMetadata, setSupportMetadata] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      apiRequest<AdminOverview>('/admin/overview'),
      apiRequest<MemberRecord[]>('/admin/members'),
      apiRequest<AuditRecord[]>('/admin/audit'),
      apiRequest<ConnectorRecord[]>('/admin/connectors'),
      apiRequest<TenantSettings>('/admin/settings'),
      apiRequest<SupportGrant[]>('/admin/support-requests'),
    ])
      .then(([nextOverview, nextMembers, nextAudit, nextConnectors, nextSettings, nextSupport]) => {
        setOverview(nextOverview);
        setMembers(nextMembers);
        setAudit(nextAudit);
        setConnectors(nextConnectors);
        setSettings(nextSettings);
        setSupportGrants(nextSupport);
        if (nextOverview.instance) {
          void apiRequest<QueueStatus>('/admin/operations/queue').then(setQueue);
          void apiRequest<InstanceUser[]>('/admin/instance/users').then(setInstanceUsers);
        }
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Admin data could not be loaded.'),
      );
  }, []);

  useEffect(() => load(), [load]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    await apiRequest('/admin/members', {
      method: 'POST',
      body: JSON.stringify({ email: fields.get('email'), role: fields.get('role') }),
    });
    form.reset();
    load();
  }

  async function changeRole(userId: string, role: string) {
    await apiRequest(`/admin/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function removeMember(userId: string) {
    if (!window.confirm('Remove this member and revoke their workspace sessions?')) return;
    await apiRequest(`/admin/members/${userId}`, { method: 'DELETE' });
    load();
  }

  async function revokeConnector(connectorId: string) {
    if (!window.confirm('Revoke this connector and all of its active tokens?')) return;
    await apiRequest(`/admin/connectors/${connectorId}`, { method: 'DELETE' });
    load();
  }

  async function changeUserStatus(user: InstanceUser) {
    const status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`${status === 'SUSPENDED' ? 'Suspend' : 'Reactivate'} ${user.email}?`))
      return;
    await apiRequest(`/admin/instance/users/${user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function updateSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await apiRequest<TenantSettings>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        retentionDays: Number(fields.get('retentionDays')),
        aiProvider: fields.get('aiProvider'),
        aiModel: fields.get('aiModel'),
        aiMonthlyTokenBudget: Number(fields.get('aiMonthlyTokenBudget')),
      }),
    });
    load();
  }

  async function exportWorkspace() {
    const data = await apiRequest<unknown>('/admin/data-export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `promptlens-${settings?.slug ?? 'workspace'}-export.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function scheduleDeletion() {
    if (!settings) return;
    const confirmation = window.prompt(
      `This schedules permanent deletion after seven days. Type: delete ${settings.slug}`,
    );
    if (!confirmation) return;
    await apiRequest('/admin/deletion', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    });
    load();
  }

  async function cancelDeletion() {
    await apiRequest('/admin/deletion', { method: 'DELETE' });
    load();
  }

  async function requestSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    await apiRequest('/admin/instance/support-requests', {
      method: 'POST',
      body: JSON.stringify({ tenantId: fields.get('tenantId'), reason: fields.get('reason') }),
    });
    form.reset();
    load();
  }

  async function approveSupport(grantId: string) {
    await apiRequest(`/admin/support-requests/${grantId}/approve`, { method: 'POST' });
    load();
  }

  async function revokeSupport(grantId: string) {
    await apiRequest(`/admin/support-requests/${grantId}`, { method: 'DELETE' });
    load();
  }

  async function viewSupportMetadata(tenantId: string) {
    setSupportMetadata(await apiRequest(`/admin/instance/support/${tenantId}/metadata`));
  }

  return (
    <WorkspaceShell
      eyebrow="Administration"
      title="System control"
      description="Workspace policy, access, operations, and audit signals in one control plane."
      badge={overview?.instance ? 'Instance admin' : 'Workspace admin'}
    >
      <div className="pl-admin-content">
        {error ? (
          <div className="v2-error" role="alert">
            <p>{error}</p>
            <button type="button" className="v2-action" onClick={() => load()}>
              Try again
            </button>
          </div>
        ) : null}
        <section
          className="metric-grid pl-admin-metrics"
          aria-label="Workspace administration metrics"
        >
          <AdminMetric label="Users" value={overview?.tenant.users ?? '—'} />
          <AdminMetric label="Projects" value={overview?.tenant.projects ?? '—'} />
          <AdminMetric label="Prompts" value={overview?.tenant.prompts ?? '—'} />
          <AdminMetric label="Connectors" value={overview?.tenant.connectors ?? '—'} />
        </section>
        {overview?.instance ? (
          <section className="panel">
            <p className="eyebrow">Instance health</p>
            <div className="metric-grid compact">
              <AdminMetric label="Tenants" value={overview.instance.tenants} />
              <AdminMetric label="All users" value={overview.instance.users} />
              <AdminMetric label="Queued analyses" value={overview.instance.queuedAnalyses} />
              <AdminMetric label="Pending outbox" value={overview.instance.unpublishedEvents} />
            </div>
          </section>
        ) : null}
        {settings ? (
          <section className="panel">
            <p className="eyebrow">Workspace policy</p>
            <h2>AI and data lifecycle</h2>
            <form className="settings-form" onSubmit={(event) => void updateSettings(event)}>
              <label>
                Retention days
                <input
                  name="retentionDays"
                  type="number"
                  min="1"
                  max="3650"
                  defaultValue={settings.retentionDays}
                  required
                />
              </label>
              <label>
                AI provider
                <select name="aiProvider" defaultValue={settings.aiProvider}>
                  <option value="fake">Deterministic local</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="nvidia">NVIDIA API Catalog</option>
                </select>
              </label>
              <label>
                Model
                <input name="aiModel" defaultValue={settings.aiModel} maxLength={160} required />
              </label>
              <label>
                Monthly token budget
                <input
                  name="aiMonthlyTokenBudget"
                  type="number"
                  min="1000"
                  max="2000000000"
                  defaultValue={settings.aiMonthlyTokenBudget}
                  required
                />
              </label>
              <button type="submit">Save policy</button>
            </form>
            <div className="inline-actions">
              <button type="button" className="quiet" onClick={() => void exportWorkspace()}>
                Export all workspace data
              </button>
              {settings.deletionScheduledAt ? (
                <button type="button" onClick={() => void cancelDeletion()}>
                  Cancel deletion scheduled for{' '}
                  {new Date(settings.deletionScheduledAt).toLocaleDateString()}
                </button>
              ) : (
                <button type="button" className="danger" onClick={() => void scheduleDeletion()}>
                  Schedule workspace deletion
                </button>
              )}
            </div>
          </section>
        ) : null}
        <section className="panel">
          <p className="eyebrow">Privacy-preserving support</p>
          <h2>Time-limited support access</h2>
          <p className="muted">
            Approved access expires after one hour and exposes operational metadata only—never
            prompt or analysis content.
          </p>
          {overview?.instance ? (
            <form className="inline-form" onSubmit={(event) => void requestSupport(event)}>
              <input name="tenantId" placeholder="Target workspace UUID" required />
              <input name="reason" placeholder="Support reason (minimum 10 characters)" required />
              <button type="submit">Request support access</button>
            </form>
          ) : null}
          <div className="data-list">
            {supportGrants.map((grant) => {
              const active =
                grant.approvedById &&
                grant.expiresAt &&
                !grant.revokedAt &&
                new Date(grant.expiresAt) > new Date();
              return (
                <article key={grant.id}>
                  <div>
                    <strong>{grant.reason}</strong>
                    <small>
                      {active
                        ? `Expires ${new Date(grant.expiresAt!).toLocaleString()}`
                        : 'Pending or expired'}
                    </small>
                  </div>
                  {!grant.approvedById && !grant.revokedAt ? (
                    <button type="button" onClick={() => void approveSupport(grant.id)}>
                      Approve for one hour
                    </button>
                  ) : null}
                  {!grant.revokedAt ? (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void revokeSupport(grant.id)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
          {overview?.instance && settings ? (
            <button
              type="button"
              className="quiet"
              onClick={() => void viewSupportMetadata(settings.id)}
            >
              View approved metadata for this workspace
            </button>
          ) : null}
          {supportMetadata ? (
            <pre className="metadata-preview">{JSON.stringify(supportMetadata, null, 2)}</pre>
          ) : null}
        </section>
        {queue ? (
          <section className="panel">
            <p className="eyebrow">Analysis queue</p>
            <div className="metric-grid compact">
              <AdminMetric label="Waiting" value={queue.counts.waiting ?? 0} />
              <AdminMetric label="Active" value={queue.counts.active ?? 0} />
              <AdminMetric label="Delayed" value={queue.counts.delayed ?? 0} />
              <AdminMetric label="Failed / DLQ" value={queue.counts.failed ?? 0} />
            </div>
            <div className="data-list">
              {queue.failed.map((job) => (
                <article key={job.id}>
                  <div>
                    <strong>Job {job.id}</strong>
                    <small>
                      Tenant {job.tenantId ?? 'unknown'} · attempts {job.attemptsMade}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void apiRequest(`/admin/operations/queue/${job.id}/retry`, { method: 'POST' })
                        .then(() => load())
                        .catch((cause: unknown) =>
                          setError(cause instanceof Error ? cause.message : 'Job retry failed.'),
                        );
                    }}
                  >
                    Retry
                  </button>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {overview?.instance ? (
          <section className="panel">
            <p className="eyebrow">Instance access</p>
            <h2>Users</h2>
            <div className="data-list">
              {instanceUsers.map((user) => (
                <article key={user.id}>
                  <div>
                    <strong>{user.displayName}</strong>
                    <small>
                      {user.email} · {user._count.memberships} workspace(s)
                    </small>
                  </div>
                  <span>
                    {user.status}
                    {user.isInstanceAdmin ? ' · instance admin' : ''}
                  </span>
                  {!user.isInstanceAdmin ? (
                    <button
                      className={user.status === 'ACTIVE' ? 'danger' : 'quiet'}
                      type="button"
                      onClick={() => void changeUserStatus(user)}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <div className="admin-columns">
          <section className="panel">
            <p className="eyebrow">Access</p>
            <h2>Members</h2>
            <div className="data-list">
              {members.map((member) => (
                <article key={member.user.id}>
                  <div>
                    <strong>{member.user.displayName}</strong>
                    <small>{member.user.email}</small>
                  </div>
                  <select
                    aria-label={`Role for ${member.user.displayName}`}
                    value={member.role}
                    onChange={(event) => void changeRole(member.user.id, event.target.value)}
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    className="quiet"
                    type="button"
                    onClick={() => void removeMember(member.user.id)}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
            <form className="inline-form" onSubmit={(event) => void addMember(event)}>
              <input name="email" type="email" placeholder="Existing user email" required />
              <select name="role" defaultValue="MEMBER" aria-label="New member role">
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button type="submit">Add member</button>
            </form>
          </section>
          <section className="panel">
            <p className="eyebrow">Security</p>
            <h2>Audit trail</h2>
            <div className="data-list">
              {audit.map((event) => (
                <article key={event.id}>
                  <div>
                    <strong>{event.action}</strong>
                    <small>{new Date(event.createdAt).toLocaleString()}</small>
                  </div>
                  <span>{event.result}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
        <section className="panel">
          <p className="eyebrow">Integrations</p>
          <h2>Connectors</h2>
          <div className="data-list">
            {connectors.length === 0 ? (
              <p className="empty">No connectors installed.</p>
            ) : (
              connectors.map((connector) => (
                <article key={connector.id}>
                  <div>
                    <strong>{connector.displayName}</strong>
                    <small>
                      {connector.platform} · protocol {connector.protocolVersion}
                    </small>
                  </div>
                  <span>{connector.status}</span>
                  {connector.status !== 'REVOKED' ? (
                    <button
                      className="quiet"
                      type="button"
                      onClick={() => void revokeConnector(connector.id)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function AdminMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}) {
  return (
    <article className="metric pl-admin-metric">
      <div className="pl-kpi-label">
        <p>{label}</p>
        <span aria-hidden="true">◇</span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}
