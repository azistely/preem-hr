import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function HRDashboardPage() {
  void trpc.dashboard.getHRDashboard.prefetch();

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
