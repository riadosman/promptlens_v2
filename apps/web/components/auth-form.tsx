'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';

export function AuthForm({ mode }: { readonly mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try {
      await apiRequest(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(payload) });
      const requested = new URLSearchParams(window.location.search).get('returnTo');
      const returnTo = requested?.startsWith('/') && !requested.startsWith('//') ? requested : null;
      router.push(returnTo ?? '/dashboard');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form pl-auth-form" onSubmit={(event) => void submit(event)}>
      {mode === 'register' ? (
        <>
          <label>
            Your name
            <input
              name="displayName"
              autoComplete="name"
              placeholder="Ada Lovelace"
              required
              maxLength={120}
            />
          </label>
          <label>
            Workspace name
            <input
              name="tenantName"
              autoComplete="organization"
              placeholder="Core engineering"
              required
              maxLength={120}
            />
            <small className="pl-field-help">
              Your workspace keeps projects, members, and prompt history in one isolated team area.
            </small>
          </label>
        </>
      ) : null}
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="user@domain.com"
          required
          maxLength={320}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          placeholder="••••••••••••"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
          minLength={mode === 'register' ? 12 : 1}
          maxLength={128}
        />
        {mode === 'register' ? (
          <small className="pl-field-help">
            Use at least 12 characters. A passphrase is easiest to remember.
          </small>
        ) : null}
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
