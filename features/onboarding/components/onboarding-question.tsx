import { ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface OnboardingQuestionProps {
  title: string;
  subtitle: string;
  progress?: {
    current: number;
    total: number;
  };
  showProgress?: boolean;
  children: ReactNode;
}

export function OnboardingQuestion({
  title,
  subtitle,
  progress = { current: 1, total: 3 },
  showProgress = true,
  children,
}: OnboardingQuestionProps) {
  const progressPercent = (progress.current / progress.total) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 p-4">
      {/* Progress bar */}
      {showProgress && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Étape {progress.current} sur {progress.total}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Question card */}
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader className="text-center pb-4">
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </CardHeader>

        <CardContent className="space-y-6 pb-8">
          {children}
        </CardContent>
      </Card>

      {/* Help text */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        Besoin d'aide ? <a href="/support" className="underline hover:text-primary">Contactez-nous</a>
      </p>
    </div>
  );
}
