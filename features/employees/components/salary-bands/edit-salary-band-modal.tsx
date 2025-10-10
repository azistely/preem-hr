/**
 * Edit Salary Band Modal
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/features/employees/hooks/use-salary-validation';

const editBandSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Le nom est requis'),
  jobLevel: z.string().optional(),
  category: z.string().optional(),
  minSalary: z.number().min(75000, 'Le salaire minimum doit être >= 75000 FCFA'),
  maxSalary: z.number().min(75000, 'Le salaire maximum doit être >= 75000 FCFA'),
}).refine((data) => data.maxSalary > data.minSalary, {
  message: 'Le salaire maximum doit être supérieur au minimum',
  path: ['maxSalary'],
});

type FormData = z.infer<typeof editBandSchema>;

interface EditSalaryBandModalProps {
  band: any;
  open: boolean;
  onClose: () => void;
}

export function EditSalaryBandModal({ band, open, onClose }: EditSalaryBandModalProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const updateBand = trpc.salaryBands.update.useMutation({
    onSuccess: () => {
      utils.salaryBands.list.invalidate();
      toast({
        title: 'Bande mise à jour',
        description: 'La bande salariale a été mise à jour avec succès',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(editBandSchema),
    defaultValues: {
      id: band.id,
      name: band.name,
      jobLevel: band.jobLevel || '',
      category: band.category || '',
      minSalary: band.minSalary,
      maxSalary: band.maxSalary,
    },
  });

  const minSalary = form.watch('minSalary');
  const maxSalary = form.watch('maxSalary');

  const midpoint = minSalary && maxSalary ? (minSalary + maxSalary) / 2 : 0;
  const spread = midpoint > 0 ? ((maxSalary - minSalary) / midpoint) * 100 : 0;

  const onSubmit = async (data: FormData) => {
    await updateBand.mutateAsync({
      bandId: data.id,
      name: data.name,
      minSalary: data.minSalary,
      maxSalary: data.maxSalary,
      midSalary: Math.round((data.minSalary + data.maxSalary) / 2),
      jobLevel: data.jobLevel,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Modifier la bande salariale</DialogTitle>
          <DialogDescription>
            Mettez à jour la fourchette salariale
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la bande *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Cadre Senior"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="jobLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niveau</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="junior">Junior</SelectItem>
                        <SelectItem value="intermediate">Intermédiaire</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="director">Directeur</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[48px]">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tech">Technique</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="sales">Commercial</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                        <SelectItem value="admin">Administration</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salaire minimum (FCFA) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="10000"
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
                name="maxSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salaire maximum (FCFA) *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="10000"
                        className="min-h-[48px]"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {midpoint > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-blue-600">Fourchette</p>
                    <p className="text-lg font-bold text-blue-700 mt-1">
                      {formatCurrency(minSalary)} - {formatCurrency(maxSalary)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Milieu de bande</p>
                    <p className="text-lg font-bold text-blue-700 mt-1">
                      {formatCurrency(midpoint)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Écart</p>
                    <p className="text-lg font-bold text-blue-700 mt-1">
                      {spread.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateBand.isPending}
                className="min-h-[48px]"
              >
                {updateBand.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
