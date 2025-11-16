'use client';

/**
 * Import Historical Payroll Dialog
 *
 * 3-step wizard for importing historical payroll data:
 * 1. Upload file (with template download)
 * 2. Preview runs and warnings
 * 3. Confirm and import
 */

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, AlertCircle, CheckCircle2, FileSpreadsheet, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { ParsedPayrollRun, ImportWarning, ValidationError } from '@/lib/payroll-import/types';

interface ImportHistoricalPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'preview' | 'confirm';

export function ImportHistoricalPayrollDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportHistoricalPayrollDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [runs, setRuns] = useState<ParsedPayrollRun[]>([]);
  const [warnings, setWarnings] = useState<ImportWarning[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [summary, setSummary] = useState<{ totalRuns: number; totalEmployees: number; warningCount: number; errorCount: number } | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  // Mutations
  const downloadTemplate = api.payroll.downloadHistoricalTemplate.useMutation({
    onSuccess: (data) => {
      // Download file
      const link = document.createElement('a');
      link.href = `data:${data.mimeType};base64,${data.content}`;
      link.download = data.filename;
      link.click();

      toast({
        title: 'Template téléchargé',
        description: 'Remplissez le fichier Excel et importez-le.',
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

  const uploadFile = api.payroll.uploadHistoricalPayroll.useMutation({
    onSuccess: (data) => {
      setRuns(data.runs);
      setWarnings(data.warnings);
      setValidationErrors(data.validationErrors);
      setSummary(data.summary);
      setStep('preview');
    },
    onError: (error) => {
      toast({
        title: 'Erreur de parsing',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const importPayroll = api.payroll.importHistoricalPayroll.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Importation réussie',
        description: data.message,
      });
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      toast({
        title: 'Erreur d\'importation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // File dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      toast({
        title: 'Format invalide',
        description: 'Seuls les fichiers Excel (.xlsx) sont acceptés.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: 'Fichier trop volumineux',
        description: 'La taille maximale est de 25 MB.',
        variant: 'destructive',
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (base64) {
        setFileData(base64);
        setFileName(file.name);
        // Auto-upload
        uploadFile.mutate({ fileData: base64, fileName: file.name });
      }
    };
    reader.readAsDataURL(file);
  }, [uploadFile, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  });

  const handleClose = () => {
    setStep('upload');
    setFileData(null);
    setFileName('');
    setRuns([]);
    setWarnings([]);
    setValidationErrors([]);
    setSummary(null);
    setExpandedRuns(new Set());
    onOpenChange(false);
  };

  const handleImport = () => {
    if (!fileData) return;
    importPayroll.mutate({ fileData });
  };

  const toggleRunExpanded = (runNumber: string) => {
    setExpandedRuns(prev => {
      const next = new Set(prev);
      if (next.has(runNumber)) {
        next.delete(runNumber);
      } else {
        next.add(runNumber);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer l'Historique de Paie</DialogTitle>
          <DialogDescription>
            Importez vos anciennes paies pour historique et calculs futurs
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Download Template Button */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Télécharger le Template</CardTitle>
                <CardDescription>
                  Téléchargez le fichier Excel à remplir avec vos données historiques
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => downloadTemplate.mutate()}
                  disabled={downloadTemplate.isPending}
                  className="w-full min-h-[56px]"
                >
                  <Download className="mr-2 h-5 w-5" />
                  {downloadTemplate.isPending ? 'Génération...' : 'Télécharger le Template Excel'}
                </Button>
              </CardContent>
            </Card>

            {/* Upload File */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Uploader le Fichier</CardTitle>
                <CardDescription>
                  Glissez-déposez ou cliquez pour sélectionner votre fichier rempli
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                    transition-colors min-h-[200px] flex flex-col items-center justify-center gap-4
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                    ${uploadFile.isPending ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  <input {...getInputProps()} />
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  {uploadFile.isPending ? (
                    <p className="text-lg">Analyse du fichier en cours...</p>
                  ) : isDragActive ? (
                    <p className="text-lg">Déposez le fichier ici</p>
                  ) : (
                    <>
                      <p className="text-lg font-medium">Glissez-déposez votre fichier Excel ici</p>
                      <p className="text-sm text-muted-foreground">ou cliquez pour sélectionner</p>
                      <p className="text-xs text-muted-foreground">Fichiers .xlsx uniquement, max 25 MB</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && summary && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Runs de Paie</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{summary.totalRuns}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Employés</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{summary.totalEmployees}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {summary.errorCount > 0 ? 'Erreurs' : 'Avertissements'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${
                    summary.errorCount > 0
                      ? 'text-red-600'
                      : summary.warningCount > 0
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {summary.errorCount > 0 ? summary.errorCount : summary.warningCount}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Validation Errors (Blocking) */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription>
                  <div className="font-semibold text-lg mb-3">❌ Importation impossible - Erreurs à corriger :</div>
                  <div className="space-y-4">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="border-l-4 border-red-600 pl-4 py-2 bg-red-50">
                        <div className="font-semibold text-red-900 mb-2">{error.message}</div>
                        {error.details && error.details.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-sm text-red-800 font-medium">
                              Matricules introuvables ({error.details.length}) :
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto bg-white p-2 rounded border border-red-200">
                              {error.details.map((detail, i) => (
                                <span key={i} className="inline-flex items-center px-2 py-1 bg-red-100 text-red-900 text-xs font-mono rounded">
                                  {detail}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 text-sm bg-blue-50 border border-blue-200 rounded p-3">
                          <div className="font-semibold text-blue-900 mb-1">💡 Comment corriger :</div>
                          <ul className="list-disc pl-5 text-blue-800 space-y-1">
                            <li>Créez les employés manquants dans la section <strong>Employés</strong></li>
                            <li>Vérifiez que les <strong>matricules</strong> correspondent exactement (majuscules/minuscules)</li>
                            <li>Si les employés sont inactifs, réactivez-les avant l'importation</li>
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <Alert variant="default" className="border-yellow-600">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Avertissements détectés :</div>
                  <ul className="list-disc pl-5 space-y-1 max-h-[200px] overflow-y-auto">
                    {warnings.slice(0, 10).map((warning, index) => (
                      <li key={index} className="text-sm">
                        {warning.message}
                        {warning.employeeNumber && ` (Matricule: ${warning.employeeNumber})`}
                      </li>
                    ))}
                    {warnings.length > 10 && (
                      <li className="text-sm font-medium">
                        ... et {warnings.length - 10} autre(s) avertissement(s)
                      </li>
                    )}
                  </ul>
                  <p className="text-sm mt-3 font-medium text-yellow-700">
                    ℹ️ Ces avertissements n'empêchent pas l'importation (données historiques).
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Runs Preview with Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Aperçu Détaillé des Données</CardTitle>
                <CardDescription>Vérifiez les données avant d'importer (cliquez pour développer)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {runs.map((run, index) => {
                    const isExpanded = expandedRuns.has(run.runNumber);
                    const totalGross = run.lineItems.reduce((sum, item) => sum + item.grossSalary, 0);
                    const totalNet = run.lineItems.reduce((sum, item) => sum + item.netSalary, 0);

                    return (
                      <Card key={index} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-semibold text-base">{run.name || run.runNumber}</div>
                              <div className="text-sm text-muted-foreground mt-1">
                                📅 {new Date(run.periodStart).toLocaleDateString('fr-FR')} - {new Date(run.periodEnd).toLocaleDateString('fr-FR')}
                                {' • '}💰 Paiement: {new Date(run.payDate).toLocaleDateString('fr-FR')}
                              </div>
                              <div className="flex gap-4 mt-2 text-sm">
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{run.lineItems.length} employés</span>
                                </div>
                                <div className="text-muted-foreground">
                                  Brut: <span className="font-medium text-foreground">{formatCurrency(totalGross)} FCFA</span>
                                </div>
                                <div className="text-muted-foreground">
                                  Net: <span className="font-medium text-green-600">{formatCurrency(totalNet)} FCFA</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRunExpanded(run.runNumber)}
                              className="ml-4"
                            >
                              {isExpanded ? (
                                <><ChevronUp className="h-4 w-4 mr-1" /> Masquer</>
                              ) : (
                                <><ChevronDown className="h-4 w-4 mr-1" /> Voir Détails</>
                              )}
                            </Button>
                          </div>
                        </CardHeader>

                        {isExpanded && (
                          <CardContent className="pt-0">
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[100px]">Matricule</TableHead>
                                    <TableHead>Employé</TableHead>
                                    <TableHead>Poste</TableHead>
                                    <TableHead className="text-right">Salaire Brut</TableHead>
                                    <TableHead className="text-right">CNPS Emp.</TableHead>
                                    <TableHead className="text-right">ITS</TableHead>
                                    <TableHead className="text-right">Total Déduc.</TableHead>
                                    <TableHead className="text-right">Net à Payer</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {run.lineItems.map((item, itemIndex) => (
                                    <TableRow key={itemIndex}>
                                      <TableCell className="font-mono text-xs">{item.employeeNumber}</TableCell>
                                      <TableCell className="font-medium">{item.employeeName || '-'}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{item.positionTitle || '-'}</TableCell>
                                      <TableCell className="text-right font-medium">{formatCurrency(item.grossSalary)}</TableCell>
                                      <TableCell className="text-right text-sm">{formatCurrency(item.cnpsEmployee)}</TableCell>
                                      <TableCell className="text-right text-sm">{formatCurrency(item.its)}</TableCell>
                                      <TableCell className="text-right text-sm">{formatCurrency(item.totalDeductions)}</TableCell>
                                      <TableCell className="text-right font-semibold text-green-600">
                                        {formatCurrency(item.netSalary)} FCFA
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {/* Totals Row */}
                                  <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={3} className="text-right">TOTAL</TableCell>
                                    <TableCell className="text-right">{formatCurrency(totalGross)}</TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(run.lineItems.reduce((sum, item) => sum + item.cnpsEmployee, 0))}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(run.lineItems.reduce((sum, item) => sum + item.its, 0))}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(run.lineItems.reduce((sum, item) => sum + item.totalDeductions, 0))}
                                    </TableCell>
                                    <TableCell className="text-right text-green-600">
                                      {formatCurrency(totalNet)} FCFA
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Retour
              </Button>
              <Button
                onClick={handleImport}
                size="lg"
                disabled={importPayroll.isPending || validationErrors.length > 0}
                className={validationErrors.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {importPayroll.isPending
                  ? 'Importation...'
                  : validationErrors.length > 0
                  ? 'Corrigez les erreurs avant d\'importer'
                  : 'Importer l\'Historique'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
