'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  DashboardStats,
  ProjectResponse,
  PromptListResponse,
} from '@promptlens/contracts';
import { apiDownload, apiRequest } from '../lib/api';

type DashboardSection = 'overview' | 'prompts' | 'projects';

type ActorContext = {
  userId: string;
  role: string;
  tenantId: string;
  sessionId: string;
  isInstanceAdmin: boolean;
};

type AdminMember = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  role: string;
  createdAt: string;
};

type MemberOption = {
  id: string;
  displayName: string;
  email: string;
};

type MockPromptRow = PromptListResponse['items'][number] & {
  ownerId: string;
};

type MockMode = {
  actor: ActorContext;
  tenantMembers: MemberOption[];
  tenants: Array<{ role: string; tenant: { id: string; name: string } }>;
};

const emptyMockMode: MockMode = {
  actor: {
    userId: 'user-owner-001',
    role: 'OWNER',
    tenantId: 'tenant-001',
    sessionId: 'session-owner-001',
    isInstanceAdmin: true,
  },
  tenantMembers: [],
  tenants: [{ role: 'OWNER', tenant: { id: 'tenant-001', name: 'Acme Marketing' } }],
};

const now = Date.now();
const relativeIsoDate = (daysAgo: number) =>
  new Date(now - daysAgo * 24 * 60 * 60 * 1_000).toISOString();

const mockProjects: ProjectResponse[] = [
  {
    id: 'project-content',
    name: 'Content team',
    description: 'Product launches, copy and campaign tracking.',
    status: 'ACTIVE',
    createdAt: relativeIsoDate(180),
    updatedAt: relativeIsoDate(3),
  },
  {
    id: 'project-support',
    name: 'Support ops',
    description: 'Incident triage and customer support responses.',
    status: 'ACTIVE',
    createdAt: relativeIsoDate(120),
    updatedAt: relativeIsoDate(7),
  },
  {
    id: 'project-ai',
    name: 'AI experimentation',
    description: 'Prompt experiments and optimization.',
    status: 'ARCHIVED',
    createdAt: relativeIsoDate(95),
    updatedAt: relativeIsoDate(30),
  },
];

const mockPrompts: MockPromptRow[] = [
  {
    id: 'prompt-001',
    projectId: 'project-content',
    projectName: 'Content team',
    content:
      'Create a social post announcing a product upgrade for finance teams in one confident paragraph.',
    platform: 'slack',
    model: 'gpt-4o-mini',
    occurredAt: relativeIsoDate(0.2),
    tags: ['marketing', 'social'],
    ownerId: 'user-owner-001',
    analysis: {
      id: 'analysis-001',
      status: 'COMPLETED',
      score: 87,
      strengths: ['Clear CTA', 'Professional tone', 'Concise'],
      weaknesses: ['Could specify release window'],
      suggestions: ['Add explicit rollout date', 'Mention migration checklist', 'Keep one CTA only'],
      improvedPrompt:
        'Create one concise social post for a finance-team product upgrade announcement, include rollout date, risk notes, and a single clear CTA.',
    },
  },
  {
    id: 'prompt-002',
    projectId: 'project-support',
    projectName: 'Support ops',
    content: 'Write a clear reply for a customer asking about delayed shipment and refund policy.',
    platform: 'chat',
    model: 'claude-3.5-sonnet',
    occurredAt: relativeIsoDate(1),
    tags: ['support', 'refund'],
    ownerId: 'user-dev-002',
    analysis: {
      id: 'analysis-002',
      status: 'RUNNING',
      score: null,
      strengths: ['Empathy first', 'Uses plain language'],
      weaknesses: ['Policy reference is missing'],
      suggestions: ['Add specific policy clause', 'Offer direct escalation contact'],
      improvedPrompt: null,
    },
  },
  {
    id: 'prompt-003',
    projectId: 'project-ai',
    projectName: 'AI experimentation',
    content: 'Summarize the following PR review comments into 3 action items.',
    platform: 'api',
    model: 'gpt-4o',
    occurredAt: relativeIsoDate(2),
    tags: ['engineering', 'review'],
    ownerId: 'user-owner-001',
    analysis: {
      id: 'analysis-003',
      status: 'COMPLETED',
      score: 74,
      strengths: ['Structured output', 'Action-oriented'],
      weaknesses: ['No priority labels'],
      suggestions: ['Add Priority tag', 'Split long ideas'],
      improvedPrompt:
        'Summarize PR review comments in 3 action items with impact, owner, and urgency.',
    },
  },
  {
    id: 'prompt-004',
    projectId: 'project-content',
    projectName: 'Content team',
    content: 'Generate alternate headlines for a security update blog post.',
    platform: 'browser',
    model: 'gemini-pro',
    occurredAt: relativeIsoDate(3),
    tags: ['content', 'headlines'],
    ownerId: 'user-dev-002',
    analysis: {
      id: 'analysis-004',
      status: 'FAILED',
      score: null,
      strengths: ['Creative intent'],
      weaknesses: ['Failed due to provider timeout'],
      suggestions: ['Retry with shorter prompt', 'Restrict max headline count'],
      improvedPrompt: null,
    },
  },
];

