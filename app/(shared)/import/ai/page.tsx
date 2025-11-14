/**
 * AI-Powered Import Page - Multi-File Batch Import
 *
 * USER TASK: "Import ALL my company data from Excel files"
 *
 * What Users Can Do:
 * ✅ Upload multiple Excel files at once (employees, payroll, attendance, etc.)
 * ✅ AI automatically understands what each file contains
 * ✅ Import everything with one click
 * ✅ No templates needed, no manual mapping
 *
 * HCI Principles for Low Digital Literacy:
 * 1. Task-Oriented: "Importer vos données" not "Configure AI import"
 * 2. Show What's Possible: Visual examples of what works
 * 3. Zero Learning: Drop files, AI handles rest
 * 4. Reassurance: "AI s'occupe de tout" messaging
 * 5. Progress Visibility: Clear steps with checkmarks
 * 6. Error Prevention: Validate before accepting files
 * 7. Immediate Feedback: Toast + visual updates
 *
 * Flow:
 * 1. UPLOAD - Drop multiple files, show previews
 * 2. ANALYZE - One button: AI analyzes all files/sheets in parallel
 * 3. CONFIRM - Review only low-confidence detections
 * 4. IMPORT - One button: Import everything
 * 5. RESULTS - Show what was imported, grouped by task
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  Brain,
  Zap,
  Users,
  Banknote,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import type { ImportAnalysisResult } from '@/server/ai-import/coordinator';

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'welcome' | 'upload' | 'analyze' | 'confirm' | 'import' | 'results';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'ready' | 'analyzing' | 'analyzed' | 'error';
  analysis?: ImportAnalysisResult;
  error?: string;
}

interface FileAnalysisResult {
  fileId: string;
  fileName: string;
  analysis: ImportAnalysisResult;
}

interface BatchImportResult {
  totalFiles: number;
  totalSheets: number;
  totalRecords: number;
  fileResults: Array<{
    fileName: string;
    sheetsImported: number;
    recordsImported: number;
    errors: string[];
  }>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIImportPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [confirmedSheets, setConfirmedSheets] = useState<Record<string, string[]>>({}); // fileId -> sheet names
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations/queries
  const uploadMutation = trpc.aiImport.uploadFile.useMutation();
  const utils = trpc.useUtils();
  const importMutation = trpc.aiImport.executeImport.useMutation();

  // ============================================================================
  // Multi-File Upload Handlers
  // ============================================================================

  const handleFilesChange = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Validate each file
      const validFiles: File[] = [];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      const maxSize = 50 * 1024 * 1024; // 50MB

      for (const file of fileArray) {
        // Type validation
        if (!validTypes.includes(file.type)) {
          toast.error(`Format invalide: ${file.name}`, {
            description: 'Seuls les fichiers Excel (.xlsx, .xls) sont acceptés',
          });
          continue;
        }

        // Size validation
        if (file.size > maxSize) {
          toast.error(`Fichier trop volumineux: ${file.name}`, {
            description: 'La taille maximale est de 50 MB',
          });
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length === 0) return;

      // Upload each file
      const uploadPromises = validFiles.map(async (file) => {
        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Add to state immediately with uploading status
        setUploadedFiles((prev) => [
          ...prev,
          {
            id: tempId,
            name: file.name,
            size: file.size,
            status: 'uploading',
          },
        ]);

        try {
          // Convert to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Upload
          const result = await uploadMutation.mutateAsync({
            fileName: file.name,
            fileData: base64,
            fileType: file.type,
          });

          // Update with real ID
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === tempId
                ? {
                    ...f,
                    id: result.fileId,
                    status: 'ready',
                  }
                : f
            )
          );

          return result.fileId;
        } catch (error) {
          // Mark as error
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === tempId
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Erreur d\'upload',
                  }
                : f
            )
          );
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter(Boolean).length;

      if (successCount > 0) {
        toast.success(`${successCount} fichier(s) uploadé(s)`, {
          description: `Prêt pour l'analyse`,
        });
        setCurrentStep('upload');
      }
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFilesChange(files);
      }
    },
    [handleFilesChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    toast.success('Fichier retiré');
  }, []);

  // ============================================================================
  // Batch Analysis Handler
  // ============================================================================

  const handleAnalyzeAll = useCallback(async () => {
    const filesToAnalyze = uploadedFiles.filter((f) => f.status === 'ready');

    if (filesToAnalyze.length === 0) return;

    toast.loading(`Analyse de ${filesToAnalyze.length} fichier(s)...`, { id: 'analyze-all' });

    // Set all files to analyzing status
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.status === 'ready'
          ? { ...f, status: 'analyzing' }
          : f
      )
    );

    try {
      // Analyze all files in parallel
      const analysisPromises = filesToAnalyze.map(async (file) => {
        try {
          const analysisData = await utils.aiImport.analyzeFile.fetch({
            fileId: file.id,
            countryCode: 'CI',
          });

          if (!analysisData) {
            throw new Error('Aucune donnée retournée');
          }

          return {
            fileId: file.id,
            fileName: file.name,
            analysis: analysisData,
          } as FileAnalysisResult;
        } catch (error) {
          // Mark file as error
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Erreur d\'analyse',
                  }
                : f
            )
          );
          return null;
        }
      });

      const results = await Promise.all(analysisPromises);
      const successfulResults = results.filter((r): r is FileAnalysisResult => r !== null);

      // Update files with analysis results
      setUploadedFiles((prev) =>
        prev.map((f) => {
          const result = successfulResults.find((r) => r.fileId === f.id);
          if (result) {
            return {
              ...f,
              status: 'analyzed',
              analysis: result.analysis,
            };
          }
          return f;
        })
      );

      // Check if any files need confirmation
      const needsConfirmation = successfulResults.some((r) => r.analysis.needsConfirmation);

      toast.success('Analyse terminée', {
        id: 'analyze-all',
        description: `${successfulResults.length} fichier(s) analysé(s)`,
      });

      if (needsConfirmation) {
        setCurrentStep('confirm');
      } else {
        setCurrentStep('import');
      }
    } catch (error) {
      toast.error('Erreur d\'analyse', {
        id: 'analyze-all',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }, [uploadedFiles, utils.aiImport.analyzeFile]);

  // ============================================================================
  // Batch Import Handler
  // ============================================================================

  const handleImportAll = useCallback(async () => {
    const filesToImport = uploadedFiles.filter((f) => f.status === 'analyzed');

    if (filesToImport.length === 0) return;

    toast.loading(`Import de ${filesToImport.length} fichier(s)...`, { id: 'import-all' });

    try {
      // Import all files in sequence (to avoid DB contention)
      const importPromises = filesToImport.map(async (file) => {
        const result = await importMutation.mutateAsync({
          fileId: file.id,
          countryCode: 'CI',
          confirmedSheets: confirmedSheets[file.id] || undefined,
        });

        // Collect all errors from sheet details
        const allErrors = result.details
          ?.flatMap((detail) => detail.errors.map((err) => err.message))
          .filter(Boolean) || [];

        return {
          fileName: file.name,
          sheetsImported: result.details?.length || 0,
          recordsImported: result.totalRecordsImported,
          errors: allErrors,
        };
      });

      const results = await Promise.all(importPromises);

      const totalRecords = results.reduce((sum, r) => sum + r.recordsImported, 0);
      const totalSheets = results.reduce((sum, r) => sum + r.sheetsImported, 0);

      setImportResult({
        totalFiles: filesToImport.length,
        totalSheets,
        totalRecords,
        fileResults: results,
      });

      toast.success('Import terminé', {
        id: 'import-all',
        description: `${totalRecords} enregistrement(s) importé(s)`,
      });

      setCurrentStep('results');
    } catch (error) {
      toast.error('Erreur d\'import', {
        id: 'import-all',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }, [uploadedFiles, confirmedSheets, importMutation]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderWelcomeStep = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Importer vos données d'entreprise
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Déposez tous vos fichiers Excel. L'IA s'occupe du reste.
        </p>
      </div>

      {/* What You Can Do */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Ce que vous pouvez faire ici
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Import automatique</p>
                <p className="text-sm text-muted-foreground">
                  Déposez vos fichiers Excel de SAGE, CIEL ou tout autre système
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">IA intelligente</p>
                <p className="text-sm text-muted-foreground">
                  L'IA identifie automatiquement employés, paie, congés, etc.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Plusieurs fichiers</p>
                <p className="text-sm text-muted-foreground">
                  Upload multiple: employés.xlsx, paie.xlsx, congés.xlsx...
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Zéro configuration</p>
                <p className="text-sm text-muted-foreground">
                  Pas de modèle à télécharger, pas de mapping manuel
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Examples of What Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Exemples de fichiers supportés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Users className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Employés</p>
                <p className="text-xs text-muted-foreground">
                  Liste du personnel, contrats, salaires
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Banknote className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Paie</p>
                <p className="text-xs text-muted-foreground">
                  Historique paie, CNPS, déclarations
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              <Clock className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Temps & Congés</p>
                <p className="text-xs text-muted-foreground">
                  Soldes congés, pointages, absences
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          className="min-h-[56px] text-lg px-8"
          onClick={() => setCurrentStep('upload')}
        >
          Commencer l'import
          <Upload className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
            1
          </div>
          <span className="font-medium text-foreground">Uploader</span>
        </div>
        <Separator className="flex-1" />
        <div className="flex items-center gap-2 opacity-50">
          <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium">
            2
          </div>
          <span>Analyser</span>
        </div>
        <Separator className="flex-1" />
        <div className="flex items-center gap-2 opacity-50">
          <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium">
            3
          </div>
          <span>Importer</span>
        </div>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Déposez vos fichiers Excel</CardTitle>
          <CardDescription>
            Vous pouvez déposer plusieurs fichiers à la fois. L'IA analysera chaque fichier automatiquement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesChange(e.target.files);
                }
              }}
            />

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium">
                  Glissez vos fichiers ici
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou cliquez pour sélectionner (max 50 MB par fichier)
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">
                .xlsx, .xls
              </Badge>
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {uploadedFiles.length} fichier(s) uploadé(s)
              </p>

              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    {/* Icon */}
                    <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(0)} Ko
                      </p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {file.status === 'uploading' && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                      {file.status === 'ready' && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}

                      {/* Remove Button */}
                      {file.status !== 'uploading' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            {uploadedFiles.some((f) => f.status === 'ready') && (
              <Button
                size="lg"
                className="min-h-[56px] flex-1"
                onClick={handleAnalyzeAll}
              >
                <Brain className="mr-2 w-5 h-5" />
                Analyser tous les fichiers ({uploadedFiles.filter(f => f.status === 'ready').length})
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              className="min-h-[56px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="mr-2 w-5 h-5" />
              Ajouter d'autres fichiers
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Alert */}
      <Alert>
        <Sparkles className="w-4 h-4" />
        <AlertTitle>L'IA s'occupe de tout</AlertTitle>
        <AlertDescription>
          Une fois l'analyse lancée, l'IA identifiera automatiquement le type de données dans chaque
          fichier et chaque feuille Excel. Aucune configuration nécessaire.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderConfirmStep = () => {
    // Find files with low-confidence sheets
    const filesNeedingConfirmation = uploadedFiles.filter(
      (f) => f.status === 'analyzed' && f.analysis?.needsConfirmation
    );

    if (filesNeedingConfirmation.length === 0) {
      // Skip to import if no confirmation needed
      setCurrentStep('import');
      return null;
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Header */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <span>Uploader</span>
          </div>
          <Separator className="flex-1" />
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <span>Analyser</span>
          </div>
          <Separator className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
              3
            </div>
            <span className="font-medium text-foreground">Confirmer</span>
          </div>
          <Separator className="flex-1" />
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium">
              4
            </div>
            <span>Importer</span>
          </div>
        </div>

        {/* User-Friendly Summary - Show what will be created */}
        {filesNeedingConfirmation.map((file) => file.analysis?.summary && (
          <Card key={file.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <CardTitle className="text-lg">{file.name}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {file.analysis.summary.overallSummary}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Entities to Create */}
              <div className="space-y-3">
                {file.analysis.summary.entities.map((entity, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-card">
                    {/* Entity Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-primary">
                        {entity.count} {entity.entityName}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        Feuille: {entity.sheetName}
                      </Badge>
                    </div>

                    {/* Examples */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        Exemples:
                      </p>
                      {entity.examples.map((example, exIdx) => (
                        <div key={exIdx} className="bg-muted/50 rounded p-2 text-sm">
                          <p className="font-medium mb-1">{example.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(example.keyFields).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {file.analysis.summary.warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Points d'attention</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {file.analysis.summary.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Estimated Time */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Temps estimé: {file.analysis.summary.estimatedTime}</span>
              </div>

              {/* Low Confidence Notice - Optional Technical Details */}
              {file.analysis.lowConfidenceSheets.length > 0 && (
                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Vérification recommandée</AlertTitle>
                  <AlertDescription>
                    L'IA a détecté {file.analysis.lowConfidenceSheets.length} feuille(s) avec une confiance inférieure à 90%. Vérifiez que les exemples ci-dessus correspondent bien à vos données.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="min-h-[56px] flex-1"
            onClick={() => setCurrentStep('import')}
          >
            Les exemples correspondent - Continuer
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  };

  const renderImportStep = () => {
    const filesToImport = uploadedFiles.filter((f) => f.status === 'analyzed');

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Header */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <span>Uploader</span>
          </div>
          <Separator className="flex-1" />
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <span>Analyser</span>
          </div>
          <Separator className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
              3
            </div>
            <span className="font-medium text-foreground">Importer</span>
          </div>
        </div>

        {/* User-Friendly Summary */}
        {filesToImport.map((file) => file.analysis?.summary && (
          <Card key={file.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <CardTitle className="text-lg">{file.name}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {file.analysis.summary.overallSummary}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Entities to Create */}
              <div className="space-y-3">
                {file.analysis.summary.entities.map((entity, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-card">
                    {/* Entity Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-primary">
                        {entity.count} {entity.entityName}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        Feuille: {entity.sheetName}
                      </Badge>
                    </div>

                    {/* Examples */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        Exemples:
                      </p>
                      {entity.examples.map((example, exIdx) => (
                        <div key={exIdx} className="bg-muted/50 rounded p-2 text-sm">
                          <p className="font-medium mb-1">{example.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(example.keyFields).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {file.analysis.summary.warnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Points d'attention</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {file.analysis.summary.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Estimated Time */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Temps estimé: {file.analysis.summary.estimatedTime}</span>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Action */}
        <Button
          size="lg"
          className="min-h-[56px] w-full"
          onClick={handleImportAll}
        >
          <Zap className="mr-2 w-5 h-5" />
          Lancer l'import
        </Button>
      </div>
    );
  };

  const renderResultsStep = () => {
    if (!importResult) return null;

    const hasErrors = importResult.fileResults.some((r) => r.errors.length > 0);

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Success/Error Header */}
        {hasErrors ? (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Import terminé avec erreurs</AlertTitle>
            <AlertDescription>
              Certains enregistrements n'ont pas pu être importés. Voir détails ci-dessous.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertTitle className="text-green-900 dark:text-green-100">
              Import réussi !
            </AlertTitle>
            <AlertDescription className="text-green-800 dark:text-green-200">
              Toutes vos données ont été importées avec succès.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé de l'import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Big Numbers */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <div className="text-4xl font-bold text-primary">
                  {importResult.totalRecords.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  enregistrements importés
                </div>
              </div>

              <div className="text-center p-4 rounded-lg bg-secondary">
                <div className="text-4xl font-bold">
                  {importResult.totalFiles}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  fichiers traités
                </div>
              </div>

              <div className="text-center p-4 rounded-lg bg-secondary">
                <div className="text-4xl font-bold">
                  {importResult.totalSheets}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  feuilles importées
                </div>
              </div>
            </div>

            <Separator />

            {/* File-by-File Results */}
            <div className="space-y-3">
              <p className="font-medium">Détails par fichier:</p>

              {importResult.fileResults.map((result, idx) => (
                <Collapsible key={idx}>
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        <p className="font-medium">{result.fileName}</p>
                        {result.errors.length > 0 && (
                          <Badge variant="destructive">
                            {result.errors.length} erreur(s)
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{result.recordsImported} enregistrements</span>
                        <span>•</span>
                        <span>{result.sheetsImported} feuille(s)</span>
                      </div>

                      {result.errors.length > 0 && (
                        <>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 p-0">
                              <ChevronDown className="w-4 h-4 mr-1" />
                              Voir les erreurs
                            </Button>
                          </CollapsibleTrigger>

                          <CollapsibleContent className="pt-2">
                            <div className="space-y-1">
                              {result.errors.map((error, errorIdx) => (
                                <p
                                  key={errorIdx}
                                  className="text-sm text-destructive"
                                >
                                  • {error}
                                </p>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </>
                      )}
                    </div>

                    {result.errors.length === 0 && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    )}
                  </div>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            variant="outline"
            className="min-h-[56px] flex-1"
            onClick={() => {
              setCurrentStep('welcome');
              setUploadedFiles([]);
              setConfirmedSheets({});
              setImportResult(null);
            }}
          >
            Importer d'autres fichiers
          </Button>

          <Button
            size="lg"
            className="min-h-[56px] flex-1"
            onClick={() => (window.location.href = '/employees')}
          >
            Voir mes employés
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="container max-w-7xl py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Intelligent</h1>
          <p className="text-muted-foreground">
            Import automatique avec IA - Zéro configuration
          </p>
        </div>
      </div>

      {/* Wizard Steps */}
      {currentStep === 'welcome' && renderWelcomeStep()}
      {currentStep === 'upload' && renderUploadStep()}
      {currentStep === 'confirm' && renderConfirmStep()}
      {currentStep === 'import' && renderImportStep()}
      {currentStep === 'results' && renderResultsStep()}

      {/* Back to Welcome */}
      {currentStep !== 'welcome' && (
        <div className="flex justify-center pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentStep('welcome');
              setUploadedFiles([]);
              setConfirmedSheets({});
              setImportResult(null);
            }}
          >
            Recommencer
          </Button>
        </div>
      )}
    </div>
  );
}
