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
import confetti from 'canvas-confetti';

export default function OnboardingQ2Page() {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [payslipPreview, setPayslipPreview] = useState<any>(null);

  // tRPC mutation
  const createEmployeeMutation = api.onboarding.createFirstEmployeeV2.useMutation();

  // Get user info for pre-filling
  const { data: user } = api.auth.me.useQuery();

  const handleEmployeeSubmit = async (data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    positionTitle: string;
    baseSalary: number;
    hireDate: Date;
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
    dependentChildren: number;
    transportAllowance?: number;
    housingAllowance?: number;
    mealAllowance?: number;
  }) => {
    try {
      const result = await createEmployeeMutation.mutateAsync(data);

      // Store results
      setEmployeeData(result.employee);
      setPayslipPreview(result.payslipPreview);
      setShowSuccess(true);

      // Confetti animation!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success(`${data.firstName} ${data.lastName} ajouté avec succès!`);
    } catch (error: any) {
      toast.error(error.message || 'Impossible de créer l\'employé');
    }
  };

  const handleContinue = () => {
    router.push('/onboarding/q3');
  };

  const handleEdit = () => {
    setShowSuccess(false);
    setEmployeeData(null);
    setPayslipPreview(null);
  };

  return (
    <OnboardingQuestion
      title="Ajoutez votre premier employé"
      subtitle="Pour générer votre première paie"
      progress={{ current: 2, total: 3 }}
    >
      {!showSuccess ? (
        <EmployeeFormV2
          defaultValues={{
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            email: user?.email || '',
            positionTitle: 'Propriétaire',
            hireDate: new Date(),
            maritalStatus: 'single',
            dependentChildren: 0,
          }}
          onSubmit={handleEmployeeSubmit}
          isSubmitting={createEmployeeMutation.isPending}
        />
      ) : (
        <PayslipPreviewCard
          employee={{
            firstName: employeeData.firstName,
            lastName: employeeData.lastName,
          }}
          payslip={payslipPreview}
          onContinue={handleContinue}
          onEdit={handleEdit}
        />
      )}
    </OnboardingQuestion>
  );
}
