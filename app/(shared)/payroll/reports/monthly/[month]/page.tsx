'use client';

/**
 * Monthly Payroll Reports Page
 *
 * Displays consolidated monthly payroll data:
 * - Month summary: total runs, employees, gross/net
 * - List of all approved/paid runs for the month
 * - Monthly export buttons: CNPS, CMU, État 301
 *
 * Critical for CDDTI employees who have multiple runs per month.
 * Monthly aggregation ensures correct CNPS 21-day threshold calculation.
 */

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Users,
  DollarSign,
  Download,
  FileSpreadsheet,
  Building2,
  Landmark,
  Heart,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
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

export default function MonthlyReportsPage({ params }: { params: Promise<{ month: string }> }) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Unwrap params promise (Next.js 15)
  const { month } = use(params);

  // Load monthly summary
  const { data: summary, isLoading } = api.payroll.getMonthlyPayrollSummary.useQuery({
    month,
  });

  // Export mutations
  const exportCNPS = api.payroll.exportCNPSMonthly.useMutation({
    onSuccess: (data) => {
      const blob = new Blob(
        [Buffer.from(data.data, 'base64')],
        { type: data.contentType }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setIsExporting(null);
    },
    onError: (error) => {
      console.error('Export CNPS failed:', error);
      alert(`Erreur lors de l'export CNPS: ${error.message}`);
      setIsExporting(null);
    },
  });

  const exportCMU = api.payroll.exportCMUMonthly.useMutation({
    onSuccess: (data) => {
      const blob = new Blob(
        [Buffer.from(data.data, 'base64')],
        { type: data.contentType }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setIsExporting(null);
    },
    onError: (error) => {
      console.error('Export CMU failed:', error);
      alert(`Erreur lors de l'export CMU: ${error.message}`);
      setIsExporting(null);
    },
  });

  const exportEtat301 = api.payroll.exportEtat301Monthly.useMutation({
    onSuccess: (data) => {
      const blob = new Blob(
        [Buffer.from(data.data, 'base64')],
        { type: data.contentType }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setIsExporting(null);
    },
    onError: (error) => {
      console.error('Export État 301 failed:', error);
      alert(`Erreur lors de l'export État 301: ${error.message}`);
      setIsExporting(null);
    },
  });

  const handleExport = async (type: 'cnps' | 'cmu' | 'etat301') => {
    setIsExporting(type);
    try {
      if (type === 'cnps') {
        await exportCNPS.mutateAsync({ month });
      } else if (type === 'cmu') {
        await exportCMU.mutateAsync({ month });
      } else if (type === 'etat301') {
        await exportEtat301.mutateAsync({ month });
      }
    } catch (error) {
      // Error already handled in mutation callbacks
    }
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year || '0'), parseInt(month || '0') - 1, 1);
    return format(date, 'MMMM yyyy', { locale: fr });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!summary || summary.runs.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/payroll/runs')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold capitalize">{formatMonth(month)}</h1>
              <p className="text-sm text-muted-foreground">Rapports mensuels</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Aucune paie trouvée
            </CardTitle>
            <CardDescription>
              Aucune paie approuvée ou payée n'a été trouvée pour ce mois.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/payroll/runs')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold capitalize">{formatMonth(month)}</h1>
            <p className="text-sm text-muted-foreground">
              {summary.runs.length} paie{summary.runs.length > 1 ? 's' : ''} • {summary.employeeCount} employé{summary.employeeCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Brut
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalGross)}</div>
            <p className="text-xs text-muted-foreground">
              Pour {summary.employeeCount} employé{summary.employeeCount > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Net
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalNet)}</div>
            <p className="text-xs text-muted-foreground">
              À verser aux employés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paies du mois
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.runs.length}</div>
            <p className="text-xs text-muted-foreground">
              {summary.runs.filter(r => r.status === 'approved').length} approuvée{summary.runs.filter(r => r.status === 'approved').length > 1 ? 's' : ''} • {summary.runs.filter(r => r.status === 'paid').length} payée{summary.runs.filter(r => r.status === 'paid').length > 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Exports Section */}
      <Card>
        <CardHeader>
          <CardTitle>Exports mensuels consolidés</CardTitle>
          <CardDescription>
            Déclarations mensuelles pour CNPS, CMU et DGI (État 301).
            Ces exports consolident toutes les paies du mois automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => handleExport('cnps')}
              disabled={!!isExporting}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-semibold">CNPS</span>
                </div>
                {isExporting === 'cnps' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </div>
              <p className="text-xs text-left text-muted-foreground">
                Appel à cotisation mensuel CNPS
              </p>
              <Badge variant="secondary" className="text-xs">
                <CheckCircle className="mr-1 h-3 w-3" />
                Règle CDDTI 21 jours appliquée
              </Badge>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => handleExport('cmu')}
              disabled={!!isExporting}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  <span className="font-semibold">CMU</span>
                </div>
                {isExporting === 'cmu' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </div>
              <p className="text-xs text-left text-muted-foreground">
                Déclaration cotisation mensuel CMU
              </p>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4"
              onClick={() => handleExport('etat301')}
              disabled={!!isExporting}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" />
                  <span className="font-semibold">État 301</span>
                </div>
                {isExporting === 'etat301' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </div>
              <p className="text-xs text-left text-muted-foreground">
                Déclaration des impots sur les salaires mensuels
              </p>
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div className="space-y-1 text-sm">
                <p className="font-medium">À propos des exports mensuels</p>
                <p className="text-muted-foreground">
                  Ces exports consolident automatiquement toutes les paies approuvées/payées du mois.
                  Pour les employés CDDTI avec plusieurs paies dans le mois, la règle des 21 jours
                  est calculée sur le total mensuel (pas par paie individuelle).
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Paies du mois</CardTitle>
          <CardDescription>
            Liste de toutes les paies approuvées ou payées pour ce mois
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Période</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-right">Employés</TableHead>
                <TableHead className="text-right">Total brut</TableHead>
                <TableHead className="text-right">Total net</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.runs.map((run) => (
                <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {format(new Date(run.periodStart), 'dd MMM', { locale: fr })} - {format(new Date(run.periodEnd), 'dd MMM yyyy', { locale: fr })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Paiement: {format(new Date(run.payDate), 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {run.name || `Paie ${format(new Date(run.periodStart), 'MMMM yyyy', { locale: fr })}`}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {run.employeeCount || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(parseFloat(run.totalGross?.toString() || '0'))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(parseFloat(run.totalNet?.toString() || '0'))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={run.status === 'paid' ? 'default' : 'secondary'}>
                      {run.status === 'paid' ? 'Payé' : 'Approuvé'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/payroll/runs/${run.id}`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Voir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
