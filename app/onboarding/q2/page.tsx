/**
 * Onboarding Q2: First Employee + Payslip Preview
 *
 * CRITICAL SUCCESS MOMENT in the onboarding flow.
 * User adds their first employee with family status, sees immediate payslip preview.
 * This builds confidence and shows the system works.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { OnboardingQuestion } from '@/features/onboarding/components/onboarding-question';
import { EmployeeWizard } from '@/features/onboarding/components/employee-wizard';
import { SalaryPreviewCard } from '@/features/payroll/components/salary-preview';
import { toast } from 'sonner';
import type { SalaryPreviewData } from '@/features/payroll/components/salary-preview/types';

export default function OnboardingQ2Page() {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState<any>(null); // Store form data, not employee
  const [salaryPreview, setSalaryPreview] = useState<SalaryPreviewData | null>(null);

  // tRPC mutations
  const calculatePreviewMutation = api.payroll.calculateSalaryPreview.useMutation();
  const createEmployeeMutation = api.onboarding.createFirstEmployeeV2.useMutation();

  // Get user info for pre-filling
  const { data: user } = api.auth.me.useQuery();

  const handleEmployeeSubmit = async (data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    positionTitle: string;
    baseSalary?: number;
    baseComponents?: Record<string, number>;
    hireDate: Date;
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
    dependentChildren: number;
    contractType: 'CDI' | 'CDD' | 'STAGE';
    contractEndDate?: Date;
    category: string; // Dynamic CGECI category code
    departmentId?: string;
    rateType?: 'MONTHLY' | 'DAILY' | 'HOURLY';
    dailyRate?: number;
    hourlyRate?: number;
    components?: Array<{
      code: string;
      name: string;
      amount: number;
      sourceType: 'standard' | 'template';
    }>;
    transportAllowance?: number;
    housingAllowance?: number;
    mealAllowance?: number;
  }) => {
    try {
      // Ensure hireDate is a valid Date object before sending
      const submitData = {
        ...data,
        hireDate: data.hireDate instanceof Date ? data.hireDate : new Date(data.hireDate),
      };

      // PHASE 1: Calculate preview using unified endpoint
      const result = await calculatePreviewMutation.mutateAsync({
        context: 'hiring',
        baseSalary: submitData.baseSalary,
        baseComponents: submitData.baseComponents,
        rateType: submitData.rateType,
        contractType: submitData.contractType,
        hireDate: submitData.hireDate,
        maritalStatus: submitData.maritalStatus,
        dependentChildren: submitData.dependentChildren,
        components: submitData.components,
      });

      // Store form data and preview
      setFormData(submitData);
      setSalaryPreview(result.preview);
      setShowSuccess(true);

      toast.success(`Aperçu du bulletin de paie généré! 🎉`);
    } catch (error: any) {
      toast.error(error.message || 'Impossible de calculer la paie');
    }
  };

  const handleContinue = async () => {
    if (!formData) return;

    try {
      // PHASE 2: Actually create the employee in DB
      await createEmployeeMutation.mutateAsync(formData);

      toast.success(`${formData.firstName} ${formData.lastName} créé avec succès! 🎉`);
      router.push('/onboarding/success');
    } catch (error: any) {
      toast.error(error.message || 'Impossible de créer l\'employé');
    }
  };

  const handleEdit = () => {
    setShowSuccess(false);
    // Keep formData so form can be prefilled
  };

  return (
    <OnboardingQuestion
      title="Ajoutez votre premier employé"
      subtitle="Avec toutes les informations de contrat et de rémunération"
      progress={{ current: 2, total: 2 }}
    >
      {!showSuccess ? (
        <EmployeeWizard
          key={formData ? 'editing' : 'new'} // Force remount to apply saved values
          defaultValues={
            formData || {
              firstName: user?.firstName || '',
              lastName: user?.lastName || '',
              email: user?.email || '',
              positionTitle: 'Propriétaire',
              hireDate: new Date(),
              maritalStatus: 'single',
              dependentChildren: 0,
            }
          }
          initialStep={formData ? 4 : 0} // When editing, start at last step (Rémunération)
          onSubmit={handleEmployeeSubmit}
          isSubmitting={calculatePreviewMutation.isPending}
        />
      ) : salaryPreview ? (
        <div className="space-y-4">
          {/* Success message */}
          <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-900">
                {formData.firstName} {formData.lastName} ajouté(e)
              </h3>
              <p className="text-sm text-green-700">
                Profil créé et paie calculée automatiquement
              </p>
            </div>
          </div>

          {/* Salary Preview Card */}
          <SalaryPreviewCard
            preview={salaryPreview}
            context="hiring"
            onConfirm={handleContinue}
            onCancel={handleEdit}
            isLoading={createEmployeeMutation.isPending}
          />
        </div>
      ) : null}
    </OnboardingQuestion>
  );
}
