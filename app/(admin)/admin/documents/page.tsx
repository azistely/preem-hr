import { trpc, HydrateClient } from '@/trpc/server';
import AdminDocumentsPage from './page-client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // Prefetch all 3 queries the client page needs — data ready before JS hydrates
  void trpc.documents.getPendingCount.prefetch();
  void trpc.documents.listUploaded.prefetch({});
  void trpc.documents.getCategories.prefetch();

  return (
    <HydrateClient>
      <AdminDocumentsPage />
    </HydrateClient>
  );
}
