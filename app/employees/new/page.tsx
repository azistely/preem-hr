/**
 * Create Employee Page (Hire Wizard)
 *
 * Multi-step wizard for hiring a new employee
 * Following HCI principles: task-oriented, progressive disclosure, error prevention
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Loader2, User, Briefcase, DollarSign, CreditCard, Check } from 'lucide-react';
import { useCreateEmployee } from '@/features/employees/hooks/use-employee-mutations';
import { PersonalInfoStep } from '@/features/employees/components/hire-wizard/personal-info-step';
import { EmploymentInfoStep } from '@/features/employees/components/hire-wizard/employment-info-step';
import { SalaryInfoStep } from '@/features/employees/components/hire-wizard/salary-info-step';
import { BankingInfoStep } from '@/features/employees/components/hire-wizard/banking-info-step';
import { ConfirmationStep } from '@/features/employees/components/hire-wizard/confirmation-step';
import Link from 'next/link';

// Form schema
const createEmployeeSchema = z.object({
  // Personal info
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  preferredName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  nationalId: z.string().optional(),

  // Employment info
  hireDate: z.date(),
  positionId: z.string().min(1, 'Le poste est requis'),

  // Salary info
  baseSalary: z.number().min(75000, 'Le salaire doit être >= 75000 FCFA'),
  housingAllowance: z.number().min(0).default(0),
  transportAllowance: z.number().min(0).default(0),
  mealAllowance: z.number().min(0).default(0),

  // Banking info
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),

  // Tax info
  taxDependents: z.number().int().min(0).max(10).default(0),
});

type FormData = z.infer<typeof createEmployeeSchema>;

const steps = [
  {
    id: 1,
    title: 'Informations personnelles',
    icon: User,
    description: 'Prénom, nom, contact',
  },
  {
    id: 2,
    title: 'Informations d\'emploi',
    icon: Briefcase,
    description: 'Date d\'embauche, poste',
  },
  {
    id: 3,
    title: 'Salaire et avantages',
    icon: DollarSign,
    description: 'Salaire de base, indemnités',
  },
  {
    id: 4,
    title: 'Informations bancaires',
    icon: CreditCard,
    description: 'Compte, banque',
  },
  {
    id: 5,
    title: 'Confirmation',
    icon: Check,
    description: 'Vérifier et confirmer',
  },
];

export default function NewEmployeePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const createEmployee = useCreateEmployee();

  const form = useForm<FormData>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      preferredName: '',
      email: '',
      phone: '',
      nationalId: '',
      hireDate: new Date(),
      positionId: '',
      baseSalary: 75000,
      housingAllowance: 0,
      transportAllowance: 0,
      mealAllowance: 0,
      bankName: '',
      bankAccount: '',
      taxDependents: 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    await createEmployee.mutateAsync(data);
  };

  const nextStep = async () => {
    let isValid = false;

    // Validate current step fields
    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['firstName', 'lastName', 'email']);
        break;
      case 2:
        isValid = await form.trigger(['hireDate', 'positionId']);
        break;
      case 3:
        isValid = await form.trigger(['baseSalary']);
        break;
      case 4:
        isValid = true; // Banking info is optional
        break;
    }

    if (isValid && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/employees">
          <Button variant="ghost" className="mb-4">
            ← Retour à la liste
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Embaucher un nouvel employé</h1>
        <p className="text-muted-foreground mt-2">
          Remplissez les informations pour ajouter un employé à votre équipe
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors
                    ${
                      currentStep > step.id
                        ? 'border-green-500 bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-400'
                    }
                  `}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="mt-2 text-center hidden md:block">
                  <div
                    className={`text-sm font-medium ${
                      currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-12 md:w-24 mx-2 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStep - 1].title}</CardTitle>
              <CardDescription>{steps[currentStep - 1].description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currentStep === 1 && <PersonalInfoStep form={form} />}
              {currentStep === 2 && <EmploymentInfoStep form={form} />}
              {currentStep === 3 && <SalaryInfoStep form={form} />}
              {currentStep === 4 && <BankingInfoStep form={form} />}
              {currentStep === 5 && <ConfirmationStep form={form} />}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="min-h-[44px]"
            >
              Précédent
            </Button>

            {currentStep < 5 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="min-h-[44px]"
              >
                Suivant
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createEmployee.isPending}
                className="min-h-[56px] px-8 bg-green-600 hover:bg-green-700"
              >
                {createEmployee.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Embauche en cours...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Embaucher l'employé
                  </>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
