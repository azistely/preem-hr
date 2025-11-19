/**
 * CDDTI Compliance Service
 *
 * Handles Daily/Task-based Contract (CDDTI) compliance tracking per West African labor laws:
 * - Maximum 12 months from hiring date
 * - Automatic conversion to CDI or CDD required after 12 months
 * - Alert generation 90/60/30 days before limit and at 12 months
 *
 * @see docs/CENTRAL-CONTRACT-MANAGEMENT-SYSTEM.md
 */

import { db } from '@/lib/db';
import {
  employmentContracts,
  contractComplianceAlerts,
  employees
} from '@/drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  addMonths,
  differenceInMonths,
  differenceInDays,
  format,
  parseISO
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export type CDDTIAlertType =
  | '90_day_warning'
  | '60_day_warning'
  | '30_day_warning'
  | '12_month_limit';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type CDDTIActionTaken =
  | 'converted_to_cdi'
  | 'adjusted_to_cdd'
  | 'terminated'
  | 'ignored';

export interface CDDTIComplianceAlert {
  type: CDDTIAlertType;
  severity: AlertSeverity;
  message: string;
  actionRequired: string;
}

export interface CDDTIComplianceStatus {
  isCompliant: boolean;
  conversionDue: boolean;
  monthsElapsed: number;
  monthsRemaining: number;
  limitDate: Date;
  alerts: CDDTIComplianceAlert[];
  contract?: typeof employmentContracts.$inferSelect;
}

export interface CDDTIValidationResult {
  allowed: boolean;
  reason?: string;
  monthsElapsed?: number;
}

// ============================================================================
// CDDTI Compliance Service Class
// ============================================================================

