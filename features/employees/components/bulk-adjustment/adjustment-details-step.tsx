/**
 * Adjustment Details Step - Bulk Salary Adjustment Wizard
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AdjustmentDetailsStepProps {
  form: UseFormReturn<any>;
}

export function AdjustmentDetailsStep({ form }: AdjustmentDetailsStepProps) {
  const adjustmentType = form.watch('adjustmentType');

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nom de l'ajustement *</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Ex: Augmentation annuelle 2025"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormDescription>
              Un nom descriptif pour identifier cet ajustement
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description (optionnel)</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Détails additionnels..."
                className="min-h-[100px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="adjustmentType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Type d'ajustement *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="percentage">
                  Pourcentage (%)
                </SelectItem>
                <SelectItem value="fixed_amount">
                  Montant fixe (FCFA)
                </SelectItem>
                <SelectItem value="custom">
                  Personnalisé (par employé)
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              {adjustmentType === 'percentage' && 'Augmentation ou réduction en pourcentage du salaire actuel'}
              {adjustmentType === 'fixed_amount' && 'Ajout ou retrait d\'un montant fixe pour tous'}
              {adjustmentType === 'custom' && 'Définir un montant spécifique pour chaque employé'}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {(adjustmentType === 'percentage' || adjustmentType === 'fixed_amount') && (
        <FormField
          control={form.control}
          name="adjustmentValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {adjustmentType === 'percentage' ? 'Pourcentage (%)' : 'Montant (FCFA)'} *
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step={adjustmentType === 'percentage' ? '0.1' : '1000'}
                  min="0"
                  placeholder={adjustmentType === 'percentage' ? 'Ex: 5' : 'Ex: 25000'}
                  className="min-h-[48px]"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>
                {adjustmentType === 'percentage'
                  ? 'Entrez un nombre positif pour une augmentation, négatif pour une réduction'
                  : 'Montant qui sera ajouté au salaire de base'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="effectiveFrom"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date d'effet *</FormLabel>
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
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
            <FormDescription>
              La date à partir de laquelle les nouveaux salaires seront effectifs
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
