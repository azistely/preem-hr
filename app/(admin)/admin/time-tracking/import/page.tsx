/**
 * Biometric Time Tracking Import Wizard
 *
 * 5-step wizard for importing time entries from biometric devices:
 * 1. Upload File & Select Device Type
 * 2. Column Mapping (Generic CSV only)
 * 3. Validation & Preview
 * 4. Employee Mapping (for unmatched employees)
 * 5. Import Options & Confirmation
 *
 * HCI Principles:
 * - Wizard pattern for complex task
 * - Large touch targets (min 44×44px)
 * - Progressive disclosure (show only current step)
 * - Smart defaults (auto-detect device type)
 * - Error prevention (validate before import)
 * - Immediate feedback (loading states, progress)
 * - 100% French
 */

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  Download,
  Info,
  HelpCircle,
} from 'lucide-react';

type DeviceType = 'zkteco' | 'anviz' | 'generic';
type WizardStep = 'upload' | 'validate' | 'mapping' | 'options' | 'results';

interface UploadedFile {
  fileId: string;
  url: string;
  filename: string;
  deviceType: DeviceType | null;
}

interface ValidationResult {
  deviceType: DeviceType;
  stats: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
    pairedEntries: number;
    unpairedPunches: number;
    uniqueEmployees: number;
    dateRange: { start: Date; end: Date } | null;
  };
  pairedEntries: any[];
  unpairedPunches: any[];
  employeeMappings: Array<{
    deviceEmployeeId: string;
    deviceEmployeeName?: string;
    employeeId?: string;
    employeeNumber?: string;
    employeeName?: string;
    matchType: 'exact' | 'fuzzy' | 'manual' | 'unmapped';
  }>;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
    code: string;
  }>;
  preview: any[];
}