export class CDDTIComplianceService {
  /**
   * Check CDDTI compliance for an employee
   *
   * Validates:
   * - 12-month limit from hiring date (contract start date)
   * - Generates alerts at 9, 10, 11, and 12+ months
   *
   * @param employeeId - Employee UUID
   * @param tenantId - Tenant UUID for security
   * @returns Compliance status with alerts
   */
  async checkCDDTICompliance(
    employeeId: string,
    tenantId: string
  ): Promise<CDDTIComplianceStatus> {
    // 1. Get active CDDTI contract
    const activeContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.employeeId, employeeId),
          eq(employmentContracts.tenantId, tenantId),
          eq(employmentContracts.contractType, 'CDDTI'),
          eq(employmentContracts.isActive, true)
        )
      )
      .limit(1);

    const activeContract = activeContracts[0];

    if (!activeContract) {
      return {
        isCompliant: true,
        conversionDue: false,
        monthsElapsed: 0,
        monthsRemaining: 12,
        limitDate: new Date(),
        alerts: [],
      };
    }

    // 2. Calculate months elapsed from hiring date (start date)
    const today = new Date();
    const startDate = typeof activeContract.startDate === 'string'
      ? parseISO(activeContract.startDate)
      : activeContract.startDate;

    const monthsElapsed = differenceInMonths(today, startDate);
    const monthsRemaining = Math.max(0, 12 - monthsElapsed);
    const limitDate = addMonths(startDate, 12);

    // 3. Determine compliance status
    const isCompliant = monthsElapsed < 12;
    const conversionDue = monthsElapsed >= 12;

    // 4. Generate alerts based on proximity to 12-month limit
    const alerts: CDDTIComplianceAlert[] = [];
    const daysUntilLimit = differenceInDays(limitDate, today);

    // Alert: 90 days before limit (at 9 months)
    if (daysUntilLimit <= 90 && daysUntilLimit > 60) {
      alerts.push({
        type: '90_day_warning',
        severity: 'info',
        message: `Le contrat CDDTI atteindra 12 mois le ${format(limitDate, 'dd/MM/yyyy')}. Conversion en CDI ou CDD requise.`,
        actionRequired: 'Planifier la conversion dans les 90 prochains jours',
      });
    }

    // Alert: 60 days before limit (at 10 months)
    if (daysUntilLimit <= 60 && daysUntilLimit > 30) {
      alerts.push({
        type: '60_day_warning',
        severity: 'warning',
        message: `Attention : Le contrat CDDTI atteindra 12 mois dans 60 jours. Action requise.`,
        actionRequired: 'Convertir en CDI ou CDD avant le ' + format(limitDate, 'dd/MM/yyyy'),
      });
    }

    // Alert: 30 days before limit (at 11 months)
    if (daysUntilLimit <= 30 && daysUntilLimit > 0) {
      alerts.push({
        type: '30_day_warning',
        severity: 'warning',
        message: `Urgent : Le contrat CDDTI atteindra 12 mois dans ${daysUntilLimit} jours.`,
        actionRequired: 'Convertir immédiatement en CDI ou CDD',
      });
    }

    // Alert: 12-month limit reached or exceeded
    if (monthsElapsed >= 12) {
      alerts.push({
        type: '12_month_limit',
        severity: 'critical',
        message: `CRITIQUE : Le contrat CDDTI a dépassé 12 mois (${monthsElapsed} mois). Conversion obligatoire.`,
        actionRequired: 'Convertir en CDI ou CDD immédiatement (non-conformité légale)',
      });
    }

    return {
      isCompliant,
      conversionDue,
      monthsElapsed,
      monthsRemaining,
      limitDate,
      alerts,
      contract: activeContract,
    };
  }

  /**
   * Validate if CDDTI contract is within 12-month limit
   *
   * @param contractId - CDDTI contract UUID
   * @returns Validation result with reason if not allowed
   */
  async validateCDDTILimit(contractId: string): Promise<CDDTIValidationResult> {
    const contracts = await db
      .select()
      .from(employmentContracts)
      .where(eq(employmentContracts.id, contractId))
      .limit(1);

    const contract = contracts[0];

    if (!contract) {
      return { allowed: false, reason: 'Contrat CDDTI introuvable' };
    }

    if (contract.contractType !== 'CDDTI') {
      return { allowed: false, reason: 'Le contrat n\'est pas de type CDDTI' };
    }

    const today = new Date();
    const startDate = typeof contract.startDate === 'string'
      ? parseISO(contract.startDate)
      : contract.startDate;

    const monthsElapsed = differenceInMonths(today, startDate);

    if (monthsElapsed >= 12) {
      return {
        allowed: false,
        reason: `Le contrat CDDTI a dépassé 12 mois (${monthsElapsed} mois). Conversion en CDI ou CDD requise.`,
        monthsElapsed,
      };
    }

    return { allowed: true, monthsElapsed };
  }

  /**
   * Convert CDDTI to CDI (permanent contract)
   *
   * Steps:
   * 1. Validate CDDTI exists and belongs to tenant
   * 2. Terminate CDDTI contract
   * 3. Create new CDI contract (no end date)
   * 4. Update employee.currentContractId
   * 5. Dismiss all CDDTI compliance alerts
   *
   * @param contractId - CDDTI contract UUID
   * @param conversionDate - Date of conversion (default: today)
   * @param userId - User performing the action
   * @param tenantId - Tenant UUID for security
   * @returns New CDI contract
   */
  async convertCDDTIToCDI(
    contractId: string,
    conversionDate: Date,
    userId: string,
    tenantId: string
  ): Promise<typeof employmentContracts.$inferSelect> {
    // 1. Load CDDTI contract
    const cddtiContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.id, contractId),
          eq(employmentContracts.tenantId, tenantId),
          eq(employmentContracts.contractType, 'CDDTI')
        )
      )
      .limit(1);

    const cddtiContract = cddtiContracts[0];

    if (!cddtiContract) {
      throw new Error('Contrat CDDTI introuvable ou accès refusé');
    }

    // 2. Terminate CDDTI
    await db
      .update(employmentContracts)
      .set({
        isActive: false,
        terminationDate: conversionDate.toISOString().split('T')[0],
        terminationReason: 'Conversion en CDI (limite 12 mois atteinte)',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employmentContracts.id, contractId));

    // 3. Create CDI contract
    const cdiContracts = await db
      .insert(employmentContracts)
      .values({
        tenantId,
        employeeId: cddtiContract.employeeId,
        contractType: 'CDI',
        startDate: conversionDate.toISOString().split('T')[0]!,
        endDate: null, // CDI has no end date
        contractNumber: `CDI-${format(conversionDate, 'yyyy')}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        isActive: true,
        renewalCount: 0,
        replacesContractId: contractId,
        notes: `Converti depuis CDDTI ${cddtiContract.contractNumber || contractId} suite à limite 12 mois`,
        createdBy: userId,
      })
      .returning();

    const cdiContract = cdiContracts[0]!;

    // 4. Update employee.currentContractId
    await db
      .update(employees)
      .set({
        currentContractId: cdiContract.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employees.id, cddtiContract.employeeId));

    // 5. Dismiss all CDDTI compliance alerts
    await db
      .update(contractComplianceAlerts)
      .set({
        isDismissed: true,
        dismissedAt: new Date().toISOString(),
        dismissedBy: userId,
        actionTaken: 'converted_to_cdi',
      })
      .where(
        and(
          eq(contractComplianceAlerts.contractId, contractId),
          eq(contractComplianceAlerts.isDismissed, false)
        )
      );

    return cdiContract;
  }

  /**
   * Convert CDDTI to CDD (HR discretion adjustment)
   *
   * Steps:
   * 1. Validate CDDTI exists and CDD duration is valid
   * 2. Terminate CDDTI contract
   * 3. Create new CDD contract with specified end date
   * 4. Update employee.currentContractId
   * 5. Dismiss CDDTI alerts
   *
   * @param contractId - CDDTI contract UUID
   * @param cddEndDate - End date for new CDD
   * @param cddReason - Reason for CDD (e.g., 'remplacement', 'accroissement_activite')
   * @param conversionDate - Date of conversion (default: today)
   * @param userId - User performing the action
   * @param tenantId - Tenant UUID for security
   * @returns New CDD contract
   */
  async convertCDDTIToCDD(
    contractId: string,
    cddEndDate: Date,
    cddReason: string,
    conversionDate: Date,
    userId: string,
    tenantId: string
  ): Promise<typeof employmentContracts.$inferSelect> {
    // 1. Validate CDD duration <= 24 months
    const durationMonths = differenceInMonths(cddEndDate, conversionDate);
    if (durationMonths > 24) {
      throw new Error('La durée du CDD ne peut pas dépasser 24 mois');
    }

    // 2. Load CDDTI contract
    const cddtiContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.id, contractId),
          eq(employmentContracts.tenantId, tenantId),
          eq(employmentContracts.contractType, 'CDDTI')
        )
      )
      .limit(1);

    const cddtiContract = cddtiContracts[0];

    if (!cddtiContract) {
      throw new Error('Contrat CDDTI introuvable ou accès refusé');
    }

    // 3. Terminate CDDTI
    await db
      .update(employmentContracts)
      .set({
        isActive: false,
        terminationDate: conversionDate.toISOString().split('T')[0],
        terminationReason: 'Conversion en CDD (décision RH)',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employmentContracts.id, contractId));

    // 4. Create CDD contract
    const cddContracts = await db
      .insert(employmentContracts)
      .values({
        tenantId,
        employeeId: cddtiContract.employeeId,
        contractType: 'CDD',
        startDate: conversionDate.toISOString().split('T')[0]!,
        endDate: cddEndDate.toISOString().split('T')[0]!,
        cddReason,
        cddTotalDurationMonths: durationMonths,
        renewalCount: 0,
        contractNumber: `CDD-${format(conversionDate, 'yyyy')}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        isActive: true,
        replacesContractId: contractId,
        notes: `Converti depuis CDDTI ${cddtiContract.contractNumber || contractId} (décision RH)`,
        createdBy: userId,
      })
      .returning();

    const cddContract = cddContracts[0]!;

    // 5. Update employee.currentContractId
    await db
      .update(employees)
      .set({
        currentContractId: cddContract.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employees.id, cddtiContract.employeeId));

    // 6. Dismiss CDDTI alerts
    await db
      .update(contractComplianceAlerts)
      .set({
        isDismissed: true,
        dismissedAt: new Date().toISOString(),
        dismissedBy: userId,
        actionTaken: 'adjusted_to_cdd',
      })
      .where(
        and(
          eq(contractComplianceAlerts.contractId, contractId),
          eq(contractComplianceAlerts.isDismissed, false)
        )
      );

    return cddContract;
  }

  /**
   * Generate daily CDDTI compliance alerts for all active contracts
   * Should be run daily via cron job
   *
   * Scans all active CDDTI contracts and creates alerts based on 12-month limit proximity
   *
   * @param tenantId - Tenant UUID
   * @returns Count of new alerts created
   */
  async generateDailyCDDTIAlerts(tenantId: string): Promise<number> {
    const today = new Date();
    let alertsCreated = 0;

    // 1. Load all active CDDTI contracts
    const cddtiContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.tenantId, tenantId),
          eq(employmentContracts.contractType, 'CDDTI'),
          eq(employmentContracts.isActive, true)
        )
      );

    // 2. For each contract, check compliance and generate alerts
    for (const contract of cddtiContracts) {
      const startDate = typeof contract.startDate === 'string'
        ? parseISO(contract.startDate)
        : contract.startDate;

      const monthsElapsed = differenceInMonths(today, startDate);
      const limitDate = addMonths(startDate, 12);
      const daysUntilLimit = differenceInDays(limitDate, today);

      // Determine alert type based on days until limit
      let alertType: CDDTIAlertType | null = null;
      let alertSeverity: AlertSeverity = 'info';
      let alertMessage = '';

      if (daysUntilLimit <= 90 && daysUntilLimit > 60) {
        alertType = '90_day_warning';
        alertSeverity = 'info';
        alertMessage = `Le contrat CDDTI atteindra 12 mois le ${format(limitDate, 'dd/MM/yyyy')}. Conversion en CDI ou CDD requise.`;
      } else if (daysUntilLimit <= 60 && daysUntilLimit > 30) {
        alertType = '60_day_warning';
        alertSeverity = 'warning';
        alertMessage = `Attention : Le contrat CDDTI atteindra 12 mois dans 60 jours.`;
      } else if (daysUntilLimit <= 30 && daysUntilLimit > 0) {
        alertType = '30_day_warning';
        alertSeverity = 'warning';
        alertMessage = `Urgent : Le contrat CDDTI atteindra 12 mois dans ${daysUntilLimit} jours.`;
      } else if (monthsElapsed >= 12) {
        alertType = '12_month_limit';
        alertSeverity = 'critical';
        alertMessage = `CRITIQUE : Le contrat CDDTI a dépassé 12 mois (${monthsElapsed} mois). Conversion obligatoire.`;
      }

      // 3. Create alert if needed (avoid duplicates)
      if (alertType) {
        // Check if alert already exists for this type
        const existingAlerts = await db
          .select()
          .from(contractComplianceAlerts)
          .where(
            and(
              eq(contractComplianceAlerts.contractId, contract.id),
              eq(contractComplianceAlerts.alertType, alertType),
              eq(contractComplianceAlerts.isDismissed, false)
            )
          )
          .limit(1);

        if (existingAlerts.length === 0) {
          await db.insert(contractComplianceAlerts).values({
            tenantId,
            contractId: contract.id,
            employeeId: contract.employeeId,
            alertType,
            alertSeverity,
            alertDate: today.toISOString().split('T')[0]!,
            alertMessage,
          });
          alertsCreated++;
        }
      }
    }

    return alertsCreated;
  }
}

// Export singleton instance
export const cddtiComplianceService = new CDDTIComplianceService();
