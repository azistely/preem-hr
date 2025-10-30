/**
 * Employee Benefits Tab
 *
 * Displays employee benefit enrollments with status, dates, and details.
 */

'use client';

import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Calendar, FileText, Heart, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmployeeBenefitsTabProps {
  employeeId: string;
}

export function EmployeeBenefitsTab({ employeeId }: EmployeeBenefitsTabProps) {
  const { data: enrollments, isLoading } = trpc.benefits.listEnrollments.useQuery({
    employeeId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Heart className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucun avantage</p>
          <p className="text-sm text-muted-foreground text-center">
            Cet employé n'est inscrit à aucun plan d'avantages sociaux
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {enrollments.map((enrollment) => (
        <Card key={enrollment.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg">
                Plan #{enrollment.benefitPlanId.slice(0, 8)}
              </CardTitle>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Termination Info */}
            {enrollment.terminationDate && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="font-medium mb-1">
                    Résilié le {formatDate(enrollment.terminationDate)}
                  </div>
                  {enrollment.terminationReason && (
                    <div className="text-sm">{enrollment.terminationReason}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Notes */}
            {enrollment.notes && (
              <div className="text-sm p-3 bg-muted rounded-lg">
                <div className="font-medium mb-1">Notes:</div>
                <div className="text-muted-foreground">{enrollment.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
