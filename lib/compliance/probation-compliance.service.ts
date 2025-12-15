/**
 * Probation Compliance Service
 *
 * Handles employee probation period tracking per West African labor laws:
 * - CDI probation periods: 1-4 months based on employee category
 * - Maximum one renewal allowed (same duration as initial)
 * - Alert generation 14/7 days before probation ends
 * - Confirmation, extension, or termination tracking
 *
 * Legal Context (Côte d'Ivoire - Article 14.2 Code du Travail):
 * - Probation duration depends on employee category
 * - Can be renewed once (written notice required)
 * - During probation, either party can terminate without notice
 */

import { db } from '@/lib/db';
import { employees } from '@/drizzle/schema';
import { eq, and, sql, lte, gte, isNull, isNotNull } from 'drizzle-orm';
import {
  addDays,
  addMonths,
  differenceInDays,
  format,
  parseISO,
  isAfter,
  isBefore,
  startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';

// ============================================================================
// Types
// ============================================================================

export type ProbationStatus =
  | 'in_progress'
  | 'confirmed'
  | 'extended'
  | 'terminated'
  | 'not_applicable';

export type ProbationAlertType =
  | '14_day_warning'
  | '7_day_warning'
  | 'expiring_today'
  | 'expired'
  | 'extension_ending';

export type ProbationAlertSeverity = 'info' | 'warning' | 'critical';

export interface ProbationAlert {
  type: ProbationAlertType;
  severity: ProbationAlertSeverity;
  message: string;
  actionRequired: string;
  daysRemaining: number;
}

export interface ProbationComplianceStatus {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  hasActiveProbation: boolean;
  status: ProbationStatus | null;
  startDate: Date | null;
  endDate: Date | null;
  durationMonths: number | null;
  extensionMonths: number | null;
  daysRemaining: number | null;
  canExtend: boolean;
  alerts: ProbationAlert[];
}

export interface ProbationUpdateResult {
  success: boolean;
  message: string;
  newStatus: ProbationStatus;
}

export interface ProbationDashboardSummary {
  totalInProbation: number;
  endingThisWeek: number;
  endingThisMonth: number;
  expired: number;
  employees: ProbationComplianceStatus[];
}

// ============================================================================
// Default Probation Durations by Category (Côte d'Ivoire)
// ============================================================================

/**
 * Default probation durations by employee category/coefficient
 * Based on Ivorian labor code and Convention Collective Interprofessionnelle
 *
 * - Ouvriers/Employés (coef 100-250): 1 month
 * - Agents de maîtrise (coef 260-500): 2-3 months
 * - Cadres (coef 500+): 3-4 months
 */
export function getDefaultProbationDuration(coefficient: number): number {
  if (coefficient < 260) {
    return 1; // 1 month for workers/employees
  } else if (coefficient < 500) {
    return 2; // 2 months for supervisors
  } else {
    return 3; // 3 months for managers/executives
  }
}

// ============================================================================
// Probation Compliance Service Class
// ============================================================================

export class ProbationComplianceService {
  /**
   * Check probation status for an employee
   */
  async checkProbationStatus(
    employeeId: string,
    tenantId: string
  ): Promise<ProbationComplianceStatus> {
    const employeeRows = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.tenantId, tenantId)
        )
      )
      .limit(1);

    const employee = employeeRows[0];

    if (!employee) {
      throw new Error('Employé introuvable');
    }

    const today = startOfDay(new Date());
    const alerts: ProbationAlert[] = [];

    // Check if employee has probation tracking
    const hasActiveProbation =
      employee.probationStatus === 'in_progress' ||
      employee.probationStatus === 'extended';

    let daysRemaining: number | null = null;
    let canExtend = false;

    if (hasActiveProbation && employee.probationEndDate) {
      const endDate = typeof employee.probationEndDate === 'string'
        ? parseISO(employee.probationEndDate)
        : employee.probationEndDate;

      daysRemaining = differenceInDays(endDate, today);
      canExtend = employee.probationStatus === 'in_progress' && !employee.probationExtensionMonths;

      // Generate alerts based on days remaining
      if (daysRemaining < 0) {
        alerts.push({
          type: 'expired',
          severity: 'critical',
          message: `La période d'essai a expiré il y a ${Math.abs(daysRemaining)} jour(s). Décision urgente requise.`,
          actionRequired: 'Confirmer ou terminer l\'employé immédiatement',
          daysRemaining,
        });
      } else if (daysRemaining === 0) {
        alerts.push({
          type: 'expiring_today',
          severity: 'critical',
          message: 'La période d\'essai se termine aujourd\'hui.',
          actionRequired: 'Décision requise : confirmer, prolonger ou terminer',
          daysRemaining,
        });
      } else if (daysRemaining <= 7) {
        const alertType = employee.probationStatus === 'extended' ? 'extension_ending' : '7_day_warning';
        alerts.push({
          type: alertType,
          severity: 'warning',
          message: `La période d'essai se termine dans ${daysRemaining} jour(s) le ${format(endDate, 'dd MMMM yyyy', { locale: fr })}.`,
          actionRequired: 'Préparer l\'évaluation de période d\'essai',
          daysRemaining,
        });
      } else if (daysRemaining <= 14) {
        alerts.push({
          type: '14_day_warning',
          severity: 'info',
          message: `La période d'essai se termine dans ${daysRemaining} jours le ${format(endDate, 'dd MMMM yyyy', { locale: fr })}.`,
          actionRequired: 'Planifier l\'évaluation de période d\'essai',
          daysRemaining,
        });
      }
    }

    return {
      employeeId: employee.id,
      employeeName: `${employee.lastName} ${employee.firstName}`,
      employeeNumber: employee.employeeNumber,
      hasActiveProbation,
      status: employee.probationStatus as ProbationStatus | null,
      startDate: employee.probationStartDate
        ? (typeof employee.probationStartDate === 'string'
            ? parseISO(employee.probationStartDate)
            : employee.probationStartDate)
        : null,
      endDate: employee.probationEndDate
        ? (typeof employee.probationEndDate === 'string'
            ? parseISO(employee.probationEndDate)
            : employee.probationEndDate)
        : null,
      durationMonths: employee.probationDurationMonths,
      extensionMonths: employee.probationExtensionMonths,
      daysRemaining,
      canExtend,
      alerts,
    };
  }

  /**
   * Initialize probation for a new employee
   */
  async initializeProbation(
    employeeId: string,
    tenantId: string,
    options: {
      startDate?: Date;
      durationMonths?: number;
      notes?: string;
    } = {}
  ): Promise<ProbationUpdateResult> {
    const employeeRows = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.tenantId, tenantId)
        )
      )
      .limit(1);

    const employee = employeeRows[0];

    if (!employee) {
      throw new Error('Employé introuvable');
    }

    // Use hire date or provided start date
    const startDate = options.startDate
      ? options.startDate
      : (employee.hireDate
          ? (typeof employee.hireDate === 'string'
              ? parseISO(employee.hireDate)
              : employee.hireDate)
          : new Date());

    // Use provided duration or calculate from coefficient
    const durationMonths = options.durationMonths
      ?? getDefaultProbationDuration(employee.coefficient);

    const endDate = addMonths(startDate, durationMonths);

    await db
      .update(employees)
      .set({
        probationStartDate: format(startDate, 'yyyy-MM-dd'),
        probationEndDate: format(endDate, 'yyyy-MM-dd'),
        probationDurationMonths: durationMonths,
        probationStatus: 'in_progress',
        probationNotes: options.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employeeId));

    return {
      success: true,
      message: `Période d'essai initialisée: ${format(startDate, 'dd/MM/yyyy')} au ${format(endDate, 'dd/MM/yyyy')} (${durationMonths} mois)`,
      newStatus: 'in_progress',
    };
  }

  /**
   * Confirm employee after successful probation
   */
  async confirmEmployee(
    employeeId: string,
    tenantId: string,
    userId: string,
    notes?: string
  ): Promise<ProbationUpdateResult> {
    const status = await this.checkProbationStatus(employeeId, tenantId);

    if (!status.hasActiveProbation) {
      throw new Error('L\'employé n\'est pas en période d\'essai');
    }

    await db
      .update(employees)
      .set({
        probationStatus: 'confirmed',
        probationConfirmedAt: new Date(),
        probationConfirmedBy: userId,
        probationNotes: notes
          ? (status.status === 'in_progress'
              ? notes
              : `${status.status === 'extended' ? 'Après prolongation. ' : ''}${notes}`)
          : (status.status === 'extended' ? 'Confirmé après prolongation.' : null),
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employeeId));

    return {
      success: true,
      message: `${status.employeeName} confirmé(e) après la période d'essai`,
      newStatus: 'confirmed',
    };
  }

  /**
   * Extend probation period (max one extension allowed)
   */
  async extendProbation(
    employeeId: string,
    tenantId: string,
    userId: string,
    extensionMonths?: number,
    notes?: string
  ): Promise<ProbationUpdateResult> {
    const status = await this.checkProbationStatus(employeeId, tenantId);

    if (!status.hasActiveProbation) {
      throw new Error('L\'employé n\'est pas en période d\'essai');
    }

    if (!status.canExtend) {
      throw new Error('La période d\'essai a déjà été prolongée une fois. Aucune prolongation supplémentaire autorisée.');
    }

    if (!status.endDate || !status.durationMonths) {
      throw new Error('Dates de période d\'essai non définies');
    }

    // Extension cannot exceed original duration
    const extensionDuration = extensionMonths ?? status.durationMonths;
    if (extensionDuration > status.durationMonths) {
      throw new Error(`La prolongation ne peut pas dépasser la durée initiale (${status.durationMonths} mois)`);
    }

    const newEndDate = addMonths(status.endDate, extensionDuration);

    await db
      .update(employees)
      .set({
        probationEndDate: format(newEndDate, 'yyyy-MM-dd'),
        probationExtensionMonths: extensionDuration,
        probationStatus: 'extended',
        probationNotes: notes ?? `Prolongation de ${extensionDuration} mois jusqu'au ${format(newEndDate, 'dd/MM/yyyy')}`,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employeeId));

    return {
      success: true,
      message: `Période d'essai prolongée de ${extensionDuration} mois jusqu'au ${format(newEndDate, 'dd/MM/yyyy')}`,
      newStatus: 'extended',
    };
  }

  /**
   * Terminate employee during probation
   */
  async terminateDuringProbation(
    employeeId: string,
    tenantId: string,
    userId: string,
    terminationDate: Date,
    reason: string
  ): Promise<ProbationUpdateResult> {
    const status = await this.checkProbationStatus(employeeId, tenantId);

    if (!status.hasActiveProbation) {
      throw new Error('L\'employé n\'est pas en période d\'essai');
    }

    await db
      .update(employees)
      .set({
        probationStatus: 'terminated',
        probationNotes: `Fin de période d'essai le ${format(terminationDate, 'dd/MM/yyyy')}. Motif: ${reason}`,
        terminationDate: format(terminationDate, 'yyyy-MM-dd'),
        terminationReason: `Fin de période d'essai: ${reason}`,
        status: 'terminated',
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employeeId));

    return {
      success: true,
      message: `Contrat terminé pendant la période d'essai`,
      newStatus: 'terminated',
    };
  }

  /**
   * Get all employees in probation for a tenant
   */
  async getEmployeesInProbation(
    tenantId: string,
    options: {
      includeExpired?: boolean;
      daysUntilEndMax?: number;
    } = {}
  ): Promise<ProbationComplianceStatus[]> {
    const today = startOfDay(new Date());
    const { includeExpired = false, daysUntilEndMax } = options;

    // Build conditions
    const conditions = [
      eq(employees.tenantId, tenantId),
      eq(employees.status, 'active'),
    ];

    // Filter by probation status
    conditions.push(
      sql`${employees.probationStatus} IN ('in_progress', 'extended')`
    );

    // Optionally filter by days until end
    if (daysUntilEndMax !== undefined) {
      const maxDate = addDays(today, daysUntilEndMax);
      conditions.push(
        lte(employees.probationEndDate, format(maxDate, 'yyyy-MM-dd'))
      );
    }

    // Include expired if requested
    if (!includeExpired) {
      conditions.push(
        gte(employees.probationEndDate, format(today, 'yyyy-MM-dd'))
      );
    }

    const employeeRows = await db
      .select()
      .from(employees)
      .where(and(...conditions))
      .orderBy(employees.probationEndDate);

    const results: ProbationComplianceStatus[] = [];

    for (const employee of employeeRows) {
      const status = await this.checkProbationStatus(employee.id, tenantId);
      results.push(status);
    }

    return results;
  }

  /**
   * Get dashboard summary of probation status
   */
  async getDashboardSummary(tenantId: string): Promise<ProbationDashboardSummary> {
    const today = startOfDay(new Date());
    const endOfWeek = addDays(today, 7);
    const endOfMonth = addDays(today, 30);

    // Get all employees in probation (including expired)
    const allInProbation = await this.getEmployeesInProbation(tenantId, {
      includeExpired: true,
    });

    const endingThisWeek = allInProbation.filter(
      (e) => e.daysRemaining !== null && e.daysRemaining >= 0 && e.daysRemaining <= 7
    );

    const endingThisMonth = allInProbation.filter(
      (e) => e.daysRemaining !== null && e.daysRemaining >= 0 && e.daysRemaining <= 30
    );

    const expired = allInProbation.filter(
      (e) => e.daysRemaining !== null && e.daysRemaining < 0
    );

    return {
      totalInProbation: allInProbation.filter(e => e.daysRemaining === null || e.daysRemaining >= 0).length,
      endingThisWeek: endingThisWeek.length,
      endingThisMonth: endingThisMonth.length,
      expired: expired.length,
      employees: allInProbation,
    };
  }

  /**
   * Get all probation alerts for dashboard display
   */
  async getAllProbationAlerts(
    tenantId: string,
    options: {
      severityFilter?: ProbationAlertSeverity[];
      limit?: number;
    } = {}
  ): Promise<Array<ProbationComplianceStatus & { alert: ProbationAlert }>> {
    const { severityFilter, limit = 50 } = options;

    const allInProbation = await this.getEmployeesInProbation(tenantId, {
      includeExpired: true,
    });

    const results: Array<ProbationComplianceStatus & { alert: ProbationAlert }> = [];

    for (const employee of allInProbation) {
      for (const alert of employee.alerts) {
        if (!severityFilter || severityFilter.includes(alert.severity)) {
          results.push({
            ...employee,
            alert,
          });
        }
      }
    }

    // Sort by severity (critical first) then by days remaining
    results.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      const aSeverity = severityOrder[a.alert.severity];
      const bSeverity = severityOrder[b.alert.severity];

      if (aSeverity !== bSeverity) {
        return aSeverity - bSeverity;
      }

      return (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999);
    });

    return results.slice(0, limit);
  }

  /**
   * Bulk initialize probation for newly hired employees without probation tracking
   * Useful for migrating existing employees to the new probation system
   */
  async bulkInitializeProbation(
    tenantId: string,
    options: {
      onlyRecentHires?: boolean; // Only employees hired in last N months
      recentHireMonths?: number; // Default 4 months (max probation duration)
    } = {}
  ): Promise<{
    processed: number;
    initialized: number;
    skipped: number;
    errors: Array<{ employeeId: string; error: string }>;
  }> {
    const { onlyRecentHires = true, recentHireMonths = 4 } = options;

    const today = startOfDay(new Date());
    const cutoffDate = addMonths(today, -recentHireMonths);

    // Find employees without probation tracking
    const conditions = [
      eq(employees.tenantId, tenantId),
      eq(employees.status, 'active'),
      isNull(employees.probationStatus),
    ];

    if (onlyRecentHires) {
      conditions.push(
        gte(employees.hireDate, format(cutoffDate, 'yyyy-MM-dd'))
      );
    }

    const employeeRows = await db
      .select()
      .from(employees)
      .where(and(...conditions));

    const result = {
      processed: employeeRows.length,
      initialized: 0,
      skipped: 0,
      errors: [] as Array<{ employeeId: string; error: string }>,
    };

    for (const employee of employeeRows) {
      try {
        // Skip if contract type doesn't typically have probation
        if (employee.contractType === 'STAGE' || employee.contractType === 'INTERIM') {
          result.skipped++;
          continue;
        }

        await this.initializeProbation(employee.id, tenantId);
        result.initialized++;
      } catch (error) {
        result.errors.push({
          employeeId: employee.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }
}

// Export singleton instance
export const probationComplianceService = new ProbationComplianceService();
