/**
 * Guided Export Wizard (Path B)
 * Step-by-step guide with screenshots
 * HCI: Visual guides, clear instructions, checkbox progress
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUploadDropzone } from '../shared/file-upload-dropzone';
import { ValidationPreview } from '../shared/validation-preview';
import { ImportProgress } from '../shared/import-progress';

interface GuidedExportWizardProps {
  dataSource: 'excel' | 'sage' | 'manual';
  onComplete: () => void;
  onBack: () => void;
}

type Step = 'guide' | 'upload' | 'validation' | 'importing' | 'complete';

export function GuidedExportWizard({ dataSource, onComplete, onBack }: GuidedExportWizardProps) {
  const [step, setStep] = useState<Step>('guide');
  const [currentGuideStep, setCurrentGuideStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Guide steps based on data source
  const guideSteps = dataSource === 'sage' ? sageGuideSteps : excelGuideSteps;

  const handleStepComplete = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex]);
    }

    if (stepIndex < guideSteps.length - 1) {
      setCurrentGuideStep(stepIndex + 1);
    } else {
      // All steps complete, move to upload
      setStep('upload');
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setStep('validation');

    // TODO: Validate file
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
    setTimeout(() => {
      setStep('complete');
    }, 3000);
  };

  const handleTryAgain = () => {
    setFile(null);
    setValidationResult(null);
    setStep('upload');
  };

  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setStep('guide')}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Retour au guide
        </Button>
        <FileUploadDropzone onFileSelect={handleFileSelect} dataSource={dataSource} />
      </div>
    );
  }

  if (step === 'validation' && validationResult) {
    return (
      <ValidationPreview
        result={validationResult}
        onConfirm={handleStartImport}
        onCancel={handleTryAgain}
      />
    );
  }

  if (step === 'importing') {
    return <ImportProgress total={validationResult?.totalRecords || 0} />;
  }

  if (step === 'complete') {
    return (
      <div className="space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-green-900 mb-2">✅ Import réussi !</h3>
          <p className="text-muted-foreground">
            {validationResult?.validRecords || 0} employés importés avec succès
          </p>
        </div>
        <Button onClick={onComplete} className="min-h-[56px] text-lg bg-green-600 hover:bg-green-700">
          Continuer →
        </Button>
      </div>
    );
  }

  // Guide view
  const currentStep = guideSteps[currentGuideStep];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={onBack}>
        <ChevronLeft className="w-4 h-4 mr-2" />
        Retour
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold">
          📖 Guide: Exporter depuis {dataSource === 'sage' ? 'SAGE' : 'Excel'}
        </h2>
        <p className="text-muted-foreground text-lg">
          Suivez ces étapes simples pour exporter vos données
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2">
        {guideSteps.map((_step, index) => (
          <div
            key={index}
            className={`
              w-3 h-3 rounded-full transition-all
              ${completedSteps.includes(index) ? 'bg-green-500' : index === currentGuideStep ? 'bg-primary w-8' : 'bg-gray-300'}
            `}
          />
        ))}
      </div>

      {/* Current step */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Étape {currentGuideStep + 1}/{guideSteps.length}: {currentStep.title}
            </CardTitle>
            {completedSteps.includes(currentGuideStep) && (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Screenshot placeholder */}
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">📸 Capture d'écran</p>
              <p className="text-xs">{currentStep.screenshotAlt}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            {currentStep.instructions.map((instruction: string, index: number) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {index + 1}
                </div>
                <p className="text-sm text-blue-900">{instruction}</p>
              </div>
            ))}
          </div>

          {/* Completion checkbox */}
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <Checkbox
              id={`step-${currentGuideStep}`}
              checked={completedSteps.includes(currentGuideStep)}
              onCheckedChange={() => handleStepComplete(currentGuideStep)}
              className="w-6 h-6"
            />
            <label
              htmlFor={`step-${currentGuideStep}`}
              className="text-sm font-medium text-green-900 cursor-pointer"
            >
              ✅ J'ai terminé cette étape
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        {currentGuideStep > 0 && (
          <Button
            variant="outline"
            onClick={() => setCurrentGuideStep(currentGuideStep - 1)}
            className="flex-1 min-h-[56px]"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Étape précédente
          </Button>
        )}
        <Button
          onClick={() => handleStepComplete(currentGuideStep)}
          className="flex-1 min-h-[56px] bg-primary"
        >
          {currentGuideStep < guideSteps.length - 1 ? (
            <>
              Étape suivante
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          ) : (
            'Importer le fichier →'
          )}
        </Button>
      </div>
    </div>
  );
}

