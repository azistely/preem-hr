'use client';

/**
 * CNPS Monthly Contribution Declaration Page
 *
 * Displays and allows editing of the official CNPS contribution form.
 * Users can:
 * - Select month/year to view
 * - See automatically calculated data
 * - Edit values if corrections are needed
 * - Export to PDF for submission to CNPS
 */

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Download,
  Edit,
  Save,
  RefreshCw,
  Calendar,
  Building2,
  Users,
  DollarSign,
  FileText,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';

// ========================================
// Helper Functions
// ========================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

function formatMonth(month: number): string {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return monthNames[month - 1];
}

// ========================================
// Page Component
// ========================================

export default function CNPSDeclarationPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [countryCode] = useState<string>('CI'); // Default to Côte d'Ivoire
  const [cnpsFilter, setCnpsFilter] = useState<'all' | 'with_cnps' | 'without_cnps'>('with_cnps');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch declaration data
  const {
    data: declarationResponse,
    isLoading,
    error,
    refetch,
  } = trpc.payroll.getCNPSDeclarationData.useQuery({
    month: selectedMonth,
    year: selectedYear,
    countryCode,
    cnpsFilter,
  });

  // Mutations
  const saveEditsMutation = trpc.payroll.saveCNPSDeclarationEdits.useMutation({
    onSuccess: () => {
      toast.success('Modifications enregistrées avec succès');
      setIsEditMode(false);
      setHasUnsavedChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const exportPDFMutation = trpc.payroll.exportCNPSDeclarationPDF.useMutation({
    onSuccess: (result) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(result.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('PDF téléchargé avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur lors de l'export PDF: ${error.message}`);
    },
  });

  // Local state for editable values
  const [editedData, setEditedData] = React.useState<any>(null);

  React.useEffect(() => {
    if (declarationResponse?.data) {
      setEditedData(declarationResponse.data);
    }
  }, [declarationResponse]);

  // Handle value changes
  const handleValueChange = (path: string, value: number) => {
    if (!editedData) return;

    setHasUnsavedChanges(true);

    // Update nested value using path (e.g., "monthlyWorkers.category1.employeeCount")
    const keys = path.split('.');
    const newData = { ...editedData };
    let current: any = newData;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    setEditedData(newData);
  };

  const handleSaveEdits = () => {
    if (!editedData || !declarationResponse?.data) return;

    // Calculate which fields were edited
    const edits: any = {};
    // For simplicity, we'll send the entire edited data
    // In production, you might want to diff and send only changes

    saveEditsMutation.mutate({
      month: selectedMonth,
      year: selectedYear,
      countryCode,
      originalData: declarationResponse.data,
      edits: editedData,
      editReason: editReason || undefined,
    });
  };

  const handleExportPDF = () => {
    exportPDFMutation.mutate({
      month: selectedMonth,
      year: selectedYear,
      countryCode,
    });
  };

  const handleResetEdits = () => {
    if (declarationResponse?.data) {
      setEditedData(declarationResponse.data);
      setHasUnsavedChanges(false);
      setIsEditMode(false);
    }
  };

  // Generate year options (current year - 2 to current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  const data = editedData || declarationResponse?.data;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Déclaration CNPS Mensuelle</h1>
          <p className="text-muted-foreground mt-2">
            Appel de cotisation mensuel pour la Caisse Nationale de Prévoyance Sociale
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/payroll/runs')}
        >
          Retour aux paies
        </Button>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Période de déclaration
          </CardTitle>
          <CardDescription>
            Sélectionnez le mois et l'année pour générer la déclaration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="month">Mois</Label>
              <Select
                value={String(selectedMonth)}
                onValueChange={(value) => {
                  setSelectedMonth(parseInt(value));
                  setIsEditMode(false);
                }}
              >
                <SelectTrigger id="month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <SelectItem key={month} value={String(month)}>
                      {formatMonth(month)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor="year">Année</Label>
              <Select
                value={String(selectedYear)}
                onValueChange={(value) => {
                  setSelectedYear(parseInt(value));
                  setIsEditMode(false);
                }}
              >
                <SelectTrigger id="year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label htmlFor="cnps-filter">Filtrer employés</Label>
              <Select
                value={cnpsFilter}
                onValueChange={(value) => {
                  setCnpsFilter(value as 'all' | 'with_cnps' | 'without_cnps');
                  setIsEditMode(false);
                }}
              >
                <SelectTrigger id="cnps-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="with_cnps">Avec numéro CNPS uniquement</SelectItem>
                  <SelectItem value="without_cnps">Sans numéro CNPS uniquement</SelectItem>
                  <SelectItem value="all">Tous les employés</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">
              Chargement de la déclaration...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 text-destructive">
              <FileText className="h-5 w-5" />
              <div>
                <p className="font-semibold">Erreur de chargement</p>
                <p className="text-sm">{error.message}</p>
                {error.message.includes('No approved/paid payroll runs') && (
                  <p className="text-sm mt-2">
                    Veuillez approuver et clôturer au moins une paie pour ce mois.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Declaration Data */}
      {data && !isLoading && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Employés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">
                    {data.totalEmployeeCount}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Salaire Brut Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">
                    {formatCurrency(data.totalGrossSalary)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cotisations Employeur
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(data.totalEmployerContributions)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total à Payer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(data.totalContributions)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informations de l'entreprise
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Raison sociale</Label>
                  <p className="font-medium">{data.companyName}</p>
                </div>
                {data.companyCNPS && (
                  <div>
                    <Label className="text-muted-foreground">N° CNPS</Label>
                    <p className="font-medium">{data.companyCNPS}</p>
                  </div>
                )}
              </div>
              {data.companyAddress && (
                <div>
                  <Label className="text-muted-foreground">Adresse</Label>
                  <p className="font-medium">{data.companyAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employee Categorization */}
          <Card>
            <CardHeader>
              <CardTitle>Salariés bruts soumis à cotisations</CardTitle>
              <CardDescription>
                Catégorisation des employés par régime de salaire
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Catégorie de salariés</TableHead>
                    <TableHead className="text-right">Nombre</TableHead>
                    <TableHead className="text-right">Salaire Brut</TableHead>
                    <TableHead className="text-right">Base Cotisations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Daily Workers */}
                  <TableRow>
                    <TableCell className="font-medium">
                      {data.dailyWorkers.category1.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.dailyWorkers.category1.employeeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.dailyWorkers.category1.totalGross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.dailyWorkers.category1.contributionBase)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      {data.dailyWorkers.category2.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.dailyWorkers.category2.employeeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.dailyWorkers.category2.totalGross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.dailyWorkers.category2.contributionBase)}
                    </TableCell>
                  </TableRow>

                  {/* Monthly Workers */}
                  <TableRow>
                    <TableCell className="font-medium">
                      {data.monthlyWorkers.category1.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.monthlyWorkers.category1.employeeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.monthlyWorkers.category1.totalGross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.monthlyWorkers.category1.contributionBase)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      {data.monthlyWorkers.category2.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.monthlyWorkers.category2.employeeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.monthlyWorkers.category2.totalGross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.monthlyWorkers.category2.contributionBase)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      {data.monthlyWorkers.category3.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.monthlyWorkers.category3.employeeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.monthlyWorkers.category3.totalGross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.monthlyWorkers.category3.contributionBase)}
                    </TableCell>
                  </TableRow>

                  {/* Total Row */}
                  <TableRow className="bg-muted font-semibold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">
                      {data.totalEmployeeCount}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.totalGrossSalary)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.totalContributionBase)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Contribution Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Décompte des cotisations dues</CardTitle>
              <CardDescription>
                Détail des cotisations par régime
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Régime</TableHead>
                    <TableHead className="text-right">Taux</TableHead>
                    <TableHead className="text-right">Employeur</TableHead>
                    <TableHead className="text-right">Salarié</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      {data.contributions.retirement.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.contributions.retirement.rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.retirement.employerAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.retirement.employeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(data.contributions.retirement.totalAmount)}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">
                      {data.contributions.maternity.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.contributions.maternity.rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.maternity.employerAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.maternity.employeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(data.contributions.maternity.totalAmount)}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">
                      {data.contributions.familyBenefits.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.contributions.familyBenefits.rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.familyBenefits.employerAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.familyBenefits.employeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(data.contributions.familyBenefits.totalAmount)}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">
                      {data.contributions.workAccidents.name}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.contributions.workAccidents.rate.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.workAccidents.employerAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.contributions.workAccidents.employeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(data.contributions.workAccidents.totalAmount)}
                    </TableCell>
                  </TableRow>

                  {data.contributions.cmu && (
                    <TableRow>
                      <TableCell className="font-medium">
                        {data.contributions.cmu.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {data.contributions.cmu.rate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(data.contributions.cmu.employerAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(data.contributions.cmu.employeeAmount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(data.contributions.cmu.totalAmount)}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Total Row */}
                  <TableRow className="bg-primary/10 font-bold text-primary">
                    <TableCell>TOTAL COTISATIONS</TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      {formatCurrency(data.totalEmployerContributions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(data.totalEmployeeContributions)}
                    </TableCell>
                    <TableCell className="text-right text-lg">
                      {formatCurrency(data.totalContributions)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Edit Reason (if in edit mode) */}
          {isEditMode && (
            <Card>
              <CardHeader>
                <CardTitle>Raison des modifications</CardTitle>
                <CardDescription>
                  Indiquez pourquoi vous modifiez la déclaration (optionnel mais recommandé)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Ex: Correction pour un employé embauché en fin de mois..."
                  rows={3}
                />
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {!isEditMode ? (
                    <Button
                      onClick={() => setIsEditMode(true)}
                      variant="outline"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleSaveEdits}
                        disabled={!hasUnsavedChanges || saveEditsMutation.isPending}
                      >
                        {saveEditsMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Enregistrer
                      </Button>
                      <Button
                        onClick={handleResetEdits}
                        variant="outline"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Annuler
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  onClick={handleExportPDF}
                  disabled={exportPDFMutation.isPending}
                >
                  {exportPDFMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exporter en PDF
                </Button>
              </div>

              {declarationResponse?.hasEdits && (
                <p className="text-sm text-muted-foreground mt-4">
                  ⚠️ Cette déclaration contient des modifications manuelles.
                  Dernière modification le{' '}
                  {new Date(declarationResponse.lastEdit?.editedAt || '').toLocaleDateString('fr-FR')}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
