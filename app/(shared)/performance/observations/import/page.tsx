/**
 * Observations Import Page
 *
 * Allows HR to import observations from Excel with:
 * - Template download
 * - File upload with drag & drop
 * - Preview and validation
 * - Bulk import
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type ImportRow = {
  row: number;
  employeeNumber: string;
  employeeName?: string;
  date: string;
  unitsProduced?: number;
  defects?: number;
  hoursWorked?: number;
  qualityScore?: number;
  safetyScore?: number;
  teamworkScore?: number;
  comment?: string;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
};

type ParsedResult = {
  rows: ImportRow[];
  validCount: number;
  warningCount: number;
  errorCount: number;
};

export default function ObservationsImportPage() {
  const router = useRouter();
  const utils = api.useUtils();

  // State
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Download template
  const downloadTemplate = api.observations.exportTemplate.useMutation({
    onSuccess: (data) => {
      // Convert base64 to blob and download
      const byteCharacters = atob(data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Template telecharge');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors du telechargement');
    },
  });

  // Import mutation
  const importObservations = api.observations.import.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} observations importees`);
      utils.observations.list.invalidate();
      router.push('/performance/observations');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'import');
      setIsImporting(false);
    },
  });

  // File drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleFileSelect = async (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Format de fichier non supporte. Utilisez Excel (.xlsx, .xls) ou CSV.');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    setParsedData(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Content = (reader.result as string).split(',')[1];

        // Call parse endpoint
        const response = await fetch('/api/observations/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: selectedFile.name,
            content: base64Content,
          }),
        });

        if (!response.ok) {
          throw new Error('Erreur lors de l\'analyse du fichier');
        }

        const result = await response.json();
        setParsedData(result);
        setIsParsing(false);
      };

      reader.onerror = () => {
        toast.error('Erreur lors de la lecture du fichier');
        setIsParsing(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast.error('Erreur lors de l\'analyse du fichier');
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    // Check for errors
    if (parsedData.errorCount > 0) {
      toast.error('Corrigez les erreurs avant d\'importer');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Convert parsed rows to observations format
      const observations = parsedData.rows
        .filter((row) => row.status !== 'error')
        .map((row) => ({
          employeeNumber: row.employeeNumber,
          observationDate: row.date,
          period: 'daily' as const,
          kpiData: {
            unitsProduced: row.unitsProduced,
            defects: row.defects,
            hoursWorked: row.hoursWorked,
            qualityScore: row.qualityScore,
            safetyScore: row.safetyScore,
            teamworkScore: row.teamworkScore,
          },
          comment: row.comment,
        }));

      await importObservations.mutateAsync({
        observations,
      });

      clearInterval(progressInterval);
      setImportProgress(100);
    } catch (error) {
      setIsImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsedData(null);
    setImportProgress(0);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/performance/observations')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Importer des observations</h1>
          <p className="text-muted-foreground">
            Importez en masse depuis un fichier Excel
          </p>
        </div>
      </div>

      {/* Step 1: Download Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
            Telecharger le template
          </CardTitle>
          <CardDescription>
            Utilisez notre template Excel pour preparer vos donnees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => downloadTemplate.mutate({ type: 'basic' })}
            disabled={downloadTemplate.isPending}
            className="min-h-[44px]"
          >
            {downloadTemplate.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Telecharger le template Excel
          </Button>
          <p className="text-sm text-muted-foreground mt-3">
            Le template contient les colonnes: Matricule, Date, Unites produites, Defauts, Heures, Qualite, Securite, Travail d&apos;equipe, Commentaire
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Upload File */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
            Charger le fichier
          </CardTitle>
          <CardDescription>
            Glissez-deposez ou selectionnez votre fichier Excel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                Glissez votre fichier ici
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou cliquez pour selectionner
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button asChild variant="outline" className="min-h-[44px] cursor-pointer">
                  <span>Selectionner un fichier</span>
                </Button>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <FileSpreadsheet className="h-10 w-10 text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} Ko
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Preview & Validate */}
      {(isParsing || parsedData) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
              Apercu et validation
            </CardTitle>
            <CardDescription>
              Verifiez les donnees avant l&apos;import
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isParsing ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3">Analyse du fichier...</span>
              </div>
            ) : parsedData ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{parsedData.validCount}</p>
                      <p className="text-sm text-muted-foreground">Valides</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <AlertCircle className="h-8 w-8 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold">{parsedData.warningCount}</p>
                      <p className="text-sm text-muted-foreground">Avertissements</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <X className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold">{parsedData.errorCount}</p>
                      <p className="text-sm text-muted-foreground">Erreurs</p>
                    </div>
                  </div>
                </div>

                {/* Errors alert */}
                {parsedData.errorCount > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreurs detectees</AlertTitle>
                    <AlertDescription>
                      Corrigez les erreurs dans votre fichier Excel et rechargez-le.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Preview table */}
                <div className="max-h-[400px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Ligne</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Unites</TableHead>
                        <TableHead className="text-center">Defauts</TableHead>
                        <TableHead className="text-center">Qualite</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.rows.slice(0, 50).map((row) => (
                        <TableRow
                          key={row.row}
                          className={
                            row.status === 'error'
                              ? 'bg-red-50 dark:bg-red-950/20'
                              : row.status === 'warning'
                              ? 'bg-yellow-50 dark:bg-yellow-950/20'
                              : ''
                          }
                        >
                          <TableCell>{row.row}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{row.employeeNumber}</div>
                              {row.employeeName && (
                                <div className="text-sm text-muted-foreground">
                                  {row.employeeName}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="text-center">{row.unitsProduced ?? '-'}</TableCell>
                          <TableCell className="text-center">{row.defects ?? '-'}</TableCell>
                          <TableCell className="text-center">{row.qualityScore ?? '-'}</TableCell>
                          <TableCell>
                            {row.status === 'error' ? (
                              <div>
                                <Badge variant="destructive">Erreur</Badge>
                                <p className="text-xs text-destructive mt-1">
                                  {row.errors.join(', ')}
                                </p>
                              </div>
                            ) : row.status === 'warning' ? (
                              <div>
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                  Avertissement
                                </Badge>
                                <p className="text-xs text-yellow-700 mt-1">
                                  {row.errors.join(', ')}
                                </p>
                              </div>
                            ) : (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Valide
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {parsedData.rows.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Affichage des 50 premieres lignes sur {parsedData.rows.length}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Import */}
      {parsedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">4</span>
              Lancer l&apos;import
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isImporting ? (
              <div className="space-y-4">
                <Progress value={importProgress} />
                <p className="text-sm text-muted-foreground text-center">
                  Import en cours... {importProgress}%
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleImport}
                  disabled={parsedData.errorCount > 0 || parsedData.validCount === 0}
                  className="min-h-[44px]"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importer {parsedData.validCount} observation{parsedData.validCount > 1 ? 's' : ''}
                </Button>
                {parsedData.errorCount > 0 && (
                  <p className="text-sm text-destructive">
                    Corrigez les erreurs avant de pouvoir importer
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
