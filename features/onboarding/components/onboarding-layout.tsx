'use client';

import { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface OnboardingLayoutProps {
  title: string;
  subtitle?: string;
  currentStep?: number;
  totalSteps?: number;
  children: ReactNode;
}

export function OnboardingLayout({
  title,
  subtitle,
  currentStep,
  totalSteps,
  children,
}: OnboardingLayoutProps) {
  const progressPercent = currentStep && totalSteps
    ? (currentStep / totalSteps) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        {currentStep && totalSteps && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                Étape {currentStep} sur {totalSteps}
              </p>
              <p className="text-sm font-medium">
                {Math.round(progressPercent)}%
              </p>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Main card */}
        <Card>
          <CardHeader className="text-center space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base md:text-lg text-muted-foreground">
                {subtitle}
              </p>
            )}
          </CardHeader>

          <CardContent>
            {children}
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            💡 Besoin d'aide ? Contactez-nous sur support@preem.hr
          </p>
        </div>
      </div>
    </div>
  );
}
