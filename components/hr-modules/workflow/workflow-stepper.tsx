/**
 * Workflow Stepper Component
 *
 * Visual representation of workflow steps with progress tracking.
 * Shows current step, completed steps, and upcoming steps.
 *
 * Features:
 * - Vertical and horizontal layouts
 * - Step status indicators (pending, in_progress, completed, skipped)
 * - Optional due date display
 * - Click navigation for completed steps
 */

'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, Play, Circle, SkipForward, AlertTriangle } from 'lucide-react';
import type { WorkflowStepDefinition } from '@/lib/db/schema/hr-workflows';

// Step status types
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'expired';

// Step instance data
export interface StepInstance {
  stepId: string;
  status: StepStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  assigneeName?: string;
}

// Component props
interface WorkflowStepperProps {
  /** Workflow step definitions */
  steps: WorkflowStepDefinition[];
  /** Step instance data (current status, due dates) */
  stepInstances?: StepInstance[];
  /** Currently active step ID */
  currentStepId?: string | null;
  /** Layout direction */
  orientation?: 'horizontal' | 'vertical';
  /** Allow clicking on completed steps */
  onStepClick?: (stepId: string) => void;
  /** Show step numbers */
  showNumbers?: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// Status config
const statusConfig: Record<StepStatus, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: {
    icon: Circle,
    color: 'text-muted-foreground',
    label: 'En attente',
  },
  in_progress: {
    icon: Play,
    color: 'text-blue-600',
    label: 'En cours',
  },
  completed: {
    icon: Check,
    color: 'text-green-600',
    label: 'Terminé',
  },
  skipped: {
    icon: SkipForward,
    color: 'text-amber-600',
    label: 'Ignoré',
  },
  expired: {
    icon: AlertTriangle,
    color: 'text-red-600',
    label: 'Expiré',
  },
};

export function WorkflowStepper({
  steps,
  stepInstances = [],
  currentStepId,
  orientation = 'vertical',
  onStepClick,
  showNumbers = true,
  compact = false,
  className,
}: WorkflowStepperProps) {
  // Get instance for a step
  const getStepInstance = (stepId: string): StepInstance | undefined => {
    return stepInstances.find((si) => si.stepId === stepId);
  };

  // Determine step status
  const getStepStatus = (step: WorkflowStepDefinition, index: number): StepStatus => {
    const instance = getStepInstance(step.id);
    if (instance?.status) {
      return instance.status as StepStatus;
    }

    // Infer status from position relative to current step
    if (step.id === currentStepId) {
      return 'in_progress';
    }

    const currentIndex = steps.findIndex((s) => s.id === currentStepId);
    if (currentIndex >= 0 && index < currentIndex) {
      return 'completed';
    }

    return 'pending';
  };

  // Format date
  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (orientation === 'horizontal') {
    return (
      <div className={cn('flex items-start gap-2', className)}>
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const config = statusConfig[status];
          const StatusIcon = config.icon;
          const instance = getStepInstance(step.id);
          const isClickable = status === 'completed' && onStepClick;
          const isCurrent = step.id === currentStepId;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step */}
              <div
                className={cn(
                  'flex flex-col items-center',
                  isClickable && 'cursor-pointer hover:opacity-80'
                )}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                {/* Icon circle */}
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 transition-colors',
                    compact ? 'w-8 h-8' : 'w-10 h-10',
                    isCurrent && 'border-blue-500 bg-blue-50',
                    status === 'completed' && 'border-green-500 bg-green-50',
                    status === 'pending' && 'border-muted-foreground/30',
                    status === 'skipped' && 'border-amber-500 bg-amber-50',
                    status === 'expired' && 'border-red-500 bg-red-50'
                  )}
                >
                  {showNumbers && status === 'pending' ? (
                    <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                  ) : (
                    <StatusIcon className={cn('h-4 w-4', config.color)} />
                  )}
                </div>

                {/* Label */}
                {!compact && (
                  <div className="mt-2 text-center max-w-[100px]">
                    <p className={cn(
                      'text-xs font-medium truncate',
                      isCurrent ? 'text-blue-600' : 'text-muted-foreground'
                    )}>
                      {step.name}
                    </p>
                    {instance?.dueDate && status !== 'completed' && (
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(instance.dueDate)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    compact ? 'min-w-[20px]' : 'min-w-[40px]',
                    index < steps.findIndex((s) => s.id === currentStepId)
                      ? 'bg-green-500'
                      : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical layout
  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, index) => {
        const status = getStepStatus(step, index);
        const config = statusConfig[status];
        const StatusIcon = config.icon;
        const instance = getStepInstance(step.id);
        const isClickable = status === 'completed' && onStepClick;
        const isCurrent = step.id === currentStepId;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex gap-4">
            {/* Left column: icon + connector */}
            <div className="flex flex-col items-center">
              {/* Icon circle */}
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-colors flex-shrink-0',
                  compact ? 'w-8 h-8' : 'w-10 h-10',
                  isCurrent && 'border-blue-500 bg-blue-50',
                  status === 'completed' && 'border-green-500 bg-green-50',
                  status === 'pending' && 'border-muted-foreground/30',
                  status === 'skipped' && 'border-amber-500 bg-amber-50',
                  status === 'expired' && 'border-red-500 bg-red-50',
                  isClickable && 'cursor-pointer hover:opacity-80'
                )}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                {showNumbers && status === 'pending' ? (
                  <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                ) : (
                  <StatusIcon className={cn('h-4 w-4', config.color)} />
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 flex-1 min-h-[24px]',
                    status === 'completed' || (isCurrent && !instance)
                      ? 'bg-green-500'
                      : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>

            {/* Right column: content */}
            <div className={cn('pb-6', isLast && 'pb-0')}>
              <div
                className={cn(
                  'flex items-center gap-2',
                  isClickable && 'cursor-pointer hover:opacity-80'
                )}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                <h4 className={cn(
                  'font-medium',
                  isCurrent ? 'text-blue-600' : status === 'completed' ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step.name}
                </h4>
                {isCurrent && (
                  <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                    En cours
                  </Badge>
                )}
                {status === 'expired' && (
                  <Badge variant="destructive" className="text-xs">
                    En retard
                  </Badge>
                )}
              </div>

              {step.description && !compact && (
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
              )}

              {/* Meta info */}
              {!compact && (
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  {instance?.assigneeName && (
                    <span>Assigné à: {instance.assigneeName}</span>
                  )}
                  {instance?.dueDate && status !== 'completed' && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Échéance: {formatDate(instance.dueDate)}
                    </span>
                  )}
                  {instance?.completedAt && status === 'completed' && (
                    <span className="text-green-600">
                      Terminé le {formatDate(instance.completedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WorkflowStepper;
