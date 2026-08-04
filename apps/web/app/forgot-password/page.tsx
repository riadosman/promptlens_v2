import { RecoveryForm } from '../../components/recovery-form';
import { AuthPageShell } from '../../components/auth-page-shell';

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell eyebrow="Account recovery" title="Reset your password.">
      <RecoveryForm mode="forgot" />
    </AuthPageShell>
  );
}
