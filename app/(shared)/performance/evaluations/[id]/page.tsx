import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void trpc.performance.evaluations.getById.prefetch({ id });

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
