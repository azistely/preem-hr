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
import { EmployeeFormV2 } from '@/features/onboarding/components/employee-form-v2';
import { PayslipPreviewCard } from '@/features/onboarding/components/payslip-preview-card';
import { toast } from 'sonner';

export default function OnboardingQ2Page() {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState<any>(null); // Store form data, not employee
  const [payslipPreview, setPayslipPreview] = useState<any>(null);

  // tRPC mutations
  const calculatePreviewMutation = api.onboarding.calculatePayslipPreview.useMutation();
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

      // PHASE 1: Calculate preview only (no DB write)
      const result = await calculatePreviewMutation.mutateAsync({
        baseSalary: submitData.baseSalary,
        baseComponents: submitData.baseComponents,
        hireDate: submitData.hireDate,
        maritalStatus: submitData.maritalStatus,
        dependentChildren: submitData.dependentChildren,
        components: submitData.components,
      });

      // Store form data and preview
      setFormData(submitData);
      setPayslipPreview(result.payslipPreview);
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
      router.push('/onboarding/q3');
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
      subtitle="Pour générer votre première paie"
      progress={{ current: 2, total: 3 }}
    >
      {!showSuccess ? (
        <EmployeeFormV2
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
          onSubmit={handleEmployeeSubmit}
          isSubmitting={calculatePreviewMutation.isPending}
        />
      ) : (
        <PayslipPreviewCard
          employee={{
            firstName: formData.firstName,
            lastName: formData.lastName,
          }}
          payslip={payslipPreview}
          onContinue={handleContinue}
          onEdit={handleEdit}
          isCreating={createEmployeeMutation.isPending}
        />
      )}
    </OnboardingQuestion>
  );
}
