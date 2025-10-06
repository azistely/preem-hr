/**
 * Salary Info Step - Hire Wizard
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
import { useSalaryValidation, formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface SalaryInfoStepProps {
  form: UseFormReturn<any>;
}

export function SalaryInfoStep({ form }: SalaryInfoStepProps) {
  const baseSalary = form.watch('baseSalary');
  const housingAllowance = form.watch('housingAllowance') || 0;
  const transportAllowance = form.watch('transportAllowance') || 0;
  const mealAllowance = form.watch('mealAllowance') || 0;

  const { validationResult, minimumWage } = useSalaryValidation(baseSalary);

  const totalGross = baseSalary + housingAllowance + transportAllowance + mealAllowance;

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="baseSalary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Salaire de base *</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="number"
                min={minimumWage || 75000}
                step={1000}
                placeholder="300000"
                className="min-h-[48px]"
                onChange={(e) => field.onChange(parseFloat(e.target.value))}
              />
            </FormControl>
            <FormDescription>
              Minimum: {formatCurrency(minimumWage || 75000)} (SMIG)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {validationResult && !validationResult.isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationResult.errorMessage}</AlertDescription>
        </Alert>
      )}

      {validationResult && validationResult.isValid && baseSalary > 0 && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Salaire valide ({'>='} SMIG)
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-medium">Indemnités (optionnelles)</h3>

        <FormField
          control={form.control}
          name="housingAllowance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indemnité de logement</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="50000"
                  className="min-h-[48px]"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transportAllowance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indemnité de transport</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="25000"
                  className="min-h-[48px]"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mealAllowance"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indemnité de repas</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="15000"
                  className="min-h-[48px]"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {totalGross > 0 && (
        <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="font-medium">Salaire brut total</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(totalGross)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
