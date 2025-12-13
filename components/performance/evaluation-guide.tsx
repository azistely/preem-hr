'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/trpc/react';
import {
  CheckCircle2,
  Clock,
  Lock,
  Circle,
  ArrowRight,
  Plus,
  Users,
  ClipboardCheck,
  Share2,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type StepStatus = 'locked' | 'ready' | 'in_progress' | 'completed';

interface StepConfig {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  status: StepStatus;
  progress?: { completed: number; total: number };
  action: {
    label: string;
    href: string;
  } | null;
  statusLabel: string;
}

function getStepStatuses(data: {
  activeCycle: { id: string; name: string; status: string; includeSelfEvaluation: boolean; includeManagerEvaluation: boolean; includeObjectives: boolean } | null;
  selfEvalProgress: { completed: number; total: number };
  managerEvalProgress: { completed: number; total: number };
  objectivesProgress: { completed: number; total: number };
  resultsShared: boolean;
}): StepStatus[] {
  // Step 1: Cycle creation
  const step1: StepStatus = data.activeCycle ? 'completed' : 'ready';

  // Step 2: Objectives (if enabled) - comes after cycle creation, before evaluations
  let stepObjectives: StepStatus = 'locked';
  if (data.activeCycle) {
    if (!data.activeCycle.includeObjectives) {
      // If objectives disabled, mark as completed (skip)
      stepObjectives = 'completed';
    } else if (data.objectivesProgress.total === 0) {
      // No objectives yet - ready to create
      stepObjectives = 'ready';
    } else if (data.objectivesProgress.completed === data.objectivesProgress.total) {
      // All objectives approved
      stepObjectives = 'completed';
    } else if (data.objectivesProgress.completed > 0) {
      // Some objectives approved
      stepObjectives = 'in_progress';
    } else {
      // Objectives exist but none approved yet
      stepObjectives = 'in_progress';
    }
  }

  // Step 3: Self-evaluations (requires cycle to be launched/active)
  let step2: StepStatus = 'locked';
  if (data.activeCycle) {
    const objectivesReady = stepObjectives === 'completed' || !data.activeCycle.includeObjectives;
    const cycleIsActive = data.activeCycle.status === 'active' || data.activeCycle.status === 'calibration';

    if (!data.activeCycle.includeSelfEvaluation) {
      // If self-evaluation is disabled, skip this step
      step2 = 'completed';
    } else if (!objectivesReady) {
      // Objectives not ready yet
      step2 = 'locked';
    } else if (!cycleIsActive) {
      // Cycle not launched yet - evaluations don't exist
      step2 = 'locked';
    } else if (data.selfEvalProgress.total === 0) {
      step2 = 'ready';
    } else if (data.selfEvalProgress.completed === data.selfEvalProgress.total) {
      step2 = 'completed';
    } else if (data.selfEvalProgress.completed > 0) {
      step2 = 'in_progress';
    } else {
      step2 = 'ready';
    }
  }

  // Step 4: Manager evaluations (requires cycle to be launched/active)
  let step3: StepStatus = 'locked';
  if (data.activeCycle) {
    const objectivesReady = stepObjectives === 'completed' || !data.activeCycle.includeObjectives;
    const selfEvalsReady = step2 === 'completed' || !data.activeCycle.includeSelfEvaluation;
    const cycleIsActive = data.activeCycle.status === 'active' || data.activeCycle.status === 'calibration';

    if (!data.activeCycle.includeManagerEvaluation) {
      // If manager evaluation is disabled, skip this step
      step3 = 'completed';
    } else if (!objectivesReady) {
      // Objectives must be ready first (if enabled)
      step3 = 'locked';
    } else if (!cycleIsActive) {
      // Cycle not launched yet - evaluations don't exist
      step3 = 'locked';
    } else if (selfEvalsReady) {
      // Manager evals can start if self-evals are done OR self-evals are disabled
      if (data.managerEvalProgress.total === 0) {
        step3 = 'ready';
      } else if (data.managerEvalProgress.completed === data.managerEvalProgress.total) {
        step3 = 'completed';
      } else if (data.managerEvalProgress.completed > 0) {
        step3 = 'in_progress';
      } else {
        step3 = 'ready';
      }
    }
  }

  // Step 5: Share results
  let step4: StepStatus = 'locked';
  if (data.activeCycle) {
    const evalStepsCompleted = (step2 === 'completed' || !data.activeCycle.includeSelfEvaluation) &&
                               (step3 === 'completed' || !data.activeCycle.includeManagerEvaluation);
    if (evalStepsCompleted) {
      step4 = data.resultsShared ? 'completed' : 'ready';
    }
  }

  return [step1, stepObjectives, step2, step3, step4];
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-6 w-6 text-green-600" />;
    case 'in_progress':
      return <Clock className="h-6 w-6 text-amber-500" />;
    case 'locked':
      return <Lock className="h-6 w-6 text-muted-foreground" />;
    case 'ready':
      return <Circle className="h-6 w-6 text-primary" />;
  }
}

