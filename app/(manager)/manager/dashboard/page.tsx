import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function ManagerDashboardPage() {
  void trpc.dashboard.getManagerDashboard.prefetch();

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
