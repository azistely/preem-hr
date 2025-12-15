/**
 * Observations tRPC Router
 * Factory KPI observation tracking for daily/weekly/monthly employee performance
 *
 * Supports:
 * - Manual entry by team leads or HR
 * - Excel import for bulk observations
 * - KPI templates for different factory types
 * - Aggregation for evaluation periods
 *
 * Access: Team leads (managerProcedure) for observations, HR (hrManagerProcedure) for templates
 */

import { z } from 'zod';
import { createTRPCRouter, managerProcedure, hrManagerProcedure, protectedProcedure } from '../api/trpc';
import {
  observationLogs,
  observationKpiTemplates,
  performanceCycles,
  employees,
  type ObservationKpiData,
} from '@/lib/db/schema';
import { and, eq, desc, sql, gte, lte, inArray, or, asc, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  generateBasicTemplate,
  generateExtendedTemplate,
  generatePrefilledTemplate,
  getTemplateFilename,
  getPrefilledTemplateFilename,
} from '@/lib/observation-import';

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const kpiDataSchema = z.object({
  unitsProduced: z.number().optional(),
  targetUnits: z.number().optional(),
  defects: z.number().optional(),
  defectRate: z.number().optional(),
  machineDowntimeMinutes: z.number().optional(),
  hoursWorked: z.number().optional(),
  expectedHours: z.number().optional(),
  lateMinutes: z.number().optional(),
  absenceType: z.enum(['present', 'absent_justified', 'absent_unjustified']).optional(),
  safetyScore: z.number().min(1).max(5).optional(),
  ppeCompliance: z.boolean().optional(),
  incidentReported: z.boolean().optional(),
  qualityScore: z.number().min(1).max(5).optional(),
  teamworkScore: z.number().min(1).max(5).optional(),
  initiativeScore: z.number().min(1).max(5).optional(),
  custom: z.record(z.unknown()).optional(),
}).passthrough();

const kpiFieldDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['number', 'rating', 'boolean', 'select']),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean(),
  includeInOverall: z.boolean(),
  weight: z.number().optional(),
});

// ============================================================================
// ROUTER
// ============================================================================

