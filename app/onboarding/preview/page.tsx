'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { OnboardingLayout } from '@/features/onboarding/components/onboarding-layout';
import { HelpBox } from '@/features/onboarding/components/help-box';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Clock, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface StepPreviewCardProps {
  number: number;
  title: string;
  duration: number;
  required: boolean;
}

function StepPreviewCard({ number, title, duration, required }: StepPreviewCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">
            {duration} min · {required ? 'Requis' : 'Optionnel'}
          </p>
        </div>
        {required ? (
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
      </div>
    </Card>
  );
}

export default function PathPreviewPage() {
  const router = useRouter();

  const { data: preview, isLoading } = api.onboarding.getPathPreview.useQuery();
  const startOnboarding = api.onboarding.startOnboarding.useMutation();

  const handleStart = async () => {
    try {
      await startOnboarding.mutateAsync();
      toast.success('C\'est parti !');

      // Redirect to first step
      if (preview?.steps[0]) {
        router.push(`/onboarding/steps/${preview.steps[0].id}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du démarrage');
    }
  };

  const handleEditAnswers = () => {
    router.push('/onboarding/questionnaire');
  };

  if (isLoading || !preview) {
    return (
      <OnboardingLayout title="Chargement..." subtitle="Préparation de votre parcours">
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      title="Votre parcours de configuration"
      subtitle={`Nous avons personnalisé ${preview.steps.length} étapes pour vous`}
    >
      <div className="space-y-6">
        {/* Summary card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {preview.steps.length} étapes
                </h3>
                <p className="text-muted-foreground">
                  Environ {preview.totalDuration} minutes
                </p>
              </div>
              <Clock className="h-12 w-12 text-primary" />
            </div>
          </CardHeader>
        </Card>

        {/* Steps list */}
        <div className="space-y-3">
          {preview.steps.map((step, index) => (
            <StepPreviewCard
              key={step.id}
              number={index + 1}
              title={step.title}
              duration={step.duration}
              required={step.required}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleStart}
            disabled={startOnboarding.isPending}
            className="w-full min-h-[56px] text-lg"
          >
            {startOnboarding.isPending ? 'Démarrage...' : 'Commencer la configuration'}
          </Button>

          <Button
            variant="outline"
            onClick={handleEditAnswers}
            className="w-full min-h-[44px]"
          >
            Modifier mes réponses
          </Button>
        </div>

        {/* Help box */}
        <HelpBox>
          💡 Vous pouvez interrompre à tout moment et reprendre plus tard
        </HelpBox>
      </div>
    </OnboardingLayout>
  );
}
