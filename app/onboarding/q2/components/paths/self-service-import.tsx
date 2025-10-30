/**
 * Self-Service Import Path (Path A)
 * For confident users who can import themselves
 * 3 Steps: Download template → Fill → Upload
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Download, Edit3, Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { FileUploadDropzone } from '../shared/file-upload-dropzone';
import { ValidationPreview } from '../shared/validation-preview';
import { ImportProgress } from '../shared/import-progress';

interface SelfServiceImportProps {
  dataSource: 'excel' | 'sage' | 'manual';
  onComplete: () => void;
  onBack: () => void;
}

type Step = 'instructions' | 'upload' | 'validation' | 'importing' | 'complete';

export function SelfServiceImport({ dataSource, onComplete, onBack }: SelfServiceImportProps) {
  const [step, setStep] = useState<Step>('instructions');
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [migrationId, setMigrationId] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    // TODO: Download Excel template
    window.open('/templates/employee-import-template.xlsx', '_blank');
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('validation');

    // TODO: Validate file
    // Simulate validation for now
    setTimeout(() => {
      setValidationResult({
        totalRecords: 15,
        validRecords: 13,
        warnings: 2,
        errors: 0,
        details: [
          { row: 5, type: 'warning', message: 'Salaire (50,000) inférieur au SMIG (75,000)' },
          { row: 12, type: 'warning', message: 'Email manquant - Un email temporaire sera créé' },
        ],
      });
    }, 1500);
  };

  const handleStartImport = () => {
    setStep('importing');

    // TODO: Start import process
    setTimeout(() => {
      setMigrationId('test-migration-id');
      setStep('complete');
    }, 3000);
  };

  const handleTryAgain = () => {
    setFile(null);
    setValidationResult(null);
    setStep('upload');
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-2"
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
                    <span>Colonnes pré-formatées selon vos besoins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Exemples de données pour vous guider</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Instructions intégrées dans chaque colonne</span>
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
                  ✏️ Informations requises:
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm text-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Prénom, Nom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Téléphone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Poste</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Salaire de base</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>Date d'embauche</span>
                  </div>
                  <div className="text-muted-foreground text-xs italic col-span-2 mt-2">
                    Email, CNI, Compte bancaire sont optionnels
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
        </div>
      )}

      {step === 'validation' && validationResult && (
        <div className="space-y-4">
          <ValidationPreview
            result={validationResult}
            onConfirm={handleStartImport}
            onCancel={handleTryAgain}
          />
        </div>
      )}

      {step === 'importing' && (
        <div className="space-y-4">
          <ImportProgress total={validationResult?.totalRecords || 0} />
        </div>
      )}

      {step === 'complete' && (
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
                {validationResult?.validRecords || 0} employés importés avec succès
              </p>
            </div>
          </div>

          {/* Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-green-600">
                    {validationResult?.validRecords || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Importés</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-orange-600">
                    {validationResult?.warnings || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Avertissements</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-red-600">
                    {validationResult?.errors || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Erreurs</div>
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
