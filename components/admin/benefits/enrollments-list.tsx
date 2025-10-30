/**
 * Enrollments List Component
 *
 * Displays employee benefit enrollments with filtering and status management.
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Calendar, DollarSign, XCircle, Loader2, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

export function EnrollmentsList() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'active' | 'pending' | 'terminated' | 'suspended' | 'all'>('active');

  // Fetch enrollments
  const {
    data: enrollments,
    isLoading,
    refetch,
  } = api.benefits.listEnrollments.useQuery({
    enrollmentStatus: statusFilter === 'all' ? undefined : statusFilter,
  });

  // Terminate mutation
  const terminateMutation = api.benefits.terminateEnrollment.useMutation({
    onSuccess: () => {
      toast({
        title: 'Inscription résiliée',
        description: 'L\'inscription a été résiliée avec succès',
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleTerminate = (enrollmentId: string) => {
    const reason = prompt('Raison de la résiliation:');
    if (!reason) return;

    terminateMutation.mutate({
      id: enrollmentId,
      terminationDate: new Date().toISOString().split('T')[0],
      terminationReason: reason,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Statut</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="terminated">Résiliés</SelectItem>
              <SelectItem value="suspended">Suspendus</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Enrollments List */}
      {!enrollments || enrollments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Aucune inscription trouvée</p>
            <p className="text-sm text-muted-foreground">
              Inscrivez des employés aux plans d'avantages
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enrollments.map((enrollment) => (
            <Card key={enrollment.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">
                      Inscription #{enrollment.id.slice(0, 8)}
                    </CardTitle>
                    <CardDescription>
                      Employé: {enrollment.employeeId.slice(0, 8)}...
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      enrollment.enrollmentStatus === 'active'
                        ? 'default'
                        : enrollment.enrollmentStatus === 'pending'
                        ? 'secondary'
                        : enrollment.enrollmentStatus === 'terminated'
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    {enrollment.enrollmentStatus === 'active' && 'Actif'}
                    {enrollment.enrollmentStatus === 'pending' && 'En attente'}
                    {enrollment.enrollmentStatus === 'terminated' && 'Résilié'}
                    {enrollment.enrollmentStatus === 'suspended' && 'Suspendu'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Date d'inscription</div>
                      <div className="text-muted-foreground">
                        {formatDate(enrollment.enrollmentDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Date d'effet</div>
                      <div className="text-muted-foreground">
                        {formatDate(enrollment.effectiveDate)}
                      </div>
                    </div>
                  </div>
                  {enrollment.terminationDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-destructive" />
                      <div>
                        <div className="font-medium">Date de résiliation</div>
                        <div className="text-muted-foreground">
                          {formatDate(enrollment.terminationDate)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Enrollment Number (N° CMU, etc.) */}
                {enrollment.enrollmentNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">N° d'inscription:</span>
                    <span>{enrollment.enrollmentNumber}</span>
                  </div>
                )}

                {/* Coverage Level */}
                {enrollment.coverageLevel && (
                  <div className="text-sm">
                    <span className="font-medium">Niveau de couverture:</span>{' '}
                    {enrollment.coverageLevel === 'individual' && 'Individuel'}
                    {enrollment.coverageLevel === 'family' && 'Familial'}
                    {enrollment.coverageLevel === 'employee_spouse' && 'Employé + Conjoint'}
                    {enrollment.coverageLevel === 'employee_children' && 'Employé + Enfants'}
                  </div>
                )}

                {/* Costs */}
                {(enrollment.employeeCostOverride || enrollment.employerCostOverride) && (
                  <div className="flex gap-6 text-sm pt-2 border-t">
                    {enrollment.employeeCostOverride && (
                      <div>
                        <div className="text-muted-foreground">Coût Employé:</div>
                        <div className="font-medium">
                          {formatCurrency(Number(enrollment.employeeCostOverride), 'XOF')}
                        </div>
                      </div>
                    )}
                    {enrollment.employerCostOverride && (
                      <div>
                        <div className="text-muted-foreground">Coût Employeur:</div>
                        <div className="font-medium">
                          {formatCurrency(Number(enrollment.employerCostOverride), 'XOF')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Termination Reason */}
                {enrollment.terminationReason && (
                  <div className="text-sm p-3 bg-destructive/10 rounded-lg">
                    <div className="font-medium text-destructive mb-1">
                      Raison de la résiliation:
                    </div>
                    <div className="text-muted-foreground">
                      {enrollment.terminationReason}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {enrollment.notes && (
                  <div className="text-sm p-3 bg-muted rounded-lg">
                    <div className="font-medium mb-1">Notes:</div>
                    <div className="text-muted-foreground">{enrollment.notes}</div>
                  </div>
                )}

                {/* Actions */}
                {enrollment.enrollmentStatus === 'active' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleTerminate(enrollment.id)}
                      disabled={terminateMutation.isPending}
                    >
                      {terminateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Résilier
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
