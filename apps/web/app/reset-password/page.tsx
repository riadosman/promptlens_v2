import Link from 'next/link';
import { RecoveryForm } from '../../components/recovery-form';

export default function ResetPasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="/">
          PromptLens
        </Link>
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password.</h1>
        <RecoveryForm mode="reset" />
      </section>
    </main>
  );
}
