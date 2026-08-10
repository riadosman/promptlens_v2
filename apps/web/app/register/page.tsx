import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';
import { LegalLinks } from '../../components/legal-links';

export default function RegisterPage() {
  return (
    <main className="pl-auth-shell">
      <section className="pl-auth-card pl-auth-card-wide">
        <div className="pl-auth-heading">
          <Link className="pl-brand" href="/">
            <span className="pl-brand-mark" aria-hidden="true">
              _
            </span>
            <span>PROMPTLENS</span>
          </Link>
          <h1>Create workspace</h1>
          <p>Turn prompt history into durable team knowledge.</p>
        </div>
        <div className="pl-secure-note">
          <span aria-hidden="true">◇</span> Self-hosted workspace · explicit data control
        </div>
        <AuthForm mode="register" />
        <p className="pl-auth-meta">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
        <LegalLinks />
      </section>
    </main>
  );
}
