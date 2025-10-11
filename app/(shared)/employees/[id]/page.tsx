/**
 * Employee Detail Page
 *
 * Full employee profile with tabs for different information sections
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Edit,
  UserX,
  Pause,
  Play,
  DollarSign,
  Users,
  Loader2,
  Clock,
  Briefcase,
  UserCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEmployee, useReactivateEmployee } from '@/features/employees/hooks/use-employees';
import { useToast } from '@/hooks/use-toast';
import { EmployeeAvatar } from '@/features/employees/components/employee-avatar';
import { EmployeeStatusBadge } from '@/features/employees/components/employee-status-badge';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { TerminateEmployeeModal } from '@/features/employees/components/lifecycle/terminate-employee-modal';
import { SuspendEmployeeModal } from '@/features/employees/components/lifecycle/suspend-employee-modal';
import { TransferWizard } from '@/features/employees/components/transfer-wizard';
import { EditEmployeeModal } from '@/features/employees/components/edit-employee-modal';
import { SalaryHistoryTimeline } from '@/features/employees/components/salary/salary-history-timeline';
import { SalaryChangeWizard } from '@/features/employees/components/salary/salary-change-wizard';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CategoryBadge } from '@/components/employees/category-badge';
import { trpc } from '@/lib/trpc/client';
import { Label } from '@/components/ui/label';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const { toast } = useToast();

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showTransferWizard, setShowTransferWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSalaryWizard, setShowSalaryWizard] = useState(false);

  const { data: employee, isLoading, error } = useEmployee(employeeId);
  const reactivateEmployee = useReactivateEmployee();

  // Salary history query - only fetch if employee has salary
  const { data: salaryHistory, isLoading: isLoadingSalaryHistory } = trpc.salaries.getHistory.useQuery(
    { employeeId: params.id as string },
    { enabled: !!(employee as any)?.currentSalary }
  );

  const handleReactivate = async () => {
    try {
      await reactivateEmployee.mutateAsync({ employeeId });
      toast({
        title: 'Employé réactivé',
        description: 'L\'employé a été réactivé avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la réactivation',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">
              Employé non trouvé ou erreur lors du chargement
            </p>
            <div className="flex justify-center mt-4">
              <Link href="/employees">
                <Button variant="outline">Retour à la liste</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/employees">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
        </Link>
      </div>

      {/* Employee Header Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <EmployeeAvatar
              firstName={(employee as any).firstName}
              lastName={(employee as any).lastName}
              photoUrl={(employee as any).photoUrl}
              size="lg"
            />

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {(employee as any).firstName} {(employee as any).lastName}
                </h1>
                <EmployeeStatusBadge status={(employee as any).status} />
              </div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-muted-foreground text-lg">
                  {(employee as any).employeeNumber}
                </p>
                <CategoryBadge
                  employeeId={employeeId}
                  showCoefficient={true}
                  showTooltip={true}
                  size="md"
                />
              </div>
              {(employee as any).currentPosition && (
                <p className="text-muted-foreground">
                  {(employee as any).currentPosition.title}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setShowEditModal(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </Button>

              {(employee as any).status === 'active' && (
                <>
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setShowTransferWizard(true)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 rotate-180" />
                    Transférer
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => setShowSuspendModal(true)}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Suspendre
                  </Button>
                  <Button
                    variant="destructive"
                    className="min-h-[44px]"
                    onClick={() => setShowTerminateModal(true)}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Terminer le contrat
                  </Button>
                </>
              )}

              {(employee as any).status === 'suspended' && (
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={handleReactivate}
                  disabled={reactivateEmployee.isPending}
                >
                  {reactivateEmployee.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Réactiver
                </Button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Date d'embauche</p>
              <p className="font-medium">
                {format(new Date((employee as any).hireDate), 'PPP', { locale: fr })}
              </p>
            </div>
            {(employee as any).currentSalary && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Salaire brut</p>
                <p className="font-medium text-lg">
                  {formatCurrency(
                    // New components architecture (preferred)
                    (employee as any).currentSalary.components && (employee as any).currentSalary.components.length > 0
                      ? (employee as any).currentSalary.components.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
                      : // Fallback to legacy allowances
                        (employee as any).currentSalary.baseSalary +
                        ((employee as any).currentSalary.housingAllowance || 0) +
                        ((employee as any).currentSalary.transportAllowance || 0) +
                        ((employee as any).currentSalary.mealAllowance || 0)
                  )}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Email</p>
              <p className="font-medium">{(employee as any).email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="overview" className="min-h-[44px]">
            <UserCircle className="mr-2 h-4 w-4" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="employment" className="min-h-[44px]">
            <Briefcase className="mr-2 h-4 w-4" />
            Emploi
          </TabsTrigger>
          <TabsTrigger value="salary" className="min-h-[44px]">
            <DollarSign className="mr-2 h-4 w-4" />
            Salaire
          </TabsTrigger>
          <TabsTrigger value="time" className="min-h-[44px]">
            <Clock className="mr-2 h-4 w-4" />
            Présence
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom complet</p>
                  <p className="font-medium">
                    {(employee as any).firstName} {(employee as any).lastName}
                  </p>
                </div>
                {(employee as any).preferredName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nom préféré</p>
                    <p className="font-medium">{(employee as any).preferredName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{(employee as any).email}</p>
                </div>
                {(employee as any).phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{(employee as any).phone}</p>
                  </div>
                )}
                {(employee as any).dateOfBirth && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date de naissance</p>
                    <p className="font-medium">
                      {format(new Date((employee as any).dateOfBirth), 'PPP', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {(employee as any).bankAccount && (
            <Card>
              <CardHeader>
                <CardTitle>Informations bancaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(employee as any).bankName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Banque</p>
                      <p className="font-medium">{(employee as any).bankName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Compte bancaire</p>
                    <p className="font-medium font-mono">{(employee as any).bankAccount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Poste actuel</CardTitle>
            </CardHeader>
            <CardContent>
              {(employee as any).currentPosition ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Titre du poste</p>
                    <p className="font-medium text-lg">{(employee as any).currentPosition.title}</p>
                  </div>
                  {(employee as any).currentPosition.department && (
                    <div>
                      <p className="text-sm text-muted-foreground">Département</p>
                      <p className="font-medium">{(employee as any).currentPosition.department}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun poste assigné</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Tab */}
        <TabsContent value="salary" className="space-y-6">
          {(employee as any).currentSalary ? (
            <>
              {/* Current Salary Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Salaire actuel</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      En vigueur depuis le {format(new Date((employee as any).currentSalary.effectiveFrom), 'PPP', { locale: fr })}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowSalaryWizard(true)}
                    className="min-h-[48px]"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* New Components Architecture */}
                  {(employee as any).currentSalary.components && (employee as any).currentSalary.components.length > 0 ? (
                    <>
                      {/* Components Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(employee as any).currentSalary.components.map((component: any, idx: number) => (
                          <div key={idx}>
                            <Label className="text-sm text-muted-foreground">{component.name}</Label>
                            <p className="text-lg font-semibold">
                              {formatCurrency(component.amount)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Total Gross Salary */}
                      <div className="bg-muted/50 p-4 rounded-lg border-t">
                        <Label className="text-sm text-muted-foreground">Salaire brut total</Label>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(
                            (employee as any).currentSalary.components.reduce(
                              (sum: number, c: any) => sum + (c.amount || 0),
                              0
                            )
                          )}
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Fallback to Legacy Allowances */
                    <>
                      {/* Base Salary - Prominent Display */}
                      <div>
                        <Label className="text-sm text-muted-foreground">Salaire de base</Label>
                        <p className="text-2xl font-bold">
                          {formatCurrency((employee as any).currentSalary.baseSalary)}
                        </p>
                      </div>

                      {/* Allowances - Show if any exist */}
                      {((employee as any).currentSalary.housingAllowance ||
                        (employee as any).currentSalary.transportAllowance ||
                        (employee as any).currentSalary.mealAllowance) && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                            {(employee as any).currentSalary.housingAllowance > 0 && (
                              <div>
                                <Label className="text-sm text-muted-foreground">Indemnité de logement</Label>
                                <p className="text-lg font-semibold">
                                  {formatCurrency((employee as any).currentSalary.housingAllowance)}
                                </p>
                              </div>
                            )}

                            {(employee as any).currentSalary.transportAllowance > 0 && (
                              <div>
                                <Label className="text-sm text-muted-foreground">Indemnité de transport</Label>
                                <p className="text-lg font-semibold">
                                  {formatCurrency((employee as any).currentSalary.transportAllowance)}
                                </p>
                              </div>
                            )}

                            {(employee as any).currentSalary.mealAllowance > 0 && (
                              <div>
                                <Label className="text-sm text-muted-foreground">Indemnité de repas</Label>
                                <p className="text-lg font-semibold">
                                  {formatCurrency((employee as any).currentSalary.mealAllowance)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Total Gross Salary */}
                          <div className="bg-muted/50 p-4 rounded-lg border-t">
                            <Label className="text-sm text-muted-foreground">Salaire brut total</Label>
                            <p className="text-2xl font-bold text-primary">
                              {formatCurrency(
                                (employee as any).currentSalary.baseSalary +
                                ((employee as any).currentSalary.housingAllowance || 0) +
                                ((employee as any).currentSalary.transportAllowance || 0) +
                                ((employee as any).currentSalary.mealAllowance || 0)
                              )}
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Salary History Timeline */}
              {isLoadingSalaryHistory ? (
                <Card>
                  <CardContent className="py-12 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : salaryHistory && salaryHistory.length > 0 ? (
                <SalaryHistoryTimeline history={salaryHistory as any} />
              ) : null}
            </>
          ) : (
            /* Empty State - No Salary */
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Aucun salaire enregistré</p>
                <Button
                  onClick={() => setShowSalaryWizard(true)}
                  className="min-h-[48px]"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Ajouter un salaire
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Présence et congés</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Module de présence à venir
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showEditModal && (
        <EditEmployeeModal
          employee={employee as any}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showTerminateModal && (
        <TerminateEmployeeModal
          employee={employee as any}
          open={showTerminateModal}
          onClose={() => setShowTerminateModal(false)}
        />
      )}

      {showSuspendModal && (
        <SuspendEmployeeModal
          employee={employee as any}
          open={showSuspendModal}
          onClose={() => setShowSuspendModal(false)}
        />
      )}

      {showTransferWizard && (
        <TransferWizard
          employee={employee as any}
          open={showTransferWizard}
          onClose={() => setShowTransferWizard(false)}
        />
      )}

      {/* Salary Change Wizard Modal */}
      <Dialog open={showSalaryWizard} onOpenChange={setShowSalaryWizard}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>Modifier le salaire</DialogTitle>
          </VisuallyHidden>
          <SalaryChangeWizard
            employeeId={employeeId}
            currentSalary={(employee as any)?.currentSalary || {
              baseSalary: 0,
              housingAllowance: 0,
              transportAllowance: 0,
              mealAllowance: 0,
            }}
            employeeName={`${(employee as any)?.firstName} ${(employee as any)?.lastName}`}
            onSuccess={() => {
              setShowSalaryWizard(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
