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
 *
 * @param salary - The salary amount to validate
 * @param rateType - Optional rate type (MONTHLY, DAILY, HOURLY). Defaults to MONTHLY.
 */
export function useSalaryValidation(
  salary: number | null | undefined,
  rateType: 'MONTHLY' | 'DAILY' | 'HOURLY' = 'MONTHLY'
) {
  const [validationResult, setValidationResult] = useState<SalaryValidationResult | null>(null);

  // Get minimum wage from backend
  const { data: minWageData, isLoading } = trpc.salaries.getMinimumWage.useQuery();

  useEffect(() => {
    if (!minWageData || salary === null || salary === undefined) {
      setValidationResult(null);
      return;
    }

    // Convert salary to monthly equivalent for validation
    // For daily/hourly workers, we need to annualize to compare against monthly SMIG
    let monthlySalary = salary;
    let minimumWage = minWageData.minimumWage;
    let rateLabel = '';

    if (rateType === 'DAILY') {
      monthlySalary = Math.round(salary * 30);
      minimumWage = Math.round(minWageData.minimumWage / 30);
      rateLabel = '/jour';
    } else if (rateType === 'HOURLY') {
      monthlySalary = Math.round(salary * 240);
      minimumWage = Math.round(minWageData.minimumWage / 240);
      rateLabel = '/heure';
    }

    const isValid = monthlySalary >= minWageData.minimumWage;

    setValidationResult({
      isValid,
      minimumWage: rateType === 'MONTHLY' ? minWageData.minimumWage : minimumWage,
      countryCode: minWageData.countryCode,
      errorMessage: isValid
        ? undefined
        : rateType === 'MONTHLY'
        ? `Le salaire doit être >= SMIG du ${minWageData.countryName} (${minWageData.minimumWage.toLocaleString('fr-FR')} FCFA)`
        : `Le taux ${rateType === 'DAILY' ? 'journalier' : 'horaire'} doit être >= SMIG ${rateLabel} (${minimumWage.toLocaleString('fr-FR')} FCFA${rateLabel}). Équivalent mensuel: ${monthlySalary.toLocaleString('fr-FR')} FCFA (minimum: ${minWageData.minimumWage.toLocaleString('fr-FR')} FCFA).`,
    });
  }, [salary, minWageData, rateType]);

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
