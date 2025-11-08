/**
 * Create Employee Page (Hire Wizard)
 *
 * Multi-step wizard for hiring a new employee
 * Following HCI principles: task-oriented, progressive disclosure, error prevention
 */

'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, User, Briefcase, DollarSign, CreditCard, Check, FileText, Heart } from 'lucide-react';
import { useCreateEmployee } from '@/features/employees/hooks/use-employee-mutations';
import { PersonalInfoStep } from '@/features/employees/components/hire-wizard/personal-info-step';
import { PersonnelRecordStep } from '@/features/employees/components/hire-wizard/personnel-record-step';
import { EmploymentInfoStep } from '@/features/employees/components/hire-wizard/employment-info-step';
import { BenefitsEnrollmentStep } from '@/features/employees/components/hire-wizard/benefits-enrollment-step';
import { BankingInfoStep } from '@/features/employees/components/hire-wizard/banking-info-step';
import { SalaryInfoStep } from '@/features/employees/components/hire-wizard/salary-info-step';
import { ConfirmationStep } from '@/features/employees/components/hire-wizard/confirmation-step';
import { buildEmployeeComponents } from '@/features/employees/actions/create-employee.action';
import Link from 'next/link';
import { api } from '@/trpc/react';

// Component schema
const componentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().min(0),
  sourceType: z.enum(['standard', 'custom', 'template', 'calculated', 'import']).default('standard'),
  metadata: z.record(z.any()).optional(),
});

// Benefits enrollment schema
const benefitEnrollmentSchema = z.object({
  planId: z.string(),
  effectiveFrom: z.date(),
});

// Form schema
const createEmployeeSchema = z.object({
  // Step 1: Personal info
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  preferredName: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().min(1, 'Le numéro de téléphone est requis'),
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  nationalId: z.string().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().default('single'),
  taxDependents: z.number().int().min(0).max(10).optional().default(0),

  // Step 2: Personnel Record (Registre du Personnel)
  nationalityZone: z.enum(['LOCAL', 'CEDEAO', 'HORS_CEDEAO']).optional(),
  employeeType: z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE']).optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  placeOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),

  // Step 3: Employment info
  hireDate: z.date(),
  contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE']).optional().default('CDI'),
  positionId: z.string().min(1, 'Le poste est requis'),
  coefficient: z.number().int().min(90).max(1000).optional().default(100),
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional().default('MONTHLY'),
  primaryLocationId: z.string().min(1, 'Le site principal est requis'),
  // CDDTI-specific fields
  cddtiTaskDescription: z.string().optional(),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  weeklyHoursRegime: z.enum(['40h', '44h', '48h']).optional().default('40h'),

  // Step 4: Benefits enrollment
  benefitEnrollments: z.array(benefitEnrollmentSchema).optional().default([]),

  // Step 5: Banking info
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),

  // Step 6: Salary info (base salary + components)
  baseSalary: z.number().min(0, 'Le salaire de base doit être positif').optional(),
  baseComponents: z.record(z.string(), z.number()).optional(),
  components: z.array(componentSchema).optional().default([]),
}).refine((data) => {
  // CDDTI contracts require task description (Article 4 Convention Collective)
  if (data.contractType === 'CDDTI' && !data.cddtiTaskDescription?.trim()) {
    return false;
  }
  return true;
}, {
  message: 'La description de la tâche est requise pour les contrats CDDTI (Article 4 Convention Collective)',
  path: ['cddtiTaskDescription'],
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
    title: 'Registre du Personnel',
    icon: FileText,
    description: 'Informations légales',
  },
  {
    id: 3,
    title: 'Informations d\'emploi',
    icon: Briefcase,
    description: 'Date d\'embauche, poste',
  },
  {
    id: 4,
    title: 'Avantages sociaux',
    icon: Heart,
    description: 'Couverture maladie, CMU',
  },
  {
    id: 5,
    title: 'Informations bancaires',
    icon: CreditCard,
    description: 'Compte, banque',
  },
  {
    id: 6,
    title: 'Salaire et indemnités',
    icon: DollarSign,
    description: 'Salaire de base, primes',
  },
  {
    id: 7,
    title: 'Confirmation',
    icon: Check,
    description: 'Vérifier et confirmer',
  },
];

