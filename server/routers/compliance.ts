/**
 * Compliance tRPC Router
 *
 * Handles CDD (Fixed-Term Contract) compliance tracking:
 * - Contract compliance checking (2-year, 2-renewal limits)
 * - Contract renewals with validation
 * - CDD to CDI conversions
 * - Alert management
 * - Daily alert generation (cron)
 *
 * @see lib/compliance/cdd-compliance.service.ts
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import { cddComplianceService } from '@/lib/compliance/cdd-compliance.service';
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
});
