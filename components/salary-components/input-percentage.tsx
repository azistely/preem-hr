/**
 * Input Percentage Component
 *
 * For freeform percentage fields without legal bounds
 * Example: Custom commission rates, flexible deduction percentages
 */

import { Input } from '@/components/ui/input';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface InputPercentageProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label: string;
  placeholder?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function InputPercentage({
  value,
  onChange,
  label,
  placeholder = "Ex: 15",
  description,
  min = 0,
  max = 100,
  step = 0.5,
}: InputPercentageProps) {
  // Display as percentage (0-100) but store as decimal (0-1)
  const displayValue = value !== undefined ? value * 100 : '';

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            className="min-h-[48px]"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onChange(isNaN(val) ? undefined : val / 100);
            }}
            value={displayValue}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}
