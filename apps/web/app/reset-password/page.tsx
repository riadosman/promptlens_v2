import { RecoveryForm } from '../../components/recovery-form';
import { AuthPageShell } from '../../components/auth-page-shell';

export default function ResetPasswordPage() {
  return (
    <AuthPageShell eyebrow="Account recovery" title="Choose a new password.">
      <RecoveryForm mode="reset" />
    </AuthPageShell>
  );
}
