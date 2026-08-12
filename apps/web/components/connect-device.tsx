'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { ProjectResponse } from '@promptlens/contracts';
import { ApiError, apiRequest } from '../lib/api';

export function ConnectDevice() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [userCode, setUserCode] = useState('');
  const [projectId, setProjectId] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [needsAuthentication, setNeedsAuthentication] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const activeProjects = projects.filter((project) => project.status === 'ACTIVE');
  const selectedProject = activeProjects.find((project) => project.id === projectId);

  useEffect(() => {
    setUserCode(new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '');
    apiRequest<ProjectResponse[]>('/projects')
      .then((items) => {
        const active = items.filter((project) => project.status === 'ACTIVE');
        setProjects(items);
        setProjectId(active[0]?.id ?? '');
      })
      .catch((error: unknown) => {
        setNeedsAuthentication(error instanceof ApiError && error.status === 401);
        setMessage(error instanceof Error ? error.message : 'Could not load projects.');
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnecting(true);
    setMessage(null);
    try {
      await apiRequest('/connectors/device/approve', {
        method: 'POST',
        body: JSON.stringify({ userCode, projectId }),
      });
      setConnected(true);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Device could not be connected.');
    } finally {
      setConnecting(false);
    }
  }

  if (connected) {
    return (
      <section className="v2-connect-panel v2-connect-success" aria-live="polite">
        <div className="v2-connect-success-mark" aria-hidden="true">✓</div>
        <p className="v2-kicker">Connection complete</p>
        <h2>Device connected.</h2>
        <p>{selectedProject?.name ?? 'Your selected project'} can now receive prompts from this tool.</p>
        <Link className="v2-primary-action" href="/dashboard/overview">Back to overview <span aria-hidden="true">→</span></Link>
      </section>
    );
  }

  return (
    <form className="v2-connect-panel" onSubmit={step === 1 ? (event) => { event.preventDefault(); setStep(2); } : approve}>
      <div className="v2-connect-progress" aria-label={`Connection step ${step} of 2`}>
        <div className={step === 1 ? 'active' : 'complete'}><span>01</span><strong>Device code</strong></div>
        <i className={step === 2 ? 'complete' : ''} aria-hidden="true" />
        <div className={step === 2 ? 'active' : ''}><span>02</span><strong>Workspace access</strong></div>
      </div>

      {step === 1 ? (
        <div className="v2-connect-step">
          <p className="v2-kicker">Step 1 · Verify the connector</p>
          <h2>Start with your device code.</h2>
          <p className="v2-connect-intro">Enter the temporary code shown by your AI connector. We’ll verify it before asking where prompts should go.</p>
          <label className="v2-connect-field">
            <span>Device code</span>
            <input
              name="userCode"
              required
              minLength={8}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              placeholder="PL-7K4M-92QX"
              value={userCode}
              onChange={(event) => setUserCode(event.target.value.toUpperCase())}
            />
            <small>Codes are short-lived and can only be used once.</small>
          </label>
          <button className="v2-primary-action" type="submit">Continue <span aria-hidden="true">→</span></button>
        </div>
      ) : (
        <div className="v2-connect-step">
          <p className="v2-kicker">Step 2 · Choose access</p>
          <h2>Where should prompts go?</h2>
          <p className="v2-connect-intro">Select one active project for this device. You can change access later from Administration.</p>
          <div className="v2-connect-summary"><span>Device code</span><strong>{userCode || 'Not entered'}</strong></div>
          <label className="v2-connect-field">
            <span>Active project</span>
            <select name="projectId" required value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={loadingProjects || needsAuthentication || activeProjects.length === 0}>
              {loadingProjects ? <option value="">Loading projects…</option> : null}
              {!loadingProjects && activeProjects.length === 0 ? <option value="">No active projects</option> : null}
              {activeProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
            <small>Only prompts from this connector will be added to the selected project.</small>
          </label>
          {message ? <p className="v2-connect-status" role="status">{message}</p> : null}
          {needsAuthentication ? (
            <p className="v2-connect-status">
              Sign in before approving this device.{' '}
              <Link href={`/login?returnTo=${encodeURIComponent(`/connect?code=${userCode}`)}`}>Sign in</Link>{' '}
              or{' '}
              <Link href={`/register?returnTo=${encodeURIComponent(`/connect?code=${userCode}`)}`}>create an account</Link>.
            </p>
          ) : null}
          {!loadingProjects && !needsAuthentication && activeProjects.length === 0 ? (
            <p className="v2-connect-status">Create an active project before connecting this device. <Link href="/dashboard/projects">Open projects</Link>.</p>
          ) : null}
          <div className="v2-connect-actions">
            <button className="v2-secondary-action" type="button" onClick={() => setStep(1)}>Back</button>
            <button className="v2-primary-action" type="submit" disabled={connecting || needsAuthentication || loadingProjects || activeProjects.length === 0}>
              {connecting ? 'Connecting…' : 'Connect device'} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
