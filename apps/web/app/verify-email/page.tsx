import Link from 'next/link';
import { RecoveryForm } from '../../components/recovery-form';

export default function VerifyEmailPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="/">
          PromptLens
        </Link>
        <p className="eyebrow">Account security</p>
        <h1>Verify your email.</h1>
        <RecoveryForm mode="verify" />
      </section>
    </main>
  );
}
