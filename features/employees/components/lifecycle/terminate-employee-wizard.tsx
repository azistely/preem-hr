/**
 * Comprehensive Employee Termination Wizard
 *
 * 5-step wizard for complete STC (Solde de Tout Compte) calculation and document generation:
 * 1. Select departure type and employee
 * 2. Configure termination details (date, notice period, specific parameters)
 * 3. Preview STC calculation with complete breakdown
 * 4. Generate termination documents (work certificate, final payslip, CNPS attestation)
 * 5. Confirmation and completion
 *
 * Supports all 7 departure types per Convention Collective:
 * - FIN_CDD: End of fixed-term contract
 * - DEMISSION_CDI: Resignation from permanent contract
 * - DEMISSION_CDD: Resignation from fixed-term contract
 * - LICENCIEMENT: Dismissal by employer
 * - RUPTURE_CONVENTIONNELLE: Mutual agreement termination
 * - RETRAITE: Retirement
 * - DECES: Death of employee
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// Step components
import { DepartureTypeStep } from './wizard-steps/departure-type-step';
import { ConfigurationStep } from './wizard-steps/configuration-step';
import { STCPreviewStep } from './wizard-steps/stc-preview-step';
import { DocumentGenerationStep } from './wizard-steps/document-generation-step';
import { ConfirmationStep } from './wizard-steps/confirmation-step';

// Types
export type DepartureType =
  | 'FIN_CDD'
  | 'DEMISSION_CDI'
  | 'DEMISSION_CDD'
  | 'LICENCIEMENT'
  | 'RUPTURE_CONVENTIONNELLE'
  | 'RETRAITE'
  | 'DECES';

export type NoticePeriodStatus = 'worked' | 'paid_by_employer' | 'paid_by_employee' | 'waived';
export type LicenciementType = 'economique' | 'faute_simple' | 'faute_grave' | 'faute_lourde' | 'inaptitude';

// Wizard data schema
const wizardSchema = z.object({
  // Step 1: Departure type
  departureType: z.enum([
    'FIN_CDD',
    'DEMISSION_CDI',
    'DEMISSION_CDD',
    'LICENCIEMENT',
    'RUPTURE_CONVENTIONNELLE',
    'RETRAITE',
    'DECES',
  ]).optional(),

  // Step 2: Basic configuration
  terminationDate: z.date().optional(),
  noticePeriodStatus: z.enum(['worked', 'paid_by_employer', 'paid_by_employee', 'waived']).optional(),

  // Optional fields based on departure type
  licenciementType: z.enum(['economique', 'faute_simple', 'faute_grave', 'faute_lourde', 'inaptitude']).optional(),
  ruptureNegotiatedAmount: z.number().min(0).optional(),
  beneficiaries: z.array(z.object({
    name: z.string(),
    relationship: z.enum(['spouse', 'child', 'parent', 'other']),
    identityDocument: z.string(),
    bankAccount: z.string(),
    sharePercentage: z.number().min(0).max(100),
  })).optional(),

  // Step 3: STC preview (populated by API)
  stcResult: z.any().optional(),

  // Step 4: Document generation
  issuedBy: z.string().optional(),
  payDate: z.string().optional(),
  versionNotes: z.string().optional(),

  // Step 5: Confirmation
  terminationId: z.string().uuid().optional(),
  documentsGenerated: z.boolean().optional(),
});

export type WizardData = z.infer<typeof wizardSchema>;

interface TerminateEmployeeWizardProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    hireDate: string;
    contractType?: 'CDI' | 'CDD';
  };
  open: boolean;
  onClose: () => void;
}

export function TerminateEmployeeWizard({
  employee,
  open,
  onClose,
}: TerminateEmployeeWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const form = useForm<WizardData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      terminationDate: new Date(),
      noticePeriodStatus: 'worked',
      payDate: new Date().toISOString(),
      issuedBy: '', // ← Fix: Initialize as empty string to prevent uncontrolled→controlled warning
      versionNotes: '', // ← Fix: Initialize as empty string
    },
  });

  // Step 3: Preview STC
  const previewSTC = trpc.terminations.previewSTC.useQuery(
    {
      employeeId: employee.id,
      departureType: form.watch('departureType') as any,
      terminationDate: form.watch('terminationDate') ?? new Date(),
      noticePeriodStatus: form.watch('noticePeriodStatus') as any,
      licenciementType: form.watch('licenciementType') as any,
      ruptureNegotiatedAmount: form.watch('ruptureNegotiatedAmount'),
      beneficiaries: form.watch('beneficiaries'),
    },
    {
      enabled: currentStep === 3 && !!form.watch('departureType') && !!form.watch('terminationDate'),
    }
  );

  // Update form when STC result is fetched
  useEffect(() => {
    console.log('[Wizard] previewSTC.data:', previewSTC.data);
    console.log('[Wizard] previewSTC.data?.stc:', previewSTC.data?.stc);
    console.log('[Wizard] previewSTC.error:', previewSTC.error);
    console.log('[Wizard] previewSTC.isLoading:', previewSTC.isLoading);

    if (previewSTC.data?.stc) {
      console.log('[Wizard] Setting stcResult to form:', previewSTC.data.stc);
      form.setValue('stcResult', previewSTC.data.stc);
    }
  }, [previewSTC.data, form]);

  // Step 4: Create termination and generate documents
  const createTermination = trpc.terminations.create.useMutation({
    onSuccess: (termination) => {
      form.setValue('terminationId', termination.id);
      toast({
        title: 'Cessation enregistrée',
        description: 'Le contrat a été terminé avec succès.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const generateDocuments = trpc.terminations.generateDocuments.useMutation({
    onSuccess: () => {
      form.setValue('documentsGenerated', true);
      queryClient.invalidateQueries();
      toast({
        title: 'Documents générés',
        description: 'Les 3 documents de cessation ont été générés avec succès.',
      });
      setCurrentStep(5);
    },
    onError: (error) => {
      toast({
        title: 'Erreur de génération',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleNext = async () => {
    // Step-specific validation
    let fieldsToValidate: (keyof WizardData)[] = [];

    if (currentStep === 1) {
      // Step 1: Only validate departure type
      fieldsToValidate = ['departureType'];

      if (!form.getValues('departureType')) {
        toast({
          title: 'Sélection requise',
          description: 'Veuillez sélectionner un type de cessation.',
          variant: 'destructive',
        });
        return;
      }
    } else if (currentStep === 2) {
      // Step 2: Validate configuration fields
      fieldsToValidate = ['terminationDate', 'noticePeriodStatus'];

      if (!form.getValues('terminationDate') || !form.getValues('noticePeriodStatus')) {
        toast({
          title: 'Formulaire incomplet',
          description: 'Veuillez remplir tous les champs requis.',
          variant: 'destructive',
        });
        return;
      }

      // Conditional validation for LICENCIEMENT
      const departureType = form.getValues('departureType');
      if (departureType === 'LICENCIEMENT' && !form.getValues('licenciementType')) {
        toast({
          title: 'Type de licenciement requis',
          description: 'Veuillez sélectionner le type de licenciement.',
          variant: 'destructive',
        });
        return;
      }
    } else if (currentStep === 3) {
      // Step 3: No validation, just check STC was calculated
      if (!form.getValues('stcResult')) {
        toast({
          title: 'Calcul en cours',
          description: 'Veuillez attendre que le calcul STC soit terminé.',
          variant: 'destructive',
        });
        return;
      }
    } else if (currentStep === 4) {
      // Step 4: Validate document generation fields and create termination
      if (!form.getValues('issuedBy')) {
        toast({
          title: 'Champ requis',
          description: 'Veuillez indiquer qui émet les documents.',
          variant: 'destructive',
        });
        return;
      }

      const stcResult = form.getValues('stcResult');
      if (!stcResult) {
        toast({
          title: 'Calcul STC manquant',
          description: 'Veuillez revenir à l\'étape 3 pour calculer le STC.',
          variant: 'destructive',
        });
        return;
      }

      // Create termination record
      const termination = await createTermination.mutateAsync({
        employeeId: employee.id,
        terminationDate: form.getValues('terminationDate')!,
        terminationReason: mapDepartureTypeToReason(form.getValues('departureType')!),
        notes: form.getValues('versionNotes'),
        noticePeriodDays: stcResult.noticePeriod?.totalDays || 0,
        severanceAmount: stcResult.severancePay || 0,
        vacationPayoutAmount: stcResult.vacationPayout || 0,
        averageSalary12m: stcResult.calculationDetails.averageSalary12M, // ← Fix: Access from calculationDetails
        yearsOfService: stcResult.calculationDetails.yearsOfService, // ← Fix: Access from calculationDetails
        severanceRate: String(getSeveranceRate(stcResult)) as '0' | '30' | '35' | '40', // ← Fix: Convert to string
      });

      // Generate documents
      await generateDocuments.mutateAsync({
        terminationId: termination.id,
        issuedBy: form.getValues('issuedBy')!,
        payDate: form.getValues('payDate') || new Date().toISOString(),
        versionNotes: form.getValues('versionNotes'),
      });

      return; // Don't increment step, mutation will do it on success
    }

    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleClose = () => {
    form.reset();
    setCurrentStep(1);
    onClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <DepartureTypeStep form={form} employee={employee} />;
      case 2:
        return <ConfigurationStep form={form} employee={employee} />;
      case 3:
        return (
          <STCPreviewStep
            form={form}
            employee={employee}
            stcResult={previewSTC.data?.stc}
            isLoading={previewSTC.isLoading || previewSTC.isFetching}
            error={previewSTC.error as any}
          />
        );
      case 4:
        return <DocumentGenerationStep form={form} employee={employee} />;
      case 5:
        return <ConfirmationStep form={form} employee={employee} />;
      default:
        return null;
    }
  };

  const isLoading = createTermination.isPending || generateDocuments.isPending;
  const canGoNext = currentStep < totalSteps;
  const canGoBack = currentStep > 1 && currentStep < 5;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Cessation de contrat - Étape {currentStep}/{totalSteps}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {employee.firstName} {employee.lastName}
            </span>
          </DialogTitle>
          <DialogDescription>
            {getStepDescription(currentStep)}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full transition-colors ${
                step <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[400px]">{renderStep()}</div>

        {/* Footer navigation */}
        <div className="flex justify-between gap-4 pt-4 border-t">
          <div>
            {canGoBack && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="min-h-[44px]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Précédent
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading && currentStep !== 5}
              className="min-h-[44px]"
            >
              {currentStep === 5 ? 'Fermer' : 'Annuler'}
            </Button>

            {canGoNext && currentStep !== 5 && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                className="min-h-[44px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Traitement...
                  </>
                ) : currentStep === 4 ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Générer les documents
                  </>
                ) : (
                  <>
                    Suivant
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper functions
function getStepDescription(step: number): string {
  switch (step) {
    case 1:
      return 'Sélectionnez le type de cessation';
    case 2:
      return 'Configurez les détails de la cessation';
    case 3:
      return 'Vérifiez le calcul du Solde de Tout Compte (STC)';
    case 4:
      return 'Génération des documents officiels';
    case 5:
      return 'Cessation terminée avec succès';
    default:
      return '';
  }
}

function mapDepartureTypeToReason(departureType: DepartureType): 'dismissal' | 'resignation' | 'retirement' | 'misconduct' | 'contract_end' | 'death' | 'other' {
  switch (departureType) {
    case 'FIN_CDD':
    case 'DEMISSION_CDD':
      return 'contract_end';
    case 'DEMISSION_CDI':
      return 'resignation';
    case 'LICENCIEMENT':
      return 'dismissal';
    case 'RETRAITE':
      return 'retirement';
    case 'DECES':
      return 'death';
    case 'RUPTURE_CONVENTIONNELLE':
      return 'other';
    default:
      return 'other';
  }
}

function getSeveranceRate(stcResult: any): number {
  if (!stcResult?.severancePayBreakdown) return 0;
  const breakdown = stcResult.severancePayBreakdown;

  // Calculate weighted average rate
  const totalYears = breakdown.tranche1Years + breakdown.tranche2Years + breakdown.tranche3Years;
  if (totalYears === 0) return 0;

  const weightedRate =
    (breakdown.tranche1Years * 30 +
     breakdown.tranche2Years * 35 +
     breakdown.tranche3Years * 40) /
    totalYears;

  return Math.round(weightedRate);
}
