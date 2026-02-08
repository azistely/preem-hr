import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  void trpc.employees.getById.prefetch({ id });

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
