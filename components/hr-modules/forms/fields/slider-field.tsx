/**
 * Slider Field Component
 *
 * Range slider input for numeric values.
 * Supports min/max/step with optional labels.
 *
 * HCI Principles:
 * - Large touch area for mobile
 * - Clear visual feedback
 * - Optional step markers
 */

'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export interface SliderFieldProps {
  /** Field ID */
  id?: string;
  /** Current value */
  value?: number;
  /** Change handler */
  onChange?: (value: number) => void;
  /** Minimum value (default 0) */
  min?: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Step increment (default 1) */
  step?: number;
  /** Field label */
  label?: string;
  /** Helper text */
  description?: string;
  /** Is required */
  required?: boolean;
  /** Is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Unit suffix (e.g., "%", "FCFA", "jours") */
  unit?: string;
  /** Show current value */
  showValue?: boolean;
  /** Show min/max labels */
  showMinMax?: boolean;
  /** Custom labels for specific values */
  valueLabels?: Record<number, string>;
  /** Additional className */
  className?: string;
}

export const SliderField = forwardRef<HTMLDivElement, SliderFieldProps>(
  function SliderField(
    {
      id,
      value = 0,
      onChange,
      min = 0,
      max = 100,
      step = 1,
      label,
      description,
      required = false,
      disabled = false,
      error,
      unit = '',
      showValue = true,
      showMinMax = true,
      valueLabels,
      className,
    },
    ref
  ) {
    const handleChange = (values: number[]) => {
      if (!disabled && onChange) {
        onChange(values[0]);
      }
    };

    // Get label for current value if custom labels are provided
    const currentLabel = valueLabels?.[value];

    // Format value with unit
    const formatValue = (val: number) => {
      if (valueLabels?.[val]) {
        return valueLabels[val];
      }
      return unit ? `${val} ${unit}` : val.toString();
    };

    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        {(label || showValue) && (
          <div className="flex items-center justify-between">
            {label && (
              <Label htmlFor={id} className="text-base font-medium">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </Label>
            )}
            {showValue && (
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{formatValue(value)}</span>
                {currentLabel && !valueLabels?.[value] && (
                  <span className="text-muted-foreground">- {currentLabel}</span>
                )}
              </div>
            )}
          </div>
        )}

        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        <div className="space-y-2">
          <Slider
            id={id}
            value={[value]}
            onValueChange={handleChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={cn(
              'py-2',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          />

          {showMinMax && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatValue(min)}</span>
              <span>{formatValue(max)}</span>
            </div>
          )}
        </div>

        {/* Step markers for small ranges */}
        {max - min <= 10 && valueLabels && (
          <div className="flex justify-between px-1">
            {Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => {
              const val = min + i * step;
              const isSelected = val === value;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => !disabled && onChange?.(val)}
                  className={cn(
                    'min-w-[36px] min-h-[36px] px-2 py-1 rounded-lg text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {valueLabels[val] || val}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

export default SliderField;
