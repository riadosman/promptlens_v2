import { Suspense } from 'react';
import { DashboardClient } from '../../../components/dashboard-client';

export default function PromptsPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
