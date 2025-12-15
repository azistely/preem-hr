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
import { sql, and, eq } from 'drizzle-orm';
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
import { getMinimumWageHelper } from '@/lib/compliance/coefficient-validation.service';
import { db } from '@/lib/db';
import { employeeBenefitEnrollments, employees, employeeDependents, uploadedDocuments } from '@/drizzle/schema';
import { createClient } from '@/lib/supabase/server';
import { initializeEmployeeBalances } from '@/features/time-off/services/time-off.service';
import { probationComplianceService } from '@/lib/compliance/probation-compliance.service';

// Zod Schemas
const genderEnum = z.enum(['male', 'female']);
const statusEnum = z.enum(['active', 'terminated', 'suspended']);

// Component schema for validation
const componentSchema = z.object({
  code: z.string().min(1, 'Le code du composant est requis'),
  name: z.string().min(1, 'Le nom du composant est requis'),
  amount: z.number().min(0, 'Le montant doit être positif'),
  sourceType: z.enum(['standard', 'custom', 'template', 'calculated', 'import']).default('standard'),
  metadata: z.record(z.any()).optional(),
});

// Benefits enrollment schema
const benefitEnrollmentSchema = z.object({
  planId: z.string().uuid('Plan invalide'),
  effectiveFrom: z.date(),
});

// Dependent schema for employee creation
const dependentInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.date(),
  relationship: z.enum(['child', 'spouse', 'other']),
  gender: z.enum(['male', 'female']),
  coverageCertificateUrl: z.string().url().optional(),
});

const createEmployeeSchema = z.object({
  // Personal info
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  preferredName: z.string().optional(),
  dateOfBirth: z.date({ required_error: 'La date de naissance est requise' }),
  gender: genderEnum,

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

  // Marital status and dependents
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed'], { required_error: 'La situation matrimoniale est requise' }).default('single'),

  // Personnel Record (Registre du Personnel) - Legal fields for CI
  nationalityZone: z.enum(['LOCAL', 'CEDEAO', 'HORS_CEDEAO'], { required_error: 'La zone de nationalité est requise' }),
  employeeType: z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'], { required_error: 'Le type d\'employé est requis' }),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  placeOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),

  // Employment
  hireDate: z.date(),
  contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE']).default('CDI'),
  contractEndDate: z.date().optional(),
  cddReason: z.enum(['REMPLACEMENT', 'SURCROIT_ACTIVITE', 'SAISONNIER', 'PROJET', 'AUTRE']).optional(),

  // CDDTI-specific fields
  cddtiTaskDescription: z.string().optional(),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  weeklyHoursRegime: z.enum(['40h', '44h', '48h']).optional(),

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
  baseSalary: z.number().min(0, 'Le salaire de base doit être positif'),
  components: z.array(componentSchema).default([]),

  // GAP-JOUR-003: Rate type support
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).default('MONTHLY'),

  // Benefits enrollment
  benefitEnrollments: z.array(benefitEnrollmentSchema).optional().default([]),

  // Dependents
  dependents: z.array(dependentInputSchema).optional().default([]),

  // Custom fields
  customFields: z.record(z.any()).optional(),
}).refine((data) => {
  // Rate-type aware SMIG validation
  const monthlyMinimumWage = 75000; // CI SMIG
  const rateType = data.rateType || 'MONTHLY';

  if (rateType === 'MONTHLY') {
    // For monthly workers, validate against monthly SMIG
    const totalGross = data.baseSalary + data.components.reduce((sum, c) => sum + c.amount, 0);
    return totalGross >= monthlyMinimumWage;
  } else if (rateType === 'DAILY') {
    // For daily workers, validate against daily minimum (75,000 / 30)
    const dailyMinimum = Math.round(monthlyMinimumWage / 30);
    return data.baseSalary >= dailyMinimum;
  } else if (rateType === 'HOURLY') {
    // For hourly workers, validate against hourly minimum (75,000 / 240)
    const hourlyMinimum = Math.round(monthlyMinimumWage / 240);
    return data.baseSalary >= hourlyMinimum;
  }

  return true;
}, {
  message: 'Le salaire de base ne respecte pas le SMIG minimum',
  path: ['baseSalary'],
}).refine((data) => {
  if (data.contractType === 'CDD' && !data.contractEndDate) {
    return false;
  }
  return true;
}, {
  message: 'La date de fin de contrat est requise pour un CDD',
  path: ['contractEndDate'],
}).refine((data) => {
  if (data.contractType === 'CDD' && data.contractEndDate && data.hireDate) {
    return data.hireDate < data.contractEndDate;
  }
  return true;
}, {
  message: 'La date d\'embauche doit être avant la date de fin de contrat',
  path: ['contractEndDate'],
}).refine((data) => {
  // CDDTI contracts require task description (Article 4 Convention Collective)
  if (data.contractType === 'CDDTI' && !data.cddtiTaskDescription?.trim()) {
    return false;
  }
  return true;
}, {
  message: 'La description de la tâche est requise pour les contrats CDDTI (Article 4 Convention Collective)',
  path: ['cddtiTaskDescription'],
});

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),

  // Personal Info
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  preferredName: z.string().optional(),
  dateOfBirth: z.date().optional(),
  gender: genderEnum.optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2).optional(),

  // Employment Info
  primaryLocationId: z.string().optional(),
  reportingManagerId: z.string().optional(),
  categoryCode: z.string().optional(),
  coefficient: z.number().int().min(90).max(1000).optional(),
  rateType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
  dailyRate: z.number().optional(),
  hourlyRate: z.number().optional(),
  sector: z.string().optional(),
  sectorCodeCgeci: z.string().optional(),
  conventionCode: z.string().optional(),
  professionalLevel: z.number().int().min(1).max(10).optional(),

  // Employment Fields (Daily Workers Phase 1-3)
  hireDate: z.date().optional(),
  paymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  weeklyHoursRegime: z.enum(['40h', '44h', '48h', '52h', '56h']).optional(),

  // Note: Contract fields (contractType, contractStartDate, contractEndDate) are managed
  // via employment_contracts table. Use complianceRouter for contract operations.

  // Family Info
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  // dependentChildren is auto-calculated from employee_dependents table via dependents router - not editable

  // Documents
  identityDocumentType: z.enum(['cni', 'passport', 'residence_permit', 'other']).optional(),
  nationalId: z.string().optional(),
  nationalIdExpiry: z.date().optional(),
  workPermitExpiry: z.date().optional(),
  passportNumber: z.string().optional(),

  // Banking & Tax
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  cnpsNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  taxDependents: z.number().int().min(0).max(10).optional(),
  isExpat: z.boolean().optional(),

  // Personnel Record Fields (Registre du Personnel)
  nationalityZone: z.enum(['LOCAL', 'CEDEAO', 'HORS_CEDEAO']).optional(),
  employeeType: z.enum(['LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE']).optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  placeOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),

  // Custom Fields
  customFields: z.record(z.any()).optional(),

  // Employee Protection / Labor Law Compliance (Part 8)
  isPregnant: z.boolean().optional(),
  pregnancyStartDate: z.date().optional(),
  expectedDeliveryDate: z.date().optional(),
  medicalExemptionNightWork: z.boolean().optional(),
  medicalExemptionExpiryDate: z.date().optional(),
});