export const observationsRouter = createTRPCRouter({
  // ==========================================================================
  // OBSERVATION LOGS
  // ==========================================================================

  /**
   * List observations with filters and pagination
   * Team leads see their own observations + those for their team
   * HR sees all observations
   */
  list: managerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid().optional(),
        observerId: z.string().uuid().optional(),
        period: z.enum(['daily', 'weekly', 'monthly']).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        status: z.enum(['draft', 'submitted', 'validated', 'rejected']).optional(),
        cycleId: z.string().uuid().optional(),
        kpiTemplateId: z.string().uuid().optional(),
        importBatchId: z.string().uuid().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const {
        employeeId,
        observerId,
        period,
        dateFrom,
        dateTo,
        status,
        cycleId,
        kpiTemplateId,
        importBatchId,
        search,
        limit,
        offset,
      } = input;

      // Build conditions
      const conditions = [eq(observationLogs.tenantId, tenantId)];

      if (employeeId) {
        conditions.push(eq(observationLogs.employeeId, employeeId));
      }

      if (observerId) {
        conditions.push(eq(observationLogs.observerId, observerId));
      }

      if (period) {
        conditions.push(eq(observationLogs.period, period));
      }

      if (dateFrom) {
        conditions.push(gte(observationLogs.observationDate, dateFrom));
      }

      if (dateTo) {
        conditions.push(lte(observationLogs.observationDate, dateTo));
      }

      if (status) {
        conditions.push(eq(observationLogs.status, status));
      }

      if (cycleId) {
        conditions.push(eq(observationLogs.cycleId, cycleId));
      }

      if (kpiTemplateId) {
        conditions.push(eq(observationLogs.kpiTemplateId, kpiTemplateId));
      }

      if (importBatchId) {
        conditions.push(eq(observationLogs.importBatchId, importBatchId));
      }

      // Fetch observations with employee/observer joins
      const observationsList = await ctx.db
        .select({
          observation: observationLogs,
          employee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
            department: employees.division,
            jobTitle: employees.jobTitle,
          },
        })
        .from(observationLogs)
        .leftJoin(employees, eq(observationLogs.employeeId, employees.id))
        .where(and(...conditions))
        .orderBy(desc(observationLogs.observationDate), desc(observationLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Get observer names separately if needed
      const observerIds = [...new Set(observationsList.map(o => o.observation.observerId).filter(Boolean))];
      let observerMap: Record<string, { firstName: string; lastName: string }> = {};

      if (observerIds.length > 0) {
        const observers = await ctx.db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(employees)
          .where(inArray(employees.id, observerIds as string[]));

        observerMap = Object.fromEntries(
          observers.map(o => [o.id, { firstName: o.firstName, lastName: o.lastName }])
        );
      }

      // Get total count
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(observationLogs)
        .where(and(...conditions));

      return {
        data: observationsList.map(row => ({
          ...row.observation,
          employee: row.employee,
          observer: row.observation.observerId
            ? observerMap[row.observation.observerId] ?? null
            : null,
        })),
        total: count,
        hasMore: offset + limit < count,
      };
    }),

  /**
   * Get a single observation by ID
   */
  getById: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      const [result] = await ctx.db
        .select({
          observation: observationLogs,
          employee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
            department: employees.division,
            jobTitle: employees.jobTitle,
          },
        })
        .from(observationLogs)
        .leftJoin(employees, eq(observationLogs.employeeId, employees.id))
        .where(
          and(
            eq(observationLogs.id, input.id),
            eq(observationLogs.tenantId, tenantId)
          )
        );

      if (!result) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Observation non trouvée',
        });
      }

      // Get observer info
      let observer = null;
      if (result.observation.observerId) {
        const [obs] = await ctx.db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
          })
          .from(employees)
          .where(eq(employees.id, result.observation.observerId));
        observer = obs ?? null;
      }

      // Get KPI template info
      let kpiTemplate = null;
      if (result.observation.kpiTemplateId) {
        const [tpl] = await ctx.db
          .select()
          .from(observationKpiTemplates)
          .where(eq(observationKpiTemplates.id, result.observation.kpiTemplateId));
        kpiTemplate = tpl ?? null;
      }

      return {
        ...result.observation,
        employee: result.employee,
        observer,
        kpiTemplate,
      };
    }),

  /**
   * Create a new observation (manual entry)
   */
  create: managerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        observationDate: z.string(),
        period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
        kpiTemplateId: z.string().uuid().optional(),
        kpiData: kpiDataSchema,
        overallRating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
        cycleId: z.string().uuid().optional(),
        status: z.enum(['draft', 'submitted']).default('draft'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify employee exists
      const [employee] = await ctx.db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.id, input.employeeId),
            eq(employees.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Employé non trouvé',
        });
      }

      // Verify cycle if provided
      if (input.cycleId) {
        const [cycle] = await ctx.db
          .select()
          .from(performanceCycles)
          .where(
            and(
              eq(performanceCycles.id, input.cycleId),
              eq(performanceCycles.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!cycle) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Cycle de performance non trouvé',
          });
        }
      }

      // Get observer ID (current user's employee record)
      let observerId: string | null = null;
      if (ctx.user.employeeId) {
        observerId = ctx.user.employeeId;
      }

      const [created] = await ctx.db
        .insert(observationLogs)
        .values({
          tenantId,
          employeeId: input.employeeId,
          observerId,
          observationDate: input.observationDate,
          period: input.period,
          kpiTemplateId: input.kpiTemplateId,
          kpiData: input.kpiData as ObservationKpiData,
          overallRating: input.overallRating,
          comment: input.comment,
          cycleId: input.cycleId,
          status: input.status,
          importSource: 'manual',
          createdBy: ctx.user.id,
        })
        .returning();

      return created;
    }),

  /**
   * Update an observation
   */
  update: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kpiData: kpiDataSchema.optional(),
        overallRating: z.number().min(1).max(5).optional().nullable(),
        comment: z.string().optional().nullable(),
        status: z.enum(['draft', 'submitted']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const { id, ...updates } = input;

      // Verify observation exists and user can edit
      const [observation] = await ctx.db
        .select()
        .from(observationLogs)
        .where(
          and(
            eq(observationLogs.id, id),
            eq(observationLogs.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!observation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Observation non trouvée',
        });
      }

      // Cannot update validated observations (only HR can)
      if (observation.status === 'validated' && !['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Impossible de modifier une observation validée',
        });
      }

      const [updated] = await ctx.db
        .update(observationLogs)
        .set({
          ...updates,
          kpiData: updates.kpiData as ObservationKpiData | undefined,
          updatedAt: new Date(),
        })
        .where(eq(observationLogs.id, id))
        .returning();

      return updated;
    }),

  /**
   * Delete an observation
   */
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify observation exists
      const [observation] = await ctx.db
        .select()
        .from(observationLogs)
        .where(
          and(
            eq(observationLogs.id, input.id),
            eq(observationLogs.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!observation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Observation non trouvée',
        });
      }

      // Cannot delete validated observations unless HR
      if (observation.status === 'validated' && !['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Impossible de supprimer une observation validée',
        });
      }

      await ctx.db
        .delete(observationLogs)
        .where(eq(observationLogs.id, input.id));

      return { success: true };
    }),

  /**
   * Validate observations (HR only)
   */
  validate: hrManagerProcedure
    .input(
      z.object({
        ids: z.array(z.string().uuid()).min(1),
        action: z.enum(['validate', 'reject']),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Verify all observations exist and are submitted
      const observations = await ctx.db
        .select()
        .from(observationLogs)
        .where(
          and(
            inArray(observationLogs.id, input.ids),
            eq(observationLogs.tenantId, tenantId)
          )
        );

      if (observations.length !== input.ids.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Certaines observations non trouvées',
        });
      }

      const notSubmitted = observations.filter(o => o.status !== 'submitted');
      if (notSubmitted.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${notSubmitted.length} observation(s) non soumise(s)`,
        });
      }

      const newStatus = input.action === 'validate' ? 'validated' : 'rejected';

      await ctx.db
        .update(observationLogs)
        .set({
          status: newStatus,
          validatedAt: new Date(),
          validatedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(inArray(observationLogs.id, input.ids));

      return { success: true, count: input.ids.length };
    }),

  /**
   * Bulk import observations from Excel
   * Expects pre-parsed data from the frontend
   */
  import: hrManagerProcedure
    .input(
      z.object({
        observations: z.array(
          z.object({
            employeeNumber: z.string(),
            observationDate: z.string(),
            period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
            kpiData: kpiDataSchema,
            overallRating: z.number().min(1).max(5).optional(),
            comment: z.string().optional(),
          })
        ),
        kpiTemplateId: z.string().uuid().optional(),
        cycleId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const importBatchId = crypto.randomUUID();

      // Get all employee numbers to IDs mapping
      const employeeNumbers = [...new Set(input.observations.map(o => o.employeeNumber))];

      const employeeList = await ctx.db
        .select({
          id: employees.id,
          employeeNumber: employees.employeeNumber,
        })
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, tenantId),
            inArray(employees.employeeNumber, employeeNumbers)
          )
        );

      const employeeMap = Object.fromEntries(
        employeeList.map(e => [e.employeeNumber, e.id])
      );

      // Find missing employees
      const missingEmployees = employeeNumbers.filter(num => !employeeMap[num]);
      if (missingEmployees.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Matricules non trouvés: ${missingEmployees.slice(0, 5).join(', ')}${missingEmployees.length > 5 ? ` (+${missingEmployees.length - 5} autres)` : ''}`,
        });
      }

      // Prepare observations for insertion
      const observationsToInsert = input.observations.map(obs => ({
        tenantId,
        employeeId: employeeMap[obs.employeeNumber]!,
        observationDate: obs.observationDate,
        period: obs.period,
        kpiTemplateId: input.kpiTemplateId,
        kpiData: obs.kpiData as ObservationKpiData,
        overallRating: obs.overallRating,
        comment: obs.comment,
        cycleId: input.cycleId,
        status: 'submitted' as const,
        importBatchId,
        importSource: 'excel' as const,
        createdBy: ctx.user.id,
      }));

      // Insert in batches of 100
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < observationsToInsert.length; i += batchSize) {
        const batch = observationsToInsert.slice(i, i + batchSize);
        await ctx.db.insert(observationLogs).values(batch);
        insertedCount += batch.length;
      }

      return {
        success: true,
        importBatchId,
        count: insertedCount,
      };
    }),

  /**
   * Download Excel template for observation import
   * Returns basic or extended template
   */
  exportTemplate: hrManagerProcedure
    .input(
      z.object({
        type: z.enum(['basic', 'extended']).default('basic'),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = input.type === 'extended'
        ? generateExtendedTemplate()
        : generateBasicTemplate();

      return {
        content: buffer.toString('base64'),
        filename: getTemplateFilename(input.type),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  /**
   * Download Excel template pre-filled with employee list
   * Useful for team leads to fill daily observations
   */
  exportPrefilledTemplate: hrManagerProcedure
    .input(
      z.object({
        departmentId: z.string().uuid().optional(),
        employeeIds: z.array(z.string().uuid()).optional(),
        includeProduction: z.boolean().default(true),
        includeAttendance: z.boolean().default(true),
        includeSafety: z.boolean().default(false),
        includeBehavior: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Build conditions
      const conditions = [
        eq(employees.tenantId, tenantId),
        eq(employees.status, 'active'),
      ];

      if (input.departmentId) {
        // Note: Using division for department
        conditions.push(eq(employees.division, input.departmentId));
      }

      if (input.employeeIds && input.employeeIds.length > 0) {
        conditions.push(inArray(employees.id, input.employeeIds));
      }

      // Get employees
      const employeeList = await ctx.db
        .select({
          employeeNumber: employees.employeeNumber,
          firstName: employees.firstName,
          lastName: employees.lastName,
          department: employees.division,
        })
        .from(employees)
        .where(and(...conditions))
        .orderBy(asc(employees.lastName), asc(employees.firstName));

      if (employeeList.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aucun employé trouvé avec les critères spécifiés',
        });
      }

      const buffer = generatePrefilledTemplate(
        employeeList.map(e => ({
          employeeNumber: e.employeeNumber,
          firstName: e.firstName,
          lastName: e.lastName,
          department: e.department ?? undefined,
        })),
        {
          type: 'custom',
          includeProduction: input.includeProduction,
          includeAttendance: input.includeAttendance,
          includeSafety: input.includeSafety,
          includeBehavior: input.includeBehavior,
        }
      );

      const departmentName = input.departmentId
        ? employeeList[0]?.department ?? undefined
        : undefined;

      return {
        content: buffer.toString('base64'),
        filename: getPrefilledTemplateFilename(departmentName),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        employeeCount: employeeList.length,
      };
    }),

  /**
   * Aggregate observations for evaluation period
   * Returns KPI summaries per employee for a date range
   */
  aggregateForEvaluation: hrManagerProcedure
    .input(
      z.object({
        employeeIds: z.array(z.string().uuid()).optional(),
        dateFrom: z.string(),
        dateTo: z.string(),
        cycleId: z.string().uuid().optional(),
        onlyValidated: z.boolean().default(true),
      })
    )
    .query(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;
      const { employeeIds, dateFrom, dateTo, cycleId, onlyValidated } = input;

      const conditions = [
        eq(observationLogs.tenantId, tenantId),
        gte(observationLogs.observationDate, dateFrom),
        lte(observationLogs.observationDate, dateTo),
      ];

      if (employeeIds && employeeIds.length > 0) {
        conditions.push(inArray(observationLogs.employeeId, employeeIds));
      }

      if (cycleId) {
        conditions.push(eq(observationLogs.cycleId, cycleId));
      }

      if (onlyValidated) {
        conditions.push(eq(observationLogs.status, 'validated'));
      }

      // Get all matching observations
      const observations = await ctx.db
        .select({
          observation: observationLogs,
          employee: {
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            employeeNumber: employees.employeeNumber,
          },
        })
        .from(observationLogs)
        .leftJoin(employees, eq(observationLogs.employeeId, employees.id))
        .where(and(...conditions))
        .orderBy(asc(observationLogs.employeeId), asc(observationLogs.observationDate));

      // Aggregate by employee
      const aggregatedMap = new Map<string, {
        employee: typeof observations[0]['employee'];
        observationCount: number;
        dateRange: { from: string; to: string };
        averageOverallRating: number | null;
        kpiSummary: {
          totalUnitsProduced: number;
          totalDefects: number;
          averageDefectRate: number | null;
          totalHoursWorked: number;
          totalLateMinutes: number;
          presentDays: number;
          absentJustifiedDays: number;
          absentUnjustifiedDays: number;
          averageSafetyScore: number | null;
          averageQualityScore: number | null;
          averageTeamworkScore: number | null;
          averageInitiativeScore: number | null;
          ppeComplianceRate: number | null;
          incidentCount: number;
        };
        observations: typeof observations;
      }>();

      for (const row of observations) {
        const empId = row.observation.employeeId;
        const kpi = row.observation.kpiData as ObservationKpiData;

        if (!aggregatedMap.has(empId)) {
          aggregatedMap.set(empId, {
            employee: row.employee,
            observationCount: 0,
            dateRange: { from: row.observation.observationDate, to: row.observation.observationDate },
            averageOverallRating: null,
            kpiSummary: {
              totalUnitsProduced: 0,
              totalDefects: 0,
              averageDefectRate: null,
              totalHoursWorked: 0,
              totalLateMinutes: 0,
              presentDays: 0,
              absentJustifiedDays: 0,
              absentUnjustifiedDays: 0,
              averageSafetyScore: null,
              averageQualityScore: null,
              averageTeamworkScore: null,
              averageInitiativeScore: null,
              ppeComplianceRate: null,
              incidentCount: 0,
            },
            observations: [],
          });
        }

        const agg = aggregatedMap.get(empId)!;
        agg.observationCount++;
        agg.observations.push(row);

        // Update date range
        if (row.observation.observationDate < agg.dateRange.from) {
          agg.dateRange.from = row.observation.observationDate;
        }
        if (row.observation.observationDate > agg.dateRange.to) {
          agg.dateRange.to = row.observation.observationDate;
        }

        // Accumulate KPIs
        const summary = agg.kpiSummary;
        if (kpi.unitsProduced) summary.totalUnitsProduced += kpi.unitsProduced;
        if (kpi.defects) summary.totalDefects += kpi.defects;
        if (kpi.hoursWorked) summary.totalHoursWorked += kpi.hoursWorked;
        if (kpi.lateMinutes) summary.totalLateMinutes += kpi.lateMinutes;

        if (kpi.absenceType === 'present') summary.presentDays++;
        else if (kpi.absenceType === 'absent_justified') summary.absentJustifiedDays++;
        else if (kpi.absenceType === 'absent_unjustified') summary.absentUnjustifiedDays++;

        if (kpi.incidentReported) summary.incidentCount++;
      }

      // Calculate averages
      for (const agg of aggregatedMap.values()) {
        const obs = agg.observations;
        const count = obs.length;

        // Overall rating average
        const ratingsWithValue = obs.filter(o => o.observation.overallRating != null);
        if (ratingsWithValue.length > 0) {
          agg.averageOverallRating = ratingsWithValue.reduce(
            (sum, o) => sum + (o.observation.overallRating ?? 0),
            0
          ) / ratingsWithValue.length;
        }

        // KPI averages
        const kpiList = obs.map(o => o.observation.kpiData as ObservationKpiData);

        const defectRates = kpiList.filter(k => k.defectRate != null).map(k => k.defectRate!);
        if (defectRates.length > 0) {
          agg.kpiSummary.averageDefectRate = defectRates.reduce((a, b) => a + b, 0) / defectRates.length;
        }

        const safetyScores = kpiList.filter(k => k.safetyScore != null).map(k => k.safetyScore!);
        if (safetyScores.length > 0) {
          agg.kpiSummary.averageSafetyScore = safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length;
        }

        const qualityScores = kpiList.filter(k => k.qualityScore != null).map(k => k.qualityScore!);
        if (qualityScores.length > 0) {
          agg.kpiSummary.averageQualityScore = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
        }

        const teamworkScores = kpiList.filter(k => k.teamworkScore != null).map(k => k.teamworkScore!);
        if (teamworkScores.length > 0) {
          agg.kpiSummary.averageTeamworkScore = teamworkScores.reduce((a, b) => a + b, 0) / teamworkScores.length;
        }

        const initiativeScores = kpiList.filter(k => k.initiativeScore != null).map(k => k.initiativeScore!);
        if (initiativeScores.length > 0) {
          agg.kpiSummary.averageInitiativeScore = initiativeScores.reduce((a, b) => a + b, 0) / initiativeScores.length;
        }

        const ppeCompliance = kpiList.filter(k => k.ppeCompliance != null);
        if (ppeCompliance.length > 0) {
          const compliant = ppeCompliance.filter(k => k.ppeCompliance === true).length;
          agg.kpiSummary.ppeComplianceRate = (compliant / ppeCompliance.length) * 100;
        }

        // Remove raw observations from response (too verbose)
        delete (agg as any).observations;
      }

      return {
        data: Array.from(aggregatedMap.values()),
        dateRange: { from: dateFrom, to: dateTo },
        totalObservations: observations.length,
      };
    }),

  /**
   * Get dashboard statistics for observations
   */
  getDashboardStats: managerProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    // Get counts by status
    const statusCounts = await ctx.db
      .select({
        status: observationLogs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(observationLogs)
      .where(eq(observationLogs.tenantId, tenantId))
      .groupBy(observationLogs.status);

    const statusMap = Object.fromEntries(statusCounts.map(s => [s.status, s.count]));

    // Get this month's observations
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [thisMonthCount] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(observationLogs)
      .where(
        and(
          eq(observationLogs.tenantId, tenantId),
          gte(observationLogs.createdAt, startOfMonth)
        )
      );

    // Get pending validation count
    const [pendingValidation] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(observationLogs)
      .where(
        and(
          eq(observationLogs.tenantId, tenantId),
          eq(observationLogs.status, 'submitted')
        )
      );

    return {
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      byStatus: statusMap,
      thisMonth: thisMonthCount.count,
      pendingValidation: pendingValidation.count,
    };
  }),

  // ==========================================================================
  // KPI TEMPLATES
  // ==========================================================================

  templates: createTRPCRouter({
    /**
     * List KPI templates
     */
    list: protectedProcedure
      .input(
        z.object({
          activeOnly: z.boolean().default(true),
        }).optional()
      )
      .query(async ({ input, ctx }) => {
        const tenantId = ctx.user.tenantId;

        const conditions = [eq(observationKpiTemplates.tenantId, tenantId)];

        if (input?.activeOnly) {
          conditions.push(eq(observationKpiTemplates.isActive, true));
        }

        const templates = await ctx.db
          .select()
          .from(observationKpiTemplates)
          .where(and(...conditions))
          .orderBy(desc(observationKpiTemplates.isDefault), asc(observationKpiTemplates.name));

        return templates;
      }),

    /**
     * Get a single template by ID
     */
    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        const tenantId = ctx.user.tenantId;

        const [template] = await ctx.db
          .select()
          .from(observationKpiTemplates)
          .where(
            and(
              eq(observationKpiTemplates.id, input.id),
              eq(observationKpiTemplates.tenantId, tenantId)
            )
          );

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Modèle KPI non trouvé',
          });
        }

        return template;
      }),

    /**
     * Create a KPI template
     */
    create: hrManagerProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          kpiFields: z.array(kpiFieldDefinitionSchema).min(1),
          isDefault: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const tenantId = ctx.user.tenantId;

        // If setting as default, clear other defaults
        if (input.isDefault) {
          await ctx.db
            .update(observationKpiTemplates)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(observationKpiTemplates.tenantId, tenantId),
                eq(observationKpiTemplates.isDefault, true)
              )
            );
        }

        const [created] = await ctx.db
          .insert(observationKpiTemplates)
          .values({
            tenantId,
            name: input.name,
            description: input.description,
            kpiFields: input.kpiFields,
            isDefault: input.isDefault,
            createdBy: ctx.user.id,
          })
          .returning();

        return created;
      }),

    /**
     * Update a KPI template
     */
    update: hrManagerProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          description: z.string().optional().nullable(),
          kpiFields: z.array(kpiFieldDefinitionSchema).min(1).optional(),
          isDefault: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const tenantId = ctx.user.tenantId;
        const { id, ...updates } = input;

        // Verify template exists
        const [template] = await ctx.db
          .select()
          .from(observationKpiTemplates)
          .where(
            and(
              eq(observationKpiTemplates.id, id),
              eq(observationKpiTemplates.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Modèle KPI non trouvé',
          });
        }

        // If setting as default, clear other defaults
        if (updates.isDefault === true) {
          await ctx.db
            .update(observationKpiTemplates)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(observationKpiTemplates.tenantId, tenantId),
                eq(observationKpiTemplates.isDefault, true)
              )
            );
        }

        const [updated] = await ctx.db
          .update(observationKpiTemplates)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(observationKpiTemplates.id, id))
          .returning();

        return updated;
      }),

    /**
     * Delete a KPI template (soft delete - set inactive)
     */
    delete: hrManagerProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = ctx.user.tenantId;

        // Verify template exists
        const [template] = await ctx.db
          .select()
          .from(observationKpiTemplates)
          .where(
            and(
              eq(observationKpiTemplates.id, input.id),
              eq(observationKpiTemplates.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!template) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Modèle KPI non trouvé',
          });
        }

        // Check if template is in use
        const [usageCount] = await ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(observationLogs)
          .where(eq(observationLogs.kpiTemplateId, input.id));

        if (usageCount.count > 0) {
          // Soft delete - just deactivate
          await ctx.db
            .update(observationKpiTemplates)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(observationKpiTemplates.id, input.id));

          return { success: true, softDeleted: true };
        }

        // Hard delete if not in use
        await ctx.db
          .delete(observationKpiTemplates)
          .where(eq(observationKpiTemplates.id, input.id));

        return { success: true, softDeleted: false };
      }),
  }),
});
