/**
 * Step Card Component
 *
 * Individual workflow step display with action buttons.
 * Shows step details, assignee, due date, and available actions.
 *
 * Features:
 * - Step type icons
 * - Status badges
 * - Action buttons (complete, approve/reject, skip)
 * - Form link for form-type steps
 * - Expandable details
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Check,
  X,
  Clock,
  Play,
  FileText,
  ThumbsUp,
  ThumbsDown,
  SkipForward,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Bell,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';
import type { WorkflowStepDefinition } from '@/lib/db/schema/hr-workflows';

// Step status types
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'expired';

// Step instance data
export interface StepInstanceData {
  id: string;
  stepId: string;
  status: StepStatus;
  dueDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  approvalStatus?: 'approved' | 'rejected' | null;
  approvalComment?: string | null;
  formSubmissionId?: string | null;
  remindersSent?: number;
}

// Assignee data
export interface AssigneeData {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string;
}

// Component props
interface StepCardProps {
  /** Step definition */
  step: WorkflowStepDefinition;
  /** Step instance data */
  instance?: StepInstanceData;
  /** Assignee information */
  assignee?: AssigneeData | null;
  /** Subject employee name */
  subjectName?: string;
  /** Whether the current user can act on this step */
  canAct?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when completing step */
  onComplete?: () => void;
  /** Callback when approving */
  onApprove?: () => void;
  /** Callback when rejecting */
  onReject?: () => void;
  /** Callback when skipping */
  onSkip?: () => void;
  /** Callback to open form */
  onOpenForm?: () => void;
  /** Variant: default or compact */
  variant?: 'default' | 'compact';
  /** Custom class name */
  className?: string;
}

// Step type icons
const stepTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  form: FileText,
  approval: ThumbsUp,
  review: MessageSquare,
  notification: Bell,
  wait: Clock,
  parallel: Play,
  conditional: AlertTriangle,
};

// Status config
const statusConfig: Record<StepStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  pending: {
    label: 'En attente',
    variant: 'outline',
    color: 'text-muted-foreground',
  },
  in_progress: {
    label: 'En cours',
    variant: 'default',
    color: 'text-blue-600',
  },
  completed: {
    label: 'Terminé',
    variant: 'secondary',
    color: 'text-green-600',
  },
  skipped: {
    label: 'Ignoré',
    variant: 'outline',
    color: 'text-amber-600',
  },
  expired: {
    label: 'En retard',
    variant: 'destructive',
    color: 'text-red-600',
  },
};

