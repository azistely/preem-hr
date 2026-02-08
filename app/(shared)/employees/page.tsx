import { trpc, HydrateClient } from '@/trpc/server';
import PageClient from './page-client';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  void trpc.employees.list.prefetch({
    limit: 50,
  });

  return (
    <HydrateClient>
      <PageClient />
    </HydrateClient>
  );
}
