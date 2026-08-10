'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { DashboardStats, ProjectResponse, PromptListResponse } from '@promptlens/contracts';
import { apiDownload, apiRequest } from '../lib/api';
import { readDashboardUrlState, writeDashboardUrlState } from '../lib/dashboard-url';
import { WorkspaceSidebar } from './workspace-shell';

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

type PromptRow = PromptListResponse['items'][number];

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
    promptCount: 2,
    averageScore: 72,
    lowScoreCount: 1,
    lastActivityAt: relativeIsoDate(0.2),
  },
  {
    id: 'project-support',
    name: 'Support ops',
    description: 'Incident triage and customer support responses.',
    status: 'ACTIVE',
    createdAt: relativeIsoDate(120),
    updatedAt: relativeIsoDate(7),
    promptCount: 1,
    averageScore: null,
    lowScoreCount: 0,
    lastActivityAt: relativeIsoDate(1),
  },
  {
    id: 'project-ai',
    name: 'AI experimentation',
    description: 'Prompt experiments and optimization.',
    status: 'ARCHIVED',
    createdAt: relativeIsoDate(95),
    updatedAt: relativeIsoDate(30),
    promptCount: 1,
    averageScore: 54,
    lowScoreCount: 1,
    lastActivityAt: relativeIsoDate(2),
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
      score: 54,
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
  needsAttention: 0,
  analysesPending: 0,
  analysesFailed: 0,
  topWeaknesses: [],
  recentAttention: [],
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
  const actionable = prompts.filter((prompt) => {
    const analysis = prompt.analysis;
    return (
      analysis?.status === 'FAILED' ||
      (analysis?.status === 'COMPLETED' && (analysis.score ?? 100) < 60)
    );
  });
  const weaknessCounts = prompts.reduce<Record<string, number>>((acc, prompt) => {
    for (const weakness of prompt.analysis?.weaknesses ?? []) {
      acc[weakness] = (acc[weakness] ?? 0) + 1;
    }
    return acc;
  }, {});
  return {
    projects: new Set(prompts.map((prompt) => prompt.projectId)).size,
    prompts: prompts.length,
    analysesCompleted: completed.length,
    averageScore: completed.length ? Math.round((totalScore / completed.length) * 10) / 10 : null,
    promptsLast7Days: last7Score,
    scoreTrend: scoreByDay,
    modelDistribution,
    projectDistribution,
    needsAttention: actionable.length,
    analysesPending: prompts.filter((prompt) =>
      ['QUEUED', 'RUNNING'].includes(prompt.analysis?.status ?? 'QUEUED'),
    ).length,
    analysesFailed: prompts.filter((prompt) => prompt.analysis?.status === 'FAILED').length,
    topWeaknesses: Object.entries(weaknessCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
    recentAttention: actionable.slice(0, 5).map((prompt) => ({
      id: prompt.id,
      projectName: prompt.projectName,
      content: prompt.content,
      score: prompt.analysis?.score ?? null,
      status: prompt.analysis?.status ?? 'QUEUED',
      weakness: prompt.analysis?.weaknesses[0] ?? null,
    })),
  };
}

function stripMockPromptOwner(prompt: MockPromptRow): PromptListResponse['items'][number] {
  const { ownerId, ...rest } = prompt;
  void ownerId;
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
    maxScoreFilter: string;
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
  if (options.maxScoreFilter) {
    const maxScore = Number(options.maxScoreFilter);
    if (Number.isNaN(maxScore)) return false;
    if (score === null || score === undefined || score > maxScore) return false;
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
  const serializedSearchParams = searchParams.toString();
  const demoMode = searchParams.get('mock') === '1' || searchParams.get('demo') === '1';
  const mockProfile = searchParams.get('mockRole') === 'user' ? 'USER' : 'OWNER';
  const mockConfig = demoMode ? mockUsers[mockProfile] : emptyMockMode;
  const initialUrlState = readDashboardUrlState(serializedSearchParams);

  const [actor, setActor] = useState<ActorContext | null>(null);
  const [stats, setStats] = useState(emptyStats);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [prompts, setPrompts] = useState<PromptListResponse['items']>([]);
  const [query, setQuery] = useState(initialUrlState.query);
  const [projectFilter, setProjectFilter] = useState(initialUrlState.projectId);
  const [platformFilter, setPlatformFilter] = useState(initialUrlState.platform);
  const [modelFilter, setModelFilter] = useState(initialUrlState.model);
  const [minScoreFilter, setMinScoreFilter] = useState(initialUrlState.minScore);
  const [maxScoreFilter, setMaxScoreFilter] = useState(initialUrlState.maxScore);
  const [memberFilter, setMemberFilter] = useState(initialUrlState.userId);
  const [tenantMembers, setTenantMembers] = useState<MemberOption[]>([]);
  const [tenants, setTenants] = useState<
    Array<{ role: string; tenant: { id: string; name: string } }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(initialUrlState.promptId);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [systemStatus, setSystemStatus] = useState<
    'checking' | 'operational' | 'degraded' | 'unavailable'
  >('checking');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    setSectionLoading(false);
    return undefined;
  }, [demoMode, mockConfig.actor, router]);

  useEffect(() => {
    if (demoMode) {
      setSystemStatus('operational');
      return;
    }
    let active = true;
    setSystemStatus('checking');
    void apiRequest<{ status: string; checks?: Record<string, string> }>('/health/ready')
      .then((health) => {
        if (!active) return;
        const checks = Object.values(health.checks ?? {});
        setSystemStatus(
          health.status === 'ready' && checks.every((check) => check === 'ok')
            ? 'operational'
            : 'degraded',
        );
      })
      .catch(() => {
        if (active) setSystemStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [demoMode]);

  useEffect(() => {
    const workspaceNotice = window.sessionStorage.getItem('promptlens:workspace-notice');
    if (!workspaceNotice) return;
    window.sessionStorage.removeItem('promptlens:workspace-notice');
    setNotice(workspaceNotice);
  }, []);

  useEffect(() => {
    const state = readDashboardUrlState(serializedSearchParams);
    setQuery(state.query);
    setProjectFilter(state.projectId);
    setPlatformFilter(state.platform);
    setModelFilter(state.model);
    setMinScoreFilter(state.minScore);
    setMaxScoreFilter(state.maxScore);
    setMemberFilter(state.userId);
    setSelectedPromptId(state.promptId);
  }, [serializedSearchParams]);

  const promptParameters = useCallback(() => {
    const parameters = new URLSearchParams();
    if (!actor) return parameters;

    const tenantAdmin = isTenantAdmin(actor.role);
    if (query) parameters.set('q', query);
    if (projectFilter) parameters.set('projectId', projectFilter);
    if (platformFilter) parameters.set('platform', platformFilter);
    if (modelFilter) parameters.set('model', modelFilter);
    if (minScoreFilter) parameters.set('minScore', minScoreFilter);
    if (maxScoreFilter) parameters.set('maxScore', maxScoreFilter);
    if (!tenantAdmin) parameters.set('mine', 'true');
    if (tenantAdmin && memberFilter) parameters.set('userId', memberFilter);
    return parameters;
  }, [
    actor,
    query,
    projectFilter,
    platformFilter,
    modelFilter,
    minScoreFilter,
    maxScoreFilter,
    memberFilter,
  ]);

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
          maxScoreFilter,
          memberFilter,
        }),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map(stripMockPromptOwner);
  }, [
    actor,
    demoMode,
    modelFilter,
    minScoreFilter,
    maxScoreFilter,
    memberFilter,
    projectFilter,
    query,
  ]);

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

  async function runAction(
    key: string,
    successMessage: string,
    action: () => Promise<void> | void,
  ): Promise<boolean> {
    if (pendingAction) return false;
    setPendingAction(key);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The action could not be completed.');
      return false;
    } finally {
      setPendingAction(null);
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nameValue = data.get('name');
    const descriptionValue = data.get('description');
    const name = typeof nameValue === 'string' ? nameValue.trim() : '';
    const description = typeof descriptionValue === 'string' ? descriptionValue.trim() : '';
    if (!name) return;
    const completed = await runAction('create-project', `Project “${name}” created.`, async () => {
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
            promptCount: 0,
            averageScore: null,
            lowScoreCount: 0,
            lastActivityAt: null,
          },
        ]);
        return;
      }
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({ name: data.get('name'), description: data.get('description') }),
      });
      await load();
    });
    if (completed) form.reset();
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = writeDashboardUrlState(
      serializedSearchParams,
      {
        query,
        projectId: projectFilter,
        platform: platformFilter,
        model: modelFilter,
        minScore: minScoreFilter,
        maxScore: maxScoreFilter,
        userId: memberFilter,
        promptId: null,
      },
      adminLinksVisible,
    );
    router.push(`${pathname ?? '/dashboard/prompts'}${nextQuery ? `?${nextQuery}` : ''}`);
    if (!demoMode) await load();
  }

  function selectPrompt(promptId: string): void {
    const nextPromptId = selectedPromptId === promptId ? null : promptId;
    setSelectedPromptId(nextPromptId);
    const nextQuery = writeDashboardUrlState(
      serializedSearchParams,
      {
        query,
        projectId: projectFilter,
        platform: platformFilter,
        model: modelFilter,
        minScore: minScoreFilter,
        maxScore: maxScoreFilter,
        userId: memberFilter,
        promptId: nextPromptId,
      },
      adminLinksVisible,
    );
    router.replace(`${pathname ?? '/dashboard/prompts'}${nextQuery ? `?${nextQuery}` : ''}`);
  }

  function openProjectPrompts(projectId: string): void {
    const parameters = new URLSearchParams();
    parameters.set('projectId', projectId);
    router.push(`/dashboard/prompts?${parameters.toString()}`);
  }

  async function toggleProject(projectId: string, archived: boolean) {
    await runAction(
      `project-${projectId}`,
      archived ? 'Project restored.' : 'Project archived.',
      async () => {
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
      },
    );
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
    const target = tenants.find((entry) => entry.tenant.id === tenantId)?.tenant.name;
    await runAction('switch-workspace', 'Workspace changed.', async () => {
      await apiRequest('/auth/tenant/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      window.sessionStorage.setItem(
        'promptlens:workspace-notice',
        `Workspace changed to ${target ?? 'the selected workspace'}.`,
      );
      window.location.reload();
    });
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
    await runAction(`reanalyze-${promptId}`, 'Analysis queued.', async () => {
      if (demoMode) return;
      await apiRequest(`/prompts/${promptId}/analyses`, { method: 'POST' });
      await load();
    });
  }

  async function copyImprovedPrompt(content: string) {
    await runAction('copy-prompt', 'Improved prompt copied.', async () => {
      await navigator.clipboard.writeText(content);
    });
  }

  async function deletePrompt(promptId: string) {
    if (!window.confirm('Delete this prompt and hide it from all workspace views?')) return;
    await runAction(`delete-${promptId}`, 'Prompt deleted.', async () => {
      if (demoMode) {
        setPrompts((current) => current.filter((item) => item.id !== promptId));
        setSelectedPromptId((current) => (current === promptId ? null : current));
        return;
      }
      await apiRequest(`/prompts/${promptId}`, { method: 'DELETE' });
      setSelectedPromptId(null);
      await load();
    });
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
    await runAction(`session-${sessionId}`, 'Session revoked.', async () => {
      await apiRequest(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      if (current) router.push('/login');
      else await load();
    });
  }

  const actorRole = actor?.role ?? '';
  const adminLinksVisible = isTenantAdmin(actorRole);
  const activeTenantName =
    tenants.find((entry) => entry.tenant.id === actor?.tenantId)?.tenant.name ??
    'Current workspace';
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) ?? null;
  const platformOptions = useMemo(
    () => [...new Set(prompts.map((prompt) => prompt.platform))].sort(),
    [prompts],
  );
  const modelOptions = useMemo(
    () => [...new Set(prompts.map((prompt) => prompt.model))].sort(),
    [prompts],
  );
  const hasActiveFilters = Boolean(
    query ||
    projectFilter ||
    platformFilter ||
    modelFilter ||
    minScoreFilter ||
    maxScoreFilter ||
    memberFilter,
  );
  const activeFilters = [
    query ? { key: 'query', label: `Search: ${query}` } : null,
    projectFilter
      ? {
          key: 'project',
          label: `Project: ${projects.find((project) => project.id === projectFilter)?.name ?? 'Selected'}`,
        }
      : null,
    platformFilter ? { key: 'platform', label: `Platform: ${platformFilter}` } : null,
    modelFilter ? { key: 'model', label: `Model: ${modelFilter}` } : null,
    minScoreFilter ? { key: 'minScore', label: `Score ≥ ${minScoreFilter}` } : null,
    maxScoreFilter ? { key: 'maxScore', label: `Score ≤ ${maxScoreFilter}` } : null,
    memberFilter
      ? {
          key: 'member',
          label: `User: ${tenantMembers.find((member) => member.id === memberFilter)?.displayName ?? 'Selected'}`,
        }
      : null,
  ].filter((item): item is { key: string; label: string } => item !== null);
  const qualityPreset =
    minScoreFilter === '' && maxScoreFilter === '59'
      ? 'low'
      : minScoreFilter === '60' && maxScoreFilter === '79'
        ? 'medium'
        : minScoreFilter === '80' && maxScoreFilter === '100'
          ? 'high'
          : minScoreFilter || maxScoreFilter
            ? 'custom'
            : '';
  const prioritizedProjects = [...projects].sort(
    (a, b) =>
      (b.lowScoreCount ?? 0) - (a.lowScoreCount ?? 0) ||
      (a.averageScore ?? 101) - (b.averageScore ?? 101),
  );

  function applyFilterPatch(patch: Record<string, string>): void {
    const next = {
      query,
      projectId: projectFilter,
      platform: platformFilter,
      model: modelFilter,
      minScore: minScoreFilter,
      maxScore: maxScoreFilter,
      userId: memberFilter,
      promptId: null,
      ...patch,
    };
    if ('query' in patch) setQuery(patch.query ?? '');
    if ('projectId' in patch) setProjectFilter(patch.projectId ?? '');
    if ('platform' in patch) setPlatformFilter(patch.platform ?? '');
    if ('model' in patch) setModelFilter(patch.model ?? '');
    if ('minScore' in patch) setMinScoreFilter(patch.minScore ?? '');
    if ('maxScore' in patch) setMaxScoreFilter(patch.maxScore ?? '');
    if ('userId' in patch) setMemberFilter(patch.userId ?? '');
    const nextQuery = writeDashboardUrlState(serializedSearchParams, next, adminLinksVisible);
    router.push(`${pathname ?? '/dashboard/prompts'}${nextQuery ? `?${nextQuery}` : ''}`);
  }

  function removeFilter(key: string): void {
    const patches: Record<string, Record<string, string>> = {
      query: { query: '' },
      project: { projectId: '' },
      platform: { platform: '' },
      model: { model: '' },
      minScore: { minScore: '' },
      maxScore: { maxScore: '' },
      member: { userId: '' },
    };
    applyFilterPatch(patches[key] ?? {});
  }

  function setQualityPreset(value: string): void {
    if (value === 'low') {
      setMinScoreFilter('');
      setMaxScoreFilter('59');
    } else if (value === 'medium') {
      setMinScoreFilter('60');
      setMaxScoreFilter('79');
    } else if (value === 'high') {
      setMinScoreFilter('80');
      setMaxScoreFilter('100');
    } else if (!value) {
      setMinScoreFilter('');
      setMaxScoreFilter('');
    }
  }
  const sectionTitle =
    section === 'prompts'
      ? 'Prompt history'
      : section === 'projects'
        ? 'Projects'
        : 'Workspace overview';
  const sectionCaption =
    section === 'prompts'
      ? 'Prompt analysis'
      : section === 'projects'
        ? 'Workspace'
        : 'Workspace intelligence';

  return (
    <div className="dashboard-shell-v2">
      <WorkspaceSidebar
        tenantName={activeTenantName}
        role={actorRole || 'Workspace'}
        tenantId={actor?.tenantId}
        adminVisible={adminLinksVisible}
        onSignOut={() => void logout()}
        workspaceControl={
          tenants.length > 1 ? (
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
          ) : null
        }
      />
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
          <div className="pl-header-actions">
            <span className={`pl-live-status is-${systemStatus}`} role="status">
              <i />
              {systemStatus === 'checking'
                ? 'Checking systems'
                : systemStatus === 'operational'
                  ? 'Systems operational'
                  : systemStatus === 'degraded'
                    ? 'Partial service issue'
                    : 'Systems unavailable'}
            </span>
            <div className="v2-metadata">
              {demoMode ? <span className="v2-chip v2-chip-demo">Demo dataset</span> : null}
              <span className="v2-chip">Session {actor?.sessionId?.slice(0, 8) ?? 'offline'}</span>
            </div>
          </div>
        </header>
        {error ? (
          <div className="v2-error" role="alert">
            <p>{error}</p>
            <button className="v2-action" type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : null}
        {notice ? (
          <div className="pl-action-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}
        {section === 'overview' ? (
          sectionLoading ? (
            <OverviewPanelSkeleton />
          ) : (
            <>
              <section className="pl-action-center" aria-labelledby="attention-heading">
                <article className="pl-attention-hero">
                  <div>
                    <p className="v2-kicker">Your next action</p>
                    <h2 id="attention-heading">Prompts that need attention</h2>
                    <p>
                      Low-quality and failed analyses are grouped here so you can fix the highest
                      impact work first.
                    </p>
                  </div>
                  <strong>{stats.needsAttention}</strong>
                  <Link className="pl-primary-action" href="/dashboard/prompts?maxScore=59">
                    Review priority prompts <span aria-hidden="true">→</span>
                  </Link>
                </article>
                <div className="pl-action-signals">
                  <article>
                    <span>Waiting for analysis</span>
                    <strong>{stats.analysesPending}</strong>
                    <Link href="/dashboard/prompts">Open queue</Link>
                  </article>
                  <article className={stats.analysesFailed ? 'is-warning' : ''}>
                    <span>Failed analyses</span>
                    <strong>{stats.analysesFailed}</strong>
                    <Link href="/dashboard/prompts">Review failures</Link>
                  </article>
                </div>
              </section>
              <section className="pl-priority-grid" aria-label="Priority prompt insights">
                <article className="v2-panel">
                  <div className="v2-panel-head">
                    <div>
                      <p className="v2-kicker">Recurring quality gaps</p>
                      <h2>Top weaknesses</h2>
                    </div>
                  </div>
                  {stats.topWeaknesses.length ? (
                    <ol className="pl-weakness-list">
                      {stats.topWeaknesses.map((weakness, index) => (
                        <li key={weakness.name}>
                          <span className="pl-list-index">{index + 1}</span>
                          <span>{weakness.name}</span>
                          <strong>{weakness.count}</strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="v2-empty">No recurring weaknesses detected yet.</p>
                  )}
                </article>
                <article className="v2-panel pl-recent-attention">
                  <div className="v2-panel-head">
                    <div>
                      <p className="v2-kicker">Recent priority work</p>
                      <h2>What to inspect now</h2>
                    </div>
                    <Link className="v2-ghost" href="/dashboard/prompts?maxScore=59">
                      View all
                    </Link>
                  </div>
                  {stats.recentAttention.length ? (
                    <div className="pl-attention-list">
                      {stats.recentAttention.map((prompt) => (
                        <article key={prompt.id}>
                          <span className="v2-score">{prompt.score ?? '!'}</span>
                          <div>
                            <strong>{prompt.projectName}</strong>
                            <p>{prompt.content}</p>
                            <small>
                              {prompt.weakness ?? `${prompt.status.toLowerCase()} analysis`}
                            </small>
                          </div>
                          <Link href={`/dashboard/prompts?promptId=${prompt.id}`}>Inspect</Link>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="v2-empty">
                      <p>No priority prompts right now.</p>
                      <Link className="v2-action" href="/dashboard/prompts">
                        Browse all prompts
                      </Link>
                    </div>
                  )}
                </article>
              </section>
              <section
                className="v2-kpi-grid pl-secondary-metrics"
                aria-label="Workspace statistics"
              >
                <article className="v2-kpi pl-kpi-featured">
                  <div className="pl-kpi-label">
                    <p>Average quality</p>
                    <span aria-hidden="true">◎</span>
                  </div>
                  <strong>
                    {stats.averageScore ?? 'N/A'}
                    <small>/100</small>
                  </strong>
                  <small className="pl-kpi-foot">Completed prompt analyses</small>
                </article>
                <article className="v2-kpi">
                  <div className="pl-kpi-label">
                    <p>Total prompts</p>
                    <span aria-hidden="true">⌁</span>
                  </div>
                  <strong>{stats.prompts}</strong>
                  <small className="pl-kpi-foot">Across {stats.projects} projects</small>
                </article>
                <article className="v2-kpi">
                  <div className="pl-kpi-label">
                    <p>Last 7 days</p>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <strong>{stats.promptsLast7Days}</strong>
                  <small className="pl-kpi-foot">Recently captured prompts</small>
                </article>
                <article className="v2-kpi">
                  <div className="pl-kpi-label">
                    <p>Completed</p>
                    <span aria-hidden="true">◇</span>
                  </div>
                  <strong>{stats.analysesCompleted}</strong>
                  <small className="pl-kpi-foot">Successful analyses</small>
                </article>
              </section>
              <section className="v2-panels pl-analytics-grid" aria-label="Prompt analytics">
                <article className="v2-panel pl-trend-panel">
                  <div className="v2-panel-head">
                    <div>
                      <p className="v2-kicker">Quality signal</p>
                      <h2>Score trend</h2>
                    </div>
                    <span className="v2-chip">14 days</span>
                  </div>
                  {stats.scoreTrend.length ? (
                    <ol className="v2-stat-list">
                      {stats.scoreTrend.map((point) => (
                        <li key={point.date}>
                          <span>{point.date}</span>
                          <strong>{point.score}</strong>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="v2-empty">No completed analyses yet.</p>
                  )}
                </article>
                <Distribution title="Model usage" items={stats.modelDistribution} compact />
                <Distribution title="Project activity" items={stats.projectDistribution} compact />
              </section>
              <section className="v2-panel">
                <p className="v2-kicker">Active sessions</p>
                <h2>Security</h2>
                <div className="v2-session-grid">
                  {sessions.map((session) => (
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
                <span className="v2-chip">Total: {prompts.length}</span>
              </div>
              <form
                className="v2-filter-bar pl-prompt-filters"
                onSubmit={(event) => void search(event)}
              >
                <label className="v2-field pl-filter-search">
                  <span>Search</span>
                  <input
                    placeholder="Search prompt content"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <button
                  className="v2-ghost pl-filter-toggle"
                  type="button"
                  aria-expanded={filtersExpanded}
                  aria-controls="prompt-filter-options"
                  onClick={() => setFiltersExpanded((current) => !current)}
                >
                  {filtersExpanded ? 'Hide filters' : 'More filters'}
                  {activeFilters.length ? ` (${activeFilters.length})` : ''}
                </button>
                <div
                  className={`pl-filter-options ${filtersExpanded ? 'open' : ''}`}
                  id="prompt-filter-options"
                >
                  <label className="v2-field">
                    <span>Project</span>
                    <select
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
                  </label>
                  {adminLinksVisible ? (
                    <label className="v2-field">
                      <span>User</span>
                      <select
                        value={memberFilter}
                        onChange={(event) => {
                          setMemberFilter(event.target.value);
                        }}
                      >
                        <option value="">All users</option>
                        {tenantMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.displayName} - {member.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="v2-field">
                    <span>Platform</span>
                    <select
                      value={platformFilter}
                      onChange={(event) => setPlatformFilter(event.target.value)}
                    >
                      <option value="">All platforms</option>
                      {platformOptions.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="v2-field">
                    <span>Model</span>
                    <select
                      value={modelFilter}
                      onChange={(event) => setModelFilter(event.target.value)}
                    >
                      <option value="">All models</option>
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="v2-field">
                    <span>Quality</span>
                    <select
                      value={qualityPreset}
                      onChange={(event) => setQualityPreset(event.target.value)}
                    >
                      <option value="">All scores</option>
                      <option value="low">Needs attention (0–59)</option>
                      <option value="medium">Developing (60–79)</option>
                      <option value="high">Strong (80–100)</option>
                      <option value="custom">Custom range</option>
                    </select>
                  </label>
                  {qualityPreset === 'custom' ? (
                    <div className="pl-score-range">
                      <label className="v2-field">
                        <span>Minimum</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={minScoreFilter}
                          onChange={(event) => setMinScoreFilter(event.target.value)}
                        />
                      </label>
                      <label className="v2-field">
                        <span>Maximum</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={maxScoreFilter}
                          onChange={(event) => setMaxScoreFilter(event.target.value)}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
                <button className="pl-primary-action pl-filter-submit" type="submit">
                  Apply filters
                </button>
              </form>
              {activeFilters.length ? (
                <div className="pl-active-filters" aria-label="Active filters">
                  {activeFilters.map((filter) => (
                    <button key={filter.key} type="button" onClick={() => removeFilter(filter.key)}>
                      {filter.label} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <button
                    className="pl-clear-filters"
                    type="button"
                    onClick={() => router.push('/dashboard/prompts')}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
              <div className="v2-export-strip pl-export-strip">
                <span>Export current result</span>
                <button className="v2-ghost" type="button" onClick={() => void download('json')}>
                  JSON
                </button>
                <button className="v2-ghost" type="button" onClick={() => void download('csv')}>
                  CSV
                </button>
              </div>
              <div className={`pl-prompt-workbench ${selectedPrompt ? 'has-selection' : ''}`}>
                <div className="v2-prompts pl-prompt-list-column">
                  {prompts.length === 0 ? (
                    <div className="v2-empty">
                      <p>
                        {hasActiveFilters
                          ? 'No prompts match the current filters.'
                          : 'No prompts yet. Connect a device to start syncing.'}
                      </p>
                      {hasActiveFilters ? (
                        <button
                          className="v2-action"
                          type="button"
                          onClick={() => router.push('/dashboard/prompts')}
                        >
                          Clear filters
                        </button>
                      ) : (
                        <Link className="v2-action" href="/connect">
                          Connect a device
                        </Link>
                      )}
                    </div>
                  ) : (
                    prompts.map((prompt) => {
                      const status = (prompt.analysis?.status ?? 'QUEUED').toLowerCase();
                      return (
                        <article
                          className={`v2-prompt-card ${selectedPromptId === prompt.id ? 'active' : ''}`}
                          key={prompt.id}
                        >
                          <div className="v2-score">{prompt.analysis?.score ?? '--'}</div>
                          <div className="v2-prompt-copy">
                            <p>{prompt.content}</p>
                            <div className="v2-chip-row">
                              <span className="v2-mini-chip">{prompt.projectName}</span>
                              <span className="v2-mini-chip">{prompt.platform}</span>
                              <span className="v2-mini-chip">{prompt.model}</span>
                            </div>
                            <small className="v2-prompt-meta">
                              Captured{' '}
                              {new Date(prompt.occurredAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </small>
                          </div>
                          <div className="v2-prompt-actions">
                            <span className={`v2-status v2-status-${status}`}>
                              {prompt.analysis?.status ?? 'QUEUED'}
                            </span>
                            <button
                              className="v2-action"
                              type="button"
                              aria-expanded={selectedPromptId === prompt.id}
                              onClick={() => selectPrompt(prompt.id)}
                            >
                              {selectedPromptId === prompt.id ? 'Selected' : 'Inspect'}
                            </button>
                            <button
                              className="v2-danger pl-delete-action"
                              type="button"
                              disabled={pendingAction === `delete-${prompt.id}`}
                              onClick={() => void deletePrompt(prompt.id)}
                            >
                              <span aria-hidden="true">×</span>
                              <span className="pl-delete-label">Delete</span>
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
                <PromptAnalysisPanel
                  prompt={selectedPrompt}
                  pendingAction={pendingAction}
                  onBack={() => selectedPrompt && selectPrompt(selectedPrompt.id)}
                  onCopy={copyImprovedPrompt}
                  onDelete={deletePrompt}
                  onReanalyze={reanalyze}
                />
              </div>
            </section>
          )
        ) : null}
        {section === 'projects' ? (
          sectionLoading ? (
            <ProjectsPanelSkeleton />
          ) : (
            <section className="pl-project-layout">
              <div className="pl-project-content">
                <div className="pl-project-summary">
                  <article>
                    <span>All projects</span>
                    <strong>{projects.length}</strong>
                  </article>
                  <article>
                    <span>Active</span>
                    <strong>
                      {projects.filter((project) => project.status === 'ACTIVE').length}
                    </strong>
                  </article>
                  <article>
                    <span>Archived</span>
                    <strong>
                      {projects.filter((project) => project.status === 'ARCHIVED').length}
                    </strong>
                  </article>
                </div>
                <div className="v2-panel-head pl-project-heading">
                  <div>
                    <p className="v2-kicker">Organization</p>
                    <h2>Workspace projects</h2>
                  </div>
                  <span className="v2-chip">{projects.length} total</span>
                </div>
                <div className="v2-project-grid">
                  {prioritizedProjects.map((project, index) => (
                    <article className="v2-project-card pl-project-card" key={project.id}>
                      <div className="pl-project-card-top">
                        <span className="pl-project-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className={`v2-mini-chip ${project.status.toLowerCase()}`}>
                          {project.status}
                        </span>
                      </div>
                      <div>
                        <h3>{project.name}</h3>
                        <p>{project.description ?? 'No project description yet.'}</p>
                      </div>
                      <small className="pl-project-updated">
                        Updated{' '}
                        {new Date(project.updatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </small>
                      <div
                        className="pl-project-metrics"
                        aria-label={`${project.name} quality metrics`}
                      >
                        <span>
                          <strong>{project.promptCount ?? 0}</strong> prompts
                        </span>
                        <span>
                          <strong>{project.averageScore ?? '—'}</strong> avg.
                        </span>
                        <span className={(project.lowScoreCount ?? 0) > 0 ? 'attention' : ''}>
                          <strong>{project.lowScoreCount ?? 0}</strong> low
                        </span>
                      </div>
                      <div className="pl-project-actions">
                        <button
                          className="v2-action"
                          type="button"
                          onClick={() => openProjectPrompts(project.id)}
                        >
                          View prompts <span aria-hidden="true">↗</span>
                        </button>
                        <button
                          className="v2-ghost"
                          type="button"
                          disabled={pendingAction === `project-${project.id}`}
                          onClick={() =>
                            void toggleProject(project.id, project.status !== 'ARCHIVED')
                          }
                        >
                          {pendingAction === `project-${project.id}`
                            ? 'Saving…'
                            : project.status === 'ARCHIVED'
                              ? 'Restore'
                              : 'Archive'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <aside className="v2-panel pl-create-project">
                <span className="pl-panel-icon" aria-hidden="true">
                  ＋
                </span>
                <p className="v2-kicker">New workspace unit</p>
                <h2>Create project</h2>
                <p className="v2-subline">Group related prompts, members, and analysis history.</p>
                <form className="v2-inline-form" onSubmit={(event) => void createProject(event)}>
                  <label className="v2-field">
                    <span>Project name</span>
                    <input name="name" placeholder="e.g. Product launch" required maxLength={120} />
                  </label>
                  <label className="v2-field">
                    <span>Description</span>
                    <input
                      name="description"
                      placeholder="What belongs in this project?"
                      maxLength={1000}
                    />
                  </label>
                  <button
                    type="submit"
                    className="pl-primary-action"
                    disabled={pendingAction === 'create-project'}
                  >
                    {pendingAction === 'create-project' ? 'Creating…' : 'Create project'}{' '}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>
              </aside>
            </section>
          )
        ) : null}
      </main>
    </div>
  );
}

function PromptAnalysisPanel({
  prompt,
  pendingAction,
  onBack,
  onCopy,
  onDelete,
  onReanalyze,
}: {
  readonly prompt: PromptRow | null;
  readonly pendingAction: string | null;
  readonly onBack: () => void;
  readonly onCopy: (content: string) => Promise<void>;
  readonly onDelete: (promptId: string) => Promise<void>;
  readonly onReanalyze: (promptId: string) => Promise<void>;
}) {
  if (!prompt) {
    return (
      <aside className="pl-prompt-detail pl-prompt-detail-empty">
        <span aria-hidden="true">⌁</span>
        <h3>Select a prompt</h3>
        <p>Choose an item from the log to inspect its quality signals and improved version.</p>
      </aside>
    );
  }

  const analysis = prompt.analysis;
  const status = (analysis?.status ?? 'QUEUED').toLowerCase();
  const copying = pendingAction === 'copy-prompt';
  const analyzing = pendingAction === `reanalyze-${prompt.id}`;
  const deleting = pendingAction === `delete-${prompt.id}`;

  return (
    <aside className="pl-prompt-detail" aria-label="Prompt analysis">
      <button className="v2-ghost pl-prompt-back" type="button" onClick={onBack}>
        ← Back to prompts
      </button>
      <header className="pl-detail-head">
        <div>
          <p className="v2-kicker">Analysis detail</p>
          <h2>{prompt.projectName}</h2>
        </div>
        <div className="pl-detail-score">
          <strong>{analysis?.score ?? '—'}</strong>
          <span className={`v2-status v2-status-${status}`}>{analysis?.status ?? 'QUEUED'}</span>
        </div>
      </header>
      <section className="pl-original-prompt">
        <span>Original prompt</span>
        <p>{prompt.content}</p>
      </section>
      <div className="pl-analysis-columns">
        <section>
          <h3>What works</h3>
          {analysis?.strengths.length ? (
            <ul>
              {analysis.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="v2-empty">No strengths recorded yet.</p>
          )}
        </section>
        <section>
          <h3>Needs attention</h3>
          {analysis?.weaknesses.length ? (
            <ul>
              {analysis.weaknesses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="v2-empty">No gaps identified.</p>
          )}
        </section>
      </div>
      <section className="pl-recommendations">
        <div className="v2-section-title">
          <div>
            <p className="v2-kicker">Action plan</p>
            <h3>Recommendations</h3>
          </div>
          <span className="v2-chip">{analysis?.suggestions.length ?? 0}</span>
        </div>
        {analysis?.suggestions.length ? (
          <ol>
            {analysis.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          <p className="v2-empty">No recommendations available yet.</p>
        )}
      </section>
      <section className="pl-improved-prompt">
        <div>
          <p className="v2-kicker">Ready to use</p>
          <h3>Improved prompt</h3>
        </div>
        <pre>{analysis?.improvedPrompt ?? 'Analysis is still running.'}</pre>
        <div className="pl-detail-actions">
          {analysis?.improvedPrompt ? (
            <button
              className="pl-primary-action"
              type="button"
              disabled={copying}
              onClick={() => void onCopy(analysis.improvedPrompt ?? '')}
            >
              {copying ? 'Copying…' : 'Copy improved prompt'}
            </button>
          ) : null}
          <button
            className="v2-action"
            type="button"
            disabled={analyzing}
            onClick={() => void onReanalyze(prompt.id)}
          >
            {analyzing ? 'Queuing…' : 'Run analysis again'}
          </button>
          <button
            className="v2-danger"
            type="button"
            disabled={deleting}
            onClick={() => void onDelete(prompt.id)}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </section>
    </aside>
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
    <section className="v2-panel" id="prompts" aria-hidden="true">
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
    <section className="v2-panel" aria-hidden="true">
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
      <section className="v2-kpi-grid" aria-hidden="true">
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
      <section className="v2-panels" aria-hidden="true">
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
      <section className="v2-panel" aria-hidden="true">
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
