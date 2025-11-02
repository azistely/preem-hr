/**
 * Self-Service Import Path (Path A)
 * For confident users who can import themselves
 * 3 Steps: Download template → Fill → Upload
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Download, Edit3, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { FileUploadDropzone } from '../shared/file-upload-dropzone';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';

interface SelfServiceImportProps {
  dataSource: 'excel' | 'sage' | 'manual';
  onComplete: () => void;
  onBack: () => void;
}

type Step = 'instructions' | 'upload' | 'validation' | 'importing' | 'complete';

type ValidationResult = {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    row: number;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  preview: Array<any>;
  fieldMapping: Record<string, string>;
};

type ImportResult = {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  employees: Array<{
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
  }>;
};

export function SelfServiceImport({ dataSource, onComplete, onBack }: SelfServiceImportProps) {
  const [step, setStep] = useState<Step>('instructions');
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // tRPC mutations
  const uploadFileMutation = trpc.employeeImport.uploadFile.useMutation();
  const validateFileMutation = trpc.employeeImport.validateFile.useMutation();
  const executeImportMutation = trpc.employeeImport.executeImport.useMutation();

  const handleDownloadTemplate = () => {
    window.open('/templates/employee-import-template.xlsx', '_blank');
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('validation');

    try {
      // 1. Convert file to Base64
      const base64Data = await convertFileToBase64(selectedFile);

      // 2. Upload file to Supabase Storage
      const uploadResult = await uploadFileMutation.mutateAsync({
        fileName: selectedFile.name,
        fileData: base64Data,
        fileType: selectedFile.type,
      });

      setFileId(uploadResult.fileId);

      // 3. Validate uploaded file
      const validation = await validateFileMutation.mutateAsync({
        fileId: uploadResult.fileId,
      });

      setValidationResult(validation as ValidationResult);

      // Show success toast
      if (validation.success) {
        toast({
          title: '✅ Validation réussie',
          description: `${validation.validRows} lignes valides trouvées`,
        });
      } else {
        toast({
          title: '⚠️ Erreurs détectées',
          description: `${validation.errors.length} erreur(s) trouvée(s)`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      toast({
        title: '❌ Erreur de validation',
        description: error.message || 'Impossible de valider le fichier',
        variant: 'destructive',
      });
      setStep('upload');
    }
  };

  const handleStartImport = async (skipErrors = false) => {
    if (!fileId) {
      toast({
        title: '❌ Erreur',
        description: 'Fichier non trouvé. Veuillez réessayer.',
        variant: 'destructive',
      });
      return;
    }

    setStep('importing');

    try {
      const result = await executeImportMutation.mutateAsync({
        fileId,
        skipErrors,
      });

      setImportResult(result as ImportResult);
      setStep('complete');

      toast({
        title: '🎉 Import réussi!',
        description: `${result.importedCount} employés importés`,
      });
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: '❌ Erreur d\'import',
        description: error.message || 'Impossible d\'importer les employés',
        variant: 'destructive',
      });
      setStep('validation');
    }
  };

  const handleTryAgain = () => {
    setFile(null);
    setFileId(null);
    setValidationResult(null);
    setStep('upload');
  };

  const isLoading = uploadFileMutation.isPending || validateFileMutation.isPending || executeImportMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-2"
        disabled={isLoading}
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">
          📥 Importez vos employés
        </h2>
        <p className="text-muted-foreground text-lg">
          {dataSource === 'excel' ? 'Import depuis Excel/CSV' : 'Import depuis SAGE/CIEL'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {['instructions', 'upload', 'validation'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step === s || ['validation', 'importing', 'complete'].includes(step) && i <= 2
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-500'}
              `}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div className={`w-12 h-1 ${
                ['validation', 'importing', 'complete'].includes(step) && i < 2 ? 'bg-primary' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      {step === 'instructions' && (
        <div className="space-y-6">
          {/* Step 1: Download template */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Étape 1/3: Téléchargez notre modèle</CardTitle>
                  <CardDescription>Fichier Excel pré-formaté avec instructions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 mb-3 font-medium">
                  📄 Le modèle contient:
                </p>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>46 colonnes couvrant tous les champs du registre du personnel + salaires</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>3 exemples complets pour vous guider</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Instructions de format dans chaque colonne</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleDownloadTemplate}
                className="w-full min-h-[56px] text-lg"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Télécharger le modèle Excel
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Fill template */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Étape 2/3: Remplissez le fichier</CardTitle>
                  <CardDescription>Ajoutez vos employés ligne par ligne</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900 mb-3 font-medium">
                  ✏️ Champs obligatoires (13 minimum):
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm text-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Matricule</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Prénom, Nom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Contact</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Date d'embauche</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Nature du contrat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Fonction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Situation Familiale</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Nombre d'enfants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Catégorie</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>N° CNPS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Salaire Catégoriel</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Indemnité de transport</span>
                  </div>
                  <div className="text-muted-foreground text-xs italic col-span-2 mt-2">
                    Les autres champs sont optionnels mais recommandés pour le registre du personnel
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Upload */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle>Étape 3/3: Importez le fichier</CardTitle>
                  <CardDescription>Nous validerons vos données avant l'import</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* CTA */}
          <Button
            onClick={() => setStep('upload')}
            className="w-full min-h-[56px] text-lg bg-green-600 hover:bg-green-700"
          >
            J'ai rempli le fichier →
          </Button>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-4">
          <FileUploadDropzone onFileSelect={handleFileSelect} dataSource={dataSource} />
          {isLoading && (
            <div className="flex items-center justify-center gap-3 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-900 font-medium">
                {uploadFileMutation.isPending && 'Téléchargement du fichier...'}
                {validateFileMutation.isPending && 'Validation en cours...'}
              </span>
            </div>
          )}
        </div>
      )}

      {step === 'validation' && validationResult && (
        <div className="space-y-6">
          {/* Validation summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {validationResult.success ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    Validation réussie
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                    Erreurs détectées
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold">{validationResult.totalRows}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{validationResult.validRows}</div>
                  <div className="text-sm text-muted-foreground">Valides</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-600">{validationResult.invalidRows}</div>
                  <div className="text-sm text-muted-foreground">Erreurs</div>
                </div>
              </div>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-red-900">
                    ❌ Erreurs à corriger ({validationResult.errors.length})
                  </h3>
                  <div className="text-xs text-red-700 mb-2">
                    📝 Corrigez toutes les erreurs ci-dessous dans votre fichier Excel, puis ré-importez.
                  </div>
                  <div className="space-y-1 max-h-96 overflow-y-auto border border-red-200 rounded-lg p-3 bg-red-50/50">
                    {validationResult.errors.map((error, i) => (
                      <div key={i} className="text-sm p-2 bg-white border border-red-200 rounded shadow-sm">
                        <span className="font-bold text-red-900">Ligne {error.row}:</span>{' '}
                        {error.field && <span className="text-red-700 font-medium">[{error.field}]</span>}{' '}
                        {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-orange-900">
                    ⚠️ Avertissements ({validationResult.warnings.length})
                  </h3>
                  <div className="text-xs text-orange-700 mb-2">
                    💡 Ces champs sont optionnels mais recommandés pour le registre du personnel.
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto border border-orange-200 rounded-lg p-3 bg-orange-50/30">
                    {validationResult.warnings.map((warning, i) => (
                      <div key={i} className="text-sm p-2 bg-white border border-orange-200 rounded">
                        <span className="font-medium text-orange-900">Ligne {warning.row}:</span>{' '}
                        {warning.field && <span className="text-orange-700">[{warning.field}]</span>}{' '}
                        {warning.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleTryAgain}
                  className="flex-1"
                  disabled={isLoading}
                >
                  Choisir un autre fichier
                </Button>
                {validationResult.validRows > 0 && (
                  <Button
                    onClick={() => handleStartImport(validationResult.invalidRows > 0)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={isLoading}
                  >
                    {validationResult.invalidRows > 0
                      ? `Importer ${validationResult.validRows} lignes valides`
                      : `Importer ${validationResult.validRows} lignes`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'importing' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Import en cours...</h3>
                <p className="text-muted-foreground">
                  Création de {validationResult?.validRows || 0} employés
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'complete' && importResult && (
        <div className="space-y-6">
          {/* Success message */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">
                ✅ Import réussi !
              </h3>
              <p className="text-muted-foreground">
                {importResult.importedCount} employés importés avec succès
              </p>
              {importResult.skippedCount > 0 && (
                <p className="text-sm text-orange-600 mt-1">
                  {importResult.skippedCount} lignes ignorées (erreurs)
                </p>
              )}
            </div>
          </div>

          {/* Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {importResult.importedCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Importés</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-orange-600">
                    {importResult.skippedCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Ignorés</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Button
            onClick={onComplete}
            className="w-full min-h-[56px] text-lg bg-green-600 hover:bg-green-700"
          >
            Continuer →
          </Button>
        </div>
      )}
    </div>
  );
}
