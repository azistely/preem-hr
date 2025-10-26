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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
  const { data: locations, isLoading: loadingLocations } = trpc.locations.list.useQuery();
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
                {locations?.map((location: any) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                    {location.city && ` - ${location.city}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              Le site où l'employé travaillera principalement
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