const mockSessions = [
  {
    id: 'session-owner-001',
    userAgent: 'Chrome / Windows',
    createdAt: relativeIsoDate(0.05),
    current: true,
  },
  {
    id: 'session-dev-002',
    userAgent: 'Edge / macOS',
    createdAt: relativeIsoDate(1.7),
    current: false,
  },
];

const mockTenantMembers: MemberOption[] = [
  { id: 'user-owner-001', displayName: 'Merve A.', email: 'merve@acme.test' },
  { id: 'user-dev-002', displayName: 'Ali B.', email: 'ali@acme.test' },
];

const mockTenants = [
  { role: 'OWNER', tenant: { id: 'tenant-001', name: 'Acme Marketing' } },
  { role: 'MEMBER', tenant: { id: 'tenant-002', name: 'Acme Enterprise' } },
];

const mockUsers: Record<'OWNER' | 'USER', MockMode> = {
  OWNER: {
    actor: {
      userId: 'user-owner-001',
      role: 'OWNER',
      tenantId: 'tenant-001',
      sessionId: 'session-owner-001',
      isInstanceAdmin: true,
    },
    tenantMembers: mockTenantMembers,
    tenants: mockTenants,
  },
  USER: {
    actor: {
      userId: 'user-dev-002',
      role: 'MEMBER',
      tenantId: 'tenant-001',
      sessionId: 'session-dev-002',
      isInstanceAdmin: false,
    },
    tenantMembers: [],
    tenants: [mockTenants[0] ?? { role: 'MEMBER', tenant: { id: 'tenant-001', name: 'Acme Marketing' } }],
  },
};

const emptyStats: DashboardStats = {
  projects: 0,
  prompts: 0,
  analysesCompleted: 0,
  averageScore: null,
  promptsLast7Days: 0,
  scoreTrend: [],
  modelDistribution: [],
  projectDistribution: [],
};

function buildMockStats(prompts: PromptListResponse['items']): DashboardStats {
  const completed = prompts.filter((prompt) => prompt.analysis?.status === 'COMPLETED' && prompt.analysis.score !== null);
  const totalScore = completed.reduce((sum, prompt) => sum + (prompt.analysis?.score ?? 0), 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1_000;
  const last7Score = prompts.filter(
    (prompt) => new Date(prompt.occurredAt).getTime() >= weekAgo,
  ).length;
  const modelDistribution = Object.entries(
    prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.model] = (acc[prompt.model] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ name, count }));
  const projectDistribution = Object.entries(
    prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.projectName] = (acc[prompt.projectName] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ name, count }));
  const scoreByDay = prompts
    .filter((prompt) => prompt.analysis?.status === 'COMPLETED' && prompt.analysis.score !== null)
    .map((prompt) => ({ date: prompt.occurredAt.slice(0, 10), score: prompt.analysis?.score ?? 0 }));
  return {
    projects: new Set(prompts.map((prompt) => prompt.projectId)).size,
    prompts: prompts.length,
    analysesCompleted: completed.length,
    averageScore: completed.length ? Math.round((totalScore / completed.length) * 10) / 10 : null,
    promptsLast7Days: last7Score,
    scoreTrend: scoreByDay,
    modelDistribution,
    projectDistribution,
  };
}

