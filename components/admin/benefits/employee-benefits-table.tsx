/**
 * Employee Benefits Table Component
 *
 * Excel-like table showing all employees with their benefit enrollments.
 * Similar to Variable Pay Inputs page - allows viewing and managing benefits per employee.
 *
 * Features:
 * - Shows all active employees
 * - Displays current benefit enrollments as badges
 * - Add button to enroll in new benefits
 * - Edit/cancel enrollment actions
 * - Mobile-responsive
 *
 * HCI Principles:
 * - Large touch targets (min-h-[44px])
 * - Clear visual feedback
 * - Task-oriented design
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Edit, Heart, Smile, Eye, Shield, PiggyBank, AlertCircle, Car, UtensilsCrossed, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateEnrollmentDialog } from './create-enrollment-dialog';
import { EditEnrollmentDialog } from './edit-enrollment-dialog';
import { formatCurrency } from '@/lib/utils';

const benefitTypeIcons = {
  health: Heart,
  dental: Smile,
  vision: Eye,
  life_insurance: Shield,
  retirement: PiggyBank,
  disability: AlertCircle,
  transport: Car,
  meal: UtensilsCrossed,
  other: Package,
};

const benefitTypeLabels = {
  health: 'Santé',
  dental: 'Dentaire',
  vision: 'Vision',
  life_insurance: 'Assurance Vie',
  retirement: 'Retraite',
  disability: 'Invalidité',
  transport: 'Transport',
  meal: 'Restauration',
  other: 'Autre',
};

export function EmployeeBenefitsTable() {
  const { toast } = useToast();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    employeeId: string | null;
    employeeName: string;
  }>({
    open: false,
    employeeId: null,
    employeeName: '',
  });

  const [editEnrollmentId, setEditEnrollmentId] = useState<string | null>(null);

  // Fetch all employees with their enrollments
  const { data: employees, isLoading, refetch } = api.benefits.listEmployeesWithEnrollments.useQuery();

  // Cancel enrollment mutation
  const cancelMutation = api.benefits.cancelEnrollment.useMutation({
    onSuccess: () => {
      toast({
        title: 'Inscription annulée',
        description: 'L\'inscription a été annulée avec succès',
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

  const handleAddBenefit = (employeeId: string, employeeName: string) => {
    setDialogState({
      open: true,
      employeeId,
      employeeName,
    });
  };

  const handleCancelEnrollment = (enrollmentId: string, planName: string) => {
    if (confirm(`Êtes-vous sûr de vouloir annuler l'inscription au plan "${planName}" ?`)) {
      cancelMutation.mutate({ id: enrollmentId });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-12">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Aucun employé trouvé</p>
          <p className="text-sm text-muted-foreground">
            Ajoutez des employés pour gérer leurs avantages sociaux
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Employé</TableHead>
                <TableHead className="min-w-[120px]">N° Employé</TableHead>
                <TableHead className="min-w-[150px]">Poste</TableHead>
                <TableHead className="min-w-[400px]">Avantages Actuels</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const activeEnrollments = employee.enrollments?.filter(
                  (e) => e.enrollmentStatus === 'active'
                ) || [];

                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.employeeNumber || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {employee.position && 'title' in employee.position ? (employee.position as any).title : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {activeEnrollments.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            Aucun avantage
                          </span>
                        ) : (
                          activeEnrollments.map((enrollment) => {
                            // Skip if plan is null
                            if (!enrollment.plan) return null;

                            const Icon = benefitTypeIcons[enrollment.plan.benefitType as keyof typeof benefitTypeIcons] || Package;
                            const typeLabel = benefitTypeLabels[enrollment.plan.benefitType as keyof typeof benefitTypeLabels] || enrollment.plan.benefitType;

                            return (
                              <Badge
                                key={enrollment.id}
                                variant="secondary"
                                className="gap-2 py-1.5 px-3 cursor-pointer hover:bg-secondary/80 transition-colors"
                                onClick={() => setEditEnrollmentId(enrollment.id)}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <div className="flex flex-col items-start gap-0.5">
                                  <span className="font-medium text-xs">
                                    {enrollment.plan.planName}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {typeLabel} • {enrollment.plan.employeeCost ? formatCurrency(Number(enrollment.plan.employeeCost), enrollment.plan.currency || 'XOF') : 'Gratuit'}/mois
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 ml-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 hover:bg-primary hover:text-primary-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditEnrollmentId(enrollment.id);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (enrollment.plan) {
                                        handleCancelEnrollment(enrollment.id, enrollment.plan.planName);
                                      }
                                    }}
                                    disabled={cancelMutation.isPending}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] gap-2"
                        onClick={() => handleAddBenefit(employee.id, `${employee.firstName} ${employee.lastName}`)}
                      >
                        <Plus className="h-4 w-4" />
                        Inscrire
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create Enrollment Dialog */}
      {dialogState.employeeId && (
        <CreateEnrollmentDialog
          open={dialogState.open}
          onOpenChange={(open) => setDialogState({ ...dialogState, open })}
          employeeId={dialogState.employeeId}
          employeeName={dialogState.employeeName}
          onSuccess={() => {
            setDialogState({ open: false, employeeId: null, employeeName: '' });
            refetch();
          }}
        />
      )}

      {/* Edit Enrollment Dialog */}
      <EditEnrollmentDialog
        enrollmentId={editEnrollmentId}
        open={!!editEnrollmentId}
        onOpenChange={(open) => !open && setEditEnrollmentId(null)}
        onSuccess={() => {
          setEditEnrollmentId(null);
          refetch();
        }}
      />
    </>
  );
}
