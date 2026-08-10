'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { ProjectResponse } from '@promptlens/contracts';
import { ApiError, apiRequest } from '../lib/api';

export function ConnectDevice() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [userCode, setUserCode] = useState('');
  const [needsAuthentication, setNeedsAuthentication] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setUserCode(new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '');
    apiRequest<ProjectResponse[]>('/projects')
      .then(setProjects)
      .catch((error: unknown) => {
        setNeedsAuthentication(error instanceof ApiError && error.status === 401);
        setMessageKind('error');
        setMessage(error instanceof Error ? error.message : 'Could not load projects.');
      });
  }, []);

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setMessage(null);
    try {
      await apiRequest('/connectors/device/approve', {
        method: 'POST',
        body: JSON.stringify({ userCode: data.get('userCode'), projectId: data.get('projectId') }),
      });
      setMessageKind('success');
      setMessage('Device connected. You can return to your AI tool.');
    } catch (error: unknown) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Device could not be connected.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form pl-connect-form" onSubmit={(event) => void approve(event)}>
      <label>
        Device code
        <input
          name="userCode"
          required
          minLength={8}
          maxLength={12}
          autoCapitalize="characters"
          placeholder="ABCD-EFGH"
          value={userCode}
          onChange={(event) => setUserCode(event.target.value.toUpperCase())}
        />
      </label>
      <label>
        Project
        <select name="projectId" required defaultValue="">
          <option value="" disabled>
            Select an active project
          </option>
          {projects
            .filter((project) => project.status === 'ACTIVE')
            .map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
        </select>
      </label>
      {message ? (
        <p
          className={`form-message pl-inline-status ${messageKind === 'error' ? 'pl-inline-error' : ''}`}
          role={messageKind === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}
      {needsAuthentication ? (
        <p className="muted">
          Sign in before approving this device.{' '}
          <Link href={`/login?returnTo=${encodeURIComponent(`/connect?code=${userCode}`)}`}>
            Sign in
          </Link>{' '}
          or{' '}
          <Link href={`/register?returnTo=${encodeURIComponent(`/connect?code=${userCode}`)}`}>
            create an account
          </Link>
          .
        </p>
      ) : null}
      <button type="submit" disabled={pending || needsAuthentication || projects.length === 0}>
        {pending ? 'Connecting…' : 'Connect device'}
      </button>
    </form>
  );
}
