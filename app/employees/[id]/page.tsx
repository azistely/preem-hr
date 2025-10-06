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
import { SalaryHistoryTimeline } from '@/features/employees/components/salary/salary-history-timeline';
import { TerminateEmployeeModal } from '@/features/employees/components/lifecycle/terminate-employee-modal';
import { SuspendEmployeeModal } from '@/features/employees/components/lifecycle/suspend-employee-modal';
import { TransferWizard } from '@/features/employees/components/transfer-wizard';
import { EditEmployeeModal } from '@/features/employees/components/edit-employee-modal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const { toast } = useToast();

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showTransferWizard, setShowTransferWizard] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: employee, isLoading, error } = useEmployee(employeeId);
  const reactivateEmployee = useReactivateEmployee();

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
              firstName={employee.firstName}
              lastName={employee.lastName}
              photoUrl={employee.photoUrl}
              size="lg"
            />

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {employee.firstName} {employee.lastName}
                </h1>
                <EmployeeStatusBadge status={employee.status} />
              </div>
              <p className="text-muted-foreground text-lg mb-1">
                {employee.employeeNumber}
              </p>
              {employee.currentPosition && (
                <p className="text-muted-foreground">
                  {employee.currentPosition.title}
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

              {employee.status === 'active' && (
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

              {employee.status === 'suspended' && (
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
                {format(new Date(employee.hireDate), 'PPP', { locale: fr })}
              </p>
            </div>
            {employee.currentSalary && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Salaire brut</p>
                <p className="font-medium text-lg">
                  {formatCurrency(employee.currentSalary.baseSalary)}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Email</p>
              <p className="font-medium">{employee.email}</p>
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
                    {employee.firstName} {employee.lastName}
                  </p>
                </div>
                {employee.preferredName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Nom préféré</p>
                    <p className="font-medium">{employee.preferredName}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{employee.email}</p>
                </div>
                {employee.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{employee.phone}</p>
                  </div>
                )}
                {employee.dateOfBirth && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date de naissance</p>
                    <p className="font-medium">
                      {format(new Date(employee.dateOfBirth), 'PPP', { locale: fr })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {employee.bankAccount && (
            <Card>
              <CardHeader>
                <CardTitle>Informations bancaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employee.bankName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Banque</p>
                      <p className="font-medium">{employee.bankName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Compte bancaire</p>
                    <p className="font-medium font-mono">{employee.bankAccount}</p>
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
              {employee.currentPosition ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Titre du poste</p>
                    <p className="font-medium text-lg">{employee.currentPosition.title}</p>
                  </div>
                  {employee.currentPosition.department && (
                    <div>
                      <p className="text-sm text-muted-foreground">Département</p>
                      <p className="font-medium">{employee.currentPosition.department}</p>
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
          <SalaryHistoryTimeline employeeId={employeeId} />
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
          employee={employee}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showTerminateModal && (
        <TerminateEmployeeModal
          employee={employee}
          open={showTerminateModal}
          onClose={() => setShowTerminateModal(false)}
        />
      )}

      {showSuspendModal && (
        <SuspendEmployeeModal
          employee={employee}
          open={showSuspendModal}
          onClose={() => setShowSuspendModal(false)}
        />
      )}

      {showTransferWizard && (
        <TransferWizard
          employee={employee}
          open={showTransferWizard}
          onClose={() => setShowTransferWizard(false)}
        />
      )}
    </div>
  );
}
