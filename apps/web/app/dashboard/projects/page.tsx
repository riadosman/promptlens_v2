import { Suspense } from 'react';
import { DashboardClient } from '../../../components/dashboard-client';

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  );
}
