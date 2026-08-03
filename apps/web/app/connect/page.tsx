import Link from 'next/link';
import { ConnectDevice } from '../../components/connect-device';

export default function ConnectPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="wordmark" href="/dashboard">
          PromptLens
        </Link>
        <p className="eyebrow">Device authorization</p>
        <h1>Connect your AI tool.</h1>
        <p className="muted">
          Enter the code shown by your connector and choose the only project it may access.
        </p>
        <ConnectDevice />
      </section>
    </main>
  );
}
