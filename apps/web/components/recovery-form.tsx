'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { apiRequest } from '../lib/api';

export function RecoveryForm({ mode }: { readonly mode: 'forgot' | 'reset' | 'verify' }) {
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const fields = new FormData(event.currentTarget);
    try {
      if (mode === 'forgot') {
        await apiRequest('/auth/password/forgot', {
          method: 'POST',
          body: JSON.stringify({ email: fields.get('email') }),
        });
        setMessage('If the account exists, a reset link has been sent.');
      } else if (mode === 'reset') {
        await apiRequest('/auth/password/reset', {
          method: 'POST',
          body: JSON.stringify({ token, password: fields.get('password') }),
        });
        setMessage('Password changed. All previous sessions were signed out.');
      } else {
        await apiRequest('/auth/email/verify', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        setMessage('Email verified. You can now sign in.');
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The request could not be completed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      {mode === 'forgot' ? (
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required maxLength={320} />
        </label>
      ) : null}
      {mode === 'reset' ? (
        <label>
          New password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
      ) : null}
      {mode !== 'forgot' && !token ? (
        <p className="form-error" role="alert">
          The link is missing its security token.
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="muted" role="status">
          {message}
        </p>
      ) : null}
      <button type="submit" disabled={pending || (mode !== 'forgot' && !token)}>
        {pending
          ? 'Please wait…'
          : mode === 'forgot'
            ? 'Send reset link'
            : mode === 'reset'
              ? 'Reset password'
              : 'Verify email'}
      </button>
      <p className="muted">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