export default function NewEmployeePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cityTransportMinimum, setCityTransportMinimum] = useState<number | null>(null);
  const [cityTransportDailyRate, setCityTransportDailyRate] = useState<number | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const createEmployee = useCreateEmployee();

  // Fetch transport minimum when location is selected
  const { data: transportMinData } = api.locations.getTransportMinimum.useQuery(
    { locationId: selectedLocationId! },
    { enabled: !!selectedLocationId }
  );

  // Update city transport minimum when data is fetched
  useEffect(() => {
    if (transportMinData) {
      setCityTransportMinimum(Number(transportMinData.monthlyMinimum));
      setCityTransportDailyRate(Number(transportMinData.dailyRate));
      setCityName(transportMinData.city);
    }
  }, [transportMinData]);

  const form = useForm<FormInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      // Step 1: Personal info
      firstName: '',
      lastName: '',
      preferredName: '',
      email: '',
      phone: '',
      nationalId: '',
      maritalStatus: 'single',
      taxDependents: 0,
      // Step 2: Personnel Record
      nationalityZone: undefined,
      employeeType: undefined,
      fatherName: '',
      motherName: '',
      placeOfBirth: '',
      emergencyContactName: '',
      // Step 3: Employment
      hireDate: new Date(),
      contractType: 'CDI',
      positionId: '',
      coefficient: 100,
      rateType: 'MONTHLY',
      primaryLocationId: '',
      paymentFrequency: 'WEEKLY',
      weeklyHoursRegime: '40h',
      // Step 4: Benefits
      benefitEnrollments: [],
      // Step 5: Banking
      bankName: '',
      bankAccount: '',
      // Step 6: Salary
      baseSalary: 75000,
      baseComponents: {},
      components: [],
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
      case 1: // Personal Info
        isValid = await form.trigger(['firstName', 'lastName', 'phone']);
        break;
      case 2: // Personnel Record
        isValid = true; // All personnel record fields are optional
        break;
      case 3: // Employment Info
        isValid = await form.trigger(['hireDate', 'contractType', 'positionId', 'coefficient', 'rateType', 'primaryLocationId']);

        // Update selected location ID to fetch transport minimum
        if (isValid) {
          const locationId = form.getValues('primaryLocationId');
          setSelectedLocationId(locationId);
        }
        break;
      case 4: // Benefits Enrollment
        isValid = true; // Benefits enrollment is optional
        break;
      case 5: // Banking Info
        isValid = true; // Banking info is optional
        break;
      case 6: // Salary Info
        // Validate form fields first
        isValid = await form.trigger(['baseSalary', 'baseComponents', 'components']);

        // Additional validation: Check salary meets category minimum wage
        if (isValid) {
          const baseSalary = form.getValues('baseSalary') || 0;
          const baseComponents = form.getValues('baseComponents') || {};
          const components = form.getValues('components') || [];
          const coefficient = form.getValues('coefficient') || 100;
          const primaryLocationId = form.getValues('primaryLocationId');

          // Calculate salaire catégoriel (Code 11 only)
          // This is the base that must meet the coefficient minimum
          const salaireCategoriel = baseComponents['11'] || baseSalary || 0;
          const contractType = form.getValues('contractType') || 'CDI';
          const rateType = form.getValues('rateType') || 'MONTHLY';

          // Validation 1: Check salaire catégoriel meets category minimum wage
          const countryMinimumWage = 75000; // TODO: Get from tenant/countries table

          // For CDDTI (hourly), convert minimum to hourly rate
          let requiredMinimum: number;
          let rateLabel: string;

          if (contractType === 'CDDTI' || rateType === 'HOURLY') {
            // Hourly SMIG = Monthly SMIG / 30 / 8
            requiredMinimum = Math.round(countryMinimumWage * (coefficient / 100) / 30 / 8);
            rateLabel = 'FCFA/heure';
          } else if (rateType === 'DAILY') {
            // Daily SMIG = Monthly SMIG / 30
            requiredMinimum = Math.round(countryMinimumWage * (coefficient / 100) / 30);
            rateLabel = 'FCFA/jour';
          } else {
            // Monthly (default)
            requiredMinimum = Math.round(countryMinimumWage * (coefficient / 100));
            rateLabel = 'FCFA/mois';
          }

          if (salaireCategoriel < requiredMinimum) {
            form.setError('baseSalary', {
              type: 'manual',
              message: `Le salaire catégoriel (${salaireCategoriel.toLocaleString('fr-FR')} FCFA) est inférieur au minimum requis (${requiredMinimum.toLocaleString('fr-FR')} FCFA) pour un coefficient de ${coefficient}.`,
            });
            isValid = false;
          }

          // Validation 2: Transport allowance (Code 22) is mandatory in Côte d'Ivoire
          const transportComponent = components.find((c: any) => c.code === '22');

          if (!transportComponent) {
            // Transport is mandatory - show error
            form.setError('components', {
              type: 'manual',
              message: `La prime de transport est obligatoire. Ajoutez la prime de transport (Code 22) en cliquant sur "Ajouter" ci-dessus.`,
            });
            isValid = false;
          } else if (transportComponent && cityTransportMinimum !== null && cityTransportDailyRate !== null && cityName) {
            // Validate against city-specific minimum from database
            // Use correct daily rate (÷26 working days) from database
            let transportMinimum = cityTransportMinimum;
            if (contractType === 'CDDTI' || rateType === 'HOURLY') {
              // Hourly rate: daily rate ÷ 8 hours
              transportMinimum = Math.round(cityTransportDailyRate / 8);
            } else if (rateType === 'DAILY') {
              // Daily rate: use database value (already ÷26)
              transportMinimum = Math.round(cityTransportDailyRate);
            }

            if (transportComponent.amount < transportMinimum) {
              form.setError('components', {
                type: 'manual',
                message: `La prime de transport (${transportComponent.amount.toLocaleString('fr-FR')} ${rateLabel}) est inférieure au minimum pour ${cityName} (${transportMinimum.toLocaleString('fr-FR')} ${rateLabel}).`,
              });
              isValid = false;
            }
          } else if (transportComponent && !cityTransportMinimum) {
            // Fallback validation if city data not yet loaded
            // This should rarely happen since location is selected in step 3
            // Use correct ÷26 working days calculation
            let fallbackMinimum = 20000;
            if (contractType === 'CDDTI' || rateType === 'HOURLY') {
              // Hourly: (20,000 ÷ 26 days) ÷ 8 hours = ~96 F/H
              fallbackMinimum = Math.round(20000 / 26 / 8);
            } else if (rateType === 'DAILY') {
              // Daily: 20,000 ÷ 26 days = ~769 F/day
              fallbackMinimum = Math.round(20000 / 26);
            }

            if (transportComponent.amount < fallbackMinimum) {
              form.setError('components', {
                type: 'manual',
                message: `La prime de transport (${transportComponent.amount.toLocaleString('fr-FR')} ${rateLabel}) est inférieure au minimum légal (${fallbackMinimum.toLocaleString('fr-FR')} ${rateLabel}). Le minimum varie selon la ville.`,
              });
              isValid = false;
            }
          }
        }
        break;
    }

    if (isValid && currentStep < 7) {
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
      <div className="mb-8 overflow-x-auto">
        <div className="flex items-center justify-between min-w-max md:min-w-0">
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
                <div className="mt-2 text-center hidden md:block max-w-[100px] lg:max-w-none">
                  <div
                    className={`text-xs lg:text-sm font-medium ${
                      currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 w-8 lg:w-16 mx-1 lg:mx-2 ${
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
              {currentStep === 2 && <PersonnelRecordStep form={form} />}
              {currentStep === 3 && <EmploymentInfoStep form={form} />}
              {currentStep === 4 && <BenefitsEnrollmentStep form={form} />}
              {currentStep === 5 && <BankingInfoStep form={form} />}
              {currentStep === 6 && <SalaryInfoStep form={form} />}
              {currentStep === 7 && <ConfirmationStep form={form} />}
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

            {currentStep < 7 ? (
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
