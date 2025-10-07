/**
 * Minimum Wage Alert Component
 *
 * HCI Principles Applied:
 * - Pattern 3: Error Prevention (validate before submission)
 * - Pattern 5: Immediate Feedback (real-time validation)
 * - Pattern 7: Country-Specific Labels (reference SMIG CI)
 *
 * Formula: SMIG × (coefficient / 100)
 * Example: 75,000 FCFA × (450 / 100) = 337,500 FCFA minimum for Cadre
 */

'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface MinimumWageAlertProps {
  employeeId?: string;
  coefficient: number;
  currentSalary: number;
  countryMinimumWage: number; // SMIG from countries table
  countryCode: string;
  className?: string;
}

export function MinimumWageAlert({
  employeeId,
  coefficient,
  currentSalary,
  countryMinimumWage,
  countryCode,
  className,
}: MinimumWageAlertProps) {
  const [minimumWage, setMinimumWage] = useState<number>(0);

  // Calculate minimum wage
  useEffect(() => {
    const calculated = countryMinimumWage * (coefficient / 100);
    setMinimumWage(calculated);
  }, [coefficient, countryMinimumWage]);

  // Fetch category for display
  const { data: category } = trpc.employeeCategories.validateCoefficient.useQuery(
    {
      coefficient,
      countryCode,
    },
    {
      enabled: coefficient > 0,
    }
  );

  // Format currency (West African CFA Franc)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  // Determine alert state
  const isValid = currentSalary >= minimumWage;
  const difference = Math.abs(currentSalary - minimumWage);
  const percentageBelow = minimumWage > 0
    ? ((minimumWage - currentSalary) / minimumWage) * 100
    : 0;

  // Don't show if no salary entered yet
  if (currentSalary === 0) {
    return null;
  }

  // Valid salary (at or above minimum)
  if (isValid && currentSalary > minimumWage) {
    return (
      <Alert className={className}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          Salaire conforme au minimum légal pour cette catégorie.{' '}
          <span className="text-muted-foreground">
            (Minimum: {formatCurrency(minimumWage)})
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Exact minimum
  if (isValid && currentSalary === minimumWage) {
    return (
      <Alert className={className}>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Ce salaire correspond exactement au minimum légal{' '}
          <span className="font-medium">
            ({formatCurrency(minimumWage)})
          </span>
          {category?.suggestedCategory && (
            <span> pour la catégorie {category.suggestedCategory}</span>
          )}
          .
        </AlertDescription>
      </Alert>
    );
  }

  // Below minimum (ERROR)
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-2">
          <p className="font-semibold">
            Le salaire est inférieur au minimum légal pour un coefficient de{' '}
            {coefficient}.
          </p>

          <div className="text-sm space-y-1">
            <p>
              <strong>Salaire actuel:</strong> {formatCurrency(currentSalary)}
            </p>
            <p>
              <strong>Minimum requis:</strong> {formatCurrency(minimumWage)}
            </p>
            <p className="text-destructive-foreground/80">
              <strong>Différence:</strong> {formatCurrency(difference)}{' '}
              ({percentageBelow.toFixed(1)}% en dessous)
            </p>
          </div>

          <p className="text-xs mt-2 pt-2 border-t border-destructive/20">
            Calcul: SMIG de {countryCode === 'CI' ? "Côte d'Ivoire" : countryCode}{' '}
            ({formatCurrency(countryMinimumWage)}) × (coefficient {coefficient} / 100) ={' '}
            {formatCurrency(minimumWage)}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Lightweight info display without validation
 * Shows minimum wage info only
 */
export function MinimumWageInfo({
  coefficient,
  countryMinimumWage,
  countryCode,
  className,
}: {
  coefficient: number;
  countryMinimumWage: number;
  countryCode: string;
  className?: string;
}) {
  const minimumWage = countryMinimumWage * (coefficient / 100);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA';
  };

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      <p>
        <strong>Salaire minimum pour ce coefficient:</strong>{' '}
        {formatCurrency(minimumWage)}
      </p>
      <p className="text-xs mt-1">
        (SMIG {formatCurrency(countryMinimumWage)} × {coefficient}/100)
      </p>
    </div>
  );
}
