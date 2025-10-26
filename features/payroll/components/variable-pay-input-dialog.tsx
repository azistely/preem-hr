/**
 * Variable Pay Input Dialog Component
 *
 * Dialog for adding/editing variable pay components for an employee.
 *
 * Features:
 * - Add new variable component with code, amount, and notes
 * - Edit existing variable component
 * - Form validation with Zod
 * - Touch-friendly UI (min-h-[48px])
 * - French language
 *
 * HCI Principles:
 * - Large touch targets
 * - Clear visual feedback
 * - Error prevention
 * - Immediate validation
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Zap, Calculator } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/lib/trpc/client';

/**
 * Form validation schema
 */
const schema = z.object({
  componentCode: z.string().min(1, 'Code composant requis').max(50, 'Code trop long'),
  amount: z.number().min(0, 'Le montant doit être positif ou zéro'),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format: AAAA-MM-JJ)'),
  notes: z.string().max(500, 'Notes trop longues').optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Get badge variant and label for calculation method
 */
function getCalculationMethodBadge(calculationMethod: string | null) {
  switch (calculationMethod) {
    case 'variable':
      return { variant: 'default' as const, label: 'Variable', icon: Zap };
    case 'fixed':
      return { variant: 'secondary' as const, label: 'Fixe', icon: Calculator };
    default:
      return { variant: 'outline' as const, label: 'Autre', icon: Calculator };
  }
}

interface VariablePayInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: FormValues) => Promise<void>;
  initialValues?: Partial<FormValues>;
  employeeName: string;
  employeeNumber: string;
  employeeId: string;
  period: string;
}

export function VariablePayInputDialog({
  open,
  onOpenChange,
  onSubmit,
  initialValues,
  employeeName,
  employeeNumber,
  employeeId,
  period,
}: VariablePayInputDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch ALL catalogue components (not just employee's assigned ones)
  const { data: catalogueData, isLoading: loadingComponents } =
    trpc.variablePayInputs.getAllCatalogueComponents.useQuery(
      { employeeId, period },
      { enabled: open }
    );

  const catalogueComponents = catalogueData?.components ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      componentCode: initialValues?.componentCode ?? '',
      amount: initialValues?.amount ?? 0,
      entryDate: period, // Default to period start (first day of month)
      notes: initialValues?.notes ?? '',
    },
  });

  // Reset form when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      form.reset({
        componentCode: initialValues?.componentCode ?? '',
        amount: initialValues?.amount ?? 0,
        entryDate: period, // Default to period start (first day of month)
        notes: initialValues?.notes ?? '',
      });
    }
  }, [open, initialValues, form, period]);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component via toast
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {initialValues ? 'Modifier la prime variable' : 'Ajouter une prime variable'}
          </DialogTitle>
          <DialogDescription>
            Pour {employeeName} (#{employeeNumber})
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="componentCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Composant salarial</FormLabel>
                  {loadingComponents ? (
                    <div className="flex items-center justify-center min-h-[48px] border rounded-md">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : catalogueComponents.length === 0 ? (
                    <div className="p-4 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                      Aucun composant défini dans le catalogue.
                      Veuillez d'abord créer des composants dans la configuration de paie.
                    </div>
                  ) : (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!initialValues}
                    >
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner un composant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px]">
                        {/* Group components by category for better UX */}
                        {Object.entries(
                          catalogueComponents.reduce((acc, component) => {
                            const category = component.category || 'Autre';
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(component);
                            return acc;
                          }, {} as Record<string, typeof catalogueComponents>)
                        ).map(([category, components]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                              {category}
                            </div>
                            {components.map((component) => {
                              const badge = getCalculationMethodBadge(component.calculationMethod);
                              const Icon = badge.icon;
                              return (
                                <SelectItem key={component.code} value={component.code}>
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="font-medium flex-1">{component.name}</span>
                                    <Badge variant={badge.variant} className="text-xs">
                                      <Icon className="h-3 w-3 mr-1" />
                                      {badge.label}
                                    </Badge>
                                    {component.currentAmount > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {component.currentAmount.toLocaleString('fr-FR')} F
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormDescription>
                    Sélectionnez n'importe quel composant du catalogue
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entryDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date de la prime</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      className="min-h-[48px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Pour un versement mensuel, laisser le 1er du mois. Pour un suivi journalier, sélectionner la date précise.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant (FCFA)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="50000"
                      className="min-h-[48px] text-lg font-semibold"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes internes..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Informations complémentaires sur cette prime
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || loadingComponents || catalogueComponents.length === 0}
                className="min-h-[48px]"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
