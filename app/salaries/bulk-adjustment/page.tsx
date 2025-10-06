/**
 * Bulk Salary Adjustment Wizard
 *
 * Multi-step wizard for applying salary adjustments to multiple employees
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
import { Loader2, Users, Sliders, Eye, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

// Wizard Steps Components
import { AdjustmentDetailsStep } from '@/features/employees/components/bulk-adjustment/adjustment-details-step';
import { FilterEmployeesStep } from '@/features/employees/components/bulk-adjustment/filter-employees-step';
import { PreviewStep } from '@/features/employees/components/bulk-adjustment/preview-step';
import { ConfirmationStep } from '@/features/employees/components/bulk-adjustment/confirmation-step';

const bulkAdjustmentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional(),
  adjustmentType: z.enum(['percentage', 'fixed_amount', 'custom']),
  adjustmentValue: z.number().min(0, 'La valeur doit être positive').optional(),
  effectiveFrom: z.date(),
  filters: z.object({
    departmentIds: z.array(z.string()).optional(),
    positionIds: z.array(z.string()).optional(),
    minSalary: z.number().optional(),
    maxSalary: z.number().optional(),
    employeeIds: z.array(z.string()).optional(),
  }).optional(),
});

type FormData = z.infer<typeof bulkAdjustmentSchema>;

const steps = [
  {
    id: 1,
    title: 'Détails de l\'ajustement',
    icon: Sliders,
    description: 'Type et valeur d\'ajustement',
  },
  {
    id: 2,
    title: 'Filtrer les employés',
    icon: Users,
    description: 'Sélectionner qui sera affecté',
  },
  {
    id: 3,
    title: 'Aperçu',
    icon: Eye,
    description: 'Vérifier les changements',
  },
  {
    id: 4,
    title: 'Confirmation',
    icon: Check,
    description: 'Appliquer les ajustements',
  },
];

export default function BulkSalaryAdjustmentPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [adjustmentId, setAdjustmentId] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const createAdjustment = trpc.bulkAdjustments.create.useMutation();
  const executeAdjustment = trpc.bulkAdjustments.execute.useMutation();

  const form = useForm<FormData>({
    resolver: zodResolver(bulkAdjustmentSchema),
    defaultValues: {
      adjustmentType: 'percentage',
      effectiveFrom: new Date(),
      filters: {},
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      // Step 2: Create adjustment draft
      if (currentStep === 2 && !adjustmentId) {
        const adjustment = await createAdjustment.mutateAsync(data);
        setAdjustmentId(adjustment.id);
        setCurrentStep(3);
        return;
      }

      // Step 4: Execute adjustment
      if (currentStep === 4 && adjustmentId) {
        await executeAdjustment.mutateAsync({ adjustmentId });
        toast({
          title: 'Ajustements appliqués',
          description: 'Les salaires ont été mis à jour avec succès',
        });
        router.push('/salaries');
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors du traitement',
        variant: 'destructive',
      });
    }
  };

  const nextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['name', 'adjustmentType', 'adjustmentValue', 'effectiveFrom']);
        break;
      case 2:
        isValid = true;
        await form.handleSubmit(onSubmit)();
        return;
      case 3:
        isValid = true;
        setCurrentStep(4);
        return;
    }

    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/salaries">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Ajustement salarial groupé</h1>
        <p className="text-muted-foreground mt-2">
          Appliquez des augmentations ou réductions à plusieurs employés en même temps
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
              {currentStep === 1 && <AdjustmentDetailsStep form={form} />}
              {currentStep === 2 && <FilterEmployeesStep form={form} />}
              {currentStep === 3 && adjustmentId && <PreviewStep adjustmentId={adjustmentId} />}
              {currentStep === 4 && <ConfirmationStep form={form} />}
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

            {currentStep < 4 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={createAdjustment.isPending}
                className="min-h-[44px]"
              >
                {createAdjustment.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Suivant
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={executeAdjustment.isPending}
                className="min-h-[56px] px-8 bg-green-600 hover:bg-green-700"
              >
                {executeAdjustment.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Application en cours...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Appliquer les ajustements
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
