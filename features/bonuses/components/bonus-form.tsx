/**
 * Bonus Form Component
 *
 * Purpose: Create or edit a bonus/variable pay entry
 * Features:
 * - Employee selection
 * - Bonus type selection
 * - Amount input
 * - Period selection
 * - Tax/social security options
 * - Smart defaults
 * - Mobile-responsive
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const bonusFormSchema = z.object({
  employeeId: z.string().min(1, 'Veuillez sélectionner un employé'),
  bonusType: z.enum(['performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other']),
  amount: z.number().positive('Le montant doit être positif'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Format de période invalide'),
  description: z.string().min(1, 'La description est requise').max(500),
  notes: z.string().max(1000).optional(),
  isTaxable: z.boolean(),
  isSubjectToSocialSecurity: z.boolean(),
});

type BonusFormValues = z.infer<typeof bonusFormSchema>;

const bonusTypeLabels = {
  performance: 'Prime de performance',
  holiday: 'Prime de fête',
  project: 'Prime de projet',
  sales_commission: 'Commission de vente',
  attendance: 'Prime d\'assiduité',
  retention: 'Prime de fidélité',
  other: 'Autre prime',
};

interface BonusFormProps {
  onSuccess?: () => void;
  initialValues?: Partial<BonusFormValues>;
}

export function BonusForm({ onSuccess, initialValues }: BonusFormProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generate period options (current month + next 3 months)
  const periodOptions = Array.from({ length: 4 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
      value: `${year}-${month}`,
      label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    };
  });

  // Fetch employees for selection
  const { data: employeesData } = trpc.employees.list.useQuery({
    status: 'active',
    limit: 100, // Max allowed by tRPC validation
  });

  const employees = employeesData?.employees || [];

  // Create bonus mutation
  const createBonus = trpc.bonuses.create.useMutation({
    onSuccess: () => {
      toast({
        title: 'Prime créée',
        description: 'La prime a été créée avec succès',
      });
      utils.bonuses.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const form = useForm<BonusFormValues>({
    resolver: zodResolver(bonusFormSchema),
    defaultValues: {
      employeeId: initialValues?.employeeId ?? '',
      bonusType: initialValues?.bonusType ?? 'performance',
      amount: initialValues?.amount ?? 0,
      period: initialValues?.period ?? periodOptions[0].value,
      description: initialValues?.description ?? '',
      notes: initialValues?.notes ?? '',
      isTaxable: initialValues?.isTaxable ?? true,
      isSubjectToSocialSecurity: initialValues?.isSubjectToSocialSecurity ?? true,
    },
  });

  function onSubmit(values: BonusFormValues) {
    createBonus.mutate({
      ...values,
      period: `${values.period}-01`, // Convert YYYY-MM to YYYY-MM-01
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Employee Selection */}
        <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employé</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue placeholder="Sélectionner un employé" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {employees.map((employee: any) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} ({employee.employeeNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Bonus Type */}
        <FormField
          control={form.control}
          name="bonusType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type de prime</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(bonusTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
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
                  className="min-h-[48px] text-lg"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>
                Montant en Francs CFA
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Period */}
        <FormField
          control={form.control}
          name="period"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Période d'application</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="min-h-[48px]">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Mois où cette prime sera incluse dans la paie
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input
                  placeholder="Prime de performance Q4 2025"
                  className="min-h-[48px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Description courte visible sur le bulletin de paie
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Advanced Options (Collapsible) */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground">
            {showAdvanced ? '▼' : '▶'} Options avancées
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes internes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes pour l'équipe RH..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Notes internes non visibles sur le bulletin
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tax Options */}
            <FormField
              control={form.control}
              name="isTaxable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Soumis à l'impôt</FormLabel>
                    <FormDescription>
                      Cette prime est soumise à l'ITS/IRPP
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isSubjectToSocialSecurity"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Soumis aux cotisations sociales</FormLabel>
                    <FormDescription>
                      Cette prime est soumise à la CNPS/IPRES
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            size="lg"
            className="flex-1 min-h-[56px]"
            disabled={createBonus.isPending}
          >
            {createBonus.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer la prime
          </Button>
        </div>
      </form>
    </Form>
  );
}
