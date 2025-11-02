/**
 * Payroll Preview Card
 *
 * Shows calculated payroll preview with before/after comparison
 * Uses unified payroll.calculateSalaryPreview endpoint for server-side calculation
 *
 * HCI Principles:
 * - Progressive disclosure: Only shown when user clicks "Calculer l'aperçu"
 * - Immediate feedback: Shows loading state during calculation
 * - Clear visual comparison: Before vs After with percentage change
 * - French language: All labels in French
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { api } from '@/trpc/react';
import type { SalaryComponentInstance } from '../../types/salary-components';
import type { PaymentFrequency } from '../../utils/payment-frequency-labels';
import { SalaryPreviewCard } from '@/features/payroll/components/salary-preview';
import type { SalaryPreviewData, SalaryPreviewComparison } from '@/features/payroll/components/salary-preview/types';

interface PayrollPreviewCardProps {
  employeeId: string;
  countryCode: string;
  newComponents: SalaryComponentInstance[];
  currentComponents?: SalaryComponentInstance[]; // Pass current components to calculate old net
  onCalculate?: () => void;
  isCalculating?: boolean;
  paymentFrequency?: PaymentFrequency; // Payment frequency (DAILY, WEEKLY, BIWEEKLY, MONTHLY)
  contractType?: string; // Contract type (CDI, CDD, CDDTI, STAGE)
  isExpat?: boolean; // For ITS employer tax calculation (1.2% local, 10.4% expat)
}

export function PayrollPreviewCard({
  employeeId,
  countryCode,
  newComponents,
  currentComponents,
  onCalculate,
  isCalculating,
  paymentFrequency = 'MONTHLY',
  contractType = 'CDI',
  isExpat = false,
}: PayrollPreviewCardProps) {
  const [salaryPreview, setSalaryPreview] = useState<SalaryPreviewData | null>(null);
  const [comparison, setComparison] = useState<SalaryPreviewComparison | null>(null);

  // Use unified tRPC mutation for NEW salary preview calculation
  const calculateNewPreviewMutation = api.payroll.calculateSalaryPreview.useMutation({
    onSuccess: (result) => {
      setSalaryPreview(result.preview);
    },
  });

  // Use unified tRPC mutation for CURRENT salary preview calculation (for comparison)
  const calculateCurrentPreviewMutation = api.payroll.calculateSalaryPreview.useMutation();

  // Calculate previews when components change
  useEffect(() => {
    if (newComponents.length === 0) return;

    // Calculate new salary preview
    // For CDDTI workers, components are stored in hourly amounts
    // Backend will calculate based on paymentFrequency and contractType
    calculateNewPreviewMutation.mutate({
      context: 'salary_edit',
      employeeId,
      components: newComponents.map(c => ({
        code: c.code,
        name: c.name,
        amount: c.amount,
        sourceType: c.sourceType as 'standard' | 'template' | 'import',
      })),
      contractType: contractType as any,
      isExpat, // For ITS employer tax calculation
    });

    // Calculate current salary preview for comparison (if available)
    if (currentComponents && currentComponents.length > 0) {
      calculateCurrentPreviewMutation.mutate({
        context: 'salary_edit',
        employeeId,
        components: currentComponents.map(c => ({
          code: c.code,
          name: c.name,
          amount: c.amount,
          sourceType: (c.sourceType || 'standard') as 'standard' | 'template' | 'import',
        })),
        contractType: contractType as any,
        isExpat, // For ITS employer tax calculation
      }, {
        onSuccess: (currentResult) => {
          // Calculate comparison when both previews are available
          if (salaryPreview) {
            setComparison({
              previousNetSalary: currentResult.preview.netSalary,
              newNetSalary: salaryPreview.netSalary,
              netDifference: salaryPreview.netSalary - currentResult.preview.netSalary,
            });
          }
        },
      });
    }
  }, [newComponents, currentComponents, employeeId, isExpat]);

  // Update comparison when salaryPreview changes
  useEffect(() => {
    if (salaryPreview && calculateCurrentPreviewMutation.data) {
      setComparison({
        previousNetSalary: calculateCurrentPreviewMutation.data.preview.netSalary,
        newNetSalary: salaryPreview.netSalary,
        netDifference: salaryPreview.netSalary - calculateCurrentPreviewMutation.data.preview.netSalary,
      });
    }
  }, [salaryPreview, calculateCurrentPreviewMutation.data]);

  // Notify parent when calculation completes
  useEffect(() => {
    if (salaryPreview && onCalculate) {
      onCalculate();
    }
  }, [salaryPreview, onCalculate]);

  const loading = calculateNewPreviewMutation.isPending || calculateCurrentPreviewMutation.isPending || isCalculating;
  const error = calculateNewPreviewMutation.error || calculateCurrentPreviewMutation.error;

  if (loading) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Calcul en cours...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6">
          <p className="text-sm text-destructive text-center">
            {error.message || 'Erreur lors du calcul'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!salaryPreview) {
    return null;
  }

  // Don't show comparison for weekly/daily workers as it compares different time periods
  // (weekly preview vs monthly current salary)
  const shouldShowComparison = paymentFrequency === 'MONTHLY' && comparison;

  return (
    <SalaryPreviewCard
      preview={salaryPreview}
      context="salary_edit"
      comparison={shouldShowComparison ? comparison : undefined}
    />
  );
}