export default function TimeTrackingImportPage() {
  const router = useRouter();
  const { toast } = useToast();

  // UI mode state - null means user hasn't chosen yet
  const [selectedMode, setSelectedMode] = useState<'quick' | 'guided' | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [deviceType, setDeviceType] = useState<DeviceType>(() => {
    // Remember device type from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('biometric-device-type');
      return (saved as DeviceType) || 'generic';
    }
    return 'generic';
  });
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [employeeMapping, setEmployeeMapping] = useState<Record<string, string>>({});
  const [skipErrors, setSkipErrors] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Mutations
  const uploadMutation = api.timeTrackingImport.uploadFile.useMutation();
  const validateMutation = api.timeTrackingImport.validateFile.useMutation();
  const executeMutation = api.timeTrackingImport.executeImport.useMutation();

  // Save device type to localStorage
  const saveDeviceType = (type: DeviceType) => {
    setDeviceType(type);
    if (typeof window !== 'undefined') {
      localStorage.setItem('biometric-device-type', type);
    }
  };

  // Step 1: Handle file selection
  const handleFileSelect = (file: File) => {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExtension = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      toast({
        title: 'Format invalide',
        description: 'Seuls les fichiers CSV et Excel sont acceptés (.csv, .xlsx, .xls)',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Fichier trop volumineux',
        description: 'Taille maximum: 10 MB. Divisez votre fichier en plusieurs périodes.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);

    // If in quick mode, auto-start upload
    if (selectedMode === 'quick') {
      setTimeout(() => handleUpload(), 100); // Small delay for state update
    }
  };

  // Handle drag and drop
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

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  // Step 1: Upload file
  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result?.toString().split(',')[1];
        if (!base64) {
          toast({
            title: 'Erreur',
            description: 'Impossible de lire le fichier',
            variant: 'destructive',
          });
          return;
        }

        const result = await uploadMutation.mutateAsync({
          file: base64,
          filename: selectedFile.name,
          deviceType,
        });

        setUploadedFile(result);
        setCurrentStep('validate');

        // Auto-trigger validation
        handleValidate(result.fileId);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      toast({
        title: 'Erreur de téléchargement',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    }
  };

  // Step 2: Validate file
  const handleValidate = async (fileId?: string) => {
    const targetFileId = fileId || uploadedFile?.fileId;
    if (!targetFileId) return;

    try {
      const result = await validateMutation.mutateAsync({
        fileId: targetFileId,
        deviceType,
        timezoneOffset: new Date().getTimezoneOffset(),
      });

      setValidationResult(result as any);

      // Auto-populate employee mapping for matched employees
      const initialMapping: Record<string, string> = {};
      result.employeeMappings.forEach((mapping: any) => {
        if (mapping.employeeId && mapping.matchType !== 'unmapped') {
          initialMapping[mapping.deviceEmployeeId] = mapping.employeeId;
        }
      });
      setEmployeeMapping(initialMapping);

      setCurrentStep('mapping');
    } catch (error) {
      toast({
        title: 'Erreur de validation',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    }
  };

  // Step 3: Update employee mapping
  const handleMappingChange = (deviceEmployeeId: string, employeeId: string) => {
    setEmployeeMapping(prev => ({
      ...prev,
      [deviceEmployeeId]: employeeId,
    }));
  };

  // Step 4: Execute import
  const handleImport = async () => {
    if (!uploadedFile || !validationResult) return;

    try {
      const result = await executeMutation.mutateAsync({
        fileId: uploadedFile.fileId,
        deviceType: validationResult.deviceType,
        employeeMapping,
        timezoneOffset: new Date().getTimezoneOffset(),
        skipErrors,
        autoApprove,
      });

      setImportResult(result);
      setCurrentStep('results');

      toast({
        title: 'Import réussi',
        description: `${result.imported} entrée(s) importée(s) avec succès`,
      });
    } catch (error) {
      toast({
        title: 'Erreur d\'import',
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    }
  };

  // Calculate progress
  const getProgress = () => {
    const steps = ['upload', 'validate', 'mapping', 'options', 'results'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  // Get unmapped employees count
  const getUnmappedCount = () => {
    if (!validationResult) return 0;
    return validationResult.employeeMappings.filter(
      m => !employeeMapping[m.deviceEmployeeId]
    ).length;
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/time-tracking">
          <Button variant="ghost" size="sm" className="min-h-[44px]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Importer depuis appareil biométrique
          </h1>
          <p className="text-muted-foreground mt-1">
            Importez les heures de travail depuis ZKTeco, Anviz ou fichier CSV générique
          </p>
        </div>
      </div>

      {/* Mode Selection Screen - CLEAR CHOICE UPFRONT */}
      {selectedMode === null && (
        <div className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-900 font-semibold">
              Comment souhaitez-vous importer vos données ?
            </AlertTitle>
            <AlertDescription className="text-blue-800">
              Choisissez l'option qui vous convient le mieux
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Guided Mode Card - RECOMMENDED FOR FIRST TIME */}
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all border-2 border-green-200 bg-green-50/30"
              onClick={() => setSelectedMode('guided')}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge className="bg-green-600 text-white">Recommandé</Badge>
                </div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <HelpCircle className="h-6 w-6 text-green-600" />
                  </div>
                  Mode guidé
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Pour les nouveaux utilisateurs ou si c'est votre première fois
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Je vous guide étape par étape</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Exemples et explications à chaque étape</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Vérification et validation avant l'import</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Idéal si vous ne connaissez pas votre appareil</span>
                  </li>
                </ul>
                <Button
                  className="w-full mt-6 min-h-[56px] bg-green-600 hover:bg-green-700 text-lg"
                  onClick={() => setSelectedMode('guided')}
                >
                  Commencer le mode guidé
                </Button>
              </CardContent>
            </Card>

            {/* Quick Mode Card - FOR EXPERTS */}
            <Card
              className="cursor-pointer hover:border-primary hover:shadow-lg transition-all border-2"
              onClick={() => setSelectedMode('quick')}
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline">Pour les habitués</Badge>
                </div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  Import rapide
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Si vous avez déjà importé des données auparavant
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Import en une seule étape</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Glissez-déposez votre fichier directement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Se souvient de vos préférences</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Gain de temps pour les imports réguliers</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  className="w-full mt-6 min-h-[56px] text-lg"
                  onClick={() => setSelectedMode('quick')}
                >
                  Import rapide
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Quick Mode - For returning users */}
      {selectedMode === 'quick' && (
        <div className="space-y-4">
          <Card className="border-2 border-dashed border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import rapide
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMode(null)}
                  className="min-h-[44px]"
                >
                  Changer de mode
                </Button>
              </CardTitle>
              <CardDescription>
                Glissez-déposez votre fichier {' '}
                {deviceType === 'zkteco' ? 'ZKTeco' : deviceType === 'anviz' ? 'Anviz' : 'CSV'} ici
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center transition-colors
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Glissez votre fichier ici
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  ou cliquez pour sélectionner
                </p>
                <input
                  type="file"
                  id="quick-file-input"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                <Button
                  onClick={() => document.getElementById('quick-file-input')?.click()}
                  className="min-h-[44px]"
                >
                  Choisir un fichier
                </Button>
              </div>

              {/* Device type selector for quick mode */}
              <div className="mt-6 space-y-2">
                <Label>Type d'appareil</Label>
                <Select value={deviceType} onValueChange={saveDeviceType}>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">CSV Générique</SelectItem>
                    <SelectItem value="zkteco">ZKTeco</SelectItem>
                    <SelectItem value="anviz">Anviz</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Votre choix sera mémorisé pour la prochaine fois
                </p>
              </div>

              {/* Quick help */}
              <div className="mt-6 pt-6 border-t">
                <Button
                  variant="outline"
                  className="w-full min-h-[44px]"
                  asChild
                >
                  <a
                    href={`/templates/exemple-import-${deviceType}.csv`}
                    download
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger un exemple de format
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress bar - Only show in guided mode */}
      {selectedMode === 'guided' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Étape {currentStep === 'upload' ? 1 : currentStep === 'validate' ? 2 : currentStep === 'mapping' ? 3 : currentStep === 'options' ? 4 : 5} sur 5</span>
                <span className="text-muted-foreground">{Math.round(getProgress())}%</span>
              </div>
              <Progress value={getProgress()} className="h-2" />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedMode(null);
                    setCurrentStep('upload');
                    setSelectedFile(null);
                    setUploadedFile(null);
                  }}
                  className="min-h-[44px] text-xs"
                >
                  Changer de mode
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Upload - Only show in guided mode */}
      {selectedMode === 'guided' && currentStep === 'upload' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Étape 1: Sélectionnez votre appareil
              </CardTitle>
              <CardDescription>
                Choisissez le type d'appareil biométrique que vous utilisez
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Device type selector */}
              <div className="space-y-2">
                <Label>Type d'appareil</Label>
                <Select value={deviceType} onValueChange={(v) => saveDeviceType(v as DeviceType)}>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <div>
                          <div className="font-medium">CSV Générique</div>
                          <div className="text-xs text-muted-foreground">Je ne connais pas mon appareil ou j'ai un fichier CSV</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="zkteco">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <div>
                          <div className="font-medium">ZKTeco</div>
                          <div className="text-xs text-muted-foreground">Exporté depuis ZKTime (AC-No., Date/Time, State)</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="anviz">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Anviz</div>
                          <div className="text-xs text-muted-foreground">Exporté depuis CrossChex Cloud</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  💡 Pas sûr? Choisissez "CSV Générique" - vous pourrez mapper les colonnes à l'étape suivante
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Help - Example CSV Template (appears AFTER device selection) */}
          <Alert className="border-blue-200 bg-blue-50">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            <AlertTitle className="text-blue-900 font-semibold">
              Exemple de format pour {deviceType === 'zkteco' ? 'ZKTeco' : deviceType === 'anviz' ? 'Anviz' : 'CSV Générique'}
            </AlertTitle>
            <AlertDescription className="text-blue-800">
              <p className="mb-3">
                {deviceType === 'zkteco' && 'Téléchargez un exemple de fichier exporté depuis ZKTime avec les colonnes: AC-No., Name, Date/Time, State, Device Name.'}
                {deviceType === 'anviz' && 'Téléchargez un exemple de fichier exporté depuis CrossChex Cloud avec les colonnes: Employee ID, Employee Name, Date, Time, Direction.'}
                {deviceType === 'generic' && 'Téléchargez un exemple de fichier CSV générique avec les colonnes: ID Employé, Nom, Date, Heure, Direction.'}
              </p>
              <Button
                variant="outline"
                className="min-h-[44px] bg-white border-blue-300 hover:bg-blue-50"
                asChild
              >
                <a
                  href={`/templates/exemple-import-${deviceType}.csv`}
                  download
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger l'exemple CSV
                </a>
              </Button>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Étape 2: Téléchargez votre fichier
              </CardTitle>
              <CardDescription>
                Glissez-déposez ou cliquez pour sélectionner votre fichier d'export
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                  transition-colors min-h-[200px] flex flex-col items-center justify-center
                  ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                  ${selectedFile ? 'bg-muted/50' : ''}
                `}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-4">
                    <div className="rounded-full bg-green-500/10 w-16 h-16 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">{selectedFile.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="min-h-[44px]"
                    >
                      Changer de fichier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-full bg-muted w-16 h-16 flex items-center justify-center mx-auto">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">
                        Glissez-déposez votre fichier ici
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        ou cliquez pour sélectionner
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Formats acceptés: CSV, Excel (.csv, .xlsx, .xls) • Max 10MB
                    </div>
                  </div>
                )}
              </div>

              {/* Upload button */}
              <div className="flex justify-end gap-4">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="min-h-[56px] text-lg"
                  size="lg"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Téléchargement...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ChevronRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Validation (auto-triggered, shows loading) */}
      {currentStep === 'validate' && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <div>
                <div className="font-semibold text-lg">Validation en cours...</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Analyse du fichier et vérification des données
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Employee Mapping */}
      {currentStep === 'mapping' && validationResult && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-blue-500/10 p-3">
                    <FileSpreadsheet className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{validationResult.stats.validRows}</div>
                    <div className="text-sm text-muted-foreground">Lignes valides</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-green-500/10 p-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{validationResult.stats.pairedEntries}</div>
                    <div className="text-sm text-muted-foreground">Paires complètes</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-orange-500/10 p-3">
                    <AlertCircle className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{validationResult.stats.warningRows}</div>
                    <div className="text-sm text-muted-foreground">Avertissements</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-red-500/10 p-3">
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{validationResult.stats.errorRows}</div>
                    <div className="text-sm text-muted-foreground">Erreurs</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Errors and warnings */}
          {validationResult.errors.length > 0 && (
            <Alert variant={validationResult.errors.some(e => e.severity === 'error') ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {validationResult.errors.filter(e => e.severity === 'error').length} erreur(s),{' '}
                {validationResult.errors.filter(e => e.severity === 'warning').length} avertissement(s)
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                  {validationResult.errors.slice(0, 10).map((error, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-medium">Ligne {error.row}:</span> {error.message}
                    </div>
                  ))}
                  {validationResult.errors.length > 10 && (
                    <div className="text-sm text-muted-foreground italic">
                      ... et {validationResult.errors.length - 10} autre(s)
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Unmapped employees warning */}
          {getUnmappedCount() > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <AlertTitle className="text-orange-900 font-semibold">
                {getUnmappedCount()} employé(s) non mappé(s)
              </AlertTitle>
              <AlertDescription className="text-orange-800">
                <p className="mb-2">
                  Les employés non mappés et leurs entrées seront <strong>automatiquement ignorés</strong> lors de l'import.
                </p>
                <div className="space-y-1">
                  <p>
                    ✅ <strong>{validationResult.employeeMappings.length - getUnmappedCount()} employé(s) mappé(s)</strong> → {validationResult.pairedEntries.filter(p => validationResult.employeeMappings.find(m => m.deviceEmployeeId === p.deviceEmployeeId && m.employeeId)).length} entrée(s) seront importées
                  </p>
                  <p>
                    ⚠️ <strong>{getUnmappedCount()} employé(s) non mappé(s)</strong> → {validationResult.pairedEntries.filter(p => !validationResult.employeeMappings.find(m => m.deviceEmployeeId === p.deviceEmployeeId && m.employeeId)).length} entrée(s) seront ignorées
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Employee mapping table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mapping des employés
              </CardTitle>
              <CardDescription>
                {validationResult.employeeMappings.length - getUnmappedCount()} employé(s) mappé(s),{' '}
                {getUnmappedCount()} non mappé(s) (seront ignorés)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Appareil</TableHead>
                      <TableHead>Nom (Appareil)</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Employé système</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResult.employeeMappings.map((mapping) => (
                      <TableRow key={mapping.deviceEmployeeId}>
                        <TableCell className="font-mono text-sm">
                          {mapping.deviceEmployeeId}
                        </TableCell>
                        <TableCell>{mapping.deviceEmployeeName || '—'}</TableCell>
                        <TableCell>
                          {mapping.matchType === 'exact' && (
                            <Badge variant="default">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Exact
                            </Badge>
                          )}
                          {mapping.matchType === 'fuzzy' && (
                            <Badge variant="secondary">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Approximatif
                            </Badge>
                          )}
                          {mapping.matchType === 'unmapped' && (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Non mappé
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping.employeeName ? (
                            <div>
                              <div className="font-medium">{mapping.employeeName}</div>
                              <div className="text-xs text-muted-foreground">
                                #{mapping.employeeNumber}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">À définir manuellement</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setCurrentStep('upload');
                setSelectedFile(null);
                setUploadedFile(null);
                setValidationResult(null);
              }}
              className="min-h-[44px]"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Recommencer
            </Button>
            <Button
              onClick={() => setCurrentStep('options')}
              disabled={validationResult.employeeMappings.length - getUnmappedCount() === 0}
              className="min-h-[56px] text-lg"
              size="lg"
            >
              Continuer
              {getUnmappedCount() > 0 && (
                <span className="ml-2 text-xs opacity-75">
                  ({validationResult.employeeMappings.length - getUnmappedCount()} employé(s))
                </span>
              )}
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Import Options */}
      {currentStep === 'options' && validationResult && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Options d'import</CardTitle>
              <CardDescription>
                Configurez le comportement de l'import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Skip errors option */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="skip-errors"
                  checked={skipErrors}
                  onCheckedChange={(checked) => setSkipErrors(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="skip-errors" className="cursor-pointer font-medium">
                    Ignorer les erreurs et importer seulement les entrées valides
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Si activé, les entrées avec erreurs seront ignorées et les autres seront importées.
                  </p>
                </div>
              </div>

              {/* Auto-approve option */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="auto-approve"
                  checked={autoApprove}
                  onCheckedChange={(checked) => setAutoApprove(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="auto-approve" className="cursor-pointer font-medium">
                    Approuver automatiquement les entrées
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Les entrées seront marquées comme approuvées immédiatement (recommandé pour RH).
                  </p>
                </div>
              </div>

              {/* Summary */}
              <Alert className={getUnmappedCount() > 0 ? 'border-orange-200 bg-orange-50' : ''}>
                <AlertCircle className={getUnmappedCount() > 0 ? 'h-4 w-4 text-orange-600' : 'h-4 w-4'} />
                <AlertTitle className={getUnmappedCount() > 0 ? 'text-orange-900' : ''}>
                  Résumé de l'import
                </AlertTitle>
                <AlertDescription className={getUnmappedCount() > 0 ? 'text-orange-800' : ''}>
                  <div className="mt-2 space-y-1 text-sm">
                    <div>• <strong>{validationResult.employeeMappings.length - getUnmappedCount()}</strong> employé(s) mappé(s) → <strong>{validationResult.pairedEntries.filter(p => employeeMapping[p.deviceEmployeeId]).length}</strong> entrée(s) seront importées</div>
                    {getUnmappedCount() > 0 && (
                      <div className="font-medium">
                        • <strong>{getUnmappedCount()}</strong> employé(s) non mappé(s) → <strong>{validationResult.pairedEntries.filter(p => !employeeMapping[p.deviceEmployeeId]).length}</strong> entrée(s) seront <strong>ignorées</strong>
                      </div>
                    )}
                    <div>• Total: {validationResult.stats.pairedEntries} paire(s) d'entrées</div>
                    <div>• Source: <strong>Biométrique ({validationResult.deviceType})</strong></div>
                    <div>• Statut: <strong>{autoApprove ? 'Approuvé' : 'En attente d\'approbation'}</strong></div>
                    {validationResult.stats.dateRange && (
                      <div>
                        • Période: <strong>
                          {new Date(validationResult.stats.dateRange.start).toLocaleDateString('fr-FR')} au{' '}
                          {new Date(validationResult.stats.dateRange.end).toLocaleDateString('fr-FR')}
                        </strong>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('mapping')}
              className="min-h-[44px]"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Button
              onClick={handleImport}
              disabled={executeMutation.isPending}
              className="min-h-[56px] text-lg"
              size="lg"
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Importer ({validationResult.employeeMappings.length - getUnmappedCount()} employé(s))
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Results */}
      {currentStep === 'results' && importResult && (
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="rounded-full bg-green-500/10 w-20 h-20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <div>
                  <div className="text-3xl font-bold text-green-500">Import réussi !</div>
                  <div className="text-lg text-muted-foreground mt-2">
                    {importResult.imported} entrée(s) importée(s) avec succès
                  </div>
                  {(importResult.unmappedEntries > 0 || importResult.skipped > 0) && (
                    <div className="text-sm mt-2 space-y-1">
                      {importResult.unmappedEntries > 0 && (
                        <div className="text-orange-500">
                          {importResult.unmappedEmployees} employé(s) non mappé(s) ({importResult.unmappedEntries} entrée(s) ignorée(s))
                        </div>
                      )}
                      {importResult.skipped > 0 && (
                        <div className="text-red-500">
                          {importResult.skipped} entrée(s) avec erreurs ignorée(s)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              onClick={() => router.push('/admin/time-tracking')}
              variant="default"
              className="min-h-[56px] text-lg"
              size="lg"
            >
              <Clock className="h-5 w-5 mr-2" />
              {importResult.status === 'pending'
                ? 'Voir les entrées en attente'
                : 'Voir les entrées importées'
              }
            </Button>
            <Button
              onClick={() => {
                setCurrentStep('upload');
                setSelectedFile(null);
                setUploadedFile(null);
                setValidationResult(null);
                setEmployeeMapping({});
                setImportResult(null);
              }}
              variant="outline"
              className="min-h-[56px] text-lg"
              size="lg"
            >
              <Upload className="h-5 w-5 mr-2" />
              Importer un autre fichier
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
