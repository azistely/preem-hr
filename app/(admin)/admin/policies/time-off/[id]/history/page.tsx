/**
 * Policy History Page
 *
 * Shows timeline of all policy changes with effective dating
 * Uses PolicyAuditTrail component for visual timeline
 */

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { PolicyAuditTrail, PolicyAuditTrailSkeleton } from '@/features/policies/components/policy-audit-trail';

export default function PolicyHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const { data: policy, isLoading: isPolicyLoading } =
    trpc.policies.getTimeOffPolicy.useQuery(id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à {policy?.name || 'la politique'}
        </Button>

        <div>
          <h1 className="text-3xl font-bold">Historique des modifications</h1>
          <p className="text-muted-foreground mt-2">
            Timeline complète de toutes les versions de cette politique
          </p>
        </div>
      </div>

      {/* Timeline */}
      {isPolicyLoading ? (
        <PolicyAuditTrailSkeleton />
      ) : (
        <PolicyAuditTrail policyId={id} />
      )}
    </div>
  );
}
