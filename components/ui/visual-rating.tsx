/**
 * Visual Rating Components
 *
 * Professional rating components for evaluations in factory contexts.
 * Designed for users with low literacy - uses colors and clear labels.
 *
 * Components:
 * - ColorBlockRating: Color-coded blocks (red/yellow/green)
 * - StarRating: 1-5 star rating with labels
 * - ProgressRating: Progress bar with percentage
 * - NumericScaleRating: Simple numeric scale with colors
 *
 * No emojis - uses professional French labels and color indicators.
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RatingLevel = 1 | 2 | 3 | 4 | 5;

export interface RatingOption {
  value: RatingLevel;
  label: string;
  description?: string;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
}

export interface VisualRatingProps {
  value?: RatingLevel;
  onChange?: (value: RatingLevel) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

// ============================================================================
// DEFAULT RATING OPTIONS (French labels, professional)
// ============================================================================

export const defaultRatingOptions: RatingOption[] = [
  {
    value: 1,
    label: 'Insuffisant',
    description: 'Performance tres en dessous des attentes',
    color: 'red',
  },
  {
    value: 2,
    label: 'A ameliorer',
    description: 'Performance en dessous des attentes',
    color: 'orange',
  },
  {
    value: 3,
    label: 'Satisfaisant',
    description: 'Performance conforme aux attentes',
    color: 'yellow',
  },
  {
    value: 4,
    label: 'Tres bien',
    description: 'Performance au-dessus des attentes',
    color: 'green',
  },
  {
    value: 5,
    label: 'Excellent',
    description: 'Performance exceptionnelle',
    color: 'blue',
  },
];

// Color mappings for Tailwind classes
const colorClasses = {
  red: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-100 dark:bg-red-950',
    border: 'border-red-500',
    text: 'text-red-700 dark:text-red-300',
    ring: 'ring-red-500',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-100 dark:bg-orange-950',
    border: 'border-orange-500',
    text: 'text-orange-700 dark:text-orange-300',
    ring: 'ring-orange-500',
  },
  yellow: {
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-100 dark:bg-yellow-950',
    border: 'border-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-300',
    ring: 'ring-yellow-500',
  },
  green: {
    bg: 'bg-green-500',
    bgLight: 'bg-green-100 dark:bg-green-950',
    border: 'border-green-500',
    text: 'text-green-700 dark:text-green-300',
    ring: 'ring-green-500',
  },
  blue: {
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100 dark:bg-blue-950',
    border: 'border-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-500',
  },
};

// Size mappings
const sizeClasses = {
  sm: {
    block: 'h-8 min-w-[60px] text-xs',
    star: 'h-4 w-4',
    container: 'gap-1',
    label: 'text-xs',
  },
  md: {
    block: 'h-12 min-w-[80px] text-sm',
    star: 'h-6 w-6',
    container: 'gap-2',
    label: 'text-sm',
  },
  lg: {
    block: 'h-16 min-w-[100px] text-base',
    star: 'h-8 w-8',
    container: 'gap-3',
    label: 'text-base',
  },
};

// ============================================================================
// COLOR BLOCK RATING
// ============================================================================

export interface ColorBlockRatingProps extends VisualRatingProps {
  options?: RatingOption[];
  showNumbers?: boolean;
}

/**
 * Color Block Rating Component
 *
 * Displays rating options as colored blocks with labels.
 * Touch-friendly with min 44px targets.
 *
 * @example
 * <ColorBlockRating value={3} onChange={setValue} />
 */
