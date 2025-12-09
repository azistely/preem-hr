'use client';

/**
 * My Document Requests Component
 *
 * Shows employee's document request history with status tracking.
 * Allows cancellation of pending requests and download of ready documents.
 */

import { trpc as api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Clock,
  Check,
  X,
  Download,
  Loader2,
  FileStack,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive'; icon: typeof Clock }
> = {
  pending: { label: 'En attente', variant: 'secondary', icon: Clock },
  processing: { label: 'En cours', variant: 'default', icon: Loader2 },
  ready: { label: 'Prêt', variant: 'success', icon: Check },
  rejected: { label: 'Refusé', variant: 'destructive', icon: X },
  cancelled: { label: 'Annulé', variant: 'secondary', icon: X },
};

export function MyDocumentRequests() {
  const utils = api.useUtils();

  const { data, isLoading, error } = api.documentRequests.getMyRequests.useQuery();

  const cancelRequest = api.documentRequests.cancel.useMutation({
    onSuccess: () => {
      toast.success('Demande annulée');
      utils.documentRequests.getMyRequests.invalidate();
      utils.documentRequests.getPendingCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'annulation');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mes demandes</CardTitle>
          <CardDescription>Historique de vos demandes de documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Erreur lors du chargement des demandes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const requests = data?.requests ?? [];

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileStack className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune demande</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Vous n'avez pas encore fait de demande de document. Utilisez le bouton
            ci-dessus pour en créer une.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes demandes</CardTitle>
        <CardDescription>Historique de vos demandes de documents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => {
          const status = statusConfig[request.status] ?? statusConfig.pending;
          const StatusIcon = status.icon;
          const isPending = request.status === 'pending';
          const isReady = request.status === 'ready';

          return (
            <div
              key={request.id}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{request.documentTypeLabel}</span>
                  <Badge variant={status.variant as any} className="flex items-center gap-1">
                    <StatusIcon
                      className={`h-3 w-3 ${request.status === 'processing' ? 'animate-spin' : ''}`}
                    />
                    {status.label}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground">
                  Demandé{' '}
                  {formatDistanceToNow(new Date(request.submittedAt), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </p>

                {request.rejectionReason && (
                  <p className="text-sm text-destructive mt-2">
                    Raison du refus: {request.rejectionReason}
                  </p>
                )}

                {request.requestNotes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    "{request.requestNotes}"
                  </p>
                )}
              </div>

              <div className="flex-shrink-0 flex gap-2">
                {isReady && request.generatedDocumentId && (
                  <Button size="sm" variant="outline" className="min-h-[36px]">
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                )}

                {isPending && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive min-h-[36px]"
                        disabled={cancelRequest.isPending}
                      >
                        {cancelRequest.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Annuler la demande?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Voulez-vous vraiment annuler cette demande de{' '}
                          {request.documentTypeLabel}? Cette action ne peut pas être
                          annulée.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Non, garder</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelRequest.mutate({ id: request.id })}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Oui, annuler
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