function StepCard({
  step,
  isLast,
}: {
  step: StepConfig;
  isLast: boolean;
}) {
  const isActive = step.status === 'ready' || step.status === 'in_progress';
  const isLocked = step.status === 'locked';
  const Icon = step.icon;

  return (
    <div className="relative">
      {/* Connection line to next step */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-6 top-[72px] w-0.5 h-4',
            step.status === 'completed' ? 'bg-green-200' : 'bg-muted'
          )}
        />
      )}

      <div
        className={cn(
          'flex items-start gap-4 p-4 rounded-lg border transition-all min-h-[80px]',
          isActive && 'border-primary bg-primary/5 shadow-sm',
          step.status === 'completed' && 'border-green-200 bg-green-50',
          isLocked && 'opacity-60 bg-muted/30'
        )}
      >
        {/* Step number and status icon */}
        <div className="flex flex-col items-center gap-1">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              isActive && 'bg-primary/10',
              step.status === 'completed' && 'bg-green-100',
              isLocked && 'bg-muted'
            )}
          >
            <StepIcon status={step.status} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={cn(
                  'font-semibold',
                  isLocked && 'text-muted-foreground'
                )}>
                  {step.number}. {step.title}
                </h3>
                <Icon className={cn(
                  'h-4 w-4',
                  isLocked ? 'text-muted-foreground' : 'text-muted-foreground'
                )} />
              </div>
              <p className={cn(
                'text-sm mt-0.5',
                isLocked ? 'text-muted-foreground' : 'text-muted-foreground'
              )}>
                {step.description}
              </p>

              {/* Progress indicator */}
              {step.progress && step.progress.total > 0 && !isLocked && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[200px]">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          step.status === 'completed' ? 'bg-green-500' : 'bg-primary'
                        )}
                        style={{
                          width: `${(step.progress.completed / step.progress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className={cn(
                      'font-medium whitespace-nowrap',
                      step.status === 'completed' ? 'text-green-600' : 'text-foreground'
                    )}>
                      {step.progress.completed}/{step.progress.total}
                    </span>
                  </div>
                </div>
              )}

              {/* Status label */}
              <p className={cn(
                'text-xs mt-1.5',
                step.status === 'completed' && 'text-green-600 font-medium',
                step.status === 'in_progress' && 'text-amber-600 font-medium',
                isLocked && 'text-muted-foreground'
              )}>
                {step.statusLabel}
              </p>
            </div>

            {/* Action button */}
            {step.action && !isLocked && (
              <Button
                asChild
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className="min-h-[40px] shrink-0"
              >
                <Link href={step.action.href}>
                  {step.action.label}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}

            {/* Locked badge */}
            {isLocked && (
              <Badge variant="secondary" className="shrink-0">
                <Lock className="h-3 w-3 mr-1" />
                Bloque
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EvaluationGuide() {
  const [isOpen, setIsOpen] = useState(true);
  const { data, isLoading, error } = api.performance.getGuideStatus.useQuery();

  if (error) {
    return null; // Silently fail - don't block the page
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const statuses = getStepStatuses(data);
  // statuses = [step1 (cycle), stepObjectives, step2 (self-eval), step3 (manager-eval), step4 (share)]

  // Build step configurations - only include ENABLED steps
  const allSteps: (StepConfig | null)[] = [
    // Step 1: Always show cycle creation
    {
      number: 1,
      title: 'Creer le cycle',
      description: 'Definissez la periode et les parametres',
      icon: Plus,
      status: statuses[0],
      action: data.activeCycle
        ? { label: 'Voir le cycle', href: `/performance/cycles/${data.activeCycle.id}` }
        : { label: 'Creer un cycle', href: '/performance/cycles/new' },
      statusLabel: data.activeCycle
        ? `Cycle actif: ${data.activeCycle.name}`
        : 'Creez votre premier cycle',
    },
    // Step 2: Objectives (only show if includeObjectives is enabled)
    data.activeCycle?.includeObjectives ? {
      number: 2,
      title: 'Definir les objectifs',
      description: 'Creez et assignez les objectifs aux employes',
      icon: Target,
      status: statuses[1],
      progress: data.objectivesProgress,
      action: data.activeCycle && statuses[1] !== 'locked'
        ? { label: 'Gerer les objectifs', href: `/performance/cycles/${data.activeCycle.id}?tab=objectives` }
        : null,
      statusLabel: getObjectivesStepLabel(statuses[1], data.objectivesProgress),
    } : null,
    // Step 3: Self-evaluations (only show if self-evaluation is enabled)
    data.activeCycle?.includeSelfEvaluation ? {
      number: 3,
      title: 'Auto-evaluations',
      description: 'Les employes notent leur propre performance',
      icon: Users,
      status: statuses[2],
      progress: data.selfEvalProgress,
      action: data.activeCycle && statuses[2] !== 'locked'
        ? { label: 'Voir les reponses', href: '/performance/evaluations?type=self' }
        : null,
      statusLabel: getStep2Label(statuses[2], data.selfEvalProgress, true),
    } : null,
    // Step 4: Manager evaluations (only show if manager evaluation is enabled)
    data.activeCycle?.includeManagerEvaluation ? {
      number: 4,
      title: 'Evaluations RH',
      description: 'Evaluez chaque employe',
      icon: ClipboardCheck,
      status: statuses[3],
      progress: data.managerEvalProgress,
      action: data.activeCycle && statuses[3] !== 'locked'
        ? { label: statuses[3] === 'in_progress' ? 'Continuer' : 'Commencer', href: '/performance/evaluations?type=manager' }
        : null,
      statusLabel: getStep3Label(statuses[3], data.managerEvalProgress, true),
    } : null,
    // Step 5: Share results (always show, but may be locked)
    {
      number: 5,
      title: 'Partager les resultats',
      description: 'Communiquez les resultats a votre equipe',
      icon: Share2,
      status: statuses[4],
      action: data.activeCycle && statuses[4] !== 'locked'
        ? { label: 'Partager', href: `/performance/cycles/${data.activeCycle.id}?action=release` }
        : null,
      statusLabel: getStep4Label(statuses[4], data.resultsShared),
    },
  ];

  // Filter out null steps and renumber
  const steps = allSteps
    .filter((step): step is StepConfig => step !== null)
    .map((step, index) => ({ ...step, number: index + 1 }));

  // Calculate overall progress based on visible steps
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const isAllComplete = completedSteps === totalSteps;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        isAllComplete && 'border-green-200 bg-green-50/50'
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">
                Comment evaluer votre equipe
              </CardTitle>
              <Badge variant={isAllComplete ? 'default' : 'secondary'} className={cn(
                isAllComplete && 'bg-green-600'
              )}>
                {completedSteps}/{totalSteps} etapes
              </Badge>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <>
                    Reduire
                    <ChevronUp className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Voir le guide
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {steps.map((step, index) => (
              <StepCard
                key={step.number}
                step={step}
                isLast={index === steps.length - 1}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Helper functions for step labels
function getObjectivesStepLabel(status: StepStatus, progress: { completed: number; total: number }): string {
  switch (status) {
    case 'locked':
      return 'Creez le cycle d\'abord';
    case 'ready':
      return 'Aucun objectif defini';
    case 'in_progress':
      return `${progress.completed} sur ${progress.total} objectifs approuves`;
    case 'completed':
      return progress.total > 0 ? 'Tous les objectifs approuves' : 'Aucun objectif requis';
  }
}

function getStep2Label(status: StepStatus, progress: { completed: number; total: number }, isEnabled: boolean): string {
  if (!isEnabled) return 'Auto-evaluation desactivee pour ce cycle';
  switch (status) {
    case 'locked':
      return 'Lancez le cycle d\'abord';
    case 'ready':
      return 'En attente des reponses';
    case 'in_progress':
      return `${progress.completed} sur ${progress.total} employes ont repondu`;
    case 'completed':
      return 'Tous les employes ont repondu';
  }
}

function getStep3Label(status: StepStatus, progress: { completed: number; total: number }, isEnabled: boolean): string {
  if (!isEnabled) return 'Evaluation manager desactivee pour ce cycle';
  switch (status) {
    case 'locked':
      return 'Attendez les auto-evaluations';
    case 'ready':
      return 'Pret a commencer';
    case 'in_progress':
      return `${progress.completed} sur ${progress.total} evaluations completees`;
    case 'completed':
      return 'Toutes les evaluations terminees';
  }
}

function getStep4Label(status: StepStatus, resultsShared: boolean): string {
  switch (status) {
    case 'locked':
      return 'Terminez vos evaluations d\'abord';
    case 'ready':
      return 'Pret a partager';
    case 'completed':
      return 'Resultats partages';
    default:
      return '';
  }
}
