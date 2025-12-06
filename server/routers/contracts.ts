/**
 * Contracts tRPC Router
 *
 * Handles contract-related operations including updating contract details.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { employmentContracts, employees } from '@/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const contractsRouter = createTRPCRouter({
  /**
   * Check if new contract dates overlap with existing active contracts
   * Used to prevent creating conflicting contracts while allowing future contracts
   */
  checkContractOverlap: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        startDate: z.string(), // New contract start date
        endDate: z.string().nullable().optional(), // New contract end date (null for CDI/CDDTI)
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      // Find all active contracts for this employee
      const activeContracts = await db.query.employmentContracts.findMany({
        where: and(
          eq(employmentContracts.employeeId, input.employeeId),
          eq(employmentContracts.tenantId, user.tenantId),
          eq(employmentContracts.isActive, true)
        ),
      });

      // Check for date overlap
      // Two date ranges overlap if: newStart <= existingEnd AND newEnd >= existingStart
      const newStart = input.startDate;
      const newEnd = input.endDate || '9999-12-31'; // CDI/CDDTI = infinite end

      const overlapping = activeContracts.find((contract) => {
        const existingStart = contract.startDate;
        const existingEnd = contract.endDate || '9999-12-31';

        return newStart <= existingEnd && newEnd >= existingStart;
      });

      // Check if there's an active contract that the new one follows (future contract)
      const precedingContract = activeContracts.find((contract) => {
        const existingEnd = contract.endDate;
        // New contract starts after existing ends (no overlap, but there is a preceding contract)
        return existingEnd && newStart > existingEnd;
      });

      return {
        hasOverlap: !!overlapping,
        overlappingContract: overlapping
          ? {
              id: overlapping.id,
              contractType: overlapping.contractType,
              startDate: overlapping.startDate,
              endDate: overlapping.endDate,
            }
          : null,
        // Info about preceding contract (for "future contract allowed" message)
        precedingContract: !overlapping && precedingContract
          ? {
              id: precedingContract.id,
              contractType: precedingContract.contractType,
              startDate: precedingContract.startDate,
              endDate: precedingContract.endDate,
            }
          : null,
      };
    }),

  /**
   * Update existing contract
   * Allows updating key contract fields (not the type)
   */
  updateContract: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        contractNumber: z.string().nullable().optional(),
        startDate: z.string().optional(),
        endDate: z.string().nullable().optional(),
        cddReason: z.string().nullable().optional(),
        cddtiTaskDescription: z.string().nullable().optional(),
        signedDate: z.string().nullable().optional(),
        contractFileUrl: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        contractHtmlContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Get the contract to verify ownership and existence
      const [existingContract] = await db
        .select()
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.id),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!existingContract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat non trouvé',
        });
      }

      // Verify user has permission (must be from same tenant)
      if (existingContract.tenantId !== user.tenantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        });
      }

      // Update the contract
      const [updated] = await db
        .update(employmentContracts)
        .set({
          contractNumber: input.contractNumber !== undefined ? input.contractNumber : existingContract.contractNumber,
          startDate: input.startDate !== undefined ? input.startDate : existingContract.startDate,
          endDate: input.endDate !== undefined ? input.endDate : existingContract.endDate,
          cddReason: input.cddReason !== undefined ? input.cddReason : existingContract.cddReason,
          cddtiTaskDescription: input.cddtiTaskDescription !== undefined
            ? input.cddtiTaskDescription
            : existingContract.cddtiTaskDescription,
          signedDate: input.signedDate !== undefined ? input.signedDate : existingContract.signedDate,
          contractFileUrl: input.contractFileUrl !== undefined ? input.contractFileUrl : existingContract.contractFileUrl,
          notes: input.notes !== undefined ? input.notes : existingContract.notes,
          contractHtmlContent: input.contractHtmlContent !== undefined ? input.contractHtmlContent : existingContract.contractHtmlContent,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employmentContracts.id, input.id),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .returning();

      return updated;
    }),

  /**
   * Change contract type
   * Terminates the old contract and creates a new one with the new type
   */
  changeContractType: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        oldContractId: z.string().uuid(),
        newContractType: z.enum(['CDI', 'CDD', 'CDDTI', 'STAGE', 'INTERIM']),
        startDate: z.string(),
        endDate: z.string().nullable().optional(),
        contractNumber: z.string().nullable().optional(),
        cddReason: z.string().nullable().optional(),
        cddtiTaskDescription: z.string().nullable().optional(),
        terminationReason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Get the old contract to verify ownership
      const [oldContract] = await db
        .select()
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.oldContractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!oldContract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat actuel non trouvé',
        });
      }

      // Verify user has permission
      if (oldContract.tenantId !== user.tenantId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Accès refusé',
        });
      }

      const terminationDate = input.startDate;

      // Terminate the old contract
      await db
        .update(employmentContracts)
        .set({
          isActive: false,
          terminationDate,
          terminationReason: input.terminationReason,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(employmentContracts.id, input.oldContractId));

      // Create the new contract
      const [newContract] = await db
        .insert(employmentContracts)
        .values({
          tenantId: user.tenantId,
          employeeId: input.employeeId,
          contractType: input.newContractType,
          contractNumber: input.contractNumber || null,
          startDate: input.startDate,
          endDate: input.endDate || undefined,
          cddReason: input.cddReason || undefined,
          // CDDTI requires task description (cddti_task_recommended constraint)
          cddtiTaskDescription: input.newContractType === 'CDDTI'
            ? (input.cddtiTaskDescription || 'Tâches générales')
            : (input.cddtiTaskDescription || undefined),
          renewalCount: 0,
          isActive: true,
          replacesContractId: input.oldContractId,
          createdBy: user.id,
        })
        .returning();

      // Update employee's currentContractId
      await db
        .update(employees)
        .set({
          currentContractId: newContract.id,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employees.id, input.employeeId),
            eq(employees.tenantId, user.tenantId)
          )
        );

      return newContract;
    }),

  /**
   * Get all contracts with filters and pagination
   * For central contract management page
   */
  getAllContracts: protectedProcedure
    .input(
      z.object({
        // Filters
        contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE']).optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(), // Employee name or contract number
        expiringInDays: z.number().optional(), // Contracts expiring in next X days

        // Pagination
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),

        // Sorting
        sortBy: z.enum(['startDate', 'endDate', 'employeeName']).optional(),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      // Build base query
      const query = db
        .select({
          id: employmentContracts.id,
          employeeId: employmentContracts.employeeId,
          contractType: employmentContracts.contractType,
          contractNumber: employmentContracts.contractNumber,
          startDate: employmentContracts.startDate,
          endDate: employmentContracts.endDate,
          isActive: employmentContracts.isActive,
          renewalCount: employmentContracts.renewalCount,
          cddReason: employmentContracts.cddReason,
          cddtiTaskDescription: employmentContracts.cddtiTaskDescription,
          terminationDate: employmentContracts.terminationDate,
          terminationReason: employmentContracts.terminationReason,
          createdAt: employmentContracts.createdAt,
          signedDate: employmentContracts.signedDate,
          contractFileUrl: employmentContracts.contractFileUrl,
          // Employee details
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        })
        .from(employmentContracts)
        .leftJoin(employees, eq(employmentContracts.employeeId, employees.id));

      // Apply filters
      const conditions = [eq(employmentContracts.tenantId, user.tenantId)];

      if (input.contractType) {
        conditions.push(eq(employmentContracts.contractType, input.contractType));
      }

      if (input.isActive !== undefined) {
        conditions.push(eq(employmentContracts.isActive, input.isActive));
      }

      const contracts = await query
        .where(and(...conditions))
        .limit(input.limit)
        .offset(input.offset);

      // Filter by search (employee name or contract number) - client-side
      let filtered = contracts;
      if (input.search) {
        const searchLower = input.search.toLowerCase();
        filtered = contracts.filter(
          (c) =>
            c.employeeFirstName?.toLowerCase().includes(searchLower) ||
            c.employeeLastName?.toLowerCase().includes(searchLower) ||
            c.contractNumber?.toLowerCase().includes(searchLower)
        );
      }

      // Filter by expiring in X days
      if (input.expiringInDays && input.expiringInDays > 0) {
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + input.expiringInDays);

        filtered = filtered.filter((c) => {
          if (!c.endDate) return false;
          const endDate = new Date(c.endDate);
          return endDate >= today && endDate <= futureDate;
        });
      }

      // Sort
      if (input.sortBy === 'employeeName') {
        filtered.sort((a, b) => {
          const nameA = `${a.employeeLastName || ''} ${a.employeeFirstName || ''}`;
          const nameB = `${b.employeeLastName || ''} ${b.employeeFirstName || ''}`;
          return input.sortOrder === 'asc'
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
        });
      } else if (input.sortBy === 'startDate') {
        filtered.sort((a, b) => {
          const dateA = new Date(a.startDate || 0).getTime();
          const dateB = new Date(b.startDate || 0).getTime();
          return input.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      } else if (input.sortBy === 'endDate') {
        filtered.sort((a, b) => {
          const dateA = new Date(a.endDate || 0).getTime();
          const dateB = new Date(b.endDate || 0).getTime();
          return input.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
      }

      // Get total count
      const allContracts = await db
        .select()
        .from(employmentContracts)
        .where(and(...conditions));

      return {
        contracts: filtered.map((c) => ({
          ...c,
          employeeName: `${c.employeeFirstName} ${c.employeeLastName}`,
        })),
        total: allContracts.length,
        hasMore: input.offset + input.limit < allContracts.length,
      };
    }),

  /**
   * Create new contract
   * For contract creation wizard
   */
  createContract: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE']),
        startDate: z.string(),
        endDate: z.string().nullable().optional(),
        contractNumber: z.string().optional(),

        // Type-specific fields
        cddReason: z.string().optional(),
        cddtiTaskDescription: z.string().optional(),

        // Optional fields
        signedDate: z.string().nullable().optional(),
        notes: z.string().optional(),

        // Contract content (WYSIWYG editor)
        contractHtmlContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Validate type-specific requirements
      if (input.contractType === 'CDD' && !input.endDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Les contrats CDD doivent avoir une date de fin',
        });
      }

      if (input.contractType === 'CDDTI' && !input.cddtiTaskDescription) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Les contrats CDDTI doivent avoir une description de tâche',
        });
      }

      if ((input.contractType === 'CDI' || input.contractType === 'CDDTI') && input.endDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Les contrats CDI et CDDTI ne peuvent pas avoir de date de fin',
        });
      }

      // 1. Check for overlapping contracts (allows future contracts, blocks overlaps)
      const newStart = input.startDate;
      const newEnd = input.endDate || '9999-12-31'; // CDI/CDDTI = infinite end

      const activeContracts = await db.query.employmentContracts.findMany({
        where: and(
          eq(employmentContracts.employeeId, input.employeeId),
          eq(employmentContracts.tenantId, user.tenantId),
          eq(employmentContracts.isActive, true)
        ),
      });

      const overlapping = activeContracts.find((contract) => {
        const existingStart = contract.startDate;
        const existingEnd = contract.endDate || '9999-12-31';
        return newStart <= existingEnd && newEnd >= existingStart;
      });

      if (overlapping) {
        const endInfo = overlapping.endDate
          ? `jusqu'au ${overlapping.endDate}`
          : '(durée indéterminée)';
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Les dates chevauchent un contrat ${overlapping.contractType} actif du ${overlapping.startDate} ${endInfo}.`,
        });
      }

      // 2. Create new contract
      const [contract] = await db
        .insert(employmentContracts)
        .values({
          tenantId: user.tenantId,
          employeeId: input.employeeId,
          contractType: input.contractType,
          startDate: input.startDate,
          endDate: input.endDate || undefined,
          contractNumber:
            input.contractNumber ||
            `CONT-${new Date().getFullYear()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
          cddReason: input.cddReason || undefined,
          cddtiTaskDescription: input.cddtiTaskDescription || undefined,
          signedDate: input.signedDate || undefined,
          notes: input.notes || undefined,
          contractHtmlContent: input.contractHtmlContent || undefined,
          isActive: true,
          renewalCount: 0,
          createdBy: user.id,
        })
        .returning();

      // 3. Update employee.currentContractId
      await db
        .update(employees)
        .set({
          currentContractId: contract.id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(employees.id, input.employeeId));

      return contract;
    }),

  /**
   * Terminate contract
   */
  terminateContract: protectedProcedure
    .input(
      z.object({
        contractId: z.string().uuid(),
        terminationDate: z.string(),
        terminationReason: z.string().min(1, 'La raison de résiliation est requise'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const [updated] = await db
        .update(employmentContracts)
        .set({
          isActive: false,
          terminationDate: input.terminationDate,
          terminationReason: input.terminationReason,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employmentContracts.id, input.contractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat non trouvé',
        });
      }

      return {
        success: true,
        message: 'Contrat résilié avec succès',
        contract: updated,
      };
    }),

  /**
   * Get contract statistics for dashboard
   */
  getContractStats: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx;

    const allContracts = await db
      .select()
      .from(employmentContracts)
      .where(
        and(
          eq(employmentContracts.tenantId, user.tenantId),
          eq(employmentContracts.isActive, true)
        )
      );

    const total = allContracts.length;
    const cdi = allContracts.filter((c) => c.contractType === 'CDI').length;
    const cdd = allContracts.filter((c) => c.contractType === 'CDD').length;
    const cddti = allContracts.filter((c) => c.contractType === 'CDDTI').length;

    // Count contracts expiring in next 30 days
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 30);

    const expiringSoon = allContracts.filter((c) => {
      if (!c.endDate) return false;
      const endDate = new Date(c.endDate);
      return endDate >= today && endDate <= futureDate;
    }).length;

    return {
      total,
      cdi,
      cdd,
      cddti,
      expiringSoon,
      cdiPercentage: total > 0 ? Math.round((cdi / total) * 100) : 0,
      cddPercentage: total > 0 ? Math.round((cdd / total) * 100) : 0,
      cddtiPercentage: total > 0 ? Math.round((cddti / total) * 100) : 0,
    };
  }),

  /**
   * Bulk export contracts to CSV
   */
  bulkExportContracts: protectedProcedure
    .input(
      z.object({
        contractIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const contracts = await db
        .select({
          id: employmentContracts.id,
          contractType: employmentContracts.contractType,
          contractNumber: employmentContracts.contractNumber,
          startDate: employmentContracts.startDate,
          endDate: employmentContracts.endDate,
          isActive: employmentContracts.isActive,
          // Employee details
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
          employeeNumber: employees.employeeNumber,
        })
        .from(employmentContracts)
        .leftJoin(employees, eq(employmentContracts.employeeId, employees.id))
        .where(
          and(
            eq(employmentContracts.tenantId, user.tenantId),
            // Filter by contractIds if provided
            input.contractIds.length > 0
              ? sql`${employmentContracts.id} = ANY(${input.contractIds})`
              : sql`1=1`
          )
        );

      // Generate CSV
      const csvHeader =
        'Employé,N° Employé,Type Contrat,N° Contrat,Date Début,Date Fin,Statut\n';
      const csvRows = contracts
        .map(
          (c) =>
            `"${c.employeeFirstName} ${c.employeeLastName}","${c.employeeNumber || ''}","${c.contractType}","${c.contractNumber || ''}","${c.startDate}","${c.endDate || 'Indéterminé'}","${c.isActive ? 'Actif' : 'Terminé'}"`
        )
        .join('\n');

      const csv = csvHeader + csvRows;

      return {
        csv,
        filename: `contrats-export-${new Date().toISOString().split('T')[0]}.csv`,
        count: contracts.length,
      };
    }),

  /**
   * Update contract HTML content
   * Stores editable HTML content for Word-like contract editing
   */
  updateContractHtml: protectedProcedure
    .input(
      z.object({
        contractId: z.string().uuid(),
        htmlContent: z.string().min(1, 'Le contenu HTML ne peut pas être vide'),
        templateSource: z.enum(['blank', 'previous', 'system_default']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Verify contract exists and user has access
      const [contract] = await db
        .select()
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.contractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat non trouvé',
        });
      }

      // Update contract with HTML content
      const [updated] = await db
        .update(employmentContracts)
        .set({
          contractHtmlContent: input.htmlContent,
          contractTemplateSource: input.templateSource || contract.contractTemplateSource,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employmentContracts.id, input.contractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .returning();

      return {
        success: true,
        contract: updated,
      };
    }),

  /**
   * Get contract HTML content
   * Returns stored HTML content for editing
   */
  getContractHtml: protectedProcedure
    .input(
      z.object({
        contractId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { user } = ctx;

      const [contract] = await db
        .select({
          id: employmentContracts.id,
          contractHtmlContent: employmentContracts.contractHtmlContent,
          contractTemplateSource: employmentContracts.contractTemplateSource,
          contractType: employmentContracts.contractType,
          contractNumber: employmentContracts.contractNumber,
        })
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.contractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat non trouvé',
        });
      }

      return {
        htmlContent: contract.contractHtmlContent,
        templateSource: contract.contractTemplateSource,
        contractType: contract.contractType,
        contractNumber: contract.contractNumber,
      };
    }),

  /**
   * Copy contract HTML content from another contract
   * Useful for creating similar contracts
   */
  copyContractContent: protectedProcedure
    .input(
      z.object({
        sourceContractId: z.string().uuid(),
        targetContractId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Get source contract
      const [sourceContract] = await db
        .select({
          htmlContent: employmentContracts.contractHtmlContent,
        })
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.sourceContractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!sourceContract || !sourceContract.htmlContent) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat source non trouvé ou sans contenu',
        });
      }

      // Verify target contract exists and user has access
      const [targetContract] = await db
        .select()
        .from(employmentContracts)
        .where(
          and(
            eq(employmentContracts.id, input.targetContractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .limit(1);

      if (!targetContract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Contrat cible non trouvé',
        });
      }

      // Copy HTML content to target contract
      const [updated] = await db
        .update(employmentContracts)
        .set({
          contractHtmlContent: sourceContract.htmlContent,
          contractTemplateSource: 'previous',
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(employmentContracts.id, input.targetContractId),
            eq(employmentContracts.tenantId, user.tenantId)
          )
        )
        .returning();

      return {
        success: true,
        contract: updated,
      };
    }),
});
