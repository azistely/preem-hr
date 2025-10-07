/**
 * Employment Info Step - Hire Wizard
 */

import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePositions } from '@/features/employees/hooks/use-positions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CoefficientSelector } from '@/components/employees/coefficient-selector';

interface EmploymentInfoStepProps {
  form: UseFormReturn<any>;
}

export function EmploymentInfoStep({ form }: EmploymentInfoStepProps) {
  const { data: positions, isLoading } = usePositions('active');
  const countryCode = 'CI'; // TODO: Get from tenant context

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="hireDate"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date d'embauche *</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      'min-h-[48px] pl-3 text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                  >
                    {field.value ? (
                      format(field.value, 'PPP', { locale: fr })
                    ) : (
                      <span>Sélectionner une date</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
            <FormDescription>
              Habituellement le premier jour de travail
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="positionId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Poste *</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              disabled={isLoading || !positions || positions.length === 0}
            >
              <FormControl>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder={
                    isLoading
                      ? "Chargement..."
                      : !positions || positions.length === 0
                      ? "Aucun poste disponible"
                      : "Sélectionner un poste"
                  } />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {positions?.map((position: any) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.title}
                    {position.department && ` - ${position.department}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              {!positions || positions.length === 0 ? (
                <span className="text-destructive">
                  Aucun poste disponible. Veuillez d'abord{' '}
                  <a href="/positions/new" className="underline font-medium">
                    créer un poste
                  </a>.
                </span>
              ) : (
                'Le poste que l\'employé occupera'
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="coefficient"
        render={({ field }) => (
          <FormItem>
            <CoefficientSelector
              countryCode={countryCode}
              value={field.value}
              onChange={field.onChange}
              showExamples={true}
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
