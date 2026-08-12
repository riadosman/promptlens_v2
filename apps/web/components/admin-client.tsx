'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiRequest } from '../lib/api';
import { type AdminSection } from '../lib/admin-sections';

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
  aiProvider: 'fake' | 'openai' | 'anthropic';
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

export function AdminClient({ section = 'overview' }: { readonly section?: AdminSection }) {
  const [loading, setLoading] = useState(true);
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
  const [toast, setToast] = useState<string | null>(null);
  const [deletionModalOpen, setDeletionModalOpen] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditResult, setAuditResult] = useState('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [instanceUserQuery, setInstanceUserQuery] = useState('');
  const [instanceUserStatus, setInstanceUserStatus] = useState('ALL');
  const [instanceUserPage, setInstanceUserPage] = useState(1);
  const [statusConfirmation, setStatusConfirmation] = useState<{
    user: InstanceUser;
    status: 'ACTIVE' | 'SUSPENDED';
  } | null>(null);

  const showSection = (target: AdminSection) => section === target;
  const adminMemberCount = members.filter(
    (member) => member.role === 'OWNER' || member.role === 'ADMIN',
  ).length;
  const viewerMemberCount = members.filter((member) => member.role === 'VIEWER').length;
  const activeConnectorCount = connectors.filter((connector) => connector.status !== 'REVOKED').length;
  const successfulAuditCount = audit.filter((event) => event.result === 'SUCCESS').length;
  const failedAuditCount = audit.length - successfulAuditCount;
  const pendingSupportCount = supportGrants.filter(
    (grant) => !grant.approvedById && !grant.revokedAt,
  ).length;
  const activeSupportCount = supportGrants.filter(
    (grant) =>
      Boolean(grant.approvedById && grant.expiresAt && !grant.revokedAt) &&
      new Date(grant.expiresAt!).getTime() > Date.now(),
  ).length;
  const activeInstanceUserCount = instanceUsers.filter((user) => user.status === 'ACTIVE').length;
  const suspendedInstanceUserCount = instanceUsers.filter(
    (user) => user.status === 'SUSPENDED',
  ).length;
  const instanceAdminCount = instanceUsers.filter((user) => user.isInstanceAdmin).length;
  const filteredAudit = audit.filter((event) => {
    const query = auditQuery.trim().toLowerCase();
    const matchesQuery = !query || [event.action, event.result, event.targetType ?? '']
      .join(' ')
      .toLowerCase()
      .includes(query);
    return matchesQuery && (auditResult === 'ALL' || event.result === auditResult);
  });
  const auditPageCount = Math.max(1, Math.ceil(filteredAudit.length / 8));
  const safeAuditPage = Math.min(auditPage, auditPageCount);
  const visibleAudit = filteredAudit.slice((safeAuditPage - 1) * 8, safeAuditPage * 8);
  const filteredInstanceUsers = instanceUsers.filter((user) => {
    const query = instanceUserQuery.trim().toLowerCase();
    const matchesQuery = !query || `${user.displayName} ${user.email}`.toLowerCase().includes(query);
    return matchesQuery && (instanceUserStatus === 'ALL' || user.status === instanceUserStatus);
  });
  const instanceUserPageCount = Math.max(1, Math.ceil(filteredInstanceUsers.length / 8));
  const safeInstanceUserPage = Math.min(instanceUserPage, instanceUserPageCount);
  const visibleInstanceUsers = filteredInstanceUsers.slice(
    (safeInstanceUserPage - 1) * 8,
    safeInstanceUserPage * 8,
  );

  const load = useCallback(() => {
    setLoading(true);
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
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load, section]);

  if (loading) return <AdminLoadingSkeleton />;

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
    setStatusConfirmation({ user, status });
  }

  async function confirmUserStatusChange(user: InstanceUser, status: 'ACTIVE' | 'SUSPENDED') {
    await apiRequest(`/admin/instance/users/${user.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function updateSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    try {
      await apiRequest<TenantSettings>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        retentionDays: Number(fields.get('retentionDays')),
        aiProvider: fields.get('aiProvider'),
        aiModel: fields.get('aiModel'),
        aiMonthlyTokenBudget: Number(fields.get('aiMonthlyTokenBudget')),
      }),
      });
      setToast('Settings saved successfully.');
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Settings could not be saved.');
    }
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
    setToast('Workspace export downloaded.');
  }

  function scheduleDeletion() {
    if (!settings) return;
    setDeletionConfirmation('');
    setDeletionModalOpen(true);
  }

  async function confirmScheduleDeletion() {
    if (!settings || deletionConfirmation !== `delete ${settings.slug}`) return;
    await apiRequest('/admin/deletion', {
      method: 'POST',
      body: JSON.stringify({ confirmation: deletionConfirmation }),
    });
    setDeletionModalOpen(false);
    setToast('Workspace deletion has been scheduled.');
    load();
  }

  async function cancelDeletion() {
    await apiRequest('/admin/deletion', { method: 'DELETE' });
    setToast('Scheduled deletion cancelled.');
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
    <main className="control-center admin-main">
      <aside className="control-center-rail" aria-label="Administration navigation">
        <Link className="control-center-wordmark" href="/dashboard">
          PromptLens
        </Link>
        <p className="control-center-rail-label">Administration</p>
        <nav className="control-center-nav">
          <Link className={section === 'overview' ? 'is-active' : ''} href="/admin">
            Overview
          </Link>
          <Link className={section === 'members' ? 'is-active' : ''} href="/admin/members">
            Members
          </Link>
          <Link className={section === 'settings' ? 'is-active' : ''} href="/admin/settings">
            Settings
          </Link>
          <Link
            className={section === 'connectors' ? 'is-active' : ''}
            href="/admin/connectors"
          >
            Connectors
          </Link>
          <Link className={section === 'audit' ? 'is-active' : ''} href="/admin/audit">
            Audit log
          </Link>
          <Link className={section === 'support' ? 'is-active' : ''} href="/admin/support">
            Support access
          </Link>
        </nav>
        {overview?.instance ? (
          <div className="control-center-instance-links">
            <p className="control-center-rail-label">Instance</p>
            <Link className={section === 'operations' ? 'is-active' : ''} href="/admin/operations">
              Operations
            </Link>
            <Link
              className={section === 'instance-users' ? 'is-active' : ''}
              href="/admin/instance-users"
            >
              Instance users
            </Link>
          </div>
        ) : null}
        <Link className="control-center-back" href="/dashboard">
          Back to dashboard
        </Link>
      </aside>
      <div className="control-center-content">
        <header className="control-center-topbar">
          <div>
            <p className="eyebrow">Administration</p>
            <h1>Control center</h1>
          </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {section === 'overview' && overview ? (
        <section className="control-center-detail-hero" aria-labelledby="overview-page-title">
          <div>
            <p className="eyebrow">Workspace overview</p>
            <h2 id="overview-page-title">Signals at a glance</h2>
            <p>Understand the workspace footprint before you move into the details.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Workspace summary">
            <div>
              <span>Users</span>
              <strong>{overview.tenant.users}</strong>
            </div>
            <div>
              <span>Projects</span>
              <strong>{overview.tenant.projects}</strong>
            </div>
            <div>
              <span>Prompts</span>
              <strong>{overview.tenant.prompts}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'members' ? (
        <section className="control-center-detail-hero" aria-labelledby="members-page-title">
          <div>
            <p className="eyebrow">Workspace access</p>
            <h2 id="members-page-title">Members and roles</h2>
            <p>Keep workspace access clear, current, and easy to review.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Member summary">
            <div>
              <span>Total members</span>
              <strong>{members.length}</strong>
            </div>
            <div>
              <span>Admins</span>
              <strong>{adminMemberCount}</strong>
            </div>
            <div>
              <span>Viewers</span>
              <strong>{viewerMemberCount}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'settings' && settings ? (
        <section className="control-center-detail-hero" aria-labelledby="settings-page-title">
          <div>
            <p className="eyebrow">Workspace governance</p>
            <h2 id="settings-page-title">Settings</h2>
            <p>Shape how your workspace stores, processes, and protects its data.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Settings summary">
            <div>
              <span>Retention</span>
              <strong>{settings.retentionDays} days</strong>
            </div>
            <div>
              <span>AI provider</span>
              <strong>{settings.aiProvider}</strong>
            </div>
            <div>
              <span>Deletion</span>
              <strong>{settings.deletionScheduledAt ? 'Scheduled' : 'Off'}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'connectors' ? (
        <section className="control-center-detail-hero" aria-labelledby="connectors-page-title">
          <div>
            <p className="eyebrow">Workspace integrations</p>
            <h2 id="connectors-page-title">Connectors</h2>
            <p>Keep external tools connected, visible, and easy to revoke when needed.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Connector summary">
            <div>
              <span>Total connectors</span>
              <strong>{connectors.length}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{activeConnectorCount}</strong>
            </div>
            <div>
              <span>Revoked</span>
              <strong>{connectors.length - activeConnectorCount}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'audit' ? (
        <section className="control-center-detail-hero" aria-labelledby="audit-page-title">
          <div>
            <p className="eyebrow">Workspace security</p>
            <h2 id="audit-page-title">Audit log</h2>
            <p>Trace administrative activity with a clear, time-ordered record of change.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Audit summary">
            <div>
              <span>Total events</span>
              <strong>{audit.length}</strong>
            </div>
            <div>
              <span>Successful</span>
              <strong>{successfulAuditCount}</strong>
            </div>
            <div>
              <span>Needs review</span>
              <strong>{failedAuditCount}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'support' ? (
        <section className="control-center-detail-hero" aria-labelledby="support-page-title">
          <div>
            <p className="eyebrow">Privacy-preserving access</p>
            <h2 id="support-page-title">Support access</h2>
            <p>Review temporary support grants without exposing prompt or analysis content.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Support access summary">
            <div>
              <span>Total requests</span>
              <strong>{supportGrants.length}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{pendingSupportCount}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{activeSupportCount}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'operations' && queue ? (
        <section className="control-center-detail-hero" aria-labelledby="operations-page-title">
          <div>
            <p className="eyebrow">Instance operations</p>
            <h2 id="operations-page-title">Operations</h2>
            <p>Monitor analysis throughput and recover failed jobs without leaving the control center.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Operations summary">
            <div>
              <span>Waiting</span>
              <strong>{queue.counts.waiting ?? 0}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{queue.counts.active ?? 0}</strong>
            </div>
            <div>
              <span>Failed / DLQ</span>
              <strong>{queue.counts.failed ?? 0}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {section === 'instance-users' ? (
        <section className="control-center-detail-hero" aria-labelledby="instance-users-page-title">
          <div>
            <p className="eyebrow">Instance access</p>
            <h2 id="instance-users-page-title">Instance users</h2>
            <p>Manage platform-wide access and keep account status visible at a glance.</p>
          </div>
          <div className="control-center-detail-metrics" aria-label="Instance user summary">
            <div>
              <span>Total users</span>
              <strong>{instanceUsers.length}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{activeInstanceUserCount}</strong>
            </div>
            <div>
              <span>Instance admins</span>
              <strong>{instanceAdminCount}</strong>
            </div>
          </div>
        </section>
      ) : null}
      {showSection('overview') ? (
        <section className="control-center-section" id="overview" aria-labelledby="overview-title">
        <div className="control-center-section-heading">
          <div>
            <p className="eyebrow">Workspace activity</p>
            <h2 id="overview-title">Operational signals</h2>
          </div>
          <span className="control-center-status">Live data</span>
        </div>
        <div className="control-center-metrics">
          <AdminMetric label="Analyses" value={overview?.tenant.analyses ?? '—'} />
          <AdminMetric label="Connectors" value={overview?.tenant.connectors ?? '—'} />
          <AdminMetric label="Input tokens" value={overview?.tenant.inputTokens ?? '—'} />
          <AdminMetric label="Output tokens" value={overview?.tenant.outputTokens ?? '—'} />
        </div>
        </section>
      ) : null}
      {overview?.instance && showSection('overview') ? (
        <section className="control-center-section control-center-system-status">
          <div className="control-center-section-heading">
            <div>
              <p className="eyebrow">Instance health</p>
              <h2>System status</h2>
            </div>
            <span className="control-center-status is-healthy">Healthy</span>
          </div>
          <div className="control-center-metrics compact">
            <AdminMetric label="Tenants" value={overview.instance.tenants} />
            <AdminMetric label="All users" value={overview.instance.users} />
            <AdminMetric label="Queued analyses" value={overview.instance.queuedAnalyses} />
            <AdminMetric label="Pending outbox" value={overview.instance.unpublishedEvents} />
          </div>
        </section>
      ) : null}
      {settings && showSection('settings') ? (
        <section className="control-center-section control-center-settings-section" id="workspace-policy">
          <div className="control-center-section-heading">
            <div>
              <p className="eyebrow">Workspace policy</p>
              <h2>AI and data lifecycle</h2>
              <p className="muted">Set the defaults that guide analysis and data retention.</p>
            </div>
            <span className="control-center-status is-healthy">Configured</span>
          </div>
          <form className="settings-form" onSubmit={updateSettings}>
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
          <div className="control-center-settings-actions">
            <div>
              <p className="eyebrow">Data controls</p>
              <p className="muted">Download a copy of your workspace or manage its deletion schedule.</p>
            </div>
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
          </div>
        </section>
      ) : null}
      {showSection('support') ? (
        <section className="control-center-section control-center-support-section" id="support-access">
        <div className="control-center-section-heading">
          <div>
          <p className="eyebrow">Privacy-preserving support</p>
          <h2>Time-limited support access</h2>
          </div>
          <span className="control-center-status is-healthy">One hour max</span>
        </div>
        <p className="muted">
          Approved access expires after one hour and exposes operational metadata only—never prompt
          or analysis content.
        </p>
        {overview?.instance ? (
          <form className="inline-form" onSubmit={requestSupport}>
            <input name="tenantId" placeholder="Target workspace UUID" required />
            <input name="reason" placeholder="Support reason (minimum 10 characters)" required />
            <button type="submit">Request support access</button>
          </form>
        ) : null}
        <div className="data-list control-center-support-list">
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
                <span className={active ? 'is-active' : 'is-muted'}>
                  {active ? 'Active' : grant.approvedById ? 'Expired' : 'Pending'}
                </span>
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
      ) : null}
      {queue && showSection('operations') ? (
        <section className="control-center-section control-center-operations-section" id="queue">
          <div className="control-center-section-heading">
            <div>
              <p className="eyebrow">Analysis queue</p>
              <h2>Queue health</h2>
              <p className="muted">Jobs waiting for processing or requiring a retry.</p>
            </div>
            <span className="control-center-status is-healthy">Operational</span>
          </div>
          <div className="metric-grid compact control-center-operations-metrics">
            <AdminMetric label="Waiting" value={queue.counts.waiting ?? 0} />
            <AdminMetric label="Active" value={queue.counts.active ?? 0} />
            <AdminMetric label="Delayed" value={queue.counts.delayed ?? 0} />
            <AdminMetric label="Failed / DLQ" value={queue.counts.failed ?? 0} />
          </div>
          <div className="data-list control-center-operations-list">
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
                  onClick={async () => {
                    await apiRequest(`/admin/operations/queue/${job.id}/retry`, { method: 'POST' });
                    load();
                  }}
                >
                  Retry
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {overview?.instance && showSection('instance-users') ? (
        <section className="control-center-section control-center-instance-users-section" id="instance-users">
          <div className="control-center-section-heading">
            <div>
              <p className="eyebrow">Instance access</p>
              <h2>Users</h2>
              <p className="muted">Platform accounts and their workspace membership footprint.</p>
            </div>
            <span className="control-center-status is-healthy">{suspendedInstanceUserCount} suspended</span>
          </div>
          <div className="control-center-list-toolbar">
            <input
              type="search"
              value={instanceUserQuery}
              onChange={(event) => {
                setInstanceUserQuery(event.target.value);
                setInstanceUserPage(1);
              }}
              placeholder="Search users"
              aria-label="Search instance users"
            />
            <select
              value={instanceUserStatus}
              onChange={(event) => {
                setInstanceUserStatus(event.target.value);
                setInstanceUserPage(1);
              }}
              aria-label="Filter users by status"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <span>{filteredInstanceUsers.length} users</span>
          </div>
          <div className="data-list control-center-instance-users-list">
            {visibleInstanceUsers.map((user) => (
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
          <Pagination page={safeInstanceUserPage} pageCount={instanceUserPageCount} onChange={setInstanceUserPage} />
        </section>
      ) : null}
      {showSection('members') || showSection('audit') ? (
        <div
          className={`admin-columns ${section !== 'overview' ? 'control-center-focused-columns' : ''}`}
        >
        {showSection('members') ? (
          <section className="control-center-section" id="members">
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
          <form className="inline-form" onSubmit={addMember}>
            <input name="email" type="email" placeholder="Existing user email" required />
            <select name="role" defaultValue="MEMBER" aria-label="New member role">
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button type="submit">Add member</button>
          </form>
          </section>
        ) : null}
        {showSection('audit') ? (
          <section className="control-center-section control-center-audit-section" id="audit">
          <div className="control-center-section-heading">
            <div>
              <p className="eyebrow">Security events</p>
              <h2>Activity history</h2>
              <p className="muted">Administrative actions recorded for this workspace.</p>
            </div>
            <span className="control-center-status is-healthy">Live log</span>
          </div>
          <div className="control-center-list-toolbar">
            <input
              type="search"
              value={auditQuery}
              onChange={(event) => {
                setAuditQuery(event.target.value);
                setAuditPage(1);
              }}
              placeholder="Search events"
              aria-label="Search audit events"
            />
            <select
              value={auditResult}
              onChange={(event) => {
                setAuditResult(event.target.value);
                setAuditPage(1);
              }}
              aria-label="Filter audit results"
            >
              <option value="ALL">All results</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
            <span>{filteredAudit.length} events</span>
          </div>
          <div className="data-list control-center-audit-list">
            {visibleAudit.map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{event.action}</strong>
                  <small>{new Date(event.createdAt).toLocaleString()}</small>
                </div>
                <span>{event.targetType ?? 'Workspace'}</span>
                <b className={event.result === 'SUCCESS' ? 'is-success' : 'is-failed'}>
                  {event.result}
                </b>
              </article>
            ))}
          </div>
          <Pagination page={safeAuditPage} pageCount={auditPageCount} onChange={setAuditPage} />
          </section>
        ) : null}
        </div>
      ) : null}
      {showSection('connectors') ? (
        <section className="control-center-section control-center-connectors-section" id="connectors">
        <div className="control-center-section-heading">
          <div>
            <p className="eyebrow">Connected services</p>
            <h2>Installed connectors</h2>
            <p className="muted">Review the tools that can exchange workspace metadata.</p>
          </div>
          <span className="control-center-status is-healthy">{activeConnectorCount} active</span>
        </div>
        <div className="data-list control-center-connectors-list">
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
      ) : null}
      </div>
      {statusConfirmation ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setStatusConfirmation(null)}>
          <section
            className="admin-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-status-confirmation-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Instance users</p>
            <h2 id="admin-status-confirmation-title">
              {statusConfirmation.status === 'SUSPENDED' ? 'Suspend user?' : 'Reactivate user?'}
            </h2>
            <p>
              {statusConfirmation.status === 'SUSPENDED'
                ? `${statusConfirmation.user.email} will lose access to the instance.`
                : `${statusConfirmation.user.email} will regain access to the instance.`}
            </p>
            <div className="admin-modal-actions">
              <button className="quiet" type="button" onClick={() => setStatusConfirmation(null)}>
                Cancel
              </button>
              <button
                className={statusConfirmation.status === 'SUSPENDED' ? 'danger' : 'primary'}
                type="button"
                onClick={() => {
                  const pending = statusConfirmation;
                  setStatusConfirmation(null);
                  void confirmUserStatusChange(pending.user, pending.status);
                }}
              >
                {statusConfirmation.status === 'SUSPENDED' ? 'Suspend' : 'Reactivate'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {deletionModalOpen && settings ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setDeletionModalOpen(false)}>
          <section className="admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="deletion-title" onMouseDown={(event) => event.stopPropagation()}>
            <p className="eyebrow">Data controls</p>
            <h2 id="deletion-title">Schedule workspace deletion?</h2>
            <p>This permanently deletes the workspace after seven days. Type <strong>delete {settings.slug}</strong> to confirm.</p>
            <input value={deletionConfirmation} onChange={(event) => setDeletionConfirmation(event.target.value)} placeholder={`delete ${settings.slug}`} autoFocus />
            <div className="admin-modal-actions">
              <button className="quiet" type="button" onClick={() => setDeletionModalOpen(false)}>Cancel</button>
              <button className="danger" type="button" disabled={deletionConfirmation !== `delete ${settings.slug}`} onClick={() => void confirmScheduleDeletion()}>Schedule deletion</button>
            </div>
          </section>
        </div>
      ) : null}
      {toast ? <div className="dashboard-toast" role="status" onClick={() => setToast(null)}>{toast}</div> : null}
    </main>
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
    <article className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function AdminLoadingSkeleton() {
  return (
    <main className="control-center admin-main admin-loading-shell" aria-busy="true" aria-label="Loading administration">
      <aside className="control-center-rail" aria-hidden="true">
        <span className="admin-skeleton admin-skeleton-wordmark" />
        <span className="admin-skeleton admin-skeleton-label" />
        <nav className="control-center-nav">
          {Array.from({ length: 6 }).map((_, index) => <span className="admin-skeleton admin-skeleton-nav" key={index} />)}
        </nav>
      </aside>
      <div className="control-center-content">
        <header className="control-center-topbar">
          <div><span className="admin-skeleton admin-skeleton-eyebrow" /><span className="admin-skeleton admin-skeleton-heading" /></div>
          <span className="admin-skeleton admin-skeleton-scope" />
        </header>
        <section className="control-center-section admin-skeleton-panel">
          <span className="admin-skeleton admin-skeleton-eyebrow" />
          <span className="admin-skeleton admin-skeleton-title" />
          <div className="admin-skeleton-metrics">
            {Array.from({ length: 4 }).map((_, index) => <span className="admin-skeleton admin-skeleton-metric" key={index} />)}
          </div>
        </section>
        <section className="control-center-section admin-skeleton-panel admin-skeleton-list">
          {Array.from({ length: 5 }).map((_, index) => <span className="admin-skeleton admin-skeleton-row" key={index} />)}
        </section>
      </div>
    </main>
  );
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly onChange: (page: number) => void;
}) {
  return (
    <nav className="control-center-pagination" aria-label="Pagination">
      <button
        type="button"
        className="quiet"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ←
      </button>
      <button
        type="button"
        className="quiet"
        aria-label="Next page"
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
      >
        →
      </button>
    </nav>
  );
}
