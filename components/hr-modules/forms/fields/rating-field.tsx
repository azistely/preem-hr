/**
 * Rating Field Component
 *
 * Star-based rating input for evaluations.
 * Supports 1-5 or 1-10 scales with labels.
 *
 * HCI Principles:
 * - Large touch targets (48px)
 * - Visual feedback on hover/select
 * - Accessible with keyboard navigation
 */

'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';

export interface RatingFieldProps {
  /** Field ID */
  id?: string;
  /** Current value */
  value?: number;
  /** Change handler */
  onChange?: (value: number) => void;
  /** Maximum rating (default 5) */
  max?: number;
  /** Field label */
  label?: string;
  /** Helper text */
  description?: string;
  /** Labels for each rating level */
  ratingLabels?: string[];
  /** Is required */
  required?: boolean;
  /** Is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show numeric value */
  showValue?: boolean;
  /** Allow half stars */
  allowHalf?: boolean;
  /** Additional className */
  className?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-9 w-9',
};

const buttonSizeClasses = {
  sm: 'min-w-[36px] min-h-[36px] p-1',
  md: 'min-w-[44px] min-h-[44px] p-1.5',
  lg: 'min-w-[52px] min-h-[52px] p-2',
};

export const RatingField = forwardRef<HTMLDivElement, RatingFieldProps>(
  function RatingField(
    {
      id,
      value = 0,
      onChange,
      max = 5,
      label,
      description,
      ratingLabels = [],
      required = false,
      disabled = false,
      error,
      size = 'md',
      showValue = true,
      className,
    },
    ref
  ) {
    const handleClick = (rating: number) => {
      if (!disabled && onChange) {
        // Toggle off if clicking same value
        onChange(rating === value ? 0 : rating);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent, rating: number) => {
      if (disabled) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(rating);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (value < max && onChange) {
          onChange(value + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (value > 0 && onChange) {
          onChange(value - 1);
        }
      }
    };

    const currentLabel = value > 0 && ratingLabels[value - 1];

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {label && (
          <Label htmlFor={id} className="text-base font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
          {Array.from({ length: max }, (_, i) => i + 1).map((rating) => {
            const isSelected = value >= rating;
            const ratingLabel = ratingLabels[rating - 1];

            return (
              <button
                key={rating}
                type="button"
                role="radio"
                aria-checked={value === rating}
                aria-label={ratingLabel || `${rating} sur ${max}`}
                disabled={disabled}
                onClick={() => handleClick(rating)}
                onKeyDown={(e) => handleKeyDown(e, rating)}
                className={cn(
                  'rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  buttonSizeClasses[size],
                  isSelected
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-muted-foreground/40 hover:text-amber-400',
                  disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <Star
                  className={cn(sizeClasses[size], isSelected && 'fill-current')}
                />
              </button>
            );
          })}

          {showValue && value > 0 && (
            <div className="ml-4 flex items-center gap-2">
              <span className="text-xl font-bold">
                {value}/{max}
              </span>
              {currentLabel && (
                <span className="text-muted-foreground">- {currentLabel}</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

export default RatingField;
