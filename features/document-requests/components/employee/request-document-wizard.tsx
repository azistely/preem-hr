'use client';

/**
 * Employee Document Request Wizard
 *
 * HCI Principles Applied:
 * - Zero Learning Curve: 3-step wizard with clear visual progress
 * - Task-Oriented Design: "Demander un document" not technical jargon
 * - Progressive Disclosure: One question at a time
 * - Smart Defaults: Pre-select most common document type
 * - Immediate Feedback: Real-time validation with French messages
 * - Error Prevention: Disable submit until all validations pass
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc as api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Info,
  AlertCircle,
  FileText,
  Briefcase,
  DollarSign,
  Calculator,
  Building,
  Landmark,
  FileSignature,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequestDocumentWizardProps {
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  requestOnBehalfOf?: boolean;
}

type WizardStep = 'type' | 'confirm' | 'review';

type DocumentType =
  | 'attestation_travail'
  | 'attestation_emploi'
  | 'attestation_salaire'
  | 'declaration_fiscale'
  | 'attestation_cnps'
  | 'domiciliation_bancaire'
  | 'copie_contrat';

const documentTypes: {
  value: DocumentType;
  label: string;
  description: string;
  icon: typeof FileText;
}[] = [
  {
    value: 'attestation_travail',
    label: 'Attestation de travail',
    description: "Certificat attestant que vous êtes employé par l'entreprise",
    icon: FileText,
  },
  {
    value: 'attestation_emploi',
    label: "Attestation d'emploi",
    description: "Confirmation de votre statut d'employé et de votre poste",
    icon: Briefcase,
  },
  {
    value: 'attestation_salaire',
    label: 'Attestation de salaire',
    description: 'Document indiquant votre salaire actuel',
    icon: DollarSign,
  },
  {
    value: 'declaration_fiscale',
    label: 'Déclaration fiscale',
    description: "Relevé annuel pour déclaration d'impôts",
    icon: Calculator,
  },
  {
    value: 'attestation_cnps',
    label: 'Attestation CNPS',
    description: 'Attestation de cotisations sociales CNPS',
    icon: Building,
  },
  {
    value: 'domiciliation_bancaire',
    label: 'Domiciliation bancaire',
    description: 'Lettre pour ouverture de compte ou crédit bancaire',
    icon: Landmark,
  },
  {
    value: 'copie_contrat',
    label: 'Copie du contrat',
    description: 'Copie de votre contrat de travail',
    icon: FileSignature,
  },
];

export function RequestDocumentWizard({
  employeeId,
  employeeName,
  onSuccess,
  onCancel,
  requestOnBehalfOf = false,
}: RequestDocumentWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');

  // Get tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Form state
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [requestNotes, setRequestNotes] = useState('');

  // Create request mutation
  const createRequest = api.documentRequests.create.useMutation({
    onSuccess: () => {
      // Invalidate document requests queries
      utils.documentRequests.list.invalidate();
      utils.documentRequests.getMyRequests.invalidate();
      utils.documentRequests.getPendingCount.invalidate();

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/employee/document-requests');
      }
    },
  });

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 'type') setCurrentStep('confirm');
    else if (currentStep === 'confirm') setCurrentStep('review');
  };

  const handleBack = () => {
    if (currentStep === 'review') setCurrentStep('confirm');
    else if (currentStep === 'confirm') setCurrentStep('type');
  };

  const handleSubmit = async () => {
    if (!selectedType) return;

    try {
      await createRequest.mutateAsync({
        employeeId,
        documentType: selectedType,
        requestNotes: requestNotes || undefined,
        requestedOnBehalfOf: requestOnBehalfOf,
      });
    } catch (error) {
      // Error is handled by mutation
    }
  };

  // Validation states
  const canProceedFromType = selectedType !== null;
  const canSubmit = selectedType !== null && !createRequest.isPending;

  // Step progress
  const steps = ['type', 'confirm', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  const selectedDocType = documentTypes.find((t) => t.value === selectedType);

  return (
    <Card className="w-full max-w-2xl">
      {/* Progress bar */}
      <div className="h-2 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <CardHeader>
        <CardTitle>Demande de document</CardTitle>
        <CardDescription>
          {requestOnBehalfOf
            ? `Demande pour ${employeeName} - Étape ${currentStepIndex + 1} sur ${steps.length}`
            : `Étape ${currentStepIndex + 1} sur ${steps.length}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Select Document Type */}
        {currentStep === 'type' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Quel document souhaitez-vous?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sélectionnez le type de document dont vous avez besoin
              </p>
            </div>

            <div className="grid gap-3">
              {documentTypes.map((docType) => {
                const Icon = docType.icon;
                const isSelected = selectedType === docType.value;

                return (
                  <button
                    key={docType.value}
                    type="button"
                    onClick={() => setSelectedType(docType.value)}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all min-h-[72px]',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{docType.label}</div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {docType.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Confirm Information */}
        {currentStep === 'confirm' && selectedDocType && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Informations complémentaires</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ajoutez des notes si nécessaire (optionnel)
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <selectedDocType.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{selectedDocType.label}</div>
                  <p className="text-sm text-muted-foreground">
                    {selectedDocType.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Demandeur:</div>
              <div className="font-medium">{employeeName}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base">
                Notes additionnelles (optionnel)
              </Label>
              <Textarea
                id="notes"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Ex: J'en ai besoin pour une demande de prêt bancaire..."
                className="min-h-[100px] text-base"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {requestNotes.length}/500 caractères
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 'review' && selectedDocType && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Vérifiez votre demande</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Assurez-vous que toutes les informations sont correctes avant de soumettre
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Type de document:</div>
                <div className="flex items-center gap-2">
                  <selectedDocType.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium">{selectedDocType.label}</span>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Demandeur:</div>
                <div className="font-medium">{employeeName}</div>
              </div>

              {requestNotes && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Notes:</div>
                  <p className="text-base">{requestNotes}</p>
                </div>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Votre demande sera envoyée aux Ressources Humaines. Vous recevrez une
                notification lorsque votre document sera prêt.
              </AlertDescription>
            </Alert>

            {createRequest.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {createRequest.error?.message ?? 'Erreur lors de la création de la demande'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        {currentStep !== 'type' ? (
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={createRequest.isPending}
            className="min-h-[48px]"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={createRequest.isPending}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
        )}

        {currentStep !== 'review' ? (
          <Button
            onClick={handleNext}
            disabled={currentStep === 'type' && !canProceedFromType}
            className="min-h-[48px] ml-auto"
          >
            Suivant
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[48px] ml-auto"
          >
            {createRequest.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Soumettre la demande
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
