/**
 * Effective Date Picker Component
 *
 * Date picker for effective dating (when policy change takes effect)
 * Prevents backdating and shows smart default (tomorrow)
 *
 * Usage:
 * <EffectiveDatePicker
 *   value={effectiveFrom}
 *   onChange={setEffectiveFrom}
 *   label="À partir du"
 * />
 */

'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormDescription } from '@/components/ui/form';
import { Calendar as CalendarIcon, Info } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EffectiveDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  label?: string;
  description?: string;
  minDate?: Date;
  className?: string;
  required?: boolean;
}

export function EffectiveDatePicker({
  value,
  onChange,
  label = 'Date de prise deffet',
  description = 'Cette modification prendra effet à partir de cette date',
  minDate,
  className,
  required = true,
}: EffectiveDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Default minimum date: today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const effectiveMinDate = minDate || today;

  // Smart default: tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full min-h-[48px] justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? (
              format(value, 'PPP', { locale: fr })
            ) : (
              <span>Sélectionnez une date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setIsOpen(false);
            }}
            disabled={(date) => date < effectiveMinDate}
            initialFocus
            locale={fr}
          />

          {/* Quick actions */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onChange(today);
                  setIsOpen(false);
                }}
              >
                Aujourdhui
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onChange(tomorrow);
                  setIsOpen(false);
                }}
              >
                Demain
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {description && (
        <FormDescription className="flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <span>{description}</span>
        </FormDescription>
      )}

      {value && value < today && (
        <p className="text-sm text-destructive">
          ⚠️ La date ne peut pas être dans le passé
        </p>
      )}
    </div>
  );
}
