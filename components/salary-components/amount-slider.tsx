/**
 * Amount Slider Component
 *
 * For configurable salary components with legal amount bounds (in FCFA)
 * Example: Transport allowance (0-30,000 FCFA)
 */

import { Slider } from '@/components/ui/slider';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface AmountSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  recommended: number;
  label: string;
  description?: string;
  legalReference?: string;
  step?: number; // Default: 5000 FCFA
}

export function AmountSlider({
  value,
  onChange,
  min,
  max,
  recommended,
  label,
  description,
  legalReference,
  step = 5000,
}: AmountSliderProps) {
  const currentAmount = value || recommended;

  return (
    <FormItem>
      <FormLabel className="flex items-center justify-between">
        <span>{label}</span>
        <span className="text-2xl font-bold text-primary">
          {currentAmount.toLocaleString('fr-FR')} FCFA
        </span>
      </FormLabel>
      <FormControl>
        <div className="space-y-4 pt-2">
          <Slider
            min={min}
            max={max}
            step={step}
            value={[currentAmount]}
            onValueChange={(values) => onChange(values[0])}
            className="py-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {min.toLocaleString('fr-FR')} FCFA</span>
            <span className="text-primary font-medium">
              Recommandé: {recommended.toLocaleString('fr-FR')} FCFA
            </span>
            <span>Max: {max.toLocaleString('fr-FR')} FCFA</span>
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
