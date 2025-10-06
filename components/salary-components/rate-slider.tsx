/**
 * Rate Slider Component
 *
 * For configurable salary components with legal percentage bounds
 * Example: Housing allowance (20-30% of base salary)
 */

import { Slider } from '@/components/ui/slider';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface RateSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number; // As decimal (e.g., 0.20 for 20%)
  max: number; // As decimal (e.g., 0.30 for 30%)
  recommended: number; // As decimal (e.g., 0.25 for 25%)
  label: string;
  description?: string;
  legalReference?: string;
  step?: number; // Default: 1% (0.01)
}

export function RateSlider({
  value,
  onChange,
  min,
  max,
  recommended,
  label,
  description,
  legalReference,
  step = 0.01,
}: RateSliderProps) {
  const currentRate = value || recommended;

  return (
    <FormItem>
      <FormLabel className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-2xl font-bold text-primary">
          {Math.round(currentRate * 100)}%
        </span>
      </FormLabel>
      <FormControl>
        <div className="space-y-4 pt-2">
          <Slider
            min={min * 100}
            max={max * 100}
            step={step * 100}
            value={[currentRate * 100]}
            onValueChange={(values) => onChange(values[0] / 100)}
            className="py-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {Math.round(min * 100)}%</span>
            <span className="text-primary font-medium">
              Recommandé: {Math.round(recommended * 100)}%
            </span>
            <span>Max: {Math.round(max * 100)}%</span>
          </div>
        </div>
      </FormControl>
      {description && (
        <FormDescription>
          {description}
          {legalReference && (
            <span className="block text-xs mt-1 text-muted-foreground">
              📜 {legalReference}
            </span>
          )}
        </FormDescription>
      )}
      <FormMessage />
    </FormItem>
  );
}
