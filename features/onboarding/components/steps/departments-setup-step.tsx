'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { HelpBox } from '../help-box';
import { Plus, X, Building2 } from 'lucide-react';

const departmentSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  description: z.string().optional(),
});

type DepartmentForm = z.infer<typeof departmentSchema>;

interface DepartmentsSetupStepProps {
  onComplete: () => void;
}

interface DepartmentData {
  id: string; // Temporary ID for UI
  name: string;
  description?: string;
}

export function DepartmentsSetupStep({ onComplete }: DepartmentsSetupStepProps) {
  // Pre-fill with common departments
  const [departments, setDepartments] = useState<DepartmentData[]>([
    { id: 'dept-1', name: 'Direction', description: 'Direction générale' },
    { id: 'dept-2', name: 'Commercial', description: 'Ventes et marketing' },
    { id: 'dept-3', name: 'Comptabilité', description: 'Finances et paie' },
  ]);

  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createDepartments = api.onboarding.createDepartments.useMutation();
  const completeStep = api.onboarding.completeStep.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DepartmentForm>({
    resolver: zodResolver(departmentSchema),
  });

  const addDepartment = (data: DepartmentForm) => {
    const newDept: DepartmentData = {
      id: `dept-${Date.now()}`,
      name: data.name,
      description: data.description,
    };

    setDepartments([...departments, newDept]);
    reset();
    setIsAdding(false);
    toast.success('Département ajouté');
  };

  const removeDepartment = (id: string) => {
    setDepartments(departments.filter(dept => dept.id !== id));
    toast.info('Département retiré');
  };

  const updateDepartment = (id: string, field: keyof DepartmentData, value: string) => {
    setDepartments(
      departments.map(dept =>
        dept.id === id ? { ...dept, [field]: value } : dept
      )
    );
  };

  const handleFinish = async () => {
    if (departments.length < 2) {
      toast.error('Veuillez créer au moins 2 départements');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create departments via API
      await createDepartments.mutateAsync({
        departments: departments.map(({ name, description }) => ({ name, description })),
      });

      // Complete step
      await completeStep.mutateAsync({ stepId: 'departments_setup' });

      toast.success(`${departments.length} département(s) créé(s) avec succès !`);

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création des départements');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Complete step without creating departments
      await completeStep.mutateAsync({ stepId: 'departments_setup' });

      toast.info('Étape passée - vous pourrez ajouter des départements plus tard');

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur');
    }
  };

  return (
    <div className="space-y-6">
      <HelpBox>
        Organisez votre entreprise en départements. Nous avons pré-rempli des suggestions courantes que vous pouvez modifier ou supprimer.
      </HelpBox>

      {/* Progress indicator */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {departments.length} département{departments.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                {departments.length < 2 ? 'Au moins 2 requis' : 'Configuration complète'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* List of departments */}
      <div className="space-y-3">
        {departments.map((dept) => (
          <Card key={dept.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Nom du département</Label>
                    <Input
                      value={dept.name}
                      onChange={(e) => updateDepartment(dept.id, 'name', e.target.value)}
                      placeholder="Ex: Direction, Commercial, Comptabilité"
                      className="min-h-[44px] mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Description
                      <span className="ml-1">(Optionnel)</span>
                    </Label>
                    <Input
                      value={dept.description || ''}
                      onChange={(e) => updateDepartment(dept.id, 'description', e.target.value)}
                      placeholder="Ex: Gestion et stratégie"
                      className="min-h-[44px] mt-1"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDepartment(dept.id)}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add department form */}
      {isAdding ? (
        <form onSubmit={handleSubmit(addDepartment)} className="space-y-4">
          <Card className="p-4 border-primary">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base">
                  Nom du département
                </Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="Ex: Ressources humaines"
                  className="min-h-[48px]"
                  autoFocus
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base">
                  Description
                  <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
                </Label>
                <Input
                  id="description"
                  {...register('description')}
                  placeholder="Ex: Recrutement et gestion du personnel"
                  className="min-h-[48px]"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1 min-h-[44px]">
                  Ajouter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    reset();
                  }}
                  className="flex-1 min-h-[44px]"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        </form>
      ) : (
        <Button
          variant="outline"
          onClick={() => setIsAdding(true)}
          className="w-full min-h-[44px]"
        >
          <Plus className="mr-2 h-5 w-5" />
          Ajouter un département
        </Button>
      )}

      {/* Action buttons */}
      <div className="space-y-3 pt-4 border-t">
        <Button
          onClick={handleFinish}
          disabled={isSubmitting || departments.length < 2}
          className="w-full min-h-[56px] text-lg"
        >
          {isSubmitting
            ? 'Création...'
            : `Continuer avec ${departments.length} département${departments.length !== 1 ? 's' : ''}`}
        </Button>

        <Button
          variant="ghost"
          onClick={handleSkip}
          disabled={isSubmitting}
          className="w-full min-h-[44px]"
        >
          Passer cette étape
        </Button>

        {departments.length < 2 && (
          <p className="text-sm text-center text-muted-foreground">
            Ajoutez au moins {2 - departments.length} département{2 - departments.length !== 1 ? 's' : ''} de plus pour continuer
          </p>
        )}
      </div>
    </div>
  );
}
