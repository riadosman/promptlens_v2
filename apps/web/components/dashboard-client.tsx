'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardStats, ProjectResponse, PromptListResponse } from '@promptlens/contracts';
import { apiDownload, apiRequest } from '../lib/api';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';

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
      suggestions: [
        'Add explicit rollout date',
        'Mention migration checklist',
        'Keep one CTA only',
      ],
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
    tenants: [
      mockTenants[0] ?? { role: 'MEMBER', tenant: { id: 'tenant-001', name: 'Acme Marketing' } },
    ],
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
  const completed = prompts.filter(
    (prompt) => prompt.analysis?.status === 'COMPLETED' && prompt.analysis.score !== null,
  );
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
    .map((prompt) => ({
      date: prompt.occurredAt.slice(0, 10),
      score: prompt.analysis?.score ?? 0,
    }));
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
  if (
    options.platformFilter &&
    !prompt.platform.toLowerCase().includes(options.platformFilter.toLowerCase())
  )
    return false;
  if (
    options.modelFilter &&
    !prompt.model.toLowerCase().includes(options.modelFilter.toLowerCase())
  )
    return false;
  if (options.minScoreFilter) {
    const minScore = Number(options.minScoreFilter);
    if (Number.isNaN(minScore)) return false;
    if (score === null || score === undefined || score < minScore) return false;
  }
  if (options.tenantAdmin && options.memberFilter && prompt.ownerId !== options.memberFilter)
    return false;
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
  const [promptPage, setPromptPage] = useState(1);
  const promptsPerPage = 8;
  const promptPageCount = Math.max(1, Math.ceil(prompts.length / promptsPerPage));
  const visiblePrompts = prompts.slice(
    (promptPage - 1) * promptsPerPage,
    promptPage * promptsPerPage,
  );
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
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sessions, setSessions] = useState<
    Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>
  >([]);
  const [sessionsPage, setSessionsPage] = useState(1);
  const sessionsPerPage = 3;
  const sessionsPageCount = Math.max(1, Math.ceil(sessions.length / sessionsPerPage));
  const visibleSessions = sessions.slice(
    (sessionsPage - 1) * sessionsPerPage,
    sessionsPage * sessionsPerPage,
  );

  useEffect(() => {
    setSessionsPage((page) => Math.min(page, sessionsPageCount));
  }, [sessionsPageCount]);

  useEffect(() => {
    setPromptPage((page) => Math.min(page, promptPageCount));
  }, [promptPageCount]);

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
    setSectionLoading(false);
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
    const scope = isAdmin
      ? mockPrompts
      : mockPrompts.filter((prompt) => prompt.ownerId === actor.userId);

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
    setSectionLoading(true);
    const startedAt = Date.now();
    try {
      if (demoMode) {
        const rows = mockRows();
        setStats(buildMockStats(rows));
        setProjects(mockProjects);
        setPrompts(rows);
        setTenants(mockConfig.tenants);
        setSessions(mockSessions);
        setTenantMembers(mockConfig.tenantMembers);
        setError(null);
      } else {
        const tenantAdmin = isTenantAdmin(actor.role);
        const scope = tenantAdmin ? 'tenant' : 'mine';
        const parameters = promptParameters();
        const [nextStats, nextProjects, nextPrompts, nextTenants, nextSessions, nextMembers] =
          await Promise.all([
            apiRequest<DashboardStats>(`/dashboard/stats?scope=${scope}`),
            apiRequest<ProjectResponse[]>('/projects'),
            apiRequest<PromptListResponse>(
              `/prompts${parameters.size ? `?${parameters.toString()}` : ''}`,
            ),
            apiRequest<Array<{ role: string; tenant: { id: string; name: string } }>>(
              '/auth/tenants',
            ),
            apiRequest<
              Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>
            >('/auth/sessions'),
            tenantAdmin
              ? apiRequest<AdminMember[]>('/admin/members')
              : Promise.resolve([] as AdminMember[]),
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
      }
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Dashboard could not be loaded.';
      setError(message);
      if (/Authentication|required|Session/i.test(message)) router.push('/login');
    } finally {
      const minDelayMs = 420;
      const elapsed = Date.now() - startedAt;
      if (elapsed < minDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, minDelayMs - elapsed));
      }
      setSectionLoading(false);
    }
  }, [
    actor,
    demoMode,
    mockConfig.tenants,
    mockConfig.tenantMembers,
    mockRows,
    promptParameters,
    router,
    section,
  ]);

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
    setPromptPage(1);
    if (demoMode) return;
    await load();
  }

  async function toggleProject(projectId: string, archived: boolean) {
    if (demoMode) {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                status: archived ? 'ACTIVE' : 'ARCHIVED',
                updatedAt: new Date().toISOString(),
              }
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
          : [
              'id,project,platform,model,score,content',
              ...prompts.map(
                (prompt) =>
                  `${prompt.id},"${prompt.projectName}","${prompt.platform}","${prompt.model}",${prompt.analysis?.score ?? ''},"${(prompt.content ?? '').replaceAll('"', '""')}"`,
              ),
            ].join('\r\n');
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
        setSessions((currentSessions) =>
          currentSessions.filter((session) => session.id !== sessionId),
        );
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
  const activeTenantName =
    tenants.find((entry) => entry.tenant.id === actor?.tenantId)?.tenant.name ??
    'Current workspace';
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
        : 'Signal command center';
  const sectionCaption =
    section === 'prompts'
      ? 'Prompt analysis'
      : section === 'projects'
        ? 'Workspace'
        : 'Workspace health';

  return (
    <div className="dashboard-shell-v2">
      <aside className="v2-rail">
        <Link className="v2-wordmark" href="/dashboard">
          PromptLens
        </Link>
        {actor ? (
          <div className="v2-panel v2-tenant">
            <p className="v2-kicker v2-tenant-kicker">Active workspace</p>
            <strong className="v2-tenant-name">{activeTenantName}</strong>
            <span className="v2-tenant-role">{actorRole.toUpperCase()}</span>
            <small className="v2-tenant-id v2-id">Tenant {actor.tenantId.slice(0, 7)}</small>
          </div>
        ) : null}
        <nav aria-label="Main navigation" className="v2-nav">
          <Link
            className={`v2-nav-link ${navLinkClass('/dashboard/overview')}`}
            href="/dashboard/overview"
          >
            Overview
          </Link>
          <Link
            className={`v2-nav-link ${navLinkClass('/dashboard/prompts')}`}
            href="/dashboard/prompts"
          >
            Prompt log
          </Link>
          <Link
            className={`v2-nav-link ${navLinkClass('/dashboard/projects')}`}
            href="/dashboard/projects"
          >
            Projects
          </Link>
          <Link
            className={`v2-nav-link ${pathname?.startsWith('/connect') ? 'active' : ''}`}
            href="/connect"
          >
            Connect device
          </Link>
          {adminLinksVisible ? (
            <Link
              className={`v2-nav-link ${pathname?.startsWith('/admin') ? 'active' : ''}`}
              href="/admin"
            >
              Administration
            </Link>
          ) : null}
        </nav>
        {tenants.length > 1 ? (
          <label className="v2-switch">
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
        ) : null}
        <button className="v2-ghost" onClick={() => void logout()}>
          Sign out
        </button>
      </aside>
      <main className="v2-main">
        <header className="v2-header">
          <div className="v2-header-copy">
            <p className="v2-kicker">{sectionCaption}</p>
            <div className="v2-header-title">
              <h1>{sectionTitle}</h1>
              <span className="v2-mode-dot" aria-hidden="true" />
            </div>
            <p className="v2-subline">
              {section === 'overview'
                ? 'Signals from your workspace, in one controlled view.'
                : section === 'prompts'
                  ? 'Read, filter, and improve every prompt.'
                  : 'Organize work by projects and status.'}
            </p>
          </div>
          <div className="v2-hero-ribbon" aria-hidden="true">
            <span>Live workspace control plane</span>
            <span>●</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="v2-metadata">
            {demoMode ? <span className="v2-chip v2-chip-demo">Demo dataset</span> : null}
            <span className="v2-chip">Session {actor?.sessionId?.slice(0, 8) ?? 'offline'}</span>
          </div>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        {section === 'overview' ? (
          <section className="v2-overview-welcome" aria-labelledby="overview-welcome-title">
            <div>
              <p className="v2-kicker">Workspace pulse</p>
              <h2 id="overview-welcome-title">Make your next prompt sharper.</h2>
              <p>See what is working, spot the gaps, and keep improving your team&apos;s AI practice.</p>
            </div>
            <div className="v2-overview-actions">
              <Link className="v2-primary-action" href="/dashboard/prompts">
                Review prompt log <span aria-hidden="true">→</span>
              </Link>
              <Link className="v2-secondary-action" href="/connect">
                Connect a device
              </Link>
            </div>
          </section>
        ) : null}
        {section === 'overview' ? (
          sectionLoading ? (
            <OverviewPanelSkeleton />
          ) : (
            <>
              <section className="v2-analytics-overview" aria-label="Prompt analytics">
                <div className="v2-analytics-score-panel v2-command-score">
                  <div className="v2-analytics-score-copy">
                    <p className="v2-kicker">Prompt health · last 30 days</p>
                    <h2>Signal quality</h2>
                    <strong>{stats.averageScore ?? 'N/A'}<small>/100</small></strong>
                    <span className="v2-score-change">Workspace average score</span>
                  </div>
                  <div className="v2-score-bar"><i style={{ width: `${stats.averageScore ?? 0}%` }} /></div>
                </div>
                <div className="v2-analytics-kpis v2-command-kpis">
                  <article><p>Prompts</p><strong>{stats.prompts}</strong><span>Total captured</span></article>
                  <article><p>Last 7 days</p><strong>{stats.promptsLast7Days}</strong><span>Recent activity</span></article>
                  <article><p>Analyses</p><strong>{stats.analysesCompleted}</strong><span>Completed reviews</span></article>
                </div>
                <article className="v2-analytics-chart v2-panel v2-command-trend">
                  <div className="v2-panel-head"><div><p className="v2-kicker">Performance</p><h2>Score trend</h2></div><span className="v2-chip">Last 14 days</span></div>
                  {stats.scoreTrend.length ? (
                    <div className="v2-bar-chart" aria-label="Score trend chart">
                      {stats.scoreTrend.map((point) => <div key={point.date} style={{ height: `${Math.max(point.score, 8)}%` }}><span>{point.score}</span><i /></div>)}
                    </div>
                  ) : <p className="v2-empty">No completed analyses yet.</p>}
                </article>
                <div className="v2-analytics-insights v2-command-insights">
                  <Distribution title="Models" items={stats.modelDistribution} compact />
                  <Distribution title="Projects" items={stats.projectDistribution} compact />
                </div>
              </section>
              <section className="v2-panel v2-activity-panel">
                <div className="v2-panel-head">
                  <div>
                    <p className="v2-kicker">Workspace activity</p>
                    <h2>Recent sessions</h2>
                  </div>
                  <span className="v2-chip">{sessions.length} devices</span>
                </div>
                <div className="v2-session-grid">
                  {visibleSessions.map((session) => (
                    <article className="v2-session-card" key={session.id}>
                      <div>
                        <h3>{session.current ? 'Current session' : 'Signed-in device'}</h3>
                        <p>{session.userAgent ?? 'Unknown client'}</p>
                        <small>{new Date(session.createdAt).toLocaleString()}</small>
                      </div>
                      <button
                        className="v2-danger"
                        type="button"
                        onClick={() => void revokeSession(session.id, session.current)}
                      >
                        {session.current ? 'Sign out' : 'Revoke'}
                      </button>
                    </article>
                  ))}
                </div>
                <div className="v2-pagination" aria-label="Session pagination">
                  <span className="v2-pagination-label">Page <strong>{sessionsPage}</strong><span aria-hidden="true">/</span>{sessionsPageCount}</span>
                  <div>
                    <button
                      type="button"
                      aria-label="Previous sessions page"
                      disabled={sessionsPage === 1}
                      onClick={() => setSessionsPage((page) => Math.max(1, page - 1))}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label="Next sessions page"
                      disabled={sessionsPage === sessionsPageCount}
                      onClick={() => setSessionsPage((page) => Math.min(sessionsPageCount, page + 1))}
                    >
                      →
                    </button>
                  </div>
                </div>
              </section>
            </>
          )
        ) : null}
        {section === 'prompts' ? (
          sectionLoading ? (
            <PromptsPanelSkeleton />
          ) : (
            <section className="v2-panel" id="prompts">
              <div className="v2-panel-head">
                <div>
                  <p className="v2-kicker">Prompt log</p>
                  <h2>Recent prompts</h2>
                </div>
                <div className="v2-prompt-head-actions">
                  <Link className="v2-secondary-action" href="/connect">Connect a device <span aria-hidden="true">→</span></Link>
                  <span className="v2-chip">Total: {prompts.length}</span>
                </div>
              </div>
              <form className="v2-filter-bar" onSubmit={search}>
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
                <button className="v2-chip v2-search-button" type="submit" aria-label="Search prompts" title="Search prompts">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <circle cx="10.8" cy="10.8" r="5.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="m15.2 15.2 4.3 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </form>
              <div className="v2-export-strip">
                <button className="v2-ghost" type="button" onClick={() => void download('json')}>
                  Export JSON
                </button>
                <button className="v2-ghost" type="button" onClick={() => void download('csv')}>
                  Export CSV
                </button>
              </div>
              <div className="v2-prompt-table" role="table" aria-label="Prompt history">
                <div className="v2-prompt-table-head" role="row">
                  <span role="columnheader">Prompt</span>
                  <span role="columnheader">Score</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Project</span>
                  <span role="columnheader">Model</span>
                  <span role="columnheader">Time</span>
                  <span role="columnheader" aria-label="Actions" />
                </div>
                {prompts.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia>
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                          <path d="M7 5.5h10A1.5 1.5 0 0 1 18.5 7v10a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 17V7A1.5 1.5 0 0 1 7 5.5Z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="m8.5 9 2 2-2 2m3 2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </EmptyMedia>
                      <EmptyTitle>No prompts yet</EmptyTitle>
                      <EmptyDescription>Connect a device to start syncing prompts into this workspace.</EmptyDescription>
                    </EmptyHeader>
                      <EmptyContent />
                  </Empty>
                ) : (
                  visiblePrompts.map((prompt) => {
                    const status = (prompt.analysis?.status ?? 'QUEUED').toLowerCase();
                    return (
                      <article className="v2-prompt-row" role="row" key={prompt.id}>
                        <div className="v2-prompt-main" role="cell">
                          <p>{prompt.content}</p>
                        </div>
                        <div className={`v2-table-score v2-table-score-${prompt.analysis?.score == null ? 'empty' : prompt.analysis.score >= 80 ? 'high' : prompt.analysis.score >= 60 ? 'medium' : 'low'}`} role="cell">
                          {prompt.analysis?.score ?? '--'}
                        </div>
                        <div role="cell">
                          <span className={`v2-status v2-status-${status}`}>
                            {prompt.analysis?.status ?? 'QUEUED'}
                          </span>
                        </div>
                        <span className="v2-table-meta" role="cell">{prompt.projectName}</span>
                        <span className="v2-table-meta" role="cell">{prompt.model}</span>
                        <time className="v2-table-meta" role="cell" dateTime={prompt.occurredAt}>
                          {new Date(prompt.occurredAt).toLocaleDateString()}
                        </time>
                        <div className="v2-prompt-actions" role="cell">
                          <button
                            className="v2-action"
                            type="button"
                            aria-expanded={selectedPromptId === prompt.id}
                            onClick={() =>
                              setSelectedPromptId(selectedPromptId === prompt.id ? null : prompt.id)
                            }
                          >
                            {selectedPromptId === prompt.id ? 'Hide analysis' : 'View analysis'}
                          </button>
                          <button
                            className="v2-danger"
                            type="button"
                            onClick={() => void deletePrompt(prompt.id)}
                          >
                            Delete
                          </button>
                        </div>
                        {selectedPromptId === prompt.id ? (
                          <div className="v2-analysis">
                            <section>
                              <h3>Strengths</h3>
                              {prompt.analysis?.strengths.length ? (
                                <ul>
                                  {prompt.analysis.strengths.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="v2-empty">No strengths recorded yet.</p>
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
                                <p className="v2-empty">No gaps identified.</p>
                              )}
                            </section>
                            <section className="v2-suggestions">
                              <div className="v2-section-title">
                                <div>
                                  <p className="v2-kicker">Action plan</p>
                                  <h3>Recommendations</h3>
                                </div>
                                <span className="v2-chip">
                                  {prompt.analysis?.suggestions.length ?? 0}
                                </span>
                              </div>
                              {prompt.analysis?.suggestions.length ? (
                                <ul>
                                  {prompt.analysis.suggestions.map((item, index) => (
                                    <li key={item}>
                                      <span className="v2-bullet">{index + 1}</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="v2-empty">No recommendations available yet.</p>
                              )}
                            </section>
                            <section>
                              <h3>Improved prompt</h3>
                              <pre>
                                {prompt.analysis?.improvedPrompt ?? 'Analysis is still running.'}
                              </pre>
                              {prompt.analysis?.improvedPrompt ? (
                                <button
                                  className="v2-action"
                                  type="button"
                                  onClick={() =>
                                    void navigator.clipboard.writeText(
                                      prompt.analysis?.improvedPrompt ?? '',
                                    )
                                  }
                                >
                                  Copy improved prompt
                                </button>
                              ) : null}
                              <button
                                className="v2-action"
                                type="button"
                                onClick={() => void reanalyze(prompt.id)}
                              >
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
              <div className="v2-pagination v2-prompt-pagination" aria-label="Prompt pagination">
                <span className="v2-pagination-label">Page <strong>{promptPage}</strong><span aria-hidden="true">/</span>{promptPageCount}</span>
                <div>
                  <button type="button" aria-label="Previous prompts page" disabled={promptPage === 1} onClick={() => setPromptPage((page) => Math.max(1, page - 1))}>←</button>
                  <button type="button" aria-label="Next prompts page" disabled={promptPage === promptPageCount} onClick={() => setPromptPage((page) => Math.min(promptPageCount, page + 1))}>→</button>
                </div>
              </div>
            </section>
          )
        ) : null}
        {section === 'projects' ? (
          sectionLoading ? (
            <ProjectsPanelSkeleton />
          ) : (
            <section className="v2-panel">
              <div className="v2-panel-head">
                <div>
                  <p className="v2-kicker">Organization</p>
                  <h2>Projects</h2>
                </div>
              </div>
              <div className="v2-project-grid">
                {projects.map((project) => (
                  <article className="v2-project-card" key={project.id}>
                    <h3>{project.name}</h3>
                    <p>{project.description ?? 'No description'}</p>
                    <span className={`v2-mini-chip ${project.status.toLowerCase()}`}>
                      {project.status}
                    </span>
                    <button
                      className="v2-action"
                      type="button"
                      onClick={() => void toggleProject(project.id, project.status !== 'ARCHIVED')}
                    >
                      {project.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                    </button>
                  </article>
                ))}
              </div>
              <form className="v2-inline-form" onSubmit={createProject}>
                <input name="name" placeholder="New project name" required maxLength={120} />
                <input name="description" placeholder="Description" maxLength={1000} />
                <button type="submit" className="v2-chip">
                  Create project
                </button>
              </form>
            </section>
          )
        ) : null}
      </main>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <article className="v2-project-card v2-project-card-skeleton">
      <h3>
        <span className="v2-skeleton v2-skeleton-title" />
      </h3>
      <p>
        <span className="v2-skeleton v2-skeleton-line" />
      </p>
      <span className="v2-skeleton v2-skeleton-chip" />
      <span className="v2-skeleton v2-skeleton-button" />
    </article>
  );
}

function PromptRowSkeleton() {
  return (
    <article className="v2-prompt-card">
      <span className="v2-skeleton v2-skeleton-score" />
      <div className="v2-prompt-copy">
        <p>
          <span className="v2-skeleton v2-skeleton-line" />
        </p>
        <div className="v2-chip-row">
          <span className="v2-skeleton v2-skeleton-chip" style={{ width: '4.9rem' }} />
          <span className="v2-skeleton v2-skeleton-chip" style={{ width: '3.9rem' }} />
          <span className="v2-skeleton v2-skeleton-chip" style={{ width: '3.2rem' }} />
        </div>
        <small className="v2-prompt-meta">
          <span className="v2-skeleton v2-skeleton-line" style={{ width: '62%' }} />
        </small>
      </div>
      <div className="v2-prompt-actions">
        <span
          className="v2-skeleton v2-skeleton-line"
          style={{ width: '5.4rem', height: '1.8rem' }}
        />
        <span
          className="v2-skeleton v2-skeleton-line"
          style={{ width: '6.1rem', height: '1.8rem' }}
        />
      </div>
    </article>
  );
}

function PromptsPanelSkeleton() {
  return (
    <section className="v2-panel" id="prompts">
      <div className="v2-panel-head">
        <div>
          <p className="v2-kicker">
            <span className="v2-skeleton v2-skeleton-line" style={{ width: '7.5rem' }} />
          </p>
          <h2>
            <span className="v2-skeleton v2-skeleton-title" style={{ width: '10rem' }} />
          </h2>
        </div>
        <span className="v2-skeleton v2-skeleton-line" style={{ width: '6rem' }} />
      </div>
      <div className="v2-filter-bar">
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-input" />
      </div>
      <div className="v2-export-strip">
        <span className="v2-skeleton v2-skeleton-button" style={{ width: '8rem' }} />
        <span className="v2-skeleton v2-skeleton-button" style={{ width: '8rem' }} />
      </div>
      <div className="v2-prompts">
        {Array.from({ length: 4 }).map((_, index) => (
          <PromptRowSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

function ProjectsPanelSkeleton() {
  return (
    <section className="v2-panel">
      <div className="v2-panel-head">
        <div>
          <p className="v2-kicker">
            <span className="v2-skeleton v2-skeleton-line" style={{ width: '6.4rem' }} />
          </p>
          <h2>
            <span className="v2-skeleton v2-skeleton-title" style={{ width: '7rem' }} />
          </h2>
        </div>
        <span className="v2-skeleton v2-skeleton-line" style={{ width: '6.5rem' }} />
      </div>
      <div className="v2-project-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <ProjectCardSkeleton key={index} />
        ))}
      </div>
      <div className="v2-inline-form">
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-input" />
        <span className="v2-skeleton v2-skeleton-button" style={{ minWidth: '8.5rem' }} />
      </div>
    </section>
  );
}

function DistributionPanelSkeleton() {
  return (
    <article className="v2-panel v2-panel-compact">
      <p className="v2-kicker">
        <span className="v2-skeleton v2-skeleton-line" style={{ width: '44%' }} />
      </p>
      <h2>
        <span className="v2-skeleton v2-skeleton-title" />
      </h2>
      <ol className="v2-stat-list">
        {Array.from({ length: 3 }).map((_, index) => (
          <li key={index}>
            <span>
              <span className="v2-skeleton v2-skeleton-line" />
            </span>
            <strong>
              <span className="v2-skeleton v2-skeleton-line" style={{ width: '1.75rem' }} />
            </strong>
          </li>
        ))}
      </ol>
    </article>
  );
}

function OverviewPanelSkeleton() {
  return (
    <>
      <section className="v2-kpi-grid" aria-label="Loading workspace statistics">
        {Array.from({ length: 4 }).map((_, index) => (
          <article className="v2-kpi" key={index}>
            <p>
              <span
                className="v2-skeleton v2-skeleton-title"
                style={{ width: index === 0 ? '58%' : '42%' }}
              />
            </p>
            <strong>
              <span className="v2-skeleton v2-skeleton-title" style={{ width: '58%' }} />
            </strong>
          </article>
        ))}
      </section>
      <section className="v2-panels" aria-label="Loading prompt analytics">
        <article className="v2-panel">
          <p className="v2-kicker">
            <span className="v2-skeleton v2-skeleton-line" style={{ width: '35%' }} />
          </p>
          <h2>
            <span className="v2-skeleton v2-skeleton-title" />
          </h2>
          <ol className="v2-stat-list">
            {Array.from({ length: 4 }).map((_, index) => (
              <li key={index}>
                <span>
                  <span
                    className="v2-skeleton v2-skeleton-line"
                    style={{ width: `${65 - index * 4}%` }}
                  />
                </span>
                <strong>
                  <span className="v2-skeleton v2-skeleton-line" style={{ width: '2rem' }} />
                </strong>
              </li>
            ))}
          </ol>
        </article>
        <DistributionPanelSkeleton />
        <DistributionPanelSkeleton />
      </section>
      <section className="v2-panel">
        <p className="v2-kicker">
          <span className="v2-skeleton v2-skeleton-line" style={{ width: '38%' }} />
        </p>
        <h2>
          <span className="v2-skeleton v2-skeleton-title" />
        </h2>
        <div className="v2-session-grid">
          {Array.from({ length: 2 }).map((_, index) => (
            <article className="v2-session-card" key={index}>
              <div>
                <h3>
                  <span className="v2-skeleton v2-skeleton-title" style={{ width: '58%' }} />
                </h3>
                <p>
                  <span className="v2-skeleton v2-skeleton-line" />
                </p>
                <small>
                  <span className="v2-skeleton v2-skeleton-line" />
                </small>
              </div>
              <span
                className="v2-skeleton v2-skeleton-line"
                style={{ width: '5.5rem', height: '1.95rem' }}
              />
            </article>
          ))}
        </div>
      </section>
    </>
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
    <div className={`v2-panel ${compact ? 'v2-panel-compact' : ''}`}>
      <p className="v2-kicker">Distribution</p>
      <h2>{title}</h2>
      {items.length ? (
        <ol className="v2-stat-list">
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="v2-empty">No data yet.</p>
      )}
    </div>
  );
}
