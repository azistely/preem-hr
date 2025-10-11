/**
 * Salary Validation Hook
 *
 * Real-time validation against country-specific minimum wage (SMIG)
 * Provides instant feedback for salary inputs
 */

import { trpc } from '@/lib/trpc/client';
import { useEffect, useState } from 'react';

export interface SalaryValidationResult {
  isValid: boolean;
  minimumWage: number;
  countryCode: string;
  errorMessage?: string;
}

/**
 * Validate salary against country-specific SMIG in real-time
 */
export function useSalaryValidation(salary: number | null | undefined) {
  const [validationResult, setValidationResult] = useState<SalaryValidationResult | null>(null);

  // Get minimum wage from backend
  const { data: minWageData, isLoading } = trpc.salaries.getMinimumWage.useQuery();

  useEffect(() => {
    if (!minWageData || salary === null || salary === undefined) {
      setValidationResult(null);
      return;
    }

    const isValid = salary >= minWageData.minimumWage;

    setValidationResult({
      isValid,
      minimumWage: minWageData.minimumWage,
      countryCode: minWageData.countryCode,
      errorMessage: isValid
        ? undefined
        : `Le salaire doit être >= SMIG du ${minWageData.countryName} (${minWageData.minimumWage.toLocaleString('fr-FR')} FCFA)`,
    });
  }, [salary, minWageData]);

  return {
    validationResult,
    isLoading,
    minimumWage: minWageData?.minimumWage,
    countryName: minWageData?.countryName,
  };
}

/**
 * Format currency (FCFA)
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) {
    return '0 FCFA';
  }
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}
