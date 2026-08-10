import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';
import { LegalLinks } from '../../components/legal-links';

export default function LoginPage() {
  return (
    <main className="pl-auth-shell">
      <section className="pl-auth-card">
        <div className="pl-auth-heading">
          <Link className="pl-brand" href="/">
            <span className="pl-brand-mark" aria-hidden="true">
              _
            </span>
            <span>PROMPTLENS</span>
          </Link>
          <h1>Authenticate</h1>
          <p>Sign in to access your secure workspace.</p>
        </div>
        <div className="pl-secure-note">
          <span aria-hidden="true">◇</span> Encrypted session · HttpOnly credentials
        </div>
        <AuthForm mode="login" />
        <p className="pl-auth-meta">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="pl-auth-meta">
          New to PromptLens? <Link href="/register">Create an account</Link>
        </p>
        <LegalLinks />
      </section>
    </main>
  );
}
