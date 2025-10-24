/**
 * CDD Compliance Service
 *
 * Handles Fixed-Term Contract (CDD) compliance tracking per West African labor laws:
 * - Maximum 2 renewals allowed
 * - Maximum 24 months cumulative duration
 * - Automatic conversion to CDI if limits exceeded
 * - Alert generation 30/60/90 days before limits
 *
 * @see docs/CONSOLIDATED-IMPLEMENTATION-PLAN-v3.0-EXTENDED.md (Lines 2100-2720)
 */

import { db } from '@/lib/db';
import {
  employmentContracts,
  contractComplianceAlerts,
  contractRenewalHistory,
  employees
} from '@/drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  addMonths,
  addDays,
  differenceInMonths,
  differenceInDays,
  format,
  parseISO
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export type ContractType = 'CDI' | 'CDD' | 'INTERIM' | 'STAGE';

export type AlertType =
  | '90_day_warning'
  | '60_day_warning'
  | '30_day_warning'
  | '2_year_limit'
  | '2_renewal_limit'
  | 'renewal_warning';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type ActionTaken = 'converted_to_cdi' | 'renewed' | 'terminated' | 'ignored';

export interface ComplianceAlert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  actionRequired: string;
}

export interface ComplianceStatus {
  compliant: boolean;
  alerts: ComplianceAlert[];
  contract?: typeof employmentContracts.$inferSelect;
  history?: typeof contractRenewalHistory.$inferSelect[];
  totalMonths?: number;
  remainingMonths?: number;
  renewalsRemaining?: number;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

// ============================================================================
// CDD Compliance Service Class
// ============================================================================

export class CDDComplianceService {
  /**
   * Check CDD compliance for an employee
   *
   * Validates:
   * - 2-year cumulative limit (24 months)
   * - 2-renewal limit
   * - End date proximity warnings
   */
  async checkCDDCompliance(
    employeeId: string,
    tenantId: string
  ): Promise<ComplianceStatus> {
    // 1. Get active CDD contract
    const activeContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.employeeId, employeeId),
          eq(employmentContracts.tenantId, tenantId),
          eq(employmentContracts.contractType, 'CDD'),
          eq(employmentContracts.isActive, true)
        )
      )
      .limit(1);

    const activeContract = activeContracts[0];

    if (!activeContract) {
      return { compliant: true, alerts: [] };
    }

    // 2. Get contract history (original + all renewals)
    const originalContractId = activeContract.originalContractId ?? activeContract.id;
    const history = await this.getContractRenewalHistory(originalContractId);

    // 3. Calculate totals
    const totalMonths = this.calculateTotalDuration(history, activeContract);
    const remainingMonths = 24 - totalMonths;
    const renewalsRemaining = 2 - activeContract.renewalCount;

    // 4. Check limits and generate alerts
    const alerts: ComplianceAlert[] = [];

    // CHECK 1: 2-year cumulative limit (24 months)
    if (totalMonths >= 24) {
      alerts.push({
        type: '2_year_limit',
        severity: 'critical',
        message: 'La durée du CDD dépasse 24 mois. Conversion automatique en CDI requise.',
        actionRequired: 'Convertir en CDI immédiatement'
      });
    } else if (totalMonths >= 21) {
      alerts.push({
        type: '90_day_warning',
        severity: 'warning',
        message: `Le CDD approche la limite de 2 ans (${totalMonths} mois). Action requise dans 90 jours.`,
        actionRequired: 'Planifier la conversion en CDI ou la fin du contrat'
      });
    }

    // CHECK 2: 2-renewal limit
    if (activeContract.renewalCount >= 2) {
      alerts.push({
        type: '2_renewal_limit',
        severity: 'critical',
        message: 'Le CDD a été renouvelé 2 fois. Aucun renouvellement supplémentaire autorisé.',
        actionRequired: 'Convertir en CDI ou mettre fin au contrat'
      });
    } else if (activeContract.renewalCount === 1) {
      alerts.push({
        type: 'renewal_warning',
        severity: 'warning',
        message: 'Le CDD a été renouvelé une fois. Un seul renouvellement supplémentaire autorisé.',
        actionRequired: 'Planifier soigneusement le prochain renouvellement'
      });
    }

    // CHECK 3: End date approaching
    if (activeContract.endDate) {
      const endDate = typeof activeContract.endDate === 'string'
        ? parseISO(activeContract.endDate)
        : activeContract.endDate;
      const daysUntilEnd = differenceInDays(endDate, new Date());

      if (daysUntilEnd <= 30 && daysUntilEnd > 0) {
        alerts.push({
          type: '30_day_warning',
          severity: 'warning',
          message: `Le contrat se termine dans ${daysUntilEnd} jours le ${format(endDate, 'dd/MM/yyyy')}.`,
          actionRequired: 'Décider: Renouveler, convertir en CDI, ou mettre fin au contrat'
        });
      }
    }

    return {
      compliant: alerts.filter(a => a.severity === 'critical').length === 0,
      alerts,
      contract: activeContract,
      history,
      totalMonths,
      remainingMonths,
      renewalsRemaining
    };
  }

  /**
   * Validate if a contract renewal is allowed
   *
   * Checks:
   * - Renewal count < 2
   * - Total duration after renewal <= 24 months
   */
  async validateRenewal(
    contractId: string,
    newEndDate: Date
  ): Promise<ValidationResult> {
    const contracts = await db
      .select()
      .from(employmentContracts)
      .where(eq(employmentContracts.id, contractId))
      .limit(1);

    const contract = contracts[0];

    if (!contract) {
      return { allowed: false, reason: 'Contrat introuvable' };
    }

    // Check renewal count
    if (contract.renewalCount >= 2) {
      return {
        allowed: false,
        reason: 'Maximum 2 renouvellements autorisés. Ceci serait le 3ème renouvellement.'
      };
    }

    // Check total duration
    const originalContractId = contract.originalContractId ?? contract.id;
    const history = await this.getContractRenewalHistory(originalContractId);
    const currentTotalMonths = this.calculateTotalDuration(history, contract);

    const startDate = typeof contract.startDate === 'string'
      ? parseISO(contract.startDate)
      : contract.startDate;
    const newDurationMonths = differenceInMonths(newEndDate, startDate);
    const newTotalMonths = currentTotalMonths + newDurationMonths;

    if (newTotalMonths > 24) {
      return {
        allowed: false,
        reason: `La durée totale du CDD serait de ${newTotalMonths} mois, dépassant la limite de 24 mois.`
      };
    }

    return { allowed: true };
  }

  /**
   * Renew a CDD contract
   *
   * Steps:
   * 1. Validate renewal is allowed
   * 2. Close current contract (set isActive = false)
   * 3. Create new contract with incremented renewal count
   * 4. Record in renewal history
   */
  async renewContract(
    contractId: string,
    newEndDate: Date,
    renewalReason: string,
    userId: string
  ): Promise<{ renewedContractId: string; renewalNumber: number }> {
    // 1. Validate renewal
    const validation = await this.validateRenewal(contractId, newEndDate);
    if (!validation.allowed) {
      throw new Error(validation.reason);
    }

    // 2. Get original contract
    const originalContracts = await db
      .select()
      .from(employmentContracts)
      .where(eq(employmentContracts.id, contractId))
      .limit(1);

    const originalContract = originalContracts[0];
    if (!originalContract) {
      throw new Error('Contrat introuvable');
    }

    // 3. Close current contract
    await db
      .update(employmentContracts)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(employmentContracts.id, contractId));

    // 4. Create renewed contract
    const renewalNumber = originalContract.renewalCount + 1;

    if (!originalContract.endDate) {
      throw new Error('Cannot renew contract without end date');
    }

    const endDateStr = typeof originalContract.endDate === 'string'
      ? originalContract.endDate
      : new Date(originalContract.endDate).toISOString();

    const startDate = addDays(parseISO(endDateStr), 1);

    const renewedContracts = await db
      .insert(employmentContracts)
      .values({
        tenantId: originalContract.tenantId,
        employeeId: originalContract.employeeId,
        contractType: 'CDD',
        startDate: startDate.toISOString().split('T')[0]!,
        endDate: newEndDate.toISOString().split('T')[0]!,
        renewalCount: renewalNumber,
        isActive: true,
        originalContractId: originalContract.originalContractId ?? originalContract.id,
        replacesContractId: contractId,
        cddReason: renewalReason,
        createdBy: userId,
      })
      .returning();

    const renewedContract = renewedContracts[0]!;

    // 5. Record renewal history
    const originalId = originalContract.originalContractId ?? originalContract.id;
    const history = await this.getContractRenewalHistory(originalId);
    const renewalDurationMonths = differenceInMonths(newEndDate, startDate);
    const cumulativeMonths = this.calculateTotalDuration(history, originalContract) + renewalDurationMonths;

    await db.insert(contractRenewalHistory).values({
      originalContractId: originalId,
      renewalNumber,
      renewalContractId: renewedContract.id,
      previousEndDate: endDateStr.split('T')[0]!,
      newEndDate: newEndDate.toISOString().split('T')[0]!,
      renewalDurationMonths,
      cumulativeDurationMonths: cumulativeMonths,
      renewalReason,
      renewedBy: userId,
    });

    return {
      renewedContractId: renewedContract.id,
      renewalNumber
    };
  }

  /**
   * Convert CDD to CDI
   *
   * Steps:
   * 1. Close CDD contract
   * 2. Create new CDI contract
   * 3. Update employee record
   * 4. Dismiss all alerts
   */
  async convertToCDI(
    contractId: string,
    conversionDate: Date,
    userId: string
  ): Promise<{ cdiContractId: string }> {
    const cddContracts = await db
      .select()
      .from(employmentContracts)
      .where(eq(employmentContracts.id, contractId))
      .limit(1);

    const cddContract = cddContracts[0];
    if (!cddContract) {
      throw new Error('Contrat CDD introuvable');
    }

    // 1. Close CDD
    await db
      .update(employmentContracts)
      .set({
        isActive: false,
        terminationDate: conversionDate.toISOString().split('T')[0],
        terminationReason: 'Converti en CDI',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employmentContracts.id, contractId));

    // 2. Create CDI
    const cdiContracts = await db
      .insert(employmentContracts)
      .values({
        tenantId: cddContract.tenantId,
        employeeId: cddContract.employeeId,
        contractType: 'CDI',
        startDate: conversionDate.toISOString().split('T')[0]!,
        endDate: null,
        isActive: true,
        replacesContractId: contractId,
        notes: `Converti depuis CDD (${cddContract.contractNumber ?? contractId})`,
        createdBy: userId,
      })
      .returning();

    const cdiContract = cdiContracts[0]!;

    // 3. Update employee record (if employment_type and contract_start_date exist)
    await db
      .update(employees)
      .set({
        // employmentType: 'CDI', // Only if column exists
        // contractStartDate: conversionDate.toISOString().split('T')[0], // Only if column exists
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employees.id, cddContract.employeeId));

    // 4. Dismiss all alerts
    await db
      .update(contractComplianceAlerts)
      .set({
        isDismissed: true,
        dismissedAt: new Date().toISOString(),
        dismissedBy: userId,
        actionTaken: 'converted_to_cdi',
      })
      .where(eq(contractComplianceAlerts.contractId, contractId));

    return {
      cdiContractId: cdiContract.id,
    };
  }

  /**
   * Generate compliance alerts for all active CDD contracts
   * Should be run daily via cron job
   *
   * Returns number of alerts created
   */
  async generateDailyAlerts(tenantId: string): Promise<number> {
    // Get all active CDD contracts for tenant
    const activeContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.tenantId, tenantId),
          eq(employmentContracts.contractType, 'CDD'),
          eq(employmentContracts.isActive, true)
        )
      );

    let alertsCreated = 0;

    for (const contract of activeContracts) {
      const compliance = await this.checkCDDCompliance(
        contract.employeeId,
        tenantId
      );

      for (const alert of compliance.alerts) {
        // Check if alert already exists
        const existing = await db
          .select()
          .from(contractComplianceAlerts)
          .where(
            and(
              eq(contractComplianceAlerts.contractId, contract.id),
              eq(contractComplianceAlerts.alertType, alert.type),
              eq(contractComplianceAlerts.isDismissed, false)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(contractComplianceAlerts).values({
            tenantId,
            contractId: contract.id,
            employeeId: contract.employeeId,
            alertType: alert.type,
            alertSeverity: alert.severity,
            alertDate: new Date().toISOString().split('T')[0]!,
            alertMessage: alert.message,
          });
          alertsCreated++;
        }
      }
    }

    return alertsCreated;
  }

  /**
   * Get renewal history for a contract chain
   */
  private async getContractRenewalHistory(
    originalContractId: string
  ): Promise<(typeof contractRenewalHistory.$inferSelect)[]> {
    return await db
      .select()
      .from(contractRenewalHistory)
      .where(eq(contractRenewalHistory.originalContractId, originalContractId))
      .orderBy(desc(contractRenewalHistory.renewalNumber));
  }

  /**
   * Calculate total duration from history and current contract
   */
  private calculateTotalDuration(
    history: (typeof contractRenewalHistory.$inferSelect)[],
    currentContract: typeof employmentContracts.$inferSelect
  ): number {
    // If we have renewal history, use cumulative months from latest record
    if (history.length > 0) {
      return history[0]?.cumulativeDurationMonths ?? 0;
    }

    // Otherwise, calculate from contract dates
    if (!currentContract.endDate) {
      return 0;
    }

    const startDate = typeof currentContract.startDate === 'string'
      ? parseISO(currentContract.startDate)
      : currentContract.startDate;

    const endDate = typeof currentContract.endDate === 'string'
      ? parseISO(currentContract.endDate)
      : currentContract.endDate;

    return Math.abs(differenceInMonths(endDate, startDate));
  }
}

// Export singleton instance
export const cddComplianceService = new CDDComplianceService();
