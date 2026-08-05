import { Suspense } from 'react';
import { DashboardClient } from '../../../components/dashboard-client';

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="v2-panel">Loading dashboard…</div>}>
      <DashboardClient />
    </Suspense>
  );
}
