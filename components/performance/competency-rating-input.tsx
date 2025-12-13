/**
 * CompetencyRatingInput Component
 *
 * Scale-aware rating input for competency evaluation.
 * Supports different scale types (1-3, 1-5, 1-10, percentage, etc.)
 * and displays level labels based on the competency's proficiency levels.
 *
 * Features:
 * - Dynamic scale rendering based on proficiencyLevels
 * - Shows self-rating for manager evaluations
 * - Displays required level indicator
 * - Optional comment field
 * - Critical competency badge
 *
 * HCI Principles:
 * - Touch-friendly buttons (min 44px)
 * - Clear visual feedback for selection
 * - Progressive disclosure (comment is optional)
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { User, ChevronDown, AlertCircle, Target, Info } from 'lucide-react';
import type { ProficiencyLevel } from '@/lib/constants/competency-scales';

export interface CompetencyRatingValue {
  rating: number;
  comment: string;
}

export interface CompetencyRatingInputProps {
  /** Competency details */
  competency: {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
  };
  /** Proficiency levels for this competency (resolved from competency or tenant default) */
  proficiencyLevels: ProficiencyLevel[];
  /** Required level from position mapping */
  requiredLevel: number;
  /** Is this a critical competency? */
  isCritical: boolean;
  /** Current rating value */
  value?: CompetencyRatingValue;
  /** Self-rating (shown for manager evaluations) */
  selfRating?: number | null;
  /** Callback when rating changes */
  onChange: (value: CompetencyRatingValue) => void;
  /** Evaluation type (affects display) */
  evaluationType: 'self' | 'manager';
  /** Is the input disabled? */
  disabled?: boolean;
  /** Is this a percentage scale? */
  isPercentageScale?: boolean;
}

/**
 * Determine rating status for visual feedback
 */
function getRatingStatus(rating: number, requiredLevel: number, maxLevel: number) {
  // Normalize both to percentage for comparison
  const normalizedRating = (rating / maxLevel) * 100;
  const normalizedRequired = (requiredLevel / maxLevel) * 100;

  if (normalizedRating >= normalizedRequired) {
    return 'meets'; // Meets or exceeds expectations
  }
  if (normalizedRating >= normalizedRequired * 0.7) {
    return 'close'; // Within 30% of required
  }
  return 'below'; // Significantly below required
}

export function CompetencyRatingInput({
  competency,
  proficiencyLevels,
  requiredLevel,
  isCritical,
  value,
  selfRating,
  onChange,
  evaluationType,
  disabled = false,
  isPercentageScale = false,
}: CompetencyRatingInputProps) {
  const [showComment, setShowComment] = useState(!!value?.comment);

  const maxLevel = isPercentageScale
    ? 100
    : Math.max(...proficiencyLevels.map((l) => l.level));

  const currentRating = value?.rating ?? 0;
  const currentComment = value?.comment ?? '';

  const handleRatingChange = (newRating: number) => {
    onChange({
      rating: newRating,
      comment: currentComment,
    });
  };

  const handleCommentChange = (newComment: string) => {
    onChange({
      rating: currentRating,
      comment: newComment,
    });
  };

  // Find current level info
  const currentLevelInfo = proficiencyLevels.find((l) => l.level === currentRating);
  const requiredLevelInfo = proficiencyLevels.find((l) => l.level === requiredLevel);

  // Determine status for visual feedback
  const status = currentRating > 0 ? getRatingStatus(currentRating, requiredLevel, maxLevel) : null;

  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-3 transition-colors',
        isCritical && 'border-orange-300 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/30',
        status === 'meets' && 'border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/20',
        status === 'below' && 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-base">{competency.name}</h4>
            {isCritical && (
              <Badge variant="destructive" className="text-xs gap-1">
                <AlertCircle className="h-3 w-3" />
                Critique
              </Badge>
            )}
            {competency.category && (
              <Badge variant="outline" className="text-xs">
                {competency.category}
              </Badge>
            )}
          </div>
          {competency.description && (
            <p className="text-sm text-muted-foreground mt-1">{competency.description}</p>
          )}

          {/* Required level indicator */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>
              Niveau attendu:{' '}
              <span className="font-medium text-foreground">
                {requiredLevelInfo?.name ?? `${requiredLevel}/${maxLevel}`}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Rating Input */}
      <div className="space-y-2">
        {isPercentageScale ? (
          // Percentage slider
          <div className="space-y-2">
            <Slider
              value={[currentRating]}
              onValueChange={([val]) => handleRatingChange(val)}
              max={100}
              step={5}
              disabled={disabled}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="font-medium text-foreground text-lg">{currentRating}%</span>
              <span>100%</span>
            </div>
          </div>
        ) : (
          // Discrete level buttons
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              {proficiencyLevels.map((level) => {
                const isSelected = currentRating === level.level;
                const isRequired = level.level === requiredLevel;

                return (
                  <Tooltip key={level.level}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleRatingChange(level.level)}
                        disabled={disabled}
                        className={cn(
                          'min-h-[44px] min-w-[44px] px-3 relative',
                          isRequired && !isSelected && 'border-primary border-dashed',
                          isSelected && 'ring-2 ring-offset-1'
                        )}
                      >
                        <span className="font-medium">{level.level}</span>
                        {isRequired && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="font-medium">{level.name}</p>
                      <p className="text-xs text-muted-foreground">{level.description}</p>
                      {level.behaviors && level.behaviors.length > 0 && (
                        <ul className="text-xs mt-1 space-y-0.5">
                          {level.behaviors.slice(0, 2).map((b, i) => (
                            <li key={i} className="text-muted-foreground">
                              • {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        )}

        {/* Selected level display */}
        {currentRating > 0 && currentLevelInfo && !isPercentageScale && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Niveau sélectionné:</span>
            <Badge
              variant={status === 'meets' ? 'default' : status === 'close' ? 'secondary' : 'destructive'}
            >
              {currentLevelInfo.name}
            </Badge>
          </div>
        )}

        {/* Self-rating comparison (for manager evaluations) */}
        {evaluationType === 'manager' && selfRating !== null && selfRating !== undefined && (
          <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-md">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-700 dark:text-blue-300">
              Auto-évaluation de l'employé:{' '}
              <span className="font-medium">
                {isPercentageScale
                  ? `${selfRating}%`
                  : proficiencyLevels.find((l) => l.level === selfRating)?.name ?? `${selfRating}/${maxLevel}`}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Comment (collapsible) */}
      <Collapsible open={showComment} onOpenChange={setShowComment}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showComment && 'rotate-180')}
            />
            {showComment ? 'Masquer le commentaire' : 'Ajouter un commentaire'}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Textarea
            placeholder={
              evaluationType === 'self'
                ? 'Décrivez votre niveau de maîtrise et vos réalisations...'
                : "Commentez le niveau de maîtrise de l'employé..."
            }
            value={currentComment}
            onChange={(e) => handleCommentChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className="resize-none"
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
