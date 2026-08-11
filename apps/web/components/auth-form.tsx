'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';

export function AuthForm({ mode }: { readonly mode: 'login' | 'register' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <form className="auth-form" onSubmit={submit}>
      {mode === 'register' ? (
        <>
          <label>
            Your name
            <input name="displayName" autoComplete="name" required maxLength={120} />
          </label>
          <label>
            Workspace name
            <input name="tenantName" autoComplete="organization" required maxLength={120} />
          </label>
        </>
      ) : null}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={320} />
      </label>
      <label>
        Password
        <span className="password-field">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 12 : 1}
            maxLength={128}
          />
          <button
            className="password-toggle"
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {showPassword ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5 0 8.5 4 9.5 7a11.8 11.8 0 0 1-3.2 4.8" />
                  <path d="M6.2 6.2A11.9 11.9 0 0 0 2.5 12c1 3 4.5 7 9.5 7a10.6 10.6 0 0 0 3.2-.5" />
                </>
              ) : (
                <>
                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </>
              )}
            </svg>
          </button>
        </span>
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
