import Link from 'next/link';
import { RecoveryForm } from '../../components/recovery-form';

export default function ForgotPasswordPage() {
  return (
    <main className="auth-shell">
      <section className="auth-brand-panel" aria-label="PromptLens">
        <Link className="wordmark" href="/">
          PromptLens
        </Link>
        <div className="auth-brand-copy">
          <p className="eyebrow">Prompt intelligence for teams</p>
          <h2>Keep the signal.<br />Build the practice.</h2>
          <p>One place for the prompts, context, and lessons your team wants to keep.</p>
        </div>
        <span className="auth-brand-note">Open source · Built for thoughtful AI work</span>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset your password.</h1>
        <RecoveryForm mode="forgot" />
        </div>
      </section>
    </main>
  );
}
