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
import { format, parseISO } from 'date-fns';
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
  FileText,
  FileSpreadsheet,
  Building2,
  Landmark,
  Archive,
  Eye,
  ChevronDown,
  ChevronUp,
  Edit,
  Clock,
  Plane,
} from 'lucide-react';
import { api } from '@/trpc/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { PayrollEmployeeRow } from '@/features/payroll/components/payroll-employee-row';
import { EmployeePreviewStep } from '@/app/(shared)/payroll/runs/new/components/employee-preview-step';
import { EmployeeListCard } from '@/features/payroll/components/review/draft/employee-list-card';
import { EmployeeDetailSheet } from '@/features/payroll/components/review/employee-detail-sheet';
import { EmployeeDetailContent } from '@/features/payroll/components/review/draft/employee-detail-content';
import { DashboardSummaryCard } from '@/features/payroll/components/review/draft/dashboard-summary-card';
import { CalculatedReviewEnhancements } from './components/calculated-review-enhancements';

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
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [previewPayslip, setPreviewPayslip] = useState<{ employeeId: string; employeeName: string; pdfUrl: string } | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [recalculatingEmployeeId, setRecalculatingEmployeeId] = useState<string | null>(null);
  const [verifyingEmployeeId, setVerifyingEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string;
  } | null>(null);

  // Unwrap params promise (Next.js 15)
  const { id: runId } = use(params);

  // Get authenticated user from auth context
  const { data: user } = api.auth.me.useQuery();
  const userId = user?.id;

  // Load payroll run with line items
  const { data: run, isLoading, refetch } = api.payroll.getRun.useQuery({
    runId,
  });

  // Load verification statuses for calculated/processing runs
  const { data: verificationStatuses, refetch: refetchVerificationStatuses } = api.payrollReview.getVerificationStatus.useQuery(
    { runId },
    { enabled: !!run && (run.status === 'calculated' || run.status === 'processing') }
  );

  // Load available exports dynamically
  const { data: availableExports, isLoading: isLoadingExports } = api.payroll.getAvailableExports.useQuery({
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

  // Export mutations
  const exportCNPS = api.payroll.exportCNPS.useMutation();
  const exportCMU = api.payroll.exportCMU.useMutation();
  const exportEtat301 = api.payroll.exportEtat301.useMutation();
  const exportBankTransfer = api.payroll.exportBankTransfer.useMutation();
  const generatePayslip = api.payroll.generatePayslip.useMutation();
  const generateBulkPayslips = api.payroll.generateBulkPayslips.useMutation();
  const recalculateEmployee = api.payrollReview.recalculateEmployee.useMutation();

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR').format(Math.round(num));
  };

  // Helper to download base64 file
  const downloadFile = (base64Data: string, filename: string, contentType: string) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
    if (!userId) {
      alert('Utilisateur non authentifié');
      return;
    }

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

  // Generic export handler for dynamic exports
  const handleExport = async (exportId: string) => {
    if (!run) return;
    setIsExporting(exportId);
    try {
      let result;
      // Call appropriate export mutation based on ID
      switch (exportId) {
        case 'cnps':
          result = await exportCNPS.mutateAsync({ runId: run.id });
          break;
        case 'cmu':
          result = await exportCMU.mutateAsync({ runId: run.id });
          break;
        case 'etat301':
          result = await exportEtat301.mutateAsync({ runId: run.id });
          break;
        case 'bank_transfer':
          result = await exportBankTransfer.mutateAsync({ runId: run.id });
          break;
        default:
          throw new Error(`Export type ${exportId} not implemented`);
      }
      downloadFile(result.data, result.filename, result.contentType);
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  // Download individual payslip
  const handleDownloadPayslip = async (employeeId: string, employeeName: string) => {
    if (!run) return;

    try {
      const result = await generatePayslip.mutateAsync({
        runId: run.id,
        employeeId,
      });
      downloadFile(result.data, result.filename, result.contentType);
    } catch (error: any) {
      alert(`Erreur lors de la génération du bulletin: ${error.message}`);
    }
  };

  // Download all payslips as ZIP
  const handleDownloadAllPayslips = async () => {
    if (!run) return;

    try {
      const result = await generateBulkPayslips.mutateAsync({
        runId: run.id,
      });
      downloadFile(result.data, result.filename, result.contentType);
    } catch (error: any) {
      alert(`Erreur lors de la génération des bulletins: ${error.message}`);
    }
  };

  // Preview payslip
  const handlePreviewPayslip = async (employeeId: string, employeeName: string) => {
    if (!run) return;

    try {
      const result = await generatePayslip.mutateAsync({
        runId: run.id,
        employeeId,
      });

      // Convert base64 to blob URL for preview
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(blob);

      setPreviewPayslip({ employeeId, employeeName, pdfUrl });
    } catch (error: any) {
      alert(`Erreur lors de la génération du bulletin: ${error.message}`);
    }
  };

  // Close preview and cleanup
  const handleClosePreview = () => {
    if (previewPayslip?.pdfUrl) {
      URL.revokeObjectURL(previewPayslip.pdfUrl);
    }
    setPreviewPayslip(null);
  };

  // Recalculate individual employee
  const handleRecalculateEmployee = async (employeeId: string) => {
    if (!run) return;

    try {
      setRecalculatingEmployeeId(employeeId);
      const result = await recalculateEmployee.mutateAsync({
        runId: run.id,
        employeeId,
      });

      // Refetch the run to get updated data
      await refetch();

      // Show success message
      alert(`✅ Recalculé - ${result.before.netSalary} FCFA → ${result.after.netSalary} FCFA`);
    } catch (error: any) {
      alert(`Erreur lors du recalcul: ${error.message}`);
    } finally {
      setRecalculatingEmployeeId(null);
    }
  };

  // Mark individual employee as verified
  const markVerifiedMutation = api.payrollReview.markEmployeeVerified.useMutation({
    onSuccess: async () => {
      await refetch();
      await refetchVerificationStatuses();
      setVerifyingEmployeeId(null);
    },
  });

  const handleMarkVerifiedEmployee = async (employeeId: string) => {
    if (!user?.id || !run) return;

    try {
      setVerifyingEmployeeId(employeeId);
      await markVerifiedMutation.mutateAsync({
        runId: run.id,
        employeeId,
        verifiedBy: user.id,
      });
    } catch (error: any) {
      alert(`Erreur lors de la vérification: ${error.message}`);
    } finally {
      setVerifyingEmployeeId(null);
    }
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
              {run.name || format(parseISO(run.periodStart), 'MMMM yyyy', { locale: fr })}
            </h1>
            <p className="text-muted-foreground text-lg mt-2">
              {format(parseISO(run.periodStart), 'dd MMM', { locale: fr })} -{' '}
              {format(parseISO(run.periodEnd), 'dd MMM yyyy', { locale: fr })}
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
            <CardTitle className="text-sm font-medium">
              {status === 'draft' ? 'Employés Éligibles' : 'Employés Traités'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status === 'draft' ? 'À calculer' : (run.employeeCount || 0)}
            </div>
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
              {run.payDate ? format(parseISO(run.payDate), 'dd MMM yyyy', { locale: fr }) : '-'}
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

        {(status === 'approved' || status === 'paid') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Exports et Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Payslips Section */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-1">Bulletins de Paie</h3>
                  <p className="text-sm text-muted-foreground">
                    {run?.lineItems?.length || 0} bulletin{(run?.lineItems?.length || 0) > 1 ? 's' : ''} disponible{(run?.lineItems?.length || 0) > 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  onClick={handleDownloadAllPayslips}
                  disabled={generateBulkPayslips.isPending}
                  className="gap-2 w-full sm:w-auto min-h-[48px]"
                  size="lg"
                >
                  {generateBulkPayslips.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Archive className="h-5 w-5" />
                      Télécharger Tout (ZIP)
                    </>
                  )}
                </Button>
              </div>

              {/* Regulatory Exports Section */}
              {(isLoadingExports || (availableExports && availableExports.length > 0)) && (
                <div className="space-y-3 pt-3 border-t">
                  <div>
                    <h3 className="text-sm font-medium mb-1">Déclarations Réglementaires</h3>
                    <p className="text-sm text-muted-foreground">
                      Exports pour les organismes officiels
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {isLoadingExports ? (
                      <Button disabled variant="outline" className="gap-2 min-h-[48px]">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Chargement...
                      </Button>
                    ) : (
                      availableExports?.map((exportTemplate) => {
                        const getIcon = () => {
                          switch (exportTemplate.templateType) {
                            case 'social_security':
                              return Building2;
                            case 'health':
                              return FileSpreadsheet;
                            case 'tax':
                              return FileText;
                            case 'bank_transfer':
                              return Landmark;
                            default:
                              return Download;
                          }
                        };
                        const Icon = getIcon();

                        return (
                          <Button
                            key={exportTemplate.id}
                            onClick={() => handleExport(exportTemplate.id)}
                            disabled={isExporting !== null}
                            variant="outline"
                            className="gap-2 min-h-[48px] justify-start"
                          >
                            {isExporting === exportTemplate.id ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="truncate">Export...</span>
                              </>
                            ) : (
                              <>
                                <Icon className="h-5 w-5 flex-shrink-0" />
                                <span className="truncate">{exportTemplate.providerName}</span>
                              </>
                            )}
                          </Button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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

      {/* Draft Mode: Show Employee Review */}
      {status === 'draft' && (
        <div className="space-y-6 mb-6">
          {/* Dashboard Summary */}
          <DashboardSummaryCard runId={runId} />

          {/* Employee List */}
          <EmployeeListCard
            runId={runId}
            onEmployeeClick={(employee) => {
              setSelectedEmployee({
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
                employeeNumber: employee.employeeNumber,
              });
            }}
          />
        </div>
      )}

      {/* Employee Detail Sheet (Draft Mode) */}
      {selectedEmployee && (
        <EmployeeDetailSheet
          mode="draft"
          employee={selectedEmployee}
          open={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        >
          <EmployeeDetailContent
            employeeId={selectedEmployee.id}
            employeeName={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`}
            runId={runId}
            periodStart={new Date(run.periodStart)}
            periodEnd={new Date(run.periodEnd)}
          />
        </EmployeeDetailSheet>
      )}

      {/* Calculated/Processing Mode: Show Review Enhancements */}
      {(status === 'calculated' || status === 'processing') && (
        <div className="mb-8">
          <CalculatedReviewEnhancements
            runId={runId}
            userId={userId}
            status={status}
            totalEmployees={run.employeeCount || 0}
            totalNet={run.totalNet ? Number(run.totalNet) : undefined}
            onViewEmployeeDetails={(employeeId) => {
              setExpandedEmployeeId(expandedEmployeeId === employeeId ? null : employeeId);
            }}
            onApprove={handleApprove}
          />
        </div>
      )}

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
                  <TableHead className="text-right">Net à Payer</TableHead>
                  <TableHead>CNPS Employeur</TableHead>
                  <TableHead>FDFP</TableHead>
                  <TableHead>CMU</TableHead>
                  <TableHead>ITS</TableHead>
                  <TableHead className="text-right">Coût Total</TableHead>
                  {(status === 'approved' || status === 'paid') && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.lineItems.map((item) => {
                  const verificationStatus = verificationStatuses?.find(
                    (v) => v.employeeId === item.employeeId
                  )?.status as 'verified' | 'flagged' | 'unverified' | 'auto_ok' | undefined;

                  return (
                    <PayrollEmployeeRow
                      key={item.id}
                      item={item}
                      isExpanded={expandedEmployeeId === item.employeeId}
                      onToggle={() => setExpandedEmployeeId(expandedEmployeeId === item.employeeId ? null : item.employeeId)}
                      formatCurrency={formatCurrency}
                      status={status}
                      runId={run.id}
                      verificationStatus={verificationStatus}
                      onPreviewPayslip={handlePreviewPayslip}
                      onDownloadPayslip={handleDownloadPayslip}
                      isGeneratingPayslip={generatePayslip.isPending}
                      onRecalculateEmployee={handleRecalculateEmployee}
                      isRecalculating={recalculatingEmployeeId === item.employeeId}
                      onMarkVerified={handleMarkVerifiedEmployee}
                      isMarkingVerified={verifyingEmployeeId === item.employeeId}
                    />
                  );
                })}
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

      {/* Payslip Preview Dialog */}
      <Dialog open={!!previewPayslip} onOpenChange={(open) => !open && handleClosePreview()}>
        <DialogContent className="max-w-4xl h-[90vh] sm:h-[85vh] flex flex-col p-0 sm:p-6 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 border-b">
            <DialogTitle className="text-lg sm:text-xl pr-8">
              Bulletin de Paie - {previewPayslip?.employeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-4 py-3 sm:px-6 sm:py-4">
            {previewPayslip?.pdfUrl && (
              <iframe
                src={`${previewPayslip.pdfUrl}#toolbar=0`}
                className="w-full h-full border rounded"
                title="Aperçu du bulletin de paie"
              />
            )}
          </div>
          <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4 border-t">
            <Button
              size="default"
              variant="default"
              onClick={() => {
                if (previewPayslip) {
                  handleDownloadPayslip(previewPayslip.employeeId, previewPayslip.employeeName);
                }
              }}
              disabled={generatePayslip.isPending}
              className="min-h-[48px] gap-2 w-full"
            >
              <Download className="h-5 w-5" />
              Télécharger le Bulletin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
