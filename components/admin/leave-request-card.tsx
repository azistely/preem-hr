/**
 * Leave Request Card
 *
 * Displays a single time-off request for admin approval with:
 * - Employee info
 * - Leave type and dates
 * - Balance impact
 * - Conflict detection
 * - Approve/reject actions
 */

'use client';

import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Check,
  X,
  Calendar,
  AlertTriangle,
  FileText,
  Coins,
  Heart,
  Baby,
  Users,
  Plane,
  Home,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const policyTypeIcons: Record<string, typeof Calendar> = {
  annual_leave: Plane,
  sick_leave: Heart,
  maternity: Baby,
  paternity: Users,
  marriage: Home,
  bereavement: FileText,
  unpaid: Coins,
};

const policyTypeLabels: Record<string, string> = {
  annual_leave: 'Congé annuel',
  sick_leave: 'Congé maladie',
  maternity: 'Congé maternité',
  paternity: 'Congé paternité',
  marriage: 'Congé mariage',
  bereavement: 'Congé décès',
  unpaid: 'Congé sans solde',
};

export interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  };
  policy: {
    id: string;
    name: string;
    policyType: string;
  };
  startDate: string;
  endDate: string;
  totalDays: string;
  reason?: string | null;
  notes?: string | null;
  status: string;
  balance?: {
    balance: string;
    used: string;
    pending: string;
  } | null;
}

interface Conflict {
  employee: {
    firstName: string;
    lastName: string;
  };
  startDate: string;
  endDate: string;
}

interface LeaveRequestCardProps {
  request: LeaveRequest;
  conflicts?: Conflict[];
  onApprove: (requestId: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function LeaveRequestCard({
  request,
  conflicts = [],
  onApprove,
  onReject,
  isLoading = false,
}: LeaveRequestCardProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const employeeName = `${request.employee.firstName} ${request.employee.lastName}`;
  const initials = `${request.employee.firstName[0]}${request.employee.lastName[0]}`;

  const Icon =
    policyTypeIcons[request.policy.policyType] || Calendar;
  const policyLabel =
    policyTypeLabels[request.policy.policyType] || request.policy.name;

  // Calculate balance after approval
  const currentBalance = parseFloat(request.balance?.balance || '0');
  const totalDays = parseFloat(request.totalDays);
  const balanceAfter = currentBalance - totalDays;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(request.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;

    setIsSubmitting(true);
    try {
      await onReject(request.id, rejectionReason);
      setRejectDialogOpen(false);
      setRejectionReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={request.employee.photoUrl || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{employeeName}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {policyLabel}
                </CardDescription>
              </div>
            </div>

            {/* Conflict warning */}
            {conflicts.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Date range */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(request.startDate), 'd MMM', { locale: fr })}
                </p>
                <p className="text-xs text-muted-foreground">Début</p>
              </div>
            </div>

            <span className="text-muted-foreground">→</span>

            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {format(new Date(request.endDate), 'd MMM yyyy', {
                    locale: fr,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">Fin</p>
              </div>
            </div>

            <div className="ml-auto">
              <p className="text-lg font-bold">{totalDays} jours</p>
              <p className="text-xs text-muted-foreground">Demandés</p>
            </div>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium mb-1">Raison:</p>
              <p className="text-sm text-muted-foreground">{request.reason}</p>
            </div>
          )}

          {/* Balance impact */}
          {request.balance && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">
                  Impact sur le solde
                </p>
                <p className="text-xs text-blue-700">
                  {request.policy.name}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-900">
                    {currentBalance}
                  </p>
                  <p className="text-xs text-blue-700">Actuel</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-900">
                    -{totalDays}
                  </p>
                  <p className="text-xs text-blue-700">Demandé</p>
                </div>
                <div>
                  <p
                    className={`text-lg font-bold ${
                      balanceAfter < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    {balanceAfter.toFixed(1)}
                  </p>
                  <p className="text-xs text-blue-700">Restant</p>
                </div>
              </div>

              {balanceAfter < 0 && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Solde insuffisant après approbation
                </p>
              )}
            </div>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm font-medium text-red-900 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Employés déjà en congé sur cette période:
              </p>
              <ul className="space-y-1">
                {conflicts.map((conflict, index) => (
                  <li key={index} className="text-xs text-red-700">
                    {conflict.employee.firstName} {conflict.employee.lastName} (
                    {format(new Date(conflict.startDate), 'd MMM', {
                      locale: fr,
                    })}{' '}
                    -{' '}
                    {format(new Date(conflict.endDate), 'd MMM', {
                      locale: fr,
                    })}
                    )
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter className="gap-2">
          <Button
            className="min-h-[44px] flex-1"
            variant="default"
            onClick={handleApprove}
            disabled={isLoading || isSubmitting || request.status !== 'pending'}
          >
            <Check className="mr-2 h-5 w-5" />
            Approuver
          </Button>
          <Button
            className="min-h-[44px] flex-1"
            variant="outline"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isLoading || isSubmitting || request.status !== 'pending'}
          >
            <X className="mr-2 h-5 w-5" />
            Rejeter
          </Button>
        </CardFooter>
      </Card>

      {/* Rejection dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la demande de congé</DialogTitle>
            <DialogDescription>
              Pour {employeeName} -{' '}
              {format(new Date(request.startDate), 'dd/MM/yyyy', {
                locale: fr,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Raison du refus *</Label>
              <Textarea
                id="reason"
                placeholder="Expliquez pourquoi cette demande est refusée..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="min-h-[48px]"
              />
              <p className="text-xs text-muted-foreground">
                L'employé recevra cette explication.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isSubmitting}
              className="min-h-[44px]"
            >
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
