'use client';

/**
 * HR Salary Advance Approval Modal
 *
 * Allows HR to review and approve/reject salary advance requests
 * HCI Principles: Clear decision options, validation feedback, safety confirmations
 */

import { useState } from 'react';
import { trpc as api } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  AlertCircle,
  User,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

interface ApprovalModalProps {
  advanceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ApprovalModal({ advanceId, open, onOpenChange, onSuccess }: ApprovalModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectedReason, setRejectedReason] = useState('');

  // Get tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Get advance details
  const { data: advance, isLoading } = api.salaryAdvances.get.useQuery(
    { id: advanceId },
    { enabled: open }
  );

  // Approve/reject mutation
  const approveMutation = api.salaryAdvances.approve.useMutation({
    onSuccess: () => {
      // Invalidate all salary advances queries to refetch updated data
      utils.salaryAdvances.list.invalidate();
      utils.salaryAdvances.getPendingApprovals.invalidate();
      utils.salaryAdvances.getStatistics.invalidate();
      utils.salaryAdvances.get.invalidate({ id: advanceId });

      onOpenChange(false);
      setAction(null);
      setApprovedAmount('');
      setRejectedReason('');
      if (onSuccess) onSuccess();
    },
  });

  const handleApprove = () => {
    if (!advance) return;

    const finalAmount = approvedAmount
      ? parseFloat(approvedAmount)
      : Number(advance.requestedAmount);

    approveMutation.mutate({
      advanceId,
      approved: true,
      approvedAmount: approvedAmount ? finalAmount : undefined,
    });
  };

  const handleReject = () => {
    if (!rejectedReason.trim()) return;

    approveMutation.mutate({
      advanceId,
      approved: false,
      rejectedReason: rejectedReason.trim(),
    });
  };

  const requestedAmount = advance ? Number(advance.requestedAmount) : 0;
  const amountToApprove = approvedAmount
    ? parseFloat(approvedAmount)
    : requestedAmount;
  const monthlyDeduction = advance
    ? Math.ceil(amountToApprove / advance.repaymentMonths)
    : 0;

  const canApprove = amountToApprove > 0 && amountToApprove <= requestedAmount;
  const canReject = rejectedReason.trim().length >= 10;

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

  if (!advance) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Traiter la demande d'avance</DialogTitle>
          <DialogDescription>
            Examinez la demande et décidez de l'approuver ou de la refuser
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{advance.employeeName}</span>
              <Badge variant="outline">{advance.employeeNumber}</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Demandée le {formatDate(new Date(advance.requestDate), 'dd MMMM yyyy')}</span>
            </div>
          </div>

          {/* Request Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Montant demandé</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(requestedAmount, 'FCFA')}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Période de remboursement</p>
              <p className="text-2xl font-bold">{advance.repaymentMonths} mois</p>
            </div>
          </div>

          {/* Reason */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-semibold text-muted-foreground mb-1">
              Raison de la demande:
            </p>
            <p className="text-base">{advance.requestReason}</p>
            {advance.requestNotes && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                <p className="text-sm italic">{advance.requestNotes}</p>
              </div>
            )}
          </div>

          {/* Employee Financial Info */}
          {advance.employeeNetSalaryAtRequest && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-blue-900">
                    Salaire net de l'employé
                  </p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatCurrency(Number(advance.employeeNetSalaryAtRequest), 'FCFA')}
                  </p>
                  <p className="text-xs text-blue-600">
                    Déduction mensuelle:{' '}
                    {formatCurrency(monthlyDeduction, 'FCFA')} (
                    {((monthlyDeduction / Number(advance.employeeNetSalaryAtRequest)) * 100).toFixed(
                      1
                    )}
                    %)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Selection */}
          {!action && (
            <div className="flex gap-3">
              <Button
                variant="default"
                className="flex-1 min-h-[56px]"
                onClick={() => setAction('approve')}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Approuver
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

          {/* Approval Form */}
          {action === 'approve' && (
            <div className="space-y-4 p-4 border-2 border-green-200 rounded-lg bg-green-50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Approuver la demande</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approved-amount">
                  Montant à approuver (optionnel)
                </Label>
                <Input
                  id="approved-amount"
                  type="number"
                  min="0"
                  max={requestedAmount}
                  step="1000"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  placeholder={`Par défaut: ${formatCurrency(requestedAmount, 'FCFA')}`}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Laissez vide pour approuver le montant demandé. Vous pouvez réduire le montant
                  si nécessaire.
                </p>
              </div>

              {amountToApprove > 0 && (
                <div className="p-3 bg-white rounded border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Montant final:</span>
                    <span className="text-xl font-bold text-green-700">
                      {formatCurrency(amountToApprove, 'FCFA')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Déduction mensuelle:</span>
                    <span className="text-lg font-semibold">
                      {formatCurrency(monthlyDeduction, 'FCFA')}
                    </span>
                  </div>
                </div>
              )}

              {amountToApprove > requestedAmount && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Le montant approuvé ne peut pas dépasser le montant demandé
                  </AlertDescription>
                </Alert>
              )}

              {approveMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {approveMutation.error?.message ?? "Erreur lors de l'approbation"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction(null)}
                  disabled={approveMutation.isPending}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={!canApprove || approveMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approbation...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirmer l'approbation
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
                <Label htmlFor="reject-reason">
                  Raison du refus *
                </Label>
                <Textarea
                  id="reject-reason"
                  value={rejectedReason}
                  onChange={(e) => setRejectedReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette demande est refusée (minimum 10 caractères)"
                  className="min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {rejectedReason.length}/500 caractères
                </p>
              </div>

              {rejectedReason.length > 0 && rejectedReason.length < 10 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Veuillez fournir une raison d'au moins 10 caractères
                  </AlertDescription>
                </Alert>
              )}

              {approveMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {approveMutation.error?.message ?? 'Erreur lors du refus'}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAction(null)}
                  disabled={approveMutation.isPending}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={!canReject || approveMutation.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  {approveMutation.isPending ? (
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
