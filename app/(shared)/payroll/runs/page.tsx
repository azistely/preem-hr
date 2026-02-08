import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function PayrollRunsPage() {
  void trpc.payroll.listRuns.prefetch({
    limit: 50,
    offset: 0,
  });

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
