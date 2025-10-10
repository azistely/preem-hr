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
import { createTRPCRouter, publicProcedure, employeeProcedure, managerProcedure, hrManagerProcedure } from '../api/trpc';
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
   * Requires: HR Manager role
   */
  create: hrManagerProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const employee = await createEmployee({
          ...input,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
          createdByEmail: 'system', // TODO: Add email to user context
        } as any);

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
          tenantId: ctx.user.tenantId,
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
        return await getEmployeeById(input.id, ctx.user.tenantId);
      } catch (error: any) {
        throw new TRPCError({
          code: error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Employé non trouvé',
        });
      }
    }),

  /**
   * Update employee information
   * Requires: HR Manager role
   */
  update: hrManagerProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const updatedEmployee = await updateEmployee({
          ...input,
          tenantId: ctx.user.tenantId,
          updatedBy: ctx.user.id,
          updatedByEmail: 'system', // TODO: Add email to user context
        });

        // Emit employee.updated event
        await eventBus.publish('employee.updated', {
          employeeId: input.id,
          tenantId: ctx.user.tenantId,
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
   * Requires: HR Manager role
   */
  terminate: hrManagerProcedure
    .input(terminateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const employee = await terminateEmployee({
          ...input,
          tenantId: ctx.user.tenantId,
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
   * Requires: HR Manager role
   */
  suspend: hrManagerProcedure
    .input(suspendEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const employee = await suspendEmployee(
          input.employeeId,
          ctx.user.tenantId,
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
   * Requires: HR Manager role
   */
  reactivate: hrManagerProcedure
    .input(reactivateEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await reactivateEmployee(
          input.employeeId,
          ctx.user.tenantId,
          ctx.user.id
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la réactivation de l\'employé',
        });
      }
    }),

  /**
   * Get current logged-in employee
   * Used by employee-facing pages to get their own data
   * Requires: Employee role
   */
  getCurrentEmployee: employeeProcedure.query(async ({ ctx }) => {
    if (!ctx.user.employeeId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Aucun profil employé associé à ce compte utilisateur',
      });
    }

    try {
      const employee = await getEmployeeById(ctx.user.employeeId, ctx.user.tenantId);

      if (!employee) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Profil employé introuvable',
        });
      }

      return employee;
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Erreur lors de la récupération du profil employé',
      });
    }
  }),

  /**
   * Get team members reporting to manager (P0-4: Manager Team Roster)
   * Returns all employees where reporting_manager_id = managerId
   * Requires: Manager role
   */
  getTeamMembers: managerProcedure
    .input(
      z.object({
        managerId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = await import('@/db');
      const { employees } = await import('@/drizzle/schema');
      const { eq, and } = await import('drizzle-orm');

      // Managers can only view their own team members
      // HR/Admin can view any manager's team (role check handled by procedure)
      const isOwnTeam = ctx.user.employeeId === input.managerId;
      const canViewAnyTeam = ['hr_manager', 'tenant_admin', 'super_admin'].includes(ctx.user.role);

      if (!isOwnTeam && !canViewAnyTeam) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Vous ne pouvez consulter que les membres de votre propre équipe',
        });
      }

      // Fetch all employees reporting to this manager
      const teamMembers = await db.query.employees.findMany({
        where: (employees, { and, eq }) =>
          and(
            eq(employees.reportingManagerId, input.managerId),
            eq(employees.tenantId, ctx.user.tenantId)
          ),
        orderBy: (employees, { asc }) => [asc(employees.lastName), asc(employees.firstName)],
      });

      return teamMembers;
    }),

  /**
   * Export employees to CSV (P1-8: Bulk Operations)
   * Requires: HR Manager role
   */
  exportEmployees: hrManagerProcedure
    .input(
      z.object({
        status: statusEnum.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { db } = await import('@/db');
      const { employees, positions } = await import('@/drizzle/schema');
      const { eq, and } = await import('drizzle-orm');

      try {
        // Fetch employees with position data
        const employeesList = await db
          .select({
            id: employees.id,
            employeeNumber: employees.employeeNumber,
            firstName: employees.firstName,
            lastName: employees.lastName,
            email: employees.email,
            phone: employees.phone,
            hireDate: employees.hireDate,
            coefficient: employees.coefficient,
            status: employees.status,
            addressLine1: employees.addressLine1,
            addressLine2: employees.addressLine2,
            city: employees.city,
            postalCode: employees.postalCode,
            bankName: employees.bankName,
            bankAccount: employees.bankAccount,
            cnpsNumber: employees.cnpsNumber,
            taxNumber: employees.taxNumber,
            taxDependents: employees.taxDependents,
          })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, ctx.user.tenantId),
              input.status ? eq(employees.status, input.status) : undefined
            )
          )
          .orderBy(employees.lastName, employees.firstName);

        return employeesList;
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de l\'export des employés',
        });
      }
    }),

  /**
   * Import employees from CSV (P1-8: Bulk Operations)
   * Requires: HR Manager role
   */
  importEmployees: hrManagerProcedure
    .input(
      z.object({
        employees: z.array(
          z.object({
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            email: z.string().email(),
            phone: z.string().optional(),
            hireDate: z.string(), // ISO date string
            positionTitle: z.string().min(1),
            baseSalary: z.number().min(75000),
            coefficient: z.number().int().min(90).max(1000).default(100),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = await import('@/db');
      const { employees, positions, employeeSalaries } = await import('@/drizzle/schema');
      const { eq, and } = await import('drizzle-orm');

      try {
        const results = {
          success: [] as string[],
          errors: [] as { row: number; email: string; error: string }[],
        };

        // Process each employee
        for (let i = 0; i < input.employees.length; i++) {
          const employeeData = input.employees[i];

          try {
            // Find position by title
            const position = await db.query.positions.findFirst({
              where: (positions, { and, eq }) =>
                and(
                  eq(positions.tenantId, ctx.user.tenantId),
                  eq(positions.title, employeeData.positionTitle)
                ),
            });

            if (!position) {
              results.errors.push({
                row: i + 1,
                email: employeeData.email,
                error: `Position "${employeeData.positionTitle}" introuvable`,
              });
              continue;
            }

            // Check if employee already exists
            const existingEmployee = await db.query.employees.findFirst({
              where: (employees, { and, eq }) =>
                and(
                  eq(employees.tenantId, ctx.user.tenantId),
                  eq(employees.email, employeeData.email)
                ),
            });

            if (existingEmployee) {
              results.errors.push({
                row: i + 1,
                email: employeeData.email,
                error: 'Cet employé existe déjà',
              });
              continue;
            }

            // Create employee using the service
            const employee = await createEmployee({
              tenantId: ctx.user.tenantId,
              createdBy: ctx.user.id,
              createdByEmail: 'system',
              firstName: employeeData.firstName,
              lastName: employeeData.lastName,
              email: employeeData.email,
              phone: employeeData.phone,
              hireDate: new Date(employeeData.hireDate),
              positionId: position.id,
              baseSalary: employeeData.baseSalary,
              coefficient: employeeData.coefficient,
              components: [],
            });

            results.success.push(employeeData.email);

            // Emit employee.hired event
            await eventBus.publish('employee.hired', {
              employeeId: employee.id,
              tenantId: employee.tenantId,
              hireDate: new Date(employee.hireDate),
              positionId: position.id,
            });
          } catch (error: any) {
            results.errors.push({
              row: i + 1,
              email: employeeData.email,
              error: error.message || 'Erreur inconnue',
            });
          }
        }

        return results;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de l\'import des employés',
        });
      }
    }),

  /**
   * Update own profile (P1-1: Employee Profile Edit - Self-Service)
   * Allows employees to edit limited profile fields
   * Requires: Employee role + ownership check
   */
  updateOwnProfile: employeeProcedure
    .input(
      z.object({
        phone: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db } = await import('@/db');
      const { employees } = await import('@/drizzle/schema');
      const { eq, and } = await import('drizzle-orm');

      if (!ctx.user.employeeId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Aucun profil employé associé à ce compte',
        });
      }

      try {
        // Update only allowed fields
        const [updatedEmployee] = await db
          .update(employees)
          .set({
            phone: input.phone,
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            postalCode: input.postalCode,
            bankName: input.bankName,
            bankAccount: input.bankAccount,
            updatedAt: new Date(),
            updatedBy: ctx.user.id,
          })
          .where(
            and(
              eq(employees.id, ctx.user.employeeId),
              eq(employees.tenantId, ctx.user.tenantId)
            )
          )
          .returning();

        if (!updatedEmployee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Profil employé introuvable',
          });
        }

        // Emit employee.updated event
        await eventBus.publish('employee.updated', {
          employeeId: updatedEmployee.id,
          tenantId: ctx.user.tenantId,
          changes: input,
        });

        return updatedEmployee;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la mise à jour du profil',
        });
      }
    }),
});
