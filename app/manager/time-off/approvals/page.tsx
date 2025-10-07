/**
 * Manager Time-Off Approvals Page (P1-9)
 *
 * Manager approval workflow for team time-off requests
 * Following HCI principles:
 * - Zero learning curve (clear approve/reject actions)
 * - Smart defaults (pending requests only)
 * - Error prevention (balance check before approval)
 * - Immediate feedback (success/error toasts)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc/client';
import {
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  User,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ManagerTimeOffApprovalsPage() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const utils = trpc.useContext();

  // Fetch pending requests for team
  const { data: pendingRequests, isLoading } = trpc.timeOff.getPendingRequestsForTeam.useQuery();

  // Approve mutation
  const approveMutation = trpc.timeOff.approve.useMutation({
    onSuccess: () => {
      toast({
        title: 'Demande approuvée',
        description: 'La demande de congé a été approuvée avec succès.',
      });
      setIsApproving(false);
      setSelectedRequest(null);
      utils.timeOff.getPendingRequestsForTeam.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'approuver la demande.',
        variant: 'destructive',
      });
      setIsApproving(false);
    },
  });

  // Reject mutation
  const rejectMutation = trpc.timeOff.reject.useMutation({
    onSuccess: () => {
      toast({
        title: 'Demande rejetée',
        description: 'La demande de congé a été rejetée.',
      });
      setIsRejecting(false);
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectReason('');
      utils.timeOff.getPendingRequestsForTeam.invalidate();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de rejeter la demande.',
        variant: 'destructive',
      });
      setIsRejecting(false);
    },
  });

  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setIsApproving(true);
    approveMutation.mutate({
      requestId: request.id,
      notes: 'Approuvé par le manager',
    });
  };

  const handleRejectClick = (request: any) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      toast({
        title: 'Raison requise',
        description: 'Veuillez indiquer la raison du refus.',
        variant: 'destructive',
      });
      return;
    }

    setIsRejecting(true);
    rejectMutation.mutate({
      requestId: selectedRequest.id,
      reviewNotes: rejectReason,
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vacation: 'Congés annuels',
      sick_leave: 'Congé maladie',
      personal: 'Congé personnel',
      parental: 'Congé parental',
      maternity: 'Congé maternité',
      paternity: 'Congé paternité',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'approved':
        return <Badge className="bg-green-600">Approuvé</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeté</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-4">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement des demandes...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requests = pendingRequests || [];

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Demandes de congés à approuver</h1>
        <p className="text-muted-foreground mt-2">
          Gérez les demandes de congés de votre équipe
        </p>
      </div>

      {/* Summary Card */}
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-100 p-3">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{requests.length}</p>
              <p className="text-sm text-muted-foreground">
                {requests.length === 0
                  ? 'Aucune demande en attente'
                  : requests.length === 1
                  ? 'demande en attente'
                  : 'demandes en attente'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">Tout est en ordre !</p>
              <p className="text-sm text-muted-foreground mt-2">
                Aucune demande de congé en attente d'approbation
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => {
            const days = differenceInDays(
              new Date(request.endDate),
              new Date(request.startDate)
            ) + 1;

            return (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-3">
                        <User className="h-5 w-5" />
                        {request.employee?.firstName} {request.employee?.lastName}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        Demandé le{' '}
                        {format(new Date(request.submittedAt), 'dd MMMM yyyy à HH:mm', {
                          locale: fr,
                        })}
                      </CardDescription>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Request Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Type de congé</p>
                      <p className="font-semibold">
                        {request.policy?.name || getTypeLabel(request.type || 'vacation')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Période</p>
                      <p className="font-semibold">
                        {format(new Date(request.startDate), 'dd MMM', { locale: fr })} -{' '}
                        {format(new Date(request.endDate), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Durée</p>
                      <p className="font-semibold text-primary">{days} jour{days > 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  {request.reason && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-900">Motif</p>
                          <p className="text-sm text-blue-700 mt-1">{request.reason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => handleApprove(request)}
                      disabled={isApproving || isRejecting}
                      className="min-h-[48px] flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isApproving && selectedRequest?.id === request.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approbation...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approuver
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleRejectClick(request)}
                      disabled={isApproving || isRejecting}
                      variant="destructive"
                      className="min-h-[48px] flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Refuser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Refuser la demande de congé
            </DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du refus. Cette information sera communiquée à l'employé.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="rejectReason">Raison du refus *</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Période de haute activité, équipe sous-effectif..."
              className="min-h-[100px] mt-2"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectReason('');
                setSelectedRequest(null);
              }}
              disabled={isRejecting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isRejecting || !rejectReason.trim()}
              className="min-h-[48px]"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refus en cours...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Confirmer le refus
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
