/**
 * Employees tRPC Router
 *
 * Handles all employee-related operations with:
 * - RLS enforcement via tenant context
 * - Zod validation
 * - Event emission
 * - French error messages
 */

import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../api/trpc';
import {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  terminateEmployee,
  suspendEmployee,
  reactivateEmployee,
} from '@/features/employees/services/employee.service';
import { eventBus } from '@/lib/event-bus';
import { TRPCError } from '@trpc/server';

// Zod Schemas
const genderEnum = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const statusEnum = z.enum(['active', 'terminated', 'suspended']);

// Component schema for validation
const componentSchema = z.object({
  code: z.string().min(1, 'Le code du composant est requis'),
  name: z.string().min(1, 'Le nom du composant est requis'),
  amount: z.number().min(0, 'Le montant doit être positif'),
  sourceType: z.enum(['standard', 'custom', 'calculated']).default('standard'),
  metadata: z.record(z.any()).optional(),
});

const createEmployeeSchema = z.object({
  // Personal info
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  preferredName: z.string().optional(),
  dateOfBirth: z.date().optional(),
  gender: genderEnum.optional(),

  // Contact
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  nationalId: z.string().optional(),

  // Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2).default('CI'),

  // Employment
  hireDate: z.date(),

  // Banking
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),

  // Tax & CNPS
  cnpsNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  taxDependents: z.number().int().min(0).max(10).default(0),

  // Position & Salary (base salary + components)
  positionId: z.string().uuid('Position invalide'),
  coefficient: z.number().int().min(90).max(1000).default(100),
  baseSalary: z.number().min(75000, 'Le salaire de base doit être >= 75000 FCFA (SMIG)'),
  components: z.array(componentSchema).default([]),

  // Custom fields
  customFields: z.record(z.any()).optional(),
});

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.date().optional(),
  gender: genderEnum.optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2).optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  cnpsNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  taxDependents: z.number().int().min(0).max(10).optional(),
  coefficient: z.number().int().min(90).max(1000).optional(),
  customFields: z.record(z.any()).optional(),
});

const listEmployeesSchema = z.object({
  status: statusEnum.optional(),
  search: z.string().optional(),
  positionId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

const getEmployeeByIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const terminateEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  terminationDate: z.date(),
  terminationReason: z.string().min(1, 'La raison est requise'),
});

const suspendEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
});

const reactivateEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
});

// Router
export const employeesRouter = createTRPCRouter({
  /**
   * Create a new employee (hire)
   */
  create: publicProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const employee = await createEmployee({
          ...input,
          tenantId: ctx.tenantId,
          createdBy: ctx.user.id,
          createdByEmail: 'system', // TODO: Add email to user context
        });

        // Emit employee.hired event
        await eventBus.publish('employee.hired', {
          employeeId: employee.id,
          tenantId: employee.tenantId,
          hireDate: new Date(employee.hireDate),
          positionId: input.positionId,
        });

        return employee;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la création de l\'employé',
        });
      }
    }),

  /**
   * List employees with filtering
   */
  list: publicProcedure
    .input(listEmployeesSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await listEmployees({
          ...input,
          tenantId: ctx.tenantId,
        });
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des employés',
        });
      }
    }),

  /**
   * Get employee by ID with full details
   */
  getById: publicProcedure
    .input(getEmployeeByIdSchema)
    .query(async ({ input, ctx }) => {
      try {
        return await getEmployeeById(input.id, ctx.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Employé non trouvé',
        });
      }
    }),

  /**
   * Update employee information
   */
  update: publicProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const updatedEmployee = await updateEmployee({
          ...input,
          tenantId: ctx.tenantId,
          updatedBy: ctx.user.id,
          updatedByEmail: 'system', // TODO: Add email to user context
        });

        // Emit employee.updated event
        await eventBus.publish('employee.updated', {
          employeeId: input.id,
          tenantId: ctx.tenantId,
          changes: input,
        });

        return updatedEmployee;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour de l\'employé',
        });
      }
    }),

  /**
   * Terminate employee
   */
  terminate: publicProcedure
    .input(terminateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const employee = await terminateEmployee({
          ...input,
          tenantId: ctx.tenantId,
          updatedBy: ctx.user.id,
          updatedByEmail: 'system', // TODO: Add email to user context
        });

        // Emit employee.terminated event
        await eventBus.publish('employee.terminated', {
          employeeId: employee.id,
          tenantId: employee.tenantId,
          terminationDate: new Date(employee.terminationDate!),
          reason: employee.terminationReason!,
        });

        return employee;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la cessation de l\'employé',
        });
      }
    }),

  /**
   * Suspend employee
   */
  suspend: publicProcedure
    .input(suspendEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const employee = await suspendEmployee(
          input.employeeId,
          ctx.tenantId,
          ctx.user.id
        );

        // Emit employee.suspended event
        await eventBus.publish('employee.suspended', {
          employeeId: employee.id,
          tenantId: employee.tenantId,
          suspensionStart: new Date(),
          reason: 'Manual suspension',
        });

        return employee;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la suspension de l\'employé',
        });
      }
    }),

  /**
   * Reactivate suspended employee
   */
  reactivate: publicProcedure
    .input(reactivateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await reactivateEmployee(
          input.employeeId,
          ctx.tenantId,
          ctx.user.id
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la réactivation de l\'employé',
        });
      }
    }),
});
