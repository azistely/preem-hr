/**
 * Edit Enrollment Dialog
 *
 * Dialog for editing an existing benefit enrollment.
 * Allows updating enrollment details, coverage level, and notes.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Loader2, Save } from 'lucide-react';
import { EntityDocumentsSection } from '@/components/documents/entity-documents-section';

const formSchema = z.object({
  enrollmentDate: z.string().min(1, 'La date d\'inscription est requise'),
  effectiveDate: z.string().min(1, 'La date d\'effet est requise'),
  enrollmentNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  coverageLevel: z.enum(['individual', 'family', 'employee_spouse', 'employee_children']).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditEnrollmentDialogProps {
  enrollmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  employeeId?: string; // For document uploads
}

export function EditEnrollmentDialog({
  enrollmentId,
  open,
  onOpenChange,
  onSuccess,
  employeeId,
}: EditEnrollmentDialogProps) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enrollmentDate: '',
      effectiveDate: '',
      enrollmentNumber: '',
      policyNumber: '',
      coverageLevel: undefined,
      notes: '',
    },
  });

  // Fetch enrollment details
  const { data: enrollment, isLoading } = api.benefits.getEnrollment.useQuery(
    { id: enrollmentId! },
    { enabled: !!enrollmentId }
  );

  // Populate form when enrollment data loads
  useEffect(() => {
    if (enrollment) {
      form.reset({
        enrollmentDate: enrollment.enrollmentDate,
        effectiveDate: enrollment.effectiveDate,
        enrollmentNumber: enrollment.enrollmentNumber || '',
        policyNumber: enrollment.policyNumber || '',
        coverageLevel: enrollment.coverageLevel as any || undefined,
        notes: enrollment.notes || '',
      });
    }
  }, [enrollment, form]);

  const updateMutation = api.benefits.updateEnrollment.useMutation({
    onSuccess: () => {
      toast({
        title: 'Inscription mise à jour',
        description: 'L\'inscription a été mise à jour avec succès',
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    if (!enrollmentId) return;

    updateMutation.mutate({
      id: enrollmentId,
      enrollmentDate: values.enrollmentDate,
      effectiveDate: values.effectiveDate,
      enrollmentNumber: values.enrollmentNumber?.trim() || undefined,
      policyNumber: values.policyNumber?.trim() || undefined,
      coverageLevel: values.coverageLevel || undefined,
      // Note: Enrollment documents are now managed via uploaded_documents table
      notes: values.notes?.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chargement...</DialogTitle>
            <DialogDescription>
              Chargement des détails de l'inscription
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!enrollment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'Inscription</DialogTitle>
          <DialogDescription>
            Modifier les détails de l'inscription
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enrollmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date d'Inscription</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg">Date d'Effet</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="min-h-[48px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Optional Fields */}
            <FormField
              control={form.control}
              name="enrollmentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro d'Inscription (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: N° CMU, N° de police"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Numéro externe d'inscription (N° CMU pour la Côte d'Ivoire, par exemple)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="policyNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro de Police (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Numéro de police d'assurance"
                      className="min-h-[48px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coverageLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niveau de Couverture (optionnel)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionnez un niveau" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="individual">Individuel</SelectItem>
                      <SelectItem value="family">Familial</SelectItem>
                      <SelectItem value="employee_spouse">Employé + Conjoint</SelectItem>
                      <SelectItem value="employee_children">Employé + Enfants</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Enrollment Documents */}
            <EntityDocumentsSection
              category="benefit"
              entityId={enrollmentId!}
              employeeId={employeeId || null}
              label="Documents d'inscription"
              helperText="Certificat d'adhésion, carte CMU, ou autre document d'inscription (optionnel)"
              allowUpload={true}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notes ou informations supplémentaires"
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex gap-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 min-h-[56px] gap-2"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
