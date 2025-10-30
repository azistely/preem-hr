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
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import { useEmployee, useReactivateEmployee } from '@/features/employees/hooks/use-employees';
import { useToast } from '@/hooks/use-toast';
import { EmployeeAvatar } from '@/features/employees/components/employee-avatar';
import { EmployeeStatusBadge } from '@/features/employees/components/employee-status-badge';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { formatCurrencyWithRate, convertMonthlyAmountToRateType, getGrossSalaryLabel } from '@/features/employees/utils/rate-type-labels';
import type { RateType } from '@/features/employees/utils/rate-type-labels';
import { TerminateEmployeeModal } from '@/features/employees/components/lifecycle/terminate-employee-modal';
import { SuspendEmployeeModal } from '@/features/employees/components/lifecycle/suspend-employee-modal';
import { TransferWizard } from '@/features/employees/components/transfer-wizard';
import { SalaryHistoryTimeline } from '@/features/employees/components/salary/salary-history-timeline';
import { SalaryChangeWizard } from '@/features/employees/components/salary/salary-change-wizard';
import { AssignmentHistoryTimeline } from '@/features/employees/components/assignment/assignment-history-timeline';
import { LeaveBalanceCard } from '@/features/time-off/components/leave-balance-card';
import { LeaveRequestList } from '@/features/time-off/components/leave-request-list';
import { TimeOffRequestForm } from '@/features/time-off/components/time-off-request-form';
import { TimeEntryCalendar } from '@/features/time-tracking/components/time-entry-calendar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CategoryBadge } from '@/components/employees/category-badge';
import { trpc } from '@/lib/trpc/client';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronDown } from 'lucide-react';
import { DependentsManager } from '@/features/employees/components/dependents-manager';
import { EmployeeBenefitsTab } from '@/components/employees/employee-benefits-tab';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const { toast } = useToast();

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showTransferWizard, setShowTransferWizard] = useState(false);
  const [showSalaryWizard, setShowSalaryWizard] = useState(false);
  const [showTimeOffRequestForm, setShowTimeOffRequestForm] = useState(false);

  const { data: employee, isLoading, error } = useEmployee(employeeId);
  const reactivateEmployee = useReactivateEmployee();

  // Salary history query - only fetch if employee has salary
  const { data: salaryHistory, isLoading: isLoadingSalaryHistory } = trpc.salaries.getHistory.useQuery(
    { employeeId: params.id as string },
    { enabled: !!(employee as any)?.currentSalary }
  );

  // Assignment history query
  const { data: assignmentHistory, isLoading: isLoadingAssignments } = trpc.assignments.getHistory.useQuery(
    { employeeId: params.id as string },
    { enabled: !!employee }
  );

  // Time-off queries
  const { data: timeOffBalances, isLoading: isLoadingBalances } = trpc.timeOff.getAllBalances.useQuery(
    { employeeId: params.id as string },
    { enabled: !!employee }
  );

  const { data: timeOffRequests, isLoading: isLoadingRequests } = trpc.timeOff.getEmployeeRequests.useQuery(
    { employeeId: params.id as string },
    { enabled: !!employee }
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
              <Link href={`/employees/${employeeId}/edit`}>
                <Button
                  variant="outline"
                  className="min-h-[44px] w-full"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Button>
              </Link>

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
                <p className="text-sm text-muted-foreground mb-1">
                  {getGrossSalaryLabel((employee as any).rateType as RateType)}
                </p>
                <p className="font-medium text-lg">
                  {(() => {
                    const rateType = (employee as any).rateType as RateType;
                    const baseSalary = parseFloat((employee as any).currentSalary.baseSalary);

                    // Calculate gross salary with rate conversion
                    let grossSalary = 0;
                    if ((employee as any).currentSalary.components && (employee as any).currentSalary.components.length > 0) {
                      // New components architecture
                      // Check if components include base salary (code '11')
                      const hasBaseSalaryInComponents = (employee as any).currentSalary.components.some(
                        (c: any) => c.code === '11' || c.code === '01'
                      );

                      if (hasBaseSalaryInComponents) {
                        // Components include base salary - use ONLY components total
                        grossSalary = (employee as any).currentSalary.components.reduce((sum: number, c: any) => {
                          // Base salary (code '11') is already in correct rate type
                          if (c.code === '11' || c.code === '01') {
                            return sum + (c.amount || 0);
                          }
                          // Convert other components from monthly to employee's rate type
                          return sum + convertMonthlyAmountToRateType(c.amount || 0, rateType);
                        }, 0);
                      } else {
                        // Legacy: components are only allowances, add to baseSalary
                        const componentTotal = (employee as any).currentSalary.components.reduce((sum: number, c: any) => {
                          return sum + convertMonthlyAmountToRateType(c.amount || 0, rateType);
                        }, 0);
                        grossSalary = baseSalary + componentTotal;
                      }
                    } else {
                      // Legacy allowances - these are stored as monthly, need conversion
                      const housingMonthly = (employee as any).currentSalary.housingAllowance || 0;
                      const transportMonthly = (employee as any).currentSalary.transportAllowance || 0;
                      const mealMonthly = (employee as any).currentSalary.mealAllowance || 0;

                      grossSalary = baseSalary +
                        convertMonthlyAmountToRateType(housingMonthly, rateType) +
                        convertMonthlyAmountToRateType(transportMonthly, rateType) +
                        convertMonthlyAmountToRateType(mealMonthly, rateType);
                    }

                    return formatCurrencyWithRate(grossSalary, rateType);
                  })()}
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
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
          <TabsTrigger value="dependents" className="min-h-[44px]">
            <Users className="mr-2 h-4 w-4" />
            Personnes à charge
          </TabsTrigger>
          <TabsTrigger value="benefits" className="min-h-[44px]">
            <Heart className="mr-2 h-4 w-4" />
            Avantages
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

          {/* Personnel Record Section */}
          {((employee as any).nationalityZone || (employee as any).employeeType || (employee as any).placeOfBirth || (employee as any).fatherName || (employee as any).motherName || (employee as any).emergencyContactName) && (
            <Card>
              <CardHeader>
                <CardTitle>Registre du Personnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(employee as any).nationalityZone && (
                    <div>
                      <div className="text-xs text-muted-foreground">Zone de nationalité</div>
                      <div className="text-sm font-medium">
                        {(employee as any).nationalityZone === 'LOCAL' && 'Local'}
                        {(employee as any).nationalityZone === 'CEDEAO' && 'CEDEAO'}
                        {(employee as any).nationalityZone === 'HORS_CEDEAO' && 'Hors CEDEAO'}
                      </div>
                    </div>
                  )}

                  {(employee as any).employeeType && (
                    <div>
                      <div className="text-xs text-muted-foreground">Type d'employé</div>
                      <div className="text-sm font-medium">
                        {(employee as any).employeeType === 'LOCAL' && 'Local'}
                        {(employee as any).employeeType === 'EXPAT' && 'Expatrié'}
                        {(employee as any).employeeType === 'DETACHE' && 'Détaché'}
                        {(employee as any).employeeType === 'STAGIAIRE' && 'Stagiaire'}
                      </div>
                    </div>
                  )}
                </div>

                {(employee as any).placeOfBirth && (
                  <div>
                    <div className="text-xs text-muted-foreground">Lieu de naissance</div>
                    <div className="text-sm font-medium">{(employee as any).placeOfBirth}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(employee as any).fatherName && (
                    <div>
                      <div className="text-xs text-muted-foreground">Nom du père</div>
                      <div className="text-sm font-medium">{(employee as any).fatherName}</div>
                    </div>
                  )}

                  {(employee as any).motherName && (
                    <div>
                      <div className="text-xs text-muted-foreground">Nom de la mère</div>
                      <div className="text-sm font-medium">{(employee as any).motherName}</div>
                    </div>
                  )}
                </div>

                {(employee as any).emergencyContactName && (
                  <div>
                    <div className="text-xs text-muted-foreground">Contact d'urgence</div>
                    <div className="text-sm font-medium">{(employee as any).emergencyContactName}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employment Classification Section */}
          {((employee as any).professionalLevel || (employee as any).sector || (employee as any).categoryCode || (employee as any).sectorCodeCgeci || (employee as any).coefficient) && (
            <Card>
              <CardHeader>
                <CardTitle>Classification Professionnelle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(employee as any).professionalLevel && (
                    <div>
                      <div className="text-xs text-muted-foreground">Niveau professionnel</div>
                      <div className="text-sm font-medium">Niveau {(employee as any).professionalLevel}</div>
                    </div>
                  )}

                  {(employee as any).sector && (
                    <div>
                      <div className="text-xs text-muted-foreground">Secteur</div>
                      <div className="text-sm font-medium capitalize">{(employee as any).sector}</div>
                    </div>
                  )}

                  {(employee as any).coefficient && (
                    <div>
                      <div className="text-xs text-muted-foreground">Coefficient</div>
                      <div className="text-sm font-medium">{(employee as any).coefficient}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(employee as any).categoryCode && (
                    <div>
                      <div className="text-xs text-muted-foreground">Code catégorie</div>
                      <div className="text-sm font-medium font-mono">{(employee as any).categoryCode}</div>
                    </div>
                  )}

                  {(employee as any).sectorCodeCgeci && (
                    <div>
                      <div className="text-xs text-muted-foreground">Code secteur CGECI</div>
                      <div className="text-sm font-medium font-mono">{(employee as any).sectorCodeCgeci}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Employment Tab */}
        <TabsContent value="employment" className="space-y-6">
          {/* Current Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Poste actuel</CardTitle>
            </CardHeader>
            <CardContent>
              {assignmentHistory && assignmentHistory.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Titre du poste</p>
                    <p className="font-medium text-lg">{(assignmentHistory[0] as any).position?.title || 'Non défini'}</p>
                  </div>

                  {/* Job Function and Trade */}
                  {((assignmentHistory[0] as any).position?.jobFunction || (assignmentHistory[0] as any).position?.jobTrade) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(assignmentHistory[0] as any).position?.jobFunction && (
                        <div>
                          <p className="text-sm text-muted-foreground">Fonction</p>
                          <p className="font-medium">{(assignmentHistory[0] as any).position.jobFunction}</p>
                        </div>
                      )}
                      {(assignmentHistory[0] as any).position?.jobTrade && (
                        <div>
                          <p className="text-sm text-muted-foreground">Métier</p>
                          <p className="font-medium">{(assignmentHistory[0] as any).position.jobTrade}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {(assignmentHistory[0] as any).position?.department?.name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Département</p>
                      <p className="font-medium">{(assignmentHistory[0] as any).position.department.name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Type d'affectation</p>
                    <div className="flex gap-2 items-center mt-1">
                      <Badge variant={
                        (assignmentHistory[0] as any).assignmentType === 'primary' ? 'default' :
                        (assignmentHistory[0] as any).assignmentType === 'secondary' ? 'secondary' :
                        'outline'
                      }>
                        {(assignmentHistory[0] as any).assignmentType === 'primary' ? 'Principal' :
                         (assignmentHistory[0] as any).assignmentType === 'secondary' ? 'Secondaire' :
                         'Temporaire'}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        depuis le {format(new Date((assignmentHistory[0] as any).effectiveFrom), 'PPP', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : isLoadingAssignments ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun poste assigné</p>
              )}
            </CardContent>
          </Card>

          {/* Assignment History Timeline */}
          {isLoadingAssignments ? (
            <Card>
              <CardContent className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : assignmentHistory && assignmentHistory.length > 0 ? (
            <AssignmentHistoryTimeline assignments={assignmentHistory as any} />
          ) : null}
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
                      {/* Base Salary Only - Always Show First */}
                      <div className="bg-primary/5 p-4 rounded-lg border">
                        <Label className="text-sm text-muted-foreground">
                          Salaire de base {(employee as any).rateType === 'DAILY' ? 'journalier' : (employee as any).rateType === 'HOURLY' ? 'horaire' : 'mensuel'}
                        </Label>
                        <p className="text-2xl font-bold">
                          {(() => {
                            const rateType = (employee as any).rateType as RateType;
                            // Extract base salary from components (Code 11 or 01)
                            const baseComponent = (employee as any).currentSalary.components.find(
                              (c: any) => c.code === '11' || c.code === '01'
                            );
                            const baseAmount = baseComponent?.amount || parseFloat((employee as any).currentSalary.baseSalary);
                            return formatCurrencyWithRate(baseAmount, rateType);
                          })()}
                        </p>
                      </div>

                      {/* Components Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(employee as any).currentSalary.components.map((component: any, idx: number) => {
                          const rateType = (employee as any).rateType as RateType;
                          // Base salary (code '11', '01') is already in correct rate type, others are monthly
                          const isBaseSalary = component.code === '11' || component.code === '01';
                          const displayAmount = isBaseSalary
                            ? component.amount
                            : convertMonthlyAmountToRateType(component.amount, rateType);

                          return (
                            <div key={idx}>
                              <Label className="text-sm text-muted-foreground">{component.name}</Label>
                              <p className="text-lg font-semibold">
                                {formatCurrencyWithRate(displayAmount, rateType)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total Gross Salary (Base + Allowances) */}
                      <div className="bg-muted/50 p-4 rounded-lg border-t">
                        <Label className="text-sm text-muted-foreground">
                          Salaire brut total {(employee as any).rateType === 'DAILY' ? 'journalier' : (employee as any).rateType === 'HOURLY' ? 'horaire' : 'mensuel'}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          (Base + indemnités)
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {(() => {
                            const rateType = (employee as any).rateType as RateType;
                            const components = (employee as any).currentSalary.components;

                            // Check if base salary (Code 11/01) is in components
                            const hasBaseSalaryInComponents = components.some(
                              (c: any) => c.code === '11' || c.code === '01'
                            );

                            // Calculate total from components
                            const componentsTotal = components.reduce(
                              (sum: number, c: any) => {
                                // Base salary (code '11', '01') is already in correct rate type
                                const isBaseSalary = c.code === '11' || c.code === '01';
                                const componentAmount = isBaseSalary
                                  ? c.amount
                                  : convertMonthlyAmountToRateType(c.amount || 0, rateType);

                                return sum + (componentAmount || 0);
                              },
                              0
                            );

                            // If base salary is NOT in components, add the baseSalary field
                            const totalGross = hasBaseSalaryInComponents
                              ? componentsTotal
                              : componentsTotal + parseFloat((employee as any).currentSalary.baseSalary);

                            return formatCurrencyWithRate(totalGross, rateType);
                          })()}
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
                <SalaryHistoryTimeline
                  history={salaryHistory as any}
                  rateType={(employee as any).rateType as RateType}
                />
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

        {/* Dependents Tab */}
        <TabsContent value="dependents" className="space-y-6">
          <DependentsManager
            employeeId={employeeId}
            tenantId={(employee as any)?.tenantId}
            onDependentsChange={async () => {
              // Optionally refresh employee data to update fiscal parts
              // The component already handles refetching its own data
            }}
          />
        </TabsContent>

        {/* Benefits Tab */}
        <TabsContent value="benefits" className="space-y-6">
          <EmployeeBenefitsTab employeeId={employeeId} />
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="space-y-6">
          {/* Leave Balance Summary */}
          {isLoadingBalances ? (
            <Card>
              <CardContent className="py-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : timeOffBalances && timeOffBalances.length > 0 ? (
            <LeaveBalanceCard balances={timeOffBalances as any} />
          ) : null}

          {/* Leave Requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Demandes de congés</CardTitle>
              <Button
                onClick={() => setShowTimeOffRequestForm(true)}
                className="min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle demande
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : timeOffRequests && timeOffRequests.length > 0 ? (
                <LeaveRequestList
                  requests={timeOffRequests as any}
                  employeeId={employeeId}
                  canApprove={false}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Aucune demande de congé
                </p>
              )}
            </CardContent>
          </Card>

          {/* Time Entries Calendar (Collapsible) */}
          <Collapsible>
            <Card>
              <CardHeader>
                <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80 transition-opacity">
                  <CardTitle>Pointages</CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <TimeEntryCalendar employeeId={employeeId} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>
      </Tabs>

      {/* Modals */}
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
            currentSalary={{
              ...(employee as any)?.currentSalary || {
                baseSalary: 0,
                housingAllowance: 0,
                transportAllowance: 0,
                mealAllowance: 0,
              },
              rateType: (employee as any)?.rateType || 'MONTHLY',
            }}
            employeeName={`${(employee as any)?.firstName} ${(employee as any)?.lastName}`}
            onSuccess={() => {
              setShowSalaryWizard(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Time-Off Request Form Modal */}
      <Dialog open={showTimeOffRequestForm} onOpenChange={setShowTimeOffRequestForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>Nouvelle demande de congé</DialogTitle>
          </VisuallyHidden>
          <TimeOffRequestForm
            employeeId={employeeId}
            onSuccess={() => {
              setShowTimeOffRequestForm(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
