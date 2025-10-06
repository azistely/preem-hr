/**
 * Input Number Component
 *
 * For freeform salary components without legal bounds
 * Example: Custom bonus amounts, flexible allowances
 */

import { Input } from '@/components/ui/input';
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface InputNumberProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label: string;
  placeholder?: string;
  description?: string;
  min?: number;
  step?: number; // Default: 1000 FCFA
}

export function InputNumber({
  value,
  onChange,
  label,
  placeholder = "Ex: 50000",
  description,
  min = 0,
  step = 1000,
}: InputNumberProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={min}
            step={step}
            placeholder={placeholder}
            className="min-h-[48px]"
            onChange={(e) => onChange(parseFloat(e.target.value) || undefined)}
            value={value ?? ''}
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">FCFA</span>
        </div>
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}
