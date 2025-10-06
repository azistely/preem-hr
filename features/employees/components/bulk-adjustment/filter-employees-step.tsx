/**
 * Filter Employees Step - Bulk Salary Adjustment Wizard
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
import { Checkbox } from '@/components/ui/checkbox';
import { usePositions } from '@/features/employees/hooks/use-positions';
import { useEmployees } from '@/features/employees/hooks/use-employees';

interface FilterEmployeesStepProps {
  form: UseFormReturn<any>;
}

export function FilterEmployeesStep({ form }: FilterEmployeesStepProps) {
  const { data: positions } = usePositions('active');
  const { data: employeesData } = useEmployees({ status: 'active' });
  const employees = employeesData?.employees || [];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          💡 <strong>Astuce:</strong> Laissez tous les filtres vides pour appliquer l'ajustement à tous les employés actifs
        </p>
      </div>

      <FormField
        control={form.control}
        name="filters.positionIds"
        render={() => (
          <FormItem>
            <FormLabel>Filtrer par poste</FormLabel>
            <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
              {positions && positions.length > 0 ? (
                positions.map((position: any) => (
                  <FormField
                    key={position.id}
                    control={form.control}
                    name="filters.positionIds"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={position.id}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(position.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), position.id])
                                  : field.onChange(
                                      field.value?.filter((value: string) => value !== position.id)
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {position.title}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun poste disponible</p>
              )}
            </div>
            <FormDescription>
              Sélectionnez les postes concernés (ou laissez vide pour tous)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="filters.minSalary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Salaire minimum (FCFA)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="10000"
                  placeholder="Ex: 100000"
                  className="min-h-[48px]"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                />
              </FormControl>
              <FormDescription>
                Inclure uniquement les salaires ≥
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="filters.maxSalary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Salaire maximum (FCFA)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  step="10000"
                  placeholder="Ex: 500000"
                  className="min-h-[48px]"
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                />
              </FormControl>
              <FormDescription>
                Inclure uniquement les salaires ≤
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Employés qui seront affectés</p>
            <p className="text-sm text-muted-foreground mt-1">
              Basé sur les filtres sélectionnés ci-dessus
            </p>
          </div>
          <div className="text-3xl font-bold text-primary">
            {employees.length}
          </div>
        </div>
      </div>
    </div>
  );
}
