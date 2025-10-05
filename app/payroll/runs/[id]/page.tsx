'use client';

/**
 * Payroll Run Detail Page
 *
 * Displays detailed information about a specific payroll run:
 * - Run header: period, status, totals
 * - Line items table: employee name, gross, deductions, net
 * - Actions based on status:
 *   - Draft: "Calculate" button
 *   - Calculated/Processing: "Approve" button, "Recalculate" button
 *   - Approved: "Export" button (future)
 */

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  Play,
  Check,
  XCircle,
  Loader2,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle,
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
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

type RunStatus = 'draft' | 'calculating' | 'processing' | 'calculated' | 'approved' | 'paid' | 'failed';

const statusConfig: Record<RunStatus, { label: string; variant: any; icon: any; description: string }> = {
  draft: {
    label: 'Brouillon',
    variant: 'secondary',
    icon: Calendar,
    description: 'La paie n\'a pas encore été calculée',
  },
  calculating: {
    label: 'Calcul en cours...',
    variant: 'default',
    icon: Loader2,
    description: 'Le système calcule les salaires',
  },
  processing: {
    label: 'Calculé',
    variant: 'outline',
    icon: CheckCircle,
    description: 'Les salaires ont été calculés',
  },
  calculated: {
    label: 'Calculé',
    variant: 'outline',
    icon: CheckCircle,
    description: 'Les salaires ont été calculés',
  },
  approved: {
    label: 'Approuvé',
    variant: 'default',
    icon: Check,
    description: 'La paie a été approuvée',
  },
  paid: {
    label: 'Payé',
    variant: 'default',
    icon: DollarSign,
    description: 'Les salaires ont été versés',
  },
  failed: {
    label: 'Erreur',
    variant: 'destructive',
    icon: XCircle,
    description: 'Une erreur s\'est produite',
  },
};

