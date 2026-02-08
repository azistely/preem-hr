import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function EmployeeDashboardPage() {
  void trpc.dashboard.getEmployeeDashboard.prefetch();

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
