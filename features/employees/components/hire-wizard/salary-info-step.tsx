/**
 * Salary Info Step - Hire Wizard
 */

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { useSalaryValidation, formatCurrency } from '@/features/employees/hooks/use-salary-validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Plus, Sparkles, Info, Settings2, X } from 'lucide-react';
import { usePopularTemplates, useCustomComponents } from '@/features/employees/hooks/use-salary-components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SalaryComponentTemplate, CustomSalaryComponent } from '@/features/employees/types/salary-components';

interface SalaryInfoStepProps {
  form: UseFormReturn<any>;
}

export function SalaryInfoStep({ form }: SalaryInfoStepProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const baseSalary = form.watch('baseSalary');
  const housingAllowance = form.watch('housingAllowance') || 0;
  const transportAllowance = form.watch('transportAllowance') || 0;
  const mealAllowance = form.watch('mealAllowance') || 0;
  const otherAllowances = form.watch('otherAllowances') || [];

  const countryCode = 'CI'; // TODO: Get from tenant context

  const { data: templates, isLoading: loadingTemplates } = usePopularTemplates(countryCode);
  const { data: customComponents, isLoading: loadingCustom } = useCustomComponents();

  const { validationResult, minimumWage } = useSalaryValidation(baseSalary);

  const totalOtherAllowances = otherAllowances.reduce(
    (sum: number, allowance: any) => sum + (allowance.amount || 0),
    0
  );

  const totalGross =
    baseSalary +
    housingAllowance +
    transportAllowance +
    mealAllowance +
    totalOtherAllowances;

  const handleAddComponent = (
    component: SalaryComponentTemplate | CustomSalaryComponent,
    suggestedAmount: number
  ) => {
    const name =
      'name' in component && typeof component.name === 'object'
        ? (component.name as Record<string, string>).fr
        : typeof component.name === 'string'
        ? component.name
        : 'Indemnité';

    const currentAllowances = form.getValues('otherAllowances') || [];
    form.setValue('otherAllowances', [
      ...currentAllowances,
      {
        name,
        amount: suggestedAmount,
        taxable: true,
      },
    ]);
    setShowTemplates(false);
  };

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
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Indemnités (optionnelles)</h3>
          <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Ajouter une indemnité
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter une indemnité</DialogTitle>
                <DialogDescription>
                  Sélectionnez parmi les modèles populaires ou vos composants personnalisés
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Popular Templates */}
                {templates && templates.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Modèles populaires
                    </h4>
                    <div className="grid gap-2">
                      {templates.map((template) => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() =>
                            handleAddComponent(
                              template,
                              parseFloat(template.suggestedAmount || '10000')
                            )
                          }
                        >
                          <CardHeader className="py-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-sm">
                                  {(template.name as Record<string, string>).fr}
                                </CardTitle>
                                {template.description && (
                                  <CardDescription className="text-xs mt-1">
                                    {template.description}
                                  </CardDescription>
                                )}
                              </div>
                              {template.suggestedAmount && (
                                <Badge variant="outline">
                                  {parseFloat(template.suggestedAmount).toLocaleString('fr-FR')} FCFA
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Components */}
                {customComponents && customComponents.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      Vos composants personnalisés
                    </h4>
                    <div className="grid gap-2">
                      {customComponents
                        .filter((c) => c.isActive)
                        .map((component) => (
                          <Card
                            key={component.id}
                            className="cursor-pointer hover:border-primary transition-colors"
                            onClick={() => handleAddComponent(component, 10000)}
                          >
                            <CardHeader className="py-3">
                              <CardTitle className="text-sm">{component.name}</CardTitle>
                              {component.description && (
                                <CardDescription className="text-xs mt-1">
                                  {component.description}
                                </CardDescription>
                              )}
                            </CardHeader>
                          </Card>
                        ))}
                    </div>
                  </div>
                )}

                {(!templates || templates.length === 0) &&
                  (!customComponents || customComponents.length === 0) && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Aucun modèle disponible. Vous pouvez créer des composants personnalisés dans
                        les paramètres.
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

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

        {/* Display added custom allowances */}
        {otherAllowances.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="font-medium text-sm">Indemnités supplémentaires ajoutées</h4>
            {otherAllowances.map((allowance: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border"
              >
                <div>
                  <p className="font-medium text-sm">{allowance.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(allowance.amount)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const current = form.getValues('otherAllowances') || [];
                    form.setValue(
                      'otherAllowances',
                      current.filter((_: any, i: number) => i !== index)
                    );
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