export default function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [isCalculating, setIsCalculating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Unwrap params promise (Next.js 15)
  const { id: runId } = use(params);
  const userId = '00000000-0000-0000-0000-000000000001';

  // Load payroll run with line items
  const { data: run, isLoading, refetch } = api.payroll.getRun.useQuery({
    runId,
  });

  // Calculate run mutation
  const calculateRun = api.payroll.calculateRun.useMutation({
    onSuccess: async () => {
      setIsCalculating(false);
      await refetch();
    },
    onError: (error) => {
      setIsCalculating(false);
      alert(`Erreur: ${error.message}`);
    },
  });

  // Approve run mutation
  const approveRun = api.payroll.approveRun.useMutation({
    onSuccess: async () => {
      setIsApproving(false);
      await refetch();
    },
    onError: (error) => {
      setIsApproving(false);
      alert(`Erreur: ${error.message}`);
    },
  });

  // Delete run mutation
  const deleteRun = api.payroll.deleteRun.useMutation({
    onSuccess: () => {
      router.push('/payroll/runs');
    },
    onError: (error) => {
      setIsDeleting(false);
      alert(`Erreur: ${error.message}`);
    },
  });

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR').format(Math.round(num));
  };

  const handleCalculate = async () => {
    if (!run) return;

    const confirmed = confirm(
      'Lancer le calcul de la paie pour tous les employés actifs ?'
    );

    if (confirmed) {
      setIsCalculating(true);
      await calculateRun.mutateAsync({ runId: run.id });
    }
  };

  const handleApprove = async () => {
    if (!run) return;

    const confirmed = confirm(
      'Approuver cette paie ? Une fois approuvée, elle ne pourra plus être modifiée.'
    );

    if (confirmed) {
      setIsApproving(true);
      await approveRun.mutateAsync({
        runId: run.id,
        approvedBy: userId,
      });
    }
  };

  const handleDelete = async () => {
    if (!run) return;

    const confirmed = confirm(
      'Supprimer cette paie ? Cette action est irréversible.'
    );

    if (confirmed) {
      setIsDeleting(true);
      await deleteRun.mutateAsync({ runId: run.id });
    }
  };

  const handleBack = () => {
    router.push('/payroll/runs');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-12 w-64 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">Paie introuvable</p>
                <p className="text-sm">La paie demandée n'existe pas ou a été supprimée.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = run.status as RunStatus;
  const StatusIcon = statusConfig[status]?.icon || Calendar;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux paies
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Calendar className="h-8 w-8" />
              {run.name || format(new Date(run.periodStart), 'MMMM yyyy', { locale: fr })}
            </h1>
            <p className="text-muted-foreground text-lg mt-2">
              {format(new Date(run.periodStart), 'dd MMM', { locale: fr })} -{' '}
              {format(new Date(run.periodEnd), 'dd MMM yyyy', { locale: fr })}
            </p>
          </div>
          <Badge variant={statusConfig[status]?.variant || 'secondary'} className="text-lg px-4 py-2">
            <StatusIcon className={`h-4 w-4 mr-2 ${status === 'calculating' ? 'animate-spin' : ''}`} />
            {statusConfig[status]?.label || status}
          </Badge>
        </div>
      </div>

      {/* Status Info */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <StatusIcon className={`h-5 w-5 mt-0.5 ${status === 'calculating' ? 'animate-spin' : ''}`} />
            <div>
              <p className="font-semibold">{statusConfig[status]?.label}</p>
              <p className="text-sm text-muted-foreground">
                {statusConfig[status]?.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employés</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{run.employeeCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Brut</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {run.totalGross ? `${formatCurrency(run.totalGross)} FCFA` : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Net</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {run.totalNet ? `${formatCurrency(run.totalNet)} FCFA` : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Date Paiement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {run.payDate ? format(new Date(run.payDate), 'dd MMM yyyy', { locale: fr }) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-8">
        {status === 'draft' && (
          <Button
            onClick={handleCalculate}
            disabled={isCalculating}
            className="gap-2"
            size="lg"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Calcul en cours...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Calculer la Paie
              </>
            )}
          </Button>
        )}

        {(status === 'processing' || status === 'calculated') && (
          <>
            <Button
              onClick={handleApprove}
              disabled={isApproving}
              className="gap-2"
              size="lg"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Approbation...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Approuver
                </>
              )}
            </Button>
            <Button
              onClick={handleCalculate}
              disabled={isCalculating}
              variant="outline"
              className="gap-2"
              size="lg"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Recalcul...
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  Recalculer
                </>
              )}
            </Button>
          </>
        )}

        {status === 'approved' && (
          <Button disabled variant="outline" className="gap-2" size="lg">
            <Download className="h-5 w-5" />
            Exporter (Bientôt)
          </Button>
        )}

        {status === 'draft' && (
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            variant="destructive"
            className="gap-2 ml-auto"
            size="lg"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="h-5 w-5" />
                Supprimer
              </>
            )}
          </Button>
        )}
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Détails des Salaires</CardTitle>
          <CardDescription>
            Liste des employés avec leurs salaires calculés
          </CardDescription>
        </CardHeader>
        <CardContent>
          {run.lineItems && run.lineItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Salaire Base</TableHead>
                  <TableHead>Brut</TableHead>
                  <TableHead>CNPS</TableHead>
                  <TableHead>CMU</TableHead>
                  <TableHead>ITS</TableHead>
                  <TableHead>Total Déductions</TableHead>
                  <TableHead className="text-right">Net à Payer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.lineItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.employeeName || '-'}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.employeeNumber || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.baseSalary ? `${formatCurrency(item.baseSalary)} FCFA` : '-'}
                    </TableCell>
                    <TableCell>
                      {item.grossSalary ? `${formatCurrency(item.grossSalary)} FCFA` : '-'}
                    </TableCell>
                    <TableCell>
                      {item.cnpsEmployee ? `-${formatCurrency(item.cnpsEmployee)} FCFA` : '-'}
                    </TableCell>
                    <TableCell>
                      {item.cmuEmployee ? `-${formatCurrency(item.cmuEmployee)} FCFA` : '-'}
                    </TableCell>
                    <TableCell>
                      {item.its ? `-${formatCurrency(item.its)} FCFA` : '-'}
                    </TableCell>
                    <TableCell>
                      {item.totalDeductions ? `-${formatCurrency(item.totalDeductions)} FCFA` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.netSalary ? `${formatCurrency(item.netSalary)} FCFA` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun employé traité</p>
              <p className="text-sm text-muted-foreground mt-1">
                {status === 'draft'
                  ? 'Cliquez sur "Calculer la Paie" pour traiter les salaires'
                  : 'Les données de paie ne sont pas disponibles'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