function stripMockPromptOwner(prompt: MockPromptRow): PromptListResponse['items'][number] {
  const { ownerId, ...rest } = prompt;
  return rest;
}

function promptListMatchesFilter(
  prompt: MockPromptRow,
  options: {
    tenantAdmin: boolean;
    projectFilter: string;
    platformFilter: string;
    modelFilter: string;
    query: string;
    minScoreFilter: string;
    memberFilter: string;
  },
) {
  const loweredQuery = options.query.trim().toLowerCase();
  const score = prompt.analysis?.score;
  if (loweredQuery && !prompt.content.toLowerCase().includes(loweredQuery)) return false;
  if (options.projectFilter && prompt.projectId !== options.projectFilter) return false;
  if (options.platformFilter && !prompt.platform.toLowerCase().includes(options.platformFilter.toLowerCase()))
    return false;
  if (options.modelFilter && !prompt.model.toLowerCase().includes(options.modelFilter.toLowerCase()))
    return false;
  if (options.minScoreFilter) {
    const minScore = Number(options.minScoreFilter);
    if (Number.isNaN(minScore)) return false;
    if (score === null || score === undefined || score < minScore) return false;
  }
  if (options.tenantAdmin && options.memberFilter && prompt.ownerId !== options.memberFilter) return false;
  return true;
}

function currentSection(pathname: string | null): DashboardSection {
  if (!pathname) return 'overview';
  if (pathname.endsWith('/prompts')) return 'prompts';
  if (pathname.endsWith('/projects')) return 'projects';
  return 'overview';
}

