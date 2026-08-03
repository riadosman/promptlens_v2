'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardStats, ProjectResponse, PromptListResponse } from '@promptlens/contracts';
import { apiDownload, apiRequest } from '../lib/api';

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

export function DashboardClient() {
  const router = useRouter();
  const [stats, setStats] = useState(emptyStats);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [prompts, setPrompts] = useState<PromptListResponse['items']>([]);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState('');
  const [tenants, setTenants] = useState<
    Array<{ role: string; tenant: { id: string; name: string } }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<
    Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>
  >([]);

  const load = useCallback(
    async (search = '') => {
      try {
        const parameters = new URLSearchParams();
        if (search) parameters.set('q', search);
        if (projectFilter) parameters.set('projectId', projectFilter);
        if (platformFilter) parameters.set('platform', platformFilter);
        if (modelFilter) parameters.set('model', modelFilter);
        if (minScoreFilter) parameters.set('minScore', minScoreFilter);
        const [nextStats, nextProjects, nextPrompts, nextTenants, nextSessions] = await Promise.all(
          [
            apiRequest<DashboardStats>('/dashboard/stats'),
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
          ],
        );
        setStats(nextStats);
        setProjects(nextProjects);
        setPrompts(nextPrompts.items);
        setTenants(nextTenants);
        setSessions(nextSessions);
        setError(null);
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : 'Dashboard could not be loaded.';
        setError(message);
        if (/Authentication|required|Session/i.test(message)) router.push('/login');
      }
    },
    [minScoreFilter, modelFilter, platformFilter, projectFilter, router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({ name: data.get('name'), description: data.get('description') }),
    });
    form.reset();
    await load(query);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await load(query);
  }

  async function toggleProject(projectId: string, archived: boolean) {
    await apiRequest(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived }),
    });
    await load(query);
  }

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function switchTenant(tenantId: string) {
    await apiRequest('/auth/tenant/switch', { method: 'POST', body: JSON.stringify({ tenantId }) });
    window.location.reload();
  }

  async function download(format: 'json' | 'csv') {
    const { blob, filename } = await apiDownload(
      `/prompt-exports?format=${format}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function reanalyze(promptId: string) {
    await apiRequest(`/prompts/${promptId}/analyses`, { method: 'POST' });
    await load(query);
  }

  async function deletePrompt(promptId: string) {
    if (!window.confirm('Delete this prompt and hide it from all workspace views?')) return;
    await apiRequest(`/prompts/${promptId}`, { method: 'DELETE' });
    setSelectedPromptId(null);
    await load(query);
  }

  async function revokeSession(sessionId: string, current: boolean) {
    if (!window.confirm(current ? 'Sign out this current session?' : 'Revoke this session?'))
      return;
    await apiRequest(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    if (current) router.push('/login');
    else await load(query);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="wordmark" href="/dashboard">
          PromptLens
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#overview">
            Overview
          </a>
          <a href="#prompts">Prompts</a>
          <a href="#projects">Projects</a>
          <a href="/connect">Connect device</a>
          <a href="/admin">Administration</a>
        </nav>
        {tenants.length > 1 ? (
          <label className="muted">
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
                  {tenant.name} · {role}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className="quiet" onClick={() => void logout()}>
          Sign out
        </button>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header" id="overview">
          <div>
            <p className="eyebrow">Workspace intelligence</p>
            <h1>Prompt overview</h1>
          </div>
          <span className="live-pill">● Live analysis</span>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        <section className="metric-grid" aria-label="Workspace statistics">
          <Metric label="Average score" value={stats.averageScore ?? '—'} suffix="/100" />
          <Metric label="Prompts" value={stats.prompts} />
          <Metric label="Last 7 days" value={stats.promptsLast7Days} />
          <Metric label="Analyses" value={stats.analysesCompleted} />
        </section>
        <section className="distribution-grid" aria-label="Prompt analytics">
          <div className="panel">
            <p className="eyebrow">Score trend</p>
            <h2>Last 14 days</h2>
            {stats.scoreTrend.length ? (
              <ol className="stat-list">
                {stats.scoreTrend.map((point) => (
                  <li key={point.date}>
                    <span>{point.date}</span>
                    <strong>{point.score}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty">No completed analyses yet.</p>
            )}
          </div>
          <Distribution title="Models" items={stats.modelDistribution} />
          <Distribution title="Projects" items={stats.projectDistribution} />
        </section>
        <section className="panel" id="prompts">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">History</p>
              <h2>Recent prompts</h2>
            </div>
            <form className="search" onSubmit={search}>
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
              <button type="submit">Search</button>
            </form>
            <button className="quiet" type="button" onClick={() => void download('json')}>
              Export JSON
            </button>
            <button className="quiet" type="button" onClick={() => void download('csv')}>
              Export CSV
            </button>
          </div>
          <div className="prompt-list">
            {prompts.length === 0 ? (
              <p className="empty">No prompts yet. Connect a device to start syncing.</p>
            ) : (
              prompts.map((prompt) => (
                <article className="prompt-row" key={prompt.id}>
                  <div className="score-ring">{prompt.analysis?.score ?? '…'}</div>
                  <div className="prompt-copy">
                    <p>{prompt.content}</p>
                    <small>
                      {prompt.projectName} · {prompt.platform} · {prompt.model}
                    </small>
                  </div>
                  <div className="prompt-actions">
                    <span
                      className={`status-badge status-${prompt.analysis?.status.toLowerCase() ?? 'queued'}`}
                    >
                      {prompt.analysis?.status ?? 'QUEUED'}
                    </span>
                    <button
                      className="quiet"
                      type="button"
                      aria-expanded={selectedPromptId === prompt.id}
                      onClick={() =>
                        setSelectedPromptId(selectedPromptId === prompt.id ? null : prompt.id)
                      }
                    >
                      {selectedPromptId === prompt.id ? 'Hide analysis' : 'View analysis'}
                    </button>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => void deletePrompt(prompt.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {selectedPromptId === prompt.id ? (
                    <div className="analysis-detail">
                      <section className="analysis-section">
                        <h3>Strengths</h3>
                        {prompt.analysis?.strengths.length ? (
                          <ul>
                            {prompt.analysis.strengths.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="analysis-empty">No strengths recorded yet.</p>
                        )}
                      </section>
                      <section className="analysis-section">
                        <h3>Missing or weak</h3>
                        {prompt.analysis?.weaknesses.length ? (
                          <ul>
                            {prompt.analysis.weaknesses.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="analysis-empty">No gaps identified.</p>
                        )}
                      </section>
                      <section className="analysis-section analysis-recommendations">
                        <div className="analysis-section-heading">
                          <div>
                            <p className="eyebrow">Action plan</p>
                            <h3>Recommendations &amp; next steps</h3>
                          </div>
                          <span className="recommendation-count">
                            {prompt.analysis?.suggestions.length ?? 0}
                          </span>
                        </div>
                        {prompt.analysis?.suggestions.length ? (
                          <ul>
                            {prompt.analysis.suggestions.map((item, index) => (
                              <li key={item}>
                                <span className="recommendation-number">{index + 1}</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="analysis-empty">No recommendations available yet.</p>
                        )}
                      </section>
                      <section className="analysis-section">
                        <h3>Improved prompt</h3>
                        <pre>{prompt.analysis?.improvedPrompt ?? 'Analysis is still running.'}</pre>
                        {prompt.analysis?.improvedPrompt ? (
                          <button
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
                        <button type="button" onClick={() => void reanalyze(prompt.id)}>
                          Run analysis again
                        </button>
                      </section>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
        <section className="panel project-panel" id="projects">
          <div>
            <p className="eyebrow">Organization</p>
            <h2>Projects</h2>
          </div>
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>{project.description ?? 'No description'}</p>
                <span>{project.status}</span>
                <button
                  className="quiet"
                  type="button"
                  onClick={() => void toggleProject(project.id, project.status !== 'ARCHIVED')}
                >
                  {project.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
                </button>
              </article>
            ))}
          </div>
          <form className="inline-form" onSubmit={createProject}>
            <input name="name" placeholder="New project name" required maxLength={120} />
            <input name="description" placeholder="Description" maxLength={1000} />
            <button type="submit">Create project</button>
          </form>
        </section>
        <section className="panel" aria-label="Active sessions">
          <p className="eyebrow">Security</p>
          <h2>Active sessions</h2>
          <div className="project-grid">
            {sessions.map((session) => (
              <article className="project-card" key={session.id}>
                <h3>{session.current ? 'Current session' : 'Signed-in device'}</h3>
                <p>{session.userAgent ?? 'Unknown client'}</p>
                <small>{new Date(session.createdAt).toLocaleString()}</small>
                <button
                  className="danger"
                  type="button"
                  onClick={() => void revokeSession(session.id, session.current)}
                >
                  {session.current ? 'Sign out' : 'Revoke'}
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Distribution({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
}) {
  return (
    <div className="panel">
      <p className="eyebrow">Distribution</p>
      <h2>{title}</h2>
      {items.length ? (
        <ol className="stat-list">
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">No data yet.</p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly suffix?: string;
}) {
  return (
    <article className="metric">
      <p>{label}</p>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
    </article>
  );
}