// Guide steps for SAGE
const sageGuideSteps = [
  {
    title: 'Ouvrez SAGE Paie',
    screenshotAlt: 'Écran principal de SAGE',
    instructions: [
      'Lancez le logiciel SAGE Paie sur votre ordinateur',
      'Connectez-vous avec vos identifiants habituels',
      'Assurez-vous d\'être sur l\'onglet principal',
    ],
  },
  {
    title: 'Accédez au menu Exports',
    screenshotAlt: 'Menu Fichier > Exporter',
    instructions: [
      'Cliquez sur le menu "Fichier" en haut à gauche',
      'Sélectionnez "Exporter" dans le menu déroulant',
      'Puis choisissez "Liste des employés"',
    ],
  },
  {
    title: 'Configurez l\'export',
    screenshotAlt: 'Fenêtre de configuration d\'export',
    instructions: [
      'Dans la fenêtre qui s\'ouvre, cochez "Format CSV" ou "Excel"',
      'Assurez-vous que ces colonnes sont sélectionnées: Matricule, Nom, Prénom, Salaire, Date d\'embauche',
      'Cliquez sur "Exporter" pour générer le fichier',
    ],
  },
  {
    title: 'Sauvegardez le fichier',
    screenshotAlt: 'Dialogue de sauvegarde',
    instructions: [
      'Choisissez un emplacement facile à retrouver (Bureau ou Documents)',
      'Donnez un nom clair au fichier, par exemple "employes-export.csv"',
      'Cliquez sur "Enregistrer"',
    ],
  },
  {
    title: 'Vérifiez le fichier',
    screenshotAlt: 'Fichier exporté',
    instructions: [
      'Ouvrez le fichier avec Excel pour vérifier qu\'il contient vos données',
      'Vérifiez que les colonnes sont bien remplies',
      'Vous êtes prêt à importer dans Preem HR !',
    ],
  },
];

// Guide steps for Excel
const excelGuideSteps = [
  {
    title: 'Téléchargez notre modèle',
    screenshotAlt: 'Modèle Excel Preem HR',
    instructions: [
      'Téléchargez le modèle Excel Preem HR (bouton ci-dessous)',
      'Ouvrez le fichier téléchargé avec Excel ou Google Sheets',
      'Lisez les instructions dans la première ligne',
    ],
  },
  {
    title: 'Ouvrez votre fichier existant',
    screenshotAlt: 'Fichiers Excel côte à côte',
    instructions: [
      'Ouvrez votre fichier Excel existant contenant vos employés',
      'Placez les deux fenêtres côte à côte pour faciliter le copier-coller',
    ],
  },
  {
    title: 'Copiez vos données',
    screenshotAlt: 'Copier-coller de données',
    instructions: [
      'Sélectionnez les données dans votre fichier (prénom, nom, salaire, etc.)',
      'Copiez les données (Ctrl+C ou Cmd+C)',
      'Collez dans le modèle Preem HR en respectant les colonnes',
    ],
  },
  {
    title: 'Vérifiez et enregistrez',
    screenshotAlt: 'Fichier prêt',
    instructions: [
      'Vérifiez que toutes les données sont dans les bonnes colonnes',
      'Supprimez les lignes d\'exemple dans le modèle',
      'Enregistrez le fichier (Fichier > Enregistrer sous)',
    ],
  },
];
