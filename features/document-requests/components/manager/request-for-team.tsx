'use client';

/**
 * Manager Request Document for Team Component
 *
 * Allows managers to request documents on behalf of their team members.
 * HCI Principles: Clear team selection, step-by-step wizard, on-behalf indicator
 */

import { useState } from 'react';
import { trpc as api } from '@/lib/trpc/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Users,
  User,
  FileText,
  Clock,
  Check,
  X,
  Loader2,
  FileStack,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCurrentEmployee } from '@/hooks/use-current-employee';
import { RequestDocumentWizard } from '../employee/request-document-wizard';
import { DocumentTypeLabels } from '@/lib/db/schema/document-requests';
import { cn } from '@/lib/utils';
import type { RouterOutputs } from '@/lib/trpc/client';

type TeamMember = RouterOutputs['employees']['getTeamMembers'][number];

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

export function RequestForTeam() {
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Get current manager's employee record
  const { employeeId: managerId, isLoading: managerLoading } = useCurrentEmployee();

  // Fetch team members
  const { data: teamMembers, isLoading: teamLoading } = api.employees.getTeamMembers.useQuery(
    { managerId: managerId || '' },
    { enabled: !!managerId }
  );

  // Fetch team requests
  const { data: teamRequests, isLoading: requestsLoading } = api.documentRequests.getTeamRequests.useQuery(
    { managerId: managerId ?? undefined },
    { enabled: !!managerId }
  );

  const isLoading = managerLoading || teamLoading;

  const handleSelectEmployee = (employee: TeamMember) => {
    setSelectedEmployee(employee);
    setShowWizard(true);
  };

  const handleWizardSuccess = () => {
    setShowWizard(false);
    setSelectedEmployee(null);
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setSelectedEmployee(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const activeTeamMembers = (teamMembers ?? []).filter((m) => m.status === 'active');
  const requests = teamRequests?.requests ?? [];

  return (
    <div className="space-y-8">
      {/* Team Members Selection */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Demander pour un membre de l'équipe</h2>
        </div>

        {activeTeamMembers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun membre d'équipe</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Aucun employé n'est assigné à votre équipe
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTeamMembers.map((employee) => (
              <Card
                key={employee.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSelectEmployee(employee)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          #{employee.employeeNumber}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="min-h-[36px]">
                      <Plus className="h-4 w-4 mr-1" />
                      Demander
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Team Requests History */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileStack className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Demandes de l'équipe</h2>
        </div>

        {requestsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileStack className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune demande</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Vous n'avez pas encore fait de demande pour votre équipe
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des demandes</CardTitle>
              <CardDescription>
                {requests.length} demande(s) pour votre équipe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.map((request) => {
                const status = statusConfig[request.status] ?? statusConfig.pending;
                const StatusIcon = status.icon;

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
                        <span className="font-medium">{request.employeeName}</span>
                        <Badge variant="outline">{request.employeeNumber}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {DocumentTypeLabels[request.documentType] || request.documentType}
                        </span>
                        <Badge variant={status.variant as any} className="flex items-center gap-1">
                          <StatusIcon
                            className={cn('h-3 w-3', request.status === 'processing' && 'animate-spin')}
                          />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Demandé{' '}
                        {formatDistanceToNow(new Date(request.submittedAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>

                      {request.rejectionReason && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                          <AlertCircle className="h-3 w-3 inline mr-1" />
                          {request.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Request Wizard Dialog */}
      {selectedEmployee && (
        <Dialog open={showWizard} onOpenChange={setShowWizard}>
          <DialogContent className="max-w-2xl p-0">
            <VisuallyHidden>
              <DialogTitle>
                Demander un document pour {selectedEmployee.firstName} {selectedEmployee.lastName}
              </DialogTitle>
            </VisuallyHidden>
            <RequestDocumentWizard
              employeeId={selectedEmployee.id}
              employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
              onSuccess={handleWizardSuccess}
              onCancel={handleWizardCancel}
              requestOnBehalfOf={true}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
