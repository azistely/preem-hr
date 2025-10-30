/**
 * Create Position Page
 *
 * Form to create a new position
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { useCreatePosition } from '@/features/employees/hooks/use-position-mutations';
import { useSalaryValidation, formatCurrency } from '@/features/employees/hooks/use-salary-validation';

const createPositionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  code: z.string().optional(),
  description: z.string().optional(),
  jobFunction: z.string().optional(), // Fonction (broader role category)
  jobTrade: z.string().optional(), // Métier (specific job/trade)
  departmentId: z.string().optional(),
  minSalary: z.number().min(75000, 'Le salaire minimum doit être >= 75000 FCFA'),
  maxSalary: z.number().min(75000, 'Le salaire maximum doit être >= 75000 FCFA'),
  weeklyHours: z.number().min(1).max(80).optional().default(40),
  headcount: z.number().int().min(1).optional().default(1),
});

type FormData = z.infer<typeof createPositionSchema>;
type FormInput = z.input<typeof createPositionSchema>;

export default function NewPositionPage() {
  const createPosition = useCreatePosition();

  const form = useForm<FormInput>({
    resolver: zodResolver(createPositionSchema),
    defaultValues: {
      title: '',
      code: '',
      description: '',
      jobFunction: '',
      jobTrade: '',
      weeklyHours: 40,
      headcount: 1,
      minSalary: 75000,
      maxSalary: 150000,
    },
  });

  const minSalary = form.watch('minSalary');
  const maxSalary = form.watch('maxSalary');

  const { minimumWage } = useSalaryValidation(minSalary);

  const onSubmit = async (data: FormInput) => {
    // Validate min < max
    if (data.minSalary >= data.maxSalary) {
      form.setError('maxSalary', {
        message: 'Le salaire maximum doit être supérieur au minimum',
      });
      return;
    }

    // Transform empty strings to undefined for optional fields
    const cleanedData = {
      ...data,
      code: data.code || undefined,
      description: data.description || undefined,
      jobFunction: data.jobFunction || undefined,
      jobTrade: data.jobTrade || undefined,
      departmentId: data.departmentId || undefined,
    };

    await createPosition.mutateAsync(cleanedData);
  };

  return (
    <div className="container mx-auto max-w-3xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/positions">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Créer un nouveau poste</h1>
        <p className="text-muted-foreground mt-2">
          Définissez un nouveau poste dans votre organisation
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
              <CardDescription>Titre et description du poste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre du poste *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Développeur Senior"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code du poste (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: DEV-001"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormDescription>
                      Identifiant unique pour ce poste
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Décrivez les responsabilités du poste..."
                        className="min-h-[100px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="jobFunction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fonction (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Cadre, Agent de maîtrise"
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription>
                        Catégorie professionnelle
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="jobTrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Métier (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Comptable, Électricien"
                          className="min-h-[48px]"
                        />
                      </FormControl>
                      <FormDescription>
                        Métier ou spécialité
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Organizational Info */}
          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
              <CardDescription>Effectif et horaires</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="headcount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effectif *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        className="min-h-[48px]"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre de personnes pouvant occuper ce poste
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weeklyHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heures par semaine *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={80}
                        className="min-h-[48px]"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 40)}
                      />
                    </FormControl>
                    <FormDescription>Horaire hebdomadaire standard</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Salary Range */}
          <Card>
            <CardHeader>
              <CardTitle>Fourchette salariale</CardTitle>
              <CardDescription>Salaire minimum et maximum pour ce poste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salaire minimum *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={minimumWage || 75000}
                          step={1000}
                          className="min-h-[48px]"
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Min: {formatCurrency(minimumWage || 75000)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salaire maximum *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={minimumWage || 75000}
                          step={1000}
                          className="min-h-[48px]"
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Doit être {'>'} minimum
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {minSalary > 0 && maxSalary > 0 && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Fourchette salariale</span>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(minSalary)} - {formatCurrency(maxSalary)}
                  </div>
                  {minSalary >= maxSalary && (
                    <p className="text-sm text-destructive mt-2">
                      Le salaire maximum doit être supérieur au minimum
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/positions">
              <Button type="button" variant="outline" className="min-h-[44px]">
                Annuler
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={createPosition.isPending}
              className="min-h-[56px] px-8 bg-green-600 hover:bg-green-700"
            >
              {createPosition.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Créer le poste
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
