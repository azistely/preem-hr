/**
 * EffectiveDatePicker Component
 *
 * Date picker with compliance validation
 * - Prevents backdating (cannot select dates in the past)
 * - Shows helper text about when changes take effect
 * - Integrates with React Hook Form
 */

'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { FormDescription, FormLabel } from '@/components/ui/form';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EffectiveDatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EffectiveDatePicker({
  value,
  onChange,
  minDate = new Date(), // Default: cannot backdate
  maxDate,
  label = 'À partir du',
  description = 'Les modifications prendront effet à cette date',
  required = true,
  disabled = false,
  className,
}: EffectiveDatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <FormLabel>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </FormLabel>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal min-h-[48px]',
              !value && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? (
              format(value, 'PPP', { locale: fr })
            ) : (
              <span>Sélectionner une date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
            locale={fr}
          />
        </PopoverContent>
      </Popover>

      {description && <FormDescription>{description}</FormDescription>}

      {minDate && !value && (
        <p className="text-xs text-muted-foreground">
          Date minimum:{' '}
          {format(minDate, 'PPP', { locale: fr })}
        </p>
      )}
    </div>
  );
}
