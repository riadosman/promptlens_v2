import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="/">
          PromptLens
        </Link>
        <p className="eyebrow">Start your workspace</p>
        <h1>Turn prompts into durable knowledge.</h1>
        <AuthForm mode="register" />
        <p className="muted">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
