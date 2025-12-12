/**
 * Gap Analysis Card Component
 *
 * Shows individual competency gaps with visual indicators.
 * Provides quick overview of competency development needs.
 *
 * Features:
 * - Visual gap indicator (progress bar style)
 * - Color-coded status
 * - Training recommendations link
 * - Expandable details
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  GraduationCap,
  Target,
  AlertTriangle,
} from 'lucide-react';

// Gap data type
export interface CompetencyGap {
  id: string;
  name: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  lastAssessedAt?: string;
  recommendedTrainings?: Array<{
    id: string;
    name: string;
    duration?: string;
  }>;
}

// Component props
interface GapAnalysisCardProps {
  /** Card title */
  title?: string;
  /** Card description */
  description?: string;
  /** Gap data */
  gaps: CompetencyGap[];
  /** Max scale value (default: 5) */
  maxScale?: number;
  /** Show only gaps below target */
  showOnlyGaps?: boolean;
  /** Callback when clicking on training */
  onTrainingClick?: (trainingId: string) => void;
  /** Custom class name */
  className?: string;
}

// Proficiency labels
const proficiencyLabels: Record<number, string> = {
  1: 'Débutant',
  2: 'Intermédiaire',
  3: 'Confirmé',
  4: 'Expert',
  5: 'Maître',
};

// Gap status helper
function getGapStatus(current: number, target: number): {
  status: 'below' | 'at' | 'above';
  label: string;
  variant: 'destructive' | 'outline' | 'default';
  icon: React.ComponentType<{ className?: string }>;
  color: string;
} {
  const gap = target - current;

  if (gap > 0) {
    return {
      status: 'below',
      label: gap === 1 ? '1 niveau manquant' : `${gap} niveaux manquants`,
      variant: 'destructive',
      icon: TrendingDown,
      color: 'text-red-600',
    };
  } else if (gap < 0) {
    return {
      status: 'above',
      label: 'Au-dessus de la cible',
      variant: 'default',
      icon: TrendingUp,
      color: 'text-green-600',
    };
  }

  return {
    status: 'at',
    label: 'À la cible',
    variant: 'outline',
    icon: Minus,
    color: 'text-muted-foreground',
  };
}

// Single gap row component
function GapRow({
  gap,
  maxScale,
  onTrainingClick,
}: {
  gap: CompetencyGap;
  maxScale: number;
  onTrainingClick?: (trainingId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getGapStatus(gap.currentLevel, gap.targetLevel);
  const StatusIcon = status.icon;

  const progressPercent = (gap.currentLevel / maxScale) * 100;
  const targetPercent = (gap.targetLevel / maxScale) * 100;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={cn(
        'p-3 rounded-lg border transition-colors',
        status.status === 'below' && 'border-red-200 bg-red-50/50',
        status.status === 'at' && 'border-border',
        status.status === 'above' && 'border-green-200 bg-green-50/50',
      )}>
        {/* Main row */}
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <div className={cn(
            'p-1.5 rounded-full',
            status.status === 'below' && 'bg-red-100',
            status.status === 'at' && 'bg-muted',
            status.status === 'above' && 'bg-green-100',
          )}>
            <StatusIcon className={cn('h-4 w-4', status.color)} />
          </div>

          {/* Competency info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{gap.name}</p>
              <Badge variant="outline" className="text-xs shrink-0">
                {gap.category}
              </Badge>
            </div>

            {/* Progress visualization */}
            <div className="mt-2 relative">
              <Progress value={progressPercent} className="h-2" />
              {/* Target marker */}
              <div
                className="absolute top-0 h-2 w-0.5 bg-foreground/70"
                style={{ left: `${targetPercent}%` }}
              />
            </div>

            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>
                Actuel: <span className="font-medium text-foreground">{gap.currentLevel}</span> ({proficiencyLabels[gap.currentLevel]})
              </span>
              <span>
                Cible: <span className="font-medium text-foreground">{gap.targetLevel}</span>
              </span>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant={status.variant} className="shrink-0">
            {status.label}
          </Badge>

          {/* Expand button if has recommendations */}
          {gap.recommendedTrainings && gap.recommendedTrainings.length > 0 && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expanded content - Training recommendations */}
        <CollapsibleContent>
          {gap.recommendedTrainings && gap.recommendedTrainings.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                Formations recommandées
              </p>
              <div className="space-y-2">
                {gap.recommendedTrainings.map((training) => (
                  <Button
                    key={training.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => onTrainingClick?.(training.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{training.name}</p>
                      {training.duration && (
                        <p className="text-xs text-muted-foreground">{training.duration}</p>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function GapAnalysisCard({
  title = 'Analyse des écarts',
  description,
  gaps,
  maxScale = 5,
  showOnlyGaps = false,
  onTrainingClick,
  className,
}: GapAnalysisCardProps) {
  // Filter gaps if needed
  const filteredGaps = showOnlyGaps
    ? gaps.filter(g => g.currentLevel < g.targetLevel)
    : gaps;

  // Sort by gap size (largest gaps first)
  const sortedGaps = [...filteredGaps].sort((a, b) => {
    const gapA = a.targetLevel - a.currentLevel;
    const gapB = b.targetLevel - b.currentLevel;
    return gapB - gapA;
  });

  // Calculate summary
  const summary = {
    total: gaps.length,
    below: gaps.filter(g => g.currentLevel < g.targetLevel).length,
    at: gaps.filter(g => g.currentLevel === g.targetLevel).length,
    above: gaps.filter(g => g.currentLevel > g.targetLevel).length,
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>

          {/* Summary badges */}
          <div className="flex gap-2">
            {summary.below > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {summary.below} à développer
              </Badge>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-3 pt-3 border-t text-sm">
          <div className="flex items-center gap-1">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <span className="text-muted-foreground">{summary.below} sous</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{summary.at} à la cible</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">{summary.above} au-dessus</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sortedGaps.length === 0 ? (
          <div className="py-8 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {showOnlyGaps
                ? 'Toutes les compétences sont à la cible ou au-dessus !'
                : 'Aucune compétence évaluée'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedGaps.map((gap) => (
              <GapRow
                key={gap.id}
                gap={gap}
                maxScale={maxScale}
                onTrainingClick={onTrainingClick}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GapAnalysisCard;
