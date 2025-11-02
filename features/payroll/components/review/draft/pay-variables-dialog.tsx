'use client';

/**
 * Pay Variables Dialog
 *
 * Dialog for adding bonuses, commissions, deductions for this pay period
 * - Type selection (performance, attendance, commission, advance, deduction)
 * - Amount input (large, mobile-friendly)
 * - Tax treatment toggle
 * - Notes field
 *
 * Design: Mobile-first form, clear validation, large touch targets
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const payVariableSchema = z.object({
  type: z.enum(['bonus', 'commission', 'deduction', 'advance']),
  category: z.string().min(1, 'Catégorie requise'),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  taxable: z.boolean(),
  description: z.string().min(1, 'Description requise'),
});

type PayVariableFormData = z.infer<typeof payVariableSchema>;

interface PayVariablesDialogProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  onSubmit: (data: PayVariableFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function PayVariablesDialog({
  open,
  onClose,
  employeeName,
  onSubmit,
  isSubmitting = false,
}: PayVariablesDialogProps) {
  const [selectedType, setSelectedType] = useState<string>('bonus');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PayVariableFormData>({
    resolver: zodResolver(payVariableSchema),
    defaultValues: {
      type: 'bonus',
      category: '',
      amount: 0,
      taxable: true,
      description: '',
    },
  });

  const type = watch('type');

  const typeConfig = {
    bonus: {
      title: 'Ajouter Bonus/Prime',
      categories: [
        { value: 'performance', label: 'Prime de performance' },
        { value: 'attendance', label: "Prime d'assiduité" },
        { value: 'exceptional', label: 'Prime exceptionnelle' },
        { value: 'other', label: 'Autre' },
      ],
    },
    commission: {
      title: 'Ajouter Commission',
      categories: [
        { value: 'sales', label: 'Commission sur ventes' },
        { value: 'target', label: "Commission d'objectif" },
        { value: 'other', label: 'Autre' },
      ],
    },
    deduction: {
      title: 'Ajouter Retenue',
      categories: [
        { value: 'loan', label: 'Remboursement prêt' },
        { value: 'advance', label: 'Remboursement avance' },
        { value: 'fine', label: 'Amende' },
        { value: 'other', label: 'Autre' },
      ],
    },
    advance: {
      title: 'Ajouter Avance',
      categories: [{ value: 'salary_advance', label: 'Avance sur salaire' }],
    },
  };

  const currentConfig = typeConfig[type as keyof typeof typeConfig];

  const handleFormSubmit = async (data: PayVariableFormData) => {
    await onSubmit(data);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{currentConfig.title}</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 py-4">
          {/* Type Selection */}
          <div className="space-y-3">
            <Label>Type</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => {
                setValue('type', value as any);
                setValue('category', '');
                setSelectedType(value);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`
                  flex items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                  ${type === 'bonus' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                `}
              >
                <RadioGroupItem value="bonus" className="sr-only" />
                <span className="text-sm font-medium">Bonus/Prime</span>
              </label>
              <label
                className={`
                  flex items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                  ${type === 'commission' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                `}
              >
                <RadioGroupItem value="commission" className="sr-only" />
                <span className="text-sm font-medium">Commission</span>
              </label>
              <label
                className={`
                  flex items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                  ${type === 'deduction' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                `}
              >
                <RadioGroupItem value="deduction" className="sr-only" />
                <span className="text-sm font-medium">Retenue</span>
              </label>
              <label
                className={`
                  flex items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                  ${type === 'advance' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                `}
              >
                <RadioGroupItem value="advance" className="sr-only" />
                <span className="text-sm font-medium">Avance</span>
              </label>
            </RadioGroup>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            <select
              id="category"
              {...register('category')}
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Sélectionnez...</option>
              {currentConfig.categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Montant</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="1000"
                min="0"
                placeholder="0"
                {...register('amount')}
                className="min-h-[56px] pl-10 text-2xl font-semibold"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                FCFA
              </div>
            </div>
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* Tax Treatment */}
          <div className="space-y-3">
            <Label>Traitement fiscal</Label>
            <RadioGroup
              defaultValue="true"
              onValueChange={(value) => setValue('taxable', value === 'true')}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`
                  flex items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                  ${watch('taxable') ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                `}
              >
                <RadioGroupItem value="true" className="sr-only" />
                <span className="text-sm font-medium">Imposable</span>
              </label>
              <label
                className={`
                  flex items-center justify-center gap-2 rounded-lg border-2 p-3 cursor-pointer transition-all
                  ${!watch('taxable') ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                `}
              >
                <RadioGroupItem value="false" className="sr-only" />
                <span className="text-sm font-medium">Exonéré</span>
              </label>
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Ex: Bonus pour 100% présence en octobre"
              className="min-h-[80px]"
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[48px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[48px] gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>Ajouter {currentConfig.title.replace('Ajouter ', '')}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
