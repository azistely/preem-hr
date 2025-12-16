/**
 * Pending Evaluations Card Component
 *
 * Displays a list of pending training evaluations for the current user.
 * Shows Kirkpatrick level, course info, and due dates.
 */

'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ClipboardCheck,
  AlertCircle,
  Clock,
  Calendar,
  ChevronRight,
  Smile,
  BookOpen,
  Briefcase,
  BarChart3,
} from 'lucide-react';
import { EvaluationDialog } from './evaluation-form';
import type { KirkpatrickLevel } from '@/features/training/types/evaluation.types';

// Level icons
const levelIcons: Record<KirkpatrickLevel, React.ReactNode> = {
  1: <Smile className="h-4 w-4" />,
  2: <BookOpen className="h-4 w-4" />,
  3: <Briefcase className="h-4 w-4" />,
  4: <BarChart3 className="h-4 w-4" />,
};

// Level names
const levelNames: Record<KirkpatrickLevel, string> = {
  1: 'Réaction',
  2: 'Apprentissage',
  3: 'Comportement',
  4: 'Résultats',
};

// Level colors
const levelColors: Record<KirkpatrickLevel, string> = {
  1: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  2: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  4: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

interface PendingEvaluation {
  id: string;
  level: number;
  dueDate: string | null;
  enrollmentId: string;
  sessionId: string;
  sessionCode: string;
  courseName: string;
  courseCategory: string;
  completedAt: Date | null;
}

export function PendingEvaluationsCard() {
  const [selectedEvaluation, setSelectedEvaluation] = useState<PendingEvaluation | null>(null);

  const { data: evaluations, isLoading, error } = api.training.evaluations.getPending.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Erreur de chargement des évaluations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Aucune évaluation en attente
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const urgentCount = evaluations.filter(e => e.dueDate && isPast(new Date(e.dueDate))).length;
  const dueTodayCount = evaluations.filter(e => e.dueDate && isToday(new Date(e.dueDate))).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Évaluations à compléter
              </CardTitle>
              <CardDescription>
                {evaluations.length} évaluation{evaluations.length > 1 ? 's' : ''} en attente
              </CardDescription>
            </div>
            {(urgentCount > 0 || dueTodayCount > 0) && (
              <Badge variant="destructive">
                {urgentCount > 0 ? `${urgentCount} en retard` : `${dueTodayCount} aujourd'hui`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {evaluations.map((evaluation) => (
            <EvaluationItem
              key={evaluation.id}
              evaluation={evaluation}
              onClick={() => setSelectedEvaluation(evaluation)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Evaluation Dialog */}
      {selectedEvaluation && (
        <EvaluationDialog
          open={!!selectedEvaluation}
          onOpenChange={(open) => !open && setSelectedEvaluation(null)}
          evaluation={{
            id: selectedEvaluation.id,
            enrollmentId: selectedEvaluation.enrollmentId,
            level: selectedEvaluation.level,
            courseName: selectedEvaluation.courseName,
            sessionCode: selectedEvaluation.sessionCode,
          }}
          onSuccess={() => setSelectedEvaluation(null)}
        />
      )}
    </>
  );
}

interface EvaluationItemProps {
  evaluation: PendingEvaluation;
  onClick: () => void;
}

function EvaluationItem({ evaluation, onClick }: EvaluationItemProps) {
  const level = evaluation.level as KirkpatrickLevel;
  const isOverdue = evaluation.dueDate && isPast(new Date(evaluation.dueDate));
  const isDueToday = evaluation.dueDate && isToday(new Date(evaluation.dueDate));

  return (
    <button
      onClick={onClick}
      className="w-full p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Course name */}
          <p className="font-medium truncate">{evaluation.courseName}</p>

          {/* Session info */}
          <p className="text-sm text-muted-foreground mt-0.5">
            Session {evaluation.sessionCode}
          </p>

          {/* Level badge and due date */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge className={levelColors[level]} variant="secondary">
              {levelIcons[level]}
              <span className="ml-1.5">Niveau {level}: {levelNames[level]}</span>
            </Badge>

            {evaluation.dueDate && (
              <span className={`text-xs flex items-center gap-1 ${
                isOverdue
                  ? 'text-destructive font-medium'
                  : isDueToday
                    ? 'text-yellow-600 font-medium'
                    : 'text-muted-foreground'
              }`}>
                {isOverdue ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {isOverdue
                  ? `En retard (${formatDistanceToNow(new Date(evaluation.dueDate), { locale: fr, addSuffix: false })})`
                  : isDueToday
                    ? "Aujourd'hui"
                    : `Échéance ${format(new Date(evaluation.dueDate), 'dd MMM', { locale: fr })}`
                }
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </div>
    </button>
  );
}

// =============================================================================
// COMPACT VERSION FOR DASHBOARD
// =============================================================================

export function PendingEvaluationsCompact() {
  const { data: evaluations, isLoading } = api.training.evaluations.getPending.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (!evaluations || evaluations.length === 0) {
    return null;
  }

  const urgentCount = evaluations.filter(e => e.dueDate && isPast(new Date(e.dueDate))).length;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      urgentCount > 0 ? 'border-destructive bg-destructive/5' : 'border-primary bg-primary/5'
    }`}>
      <div className={`p-2 rounded-full ${
        urgentCount > 0 ? 'bg-destructive/10' : 'bg-primary/10'
      }`}>
        <ClipboardCheck className={`h-5 w-5 ${
          urgentCount > 0 ? 'text-destructive' : 'text-primary'
        }`} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">
          {evaluations.length} évaluation{evaluations.length > 1 ? 's' : ''} à compléter
        </p>
        {urgentCount > 0 && (
          <p className="text-xs text-destructive">
            {urgentCount} en retard
          </p>
        )}
      </div>
    </div>
  );
}
