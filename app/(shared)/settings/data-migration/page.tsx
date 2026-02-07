/**
 * SAGE Data Migration Page
 *
 * 4-Step wizard for importing employee and payroll data from SAGE:
 * 1. Upload File - CSV/Excel with drag-and-drop
 * 2. Configure Field Mapping - Map SAGE fields to Preem fields
 * 3. Validate Data - Review errors/warnings
 * 4. Import - Execute with progress tracking
 *
 * HCI Principles Applied:
 * - Zero learning curve: Wizard with clear steps
 * - Task-oriented: "Importer des employés" not "Upload file"
 * - Error prevention: Validate before import
 * - Progressive disclosure: Show complexity only when needed
 * - Immediate feedback: Real-time validation, progress bars
 * - Graceful degradation: Works on mobile, slow networks
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Table as TableIcon,
  Users,
  Calendar,
  Info,
  FileSpreadsheet,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

type MigrationType = 'sage_employees' | 'sage_payroll';
type WizardStep = 'upload' | 'mapping' | 'validate' | 'import';

interface FieldMapping {
  sageField: string;
  preemField: string;
  transformation?: 'uppercase' | 'lowercase' | 'trim' | 'date_parse';
  defaultValue?: string | number;
}

interface StagingRecord {
  id: string;
  rowNumber: number;
  employeeNumber: string;
  firstName?: string;
  lastName?: string;
  validationStatus: 'pending' | 'valid' | 'invalid' | 'warning';
  validationErrors: string[];
  validationWarnings: string[];
}

// ============================================================================
// Smart Defaults (HCI Principle: Smart Defaults)
// ============================================================================

const EMPLOYEE_FIELD_MAPPINGS: { sage: string; preem: string; required: boolean }[] = [
  { sage: 'MATRICULE', preem: 'employee_number', required: true },
  { sage: 'PRENOM', preem: 'first_name', required: true },
  { sage: 'NOM', preem: 'last_name', required: true },
  { sage: 'SALAIRE', preem: 'base_salary', required: true },
  { sage: 'CATEGORIE', preem: 'category_code', required: false },
  { sage: 'DATE_EMBAUCHE', preem: 'hire_date', required: false },
  { sage: 'DEPARTEMENT', preem: 'department', required: false },
  { sage: 'FONCTION', preem: 'position_title', required: false },
  { sage: 'EMAIL', preem: 'email', required: false },
  { sage: 'TELEPHONE', preem: 'phone', required: false },
];

const PAYROLL_FIELD_MAPPINGS: { sage: string; preem: string; required: boolean }[] = [
  { sage: 'MATRICULE', preem: 'employee_number', required: true },
  { sage: 'PERIODE', preem: 'payroll_period', required: true },
  { sage: 'BRUT', preem: 'gross_salary', required: true },
  { sage: 'NET', preem: 'net_salary', required: true },
  { sage: 'CNPS_SALARIE', preem: 'cnps_employee', required: false },
  { sage: 'CNPS_PATRON', preem: 'cnps_employer', required: false },
  { sage: 'ITS', preem: 'its', required: false },
];

const PREEM_FIELD_OPTIONS = [
  { value: 'employee_number', label: 'Matricule employé' },
  { value: 'first_name', label: 'Prénom' },
  { value: 'last_name', label: 'Nom' },
  { value: 'base_salary', label: 'Salaire de base' },
  { value: 'category_code', label: 'Catégorie professionnelle' },
  { value: 'hire_date', label: 'Date d\'embauche' },
  { value: 'department', label: 'Département' },
  { value: 'position_title', label: 'Poste' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'gross_salary', label: 'Salaire brut' },
  { value: 'net_salary', label: 'Salaire net' },
  { value: 'cnps_employee', label: 'CNPS employé' },
  { value: 'cnps_employer', label: 'CNPS employeur' },
  { value: 'its', label: 'ITS' },
  { value: 'payroll_period', label: 'Période (YYYY-MM)' },
  { value: '_ignore', label: '— Ignorer ce champ —' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function DataMigrationPage() {
  // State management
  const [step, setStep] = useState<WizardStep>('upload');
  const [migrationType, setMigrationType] = useState<MigrationType>('sage_employees');
  const [file, setFile] = useState<File | null>(null);
  const [sageFields, setSageFields] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [encoding, setEncoding] = useState<string>('ISO-8859-1');
  const [delimiter, setDelimiter] = useState<string>(';');
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC hooks
  const importEmployeesMutation = trpc.dataMigration.importEmployees.useMutation();
  const importPayrollMutation = trpc.dataMigration.importHistoricalPayroll.useMutation();

  const { data: migrationData, refetch: refetchMigration } = trpc.dataMigration.getMigration.useQuery(
    { migrationId: migrationId! },
    { enabled: !!migrationId, refetchInterval: 2000 } // Poll every 2s during import
  );

  const { data: stagingData, refetch: refetchStaging } = trpc.dataMigration.getStagingRecords.useQuery(
    { migrationId: migrationId!, limit: 100 },
    { enabled: !!migrationId && step === 'validate' }
  );

  // Handle file selection
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    const maxSize = migrationType === 'sage_employees' ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(`Fichier trop volumineux. Taille max: ${migrationType === 'sage_employees' ? '10' : '20'} MB`);
      return;
    }

    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExtension = validExtensions.some(ext =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExtension) {
      toast.error('Format invalide. Utilisez CSV ou Excel (.xlsx, .xls)');
      return;
    }

    setFile(selectedFile);

    // Parse CSV headers (simplified - in production, use proper CSV parser)
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const firstLine = text.split('\n')[0];
      const headers = firstLine.split(delimiter).map(h => h.trim().replace(/["\r]/g, ''));
      setSageFields(headers);

      // Auto-map fields based on smart defaults
      autoMapFields(headers);
    };
    reader.readAsText(selectedFile, encoding);

    toast.success(`Fichier chargé: ${selectedFile.name}`);
  }, [delimiter, encoding, migrationType]);

  // Auto-map fields based on SAGE field names
  const autoMapFields = (headers: string[]) => {
    const defaultMappings = migrationType === 'sage_employees'
      ? EMPLOYEE_FIELD_MAPPINGS
      : PAYROLL_FIELD_MAPPINGS;

    const mappings: FieldMapping[] = headers.map(sageField => {
      // Find matching default mapping (case-insensitive)
      const defaultMapping = defaultMappings.find(
        m => m.sage.toLowerCase() === sageField.toLowerCase()
      );

      return {
        sageField,
        preemField: defaultMapping?.preem || '_ignore',
      };
    });

    setFieldMappings(mappings);
  };

  // Handle field mapping change
  const handleMappingChange = (sageField: string, preemField: string) => {
    setFieldMappings(prev =>
      prev.map(m =>
        m.sageField === sageField ? { ...m, preemField } : m
      )
    );
  };

  // Execute import
  const handleImport = async () => {
    if (!file) {
      toast.error('Aucun fichier sélectionné');
      return;
    }

    try {
      setStep('import');

      const config = {
        employeeFields: migrationType === 'sage_employees' ? fieldMappings : [],
        payrollFields: migrationType === 'sage_payroll' ? fieldMappings : [],
        dateFormat: 'DD/MM/YYYY',
        encoding,
        delimiter,
      };

      let result;
      if (migrationType === 'sage_employees') {
        result = await importEmployeesMutation.mutateAsync({
          file,
          mapping: config,
        });
      } else {
        result = await importPayrollMutation.mutateAsync({
          file,
          mapping: config,
        });
      }

      setMigrationId(result.migrationId);
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'import');
      setStep('validate'); // Go back to validation step
    }
  };

  // Validation: Check if we can proceed to next step
  const canProceedFromUpload = file !== null && sageFields.length > 0;
  const canProceedFromMapping = fieldMappings.some(m => m.preemField !== '_ignore');
  const canProceedFromValidation = stagingData && stagingData.records.every(
    r => r.validationStatus !== 'invalid'
  );

  // Get validation stats
  const validationStats = stagingData?.records.reduce(
    (acc, r) => {
      acc.total++;
      if (r.validationStatus === 'valid') acc.valid++;
      if (r.validationStatus === 'invalid') acc.invalid++;
      if (r.validationStatus === 'warning') acc.warning++;
      return acc;
    },
    { total: 0, valid: 0, invalid: 0, warning: 0 }
  ) || { total: 0, valid: 0, invalid: 0, warning: 0 };

  // Calculate progress percentage
  const progressPercentage = migrationData
    ? Math.round(
        ((migrationData.importedRecords + migrationData.failedRecords) /
          migrationData.totalRecords) *
          100
      )
    : 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Importer des données SAGE</h1>
        <p className="text-muted-foreground">
          Importez vos employés et historique de paie depuis vos exports SAGE
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[
          { key: 'upload', label: 'Fichier', icon: Upload },
          { key: 'mapping', label: 'Correspondance', icon: TableIcon },
          { key: 'validate', label: 'Validation', icon: CheckCircle2 },
          { key: 'import', label: 'Import', icon: Download },
        ].map((s, index) => {
          const Icon = s.icon;
          const isActive = step === s.key;
          const isCompleted =
            (s.key === 'upload' && ['mapping', 'validate', 'import'].includes(step)) ||
            (s.key === 'mapping' && ['validate', 'import'].includes(step)) ||
            (s.key === 'validate' && step === 'import');

          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`h-12 w-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="ml-2 hidden md:block">
                <p className={`text-sm font-medium ${isActive ? 'text-primary' : ''}`}>
                  {s.label}
                </p>
              </div>
              {index < 3 && (
                <div
                  className={`h-1 w-12 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload File */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Migration Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Type d'import
              </CardTitle>
              <CardDescription>
                Que souhaitez-vous importer depuis SAGE?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setMigrationType('sage_employees')}
                  className={`p-6 border-2 rounded-lg text-left transition-all min-h-[44px] ${
                    migrationType === 'sage_employees'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Users className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">Liste des employés</h3>
                      <p className="text-sm text-muted-foreground">
                        Import des informations de base des employés (nom, matricule, salaire, etc.)
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMigrationType('sage_payroll')}
                  className={`p-6 border-2 rounded-lg text-left transition-all min-h-[44px] ${
                    migrationType === 'sage_payroll'
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Calendar className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold mb-1">Historique de paie</h3>
                      <p className="text-sm text-muted-foreground">
                        Import des bulletins de salaire passés (utile pour les analyses)
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Charger le fichier
              </CardTitle>
              <CardDescription>
                Format: CSV, Excel (.xlsx, .xls) - Max {migrationType === 'sage_employees' ? '10' : '20'} MB
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div
                onClick={() => !file && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors min-h-[200px] flex flex-col items-center justify-center ${
                  file ? 'border-green-500 bg-green-50' : 'border-muted hover:border-primary/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className={`h-12 w-12 mb-4 ${file ? 'text-green-600' : 'text-muted-foreground'}`} />
                {file ? (
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-green-600 flex items-center gap-2 justify-center">
                      <CheckCircle2 className="h-5 w-5" />
                      {file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setSageFields([]);
                        setFieldMappings([]);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Changer de fichier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-lg font-medium">
                      Cliquez pour sélectionner un fichier
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CSV ou Excel (.xlsx, .xls)
                    </p>
                  </div>
                )}
              </div>

              {/* Advanced Options (Progressive Disclosure) */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full min-h-[44px]">
                    {showAdvanced ? (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-2" />
                    )}
                    Options avancées
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="encoding">Encodage du fichier</Label>
                      <Select value={encoding} onValueChange={setEncoding}>
                        <SelectTrigger id="encoding" className="min-h-[48px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ISO-8859-1">ISO-8859-1 (SAGE par défaut)</SelectItem>
                          <SelectItem value="UTF-8">UTF-8</SelectItem>
                          <SelectItem value="Windows-1252">Windows-1252</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="delimiter">Séparateur</Label>
                      <Select value={delimiter} onValueChange={setDelimiter}>
                        <SelectTrigger id="delimiter" className="min-h-[48px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=";">Point-virgule (;)</SelectItem>
                          <SelectItem value=",">Virgule (,)</SelectItem>
                          <SelectItem value="\t">Tabulation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      SAGE utilise généralement l'encodage ISO-8859-1 et le point-virgule comme séparateur.
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              {/* Help Text */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Comment exporter depuis SAGE?</AlertTitle>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Ouvrez SAGE Paie & RH</li>
                    <li>Allez dans Fichier → Exporter → {migrationType === 'sage_employees' ? 'Liste des salariés' : 'Bulletins de salaire'}</li>
                    <li>Sélectionnez le format CSV</li>
                    <li>Enregistrez le fichier et chargez-le ici</li>
                  </ol>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-end">
            <Button
              onClick={() => setStep('mapping')}
              disabled={!canProceedFromUpload}
              className="min-h-[56px] min-w-[180px]"
            >
              Suivant
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Field Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Correspondance des champs
            </CardTitle>
            <CardDescription>
              Indiquez à quel champ Jamana correspond chaque colonne SAGE
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mapping Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Champ SAGE</TableHead>
                    <TableHead className="w-[50%]">Champ Jamana</TableHead>
                    <TableHead className="w-[10%]">Requis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldMappings.map((mapping, index) => {
                    const isRequired =
                      (migrationType === 'sage_employees' ? EMPLOYEE_FIELD_MAPPINGS : PAYROLL_FIELD_MAPPINGS)
                        .find(m => m.preem === mapping.preemField)?.required;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {mapping.sageField}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.preemField}
                            onValueChange={(value) =>
                              handleMappingChange(mapping.sageField, value)
                            }
                          >
                            <SelectTrigger className="min-h-[44px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PREEM_FIELD_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {isRequired && (
                            <Badge variant="destructive" className="text-xs">
                              Obligatoire
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Validation Warning */}
            {!canProceedFromMapping && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Vous devez mapper au moins un champ pour continuer
                </AlertDescription>
              </Alert>
            )}

            {/* Navigation */}
            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
                className="min-h-[48px]"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Retour
              </Button>
              <Button
                onClick={() => setStep('validate')}
                disabled={!canProceedFromMapping}
                className="min-h-[56px] min-w-[180px]"
              >
                Valider les données
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Validation */}
      {step === 'validate' && (
        <div className="space-y-6">
          {/* Validation Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Résultats de validation
              </CardTitle>
              <CardDescription>
                Vérifiez les données avant l'import final
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total</p>
                  <p className="text-2xl font-bold">{validationStats.total}</p>
                </div>
                <div className="p-4 border rounded-lg bg-green-50">
                  <p className="text-sm text-muted-foreground mb-1">Valides</p>
                  <p className="text-2xl font-bold text-green-600">
                    {validationStats.valid}
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-yellow-50">
                  <p className="text-sm text-muted-foreground mb-1">Avertissements</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {validationStats.warning}
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-red-50">
                  <p className="text-sm text-muted-foreground mb-1">Erreurs</p>
                  <p className="text-2xl font-bold text-red-600">
                    {validationStats.invalid}
                  </p>
                </div>
              </div>

              {/* Validation Messages */}
              {validationStats.invalid > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erreurs détectées</AlertTitle>
                  <AlertDescription>
                    {validationStats.invalid} enregistrement(s) contiennent des erreurs.
                    Vous devez corriger ces erreurs avant de pouvoir importer.
                  </AlertDescription>
                </Alert>
              )}

              {validationStats.warning > 0 && validationStats.invalid === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Avertissements</AlertTitle>
                  <AlertDescription>
                    {validationStats.warning} enregistrement(s) contiennent des avertissements.
                    Vous pouvez continuer, mais vérifiez ces données.
                  </AlertDescription>
                </Alert>
              )}

              {validationStats.invalid === 0 && validationStats.warning === 0 && (
                <Alert className="border-green-500 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Tout est prêt!</AlertTitle>
                  <AlertDescription>
                    Tous les enregistrements sont valides. Vous pouvez procéder à l'import.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Preview Table (First 10 records) */}
          {stagingData && stagingData.records.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Aperçu des données
                </CardTitle>
                <CardDescription>
                  Premiers enregistrements (max 10)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ligne</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Messages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stagingData.records.slice(0, 10).map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.rowNumber}</TableCell>
                          <TableCell className="font-mono">
                            {record.employeeNumber}
                          </TableCell>
                          <TableCell>{record.lastName || '-'}</TableCell>
                          <TableCell>{record.firstName || '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.validationStatus === 'valid'
                                  ? 'default'
                                  : record.validationStatus === 'warning'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                            >
                              {record.validationStatus === 'valid' && 'Valide'}
                              {record.validationStatus === 'warning' && 'Avertissement'}
                              {record.validationStatus === 'invalid' && 'Erreur'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {Array.isArray(record.validationErrors) && record.validationErrors.length > 0 && (
                              <div className="text-xs text-red-600">
                                {record.validationErrors.join(', ')}
                              </div>
                            )}
                            {Array.isArray(record.validationWarnings) && record.validationWarnings.length > 0 && (
                              <div className="text-xs text-yellow-600">
                                {record.validationWarnings.join(', ')}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setStep('mapping')}
              className="min-h-[48px]"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Retour
            </Button>
            <Button
              onClick={handleImport}
              disabled={!canProceedFromValidation || importEmployeesMutation.isPending || importPayrollMutation.isPending}
              className="min-h-[56px] min-w-[180px] bg-green-600 hover:bg-green-700"
            >
              {importEmployeesMutation.isPending || importPayrollMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Lancer l'import
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Import Progress */}
      {step === 'import' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import en cours
            </CardTitle>
            <CardDescription>
              Veuillez patienter pendant l'import des données...
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-semibold">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </div>

            {/* Stats */}
            {migrationData && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Total</p>
                  <p className="text-2xl font-bold">{migrationData.totalRecords}</p>
                </div>
                <div className="p-4 border rounded-lg bg-green-50">
                  <p className="text-sm text-muted-foreground mb-1">Importés</p>
                  <p className="text-2xl font-bold text-green-600">
                    {migrationData.importedRecords}
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-red-50">
                  <p className="text-sm text-muted-foreground mb-1">Échecs</p>
                  <p className="text-2xl font-bold text-red-600">
                    {migrationData.failedRecords}
                  </p>
                </div>
              </div>
            )}

            {/* Status */}
            {migrationData?.migrationStatus === 'completed' && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-600">Import terminé!</AlertTitle>
                <AlertDescription>
                  {migrationData.importedRecords} enregistrement(s) importé(s) avec succès.
                  {migrationData.failedRecords > 0 && (
                    <span className="block mt-2 text-red-600">
                      {migrationData.failedRecords} enregistrement(s) ont échoué.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {migrationData?.migrationStatus === 'failed' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import échoué</AlertTitle>
                <AlertDescription>
                  Une erreur est survenue pendant l'import. Veuillez réessayer.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            {migrationData?.migrationStatus === 'completed' && (
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setStep('upload');
                    setFile(null);
                    setSageFields([]);
                    setFieldMappings([]);
                    setMigrationId(null);
                  }}
                  className="min-h-[56px]"
                >
                  <Upload className="mr-2 h-5 w-5" />
                  Nouvel import
                </Button>
                {migrationType === 'sage_employees' && (
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/employees'}
                    className="min-h-[56px]"
                  >
                    <Users className="mr-2 h-5 w-5" />
                    Voir les employés
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
