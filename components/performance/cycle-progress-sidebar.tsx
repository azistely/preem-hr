/**
 * Cycle Progress Sidebar
 *
 * Persistent sidebar component that appears on all /performance/* pages.
 * Combines workflow steps (from EvaluationGuide) with pre-launch readiness checks.
 * Provides a unified experience for tracking cycle progress.
 *
 * Features:
 * - Workflow steps with progress tracking
 * - Pre-launch readiness checks (employees, dates, competencies, objectives)
 * - Hard blocks launch until all checks pass
 * - Collapsible state persisted in localStorage
 * - Desktop: Fixed sidebar | Mobile: Floating action button + bottom sheet
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  Clock,
  Lock,
  Circle,
  ArrowRight,
  Plus,
  Users,
  User,
  ClipboardCheck,
  Share2,
  ChevronDown,
  ChevronUp,
  Target,
  AlertTriangle,
  X,
  LayoutList,
  Rocket,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  Scale,
} from 'lucide-react';

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

interface ReadinessCheck {
  id: string;
  label: string;
  description: string;
  status: 'passed' | 'failed' | 'warning';
  blocksLaunch: boolean;
  actionHref?: string;
  details?: {
    count?: number;
    items?: Array<{ id: string; name: string }>;
  };
}

interface IndividualCycle {
  id: string;
  name: string;
  status: string;
  individualReason: string | null;
  periodStart: string;
  periodEnd: string;
  includeSelfEvaluation: boolean;
  includeManagerEvaluation: boolean;
  includeObjectives: boolean;
  includeCompetencies?: boolean;
  includeCalibration?: boolean;
  cycleScope?: string;
  targetEmployee: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    employeeNumber: string | null;
  } | null;
  selfEvalProgress: { completed: number; total: number };
  managerEvalProgress: { completed: number; total: number };
  objectivesProgress: { completed: number; total: number };
  resultsShared: boolean;
  progress: { completed: number; total: number }; // Legacy
}

interface GuideData {
  activeCycle: {
    id: string;
    name: string;
    status: string;
    includeSelfEvaluation: boolean;
    includeManagerEvaluation: boolean;
    includeObjectives: boolean;
    includeCompetencies?: boolean;
    includeCalibration?: boolean;
    cycleScope?: string;
  } | null;
  selfEvalProgress: { completed: number; total: number };
  managerEvalProgress: { completed: number; total: number };
  objectivesProgress: { completed: number; total: number };
  resultsShared: boolean;
  calibrationCompleted?: boolean;
  individualCycles?: IndividualCycle[];
}

// ============================================================================
// HELPER FUNCTIONS - Step Status Calculation
// ============================================================================

interface StepStatuses {
  cycleCreation: StepStatus;
  objectives: StepStatus;
  launch: StepStatus;
  competencies: StepStatus;
  selfEvaluation: StepStatus;
  managerEvaluation: StepStatus;
  calibration: StepStatus;
  share: StepStatus;
}

function getStepStatuses(data: GuideData): StepStatuses {
  // Step 1: Cycle creation
  const cycleCreation: StepStatus = data.activeCycle ? 'completed' : 'ready';

  // Step 2: Objectives (if enabled)
  let objectives: StepStatus = 'locked';
  if (data.activeCycle) {
    if (!data.activeCycle.includeObjectives) {
      objectives = 'completed';
    } else if (data.objectivesProgress.total === 0) {
      objectives = 'ready';
    } else if (data.objectivesProgress.completed === data.objectivesProgress.total) {
      objectives = 'completed';
    } else if (data.objectivesProgress.completed > 0) {
      objectives = 'in_progress';
    } else {
      objectives = 'in_progress';
    }
  }

  // Step 3: Launch cycle
  let launch: StepStatus = 'locked';
  if (data.activeCycle) {
    const cycleStatus = data.activeCycle.status;
    if (cycleStatus === 'planning' || cycleStatus === 'objective_setting') {
      // Cycle not yet launched
      const objectivesReady = objectives === 'completed' || objectives === 'in_progress' || !data.activeCycle.includeObjectives;
      launch = objectivesReady ? 'ready' : 'locked';
    } else {
      // Cycle is active or beyond
      launch = 'completed';
    }
  }

  // Step 4: Competencies (if enabled) - handled via readiness checks, so this is more of a display step
  let competencies: StepStatus = 'locked';
  if (data.activeCycle) {
    if (!data.activeCycle.includeCompetencies) {
      competencies = 'completed';
    } else {
      // Competencies are evaluated as part of self/manager evals, so status depends on cycle status
      const cycleIsActive = data.activeCycle.status === 'active' || data.activeCycle.status === 'calibration';
      if (cycleIsActive) {
        competencies = 'in_progress';
      } else {
        competencies = 'ready';
      }
    }
  }

  // Step 4: Self-evaluations
  let selfEvaluation: StepStatus = 'locked';
  if (data.activeCycle) {
    const objectivesReady = objectives === 'completed' || !data.activeCycle.includeObjectives;
    const cycleIsActive = data.activeCycle.status === 'active' || data.activeCycle.status === 'calibration';

    if (!data.activeCycle.includeSelfEvaluation) {
      selfEvaluation = 'completed';
    } else if (!objectivesReady) {
      selfEvaluation = 'locked';
    } else if (!cycleIsActive) {
      selfEvaluation = 'locked';
    } else if (data.selfEvalProgress.total === 0) {
      selfEvaluation = 'ready';
    } else if (data.selfEvalProgress.completed === data.selfEvalProgress.total) {
      selfEvaluation = 'completed';
    } else if (data.selfEvalProgress.completed > 0) {
      selfEvaluation = 'in_progress';
    } else {
      selfEvaluation = 'ready';
    }
  }

  // Step 5: Manager evaluations
  let managerEvaluation: StepStatus = 'locked';
  if (data.activeCycle) {
    const objectivesReady = objectives === 'completed' || !data.activeCycle.includeObjectives;
    const selfEvalsReady = selfEvaluation === 'completed' || !data.activeCycle.includeSelfEvaluation;
    const cycleIsActive = data.activeCycle.status === 'active' || data.activeCycle.status === 'calibration';

    if (!data.activeCycle.includeManagerEvaluation) {
      managerEvaluation = 'completed';
    } else if (!objectivesReady) {
      managerEvaluation = 'locked';
    } else if (!cycleIsActive) {
      managerEvaluation = 'locked';
    } else if (selfEvalsReady) {
      if (data.managerEvalProgress.total === 0) {
        managerEvaluation = 'ready';
      } else if (data.managerEvalProgress.completed === data.managerEvalProgress.total) {
        managerEvaluation = 'completed';
      } else if (data.managerEvalProgress.completed > 0) {
        managerEvaluation = 'in_progress';
      } else {
        managerEvaluation = 'ready';
      }
    }
  }

  // Step 6: Calibration (if enabled)
  let calibration: StepStatus = 'locked';
  if (data.activeCycle) {
    const managerEvalsReady = managerEvaluation === 'completed' || !data.activeCycle.includeManagerEvaluation;
    const selfEvalsReady = selfEvaluation === 'completed' || !data.activeCycle.includeSelfEvaluation;
    const allEvalsComplete = managerEvalsReady && selfEvalsReady;
    const cycleIsCalibration = data.activeCycle.status === 'calibration';

    if (!data.activeCycle.includeCalibration) {
      calibration = 'completed';
    } else if (!allEvalsComplete) {
      calibration = 'locked';
    } else if (data.calibrationCompleted || data.activeCycle.status === 'closed') {
      // Calibration is completed if there's a completed session OR cycle is closed
      calibration = 'completed';
    } else if (cycleIsCalibration) {
      calibration = 'in_progress';
    } else {
      calibration = 'ready';
    }
  }

  // Step 7: Share results
  let share: StepStatus = 'locked';
  if (data.activeCycle) {
    const calibrationReady = calibration === 'completed' || !data.activeCycle.includeCalibration;
    const evalStepsCompleted =
      (selfEvaluation === 'completed' || !data.activeCycle.includeSelfEvaluation) &&
      (managerEvaluation === 'completed' || !data.activeCycle.includeManagerEvaluation) &&
      calibrationReady;
    if (evalStepsCompleted) {
      share = data.resultsShared ? 'completed' : 'ready';
    }
  }

  return {
    cycleCreation,
    objectives,
    launch,
    competencies,
    selfEvaluation,
    managerEvaluation,
    calibration,
    share,
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case 'in_progress':
      return <Clock className="h-5 w-5 text-amber-500" />;
    case 'locked':
      return <Lock className="h-5 w-5 text-muted-foreground" />;
    case 'ready':
      return <Circle className="h-5 w-5 text-primary" />;
  }
}

function CheckIcon({ status }: { status: 'passed' | 'failed' | 'warning' }) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
}

function WorkflowStep({
  step,
  isLast,
  isCompact,
}: {
  step: StepConfig;
  isLast: boolean;
  isCompact?: boolean;
}) {
  const isActive = step.status === 'ready' || step.status === 'in_progress';
  const isLocked = step.status === 'locked';
  const Icon = step.icon;

  return (
    <div className="relative">
      {/* Connection line */}
      {!isLast && (
        <div
          className={cn(
            'absolute left-[18px] top-[40px] w-0.5 h-3',
            step.status === 'completed' ? 'bg-green-200' : 'bg-muted'
          )}
        />
      )}

      <div
        className={cn(
          'flex items-start gap-3 p-2.5 rounded-lg transition-all',
          isActive && 'bg-primary/5 border border-primary/20',
          step.status === 'completed' && 'bg-green-50/50',
          isLocked && 'opacity-50'
        )}
      >
        {/* Step icon */}
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full shrink-0',
            isActive && 'bg-primary/10',
            step.status === 'completed' && 'bg-green-100',
            isLocked && 'bg-muted'
          )}
        >
          <StepIcon status={step.status} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-medium text-sm',
                isLocked && 'text-muted-foreground'
              )}
            >
              {step.number}. {step.title}
            </span>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Progress bar */}
          {step.progress && step.progress.total > 0 && !isLocked && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
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
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {step.progress.completed}/{step.progress.total}
              </span>
            </div>
          )}

          {/* Status label */}
          <p
            className={cn(
              'text-xs mt-0.5',
              step.status === 'completed' && 'text-green-600',
              step.status === 'in_progress' && 'text-amber-600',
              isLocked && 'text-muted-foreground'
            )}
          >
            {step.statusLabel}
          </p>

          {/* Action button */}
          {step.action && !isLocked && isActive && !isCompact && (
            <Button asChild variant="link" size="sm" className="h-6 px-0 text-xs mt-1">
              <Link href={step.action.href}>
                {step.action.label}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual reason labels (French)
const individualReasonLabels: Record<string, string> = {
  probation: 'Période d\'essai',
  cdd_renewal: 'Renouvellement CDD',
  cddti_check: 'Point CDDTI',
  performance_improvement: 'Plan d\'amélioration',
  promotion: 'Promotion',
  other: 'Autre',
};

// ============================================================================
// UNIFIED CYCLE DATA - Convert IndividualCycle to GuideData format
// ============================================================================

function convertIndividualCycleToGuideData(cycle: IndividualCycle): GuideData {
  return {
    activeCycle: {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      includeSelfEvaluation: cycle.includeSelfEvaluation,
      includeManagerEvaluation: cycle.includeManagerEvaluation,
      includeObjectives: cycle.includeObjectives,
      includeCompetencies: cycle.includeCompetencies,
      includeCalibration: cycle.includeCalibration,
      cycleScope: cycle.cycleScope,
    },
    selfEvalProgress: cycle.selfEvalProgress,
    managerEvalProgress: cycle.managerEvalProgress,
    objectivesProgress: cycle.objectivesProgress,
    resultsShared: cycle.resultsShared,
    individualCycles: [],
  };
}

// ============================================================================
// UNIFIED STEP BUILDER - Single source of truth for building cycle steps
// ============================================================================

interface BuildStepsOptions {
  guideData: GuideData;
  readinessData?: {
    cycleId: string;
    cycleStatus: string;
    checks: ReadinessCheck[];
    canLaunch: boolean;
  } | null;
  isIndividual?: boolean;
  targetEmployeeName?: string;
}

function buildCycleSteps(options: BuildStepsOptions): StepConfig[] {
  const { guideData, readinessData, isIndividual, targetEmployeeName } = options;

  if (!guideData.activeCycle) {
    return [];
  }

  const statuses = getStepStatuses(guideData);
  const cycle = guideData.activeCycle;

  const cycleLaunched = cycle.status === 'active' || cycle.status === 'calibration' || cycle.status === 'closed';

  const allSteps: (StepConfig | null)[] = [
    // ===== PRE-LAUNCH PHASE =====
    // Step 1: Create cycle (skip for individual cycles - already created)
    !isIndividual
      ? {
          number: 1,
          title: 'Créer le cycle',
          description: 'Définissez la période',
          icon: Plus,
          status: statuses.cycleCreation,
          action: guideData.activeCycle
            ? { label: 'Voir', href: `/performance/cycles/${guideData.activeCycle.id}` }
            : { label: 'Créer', href: '/performance/cycles/new' },
          statusLabel: guideData.activeCycle ? `Cycle: ${guideData.activeCycle.name}` : 'Créez un cycle',
        }
      : null,
    // Step 2: Competencies - configure BEFORE launch (if enabled)
    cycle.includeCompetencies
      ? {
          number: 2,
          title: 'Compétences des postes',
          description: 'Définir pour chaque poste',
          icon: GraduationCap,
          status: cycleLaunched
            ? 'completed' as StepStatus
            : (readinessData?.checks.find(c => c.id === 'competencies')?.status === 'passed'
                ? 'completed' as StepStatus
                : 'ready' as StepStatus),
          action: { label: 'Configurer', href: '/positions?filter=missing-competencies' },
          statusLabel: cycleLaunched
            ? 'Configuré'
            : (readinessData?.checks.find(c => c.id === 'competencies')?.status === 'passed'
                ? 'Tous les postes OK'
                : readinessData?.checks.find(c => c.id === 'competencies')?.description ?? 'Vérification...'),
        }
      : null,
    // Step 3: Objectives - define BEFORE launch (if enabled)
    cycle.includeObjectives
      ? {
          number: 3,
          title: 'Objectifs',
          description: 'Définir et approuver',
          icon: Target,
          status: cycleLaunched ? 'completed' as StepStatus : statuses.objectives,
          progress: guideData.objectivesProgress,
          action: statuses.objectives !== 'locked'
            ? { label: 'Gérer', href: `/performance/cycles/${cycle.id}?tab=objectives` }
            : null,
          statusLabel: cycleLaunched
            ? 'Définis'
            : getObjectivesLabel(statuses.objectives, guideData.objectivesProgress),
        }
      : null,
    // Step 4: Launch cycle - THE GATE between config and evaluation phases
    {
      number: 4,
      title: 'Lancer le cycle',
      description: 'Démarrer les évaluations',
      icon: Rocket,
      status: cycleLaunched
        ? 'completed' as StepStatus
        : (readinessData?.canLaunch !== false ? 'ready' as StepStatus : 'locked' as StepStatus),
      action: cycleLaunched
        ? { label: 'Voir', href: `/performance/cycles/${cycle.id}` }
        : (readinessData?.canLaunch !== false
            ? { label: 'Lancer', href: `/performance/cycles/${cycle.id}?action=launch` }
            : null),
      statusLabel: cycleLaunched
        ? 'Cycle actif'
        : (readinessData?.canLaunch !== false
            ? 'Prêt à lancer'
            : readinessData
              ? `${readinessData.checks.filter(c => c.status === 'failed').length} prérequis manquant(s)`
              : 'Vérification...'),
    },
    // ===== POST-LAUNCH PHASE (Evaluation) =====
    cycle.includeSelfEvaluation
      ? {
          number: 5,
          title: isIndividual ? 'Auto-évaluation' : 'Auto-évaluations',
          description: isIndividual && targetEmployeeName ? targetEmployeeName : 'Employés notent',
          icon: isIndividual ? User : Users,
          status: statuses.selfEvaluation,
          progress: guideData.selfEvalProgress,
          action: statuses.selfEvaluation !== 'locked'
            ? { label: 'Voir', href: isIndividual
                ? `/performance/evaluations?cycleId=${cycle.id}&type=self`
                : '/performance/evaluations?type=self' }
            : null,
          statusLabel: getSelfEvalLabel(statuses.selfEvaluation, guideData.selfEvalProgress),
        }
      : null,
    cycle.includeManagerEvaluation
      ? {
          number: 6,
          title: isIndividual ? 'Évaluation RH' : 'Évaluations RH',
          description: isIndividual ? 'Évaluer l\'employé' : 'Évaluez chaque employé',
          icon: ClipboardCheck,
          status: statuses.managerEvaluation,
          progress: guideData.managerEvalProgress,
          action: statuses.managerEvaluation !== 'locked'
            ? { label: 'Évaluer', href: isIndividual
                ? `/performance/evaluations?cycleId=${cycle.id}&type=manager`
                : '/performance/evaluations?type=manager' }
            : null,
          statusLabel: getManagerEvalLabel(statuses.managerEvaluation, guideData.managerEvalProgress),
        }
      : null,
    cycle.includeCalibration
      ? {
          number: 7,
          title: 'Calibration',
          description: 'Harmonisez les scores',
          icon: Scale,
          status: statuses.calibration,
          action: statuses.calibration !== 'locked'
            ? { label: 'Calibrer', href: '/performance/calibration' }
            : null,
          statusLabel: getCalibrationLabel(statuses.calibration),
        }
      : null,
    {
      number: 8,
      title: 'Partager',
      description: 'Communiquez les résultats',
      icon: Share2,
      status: statuses.share,
      action: statuses.share !== 'locked'
        ? { label: 'Partager', href: `/performance/cycles/${cycle.id}?action=release` }
        : null,
      statusLabel: getShareLabel(statuses.share, guideData.resultsShared),
    },
  ];

  // Filter nulls and renumber
  return allSteps
    .filter((s): s is StepConfig => s !== null)
    .map((s, i) => ({ ...s, number: i + 1 }));
}

// ============================================================================
// COLLAPSIBLE CYCLE WORKFLOW - Used for both main and individual cycles
// ============================================================================

interface CycleWorkflowProps {
  title: string;
  subtitle?: string;
  badge?: string;
  steps: StepConfig[];
  cycleId: string;
  isCompact?: boolean;
  isActive?: boolean;
  defaultOpen?: boolean;
  icon?: React.ElementType;
}

function CycleWorkflow({
  title,
  subtitle,
  badge,
  steps,
  cycleId,
  isCompact,
  isActive,
  defaultOpen,
  icon: Icon = LayoutList,
}: CycleWorkflowProps) {
  const completedSteps = steps.filter((s) => s.status === 'completed').length;

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className={cn(
        'rounded-lg border bg-card overflow-hidden',
        isActive && 'ring-2 ring-primary border-primary'
      )}>
        <CollapsibleTrigger className="w-full">
          <div className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-left min-w-0">
                <span className="text-sm font-medium truncate block">{title}</span>
                {subtitle && (
                  <span className="text-xs text-muted-foreground truncate block">{subtitle}</span>
                )}
              </div>
              {badge && (
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                  {badge}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5">
                {completedSteps}/{steps.length}
              </Badge>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 space-y-1 border-t">
            {steps.map((step, index) => (
              <WorkflowStep key={step.number} step={step} isLast={index === steps.length - 1} isCompact={isCompact} />
            ))}
            {/* Quick action footer */}
            <div className="pt-2 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1 h-8 text-xs">
                <Link href={`/performance/cycles/${cycleId}`}>
                  Voir le cycle
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ReadinessCheckItem({
  check,
  isCompact,
}: {
  check: ReadinessCheck;
  isCompact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-md',
        check.status === 'failed' && 'bg-destructive/5 border border-destructive/20',
        check.status === 'warning' && 'bg-amber-50 border border-amber-200',
        check.status === 'passed' && 'bg-green-50/50'
      )}
    >
      <CheckIcon status={check.status} />
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-sm font-medium',
            check.status === 'failed' && 'text-destructive',
            check.status === 'warning' && 'text-amber-700',
            check.status === 'passed' && 'text-green-700'
          )}
        >
          {check.label}
        </span>
        <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
        {check.actionHref && check.status === 'failed' && !isCompact && (
          <Button asChild variant="link" size="sm" className="h-5 px-0 text-xs mt-0.5">
            <Link href={check.actionHref}>
              Résoudre
              <ExternalLink className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SIDEBAR CONTENT
// ============================================================================

function SidebarContent({
  guideData,
  readinessData,
  isCompact,
  onClose,
  currentCycleId,
}: {
  guideData: GuideData;
  readinessData?: {
    cycleId: string;
    cycleStatus: string;
    checks: ReadinessCheck[];
    canLaunch: boolean;
  } | null;
  isCompact?: boolean;
  onClose?: () => void;
  currentCycleId?: string | null;
}) {
  const router = useRouter();

  // Check if viewing an individual cycle (for auto-expand)
  const isViewingIndividualCycle = !!(currentCycleId &&
    guideData.individualCycles?.some(c => c.id === currentCycleId));

  // Check if viewing the main cycle
  const isViewingMainCycle = !!(currentCycleId && guideData.activeCycle?.id === currentCycleId);

  // Build steps for main cycle using unified function
  const mainCycleSteps = guideData.activeCycle
    ? buildCycleSteps({
        guideData,
        readinessData,
        isIndividual: false,
      })
    : [];

  // Determine if we should show readiness checks
  const showReadinessChecks =
    guideData.activeCycle &&
    (guideData.activeCycle.status === 'planning' || guideData.activeCycle.status === 'objective_setting') &&
    readinessData;

  const failedChecks = readinessData?.checks.filter((c) => c.status === 'failed') ?? [];
  const canLaunch = readinessData?.canLaunch ?? false;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <h3 className="font-semibold text-sm">Cycles d&apos;évaluation</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {guideData.activeCycle ? '1 cycle principal' : 'Aucun cycle principal'}
            {guideData.individualCycles && guideData.individualCycles.length > 0
              ? ` + ${guideData.individualCycles.length} individuel${guideData.individualCycles.length > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Readiness Checks Section (only before launch for main cycle) */}
        {showReadinessChecks && (
          <Collapsible defaultOpen={failedChecks.length > 0}>
            <div className="space-y-2">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Vérification avant lancement
                  </span>
                  {failedChecks.length > 0 && (
                    <Badge variant="destructive" className="h-5 text-xs">
                      {failedChecks.length} problème{failedChecks.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1.5">
                {readinessData?.checks.map((check) => (
                  <ReadinessCheckItem key={check.id} check={check} isCompact={isCompact} />
                ))}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Main Cycle - using unified CycleWorkflow (collapsible) */}
        {guideData.activeCycle && (
          <CycleWorkflow
            title={guideData.activeCycle.name}
            subtitle={getStatusLabel(guideData.activeCycle.status)}
            steps={mainCycleSteps}
            cycleId={guideData.activeCycle.id}
            isCompact={isCompact}
            isActive={isViewingMainCycle}
            defaultOpen={!isViewingIndividualCycle}
            icon={Users}
          />
        )}

        {/* Individual Cycles - using same unified CycleWorkflow */}
        {guideData.individualCycles && guideData.individualCycles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Évaluations individuelles
              </span>
              <Badge variant="outline" className="h-5 text-xs">
                {guideData.individualCycles.length}
              </Badge>
            </div>
            {guideData.individualCycles.map((cycle) => {
              // Convert individual cycle to GuideData format and build steps
              const cycleGuideData = convertIndividualCycleToGuideData(cycle);
              const employeeName = cycle.targetEmployee
                ? `${cycle.targetEmployee.firstName ?? ''} ${cycle.targetEmployee.lastName ?? ''}`.trim()
                : 'Employé';
              const reasonLabel = cycle.individualReason
                ? individualReasonLabels[cycle.individualReason] || cycle.individualReason
                : undefined;

              const individualSteps = buildCycleSteps({
                guideData: cycleGuideData,
                readinessData: null, // Individual cycles don't have separate readiness checks
                isIndividual: true,
                targetEmployeeName: employeeName,
              });

              return (
                <CycleWorkflow
                  key={cycle.id}
                  title={employeeName}
                  subtitle={getStatusLabel(cycle.status)}
                  badge={reasonLabel}
                  steps={individualSteps}
                  cycleId={cycle.id}
                  isCompact={isCompact}
                  isActive={currentCycleId === cycle.id}
                  defaultOpen={currentCycleId === cycle.id}
                  icon={User}
                />
              );
            })}
            {/* Quick create button */}
            <Button asChild variant="ghost" size="sm" className="w-full h-8 text-xs">
              <Link href="/performance/cycles/new?scope=individual">
                <Plus className="mr-1 h-3 w-3" />
                Nouvelle évaluation individuelle
              </Link>
            </Button>
          </div>
        )}

        {/* Empty state when no cycles exist */}
        {!guideData.activeCycle && (!guideData.individualCycles || guideData.individualCycles.length === 0) && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Aucun cycle d'évaluation actif
            </p>
            <Button asChild size="sm">
              <Link href="/performance/cycles/new">
                <Plus className="mr-1 h-3 w-3" />
                Créer un cycle
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-4 border-t">
        {showReadinessChecks ? (
          <div className="space-y-2">
            <Button
              className="w-full min-h-[44px]"
              disabled={!canLaunch}
              onClick={() => router.push(`/performance/cycles/${guideData.activeCycle?.id}?action=launch`)}
            >
              <Rocket className="mr-2 h-4 w-4" />
              {canLaunch ? 'Lancer le cycle' : 'Résoudre les problèmes'}
            </Button>
            {!canLaunch && (
              <p className="text-xs text-muted-foreground text-center">
                Résolvez tous les problèmes avant de lancer
              </p>
            )}
          </div>
        ) : guideData.activeCycle?.status === 'active' ? (
          <Button asChild variant="outline" className="w-full min-h-[44px]">
            <Link href="/performance/evaluations">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Voir les évaluations
            </Link>
          </Button>
        ) : guideData.activeCycle?.status === 'closed' ? (
          <Button asChild variant="outline" className="w-full min-h-[44px]">
            <Link href={`/performance/cycles/${guideData.activeCycle.id}`}>
              <LayoutList className="mr-2 h-4 w-4" />
              Voir les résultats
            </Link>
          </Button>
        ) : !guideData.activeCycle ? (
          <Button asChild className="w-full min-h-[44px]">
            <Link href="/performance/cycles/new">
              <Plus className="mr-2 h-4 w-4" />
              Créer un cycle
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CycleProgressSidebar() {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Extract current cycle ID from URL (for context-awareness)
  // Matches /performance/cycles/{uuid}
  const cycleIdMatch = pathname.match(/\/performance\/cycles\/([a-f0-9-]{36})/i);
  const currentCycleId = cycleIdMatch ? cycleIdMatch[1] : null;

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('cycle-sidebar-collapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem('cycle-sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Fetch guide status - refetch on window focus for real-time updates
  const {
    data: guideData,
    isLoading: guideLoading,
    error: guideError,
  } = api.performance.getGuideStatus.useQuery(undefined, {
    staleTime: 5000, // 5 seconds - refresh quickly to reflect changes
    refetchOnWindowFocus: true,
  });

  // Fetch readiness checks (only if we have an active cycle in planning status)
  const cycleId = guideData?.activeCycle?.id;
  const cycleStatus = guideData?.activeCycle?.status;
  const shouldFetchReadiness =
    cycleId && (cycleStatus === 'planning' || cycleStatus === 'objective_setting');

  const { data: readinessData, isLoading: readinessLoading } = api.performance.getReadinessChecks.useQuery(
    { cycleId: cycleId! },
    {
      enabled: !!cycleId && !!shouldFetchReadiness,
      staleTime: 5000, // 5 seconds - refresh quickly to reflect changes
      refetchOnWindowFocus: true,
    }
  );

  // Don't show on non-performance pages
  if (!pathname.startsWith('/performance')) {
    return null;
  }

  // Check if we have any cycles (company/department or individual)
  const hasAnyCycles = guideData?.activeCycle || (guideData?.individualCycles && guideData.individualCycles.length > 0);

  // Don't show if there's no cycle and not on a page where user would create one
  if (!guideLoading && !hasAnyCycles && pathname !== '/performance' && pathname !== '/performance/cycles/new') {
    return null;
  }

  // Error state - silently fail
  if (guideError) {
    return null;
  }

  // Loading state
  if (guideLoading) {
    if (isMobile) {
      return null; // Don't show loading state on mobile
    }
    return (
      <div className={cn('w-72 border-l bg-muted/30 p-4 shrink-0', isCollapsed && 'w-12')}>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (!guideData) {
    return null;
  }

  // Mobile: Floating Action Button + Bottom Sheet
  if (isMobile) {
    const failedChecks =
      shouldFetchReadiness && readinessData ? readinessData.checks.filter((c) => c.status === 'failed').length : 0;
    const individualCount = guideData?.individualCycles?.length ?? 0;

    return (
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
            size="icon"
          >
            <LayoutList className="h-6 w-6" />
            {failedChecks > 0 ? (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {failedChecks}
              </span>
            ) : individualCount > 0 ? (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {individualCount}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Progression du cycle</SheetTitle>
          </SheetHeader>
          <SidebarContent
            guideData={guideData}
            readinessData={shouldFetchReadiness ? readinessData : null}
            isCompact
            onClose={() => setIsMobileOpen(false)}
            currentCycleId={currentCycleId}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed Sidebar
  return (
    <div
      className={cn(
        'border-l bg-muted/30 shrink-0 transition-all duration-200 h-full',
        isCollapsed ? 'w-12' : 'w-72'
      )}
    >
      {isCollapsed ? (
        <div className="flex flex-col items-center py-4 gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCollapsed(false)}>
            <LayoutList className="h-4 w-4" />
          </Button>
          {shouldFetchReadiness && readinessData && !readinessData.canLaunch && (
            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {readinessData.checks.filter((c) => c.status === 'failed').length}
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-end px-2 py-2 border-b">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCollapsed(true)}>
              <ChevronUp className="h-4 w-4 rotate-90" />
            </Button>
          </div>
          <SidebarContent
            guideData={guideData}
            readinessData={shouldFetchReadiness ? readinessData : null}
            currentCycleId={currentCycleId}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER LABEL FUNCTIONS
// ============================================================================

function getStatusLabel(status: string): string {
  switch (status) {
    case 'planning':
      return 'Planification';
    case 'objective_setting':
      return 'Définition objectifs';
    case 'active':
      return 'En cours';
    case 'calibration':
      return 'Calibration';
    case 'closed':
      return 'Terminé';
    default:
      return status;
  }
}

function getObjectivesLabel(status: StepStatus, progress: { completed: number; total: number }): string {
  switch (status) {
    case 'locked':
      return 'Créez le cycle';
    case 'ready':
      return 'Aucun objectif';
    case 'in_progress':
      return `${progress.completed}/${progress.total} approuvés`;
    case 'completed':
      return progress.total > 0 ? 'Objectifs prêts' : 'Non requis';
  }
}

function getLaunchLabel(status: StepStatus): string {
  switch (status) {
    case 'locked':
      return 'Définissez objectifs';
    case 'ready':
      return 'Prêt à lancer';
    case 'in_progress':
      return 'En cours...';
    case 'completed':
      return 'Cycle lancé';
  }
}

function getSelfEvalLabel(status: StepStatus, progress: { completed: number; total: number }): string {
  switch (status) {
    case 'locked':
      return 'Lancez le cycle';
    case 'ready':
      return 'En attente';
    case 'in_progress':
      return `${progress.completed}/${progress.total} réponses`;
    case 'completed':
      return 'Terminé';
  }
}

function getManagerEvalLabel(status: StepStatus, progress: { completed: number; total: number }): string {
  switch (status) {
    case 'locked':
      return 'Attendez auto-éval';
    case 'ready':
      return 'Prêt';
    case 'in_progress':
      return `${progress.completed}/${progress.total} complétées`;
    case 'completed':
      return 'Terminé';
  }
}

function getCompetenciesLabel(status: StepStatus): string {
  switch (status) {
    case 'locked':
      return 'Lancez le cycle';
    case 'ready':
      return 'Configurées sur les postes';
    case 'in_progress':
      return 'Évaluation en cours';
    case 'completed':
      return 'Évaluées';
  }
}

function getCalibrationLabel(status: StepStatus): string {
  switch (status) {
    case 'locked':
      return 'Terminez évaluations';
    case 'ready':
      return 'Prêt à calibrer';
    case 'in_progress':
      return 'Calibration en cours';
    case 'completed':
      return 'Calibré';
  }
}

function getShareLabel(status: StepStatus, resultsShared: boolean): string {
  switch (status) {
    case 'locked':
      return 'Terminez évaluations';
    case 'ready':
      return 'Prêt à partager';
    case 'completed':
      return 'Partagé';
    default:
      return '';
  }
}
