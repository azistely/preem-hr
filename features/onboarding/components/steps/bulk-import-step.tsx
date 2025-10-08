'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { HelpBox } from '../help-box';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

interface BulkImportStepProps {
  onComplete: () => void;
}

interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  data: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    positionTitle: string;
    baseSalary: number;
    hireDate: string;
  }>;
}

export function BulkImportStep({ onComplete }: BulkImportStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const downloadTemplate = api.onboarding.downloadEmployeeTemplate.useMutation();
  const validateImport = api.onboarding.validateEmployeeImport.useMutation();
  const importEmployees = api.onboarding.importEmployees.useMutation();
  const completeStep = api.onboarding.completeStep.useMutation();

  const handleDownloadTemplate = async () => {
    try {
      const result = await downloadTemplate.mutateAsync();

      // Create CSV content
      const csvContent = result.csvContent;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // Download file
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modele_employes.csv';
      link.click();

      URL.revokeObjectURL(url);
      toast.success('Modèle téléchargé avec succès');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du téléchargement');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }

    setFile(selectedFile);
    setPreview(null);
    setIsUploading(true);

    try {
      // Read file content
      const content = await selectedFile.text();

      // Validate via API
      const validationResult = await validateImport.mutateAsync({ csvContent: content });

      setPreview(validationResult);

      if (validationResult.invalidRows > 0) {
        toast.warning(
          `${validationResult.validRows} ligne(s) valide(s), ${validationResult.invalidRows} ligne(s) avec erreurs`
        );
      } else {
        toast.success(`${validationResult.validRows} ligne(s) prête(s) à importer`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la validation');
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    setIsImporting(true);

    try {
      // Read file content
      const content = await file.text();

      // Import employees
      const result = await importEmployees.mutateAsync({ csvContent: content });

      toast.success(`${result.importedCount} employé(s) importé(s) avec succès !`);

      // Complete step
      await completeStep.mutateAsync({ stepId: 'bulk_import' });

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'importation');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <HelpBox>
        Importez vos employés en masse à l'aide d'un fichier CSV. Téléchargez d'abord le modèle, remplissez-le avec vos données, puis importez-le.
      </HelpBox>

      {/* Step 1: Download template */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Étape 1 : Téléchargez le modèle</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Téléchargez notre modèle CSV pré-formaté avec les colonnes requises
            </p>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              disabled={downloadTemplate.isPending}
              className="min-h-[44px]"
            >
              <Download className="mr-2 h-5 w-5" />
              {downloadTemplate.isPending ? 'Téléchargement...' : 'Télécharger le modèle CSV'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Step 2: Fill template */}
      <Card className="p-6 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">✏️</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Étape 2 : Remplissez le fichier</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ouvrez le fichier CSV avec Excel ou Google Sheets et remplissez les informations de vos employés
            </p>
            <div className="bg-white border border-amber-300 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium">Colonnes requises :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Prénom, Nom, Email</li>
                <li>Poste, Salaire mensuel brut</li>
                <li>Date d'embauche (format: JJ/MM/AAAA)</li>
                <li>Téléphone (optionnel)</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Step 3: Upload file */}
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <Upload className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">Étape 3 : Importez le fichier</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sélectionnez le fichier CSV rempli pour vérifier et importer vos employés
            </p>

            <div className="space-y-4">
              {/* File input */}
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[44px]"
                    onClick={() => document.getElementById('csv-upload')?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Vérification...' : 'Sélectionner un fichier CSV'}
                  </Button>
                </label>
                {file && (
                  <span className="text-sm text-muted-foreground">
                    {file.name}
                  </span>
                )}
              </div>

              {/* Preview results */}
              {preview && (
                <div className="bg-white border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Résultat de la validation</h4>
                    {preview.invalidRows === 0 ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{preview.totalRows}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valides</p>
                      <p className="text-2xl font-bold text-green-600">{preview.validRows}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Erreurs</p>
                      <p className="text-2xl font-bold text-destructive">{preview.invalidRows}</p>
                    </div>
                  </div>

                  {/* Show errors */}
                  {preview.errors.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium mb-2 text-destructive">
                        Erreurs détectées :
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {preview.errors.slice(0, 10).map((error, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            Ligne {error.row}: {error.field} - {error.message}
                          </p>
                        ))}
                        {preview.errors.length > 10 && (
                          <p className="text-sm text-muted-foreground italic">
                            ... et {preview.errors.length - 10} autre(s) erreur(s)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Import button */}
      {preview && preview.validRows > 0 && (
        <Button
          onClick={handleImport}
          disabled={isImporting || preview.invalidRows > 0}
          className="w-full min-h-[56px] text-lg"
        >
          {isImporting
            ? 'Importation en cours...'
            : `Importer ${preview.validRows} employé${preview.validRows !== 1 ? 's' : ''}`}
        </Button>
      )}

      {preview && preview.invalidRows > 0 && (
        <HelpBox>
          ⚠️ Veuillez corriger les erreurs dans votre fichier CSV avant d'importer
        </HelpBox>
      )}
    </div>
  );
}
