/**
 * Contract Alert Badges
 *
 * Visual indicators for contract alerts:
 * - FIN DE CONTRAT: CDD/CDDTI/INTERIM/STAGE contracts ending within 30 days
 * - PÉRIODE D'ESSAI: Employee in first 3 months of employment
 */

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { differenceInDays, addMonths, isBefore } from 'date-fns';

interface ContractEndingBadgeProps {
  contractEndDate: string | null;
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
}

interface TrialPeriodBadgeProps {
  hireDate: string | Date;
}

/**
 * Check if contract is ending within 30 days
 * Only applies to CDD, CDDTI, INTERIM, STAGE (not CDI)
 */
function isContractEnding(
  endDate: string | null,
  contractType: string | null
): boolean {
  // CDI contracts don't have end dates
  if (!endDate || contractType === 'CDI') {
    return false;
  }

  const today = new Date();
  const end = new Date(endDate);
  const daysUntilEnd = differenceInDays(end, today);

  // Show alert if ending within 30 days (including past due)
  return daysUntilEnd <= 30;
}

/**
 * Check if employee is still in trial period (first 3 months)
 */
function isInTrialPeriod(hireDate: string | Date): boolean {
  const today = new Date();
  const hire = new Date(hireDate);
  const trialEndDate = addMonths(hire, 3);

  return isBefore(today, trialEndDate);
}

/**
 * Contract Ending Badge
 * Shows "FIN DE CONTRAT" with warning style when contract ends within 30 days
 */
export function ContractEndingBadge({
  contractEndDate,
  contractType,
}: ContractEndingBadgeProps) {
  if (!isContractEnding(contractEndDate, contractType)) {
    return null;
  }

  return (
    <Badge
      variant="destructive"
      className="text-xs bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200"
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      Fin de contrat
    </Badge>
  );
}

/**
 * Trial Period Badge
 * Shows "PÉRIODE D'ESSAI" with info style when employee is in first 3 months
 */
export function TrialPeriodBadge({ hireDate }: TrialPeriodBadgeProps) {
  if (!hireDate || !isInTrialPeriod(hireDate)) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"
    >
      <Clock className="mr-1 h-3 w-3" />
      Période d'essai
    </Badge>
  );
}
