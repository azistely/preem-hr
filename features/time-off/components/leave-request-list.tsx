/**
 * Leave Request List
 *
 * Display employee's leave requests with status and actions
 * Following HCI principles:
 * - Clear status badges
 * - Mobile-responsive cards
 * - Task-oriented actions
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, XCircle, CheckCircle, AlertCircle, Wallet, Settings } from 'lucide-react';
import { format, differenceInBusinessDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { EntityDocumentsSection } from '@/components/documents/entity-documents-section';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string | null;
  reviewNotes?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  isDeductibleForAcp?: boolean;
  justificationDocumentUrl?: string | null;
  policy?: {
    id: string;
    name: string;
    policyType: string;
  };
}

interface LeaveRequestListProps {
  requests: TimeOffRequest[];
  employeeId: string;
  canApprove?: boolean;
}

export function LeaveRequestList({ requests, employeeId, canApprove = false }: LeaveRequestListProps) {
  const utils = trpc.useUtils();

  // Get current user to check roles
  const { data: currentUser } = trpc.auth.me.useQuery();

  // Check if user has HR role
  const isHRUser = currentUser?.role
    ? ['hr', 'hr_manager', 'super_admin'].includes(currentUser.role)
    : false;

  // Cancel mutation (for employee to cancel their own pending requests)
  const cancelMutation = trpc.timeOff.reject.useMutation({
    onSuccess: () => {
      toast.success('Demande annulée');
      utils.timeOff.getEmployeeRequests.invalidate({ employeeId });
      utils.timeOff.getAllBalances.invalidate({ employeeId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'annulation');
    },
  });

  // Approve mutation (for managers)
  const approveMutation = trpc.timeOff.approve.useMutation({
    onSuccess: () => {
      toast.success('Demande approuvée');
      utils.timeOff.getEmployeeRequests.invalidate({ employeeId });
      utils.timeOff.getAllBalances.invalidate({ employeeId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'approbation');
    },
  });

  // Reject mutation (for managers)
  const rejectMutation = trpc.timeOff.reject.useMutation({
    onSuccess: () => {
      toast.success('Demande rejetée');
      utils.timeOff.getEmployeeRequests.invalidate({ employeeId });
      utils.timeOff.getAllBalances.invalidate({ employeeId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du rejet');
    },
  });

  // Set ACP deductibility (for HR users)
  const setDeductibleMutation = trpc.timeOff.setDeductibleForACP.useMutation({
    onSuccess: () => {
      toast.success('Statut ACP mis à jour');
      utils.timeOff.getEmployeeRequests.invalidate({ employeeId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });


  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { variant: 'outline' as const, label: 'En attente', icon: Clock },
      approved: { variant: 'default' as const, label: 'Approuvé', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejeté', icon: XCircle },
      cancelled: { variant: 'secondary' as const, label: 'Annulé', icon: XCircle },
    };
    const badge = badges[status as keyof typeof badges] || badges.pending;
    const Icon = badge.icon;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {badge.label}
      </Badge>
    );
  };

  const handleCancel = async (requestId: string) => {
    await cancelMutation.mutateAsync({
      requestId,
      reviewNotes: 'Annulé par l\'employé',
    });
  };

  const handleApprove = async (requestId: string) => {
    await approveMutation.mutateAsync({
      requestId,
    });
  };

  const handleReject = async (requestId: string) => {
    await rejectMutation.mutateAsync({
      requestId,
      reviewNotes: 'Rejeté par le gestionnaire',
    });
  };

  const handleToggleDeductible = async (requestId: string, isDeductible: boolean) => {
    await setDeductibleMutation.mutateAsync({
      timeOffRequestId: requestId,
      isDeductible: isDeductible,
    });
  };


  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Demandes de congés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune demande de congé</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const businessDays = differenceInBusinessDays(
          new Date(request.endDate),
          new Date(request.startDate)
        ) + 1;

        const isPending = request.status === 'pending';

        return (
          <Card key={request.id}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Request Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">
                      {request.policy?.name || 'Type inconnu'}
                    </h3>
                    {getStatusBadge(request.status)}

                    {/* ACP Deductibility Badge */}
                    {request.isDeductibleForAcp !== undefined && (
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={request.isDeductibleForAcp ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          <Wallet className="h-3 w-3" />
                          {request.isDeductibleForAcp ? 'Déductible ACP' : 'Non déductible'}
                        </Badge>

                        {/* HR-only: Toggle deductibility */}
                        {isHRUser && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 hover:bg-muted rounded-sm min-h-[32px] min-w-[32px]">
                                <Settings className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                onClick={() => handleToggleDeductible(request.id, true)}
                                disabled={setDeductibleMutation.isPending}
                              >
                                <Wallet className="mr-2 h-4 w-4" />
                                Déductible pour ACP
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleDeductible(request.id, false)}
                                disabled={setDeductibleMutation.isPending}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Non déductible pour ACP
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {format(new Date(request.startDate), 'PPP', { locale: fr })}
                      {' → '}
                      {format(new Date(request.endDate), 'PPP', { locale: fr })}
                    </span>
                  </div>

                  <p className="text-sm">
                    <span className="font-medium">Durée:</span> {businessDays} jour
                    {businessDays > 1 ? 's' : ''} ouvrable{businessDays > 1 ? 's' : ''}
                  </p>

                  {request.reason && (
                    <p className="text-sm">
                      <span className="font-medium">Motif:</span> {request.reason}
                    </p>
                  )}

                  {request.reviewNotes && (
                    <div className="bg-muted p-3 rounded-md mt-2">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Note de révision:</span> {request.reviewNotes}
                      </p>
                    </div>
                  )}

                  {/* Justification Document - Show for all approved requests */}
                  {request.status === 'approved' && (
                    <div className="mt-3">
                      <EntityDocumentsSection
                        category="leave_justification"
                        entityId={request.id}
                        employeeId={employeeId}
                        label="Document justificatif"
                        helperText="Certificat médical ou autre document justificatif (optionnel)"
                        allowUpload={true}
                        className="bg-muted/30 p-3 rounded-md"
                      />
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Soumis le {format(new Date(request.submittedAt), 'PPP', { locale: fr })}
                  </p>
                </div>

                {/* Actions */}
                {isPending && (
                  <div className="flex flex-col gap-2 md:w-auto w-full">
                    {/* Employee can cancel their own pending requests */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cancelMutation.isPending}
                          className="min-h-[44px]"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Annuler
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Annuler la demande?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action ne peut pas être annulée. Vous devrez créer une nouvelle
                            demande si vous changez d'avis.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Non, garder</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleCancel(request.id)}>
                            Oui, annuler
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Manager actions (if canApprove) */}
                    {canApprove && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={approveMutation.isPending}
                          className="min-h-[44px]"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approuver
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(request.id)}
                          disabled={rejectMutation.isPending}
                          className="min-h-[44px]"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Rejeter
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
