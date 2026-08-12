import { Suspense } from 'react';
import { DashboardClient } from '../../components/dashboard-client';

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="v2-panel">Loading connect setup…</div>}>
      <DashboardClient />
    </Suspense>
  );
}