export function StepCard({
  step,
  instance,
  assignee,
  subjectName,
  canAct = false,
  isLoading = false,
  onComplete,
  onApprove,
  onReject,
  onSkip,
  onOpenForm,
  variant = 'default',
  className,
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const status = instance?.status ?? 'pending';
  const statusCfg = statusConfig[status];
  const StepIcon = stepTypeIcons[step.type] || FileText;
  const isOverdue = instance?.dueDate && new Date(instance.dueDate) < new Date() && status !== 'completed';

  // Format date
  const formatDate = (date: string | null | undefined): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get initials
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        status === 'in_progress' && 'border-blue-200 bg-blue-50/50',
        status === 'completed' && 'border-green-200 bg-green-50/50',
        isOverdue && 'border-red-200 bg-red-50/50',
        className
      )}>
        <div className={cn(
          'p-2 rounded-lg',
          status === 'in_progress' ? 'bg-blue-100' : 'bg-muted'
        )}>
          <StepIcon className={cn('h-4 w-4', statusCfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{step.name}</p>
          {assignee && (
            <p className="text-xs text-muted-foreground truncate">
              {assignee.name}
            </p>
          )}
        </div>
        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        {canAct && status === 'in_progress' && (
          <Button size="sm" onClick={step.type === 'form' ? onOpenForm : onComplete} disabled={isLoading}>
            {step.type === 'form' ? 'Ouvrir' : 'Terminer'}
          </Button>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <Card className={cn(
      status === 'in_progress' && 'border-blue-200',
      isOverdue && 'border-red-200',
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              status === 'in_progress' ? 'bg-blue-100' : 'bg-muted'
            )}>
              <StepIcon className={cn('h-5 w-5', statusCfg.color)} />
            </div>
            <div>
              <CardTitle className="text-base">{step.name}</CardTitle>
              {step.description && (
                <CardDescription className="mt-1">{step.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                En retard
              </Badge>
            )}
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Meta info */}
        <div className="flex flex-wrap gap-4 text-sm">
          {/* Assignee */}
          {assignee && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{getInitials(assignee.name)}</AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                <User className="h-3 w-3 inline mr-1" />
                {assignee.name}
              </span>
            </div>
          )}

          {/* Subject */}
          {subjectName && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Pour: <span className="font-medium text-foreground">{subjectName}</span></span>
            </div>
          )}

          {/* Due date */}
          {instance?.dueDate && (
            <div className={cn(
              'flex items-center gap-1',
              isOverdue ? 'text-red-600' : 'text-muted-foreground'
            )}>
              <Calendar className="h-3 w-3" />
              Échéance: {formatDate(instance.dueDate)}
            </div>
          )}

          {/* Completed date */}
          {instance?.completedAt && status === 'completed' && (
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-3 w-3" />
              Terminé le {formatDate(instance.completedAt)}
            </div>
          )}
        </div>

        {/* Approval result */}
        {step.type === 'approval' && instance?.approvalStatus && (
          <div className={cn(
            'p-3 rounded-lg',
            instance.approvalStatus === 'approved' ? 'bg-green-50' : 'bg-red-50'
          )}>
            <div className="flex items-center gap-2">
              {instance.approvalStatus === 'approved' ? (
                <ThumbsUp className="h-4 w-4 text-green-600" />
              ) : (
                <ThumbsDown className="h-4 w-4 text-red-600" />
              )}
              <span className={cn(
                'font-medium',
                instance.approvalStatus === 'approved' ? 'text-green-700' : 'text-red-700'
              )}>
                {instance.approvalStatus === 'approved' ? 'Approuvé' : 'Rejeté'}
              </span>
            </div>
            {instance.approvalComment && (
              <p className="text-sm text-muted-foreground mt-2">
                {instance.approvalComment}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {canAct && status === 'in_progress' && (
          <div className="flex flex-wrap gap-2 pt-2">
            {step.type === 'form' && onOpenForm && (
              <Button onClick={onOpenForm} disabled={isLoading}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Ouvrir le formulaire
              </Button>
            )}

            {step.type === 'approval' && (
              <>
                <Button onClick={onApprove} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approuver
                </Button>
                <Button variant="destructive" onClick={onReject} disabled={isLoading}>
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Rejeter
                </Button>
              </>
            )}

            {step.type === 'review' && onComplete && (
              <Button onClick={onComplete} disabled={isLoading}>
                <Check className="mr-2 h-4 w-4" />
                Accusé de réception
              </Button>
            )}

            {(step.canSkip || step.isOptional) && onSkip && (
              <Button variant="outline" onClick={onSkip} disabled={isLoading}>
                <SkipForward className="mr-2 h-4 w-4" />
                Passer cette étape
              </Button>
            )}
          </div>
        )}

        {/* Expandable details */}
        {(step.approvalConfig || instance?.remindersSent) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Détails
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="text-sm text-muted-foreground space-y-1 p-3 bg-muted/50 rounded-lg">
                {step.approvalConfig?.requireComment && (
                  <p>Commentaire requis pour l&apos;approbation</p>
                )}
                {step.approvalConfig?.escalateAfterDays && (
                  <p>Escalade automatique après {step.approvalConfig.escalateAfterDays} jours</p>
                )}
                {instance?.remindersSent && instance.remindersSent > 0 && (
                  <p>{instance.remindersSent} rappel(s) envoyé(s)</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export default StepCard;