const listEmployeesSchema = z.object({
  status: statusEnum.optional(),
  contractType: z.enum(['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE']).optional(),
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
        // Extract benefits enrollments and dependents from input
        const { benefitEnrollments, dependents, ...employeeData } = input;

        // Create employee
        const employee = await createEmployee({
          ...employeeData,
          tenantId: ctx.user.tenantId,
          createdBy: ctx.user.id,
          createdByEmail: 'system', // TODO: Add email to user context
        } as any);

        // Create benefit enrollments if provided
        if (benefitEnrollments && benefitEnrollments.length > 0) {
          for (const enrollment of benefitEnrollments) {
            await db.insert(employeeBenefitEnrollments).values({
              tenantId: ctx.user.tenantId,
              employeeId: employee.id,
              benefitPlanId: enrollment.planId,
              enrollmentDate: enrollment.effectiveFrom.toISOString().split('T')[0],
              effectiveDate: enrollment.effectiveFrom.toISOString().split('T')[0],
              enrollmentStatus: 'active',
              createdBy: ctx.user.id,
              updatedBy: ctx.user.id,
            });
          }
        }

        // Create dependents if provided
        if (dependents && dependents.length > 0) {
          for (const dependent of dependents) {
            // Calculate age to determine if document is required
            const birthDate = new Date(dependent.dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }

            // Auto-verify children under 21
            const isVerified = dependent.relationship === 'child' && age < 21;

            await db.insert(employeeDependents).values({
              employeeId: employee.id,
              tenantId: ctx.user.tenantId,
              firstName: dependent.firstName,
              lastName: dependent.lastName,
              dateOfBirth: dependent.dateOfBirth.toISOString().split('T')[0],
              relationship: dependent.relationship,
              gender: dependent.gender,
              isVerified,
              eligibleForFiscalParts: true,
              eligibleForCmu: true,
              coveredByOtherEmployer: false,
              coverageCertificateUrl: dependent.coverageCertificateUrl,
              createdBy: ctx.user.id,
              updatedBy: ctx.user.id,
            });

            // Convert temporary upload to permanent document record
            if (dependent.coverageCertificateUrl) {
              try {
                const supabase = await createClient();
                // Extract file path from URL to get metadata
                const url = new URL(dependent.coverageCertificateUrl);
                const pathMatch = url.pathname.match(/\/documents\/(.+)$/);

                if (pathMatch) {
                  const filePath = pathMatch[1];

                  // Get file metadata from storage (for size and mime type)
                  const { data: fileData, error: fileError } = await supabase.storage
                    .from('documents')
                    .list(filePath.substring(0, filePath.lastIndexOf('/')), {
                      search: filePath.substring(filePath.lastIndexOf('/') + 1),
                    });

                  if (!fileError && fileData && fileData.length > 0) {
                    const file = fileData[0];

                    // Use the original filename if provided, otherwise extract from path
                    const fileName = (dependent as any).coverageCertificateFileName ||
                                    filePath.substring(filePath.lastIndexOf('/') + 1);

                    // Create permanent document record
                    await db.insert(uploadedDocuments).values({
                      tenantId: ctx.user.tenantId,
                      employeeId: employee.id,
                      documentCategory: 'medical', // Better categorization as coverage certificate is medical-related
                      documentSubcategory: 'coverage_certificate',
                      fileName: fileName,
                      fileUrl: dependent.coverageCertificateUrl,
                      fileSize: file.metadata?.size || 0,
                      mimeType: file.metadata?.mimetype || 'application/octet-stream',
                      uploadedBy: ctx.user.id,
                      approvalStatus: 'approved', // HR uploaded during hire wizard
                      metadata: {
                        dependentName: `${dependent.firstName} ${dependent.lastName}`,
                        uploadedDuringHire: true,
                        documentDescription: `Attestation de couverture - ${dependent.firstName} ${dependent.lastName}`,
                      },
                      tags: ['dependent', 'coverage', 'hire_wizard'],
                    });

                    console.log('[Employee Create] Converted temp upload to permanent document:', {
                      employeeId: employee.id,
                      fileName,
                      dependent: `${dependent.firstName} ${dependent.lastName}`,
                    });
                  }
                }
              } catch (docError) {
                // Log error but don't fail employee creation
                console.error('[Employee Create] Failed to convert temp upload:', docError);
              }
            }
          }

          // Recalculate fiscal parts and dependent count for employee
          const { calculateFiscalPartsFromDependents, getDependentCounts } = await import('@/features/employees/services/dependent-verification.service');

          const fiscalParts = await calculateFiscalPartsFromDependents(
            employee.id,
            ctx.user.tenantId
          );

          const dependentCounts = await getDependentCounts(
            employee.id,
            ctx.user.tenantId
          );

          // Update employee with calculated values
          await db
            .update(employees)
            .set({
              fiscalParts: fiscalParts.toString(),
              dependentChildren: dependentCounts.totalDependents,
              updatedAt: new Date().toISOString(),
              updatedBy: ctx.user.id,
            })
            .where(eq(employees.id, employee.id));
        }

        // Initialize time-off balances for eligible employees (CDI/CDD/CDDTI)
        // This creates leave balances for all active policies (annual leave, sick leave, permissions, etc.)
        const eligibleContractTypes = ['CDI', 'CDD', 'CDDTI'];
        if (eligibleContractTypes.includes(input.contractType || 'CDI')) {
          try {
            await initializeEmployeeBalances(
              employee.id,
              ctx.user.tenantId,
              input.hireDate,
              input.contractType || 'CDI',
              undefined // No balance override
            );
            console.log('[Employee Create] Initialized time-off balances for employee:', employee.id);
          } catch (balanceError) {
            // Log error but don't fail employee creation - balances can be initialized later
            console.error('[Employee Create] Failed to initialize time-off balances:', balanceError);
          }
        }

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
        console.error('Employee update error:', error);
        // Include more error details for debugging
        const errorMessage = error.message || error.toString() || 'Erreur lors de la mise à jour de l\'employé';
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: errorMessage,
          cause: error,
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
   * Get minimum wage helper text for coefficient (GAP-COEF-001)
   * Returns friendly message showing minimum wage for a given coefficient
   * Used in salary input fields to guide users
   */
  getMinimumWageHelper: publicProcedure
    .input(
      z.object({
        coefficient: z.number().int().min(90).max(1000),
        countryCode: z.string().length(2).default('CI'),
      })
    )
    .query(async ({ input }) => {
      try {
        const helper = await getMinimumWageHelper(input.coefficient, input.countryCode);
        return { helper };
      } catch (error: any) {
        return { helper: null };
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
            updatedAt: sql`now()`, // Use SQL now() for proper timestamp
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

  /**
   * Set ACP payment date and activation status for an employee
   *
   * ACP (Allocations de Congés Payés) is only applicable to CDI/CDD employees.
   * This endpoint activates ACP payment and sets the date when payment should occur.
   *
   * Permissions: HR Manager
   */
  setACPPaymentDate: hrManagerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid('ID employé invalide'),
        paymentDate: z.date().nullable(),
        active: z.boolean(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Update employee ACP settings
        const [updatedEmployee] = await db
          .update(employees)
          .set({
            acpPaymentDate: input.paymentDate?.toISOString().split('T')[0] || null,
            acpPaymentActive: input.active,
            acpNotes: input.notes,
            updatedAt: new Date().toISOString(),
            updatedBy: ctx.user.id,
          })
          .where(
            and(
              eq(employees.id, input.employeeId),
              eq(employees.tenantId, ctx.user.tenantId)
            )
          )
          .returning();

        if (!updatedEmployee) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employé introuvable',
          });
        }

        // Emit event
        await eventBus.publish('employee.acp_configured', {
          employeeId: updatedEmployee.id,
          tenantId: ctx.user.tenantId,
          active: input.active,
          paymentDate: input.paymentDate,
        });

        return updatedEmployee;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la configuration ACP',
        });
      }
    }),

  /**
   * Get all employees with active ACP payments
   *
   * Returns list of employees who have ACP payment activated,
   * ordered by payment date.
   *
   * Permissions: HR Manager
   */
  getEmployeesWithActiveACP: hrManagerProcedure.query(async ({ ctx }) => {
    try {
      const employeesWithACP = await db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.tenantId, ctx.user.tenantId),
            eq(employees.acpPaymentActive, true),
            eq(employees.status, 'active')
          )
        )
        .orderBy(employees.acpPaymentDate);

      return employeesWithACP;
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Erreur lors de la récupération des employés avec ACP',
      });
    }
  }),

  // ========================================================================
  // PROBATION PERIOD MANAGEMENT
  // ========================================================================

  /**
   * Get probation status for an employee
   *
   * Returns detailed probation information including:
   * - Current status (in_progress, confirmed, extended, terminated)
   * - Days remaining
   * - Alerts for upcoming deadlines
   *
   * Permissions: HR Manager
   */
  getProbationStatus: hrManagerProcedure
    .input(z.object({ employeeId: z.string().uuid('ID employé invalide') }))
    .query(async ({ input, ctx }) => {
      try {
        return await probationComplianceService.checkProbationStatus(
          input.employeeId,
          ctx.user.tenantId
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la vérification du statut de période d\'essai',
        });
      }
    }),

  /**
   * Get all employees currently in probation
   *
   * Returns list of employees with active probation periods,
   * optionally filtered by days until end.
   *
   * Permissions: HR Manager
   */
  getEmployeesInProbation: hrManagerProcedure
    .input(
      z.object({
        includeExpired: z.boolean().default(false),
        daysUntilEndMax: z.number().int().positive().optional(),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      try {
        return await probationComplianceService.getEmployeesInProbation(
          ctx.user.tenantId,
          {
            includeExpired: input?.includeExpired,
            daysUntilEndMax: input?.daysUntilEndMax,
          }
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des employés en période d\'essai',
        });
      }
    }),

  /**
   * Get probation dashboard summary
   *
   * Returns aggregated statistics:
   * - Total in probation
   * - Ending this week
   * - Ending this month
   * - Expired (awaiting decision)
   *
   * Permissions: HR Manager
   */
  getProbationDashboard: hrManagerProcedure.query(async ({ ctx }) => {
    try {
      return await probationComplianceService.getDashboardSummary(ctx.user.tenantId);
    } catch (error: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Erreur lors de la récupération du tableau de bord des périodes d\'essai',
      });
    }
  }),

  /**
   * Get all probation alerts
   *
   * Returns list of alerts for employees with upcoming
   * or expired probation periods.
   *
   * Permissions: HR Manager
   */
  getProbationAlerts: hrManagerProcedure
    .input(
      z.object({
        severityFilter: z.array(z.enum(['info', 'warning', 'critical'])).optional(),
        limit: z.number().int().positive().max(100).default(50),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      try {
        return await probationComplianceService.getAllProbationAlerts(
          ctx.user.tenantId,
          {
            severityFilter: input?.severityFilter,
            limit: input?.limit,
          }
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de la récupération des alertes de période d\'essai',
        });
      }
    }),

  /**
   * Initialize probation for an employee
   *
   * Sets up probation tracking with:
   * - Start date (defaults to hire date)
   * - Duration (defaults based on coefficient)
   * - End date (calculated)
   *
   * Permissions: HR Manager
   */
  initializeProbation: hrManagerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid('ID employé invalide'),
        startDate: z.date().optional(),
        durationMonths: z.number().int().min(1).max(4).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await probationComplianceService.initializeProbation(
          input.employeeId,
          ctx.user.tenantId,
          {
            startDate: input.startDate,
            durationMonths: input.durationMonths,
            notes: input.notes,
          }
        );

        // Emit event
        await eventBus.publish('employee.probation.initialized', {
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          initiatedBy: ctx.user.id,
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de l\'initialisation de la période d\'essai',
        });
      }
    }),

  /**
   * Confirm employee after probation
   *
   * Marks probation as confirmed and records who approved.
   *
   * Permissions: HR Manager
   */
  confirmProbation: hrManagerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid('ID employé invalide'),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await probationComplianceService.confirmEmployee(
          input.employeeId,
          ctx.user.tenantId,
          ctx.user.id,
          input.notes
        );

        // Emit event
        await eventBus.publish('employee.probation.confirmed', {
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          confirmedBy: ctx.user.id,
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la confirmation de la période d\'essai',
        });
      }
    }),

  /**
   * Extend probation period
   *
   * Extends probation by additional months (max 1 renewal per CI labor law).
   * Extension cannot exceed original duration.
   *
   * Permissions: HR Manager
   */
  extendProbation: hrManagerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid('ID employé invalide'),
        extensionMonths: z.number().int().min(1).max(4).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await probationComplianceService.extendProbation(
          input.employeeId,
          ctx.user.tenantId,
          ctx.user.id,
          input.extensionMonths,
          input.notes
        );

        // Emit event
        await eventBus.publish('employee.probation.extended', {
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          extendedBy: ctx.user.id,
          extensionMonths: input.extensionMonths,
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la prolongation de la période d\'essai',
        });
      }
    }),

  /**
   * Terminate employee during probation
   *
   * Records termination during probation period with reason.
   * Note: No notice period required during probation per CI labor law.
   *
   * Permissions: HR Manager
   */
  terminateDuringProbation: hrManagerProcedure
    .input(
      z.object({
        employeeId: z.string().uuid('ID employé invalide'),
        terminationDate: z.date(),
        reason: z.string().min(10, 'Veuillez fournir un motif détaillé'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await probationComplianceService.terminateDuringProbation(
          input.employeeId,
          ctx.user.tenantId,
          ctx.user.id,
          input.terminationDate,
          input.reason
        );

        // Emit event
        await eventBus.publish('employee.probation.terminated', {
          employeeId: input.employeeId,
          tenantId: ctx.user.tenantId,
          terminatedBy: ctx.user.id,
          terminationDate: input.terminationDate,
        });

        return result;
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Erreur lors de la fin de la période d\'essai',
        });
      }
    }),

  /**
   * Bulk initialize probation for recent hires
   *
   * Initializes probation tracking for employees who don't have it yet.
   * Useful for migrating to the new probation system.
   *
   * Permissions: HR Manager
   */
  bulkInitializeProbation: hrManagerProcedure
    .input(
      z.object({
        onlyRecentHires: z.boolean().default(true),
        recentHireMonths: z.number().int().min(1).max(12).default(4),
      }).optional()
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await probationComplianceService.bulkInitializeProbation(
          ctx.user.tenantId,
          {
            onlyRecentHires: input?.onlyRecentHires,
            recentHireMonths: input?.recentHireMonths,
          }
        );
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Erreur lors de l\'initialisation en masse des périodes d\'essai',
        });
      }
    }),
});