function isTenantAdmin(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function DashboardClient() {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoMode = searchParams.get('mock') === '1' || searchParams.get('demo') === '1';
  const mockProfile = searchParams.get('mockRole') === 'user' ? 'USER' : 'OWNER';
  const mockConfig = demoMode ? mockUsers[mockProfile] : emptyMockMode;

  const [actor, setActor] = useState<ActorContext | null>(null);
  const [stats, setStats] = useState(emptyStats);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [prompts, setPrompts] = useState<PromptListResponse['items']>([]);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [tenantMembers, setTenantMembers] = useState<MemberOption[]>([]);
  const [tenants, setTenants] = useState<
    Array<{ role: string; tenant: { id: string; name: string } }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<
    Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>
  >([]);

  useEffect(() => {
    if (!demoMode) {
      let active = true;
      void apiRequest<ActorContext>('/auth/session')
        .then((nextActor) => {
          if (!active) return;
          setActor(nextActor);
        })
        .catch(() => {
          if (!active) return;
          router.push('/login');
        });
      return () => {
        active = false;
      };
    }

    setActor(mockConfig.actor);
    setError(null);
    return undefined;
  }, [demoMode, mockConfig.actor, router]);

  const promptParameters = useCallback(() => {
    const parameters = new URLSearchParams();
    if (!actor) return parameters;

    const tenantAdmin = isTenantAdmin(actor.role);
    if (query) parameters.set('q', query);
    if (projectFilter) parameters.set('projectId', projectFilter);
    if (platformFilter) parameters.set('platform', platformFilter);
    if (modelFilter) parameters.set('model', modelFilter);
    if (minScoreFilter) parameters.set('minScore', minScoreFilter);
    if (!tenantAdmin) parameters.set('mine', 'true');
    if (tenantAdmin && memberFilter) parameters.set('userId', memberFilter);
    return parameters;
  }, [actor, query, projectFilter, platformFilter, modelFilter, minScoreFilter, memberFilter]);

  const mockRows = useCallback(() => {
    if (!demoMode || !actor) return [];
    const isAdmin = isTenantAdmin(actor.role);
    const scope = isAdmin ? mockPrompts : mockPrompts.filter((prompt) => prompt.ownerId === actor.userId);

    return scope
      .filter((prompt) =>
        promptListMatchesFilter(prompt, {
          tenantAdmin: isAdmin,
          projectFilter,
          platformFilter,
          modelFilter,
          query,
          minScoreFilter,
          memberFilter,
        }),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map(stripMockPromptOwner);
  }, [actor, demoMode, modelFilter, minScoreFilter, memberFilter, projectFilter, query]);

  useEffect(() => {
    if (!demoMode || !actor) return;
    const rows = mockRows();
    setStats(buildMockStats(rows));
    setProjects(mockProjects);
    setPrompts(rows);
    setTenants(mockConfig.tenants);
    setSessions(mockSessions);
    setTenantMembers(mockConfig.tenantMembers);
    setError(null);
  }, [actor, demoMode, mockConfig.tenants, mockConfig.tenantMembers, mockRows]);

  const load = useCallback(async () => {
    if (!actor) return;
    if (demoMode) {
      const rows = mockRows();
      setStats(buildMockStats(rows));
      setProjects(mockProjects);
      setPrompts(rows);
      setTenants(mockConfig.tenants);
      setSessions(mockSessions);
      setTenantMembers(mockConfig.tenantMembers);
      setError(null);
      return;
    }
    const tenantAdmin = isTenantAdmin(actor.role);
    const scope = tenantAdmin ? 'tenant' : 'mine';
    const parameters = promptParameters();
    try {
      const [nextStats, nextProjects, nextPrompts, nextTenants, nextSessions, nextMembers] =
        await Promise.all([
          apiRequest<DashboardStats>(`/dashboard/stats?scope=${scope}`),
          apiRequest<ProjectResponse[]>('/projects'),
          apiRequest<PromptListResponse>(
            `/prompts${parameters.size ? `?${parameters.toString()}` : ''}`,
          ),
          apiRequest<Array<{ role: string; tenant: { id: string; name: string } }>>('/auth/tenants'),
          apiRequest<
            Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>
          >('/auth/sessions'),
          tenantAdmin ? apiRequest<AdminMember[]>('/admin/members') : Promise.resolve([] as AdminMember[]),
        ]);

      setStats(nextStats);
      setProjects(nextProjects);
      setPrompts(nextPrompts.items);
      setTenants(nextTenants);
      setSessions(nextSessions);
      setTenantMembers(
        tenantAdmin
          ? nextMembers
              .map((member) => ({
                id: member.user.id,
                displayName: member.user.displayName,
                email: member.user.email,
              }))
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
          : [],
      );
      setError(null);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Dashboard could not be loaded.';
      setError(message);
      if (/Authentication|required|Session/i.test(message)) router.push('/login');
    }
  }, [actor, demoMode, mockConfig.tenants, mockConfig.tenantMembers, mockRows, promptParameters, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    if (!name) return;
    if (demoMode) {
      setProjects((current) => [
        ...current,
        {
          id: `project-${Date.now()}`,
          name,
          description: description || null,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
      form.reset();
      return;
    }
    await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: data.get('name'), description: data.get('description') }),
    });
    form.reset();
    await load();
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demoMode) return;
    await load();
  }

  async function toggleProject(projectId: string, archived: boolean) {
    if (demoMode) {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? { ...project, status: archived ? 'ACTIVE' : 'ARCHIVED', updatedAt: new Date().toISOString() }
            : project,
        ),
      );
      return;
    }
    await apiRequest(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived }),
    });
    await load();
  }

  async function logout() {
    if (demoMode) {
      setActor(mockConfig.actor);
      return;
    }
    await apiRequest('/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function switchTenant(tenantId: string) {
    if (demoMode) return;
    await apiRequest('/auth/tenant/switch', { method: 'POST', body: JSON.stringify({ tenantId }) });
    window.location.reload();
  }

  async function download(format: 'json' | 'csv') {
    if (demoMode) {
      const timestamp = new Date().toISOString();
      const filename = `promptlens-mock-${timestamp}.${format}`;
      const payload =
        format === 'json'
          ? JSON.stringify({ prompts }, null, 2)
          : ['id,project,platform,model,score,content', ...prompts.map((prompt) => `${prompt.id},"${prompt.projectName}","${prompt.platform}","${prompt.model}",${prompt.analysis?.score ?? ''},"${(prompt.content ?? '').replaceAll('"', '""')}"`)].join('\r\n');
      const blob = new Blob([payload], {
        type: format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    const parameters = promptParameters();
    parameters.set('format', format);
    const { blob, filename } = await apiDownload(
      `/prompt-exports${parameters.toString() ? `?${parameters.toString()}` : ''}`,
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function reanalyze(promptId: string) {
    if (demoMode) return;
    await apiRequest(`/prompts/${promptId}/analyses`, { method: 'POST' });
    await load();
  }

  async function deletePrompt(promptId: string) {
    if (!window.confirm('Delete this prompt and hide it from all workspace views?')) return;
    if (demoMode) {
      setPrompts((current) => current.filter((item) => item.id !== promptId));
      setSelectedPromptId((current) => (current === promptId ? null : current));
      return;
    }
    await apiRequest(`/prompts/${promptId}`, { method: 'DELETE' });
    setSelectedPromptId(null);
    await load();
  }

  async function revokeSession(sessionId: string, current: boolean) {
    if (demoMode) {
      if (current) {
        setSessions([]);
        setActor(mockConfig.actor);
      } else {
        setSessions((currentSessions) => currentSessions.filter((session) => session.id !== sessionId));
      }
      return;
    }
    if (!window.confirm(current ? 'Sign out this current session?' : 'Revoke this session?'))
      return;
    await apiRequest(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    if (current) router.push('/login');
    else await load();
  }

  const actorRole = actor?.role ?? '';
  const adminLinksVisible = isTenantAdmin(actorRole);
  const tenantAdmin = actor ? isTenantAdmin(actor.role) : false;
  const needsAttention = prompts.filter((prompt) => {
    const score = prompt.analysis?.score;
    return prompt.analysis?.status === 'FAILED' || (score !== null && score !== undefined && score < 75);
  });
  const overviewTitle = tenantAdmin
    ? 'Where is your team getting stuck?'
    : 'What should you improve next?';
  const navItems = [
    { href: '/dashboard/overview', label: 'Overview' },
    { href: '/dashboard/prompts', label: 'Prompt log' },
    { href: '/dashboard/projects', label: 'Projects' },
    { href: '/connect', label: 'Connect device' },
  ];
  if (adminLinksVisible) navItems.push({ href: '/admin', label: 'Administration' });
  const tenantSwitcher = tenants.length > 1 ? (
    <label className="editorial-switch">
      Workspace
      <select
        aria-label="Active workspace"
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) void switchTenant(event.target.value);
        }}
      >
        <option value="" disabled>
          Switch workspace
        </option>
        {tenants.map(({ tenant, role }) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name} - {role}
          </option>
        ))}
      </select>
    </label>
  ) : null;
  const activeTenantName =
    tenants.find((entry) => entry.tenant.id === actor?.tenantId)?.tenant.name ?? 'Current workspace';
  const navLinkClass = (target: string) =>
    target === '/dashboard/overview' && pathname === '/dashboard'
      ? 'active'
      : pathname === target || pathname?.startsWith(`${target}/`)
        ? 'active'
        : '';
  const sectionTitle =
    section === 'prompts'
      ? 'Prompt history'
      : section === 'projects'
        ? 'Project control'
        : overviewTitle;
  const sectionCaption =
    section === 'prompts'
      ? 'Prompt analysis'
      : section === 'projects'
        ? 'Workspace'
        : 'Workspace intelligence';

  return (
    <div className="editorial-dashboard">
      <aside className="editorial-sidebar">
        <Link className="editorial-wordmark" href="/dashboard/overview">
          PromptLens
        </Link>
        {actor ? (
          <div className="editorial-tenant">
            <p className="editorial-kicker">Active workspace</p>
            <strong>{activeTenantName}</strong>
            <span>{actorRole.toLowerCase()}</span>
            <small className="editorial-id">Tenant {actor.tenantId.slice(0, 7)}</small>
          </div>
        ) : null}
        <nav aria-label="Main navigation" className="editorial-nav">
          {navItems.map((item) => (
            <Link className={`editorial-nav-link ${navLinkClass(item.href)}`} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        {tenantSwitcher}
        <button className="editorial-ghost" onClick={() => void logout()}>
          Sign out
        </button>
      </aside>
      <main className="editorial-main">
        <details className="mobile-navigation">
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">
            {navItems.map((item) => (
              <Link className={navLinkClass(item.href)} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            {tenantSwitcher}
          </nav>
        </details>
        <header className="editorial-header">
          <div className="editorial-header-copy">
            <p className="editorial-kicker">{sectionCaption}</p>
            <div className="editorial-header-title">
              <h1>{sectionTitle}</h1>
              <span className="editorial-mode-dot" aria-hidden="true" />
            </div>
            <p className="editorial-subline">
              {section === 'overview'
                ? 'Signals from your workspace, in one controlled view.'
                : section === 'prompts'
                  ? 'Read, filter, and improve every prompt.'
                  : 'Organize work by projects and status.'}
            </p>
          </div>
          <div className="editorial-hero-ribbon" aria-hidden="true">
            <span>Live workspace control plane</span>
            <span>â—</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="editorial-metadata">
            {demoMode ? <span className="editorial-chip editorial-chip-demo">Demo dataset</span> : null}
            <span className="editorial-chip">Session {actor?.sessionId?.slice(0, 8) ?? 'offline'}</span>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {section === 'overview' ? (
          <>
            <section className="editorial-kpi-grid" aria-label="Workspace statistics">
              <article className="editorial-kpi">
                <p>Average score</p>
                <strong>
                  {stats.averageScore ?? 'N/A'}
                  <small>/100</small>
                </strong>
              </article>
              <article className="editorial-kpi">
                <p>Prompts</p>
                <strong>{stats.prompts}</strong>
              </article>
              <article className="editorial-kpi">
                <p>Last 7 days</p>
                <strong>{stats.promptsLast7Days}</strong>
              </article>
              <article className="editorial-kpi">
                <p>Analyses</p>
                <strong>{stats.analysesCompleted}</strong>
              </article>
            </section>
            <section className="editorial-panels" aria-label="Prompt analytics">
              <article className="editorial-panel editorial-attention">
                <p className="editorial-kicker">Action queue</p>
                <h2>Needs attention</h2>
                {needsAttention.length ? (
                  <ol className="editorial-stat-list">
                    {needsAttention.map((prompt) => (
                      <li key={prompt.id}>
                        <span>{prompt.projectName}: {prompt.content}</span>
                        <strong>{prompt.analysis?.status === 'FAILED' ? 'Failed' : prompt.analysis?.score}</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="editorial-empty">No weak or failed prompts right now.</p>
                )}
              </article>
              {tenantAdmin ? <Distribution title="Project performance" items={stats.projectDistribution} compact /> : null}
              {tenantAdmin ? (
                <article className="editorial-panel editorial-panel-compact">
                  <p className="editorial-kicker">Team view</p>
                  <h2>People performance</h2>
                  {tenantMembers.length ? (
                    <ol className="editorial-stat-list">
                      {tenantMembers.map((member) => (
                        <li key={member.id}>
                          <span>{member.displayName}</span>
                          <strong>{member.email}</strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="editorial-empty">No people in this workspace yet.</p>
                  )}
                </article>
              ) : null}
            </section>
            <section className="editorial-panel">
              <p className="editorial-kicker">Active sessions</p>
              <h2>Security</h2>
              <div className="editorial-session-grid">
                {sessions.map((session) => (
                  <article className="editorial-session-card" key={session.id}>
                    <div>
                      <h3>{session.current ? 'Current session' : 'Signed-in device'}</h3>
                      <p>{session.userAgent ?? 'Unknown client'}</p>
                      <small>{new Date(session.createdAt).toLocaleString()}</small>
                    </div>
                    <button
                      className="editorial-danger"
                      type="button"
                      onClick={() => void revokeSession(session.id, session.current)}
                    >
                      {session.current ? 'Sign out' : 'Revoke'}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
        {section === 'prompts' ? (
          <section className="editorial-panel" id="prompts">
            <div className="editorial-panel-head">
              <div>
                <p className="editorial-kicker">Prompt log</p>
                <h2>Recent prompts</h2>
              </div>
              <span className="editorial-chip">Total: {prompts.length}</span>
            </div>
            <form className="editorial-filter-bar" onSubmit={search}>
              <input
                aria-label="Search prompts"
                placeholder="Search prompt content"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                aria-label="Filter by project"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {adminLinksVisible ? (
                <select
                  aria-label="Filter by user"
                  value={memberFilter}
                  onChange={(event) => {
                    const next = event.target.value;
                    setMemberFilter(next);
                    void load();
                  }}
                >
                  <option value="">All users</option>
                  {tenantMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.displayName} - {member.email}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                aria-label="Filter by platform"
                placeholder="Platform"
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value)}
                maxLength={80}
              />
              <input
                aria-label="Filter by model"
                placeholder="Model"
                value={modelFilter}
                onChange={(event) => setModelFilter(event.target.value)}
                maxLength={160}
              />
              <input
                aria-label="Minimum score"
                type="number"
                min="0"
                max="100"
                placeholder="Min score"
                value={minScoreFilter}
                onChange={(event) => setMinScoreFilter(event.target.value)}
              />
              <button className="editorial-chip" type="submit">
                Search
              </button>
            </form>
            <div className="editorial-export-strip">
              <button className="editorial-ghost" type="button" onClick={() => void download('json')}>
                Export JSON
              </button>
              <button className="editorial-ghost" type="button" onClick={() => void download('csv')}>
                Export CSV
              </button>
            </div>
            <div className="editorial-prompts">
              {prompts.length === 0 ? (
                <p className="editorial-empty">No prompts yet. Connect a device to start syncing.</p>
              ) : (
                prompts.map((prompt) => {
                  const status = (prompt.analysis?.status ?? 'QUEUED').toLowerCase();
                  return (
                    <article className="editorial-prompt-card" key={prompt.id}>
                      <div className="editorial-score">{prompt.analysis?.score ?? '--'}</div>
                      <div className="editorial-prompt-copy">
                        <p>{prompt.content}</p>
                        <div className="editorial-chip-row">
                          <span className="editorial-mini-chip">{prompt.projectName}</span>
                          <span className="editorial-mini-chip">{prompt.platform}</span>
                          <span className="editorial-mini-chip">{prompt.model}</span>
                        </div>
                        <small className="editorial-prompt-meta">
                          {new Date(prompt.occurredAt).toLocaleString()} <span>{prompt.analysis?.status ?? 'Queued'}</span>
                        </small>
                      </div>
                      <div className="editorial-prompt-actions">
                        <span className={`editorial-status editorial-status-${status}`}>{prompt.analysis?.status ?? 'QUEUED'}</span>
                        <button
                          className="editorial-action"
                          type="button"
                          aria-expanded={selectedPromptId === prompt.id}
                          onClick={() => setSelectedPromptId(selectedPromptId === prompt.id ? null : prompt.id)}
                        >
                          {selectedPromptId === prompt.id ? 'Hide analysis' : 'View analysis'}
                        </button>
                        <button className="editorial-danger" type="button" onClick={() => void deletePrompt(prompt.id)}>
                          Delete
                        </button>
                      </div>
                      {selectedPromptId === prompt.id ? (
                        <div className="editorial-analysis">
                          <section>
                            <h3>Strengths</h3>
                            {prompt.analysis?.strengths.length ? (
                              <ul>
                                {prompt.analysis.strengths.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="editorial-empty">No strengths recorded yet.</p>
                            )}
                          </section>
                          <section>
                            <h3>Missing or weak</h3>
                            {prompt.analysis?.weaknesses.length ? (
                              <ul>
                                {prompt.analysis.weaknesses.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="editorial-empty">No gaps identified.</p>
                            )}
                          </section>
                          <section className="editorial-suggestions">
                            <div className="editorial-section-title">
                              <div>
                                <p className="editorial-kicker">Action plan</p>
                                <h3>Recommendations</h3>
                              </div>
                              <span className="editorial-chip">{prompt.analysis?.suggestions.length ?? 0}</span>
                            </div>
                            {prompt.analysis?.suggestions.length ? (
                              <ul>
                                {prompt.analysis.suggestions.map((item, index) => (
                                  <li key={item}>
                                    <span className="editorial-bullet">{index + 1}</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="editorial-empty">No recommendations available yet.</p>
                            )}
                          </section>
                          <section>
                            <h3>Improved prompt</h3>
                            <pre>{prompt.analysis?.improvedPrompt ?? 'Analysis is still running.'}</pre>
                            {prompt.analysis?.improvedPrompt ? (
                              <button
                                className="editorial-action"
                                type="button"
                                onClick={() => void navigator.clipboard.writeText(prompt.analysis?.improvedPrompt ?? '')}
                              >
                                Copy improved prompt
                              </button>
                            ) : null}
                            <button className="editorial-action" type="button" onClick={() => void reanalyze(prompt.id)}>
                              Run analysis again
                            </button>
                          </section>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        ) : null}
        {section === 'projects' ? (
          <section className="editorial-panel">
            <div className="editorial-panel-head">
              <div>
                <p className="editorial-kicker">Organization</p>
                <h2>Projects</h2>
              </div>
            </div>
            <div className="editorial-project-grid">
              {projects.map((project) => (
                <article className="editorial-project-card" key={project.id}>
                  <h3>{project.name}</h3>
                  <p>{project.description ?? 'No description'}</p>
                  <span className={`editorial-mini-chip ${project.status.toLowerCase()}`}>{project.status}</span>
                  <button
                    className="editorial-action"
                    type="button"
                    onClick={() => void toggleProject(project.id, project.status !== 'ARCHIVED')}
                  >
                    {project.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                  </button>
                </article>
              ))}
            </div>
            <form className="editorial-inline-form" onSubmit={createProject}>
              <input name="name" placeholder="New project name" required maxLength={120} />
              <input name="description" placeholder="Description" maxLength={1000} />
              <button type="submit" className="editorial-chip">
                Create project
              </button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Distribution({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
  compact?: boolean;
}) {
  return (
    <div className={`editorial-panel ${compact ? 'editorial-panel-compact' : ''}`}>
      <p className="editorial-kicker">Distribution</p>
      <h2>{title}</h2>
      {items.length ? (
        <ol className="editorial-stat-list">
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="editorial-empty">No data yet.</p>
      )}
    </div>
  );
}





