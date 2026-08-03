import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="/">
          PromptLens
        </Link>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to your workspace.</h1>
        <AuthForm mode="login" />
        <p className="muted">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="muted">
          New to PromptLens? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
