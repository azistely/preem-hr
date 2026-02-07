'use client';

import { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { JamanaLogo } from '@/components/brand/jamana-logo';

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
    <div className="min-h-screen bg-gradient-to-br from-preem-teal-50 via-white to-preem-navy-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <JamanaLogo size="default" />
        </div>

        {/* Progress indicator */}
        {currentStep && totalSteps && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                Étape {currentStep} sur {totalSteps}
              </p>
              <p className="text-sm font-medium text-preem-teal">
                {Math.round(progressPercent)}%
              </p>
            </div>
            <Progress value={progressPercent} className="h-2 bg-preem-teal/20">
              <div
                className="h-full bg-preem-teal transition-all rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </Progress>
          </div>
        )}

        {/* Main card */}
        <Card className="border-2 border-preem-teal/20 shadow-preem-teal">
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
            Besoin d&apos;aide ? Contactez-nous sur{' '}
            <a href="mailto:support@jamana.app" className="text-preem-teal hover:underline">
              support@jamana.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
