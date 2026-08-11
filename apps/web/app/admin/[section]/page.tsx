import { notFound } from 'next/navigation';
import { AdminClient } from '../../../components/admin-client';
import { isAdminSection } from '../../../lib/admin-sections';

export default async function AdminSectionPage({
  params,
}: {
  readonly params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!isAdminSection(section) || section === 'overview') {
    notFound();
  }

  return <AdminClient section={section} />;
}
