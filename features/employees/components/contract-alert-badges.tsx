/**
 * Contract Alert Badges & Info Components
 *
 * Visual indicators for contract status with actionable dates:
 * - ContractInfoCell: Full contract info for table view with dates
 * - ContractInfoCompact: Compact version for card/mobile view
 * - Legacy badges kept for backward compatibility
 */

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Calendar } from 'lucide-react';
import { differenceInDays, addMonths, isBefore, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ContractEndingBadgeProps {
  contractEndDate: string | null;
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
}

interface TrialPeriodBadgeProps {
  hireDate: string | Date;
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
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
 * Only applies to CDI contracts
 */
function isInTrialPeriod(hireDate: string | Date, contractType: string | null): boolean {
  // Trial period only applies to CDI contracts
  if (contractType !== 'CDI') {
    return false;
  }

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
 * Shows "PÉRIODE D'ESSAI" with info style when CDI employee is in first 3 months
 */
export function TrialPeriodBadge({ hireDate, contractType }: TrialPeriodBadgeProps) {
  if (!hireDate || !isInTrialPeriod(hireDate, contractType)) {
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

// ============================================================================
// NEW COMPONENTS: Contract Info with Actionable Dates
// ============================================================================

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  CDDTI: 'CDDTI',
  INTERIM: 'Intérim',
  STAGE: 'Stage',
};

interface ContractInfoProps {
  contractType: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE' | null;
  contractEndDate: string | null;
  hireDate: string | Date | null;
}

/**
 * Check if a contract has expired (end date is in the past)
 */
export function isContractExpired(
  contractEndDate: string | null,
  contractType: string | null
): boolean {
  // CDI contracts don't expire
  if (!contractEndDate || contractType === 'CDI') {
    return false;
  }
  const today = new Date();
  const end = new Date(contractEndDate);
  return end < today;
}

/**
 * Get urgency level and styling based on days remaining
 */
function getUrgencyStyle(daysRemaining: number): {
  textColor: string;
  bgColor: string;
  icon: 'warning' | 'critical' | 'expired' | null;
} {
  if (daysRemaining < 0) {
    return { textColor: 'text-red-900', bgColor: 'bg-red-100', icon: 'expired' };
  }
  if (daysRemaining <= 7) {
    return { textColor: 'text-red-700', bgColor: 'bg-red-50', icon: 'critical' };
  }
  if (daysRemaining <= 30) {
    return { textColor: 'text-orange-700', bgColor: 'bg-orange-50', icon: 'warning' };
  }
  return { textColor: 'text-muted-foreground', bgColor: '', icon: null };
}

/**
 * ContractInfoCell - Full contract info for table view
 *
 * Shows:
 * - Contract type badge (with EXPIRÉ warning if past end date)
 * - End date for CDD/CDDTI/INTERIM/STAGE
 * - Days remaining with color-coded urgency
 * - Trial period end date for CDI
 */
export function ContractInfoCell({ contractType, contractEndDate, hireDate }: ContractInfoProps) {
  if (!contractType) {
    return <span className="text-muted-foreground">-</span>;
  }

  const isCDI = contractType === 'CDI';
  const hasEndDate = !isCDI && contractEndDate;
  const inTrialPeriod = isCDI && hireDate && isInTrialPeriod(hireDate, contractType);
  const expired = isContractExpired(contractEndDate, contractType);

  // Calculate trial period end date for CDI
  const trialEndDate = hireDate ? addMonths(new Date(hireDate), 3) : null;

  // Calculate days remaining for contracts with end dates
  const daysRemaining = hasEndDate
    ? differenceInDays(new Date(contractEndDate), new Date())
    : null;

  const urgency = daysRemaining !== null ? getUrgencyStyle(daysRemaining) : null;

  return (
    <div className="space-y-1">
      {/* Contract Type Badge */}
      <div className="flex items-center gap-1">
        <Badge
          variant={isCDI ? 'default' : 'secondary'}
          className="text-xs"
        >
          {CONTRACT_TYPE_LABELS[contractType] || contractType}
        </Badge>
        {/* Prominent EXPIRÉ badge for expired contracts */}
        {expired && (
          <Badge
            variant="destructive"
            className="text-xs bg-red-600 text-white animate-pulse"
          >
            EXPIRÉ
          </Badge>
        )}
      </div>

      {/* End Date for CDD/CDDTI/INTERIM/STAGE */}
      {hasEndDate && (
        <div className="space-y-0.5">
          <div className={`flex items-center gap-1 text-xs ${expired ? 'text-red-700 font-medium' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3" />
            <span>Fin: {format(new Date(contractEndDate), 'd MMM yyyy', { locale: fr })}</span>
          </div>
          {daysRemaining !== null && daysRemaining < 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-red-700">
              <AlertTriangle className="h-3 w-3" />
              <span>Expiré depuis {Math.abs(daysRemaining)}j</span>
            </div>
          )}
          {daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30 && (
            <div className={`flex items-center gap-1 text-xs font-medium ${urgency?.textColor}`}>
              <AlertTriangle className="h-3 w-3" />
              <span>
                {daysRemaining === 0
                  ? "Expire aujourd'hui"
                  : `${daysRemaining}j restants`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Trial Period for CDI */}
      {inTrialPeriod && trialEndDate && (
        <div className="flex items-center gap-1 text-xs text-blue-700">
          <Clock className="h-3 w-3" />
          <span>Essai → {format(trialEndDate, 'd MMM', { locale: fr })}</span>
        </div>
      )}
    </div>
  );
}

/**
 * ContractInfoCompact - Compact contract info for card/mobile view
 *
 * Single line format: "CDD → 15 jan (38j)" or "CDD EXPIRÉ" for expired
 */
export function ContractInfoCompact({ contractType, contractEndDate, hireDate }: ContractInfoProps) {
  if (!contractType) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const isCDI = contractType === 'CDI';
  const hasEndDate = !isCDI && contractEndDate;
  const inTrialPeriod = isCDI && hireDate && isInTrialPeriod(hireDate, contractType);
  const trialEndDate = hireDate ? addMonths(new Date(hireDate), 3) : null;
  const expired = isContractExpired(contractEndDate, contractType);

  const daysRemaining = hasEndDate
    ? differenceInDays(new Date(contractEndDate), new Date())
    : null;

  const urgency = daysRemaining !== null ? getUrgencyStyle(daysRemaining) : null;

  // CDI with trial period
  if (isCDI && inTrialPeriod && trialEndDate) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="default" className="text-xs">CDI</Badge>
        <span className="text-blue-700 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Essai → {format(trialEndDate, 'd MMM', { locale: fr })}
        </span>
      </div>
    );
  }

  // CDI without trial
  if (isCDI) {
    return <Badge variant="default" className="text-xs">CDI</Badge>;
  }

  // Expired CDD/CDDTI/INTERIM/STAGE - show prominent warning
  if (expired && hasEndDate) {
    return (
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {CONTRACT_TYPE_LABELS[contractType] || contractType}
        </Badge>
        <Badge variant="destructive" className="text-xs bg-red-600 text-white animate-pulse">
          EXPIRÉ
        </Badge>
      </div>
    );
  }

  // CDD/CDDTI/INTERIM/STAGE with end date (not expired)
  if (hasEndDate && daysRemaining !== null) {
    return (
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {CONTRACT_TYPE_LABELS[contractType] || contractType}
        </Badge>
        <span className={`flex items-center gap-1 ${urgency?.textColor}`}>
          {urgency?.icon && <AlertTriangle className="h-3 w-3" />}
          <span>
            {format(new Date(contractEndDate), 'd MMM', { locale: fr })}
            {' '}
            ({daysRemaining}j)
          </span>
        </span>
      </div>
    );
  }

  // Fallback: just the badge
  return (
    <Badge variant="secondary" className="text-xs">
      {CONTRACT_TYPE_LABELS[contractType] || contractType}
    </Badge>
  );
}
