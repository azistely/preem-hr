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
import { buildEmployeeComponents } from '@/features/employees/actions/create-employee.action';
import Link from 'next/link';

// Component schema
const componentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().min(0),
  sourceType: z.enum(['standard', 'custom', 'calculated']).default('standard'),
  metadata: z.record(z.any()).optional(),
});

// Form schema
const createEmployeeSchema = z.object({
  // Personal info
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  preferredName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().min(1, 'Le numéro de téléphone est requis'),
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  nationalId: z.string().optional(),

  // Employment info
  hireDate: z.date(),
  positionId: z.string().min(1, 'Le poste est requis'),
  coefficient: z.number().int().min(90).max(1000).optional().default(100),
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional().default('MONTHLY'),
  primaryLocationId: z.string().min(1, 'Le site principal est requis'),

  // Salary info (base salary + components)
  baseSalary: z.number().min(0, 'Le salaire de base doit être positif').optional(),
  baseComponents: z.record(z.string(), z.number()).optional(),
  components: z.array(componentSchema).optional().default([]),

  // Banking info
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),

  // Tax info
  taxDependents: z.number().int().min(0).max(10).optional().default(0),
});

type FormData = z.infer<typeof createEmployeeSchema>;

// Type-safe form data that matches the schema inference
type FormInput = z.input<typeof createEmployeeSchema>;

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createEmployee = useCreateEmployee();

  const form = useForm<FormInput>({
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
      coefficient: 100,
      rateType: 'MONTHLY',
      primaryLocationId: '',
      baseSalary: 75000,
      baseComponents: {},
      components: [],
      bankName: '',
      bankAccount: '',
      taxDependents: 0,
    },
  });

  const onSubmit = async (data: FormInput) => {
    setIsSubmitting(true);
    console.log('[Employee Creation] Starting submission from step 5');

    // Generate default email if not provided (DB requires email field)
    // Remove accents and special characters for valid email format
    const email = data.email && data.email !== ''
      ? data.email
      : `${data.firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${data.lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@example.com`;

    // ========================================
    // BUILD BASE SALARY COMPONENTS (Code 11, 12, etc.)
    // ========================================
    // Calculate baseSalary from baseComponents or use baseSalary field
    const baseComponents = data.baseComponents || {};
    const baseSalary = Object.keys(baseComponents).length > 0
      ? Object.values(baseComponents).reduce((sum: number, amt: any) => sum + (amt || 0), 0)
      : (data.baseSalary ?? 0);

    // Use server action to build components (includes Code 11)
    const countryCode = 'CI'; // TODO: Get from tenant context
    const allowanceComponents = (data.components || []).map(c => ({
      ...c,
      sourceType: c.sourceType || 'standard' as const,
    }));
    const allComponents = await buildEmployeeComponents(
      baseSalary,
      baseComponents,
      allowanceComponents,
      countryCode
    );

    // Transform to API format (all defaults are applied by Zod)
    try {
      await createEmployee.mutateAsync({
        ...data,
        email,
        baseSalary,
        coefficient: data.coefficient ?? 100,
        taxDependents: data.taxDependents ?? 0,
        components: allComponents, // ✅ Now includes Code 11!
        rateType: data.rateType ?? 'MONTHLY',
        // Note: primaryLocationId will be added to employee in a future update
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    let isValid = false;

    // Validate current step fields
    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['firstName', 'lastName', 'phone']);
        break;
      case 2:
        isValid = await form.trigger(['hireDate', 'positionId', 'coefficient', 'rateType', 'primaryLocationId']);
        break;
      case 3:
        // Validate form fields first
        isValid = await form.trigger(['baseSalary', 'baseComponents', 'components']);

        // Additional validation: Check salary meets category minimum wage
        if (isValid) {
          const baseSalary = form.getValues('baseSalary') || 0;
          const baseComponents = form.getValues('baseComponents') || {};
          const components = form.getValues('components') || [];
          const coefficient = form.getValues('coefficient') || 100;
          const primaryLocationId = form.getValues('primaryLocationId');

          // Calculate total gross salary
          const baseSalaryTotal = Object.keys(baseComponents).length > 0
            ? Object.values(baseComponents).reduce((sum: number, amt: any) => sum + (amt || 0), 0)
            : baseSalary;

          const componentTotal = components.reduce(
            (sum: number, component: any) => sum + (component.amount || 0),
            0
          );

          const totalGross = baseSalaryTotal + componentTotal;

          // Validation 1: Check salary meets category minimum wage
          const countryMinimumWage = 75000; // TODO: Get from tenant/countries table
          const requiredMinimum = countryMinimumWage * (coefficient / 100);

          if (totalGross < requiredMinimum) {
            form.setError('baseSalary', {
              type: 'manual',
              message: `Le salaire total (${totalGross.toLocaleString('fr-FR')} FCFA) est inférieur au minimum requis (${requiredMinimum.toLocaleString('fr-FR')} FCFA) pour un coefficient de ${coefficient}.`,
            });
            isValid = false;
          }

          // Validation 2: Check transport allowance (Code 22) meets city minimum
          // Note: This validation should be done BEFORE allowing step progression
          // The actual city lookup happens in the SalaryInfoStep component
          // We just check if Code 22 exists and has a reasonable minimum
          const transportComponent = components.find((c: any) => c.code === '22');

          if (transportComponent) {
            // Minimum transport allowance is 20,000 FCFA (lowest tier for "other cities")
            // City-specific minimums: Abidjan (30,000), Bouaké (24,000), Other (20,000)
            const absoluteMinimum = 20000;

            if (transportComponent.amount < absoluteMinimum) {
              form.setError('components', {
                type: 'manual',
                message: `La prime de transport (${transportComponent.amount.toLocaleString('fr-FR')} FCFA) est inférieure au minimum légal (minimum: ${absoluteMinimum.toLocaleString('fr-FR')} FCFA). Le minimum varie selon la ville: Abidjan (30 000 FCFA), Bouaké (24 000 FCFA), autres villes (20 000 FCFA).`,
              });
              isValid = false;
            }
          }
        }
        break;
      case 4:
        isValid = true; // Banking info is optional
        break;
    }

    if (isValid && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle final submission (only called from step 5 button click)
  const handleFinalSubmit = async () => {
    // Prevent double submission
    if (isSubmitting || createEmployee.isPending) {
      console.warn('[Employee Creation] Submit blocked: already submitting');
      return;
    }

    // Validate all fields before submission
    const isValid = await form.trigger();
    if (!isValid) {
      console.warn('[Employee Creation] Submit blocked: form validation failed');
      return;
    }

    // Get form data and submit
    const data = form.getValues();
    await onSubmit(data);
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

      {/* Form - Note: We use a div instead of form element to prevent implicit submissions */}
      <Form {...form}>
        <div>
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
                type="button"
                onClick={handleFinalSubmit}
                disabled={createEmployee.isPending || isSubmitting}
                className="min-h-[56px] px-8 bg-green-600 hover:bg-green-700"
              >
                {(createEmployee.isPending || isSubmitting) ? (
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
        </div>
      </Form>
    </div>
  );
}
