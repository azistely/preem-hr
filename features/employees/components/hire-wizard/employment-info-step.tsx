/**
 * Employment Info Step - Hire Wizard
 */

'use client';

import { useState } from 'react';
import { UseFormReturn, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { usePositions } from '@/features/employees/hooks/use-positions';
import { trpc } from '@/lib/trpc/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CoefficientSelector } from '@/components/employees/coefficient-selector';
import { RateTypeSelector } from '@/components/employees/rate-type-selector';
import { ContractTypeSelector } from '@/components/employees/contract-type-selector';
import type { ContractType } from '@/components/employees/contract-type-selector';
import { PaymentFrequencySelector } from '@/components/employees/payment-frequency-selector';
import type { PaymentFrequency, WeeklyHoursRegime } from '@/components/employees/payment-frequency-selector';
import { toast } from 'sonner';

// Schema for creating a new position
const createPositionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  department: z.string().optional(),
});

interface EmploymentInfoStepProps {
  form: UseFormReturn<any>;
}

export function EmploymentInfoStep({ form }: EmploymentInfoStepProps) {
  const { data: positions, isLoading, refetch } = usePositions('active');
  const { data: locations, isLoading: loadingLocations } = trpc.locations.list.useQuery({
    includeInactive: false,
  });
  const utils = trpc.useUtils();
  const createPositionMutation = trpc.positions.create.useMutation();
  const countryCode = 'CI'; // TODO: Get from tenant context

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPositionTitle, setNewPositionTitle] = useState('');

  const handleCreatePosition = async () => {
    if (!newPositionTitle.trim()) {
      toast.error('Le titre du poste est requis');
      return;
    }

    try {
      const newPosition = await createPositionMutation.mutateAsync({
        title: newPositionTitle.trim(),
        employmentType: 'full_time' as const,
        weeklyHours: 40,
        headcount: 1,
      });

      // Invalidate and refetch positions to include the new one
      await utils.positions.list.invalidate();
      await refetch();

      // Automatically select the newly created position
      form.setValue('positionId', newPosition.id);

      // Reset form and close dialog
      setNewPositionTitle('');
      setShowCreateDialog(false);

      toast.success(`Poste "${newPosition.title}" créé avec succès!`);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création du poste');
    }
  };

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="contractType"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <ContractTypeSelector
                value={(field.value as ContractType) || 'CDI'}
                onChange={(value: ContractType) => {
                  field.onChange(value);
                  // Auto-set rate type to HOURLY when CDDTI is selected
                  if (value === 'CDDTI') {
                    form.setValue('rateType', 'HOURLY');
                    // Initialize payment frequency and weekly hours regime with defaults
                    if (!form.getValues('paymentFrequency')) {
                      form.setValue('paymentFrequency', 'WEEKLY');
                    }
                    if (!form.getValues('weeklyHoursRegime')) {
                      form.setValue('weeklyHoursRegime', '40h');
                    }
                  } else if (form.getValues('rateType') === 'HOURLY' && (value as string) !== 'CDDTI') {
                    // Reset to MONTHLY if switching away from CDDTI
                    form.setValue('rateType', 'MONTHLY');
                    // Clear CDDTI-specific fields
                    form.setValue('paymentFrequency', undefined);
                    form.setValue('weeklyHoursRegime', undefined);
                  }
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="hireDate"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date d'embauche *</FormLabel>
            <FormControl>
              <DatePicker
                value={field.value || null}
                onChange={field.onChange}
                placeholder="Sélectionner une date"
                fromYear={2000}
                toYear={new Date().getFullYear()}
                disabled={(date) => date > new Date()}
                allowManualInput={true}
              />
            </FormControl>
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
            <div className="flex items-center justify-between mb-2">
              <FormLabel>Poste *</FormLabel>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Créer un poste
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Créer un nouveau poste</DialogTitle>
                    <DialogDescription>
                      Ajoutez un nouveau poste pour votre entreprise. Vous pourrez ajouter plus de détails plus tard.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Titre du poste *</Label>
                      <Input
                        id="title"
                        placeholder="Ex: Vendeur, Manager, Caissier"
                        value={newPositionTitle}
                        onChange={(e) => setNewPositionTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPositionTitle.trim()) {
                            e.preventDefault();
                            handleCreatePosition();
                          }
                        }}
                        className="min-h-[48px]"
                        autoFocus
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewPositionTitle('');
                        setShowCreateDialog(false);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCreatePosition}
                      disabled={createPositionMutation.isPending || !newPositionTitle.trim()}
                    >
                      {createPositionMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Création...
                        </>
                      ) : (
                        'Créer le poste'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              value={field.value}
              disabled={isLoading}
            >
              <FormControl>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder={
                    isLoading
                      ? "Chargement..."
                      : !positions || positions.length === 0
                      ? "Créez un poste d'abord"
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
                'Cliquez sur "Créer un poste" pour commencer'
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

      <FormField
        control={form.control}
        name="rateType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Type de rémunération *</FormLabel>
            <FormControl>
              <RateTypeSelector
                value={field.value || 'MONTHLY'}
                onChange={field.onChange}
              />
            </FormControl>
            <FormDescription>
              Sélectionnez comment l'employé est payé
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="primaryLocationId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Site principal *</FormLabel>
            <Select
              onValueChange={field.onChange}
              defaultValue={field.value}
              value={field.value}
              disabled={loadingLocations}
            >
              <FormControl>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue placeholder={
                    loadingLocations
                      ? "Chargement..."
                      : !locations || locations.length === 0
                      ? "Aucun site disponible"
                      : "Sélectionner un site"
                  } />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {locations?.map((location: any) => {
                  // Build display label: "Location Name - Commune, City" or "Location Name - City"
                  let label = location.locationName || location.name || '';

                  if (location.commune && location.city) {
                    label += ` - ${location.commune}, ${location.city}`;
                  } else if (location.commune) {
                    label += ` - ${location.commune}`;
                  } else if (location.city) {
                    label += ` - ${location.city}`;
                  }

                  return (
                    <SelectItem key={location.id} value={location.id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <FormDescription>
              Le site où l'employé travaillera principalement
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* CDDTI-specific: Payment Frequency */}
      {form.watch('contractType') === 'CDDTI' && (
        <div className="space-y-6 p-6 border rounded-lg bg-muted/50">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Configuration du contrat journalier</h3>
            <p className="text-sm text-muted-foreground">
              Pour les travailleurs journaliers (CDDTI), précisez la fréquence de paiement et le régime horaire.
            </p>
          </div>

          <FormField
            control={form.control}
            name="cddtiTaskDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description de la tâche *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ex: Manœuvre sur chantier, manutention de marchandises, travaux de nettoyage..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Requis par l'Article 4 de la Convention Collective. Décrivez la nature des tâches à effectuer.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentFrequency"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <PaymentFrequencySelector
                    frequency={(field.value as PaymentFrequency) || 'WEEKLY'}
                    weeklyHoursRegime={(form.watch('weeklyHoursRegime') as WeeklyHoursRegime) || '40h'}
                    onFrequencyChange={(value) => field.onChange(value)}
                    onWeeklyHoursChange={(value) => form.setValue('weeklyHoursRegime', value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}
