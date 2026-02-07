'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, History, FileText } from 'lucide-react';
import { PendingRequestsDashboard } from '@/features/document-requests/components/hr';

export default function AdminDocumentRequestsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Demandes de Documents</h1>
        <p className="text-muted-foreground">
          Traiter les demandes de documents administratifs des employés
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            En attente
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <PendingRequestsDashboard />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <DocumentRequestsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Document Requests History Component
 *
 * Shows completed/rejected requests history
 */
function DocumentRequestsHistory() {
  const { data, isLoading } = api.documentRequests.list.useQuery({
    status: undefined, // All statuses except pending
    limit: 50,
  });

  if (isLoading) {
    return (
      <CardListSkeleton count={3} />
    );
  }

  const requests = data?.requests ?? [];
  const completedRequests = requests.filter(
    (r) => r.status === 'ready' || r.status === 'rejected' || r.status === 'cancelled'
  );

  if (completedRequests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucun historique</h3>
          <p className="text-muted-foreground text-center">
            Les demandes traitées apparaîtront ici
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des demandes</CardTitle>
        <CardDescription>
          {completedRequests.length} demande(s) traitée(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {completedRequests.map((request) => {
          const statusConfig: Record<
            string,
            { label: string; variant: 'success' | 'destructive' | 'secondary' }
          > = {
            ready: { label: 'Généré', variant: 'success' },
            rejected: { label: 'Refusé', variant: 'destructive' },
            cancelled: { label: 'Annulé', variant: 'secondary' },
          };
          const status = statusConfig[request.status] ?? statusConfig.cancelled;

          return (
            <div
              key={request.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{request.employeeName}</span>
                    <Badge variant="outline">{request.employeeNumber}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {DocumentTypeLabels[request.documentType] || request.documentType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-sm text-muted-foreground">
                  {request.reviewedAt && (
                    <span>
                      {formatDistanceToNow(new Date(request.reviewedAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  )}
                </div>
                <Badge variant={status.variant as any}>{status.label}</Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Required imports for the history component
import { trpc as api } from '@/lib/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CardListSkeleton } from '@/components/skeletons';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DocumentTypeLabels } from '@/lib/db/schema/document-requests';
