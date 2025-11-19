/**
 * Compliance tRPC Router
 *
 * Handles contract compliance tracking:
 * - CDD (Fixed-Term Contract): 2-year, 2-renewal limits
 * - CDDTI (Daily/Task Contract): 12-month limit
 * - Contract renewals with validation
 * - Contract conversions (CDD→CDI, CDDTI→CDI, CDDTI→CDD)
 * - Alert management
 * - Daily alert generation (cron)
 *
 * @see lib/compliance/cdd-compliance.service.ts
 * @see lib/compliance/cddti-compliance.service.ts
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { cddComplianceService } from '@/lib/compliance/cdd-compliance.service';
import { cddtiComplianceService } from '@/lib/compliance/cddti-compliance.service';
import { TRPCError } from '@trpc/server';
import { db } from '@/lib/db';
import {
  contractComplianceAlerts,
  employmentContracts,
  employees
} from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================================================
// Input Schemas
// ============================================================================

const checkComplianceSchema = z.object({
  employeeId: z.string().uuid(),
});

const validateRenewalSchema = z.object({
  contractId: z.string().uuid(),
  newEndDate: z.coerce.date(),
});

const renewContractSchema = z.object({
  contractId: z.string().uuid(),
  newEndDate: z.coerce.date(),
  renewalReason: z.string().min(10, 'La raison du renouvellement doit contenir au moins 10 caractères'),
});

const convertToCDISchema = z.object({
  contractId: z.string().uuid(),
  conversionDate: z.coerce.date().optional(),
});

const dismissAlertSchema = z.object({
  alertId: z.string().uuid(),
  actionTaken: z.enum(['converted_to_cdi', 'renewed', 'terminated', 'ignored']),
});

const getActiveAlertsSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

// CDDTI-specific schemas
const convertCDDTIToCDISchema = z.object({
  contractId: z.string().uuid(),
  conversionDate: z.coerce.date().optional(),
});

const convertCDDTIToCDDSchema = z.object({
  contractId: z.string().uuid(),
  cddEndDate: z.coerce.date(),
  cddReason: z.string().min(10, 'La raison du CDD doit contenir au moins 10 caractères'),
  conversionDate: z.coerce.date().optional(),
});

// ============================================================================
// Router
// ============================================================================

export const complianceRouter = createTRPCRouter({
  /**
   * Check CDD compliance for a specific employee
   *
   * Returns:
   * - Compliance status (compliant/non-compliant)
   * - Active alerts
   * - Contract details
   * - Renewal history
   * - Duration calculations
   */
  checkCDDCompliance: publicProcedure
    .input(checkComplianceSchema)
    .query(async ({ input, ctx }) => {
      try {
        const compliance = await cddComplianceService.checkCDDCompliance(
          input.employeeId,
          ctx.user.tenantId
        );

        return compliance;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la vérification de conformité';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Validate if a contract renewal is allowed
   *
   * Checks:
   * - Renewal count < 2
   * - Total duration after renewal <= 24 months
   */
  validateRenewal: publicProcedure
    .input(validateRenewalSchema)
    .query(async ({ input }) => {
      try {
        const validation = await cddComplianceService.validateRenewal(
          input.contractId,
          input.newEndDate
        );

        return validation;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la validation du renouvellement';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  /**
   * Renew a CDD contract
   *
   * Creates new contract with incremented renewal count
   * and records in renewal history.
   */
  renewContract: publicProcedure
    .input(renewContractSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await cddComplianceService.renewContract(
          input.contractId,
          input.newEndDate,
          input.renewalReason,
          ctx.user.id
        );

        return {
          success: true,
          message: `Contrat renouvelé avec succès (Renouvellement ${result.renewalNumber})`,
          renewedContractId: result.renewedContractId,
          renewalNumber: result.renewalNumber,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors du renouvellement du contrat';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  /**
   * Convert CDD to CDI
   *
   * Closes CDD contract and creates new CDI contract.
   * Updates employee record and dismisses all alerts.
   */
  convertToCDI: publicProcedure
    .input(convertToCDISchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const conversionDate = input.conversionDate ?? new Date();

        const result = await cddComplianceService.convertToCDI(
          input.contractId,
          conversionDate,
          ctx.user.id
        );

        return {
          success: true,
          message: 'Contrat converti en CDI avec succès',
          cdiContractId: result.cdiContractId,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la conversion en CDI';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  /**
   * Get all active compliance alerts for the tenant
   *
   * Returns summary and detailed alerts for CDD contracts
   * approaching or exceeding limits.
   */
  getActiveAlerts: publicProcedure
    .input(getActiveAlertsSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Build where conditions
        const conditions = [
          eq(contractComplianceAlerts.tenantId, ctx.user.tenantId),
          eq(contractComplianceAlerts.isDismissed, false),
        ];

        if (input.severity) {
          conditions.push(eq(contractComplianceAlerts.alertSeverity, input.severity));
        }

        // Fetch alerts with employee and contract details
        const alertsData = await db
          .select({
            id: contractComplianceAlerts.id,
            alertType: contractComplianceAlerts.alertType,
            alertSeverity: contractComplianceAlerts.alertSeverity,
            alertDate: contractComplianceAlerts.alertDate,
            alertMessage: contractComplianceAlerts.alertMessage,
            contractId: contractComplianceAlerts.contractId,
            employeeId: contractComplianceAlerts.employeeId,
            createdAt: contractComplianceAlerts.createdAt,
            // Employee details
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
            // Contract details
            contractNumber: employmentContracts.contractNumber,
            contractEndDate: employmentContracts.endDate,
            renewalCount: employmentContracts.renewalCount,
          })
          .from(contractComplianceAlerts)
          .leftJoin(employees, eq(contractComplianceAlerts.employeeId, employees.id))
          .leftJoin(employmentContracts, eq(contractComplianceAlerts.contractId, employmentContracts.id))
          .where(and(...conditions))
          .orderBy(desc(contractComplianceAlerts.alertDate))
          .limit(input.limit)
          .offset(input.offset);

        // Count by severity for summary
        const allAlerts = await db
          .select({
            severity: contractComplianceAlerts.alertSeverity,
          })
          .from(contractComplianceAlerts)
          .where(
            and(
              eq(contractComplianceAlerts.tenantId, ctx.user.tenantId),
              eq(contractComplianceAlerts.isDismissed, false)
            )
          );

        const critical = allAlerts.filter(a => a.severity === 'critical').length;
        const warning = allAlerts.filter(a => a.severity === 'warning').length;
        const info = allAlerts.filter(a => a.severity === 'info').length;

        // Count active CDD contracts
        const cddContracts = await db
          .select()
          .from(employmentContracts)
          .where(
            and(
              eq(employmentContracts.tenantId, ctx.user.tenantId),
              eq(employmentContracts.contractType, 'CDD'),
              eq(employmentContracts.isActive, true)
            )
          );

        return {
          summary: {
            critical,
            warning,
            info,
            totalCDD: cddContracts.length,
          },
          details: alertsData.map(alert => ({
            id: alert.id,
            alertType: alert.alertType,
            alertSeverity: alert.alertSeverity,
            alertDate: alert.alertDate,
            alertMessage: alert.alertMessage,
            contractId: alert.contractId,
            employeeId: alert.employeeId,
            employeeName: `${alert.employeeFirstName} ${alert.employeeLastName}`,
            employeeNumber: alert.employeeNumber,
            contractNumber: alert.contractNumber,
            contractEndDate: alert.contractEndDate,
            renewalCount: alert.renewalCount,
            createdAt: alert.createdAt,
          })),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des alertes';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Dismiss a compliance alert
   *
   * Marks alert as dismissed and records the action taken.
   */
  dismissAlert: publicProcedure
    .input(dismissAlertSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await db
          .update(contractComplianceAlerts)
          .set({
            isDismissed: true,
            dismissedAt: new Date().toISOString(),
            dismissedBy: ctx.user.id,
            actionTaken: input.actionTaken,
          })
          .where(
            and(
              eq(contractComplianceAlerts.id, input.alertId),
              eq(contractComplianceAlerts.tenantId, ctx.user.tenantId)
            )
          );

        return {
          success: true,
          message: 'Alerte fermée avec succès',
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la fermeture de l\'alerte';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  /**
   * Generate daily alerts for all active CDD contracts
   *
   * Should be called by cron job daily.
   * Returns number of alerts created.
   */
  generateDailyAlerts: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const alertsCreated = await cddComplianceService.generateDailyAlerts(
          ctx.user.tenantId
        );

        return {
          success: true,
          message: `${alertsCreated} nouvelles alertes créées`,
          alertsCreated,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la génération des alertes';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Get active CDD contracts for the tenant
   *
   * Returns contracts with compliance status.
   */
  getActiveCDDContracts: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const contracts = await db
          .select({
            id: employmentContracts.id,
            employeeId: employmentContracts.employeeId,
            contractNumber: employmentContracts.contractNumber,
            startDate: employmentContracts.startDate,
            endDate: employmentContracts.endDate,
            renewalCount: employmentContracts.renewalCount,
            cddReason: employmentContracts.cddReason,
            // Employee details
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
          })
          .from(employmentContracts)
          .leftJoin(employees, eq(employmentContracts.employeeId, employees.id))
          .where(
            and(
              eq(employmentContracts.tenantId, ctx.user.tenantId),
              eq(employmentContracts.contractType, 'CDD'),
              eq(employmentContracts.isActive, true)
            )
          )
          .orderBy(desc(employmentContracts.endDate));

        // Enrich with compliance status
        const contractsWithCompliance = await Promise.all(
          contracts.map(async contract => {
            const compliance = await cddComplianceService.checkCDDCompliance(
              contract.employeeId,
              ctx.user.tenantId
            );

            return {
              ...contract,
              employeeName: `${contract.employeeFirstName} ${contract.employeeLastName}`,
              compliance: {
                compliant: compliance.compliant,
                totalMonths: compliance.totalMonths,
                remainingMonths: compliance.remainingMonths,
                renewalsRemaining: compliance.renewalsRemaining,
                hasAlerts: compliance.alerts.length > 0,
                criticalAlerts: compliance.alerts.filter(a => a.severity === 'critical').length,
              },
            };
          })
        );

        return contractsWithCompliance;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des contrats CDD';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  // ============================================================================
  // CDDTI Compliance Endpoints
  // ============================================================================

  /**
   * Check CDDTI compliance for a specific employee
   *
   * Returns:
   * - Compliance status (compliant if < 12 months)
   * - Months elapsed and remaining
   * - 12-month limit date
   * - Active alerts (90/60/30-day warnings, 12-month limit)
   */
  checkCDDTICompliance: publicProcedure
    .input(checkComplianceSchema)
    .query(async ({ input, ctx }) => {
      try {
        const compliance = await cddtiComplianceService.checkCDDTICompliance(
          input.employeeId,
          ctx.user.tenantId
        );

        return compliance;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la vérification de conformité CDDTI';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Convert CDDTI to CDI (permanent contract)
   *
   * Closes CDDTI contract and creates new CDI contract.
   * Updates employee record and dismisses all alerts.
   */
  convertCDDTIToCDI: publicProcedure
    .input(convertCDDTIToCDISchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const conversionDate = input.conversionDate ?? new Date();

        const cdiContract = await cddtiComplianceService.convertCDDTIToCDI(
          input.contractId,
          conversionDate,
          ctx.user.id,
          ctx.user.tenantId
        );

        return {
          success: true,
          message: 'Contrat CDDTI converti en CDI avec succès',
          cdiContractId: cdiContract.id,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la conversion CDDTI en CDI';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  /**
   * Convert CDDTI to CDD (HR discretion adjustment)
   *
   * Closes CDDTI contract and creates new CDD contract.
   * Useful when HR wants to adjust contract type instead of direct CDI conversion.
   */
  convertCDDTIToCDD: publicProcedure
    .input(convertCDDTIToCDDSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const conversionDate = input.conversionDate ?? new Date();

        const cddContract = await cddtiComplianceService.convertCDDTIToCDD(
          input.contractId,
          input.cddEndDate,
          input.cddReason,
          conversionDate,
          ctx.user.id,
          ctx.user.tenantId
        );

        return {
          success: true,
          message: 'Contrat CDDTI converti en CDD avec succès',
          cddContractId: cddContract.id,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la conversion CDDTI en CDD';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        });
      }
    }),

  /**
   * Get active CDDTI contracts for the tenant
   *
   * Returns contracts with compliance status (months elapsed, remaining, etc.)
   */
  getActiveCDDTIContracts: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const contracts = await db
          .select({
            id: employmentContracts.id,
            employeeId: employmentContracts.employeeId,
            contractNumber: employmentContracts.contractNumber,
            startDate: employmentContracts.startDate,
            cddtiTaskDescription: employmentContracts.cddtiTaskDescription,
            // Employee details
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
          })
          .from(employmentContracts)
          .leftJoin(employees, eq(employmentContracts.employeeId, employees.id))
          .where(
            and(
              eq(employmentContracts.tenantId, ctx.user.tenantId),
              eq(employmentContracts.contractType, 'CDDTI'),
              eq(employmentContracts.isActive, true)
            )
          )
          .orderBy(desc(employmentContracts.startDate));

        // Enrich with compliance status
        const contractsWithCompliance = await Promise.all(
          contracts.map(async contract => {
            const compliance = await cddtiComplianceService.checkCDDTICompliance(
              contract.employeeId,
              ctx.user.tenantId
            );

            return {
              ...contract,
              employeeName: `${contract.employeeFirstName} ${contract.employeeLastName}`,
              compliance: {
                isCompliant: compliance.isCompliant,
                conversionDue: compliance.conversionDue,
                monthsElapsed: compliance.monthsElapsed,
                monthsRemaining: compliance.monthsRemaining,
                limitDate: compliance.limitDate,
                hasAlerts: compliance.alerts.length > 0,
                criticalAlerts: compliance.alerts.filter(a => a.severity === 'critical').length,
              },
            };
          })
        );

        return contractsWithCompliance;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la récupération des contrats CDDTI';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),

  /**
   * Generate daily alerts for ALL contract types (CDD + CDDTI)
   *
   * Should be called by cron job daily.
   * Returns number of alerts created for each type.
   */
  generateAllComplianceAlerts: publicProcedure
    .mutation(async ({ ctx }) => {
      try {
        const cddAlerts = await cddComplianceService.generateDailyAlerts(
          ctx.user.tenantId
        );

        const cddtiAlerts = await cddtiComplianceService.generateDailyCDDTIAlerts(
          ctx.user.tenantId
        );

        const totalAlerts = cddAlerts + cddtiAlerts;

        return {
          success: true,
          message: `${totalAlerts} nouvelles alertes créées (${cddAlerts} CDD, ${cddtiAlerts} CDDTI)`,
          cddAlertsCreated: cddAlerts,
          cddtiAlertsCreated: cddtiAlerts,
          totalAlerts,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la génération des alertes';
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message,
        });
      }
    }),
});
