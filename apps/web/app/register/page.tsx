import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';
import { AuthPageShell } from '../../components/auth-page-shell';

export default function RegisterPage() {
  return (
    <AuthPageShell eyebrow="Start your workspace" title="Turn prompts into durable knowledge.">
      <AuthForm mode="register" />
      <p className="muted">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthPageShell>
  );
}
