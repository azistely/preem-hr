'use client';

/**
 * Payroll Runs Management Page
 *
 * Allows payroll managers to:
 * - View all payroll runs for their tenant
 * - Create new payroll runs
 * - Calculate payroll for all employees
 * - Review results before approval
 * - Track run status (draft, calculating, calculated, approved, paid)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  Plus,
  Play,
  Check,
  XCircle,
  Eye,
  Users,
  DollarSign,
  Clock
} from 'lucide-react';
import { api } from '@/trpc/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

type RunStatus = 'draft' | 'calculating' | 'calculated' | 'approved' | 'paid' | 'failed';

const statusConfig: Record<RunStatus, { label: string; variant: any; icon: any }> = {
  draft: { label: 'Brouillon', variant: 'secondary', icon: Clock },
  calculating: { label: 'En cours...', variant: 'default', icon: Play },
  calculated: { label: 'Calculé', variant: 'outline', icon: Check },
  approved: { label: 'Approuvé', variant: 'default', icon: Check },
  paid: { label: 'Payé', variant: 'default', icon: DollarSign },
  failed: { label: 'Erreur', variant: 'destructive', icon: XCircle },
};

export default function PayrollRunsPage() {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<RunStatus | 'all'>('all');

  // Get authenticated user from auth context
  const { data: user } = api.auth.me.useQuery();
  const tenantId = user?.tenantId;

  // Load payroll runs
  const { data: runs, isLoading, refetch } = api.payroll.listRuns.useQuery({
    tenantId: tenantId!,
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    limit: 50,
    offset: 0,
  }, {
    enabled: !!tenantId, // Only run query when tenantId is available
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  };

  const handleCreateRun = () => {
    router.push('/payroll/runs/new');
  };

  const handleViewRun = (runId: string) => {
    router.push(`/payroll/runs/${runId}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="h-8 w-8" />
            Paies Mensuelles
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            Gérez vos cycles de paie et traitez les salaires
          </p>
        </div>
        <Button onClick={handleCreateRun} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Nouvelle Paie
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paies ce Mois</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs?.filter(r => {
                const start = new Date(r.periodStart);
                const now = new Date();
                return start.getMonth() === now.getMonth() &&
                       start.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Paies actives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employés</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs?.reduce((acc, r) => acc + (r.employeeCount || 0), 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Employés traités</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {runs?.filter(r => r.status === 'draft' || r.status === 'calculating').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">À traiter</p>
          </CardContent>
        </Card>
      </div>

      {/* Runs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historique des Paies</CardTitle>
              <CardDescription>Liste de toutes les paies créées</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectedStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('all')}
              >
                Tous
              </Button>
              <Button
                variant={selectedStatus === 'draft' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('draft')}
              >
                Brouillon
              </Button>
              <Button
                variant={selectedStatus === 'calculated' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('calculated')}
              >
                Calculé
              </Button>
              <Button
                variant={selectedStatus === 'paid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus('paid')}
              >
                Payé
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : runs && runs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Employés</TableHead>
                  <TableHead>Total Brut</TableHead>
                  <TableHead>Total Net</TableHead>
                  <TableHead>Date Paiement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const StatusIcon = statusConfig[run.status as RunStatus]?.icon || Clock;
                  return (
                    <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div className="font-medium">
                          {run.name || format(new Date(run.periodStart), 'MMMM yyyy', { locale: fr })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(run.periodStart), 'dd MMM', { locale: fr })} -{' '}
                          {format(new Date(run.periodEnd), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[run.status as RunStatus]?.variant || 'secondary'}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[run.status as RunStatus]?.label || run.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {run.employeeCount || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {run.totalGross ? `${formatCurrency(Number(run.totalGross))} FCFA` : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {run.totalNet ? `${formatCurrency(Number(run.totalNet))} FCFA` : '-'}
                      </TableCell>
                      <TableCell>
                        {run.payDate ? format(new Date(run.payDate), 'dd MMM yyyy', { locale: fr }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewRun(run.id)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune paie trouvée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Créez votre première paie mensuelle
              </p>
              <Button onClick={handleCreateRun} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Créer une Paie
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
