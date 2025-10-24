/**
 * Accounting Integration Settings Page
 *
 * Allows HR managers to configure:
 * - Account mappings (payroll components → GL accounts)
 * - CMU export settings (1% contribution)
 * - ETAT 301 settings (monthly ITS declaration)
 * - Component code customization (Code 11, 12, 13...)
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Save, Settings, FileText, Calculator, FileSpreadsheet, Download, History, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

export default function AccountingSettingsPage() {
  const { toast } = useToast();

  // Load data
  const { data: accounts, isLoading: loadingAccounts } = trpc.accounting.getAccounts.useQuery();
  const { data: cmuConfig, isLoading: loadingCMU, refetch: refetchCMU } = trpc.accounting.getCMUConfig.useQuery();
  const { data: etat301Config, isLoading: loadingEtat301, refetch: refetchEtat301 } = trpc.accounting.getEtat301Config.useQuery();
  const { data: accountMappings, isLoading: loadingMappings, refetch: refetchMappings } = trpc.accounting.getAccountMappings.useQuery();
  const { data: glExports, isLoading: loadingExports } = trpc.accounting.getGLExports.useQuery();

  // Mutations
  const updateCMUConfig = trpc.accounting.updateCMUConfig.useMutation({
    onSuccess: () => {
      toast({
        title: 'Configuration CMU sauvegardée',
        description: 'Les paramètres CMU ont été mis à jour avec succès',
      });
      refetchCMU();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateEtat301Config = trpc.accounting.updateEtat301Config.useMutation({
    onSuccess: () => {
      toast({
        title: 'Configuration ETAT 301 sauvegardée',
        description: 'Les paramètres ETAT 301 ont été mis à jour avec succès',
      });
      refetchEtat301();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveAccountMapping = trpc.accounting.saveAccountMapping.useMutation({
    onSuccess: () => {
      toast({
        title: 'Écriture comptable sauvegardée',
        description: 'Le mappage de compte a été mis à jour avec succès',
      });
      refetchMappings();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const exportPayrollToGL = trpc.accounting.exportPayrollToGL.useMutation({
    onSuccess: () => {
      toast({
        title: 'Export généré avec succès',
        description: 'L\'export comptable a été créé.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Local state for form values
  const [cmuEmployerNumber, setCmuEmployerNumber] = useState(cmuConfig?.cmuEmployerNumber || '');
  const [cmuRate, setCmuRate] = useState(cmuConfig?.cmuRate || '1.0');
  const [includeDependents, setIncludeDependents] = useState(cmuConfig?.includeDependents ?? true);

  const [dgiTaxNumber, setDgiTaxNumber] = useState(etat301Config?.dgiTaxNumber || '');
  const [includeAttachments, setIncludeAttachments] = useState(etat301Config?.includeAttachments ?? true);

  // State for GL mappings (one edit state per mapping)
  const [editingMappings, setEditingMappings] = useState<Record<string, { debitAccountId?: string; creditAccountId?: string }>>({});

  // State for export generation
  const [exportPayrollRunId, setExportPayrollRunId] = useState('');
  const [exportFormat, setExportFormat] = useState<'SYSCOHADA_CSV' | 'SAGE_TXT' | 'CIEL_IIF' | 'EXCEL'>('SYSCOHADA_CSV');

  // State for journal entry details visibility
  const [expandedExportIds, setExpandedExportIds] = useState<Set<string>>(new Set());

  // Update local state when data loads
  if (cmuConfig && !cmuEmployerNumber) {
    setCmuEmployerNumber(cmuConfig.cmuEmployerNumber || '');
    setCmuRate(cmuConfig.cmuRate || '1.0');
    setIncludeDependents(cmuConfig.includeDependents ?? true);
  }

  if (etat301Config && !dgiTaxNumber) {
    setDgiTaxNumber(etat301Config.dgiTaxNumber || '');
    setIncludeAttachments(etat301Config.includeAttachments ?? true);
  }

  const handleSaveCMU = () => {
    updateCMUConfig.mutate({
      cmuEmployerNumber,
      cmuRate: parseFloat(cmuRate),
      includeDependents,
    });
  };

  const handleSaveEtat301 = () => {
    updateEtat301Config.mutate({
      dgiTaxNumber,
      includeAttachments,
    });
  };

  const handleSaveMapping = (componentType: string) => {
    const mapping = editingMappings[componentType];
    if (!mapping) return;

    saveAccountMapping.mutate({
      componentType,
      debitAccountId: mapping.debitAccountId,
      creditAccountId: mapping.creditAccountId,
    });
  };

  const handleExportPayroll = () => {
    if (!exportPayrollRunId) {
      toast({
        title: 'Erreur',
        description: 'Veuillez saisir un ID de paie',
        variant: 'destructive',
      });
      return;
    }

    exportPayrollToGL.mutate({
      payrollRunId: exportPayrollRunId,
      format: exportFormat,
    });
  };

  const toggleExportDetails = (exportId: string) => {
    setExpandedExportIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(exportId)) {
        newSet.delete(exportId);
      } else {
        newSet.add(exportId);
      }
      return newSet;
    });
  };

  const isLoading = loadingAccounts || loadingCMU || loadingEtat301 || loadingMappings || loadingExports;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Chargement...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Configuration Comptable</h1>
        <p className="text-muted-foreground mt-2">
          Configurez les paramètres d'export comptable et fiscal
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mappings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="mappings">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Écritures Comptables
          </TabsTrigger>
          <TabsTrigger value="exports">
            <Download className="mr-2 h-4 w-4" />
            Exports
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="cmu">
            <Settings className="mr-2 h-4 w-4" />
            CMU (1%)
          </TabsTrigger>
          <TabsTrigger value="etat301">
            <FileText className="mr-2 h-4 w-4" />
            ETAT 301
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Calculator className="mr-2 h-4 w-4" />
            Plan Comptable
          </TabsTrigger>
        </TabsList>

        {/* GL Mappings */}
        <TabsContent value="mappings">
          <Card>
            <CardHeader>
              <CardTitle>Écritures Comptables - Mappage des Comptes</CardTitle>
              <CardDescription>
                Configurez les comptes comptables utilisés pour chaque composante de paie
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Composante de Paie</TableHead>
                    <TableHead className="min-w-[200px]">Compte Débit</TableHead>
                    <TableHead className="min-w-[200px]">Compte Crédit</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Existing mappings */}
                  {accountMappings && accountMappings.length > 0 ? (
                    accountMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">
                          {mapping.componentType}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editingMappings[mapping.componentType]?.debitAccountId ?? mapping.debitAccountId ?? ''}
                            onValueChange={(value) => {
                              setEditingMappings({
                                ...editingMappings,
                                [mapping.componentType]: {
                                  ...editingMappings[mapping.componentType],
                                  debitAccountId: value,
                                  creditAccountId: editingMappings[mapping.componentType]?.creditAccountId ?? mapping.creditAccountId ?? undefined,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Sélectionnez un compte" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts?.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.accountCode} - {account.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editingMappings[mapping.componentType]?.creditAccountId ?? mapping.creditAccountId ?? ''}
                            onValueChange={(value) => {
                              setEditingMappings({
                                ...editingMappings,
                                [mapping.componentType]: {
                                  ...editingMappings[mapping.componentType],
                                  creditAccountId: value,
                                  debitAccountId: editingMappings[mapping.componentType]?.debitAccountId ?? mapping.debitAccountId ?? undefined,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue placeholder="Sélectionnez un compte" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts?.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.accountCode} - {account.accountName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleSaveMapping(mapping.componentType)}
                            disabled={saveAccountMapping.isPending}
                            className="min-h-[44px]"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Aucun mappage de compte configuré
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Empty row for creating new mapping */}
                  <TableRow className="bg-muted/50">
                    <TableCell>
                      <Input
                        placeholder="Type de composante (ex: basic_salary)"
                        className="min-h-[48px]"
                        onBlur={(e) => {
                          if (e.target.value && !editingMappings[e.target.value]) {
                            setEditingMappings({
                              ...editingMappings,
                              [e.target.value]: {},
                            });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      Saisissez un type de composante pour créer un nouveau mappage
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Common component types reference */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Types de composantes courants :</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>• basic_salary (Salaire de Base)</div>
                  <div>• cnps_employee (CNPS Employé)</div>
                  <div>• cnps_employer (CNPS Employeur)</div>
                  <div>• its_tax (ITS)</div>
                  <div>• net_salary (Salaire Net)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Generation */}
        <TabsContent value="exports">
          <Card>
            <CardHeader>
              <CardTitle>Exporter la Paie vers la Comptabilité</CardTitle>
              <CardDescription>
                Générez un export comptable à partir d'une paie calculée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="payrollRunId">ID de la Paie</Label>
                  <Input
                    id="payrollRunId"
                    placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
                    value={exportPayrollRunId}
                    onChange={(e) => setExportPayrollRunId(e.target.value)}
                    className="min-h-[48px] mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    L'identifiant UUID de la paie calculée à exporter
                  </p>
                </div>

                <div>
                  <Label>Format d'Export</Label>
                  <RadioGroup
                    value={exportFormat}
                    onValueChange={(value) => setExportFormat(value as typeof exportFormat)}
                    className="mt-2 space-y-3"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="SYSCOHADA_CSV" id="syscohada" />
                      <Label htmlFor="syscohada" className="cursor-pointer font-normal">
                        SYSCOHADA CSV - Format standard comptable africain
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="SAGE_TXT" id="sage" />
                      <Label htmlFor="sage" className="cursor-pointer font-normal">
                        SAGE TXT - Format Sage Comptabilité
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="CIEL_IIF" id="ciel" />
                      <Label htmlFor="ciel" className="cursor-pointer font-normal">
                        CIEL IIF - Format Ciel Compta
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="EXCEL" id="excel" />
                      <Label htmlFor="excel" className="cursor-pointer font-normal">
                        Excel - Format feuille de calcul
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <Button
                onClick={handleExportPayroll}
                size="lg"
                disabled={exportPayrollToGL.isPending}
                className="min-h-[56px] w-full"
              >
                <Download className="mr-2 h-5 w-5" />
                Générer l'Export Comptable
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export History */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Exports Comptables</CardTitle>
              <CardDescription>
                Consultez et téléchargez les exports générés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {glExports && glExports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Total Débit</TableHead>
                      <TableHead className="text-right">Total Crédit</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glExports.map((exportItem) => (
                      <>
                        <TableRow key={exportItem.id}>
                          <TableCell>
                            {exportItem.exportDate ? new Date(exportItem.exportDate).toLocaleDateString('fr-FR') : '-'}
                          </TableCell>
                          <TableCell>
                            {exportItem.periodStart && exportItem.periodEnd
                              ? `${exportItem.periodStart} - ${exportItem.periodEnd}`
                              : '-'}
                          </TableCell>
                          <TableCell>{exportItem.exportFormat ?? '-'}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              exportItem.status === 'generated'
                                ? 'bg-success/10 text-success'
                                : exportItem.status === 'failed'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {exportItem.status === 'generated' ? 'Généré' :
                               exportItem.status === 'failed' ? 'Échoué' :
                               exportItem.status === 'processing' ? 'En cours' : exportItem.status ?? 'En attente'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {exportItem.totalDebit ? Number(exportItem.totalDebit).toLocaleString('fr-FR') : '0'} FCFA
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {exportItem.totalCredit ? Number(exportItem.totalCredit).toLocaleString('fr-FR') : '0'} FCFA
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {exportItem.fileUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(exportItem.fileUrl!, '_blank')}
                                  className="min-h-[44px]"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Télécharger
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleExportDetails(exportItem.id)}
                                className="min-h-[44px]"
                              >
                                <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${
                                  expandedExportIds.has(exportItem.id) ? 'rotate-180' : ''
                                }`} />
                                Détails
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedExportIds.has(exportItem.id) && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/50">
                              <JournalEntriesDetail exportId={exportItem.id} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun export comptable généré
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CMU Configuration */}
        <TabsContent value="cmu">
          <Card>
            <CardHeader>
              <CardTitle>Configuration CMU (Couverture Maladie Universelle)</CardTitle>
              <CardDescription>
                Configurez les paramètres d'export CMU pour la déclaration CNPS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cmuEmployerNumber">Numéro Employeur CMU</Label>
                  <Input
                    id="cmuEmployerNumber"
                    placeholder="Ex: CMU12345"
                    value={cmuEmployerNumber}
                    onChange={(e) => setCmuEmployerNumber(e.target.value)}
                    className="min-h-[48px] mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Votre numéro d'identification CMU auprès de la CNPS
                  </p>
                </div>

                <div>
                  <Label htmlFor="cmuRate">Taux CMU (%)</Label>
                  <Input
                    id="cmuRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={cmuRate}
                    onChange={(e) => setCmuRate(e.target.value)}
                    className="min-h-[48px] mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Taux de cotisation CMU (par défaut 1%)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeDependents"
                    checked={includeDependents}
                    onCheckedChange={(checked) => setIncludeDependents(!!checked)}
                  />
                  <Label htmlFor="includeDependents" className="cursor-pointer">
                    Inclure les ayants droit dans l'export
                  </Label>
                </div>
              </div>

              <Button onClick={handleSaveCMU} size="lg" disabled={updateCMUConfig.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Sauvegarder la configuration CMU
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ETAT 301 Configuration */}
        <TabsContent value="etat301">
          <Card>
            <CardHeader>
              <CardTitle>Configuration ETAT 301</CardTitle>
              <CardDescription>
                Configurez les paramètres de déclaration mensuelle ITS (Impôt sur Traitement et Salaire)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="dgiTaxNumber">Numéro NIF (DGI)</Label>
                  <Input
                    id="dgiTaxNumber"
                    placeholder="Ex: NIF1234567890"
                    value={dgiTaxNumber}
                    onChange={(e) => setDgiTaxNumber(e.target.value)}
                    className="min-h-[48px] mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Numéro d'Identification Fiscale auprès de la Direction Générale des Impôts
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeAttachments"
                    checked={includeAttachments}
                    onCheckedChange={(checked) => setIncludeAttachments(!!checked)}
                  />
                  <Label htmlFor="includeAttachments" className="cursor-pointer">
                    Inclure les pièces jointes dans l'export
                  </Label>
                </div>
              </div>

              <Button onClick={handleSaveEtat301} size="lg" disabled={updateEtat301Config.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Sauvegarder la configuration ETAT 301
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>Plan Comptable SYSCOHADA</CardTitle>
              <CardDescription>
                Comptes comptables disponibles pour l'export de paie
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accounts && accounts.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {accounts.map((account) => (
                      <div key={account.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {account.accountCode} - {account.accountName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Type: {account.accountType} • Système: {account.accountingSystem}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun compte comptable configuré
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Component to display journal entries for a GL export
 */
function JournalEntriesDetail({ exportId }: { exportId: string }) {
  const { data: journalEntries, isLoading } = trpc.accounting.getGLJournalEntries.useQuery({
    exportId,
  });

  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Chargement des écritures comptables...
      </div>
    );
  }

  if (!journalEntries || journalEntries.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Aucune écriture comptable trouvée
      </div>
    );
  }

  return (
    <div className="py-4">
      <h4 className="font-medium mb-3 text-sm">Écritures Comptables Détaillées</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N° Ligne</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead className="text-right">Débit</TableHead>
            <TableHead className="text-right">Crédit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {journalEntries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono text-sm">
                {entry.lineNumber ?? '-'}
              </TableCell>
              <TableCell>
                {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString('fr-FR') : '-'}
              </TableCell>
              <TableCell className="font-mono">
                {entry.accountCode}
              </TableCell>
              <TableCell className="max-w-[300px] truncate">
                {entry.description ?? '-'}
              </TableCell>
              <TableCell className="text-right font-mono">
                {entry.debitAmount ? `${Number(entry.debitAmount).toLocaleString('fr-FR')} FCFA` : '-'}
              </TableCell>
              <TableCell className="text-right font-mono">
                {entry.creditAmount ? `${Number(entry.creditAmount).toLocaleString('fr-FR')} FCFA` : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
