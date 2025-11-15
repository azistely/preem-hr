/**
 * AI-Powered Import Page V2 - Cross-File Entity Building
 *
 * USER TASK: "Import ALL my company data from Excel files"
 *
 * What Users Can Do:
 * ✅ Upload multiple Excel files at once (employees, payroll, attendance, etc.)
 * ✅ AI automatically builds complete entities from multiple sources
 * ✅ See exactly what will be created (entity-based preview)
 * ✅ Review conflicts and get AI recommendations
 * ✅ Import everything with one click
 *
 * HCI Principles for Low Digital Literacy:
 * 1. Task-Oriented: "Importer vos données" not "Configure AI import"
 * 2. Entity-Based: Show "50 employés" not "3 files, 5 sheets"
 * 3. Provenance: Show where data came from (file citations)
 * 4. Zero Learning: Drop files, AI handles rest
 * 5. Progress Visibility: 9 phases with real-time updates
 * 6. Conflict Resolution: AI explains choices, user confirms only when needed
 *
 * Flow:
 * 1. UPLOAD - Drop multiple files, show previews
 * 2. ANALYZE - AI builds entity graph across all files
 * 3. CONFIRM - Review entity preview and conflicts
 * 4. IMPORT - Execute import in dependency order
 * 5. RESULTS - Show what was imported, grouped by entity type
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
  AlertTriangle,
  Info,
  TrendingUp,
  Settings,
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
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import type { EnhancedImportSummary, EntityPreview } from '@/server/ai-import/types';

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'welcome' | 'upload' | 'analyze' | 'confirm' | 'import' | 'results';

interface SheetMetadata {
  name: string;
  rowCount: number;
  selected: boolean; // User selection state
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'ready' | 'loading_metadata' | 'error';
  error?: string;
  sheets?: SheetMetadata[]; // Available sheets with selection state
  totalSheets?: number;
  totalRows?: number;
}

// Entity with source tracking
interface EntityWithSource {
  data: Record<string, any>;
  sourceFile: string;
  sourceSheet: string;
}

// AI-First Result Structure (employee-centric)
interface AIFirstAnalysisResult {
  analysisId: string;
  result: {
    employees: Array<{
      employeeId?: string;
      isNew: boolean;
      firstName: string;
      lastName: string;
      email?: string;
      cnpsNumber?: string;
      sourceFile: string;
      sourceSheet: string;
      relatedEntities: {
        payslips?: Array<EntityWithSource>;
        contracts?: Array<EntityWithSource>;
        timeEntries?: Array<EntityWithSource>;
        leaves?: Array<EntityWithSource>;
        benefits?: Array<EntityWithSource>;
        documents?: Array<EntityWithSource>;
        payrollLineItems?: Array<EntityWithSource>;
        dependents?: Array<EntityWithSource>;
        terminations?: Array<EntityWithSource>;
        overtimeEntries?: Array<EntityWithSource>;
      };
      matchConfidence: number;
      matchReason: string;
    }>;
    tenantData?: {
      tenant?: EntityWithSource;
      salaryComponents?: Array<EntityWithSource>;
    };
    rejected: {
      payslips?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      contracts?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      timeEntries?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      leaves?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      benefits?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      documents?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      payrollLineItems?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      dependents?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      terminations?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
      overtimeEntries?: Array<{ data: Record<string, any>; sourceFile: string; sourceSheet: string; reason: string }>;
    };
    summary: {
      totalEmployees: number;
      newEmployees: number;
      existingEmployees: number;
      totalEntities: number;
      rejectedEntities: number;
      tenantEntities?: number;
    };
  };
  processingTimeMs: number;
}

interface ImportResult {
  success: boolean;
  totalRecordsImported: number;
  entitiesByType: Record<string, number>;
  errors: string[];
  summary: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIImportPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AIFirstAnalysisResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations
  const uploadMutation = trpc.aiImport.uploadFile.useMutation();
  const analyzeWithAIMutation = trpc.aiImport.analyzeWithAI.useMutation();
  const executeImportMutation = trpc.aiImport.executeMultiFileImport.useMutation();
  const utils = trpc.useUtils();

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

          // Update with real ID and mark as loading metadata
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === tempId
                ? {
                    ...f,
                    id: result.fileId,
                    status: 'loading_metadata',
                  }
                : f
            )
          );

          // Fetch sheet metadata
          try {
            const metadata = await utils.client.aiImport.getFileMetadata.query({
              fileId: result.fileId,
            });

            // Update with sheets (all unchecked by default)
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === result.fileId
                  ? {
                      ...f,
                      status: 'ready',
                      sheets: metadata.sheets.map(sheet => ({
                        ...sheet,
                        selected: false, // Default: unchecked
                      })),
                      totalSheets: metadata.totalSheets,
                      totalRows: metadata.totalRows,
                    }
                  : f
              )
            );
          } catch (metadataError) {
            console.error('Failed to load metadata:', metadataError);
            // Mark as ready even if metadata fails (fallback)
            setUploadedFiles((prev) =>
              prev.map((f) =>
                f.id === result.fileId
                  ? {
                      ...f,
                      status: 'ready',
                    }
                  : f
              )
            );
          }

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

  // Toggle sheet selection
  const toggleSheet = useCallback((fileId: string, sheetName: string, selected: boolean) => {
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId && f.sheets
          ? {
              ...f,
              sheets: f.sheets.map((s) =>
                s.name === sheetName ? { ...s, selected } : s
              ),
            }
          : f
      )
    );
  }, []);

  // Select/deselect all sheets in a file
  const toggleAllSheets = useCallback((fileId: string, selected: boolean) => {
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.id === fileId && f.sheets
          ? {
              ...f,
              sheets: f.sheets.map((s) => ({ ...s, selected })),
            }
          : f
      )
    );
  }, []);

  // ============================================================================
  // V2 Multi-File Analysis Handler
  // ============================================================================

  const handleAnalyzeAll = useCallback(async () => {
    // Only analyze files that have at least one selected sheet
    const filesToAnalyze = uploadedFiles.filter(
      (f) => f.status === 'ready' && f.sheets && f.sheets.some(s => s.selected)
    );

    if (filesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    const totalSelectedSheets = filesToAnalyze.reduce(
      (acc, f) => acc + (f.sheets?.filter(s => s.selected).length || 0),
      0
    );

    toast.loading(
      `Analyse AI: ${filesToAnalyze.length} fichier(s), ${totalSelectedSheets} feuille(s)...`,
      { id: 'analyze-all' }
    );

    try {
      // Simulate progress updates (in production, use Server-Sent Events)
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      // Call AI-first analysis (single AI call) with selected sheets
      const result = await analyzeWithAIMutation.mutateAsync({
        fileSheets: filesToAnalyze.map((f) => ({
          fileId: f.id,
          sheetNames: f.sheets?.filter(s => s.selected).map(s => s.name) || [],
        })),
        countryCode: 'CI',
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      setAnalysisResult(result);

      const { totalEmployees, newEmployees, existingEmployees, rejectedEntities } = result.result.summary;

      toast.success('Analyse terminée', {
        id: 'analyze-all',
        description: `${totalEmployees} employé(s): ${newEmployees} nouveau(x), ${existingEmployees} existant(s)${rejectedEntities > 0 ? `, ${rejectedEntities} rejeté(s)` : ''}`,
      });

      // Always show confirmation for user to review
      setCurrentStep('confirm');
    } catch (error) {
      toast.error('Erreur d\'analyse', {
        id: 'analyze-all',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [uploadedFiles, analyzeWithAIMutation]);

  // ============================================================================
  // V2 Multi-File Import Handler
  // ============================================================================

  const handleImportAll = useCallback(async () => {
    if (!analysisResult) return;

    toast.loading('Import en cours...', { id: 'import-all' });

    try {
      const result = await executeImportMutation.mutateAsync({
        analysisId: analysisResult.analysisId,
        allowPartialImport: false,
      });

      setImportResult(result);

      toast.success('Import terminé', {
        id: 'import-all',
        description: result.summary,
      });

      setCurrentStep('results');
    } catch (error) {
      toast.error('Erreur d\'import', {
        id: 'import-all',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }, [analysisResult, executeImportMutation]);

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
          Déposez tous vos fichiers Excel. L'IA construit automatiquement vos données complètes.
        </p>
      </div>

      {/* What's New in V2 */}
      <Alert className="border-primary bg-primary/5">
        <TrendingUp className="w-4 h-4 text-primary" />
        <AlertTitle className="text-primary">Nouveau : Construction cross-fichiers</AlertTitle>
        <AlertDescription>
          L'IA fusionne intelligemment les données de plusieurs fichiers pour créer des entités
          complètes. Par exemple : employés.xlsx + salaires.xlsx = employés avec leurs salaires.
        </AlertDescription>
      </Alert>

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
                <p className="font-medium">Fusion intelligente</p>
                <p className="text-sm text-muted-foreground">
                  L'IA combine automatiquement les données de plusieurs fichiers
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Détection de conflits</p>
                <p className="text-sm text-muted-foreground">
                  Résolution automatique des incohérences entre fichiers
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Provenance complète</p>
                <p className="text-sm text-muted-foreground">
                  Savoir d'où vient chaque donnée (source citations)
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Aperçu exact</p>
                <p className="text-sm text-muted-foreground">
                  Voir exactement ce qui sera créé avant d'importer
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Examples */}
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
            Vous pouvez déposer plusieurs fichiers à la fois. L'IA construira automatiquement les
            entités complètes en fusionnant les données de tous les fichiers.
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
                <p className="text-lg font-medium">Glissez vos fichiers ici</p>
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
              <p className="text-sm font-medium">{uploadedFiles.length} fichier(s) uploadé(s)</p>

              <div className="space-y-3">
                {uploadedFiles.map((file) => {
                  const selectedSheets = file.sheets?.filter(s => s.selected).length || 0;
                  const totalSheets = file.sheets?.length || 0;

                  return (
                    <Card key={file.id} className="overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        {/* Icon */}
                        <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(0)} Ko
                            {file.totalSheets && ` • ${file.totalSheets} feuille(s)`}
                            {selectedSheets > 0 && ` • ${selectedSheets} sélectionnée(s)`}
                          </p>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2">
                          {file.status === 'uploading' && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                          {file.status === 'loading_metadata' && (
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          )}
                          {file.status === 'ready' && file.sheets && (
                            <Badge variant={selectedSheets > 0 ? "default" : "outline"} className="text-xs">
                              {selectedSheets}/{totalSheets}
                            </Badge>
                          )}
                          {file.status === 'error' && (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          )}

                          {/* Remove Button */}
                          {file.status !== 'uploading' && file.status !== 'loading_metadata' && (
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

                      {/* Sheet Selection (only show if metadata loaded) */}
                      {file.status === 'ready' && file.sheets && file.sheets.length > 0 && (
                        <Collapsible defaultOpen>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between border-t rounded-none px-3 h-9"
                            >
                              <span className="text-xs font-normal">
                                Sélectionnez les feuilles à analyser
                              </span>
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 py-2 border-t bg-muted/30">
                            <div className="space-y-2">
                              {/* Select/Deselect All */}
                              <div className="flex items-center gap-2 pb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => toggleAllSheets(file.id, true)}
                                >
                                  Tout sélectionner
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => toggleAllSheets(file.id, false)}
                                >
                                  Tout désélectionner
                                </Button>
                              </div>

                              {/* Sheet Checkboxes */}
                              {file.sheets.map((sheet) => (
                                <div
                                  key={sheet.name}
                                  className="flex items-center gap-2 py-1 hover:bg-muted/50 rounded px-2"
                                >
                                  <Checkbox
                                    id={`${file.id}-${sheet.name}`}
                                    checked={sheet.selected}
                                    onCheckedChange={(checked) =>
                                      toggleSheet(file.id, sheet.name, checked === true)
                                    }
                                  />
                                  <label
                                    htmlFor={`${file.id}-${sheet.name}`}
                                    className="flex-1 text-sm cursor-pointer"
                                  >
                                    {sheet.name}
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({sheet.rowCount} lignes)
                                    </span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Analysis Progress */}
          {isAnalyzing && (
            <div className="space-y-3 p-4 rounded-lg border bg-primary/5">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Analyse en cours...</p>
                  <p className="text-xs text-muted-foreground">
                    Construction du graphe d'entités et détection des conflits
                  </p>
                </div>
              </div>
              <Progress value={analysisProgress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            {(() => {
              const totalSelectedSheets = uploadedFiles.reduce(
                (acc, f) => acc + (f.sheets?.filter(s => s.selected).length || 0),
                0
              );
              const hasSelectedSheets = totalSelectedSheets > 0;

              return (
                uploadedFiles.some((f) => f.status === 'ready') && !isAnalyzing && (
                  <Button
                    size="lg"
                    className="min-h-[56px] flex-1"
                    onClick={handleAnalyzeAll}
                    disabled={!hasSelectedSheets}
                  >
                    <Brain className="mr-2 w-5 h-5" />
                    {hasSelectedSheets
                      ? `Analyser ${totalSelectedSheets} feuille${totalSelectedSheets > 1 ? 's' : ''}`
                      : 'Sélectionnez des feuilles pour analyser'}
                  </Button>
                )
              );
            })()}

            {!isAnalyzing && (
              <Button
                variant="outline"
                size="lg"
                className="min-h-[56px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="mr-2 w-5 h-5" />
                Ajouter d'autres fichiers
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help Alert */}
      <Alert>
        <Sparkles className="w-4 h-4" />
        <AlertTitle>L'IA s'occupe de tout</AlertTitle>
        <AlertDescription>
          L'analyse V2 construit automatiquement le graphe d'entités, fusionne les données de
          plusieurs fichiers, détecte et résout les conflits. Vous verrez un aperçu exact de ce
          qui sera créé.
        </AlertDescription>
      </Alert>
    </div>
  );

  const renderConfirmStep = () => {
    if (!analysisResult) return null;

    const { employees, rejected, summary } = analysisResult.result;

    // Count total related entities across all employees
    const totalRelatedEntities = employees.reduce((sum, emp) => {
      const payslips = emp.relatedEntities.payslips?.length || 0;
      const contracts = emp.relatedEntities.contracts?.length || 0;
      const timeEntries = emp.relatedEntities.timeEntries?.length || 0;
      const leaves = emp.relatedEntities.leaves?.length || 0;
      const benefits = emp.relatedEntities.benefits?.length || 0;
      const documents = emp.relatedEntities.documents?.length || 0;
      const payrollLineItems = emp.relatedEntities.payrollLineItems?.length || 0;
      const dependents = emp.relatedEntities.dependents?.length || 0;
      const terminations = emp.relatedEntities.terminations?.length || 0;
      const overtimeEntries = emp.relatedEntities.overtimeEntries?.length || 0;
      return sum + payslips + contracts + timeEntries + leaves + benefits + documents +
        payrollLineItems + dependents + terminations + overtimeEntries;
    }, 0);

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

        {/* Overall Summary */}
        <Alert className="border-primary bg-primary/5">
          <Brain className="w-4 h-4 text-primary" />
          <AlertTitle className="text-primary">Analyse IA terminée</AlertTitle>
          <AlertDescription className="text-base">
            L'IA a identifié <strong>{summary.totalEmployees} employé(s)</strong>
            {summary.newEmployees > 0 && <> dont <strong className="text-green-600">{summary.newEmployees} nouveau(x)</strong></>}
            {summary.existingEmployees > 0 && <> et <strong className="text-blue-600">{summary.existingEmployees} existant(s)</strong></>}
            {totalRelatedEntities > 0 && <>, avec <strong>{totalRelatedEntities} entité(s) associée(s)</strong></>}.
            {summary.rejectedEntities > 0 && <> <strong className="text-amber-600">{summary.rejectedEntities} entité(s) rejetée(s)</strong> (employé non trouvé).</>}
          </AlertDescription>
        </Alert>

        {/* Processing Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {summary.newEmployees}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Nouveaux employés</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {summary.existingEmployees}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Employés existants</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">
                  {(analysisResult.processingTimeMs / 1000).toFixed(1)}s
                </div>
                <p className="text-sm text-muted-foreground mt-1">Temps d'analyse</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee-Centric Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Employés qui seront importés</CardTitle>
            <CardDescription>
              Chaque employé avec ses données associées (bulletins, contrats, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {employees.slice(0, 10).map((employee, idx) => {
              const payslipsCount = employee.relatedEntities.payslips?.length || 0;
              const contractsCount = employee.relatedEntities.contracts?.length || 0;
              const timeEntriesCount = employee.relatedEntities.timeEntries?.length || 0;
              const leavesCount = employee.relatedEntities.leaves?.length || 0;
              const benefitsCount = employee.relatedEntities.benefits?.length || 0;
              const documentsCount = employee.relatedEntities.documents?.length || 0;
              const payrollLineItemsCount = employee.relatedEntities.payrollLineItems?.length || 0;
              const dependentsCount = employee.relatedEntities.dependents?.length || 0;
              const terminationsCount = employee.relatedEntities.terminations?.length || 0;
              const overtimeEntriesCount = employee.relatedEntities.overtimeEntries?.length || 0;
              const totalRelated = payslipsCount + contractsCount + timeEntriesCount + leavesCount +
                benefitsCount + documentsCount + payrollLineItemsCount + dependentsCount +
                terminationsCount + overtimeEntriesCount;

              return (
                <Collapsible key={idx}>
                  <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                    {/* Employee Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          employee.isNew ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                          <Users className={`w-5 h-5 ${
                            employee.isNew ? 'text-green-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-base">
                              {employee.firstName} {employee.lastName}
                            </h4>
                            <Badge variant={employee.isNew ? 'default' : 'secondary'} className="text-xs">
                              {employee.isNew ? 'NOUVEAU' : 'EXISTANT'}
                            </Badge>
                            {employee.matchConfidence < 100 && (
                              <Badge variant="outline" className="text-xs">
                                {employee.matchConfidence}% confiance
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                            {employee.email && <span>{employee.email}</span>}
                            {employee.cnpsNumber && <span>CNPS: {employee.cnpsNumber}</span>}
                          </div>
                          {/* Source Tracking */}
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <FileSpreadsheet className="w-3 h-3" />
                            <span>Source: {employee.sourceFile} › {employee.sourceSheet}</span>
                          </div>
                          {totalRelated > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {payslipsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Banknote className="w-3 h-3 mr-1" />
                                  {payslipsCount} bulletin(s)
                                </Badge>
                              )}
                              {contractsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  {contractsCount} contrat(s)
                                </Badge>
                              )}
                              {timeEntriesCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {timeEntriesCount} pointage(s)
                                </Badge>
                              )}
                              {leavesCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {leavesCount} congé(s)
                                </Badge>
                              )}
                              {benefitsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {benefitsCount} avantage(s)
                                </Badge>
                              )}
                              {documentsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {documentsCount} document(s)
                                </Badge>
                              )}
                              {payrollLineItemsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {payrollLineItemsCount} ligne(s) paie
                                </Badge>
                              )}
                              {dependentsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {dependentsCount} ayant(s) droit
                                </Badge>
                              )}
                              {terminationsCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {terminationsCount} sortie(s)
                                </Badge>
                              )}
                              {overtimeEntriesCount > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {overtimeEntriesCount} heure(s) sup
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {totalRelated > 0 && (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="ml-2">
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>

                    {/* Related Entities Details */}
                    {totalRelated > 0 && (
                      <CollapsibleContent className="mt-3 pt-3 border-t space-y-2">
                        {payslipsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Bulletins de paie:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.payslips?.slice(0, 3).map((payslip, pIdx) => (
                                <div key={pIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {payslip.data.period || payslip.data.month || `Bulletin ${pIdx + 1}`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({payslip.sourceFile} › {payslip.sourceSheet})
                                  </span>
                                </div>
                              ))}
                              {payslipsCount > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{payslipsCount - 3} autre(s)
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        {contractsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Contrats:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.contracts?.map((contract, cIdx) => (
                                <div key={cIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {contract.data.contractType || contract.data.type || `Contrat ${cIdx + 1}`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({contract.sourceFile} › {contract.sourceSheet})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {timeEntriesCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Pointages:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.timeEntries?.slice(0, 3).map((entry, tIdx) => (
                                <div key={tIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.data.date} - {entry.data.hoursWorked}h
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({entry.sourceFile} › {entry.sourceSheet})
                                  </span>
                                </div>
                              ))}
                              {timeEntriesCount > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{timeEntriesCount - 3} autre(s)
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        {leavesCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Congés:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.leaves?.map((leave, lIdx) => (
                                <div key={lIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {leave.data.leaveType} - {leave.data.startDate}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({leave.sourceFile} › {leave.sourceSheet})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {benefitsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Avantages:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.benefits?.map((benefit, bIdx) => (
                                <div key={bIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {benefit.data.benefitType} - {benefit.data.amount.toLocaleString()} FCFA
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({benefit.sourceFile} › {benefit.sourceSheet})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {documentsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Documents:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.documents?.map((doc, dIdx) => (
                                <div key={dIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {doc.data.documentType}
                                    {doc.data.reference && ` - ${doc.data.reference}`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({doc.sourceFile} › {doc.sourceSheet})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {payrollLineItemsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Lignes de paie:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.payrollLineItems?.slice(0, 3).map((item, iIdx) => (
                                <div key={iIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.data.description} - {item.data.amount.toLocaleString()} FCFA
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({item.sourceFile} › {item.sourceSheet})
                                  </span>
                                </div>
                              ))}
                              {payrollLineItemsCount > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{payrollLineItemsCount - 3} autre(s)
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        {dependentsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Ayants droit:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.dependents?.map((dep, depIdx) => (
                                <div key={depIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {dep.data.firstName} {dep.data.lastName} - {dep.data.relationship}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({dep.sourceFile} › {dep.sourceSheet})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {terminationsCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Sorties:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.terminations?.map((term, termIdx) => (
                                <div key={termIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {term.data.reason} - {term.data.terminationDate}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({term.sourceFile} › {term.sourceSheet})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {overtimeEntriesCount > 0 && (
                          <div className="text-sm">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Heures supplémentaires:</p>
                            <div className="space-y-1">
                              {employee.relatedEntities.overtimeEntries?.slice(0, 3).map((ot, otIdx) => (
                                <div key={otIdx} className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {ot.data.date} - {ot.data.overtimeHours}h
                                    {ot.data.rate && ` (×${ot.data.rate})`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    ({ot.sourceFile} › {ot.sourceSheet})
                                  </span>
                                </div>
                              ))}
                              {overtimeEntriesCount > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{overtimeEntriesCount - 3} autre(s)
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </CollapsibleContent>
                    )}

                    {/* Match Reasoning (for low confidence) */}
                    {employee.matchConfidence < 90 && employee.matchReason && (
                      <Alert className="mt-3">
                        <Info className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          {employee.matchReason}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </Collapsible>
              );
            })}

            {employees.length > 10 && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                ... et {employees.length - 10} autre(s) employé(s)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rejected Entities */}
        {summary.rejectedEntities > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>{summary.rejectedEntities} entité(s) rejetée(s)</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                Ces entités n'ont pas pu être associées à un employé et seront ignorées lors de l'import:
              </p>
              <div className="space-y-2">
                {Object.entries(rejected).map(([entityType, entities]) => {
                  if (!entities || entities.length === 0) return null;

                  return (
                    <div key={entityType} className="bg-destructive/10 rounded-lg p-3">
                      <p className="font-medium text-sm mb-1">
                        {entityType === 'payslips' && `${entities.length} bulletin(s) de paie`}
                        {entityType === 'contracts' && `${entities.length} contrat(s)`}
                        {entityType === 'timeEntries' && `${entities.length} pointage(s)`}
                        {entityType === 'leaves' && `${entities.length} congé(s)`}
                        {entityType === 'benefits' && `${entities.length} avantage(s)`}
                        {entityType === 'documents' && `${entities.length} document(s)`}
                        {entityType === 'payrollLineItems' && `${entities.length} ligne(s) de paie`}
                        {entityType === 'dependents' && `${entities.length} ayant(s) droit`}
                        {entityType === 'terminations' && `${entities.length} sortie(s)`}
                        {entityType === 'overtimeEntries' && `${entities.length} heure(s) supplémentaires`}
                      </p>
                      <div className="space-y-1">
                        {entities.slice(0, 3).map((rejected, idx) => (
                          <div key={idx} className="text-xs">
                            <div className="text-muted-foreground">• {rejected.reason}</div>
                            <div className="text-muted-foreground/70 ml-3 mt-0.5">
                              Source: {rejected.sourceFile} › {rejected.sourceSheet}
                            </div>
                          </div>
                        ))}
                        {entities.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            ... et {entities.length - 3} autre(s)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Alert className="mt-3 border-amber-200 bg-amber-50">
                <Info className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-900">
                  Pour importer ces entités, assurez-vous d'inclure un fichier avec les employés correspondants,
                  ou vérifiez que les identifiants (numéro employé, email, CNPS) sont corrects.
                </AlertDescription>
              </Alert>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            variant="outline"
            className="min-h-[56px]"
            onClick={() => setCurrentStep('upload')}
          >
            Retour à l'upload
          </Button>
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
    if (!analysisResult) return null;

    const { employees, summary, tenantData } = analysisResult.result;

    // Calculate actual entity counts
    const entityCounts = {
      payslips: employees.reduce((sum, emp) => sum + (emp.relatedEntities.payslips?.length || 0), 0),
      contracts: employees.reduce((sum, emp) => sum + (emp.relatedEntities.contracts?.length || 0), 0),
      timeEntries: employees.reduce((sum, emp) => sum + (emp.relatedEntities.timeEntries?.length || 0), 0),
      leaves: employees.reduce((sum, emp) => sum + (emp.relatedEntities.leaves?.length || 0), 0),
    };

    // Build entity breakdown text
    const entityBreakdown = [
      entityCounts.payslips > 0 && `${entityCounts.payslips} bulletin(s)`,
      entityCounts.contracts > 0 && `${entityCounts.contracts} contrat(s)`,
      entityCounts.timeEntries > 0 && `${entityCounts.timeEntries} pointage(s)`,
      entityCounts.leaves > 0 && `${entityCounts.leaves} congé(s)`,
    ]
      .filter(Boolean)
      .join(', ');

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

        {/* Import Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Prêt pour l'import</CardTitle>
            <CardDescription className="text-base">
              {summary.totalEmployees} employé(s) et leurs données associées seront importés
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Employee Summary */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{summary.newEmployees} nouveau(x)</p>
                  <p className="text-xs text-muted-foreground">Seront créés</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{summary.existingEmployees} existant(s)</p>
                  <p className="text-xs text-muted-foreground">Avec nouvelles données</p>
                </div>
              </div>
            </div>

            {/* Total Entities */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {summary.totalEntities} entité(s) au total
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entityBreakdown || 'Aucune entité associée'}
                  </p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>

            {/* Tenant Data */}
            {summary.tenantEntities && summary.tenantEntities > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium">
                      {summary.tenantEntities} donnée(s) tenant
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tenantData?.tenant && 'Info société'}
                      {tenantData?.tenant && tenantData?.salaryComponents && ', '}
                      {tenantData?.salaryComponents && `${tenantData.salaryComponents.length} rubrique(s) paie`}
                    </p>
                    {tenantData?.tenant && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>{tenantData.tenant.data.name}</strong> ({tenantData.tenant.data.countryCode})
                      </p>
                    )}
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
            )}

            {summary.rejectedEntities > 0 && (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                  {summary.rejectedEntities} entité(s) seront ignorées (employé non trouvé)
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            size="lg"
            variant="outline"
            className="min-h-[56px]"
            onClick={() => setCurrentStep('confirm')}
          >
            Retour à la confirmation
          </Button>
          <Button size="lg" className="min-h-[56px] flex-1" onClick={handleImportAll}>
            <Zap className="mr-2 w-5 h-5" />
            Lancer l'import
          </Button>
        </div>
      </div>
    );
  };

  const renderResultsStep = () => {
    if (!importResult) return null;

    const hasErrors = importResult.errors.length > 0;

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
              {importResult.summary}
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé de l'import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Big Number */}
            <div className="text-center p-6 rounded-lg bg-primary/5">
              <div className="text-5xl font-bold text-primary">
                {importResult.totalRecordsImported.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                enregistrements importés
              </div>
            </div>

            <Separator />

            {/* Entity-by-Entity Results */}
            <div className="space-y-3">
              <p className="font-medium">Détails par type d'entité:</p>

              {Object.entries(importResult.entitiesByType).map(([entityType, count]) => (
                <div
                  key={entityType}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">{entityType}</p>
                      <p className="text-sm text-muted-foreground">{count} enregistrement(s)</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              ))}
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Erreurs rencontrées</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
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
              setAnalysisResult(null);
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
          <h1 className="text-2xl font-bold tracking-tight">Import Intelligent V2</h1>
          <p className="text-muted-foreground">
            Import multi-fichiers avec fusion cross-source et résolution de conflits
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
      {currentStep !== 'welcome' && currentStep !== 'results' && (
        <div className="flex justify-center pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              setCurrentStep('welcome');
              setUploadedFiles([]);
              setAnalysisResult(null);
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
