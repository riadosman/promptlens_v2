import { RecoveryForm } from '../../components/recovery-form';
import { AuthPageShell } from '../../components/auth-page-shell';

export default function VerifyEmailPage() {
  return (
    <AuthPageShell eyebrow="Account security" title="Verify your email.">
      <RecoveryForm mode="verify" />
    </AuthPageShell>
  );
}
