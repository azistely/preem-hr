/**
 * Banking Info Step - Hire Wizard
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

interface BankingInfoStepProps {
  form: UseFormReturn<any>;
}

export function BankingInfoStep({ form }: BankingInfoStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
        <p className="text-sm text-blue-800">
          Ces informations sont optionnelles mais recommandées pour le versement des salaires.
        </p>
      </div>

      <FormField
        control={form.control}
        name="bankName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nom de la banque</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Ex: Banque Atlantique, SGBCI, Ecobank"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="bankAccount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Numéro de compte bancaire</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="CI93 CI 001 01234567890123 45"
                className="min-h-[48px]"
              />
            </FormControl>
            <FormDescription>
              Format IBAN ou numéro de compte local
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="taxDependents"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre de personnes à charge</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                min={0}
                max={10}
                defaultValue={0}
                className="min-h-[48px]"
                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
              />
            </FormControl>
            <FormDescription>
              Utilisé pour le calcul des impôts (parts fiscales)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
