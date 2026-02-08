import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string; type?: string }>;
}) {
  const params = await searchParams;

  void trpc.performance.evaluations.list.prefetch({
    myEvaluations: true,
    cycleId: params.cycleId || undefined,
    limit: 50,
  });
  void trpc.performance.cycles.list.prefetch({ limit: 20 });

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
