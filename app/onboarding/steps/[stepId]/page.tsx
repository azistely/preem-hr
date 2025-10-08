'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { OnboardingLayout } from '@/features/onboarding/components/onboarding-layout';
import { HelpBox } from '@/features/onboarding/components/help-box';
import { CountrySelectionStep } from '@/features/onboarding/components/steps/country-selection-step';
import { CompanyInfoStep } from '@/features/onboarding/components/steps/company-info-step';
import { FirstEmployeeStep } from '@/features/onboarding/components/steps/first-employee-step';
import { EmployeesWizardStep } from '@/features/onboarding/components/steps/employees-wizard-step';
import { BulkImportStep } from '@/features/onboarding/components/steps/bulk-import-step';
import { DepartmentsSetupStep } from '@/features/onboarding/components/steps/departments-setup-step';
import { PayrollPreviewStep } from '@/features/onboarding/components/steps/payroll-preview-step';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OnboardingStepPage() {
  const params = useParams();
  const router = useRouter();
  const stepId = params?.stepId as string;

  const { data: state } = api.onboarding.getState.useQuery();
  const { data: preview } = api.onboarding.getPathPreview.useQuery();
  const completeStep = api.onboarding.completeStep.useMutation();

  const handleComplete = async () => {
    try {
      const result = await completeStep.mutateAsync({ stepId });

      toast.success('Étape terminée !');

      // Navigate to next step or completion
      if (result.nextStep) {
        router.push(`/onboarding/steps/${result.nextStep}`);
      } else {
        router.push('/onboarding/complete');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  // Find current step info
  const currentStep = preview?.steps.find(s => s.id === stepId);
  const stepIndex = preview?.steps.findIndex(s => s.id === stepId) ?? -1;

  if (!currentStep) {
    return (
      <OnboardingLayout title="Chargement..." subtitle="Préparation de l'étape">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </OnboardingLayout>
    );
  }

  // Navigate to next step
  const navigateToNext = async () => {
    try {
      const result = await completeStep.mutateAsync({ stepId });

      toast.success('Étape terminée !');

      // Navigate to next step or completion
      if (result.nextStep) {
        router.push(`/onboarding/steps/${result.nextStep}`);
      } else {
        router.push('/onboarding/complete');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  // Render different content based on stepId
  const renderStepContent = () => {
    switch (stepId) {
      case 'country_selection':
        return <CountrySelectionStep onComplete={navigateToNext} />;

      case 'company_info':
        return <CompanyInfoStep onComplete={navigateToNext} />;

      case 'first_employee':
        return <FirstEmployeeStep onComplete={navigateToNext} />;

      case 'employees_wizard':
        return <EmployeesWizardStep onComplete={navigateToNext} />;

      case 'bulk_import':
        return <BulkImportStep onComplete={navigateToNext} />;

      case 'departments_setup':
        return <DepartmentsSetupStep onComplete={navigateToNext} />;

      case 'payroll_preview':
        return <PayrollPreviewStep onComplete={navigateToNext} />;

      default:
        return (
          <>
            <div className="space-y-4">
              <HelpBox>
                Cette étape ({stepId}) n'est pas encore implémentée. Cliquez sur "Continuer" pour passer à l'étape suivante.
              </HelpBox>
            </div>

            <Button
              onClick={handleComplete}
              disabled={completeStep.isPending}
              className="w-full min-h-[44px] mt-6"
            >
              {completeStep.isPending ? 'Enregistrement...' : 'Continuer'}
            </Button>
          </>
        );
    }
  };

  return (
    <OnboardingLayout
      title={currentStep.title}
      subtitle={currentStep.description}
      currentStep={stepIndex + 1}
      totalSteps={preview?.steps.length}
    >
      {renderStepContent()}
    </OnboardingLayout>
  );
}
