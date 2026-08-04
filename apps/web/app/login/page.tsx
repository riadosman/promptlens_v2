import Link from 'next/link';
import { AuthForm } from '../../components/auth-form';
import { AuthPageShell } from '../../components/auth-page-shell';

export default function LoginPage() {
  return (
    <AuthPageShell eyebrow="Welcome back" title="Sign in to your workspace.">
      <AuthForm mode="login" />
      <p className="muted">
        <Link href="/forgot-password">Forgot your password?</Link>
      </p>
      <p className="muted">
        New to PromptLens? <Link href="/register">Create an account</Link>
      </p>
    </AuthPageShell>
  );
}
