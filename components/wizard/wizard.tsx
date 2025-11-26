'use client';

import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  title: string;
  description?: string;
  content: ReactNode;
  validate?: () => boolean | Promise<boolean>;
  optional?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete: () => void | Promise<void>;
  isSubmitting?: boolean;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  /** Disable the next/continue button (e.g., when form is invalid or blocked) */
  disableNext?: boolean;
}

export function Wizard({
  steps,
  onComplete,
  isSubmitting = false,
  currentStep: controlledStep,
  onStepChange,
  disableNext = false,
}: WizardProps) {
  const [internalStep, setInternalStep] = useState(0);

  // Use controlled or internal state
  const currentStep = controlledStep !== undefined ? controlledStep : internalStep;
  const setCurrentStep = onStepChange || setInternalStep;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  const handleNext = async () => {
    // Validate current step before proceeding
    if (currentStepData.validate) {
      const isValid = await currentStepData.validate();
      if (!isValid) {
        return; // Don't proceed if validation fails
      }
    }

    if (isLastStep) {
      await onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="space-y-2">
        {/* Step counter */}
        <div className="text-sm text-muted-foreground">
          Étape {currentStep + 1} sur {steps.length}
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-2 flex-1 rounded-full transition-colors',
                index <= currentStep ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step title and description */}
        <div className="pt-2">
          <h2 className="text-2xl font-bold">{currentStepData.title}</h2>
          {currentStepData.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {currentStepData.description}
            </p>
          )}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStepData.content}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={isFirstStep || isSubmitting}
          className="min-h-[48px]"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          disabled={isSubmitting || disableNext}
          className="flex-1 min-h-[48px]"
        >
          {isSubmitting ? (
            'En cours...'
          ) : (
            <>
              Continuer
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