export function ColorBlockRating({
  value,
  onChange,
  options = defaultRatingOptions,
  disabled = false,
  size = 'md',
  showLabels = true,
  showNumbers = true,
  className,
}: ColorBlockRatingProps) {
  const sizes = sizeClasses[size];

  return (
    <div className={cn('flex flex-wrap', sizes.container, className)}>
      {options.map((option) => {
        const colors = colorClasses[option.color];
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange?.(option.value)}
            disabled={disabled}
            title={option.description}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 transition-all min-h-[44px]',
              sizes.block,
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-105',
              isSelected
                ? cn(colors.bgLight, colors.border, 'ring-2', colors.ring)
                : 'border-transparent bg-muted hover:bg-muted/80'
            )}
          >
            {showNumbers && (
              <span
                className={cn(
                  'font-bold',
                  isSelected ? colors.text : 'text-muted-foreground'
                )}
              >
                {option.value}
              </span>
            )}
            {showLabels && (
              <span
                className={cn(
                  sizes.label,
                  'font-medium text-center px-1',
                  isSelected ? colors.text : 'text-muted-foreground'
                )}
              >
                {option.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// STAR RATING
// ============================================================================

export interface StarRatingProps extends VisualRatingProps {
  max?: number;
  showHoverPreview?: boolean;
}

/**
 * Star Rating Component
 *
 * Classic 1-5 star rating with optional labels.
 *
 * @example
 * <StarRating value={4} onChange={setValue} />
 */
export function StarRating({
  value,
  onChange,
  max = 5,
  disabled = false,
  size = 'md',
  showLabels = true,
  showHoverPreview = true,
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const sizes = sizeClasses[size];
  const displayValue = showHoverPreview && hoverValue !== null ? hoverValue : value ?? 0;

  const getRatingLabel = (rating: number): string => {
    const option = defaultRatingOptions.find(o => o.value === rating);
    return option?.label ?? '';
  };

  return (
    <div className={cn('flex flex-col', className)}>
      <div className={cn('flex items-center', sizes.container)}>
        {Array.from({ length: max }, (_, i) => i + 1).map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => !disabled && onChange?.(rating as RatingLevel)}
            onMouseEnter={() => !disabled && setHoverValue(rating)}
            onMouseLeave={() => setHoverValue(null)}
            disabled={disabled}
            className={cn(
              'p-1 transition-transform min-h-[44px] min-w-[44px] flex items-center justify-center',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'
            )}
          >
            <Star
              className={cn(
                sizes.star,
                'transition-colors',
                rating <= displayValue
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>
      {showLabels && displayValue > 0 && (
        <span className={cn('mt-1', sizes.label, 'text-muted-foreground')}>
          {getRatingLabel(displayValue)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// PROGRESS RATING
// ============================================================================

export interface ProgressRatingProps {
  value?: number; // 0-100
  onChange?: (value: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  showLabel?: boolean;
  className?: string;
}

/**
 * Progress Rating Component
 *
 * Progress bar style rating from 0-100%.
 * Good for objective achievement scores.
 *
 * @example
 * <ProgressRating value={75} onChange={setValue} />
 */
export function ProgressRating({
  value = 0,
  onChange,
  disabled = false,
  size = 'md',
  showValue = true,
  showLabel = true,
  className,
}: ProgressRatingProps) {
  const sizes = sizeClasses[size];

  // Determine color based on value
  const getColorClass = (val: number): string => {
    if (val >= 90) return 'bg-blue-500';
    if (val >= 70) return 'bg-green-500';
    if (val >= 50) return 'bg-yellow-500';
    if (val >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getLabel = (val: number): string => {
    if (val >= 90) return 'Excellent';
    if (val >= 70) return 'Atteint';
    if (val >= 50) return 'Partiellement atteint';
    if (val >= 25) return 'En cours';
    return 'Non atteint';
  };

  const heightClass = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }[size];

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('relative w-full bg-muted rounded-full overflow-hidden', heightClass)}>
        <div
          className={cn('h-full transition-all duration-300', getColorClass(value))}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
        {!disabled && onChange && (
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        )}
      </div>
      {(showValue || showLabel) && (
        <div className={cn('flex items-center justify-between', sizes.label)}>
          {showLabel && (
            <span className="text-muted-foreground">{getLabel(value)}</span>
          )}
          {showValue && (
            <span className="font-medium">{value}%</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NUMERIC SCALE RATING
// ============================================================================

export interface NumericScaleRatingProps extends VisualRatingProps {
  min?: number;
  max?: number;
  step?: number;
  labels?: { value: number; label: string }[];
}

/**
 * Numeric Scale Rating Component
 *
 * Simple numeric scale (e.g., 1-10) with color indicators.
 * Good for NPS-style ratings or fine-grained scoring.
 *
 * @example
 * <NumericScaleRating value={7} max={10} onChange={setValue} />
 */
export function NumericScaleRating({
  value,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  disabled = false,
  size = 'md',
  showLabels = true,
  labels,
  className,
}: NumericScaleRatingProps) {
  const sizes = sizeClasses[size];
  const values: number[] = [];
  for (let i = min; i <= max; i += step) {
    values.push(i);
  }

  // Determine color based on position in scale
  const getColorClass = (val: number): string => {
    const position = (val - min) / (max - min);
    if (position <= 0.2) return 'bg-red-500';
    if (position <= 0.4) return 'bg-orange-500';
    if (position <= 0.6) return 'bg-yellow-500';
    if (position <= 0.8) return 'bg-green-500';
    return 'bg-blue-500';
  };

  const buttonSize = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }[size];

  return (
    <div className={cn('space-y-2', className)}>
      <div className={cn('flex flex-wrap', sizes.container)}>
        {values.map((num) => {
          const isSelected = value === num;
          const label = labels?.find(l => l.value === num)?.label;

          return (
            <div key={num} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => !disabled && onChange?.(num as RatingLevel)}
                disabled={disabled}
                className={cn(
                  'rounded-full border-2 font-medium transition-all min-h-[44px] min-w-[44px] flex items-center justify-center',
                  buttonSize,
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110',
                  isSelected
                    ? cn(getColorClass(num), 'border-transparent text-white')
                    : 'border-muted bg-background hover:bg-muted'
                )}
              >
                {num}
              </button>
              {showLabels && label && (
                <span className={cn('mt-1', sizes.label, 'text-muted-foreground text-center')}>
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// SIMPLE RATING DISPLAY (Read-only)
// ============================================================================

export interface RatingDisplayProps {
  value: number;
  max?: number;
  type?: 'stars' | 'blocks' | 'progress' | 'numeric';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

/**
 * Rating Display Component (Read-only)
 *
 * Displays a rating value in various formats.
 * For read-only display, not input.
 *
 * @example
 * <RatingDisplay value={4} type="stars" />
 */
export function RatingDisplay({
  value,
  max = 5,
  type = 'stars',
  size = 'md',
  showLabel = true,
  className,
}: RatingDisplayProps) {
  switch (type) {
    case 'stars':
      return (
        <StarRating
          value={value as RatingLevel}
          max={max}
          disabled
          size={size}
          showLabels={showLabel}
          showHoverPreview={false}
          className={className}
        />
      );

    case 'blocks':
      return (
        <ColorBlockRating
          value={value as RatingLevel}
          disabled
          size={size}
          showLabels={showLabel}
          className={className}
        />
      );

    case 'progress':
      return (
        <ProgressRating
          value={value}
          disabled
          size={size}
          showValue
          showLabel={showLabel}
          className={className}
        />
      );

    case 'numeric':
      return (
        <NumericScaleRating
          value={value as RatingLevel}
          max={max}
          disabled
          size={size}
          showLabels={showLabel}
          className={className}
        />
      );

    default:
      return null;
  }
}

// ============================================================================
// COMPACT RATING BADGE
// ============================================================================

export interface RatingBadgeProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Rating Badge Component
 *
 * Compact badge showing rating value with color indicator.
 * Good for tables and lists.
 *
 * @example
 * <RatingBadge value={4} />
 */
export function RatingBadge({
  value,
  max = 5,
  size = 'sm',
  className,
}: RatingBadgeProps) {
  const position = value / max;

  const getColorClass = (): string => {
    if (position <= 0.2) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
    if (position <= 0.4) return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200';
    if (position <= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200';
    if (position <= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
  };

  const sizeClass = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        sizeClass,
        getColorClass(),
        className
      )}
    >
      {value}/{max}
    </span>
  );
}

export default {
  ColorBlockRating,
  StarRating,
  ProgressRating,
  NumericScaleRating,
  RatingDisplay,
  RatingBadge,
};
