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
import type { EnhancedImportSummary, EntityPreview } from '@/server/ai-import/types';

// ============================================================================
// Types
// ============================================================================

type WizardStep = 'welcome' | 'upload' | 'analyze' | 'confirm' | 'import' | 'results';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
  error?: string;
}

interface MultiFileAnalysisResult {
  analysisId: string;
  summary: EnhancedImportSummary;
  entityGraph: {
    entities: Record<string, any>;
    crossReferences: any[];
  };
  conflicts: {
    total: number;
    autoResolved: number;
    requiresUser: number;
  };
  needsConfirmation: boolean;
  confirmationReasons: string[];
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
  const [analysisResult, setAnalysisResult] = useState<MultiFileAnalysisResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations
  const uploadMutation = trpc.aiImport.uploadFile.useMutation();
  const analyzeMultiFileMutation = trpc.aiImport.analyzeMultiFile.useMutation();
  const executeImportMutation = trpc.aiImport.executeMultiFileImport.useMutation();

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
  // V2 Multi-File Analysis Handler
  // ============================================================================

  const handleAnalyzeAll = useCallback(async () => {
    const filesToAnalyze = uploadedFiles.filter((f) => f.status === 'ready');

    if (filesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    toast.loading(`Analyse intelligente de ${filesToAnalyze.length} fichier(s)...`, {
      id: 'analyze-all',
    });

    try {
      // Simulate progress updates (in production, use Server-Sent Events)
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      // Call V2 multi-file analysis
      const result = await analyzeMultiFileMutation.mutateAsync({
        fileIds: filesToAnalyze.map((f) => f.id),
        countryCode: 'CI',
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      setAnalysisResult(result);

      toast.success('Analyse terminée', {
        id: 'analyze-all',
        description: `${result.summary.entities.length} type(s) d'entités identifié(s)`,
      });

      if (result.needsConfirmation) {
        setCurrentStep('confirm');
      } else {
        setCurrentStep('import');
      }
    } catch (error) {
      toast.error('Erreur d\'analyse', {
        id: 'analyze-all',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [uploadedFiles, analyzeMultiFileMutation]);

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
            {uploadedFiles.some((f) => f.status === 'ready') && !isAnalyzing && (
              <Button
                size="lg"
                className="min-h-[56px] flex-1"
                onClick={handleAnalyzeAll}
              >
                <Brain className="mr-2 w-5 h-5" />
                Analyser tous les fichiers (
                {uploadedFiles.filter((f) => f.status === 'ready').length})
              </Button>
            )}

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
          <Info className="w-4 h-4 text-primary" />
          <AlertTitle className="text-primary">Aperçu de l'import</AlertTitle>
          <AlertDescription className="text-base">
            {analysisResult.summary.overallSummary}
          </AlertDescription>
        </Alert>

        {/* Processing Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {analysisResult.summary.entities.length}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Types d'entités</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {analysisResult.conflicts.autoResolved}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Conflits résolus</p>
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

        {/* Entity-Based Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Ce qui sera créé</CardTitle>
            <CardDescription>
              Aperçu exact des entités qui seront importées avec provenance des données
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisResult.summary.entities.map((entity, idx) => (
              <Collapsible key={idx}>
                <div className="border rounded-lg p-4 bg-card">
                  {/* Entity Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg text-primary">
                          {entity.count} {entity.entityName}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Complétude moyenne: {entity.completeness}%
                        </p>
                      </div>
                    </div>

                    {entity.unresolvedConflicts > 0 && (
                      <Badge variant="destructive">
                        {entity.unresolvedConflicts} conflit(s)
                      </Badge>
                    )}
                  </div>

                  {/* Examples with Provenance */}
                  {entity.examples && entity.examples.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Voir {entity.examples.length} exemple(s)
                        </span>
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-3">
                      {entity.examples.map((example, exIdx) => (
                        <div key={exIdx} className="bg-muted/50 rounded-lg p-3 space-y-2">
                          {/* Description */}
                          <p className="font-medium">{example.description}</p>

                          {/* Categorized Fields */}
                          {Object.entries(example.categories).map(([category, fields]) => (
                            <div key={category} className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground uppercase">
                                {category}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(fields as Record<string, any>).map(([key, value]) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {key}: {String(value)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}

                          {/* Provenance (Sources) */}
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Sources:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {Object.values(example.sources).map((source, srcIdx) => (
                                <Badge key={srcIdx} variant="outline" className="text-xs">
                                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                                  {String(source)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </div>
                  )}
                </div>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        {/* Conflicts Requiring User Confirmation */}
        {analysisResult.conflicts.requiresUser > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>Conflits nécessitant votre confirmation</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2">
                {analysisResult.confirmationReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm">
                L'IA a détecté des incohérences critiques. Veuillez vérifier les exemples
                ci-dessus avant de continuer.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {analysisResult.summary.warnings.length > 0 && (
          <Alert>
            <Info className="w-4 h-4" />
            <AlertTitle>Points d'attention</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {analysisResult.summary.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Estimated Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Temps estimé d'import: {analysisResult.summary.estimatedTime}</span>
        </div>

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
    if (!analysisResult) return null;

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
              {analysisResult.summary.overallSummary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Entity List */}
            <div className="space-y-2">
              {analysisResult.summary.entities.map((entity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {entity.count} {entity.entityName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Complétude: {entity.completeness}%
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              ))}
            </div>

            {/* Estimated Time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Temps estimé: {analysisResult.summary.estimatedTime}</span>
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <Button size="lg" className="min-h-[56px] w-full" onClick={handleImportAll}>
          <Zap className="mr-2 w-5 h-5" />
          Lancer l'import
        </Button>
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
