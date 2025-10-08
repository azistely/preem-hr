'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { HelpBox } from '../help-box';
import { X, Plus, Users } from 'lucide-react';

const employeeSchema = z.object({
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  positionTitle: z.string().min(2, 'Le poste doit contenir au moins 2 caractères'),
  baseSalary: z.string().min(1, 'Le salaire est requis'),
  hireDate: z.string().min(1, 'La date d\'embauche est requise'),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

interface EmployeesWizardStepProps {
  onComplete: () => void;
}

interface EmployeeData extends EmployeeForm {
  id: string; // Temporary ID for UI
}

export function EmployeesWizardStep({ onComplete }: EmployeesWizardStepProps) {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addEmployee = api.onboarding.addEmployee.useMutation();
  const completeStep = api.onboarding.completeStep.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      hireDate: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmitEmployee = async (data: EmployeeForm) => {
    try {
      // Validate salary
      const baseSalary = parseFloat(data.baseSalary);
      if (isNaN(baseSalary) || baseSalary <= 0) {
        toast.error('Le salaire doit être un nombre valide');
        return;
      }

      // Add employee via API
      await addEmployee.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        positionTitle: data.positionTitle,
        baseSalary,
        hireDate: new Date(data.hireDate),
      });

      // Add to local list
      const newEmployee: EmployeeData = {
        ...data,
        id: `emp-${Date.now()}`,
      };
      setEmployees([...employees, newEmployee]);

      toast.success(`${data.firstName} ${data.lastName} ajouté avec succès !`);

      // Reset form
      reset({
        hireDate: new Date().toISOString().split('T')[0],
      });

      // Move to next employee
      setCurrentEmployeeIndex(employees.length + 1);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'ajout de l\'employé');
    }
  };

  const removeEmployee = (id: string) => {
    setEmployees(employees.filter(emp => emp.id !== id));
    toast.info('Employé retiré de la liste');
  };

  const finishAdding = async () => {
    if (employees.length === 0) {
      toast.error('Veuillez ajouter au moins un employé');
      return;
    }

    setIsSubmitting(true);

    try {
      // Complete step
      await completeStep.mutateAsync({ stepId: 'employees_wizard' });

      toast.success(`${employees.length} employé(s) ajouté(s) avec succès !`);

      // Call parent callback
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la finalisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <HelpBox>
        Ajoutez les membres de votre équipe un par un. Vous pouvez ajouter entre 2 et 10 employés.
      </HelpBox>

      {/* Progress indicator */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {employees.length} employé{employees.length !== 1 ? 's' : ''} ajouté{employees.length !== 1 ? 's' : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                {employees.length < 10 ? 'Vous pouvez en ajouter jusqu\'à 10' : 'Maximum atteint'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* List of added employees */}
      {employees.length > 0 && (
        <div className="space-y-2">
          <Label className="text-base">Employés ajoutés</Label>
          <div className="space-y-2">
            {employees.map((emp) => (
              <Card key={emp.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {emp.positionTitle} · {parseFloat(emp.baseSalary).toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEmployee(emp.id)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add employee form (only if < 10) */}
      {employees.length < 10 && (
        <form onSubmit={handleSubmit(onSubmitEmployee)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-lg font-semibold">
              {employees.length === 0 ? 'Premier employé' : `Employé ${employees.length + 1}`}
            </Label>
          </div>

          <div className="space-y-4">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-base">
                Prénom
              </Label>
              <Input
                id="firstName"
                {...register('firstName')}
                placeholder="Ex: Marie"
                className="min-h-[48px]"
                autoFocus
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-base">
                Nom
              </Label>
              <Input
                id="lastName"
                {...register('lastName')}
                placeholder="Ex: Koffi"
                className="min-h-[48px]"
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Ex: marie.koffi@example.com"
                className="min-h-[48px]"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base">
                Téléphone
                <span className="text-muted-foreground text-sm ml-2">(Optionnel)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                {...register('phone')}
                placeholder="Ex: +225 01 23 45 67 89"
                className="min-h-[48px]"
              />
            </div>

            {/* Position Title */}
            <div className="space-y-2">
              <Label htmlFor="positionTitle" className="text-base">
                Poste
              </Label>
              <Input
                id="positionTitle"
                {...register('positionTitle')}
                placeholder="Ex: Vendeur, Caissier, Manager"
                className="min-h-[48px]"
              />
              {errors.positionTitle && (
                <p className="text-sm text-destructive">{errors.positionTitle.message}</p>
              )}
            </div>

            {/* Base Salary */}
            <div className="space-y-2">
              <Label htmlFor="baseSalary" className="text-base">
                Salaire mensuel brut
              </Label>
              <div className="relative">
                <Input
                  id="baseSalary"
                  type="number"
                  step="1000"
                  {...register('baseSalary')}
                  placeholder="Ex: 150000"
                  className="min-h-[48px] pr-20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  FCFA
                </span>
              </div>
              {errors.baseSalary && (
                <p className="text-sm text-destructive">{errors.baseSalary.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                💡 Minimum légal: 75,000 FCFA
              </p>
            </div>

            {/* Hire Date */}
            <div className="space-y-2">
              <Label htmlFor="hireDate" className="text-base">
                Date d'embauche
              </Label>
              <Input
                id="hireDate"
                type="date"
                {...register('hireDate')}
                className="min-h-[48px]"
              />
              {errors.hireDate && (
                <p className="text-sm text-destructive">{errors.hireDate.message}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={addEmployee.isPending}
            className="w-full min-h-[48px] text-lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            {addEmployee.isPending ? 'Ajout...' : 'Ajouter cet employé'}
          </Button>
        </form>
      )}

      {/* Finish button (only if at least 1 employee added) */}
      {employees.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <Button
            onClick={finishAdding}
            disabled={isSubmitting}
            className="w-full min-h-[56px] text-lg"
          >
            {isSubmitting
              ? 'Finalisation...'
              : `Continuer avec ${employees.length} employé${employees.length !== 1 ? 's' : ''}`}
          </Button>

          {employees.length < 10 && (
            <p className="text-sm text-center text-muted-foreground">
              Vous pouvez ajouter {10 - employees.length} employé{10 - employees.length !== 1 ? 's' : ''} de plus
            </p>
          )}
        </div>
      )}
    </div>
  );
}
