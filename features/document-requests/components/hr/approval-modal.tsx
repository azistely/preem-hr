'use client';

/**
 * HR Document Request Approval Modal
 *
 * Allows HR to generate and approve or reject document requests.
 * HCI Principles: Clear decision options, validation feedback, safety confirmations
 */

import { useState } from 'react';
import { trpc as api } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Calendar,
  FileText,
  Download,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { DocumentTypeLabels } from '@/lib/db/schema/document-requests';

interface ApprovalModalProps {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ApprovalModal({
  requestId,
  open,
  onOpenChange,
  onSuccess,
}: ApprovalModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Get tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Get request details
  const { data: request, isLoading } = api.documentRequests.get.useQuery(
    { id: requestId },
    { enabled: open }
  );

  // Approve mutation
  const approveMutation = api.documentRequests.approve.useMutation({
    onSuccess: () => {
      toast.success('Document généré et prêt pour l\'employé');
      // Invalidate all document requests queries
      utils.documentRequests.list.invalidate();
      utils.documentRequests.getPendingApprovals.invalidate();
      utils.documentRequests.getStatistics.invalidate();
      utils.documentRequests.getPendingCount.invalidate();
      utils.documentRequests.get.invalidate({ id: requestId });

      onOpenChange(false);
      resetState();
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'approbation');
    },
  });

  // Reject mutation
  const rejectMutation = api.documentRequests.reject.useMutation({
    onSuccess: () => {
      toast.success('Demande refusée');
      // Invalidate all document requests queries
      utils.documentRequests.list.invalidate();
      utils.documentRequests.getPendingApprovals.invalidate();
      utils.documentRequests.getStatistics.invalidate();
      utils.documentRequests.getPendingCount.invalidate();
      utils.documentRequests.get.invalidate({ id: requestId });

      onOpenChange(false);
      resetState();
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du refus');
    },
  });

  const resetState = () => {
    setAction(null);
    setRejectionReason('');
  };

  const handleApprove = () => {
    approveMutation.mutate({ requestId });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    rejectMutation.mutate({
      requestId,
      rejectionReason: rejectionReason.trim(),
    });
  };

  const canReject = rejectionReason.trim().length >= 10;
  const isPending = approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chargement...</DialogTitle>
            <DialogDescription>
              Récupération des détails de la demande
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!request) {
    return null;
  }

  const submittedDate = new Date(request.submittedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Traiter la demande de document</DialogTitle>
          <DialogDescription>
            Générez le document ou refusez la demande avec une explication
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{request.employeeName}</span>
              <Badge variant="outline">{request.employeeNumber}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Demandée le {format(submittedDate, 'dd MMMM yyyy', { locale: fr })} (
                {formatDistanceToNow(submittedDate, { addSuffix: true, locale: fr })})
              </span>
            </div>
          </div>

          {/* Document Type */}
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Document demandé</p>
                <p className="text-xl font-bold text-primary">
                  {DocumentTypeLabels[request.documentType] || request.documentType}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {request.requestNotes && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-semibold text-muted-foreground mb-1">
                Note de l'employé:
              </p>
              <p className="text-base">{request.requestNotes}</p>
            </div>
          )}

          {/* On behalf indicator */}
          {request.requestedOnBehalfOf && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cette demande a été faite par un manager pour le compte de l'employé.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Selection */}
          {!action && (
            <div className="flex gap-3">
              <Button
                variant="default"
                className="flex-1 min-h-[56px] bg-green-600 hover:bg-green-700"
                onClick={() => setAction('approve')}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Générer le document
              </Button>
              <Button
                variant="destructive"
                className="flex-1 min-h-[56px]"
                onClick={() => setAction('reject')}
              >
                <XCircle className="mr-2 h-5 w-5" />
                Refuser
              </Button>
            </div>
          )}

          {/* Approval Confirmation */}
          {action === 'approve' && (
            <div className="space-y-4 p-4 border-2 border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">
                  Générer et approuver
                </h3>
              </div>

              <p className="text-sm text-green-800">
                Le document sera généré automatiquement et l'employé recevra une
                notification pour le télécharger.
              </p>

              <div className="p-3 bg-white rounded border">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-green-600" />
                  <span className="font-medium">
                    {DocumentTypeLabels[request.documentType] || request.documentType}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Pour: {request.employeeName}
                </p>
              </div>

              {approveMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {approveMutation.error?.message ?? 'Erreur lors de la génération'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction(null)}
                  disabled={isPending}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmer la génération
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Rejection Form */}
          {action === 'reject' && (
            <div className="space-y-4 p-4 border-2 border-red-200 rounded-lg bg-red-50">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-red-900">Refuser la demande</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reject-reason">Raison du refus *</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette demande est refusée (minimum 10 caractères)"
                  className="min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {rejectionReason.length}/500 caractères
                </p>
              </div>

              {rejectionReason.length > 0 && rejectionReason.length < 10 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Veuillez fournir une raison d'au moins 10 caractères
                  </AlertDescription>
                </Alert>
              )}

              {rejectMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {rejectMutation.error?.message ?? 'Erreur lors du refus'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction(null)}
                  disabled={isPending}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={!canReject || isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refus...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Confirmer le refus
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
