/**
 * Employee Service
 *
 * Core CRUD operations for employee management with:
 * - Multi-tenancy (RLS enforcement)
 * - PII encryption
 * - Audit logging
 * - Event emission
 * - Effective-dated salary and assignment creation
 */

import { db } from '@/lib/db';
import { employees, employeeSalaries, assignments, positions, employmentContracts, departments } from '@/drizzle/schema';
import { eq, and, or, like, desc, isNull, sql } from 'drizzle-orm';
import { differenceInMonths } from 'date-fns';
import { encrypt, decrypt } from '@/lib/crypto';
import { eventBus, type EmployeeHiredEvent, type EmployeeUpdatedEvent, type EmployeeTerminatedEvent } from '@/lib/event-bus';
import { ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { generateEmployeeNumber } from './employee-number';
import { getMinimumWage, getTenantCountryCode } from './salary.service';
import { autoInjectCalculatedComponents } from '@/lib/salary-components/component-calculator';
import { getSmartDefaults } from '@/lib/salary-components/metadata-builder';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';
import { validateCoefficientBasedSalary } from '@/lib/compliance/coefficient-validation.service';
import { ensureComponentsActivated } from '@/lib/salary-components/component-activation';

export interface CreateEmployeeInput {
  tenantId: string;
  createdBy: string;
  createdByEmail: string;

  // Personal info
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  // Contact
  email: string;
  phone?: string;
  nationalId?: string;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;

  // Employment
  hireDate: Date;
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
  contractEndDate?: Date;
  cddReason?: 'REMPLACEMENT' | 'SURCROIT_ACTIVITE' | 'SAISONNIER' | 'PROJET' | 'AUTRE';

  // CDDTI-specific fields
  cddtiTaskDescription?: string;
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  weeklyHoursRegime?: '40h' | '44h' | '48h';

  // Banking
  bankName?: string;
  bankAccount?: string;

  // Tax & CNPS
  cnpsNumber?: string;
  taxNumber?: string;
  taxDependents?: number;

  // Position & Salary (required for hire)
  positionId: string;
  coefficient?: number;
  rateType?: 'MONTHLY' | 'DAILY' | 'HOURLY'; // Rate type for salary calculation
  baseSalary: number; // Base salary in separate column
  components?: SalaryComponentInstance[]; // Optional allowances/bonuses

  // Personnel Record fields (Registre du Personnel)
  nationalityZone?: string;
  employeeType?: string;
  fatherName?: string;
  motherName?: string;
  placeOfBirth?: string;
  emergencyContactName?: string;

  // Custom fields
  customFields?: Record<string, any>;
}

export interface UpdateEmployeeInput {
  id: string;
  tenantId: string;
  updatedBy: string;
  updatedByEmail: string;

  // Updatable fields (immutable fields excluded)
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  email?: string;
  phone?: string;
  nationalId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  bankName?: string;
  bankAccount?: string;
  cnpsNumber?: string;
  taxNumber?: string;
  taxDependents?: number;

  // Employment fields
  primaryLocationId?: string;
  reportingManagerId?: string;
  categoryCode?: string;
  coefficient?: number;
  rateType?: 'MONTHLY' | 'DAILY' | 'HOURLY';
  dailyRate?: number;
  hourlyRate?: number;
  sector?: string;
  sectorCodeCgeci?: string;
  conventionCode?: string;
  professionalLevel?: number;

  // Family fields
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';

  // Document fields
  identityDocumentType?: 'cni' | 'passport' | 'residence_permit' | 'other';
  nationalIdExpiry?: Date;
  workPermitExpiry?: Date;
  passportNumber?: string;
  isExpat?: boolean;

  // Personnel Record fields (Registre du Personnel)
  nationalityZone?: 'LOCAL' | 'CEDEAO' | 'HORS_CEDEAO';
  employeeType?: 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE';
  fatherName?: string;
  motherName?: string;
  placeOfBirth?: string;
  emergencyContactName?: string;

  // Contract & CDDTI fields (Daily Workers Phase 1-3)
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
  hireDate?: Date;
  contractStartDate?: Date;
  contractEndDate?: Date;
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h';

  // Custom fields
  customFields?: Record<string, any>;

  // Employee Protection / Labor Law Compliance (Part 8)
  isPregnant?: boolean;
  pregnancyStartDate?: Date;
  expectedDeliveryDate?: Date;
  medicalExemptionNightWork?: boolean;
  medicalExemptionExpiryDate?: Date;
}

export interface ListEmployeesInput {
  tenantId: string;
  status?: 'active' | 'terminated' | 'suspended';
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE';
  search?: string;
  positionId?: string;
  departmentId?: string;
  limit?: number;
  cursor?: string;
}

export interface TerminateEmployeeInput {
  employeeId: string;
  tenantId: string;
  terminationDate: Date;
  terminationReason: string;
  updatedBy: string;
  updatedByEmail: string;
}

/**
 * Create a new employee (hire)
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<typeof employees.$inferSelect> {
  // Get tenant's country code
  const countryCode = await getTenantCountryCode(input.tenantId);

  // Validate coefficient-based minimum wage (GAP-COEF-001)
  const coefficient = input.coefficient || 100;
  const validationResult = await validateCoefficientBasedSalary(
    input.baseSalary,
    coefficient,
    countryCode,
    input.rateType || 'MONTHLY'
  );

  if (!validationResult.isValid) {
    throw new ValidationError(
      validationResult.errorMessage || 'Salaire invalide',
      {
        baseSalary: input.baseSalary,
        coefficient,
        minimumWage: validationResult.minimumWage,
        category: validationResult.category,
        countryCode,
      }
    );
  }

  // Check email uniqueness within tenant
  const existingEmployee = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.tenantId, input.tenantId),
        eq(employees.email, input.email)
      )
    )
    .limit(1);

  if (existingEmployee.length > 0) {
    throw new ConflictError('Un employé avec cet email existe déjà', {
      email: input.email,
    });
  }

  // Transaction: create employee + salary + assignment atomically
  return await db.transaction(async (tx) => {
    // Generate employee number
    const employeeNumber = await generateEmployeeNumber(input.tenantId, tx);

    // Encrypt PII fields
    const encryptedNationalId = input.nationalId ? encrypt(input.nationalId) : null;
    const encryptedBankAccount = input.bankAccount ? encrypt(input.bankAccount) : null;

    // Create employee record
    const [employee] = await tx
      .insert(employees)
      .values({
        tenantId: input.tenantId,
        employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        preferredName: input.preferredName,
        dateOfBirth: input.dateOfBirth ? input.dateOfBirth.toISOString().split('T')[0] : null,
        gender: input.gender,
        email: input.email,
        phone: input.phone,
        nationalId: encryptedNationalId,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        postalCode: input.postalCode,
        countryCode: input.countryCode || 'CI',
        hireDate: input.hireDate.toISOString().split('T')[0],
        bankName: input.bankName,
        bankAccount: encryptedBankAccount,
        cnpsNumber: input.cnpsNumber,
        taxNumber: input.taxNumber,
        taxDependents: input.taxDependents || 0,
        coefficient: input.coefficient || 100,
        rateType: input.rateType || 'MONTHLY',
        // CDDTI-specific fields
        paymentFrequency: input.paymentFrequency || null,
        weeklyHoursRegime: input.weeklyHoursRegime || null,
        // Personnel Record (Registre du Personnel) fields
        nationalityZone: input.nationalityZone || null,
        employeeType: input.employeeType || null,
        fatherName: input.fatherName || null,
        motherName: input.motherName || null,
        placeOfBirth: input.placeOfBirth || null,
        emergencyContactName: input.emergencyContactName || null,
        customFields: input.customFields || {},
        status: 'active',
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      })
      .returning();

    // Create employment contract (CDD compliance tracking)
    // This creates the initial contract record with proper metadata
    const contractType = input.contractType || 'CDI';
    const [contract] = await tx
      .insert(employmentContracts)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        contractType: contractType,
        contractNumber: `${contractType}-${employeeNumber}`,
        startDate: input.hireDate.toISOString().split('T')[0],
        endDate: (contractType === 'CDD' || contractType === 'CDDTI') && input.contractEndDate
          ? input.contractEndDate.toISOString().split('T')[0]
          : null,
        renewalCount: 0,
        isActive: true,
        cddReason: contractType === 'CDD' ? (input.cddReason || null) : null,
        cddTotalDurationMonths: (contractType === 'CDD' || contractType === 'CDDTI') && input.contractEndDate
          ? differenceInMonths(input.contractEndDate, input.hireDate)
          : null,
        cddtiTaskDescription: contractType === 'CDDTI' ? (input.cddtiTaskDescription || null) : null,
        createdBy: input.createdBy,
      })
      .returning();

    // Link contract to employee record
    // - Update current_contract_id FK (primary reference)
    // - Update customFields for backward compatibility with existing code
    await tx
      .update(employees)
      .set({
        currentContractId: contract.id,
        customFields: {
          ...(input.customFields || {}),
          contractType: contractType,
          contractId: contract.id,
        },
      })
      .where(eq(employees.id, employee.id));

    // Use components array directly from input (single source of truth)
    // Components are already built in the UI with proper metadata
    const components = input.components || [];

    // ========================================
    // AUTO-ACTIVATE COMPONENTS AT TENANT LEVEL
    // ========================================
    // CRITICAL: Ensure all components are activated at tenant level
    // This allows components to be used without manual activation in Settings
    //
    // IMPORTANT: Base salary components (Code 11, 12, etc.) should NOT be activated
    // because they are fundamental components that are always available.
    // Only activate allowances and bonuses (transport, housing, etc.)
    if (components.length > 0) {
      // Filter out base salary components (they have isBaseComponent: true in metadata)
      const nonBaseComponents = components.filter(comp => {
        const metadata = (comp as any).metadata || {};
        return !metadata.isBaseComponent;
      });

      if (nonBaseComponents.length > 0) {
        const activationInputs = nonBaseComponents.map(comp => ({
          code: comp.code,
          sourceType: (comp as any).sourceType || 'standard',
          tenantId: input.tenantId,
          countryCode: countryCode,
          userId: input.createdBy,
        }));

        await ensureComponentsActivated(activationInputs, tx);
      }
    }

    // Create initial salary record
    await tx.insert(employeeSalaries).values({
      tenantId: input.tenantId,
      employeeId: employee!.id,
      baseSalary: input.baseSalary.toString(), // Denormalized for queries/constraints
      currency: 'XOF',
      components, // Allowances and bonuses
      effectiveFrom: input.hireDate.toISOString().split('T')[0],
      effectiveTo: null,
      changeReason: 'hire',
      createdBy: input.createdBy,
    });

    // Create primary assignment
    await tx.insert(assignments).values({
      tenantId: input.tenantId,
      employeeId: employee!.id,
      positionId: input.positionId,
      assignmentType: 'primary',
      effectiveFrom: input.hireDate.toISOString().split('T')[0],
      effectiveTo: null,
      assignmentReason: 'hire',
      createdBy: input.createdBy,
    });

    return employee!;
  });

  // Note: Event emission happens after transaction commits (caller's responsibility)
}

/**
 * List employees with filtering and pagination
 */
export async function listEmployees(input: ListEmployeesInput) {
  const limit = input.limit || 50;

  // Build where conditions
  const conditions = [eq(employees.tenantId, input.tenantId)];

  // Only filter by status if explicitly provided
  if (input.status) {
    conditions.push(eq(employees.status, input.status));
  }
  // If status is undefined, show all statuses (no filter)

  // Filter by contract type from employment_contracts (source of truth)
  // Note: employees.contractType is often null; the real value is on the active contract
  if (input.contractType) {
    conditions.push(eq(employmentContracts.contractType, input.contractType));
  }

  if (input.search) {
    conditions.push(
      or(
        like(employees.firstName, `%${input.search}%`),
        like(employees.lastName, `%${input.search}%`),
        like(employees.employeeNumber, `%${input.search}%`),
        like(employees.email, `%${input.search}%`)
      )!
    );
  }

  // Execute query with joins to get contract type, end date, and current position
  const results = await db
    .select({
      employee: employees,
      contractType: employmentContracts.contractType,
      contractEndDate: employmentContracts.endDate,
      positionTitle: positions.title,
      departmentName: departments.name,
    })
    .from(employees)
    .leftJoin(employmentContracts, eq(employees.currentContractId, employmentContracts.id))
    .leftJoin(
      assignments,
      and(
        eq(assignments.employeeId, employees.id),
        isNull(assignments.effectiveTo) // Current assignment only
      )
    )
    .leftJoin(positions, eq(assignments.positionId, positions.id))
    .leftJoin(departments, eq(positions.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(desc(employees.createdAt))
    .limit(limit + 1); // Fetch one more to determine if there are more pages

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;

  // Decrypt PII fields (handle decryption failures gracefully)
  // Also merge contractType from contract if not set on employee
  const decryptedItems = items.map((row): typeof employees.$inferSelect & { nationalId: string | null; bankAccount: string | null } => {
    const employee = row.employee;
    let decryptedNationalId = null;
    let decryptedBankAccount = null;

    // Try to decrypt nationalId, fallback to null on error
    if (employee.nationalId) {
      try {
        decryptedNationalId = decrypt(employee.nationalId);
      } catch (error) {
        console.warn(`Failed to decrypt nationalId for employee ${employee.id}:`, error);
        decryptedNationalId = null;
      }
    }

    // Try to decrypt bankAccount, fallback to null on error
    if (employee.bankAccount) {
      try {
        decryptedBankAccount = decrypt(employee.bankAccount);
      } catch (error) {
        console.warn(`Failed to decrypt bankAccount for employee ${employee.id}:`, error);
        decryptedBankAccount = null;
      }
    }

    return {
      ...employee,
      // Contract type comes from employmentContracts table (single source of truth)
      contractType: row.contractType || null,
      // Contract end date for CDD/CDDTI/INTERIM/STAGE alerts
      contractEndDate: row.contractEndDate || null,
      // Current position from assignments -> positions -> departments
      currentPosition: row.positionTitle ? {
        title: row.positionTitle,
        department: row.departmentName || undefined,
      } : undefined,
      nationalId: decryptedNationalId,
      bankAccount: decryptedBankAccount,
    };
  });

  return {
    employees: decryptedItems,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.employee.id : undefined,
  };
}

/**
 * Get employee by ID with full details (including current contract)
 */
export async function getEmployeeById(employeeId: string, tenantId: string): Promise<any> {
  const [result] = await db
    .select({
      employee: employees,
      contract: employmentContracts,
    })
    .from(employees)
    .leftJoin(
      employmentContracts,
      eq(employees.currentContractId, employmentContracts.id)
    )
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!result || !result.employee) {
    throw new NotFoundError('Employé', employeeId);
  }

  const employee = result.employee;
  const contract = result.contract;

  // Decrypt PII (handle decryption failures gracefully)
  let decryptedNationalId = null;
  let decryptedBankAccount = null;

  if (employee.nationalId) {
    try {
      decryptedNationalId = decrypt(employee.nationalId);
    } catch (error) {
      console.warn(`Failed to decrypt nationalId for employee ${employee.id}:`, error);
      decryptedNationalId = null;
    }
  }

  if (employee.bankAccount) {
    try {
      decryptedBankAccount = decrypt(employee.bankAccount);
    } catch (error) {
      console.warn(`Failed to decrypt bankAccount for employee ${employee.id}:`, error);
      decryptedBankAccount = null;
    }
  }

  const decrypted = {
    ...employee,
    nationalId: decryptedNationalId,
    bankAccount: decryptedBankAccount,
  };

  // Get salary history
  const salaryHistory = await db
    .select()
    .from(employeeSalaries)
    .where(eq(employeeSalaries.employeeId, employeeId))
    .orderBy(desc(employeeSalaries.effectiveFrom));

  // Get assignment history with position details
  const assignmentHistory = await db
    .select({
      assignment: assignments,
      position: positions,
    })
    .from(assignments)
    .leftJoin(positions, eq(assignments.positionId, positions.id))
    .where(eq(assignments.employeeId, employeeId))
    .orderBy(desc(assignments.effectiveFrom));

  // Get current salary (most recent active salary)
  const currentSalary = salaryHistory.find(s => !s.effectiveTo) || salaryHistory[0] || null;

  // Get current position (most recent active assignment)
  const currentAssignment = assignmentHistory.find(a => !a.assignment.effectiveTo) || assignmentHistory[0] || null;
  const currentPosition = currentAssignment?.position || null;

  return {
    ...decrypted,
    contract, // Current contract details (contract_type, start_date, end_date, etc.) from employment_contracts table
    currentSalary,
    currentPosition,
    salaryHistory,
    assignmentHistory: assignmentHistory.map(a => ({
      ...a.assignment,
      position: a.position,
    })),
  };
}

/**
 * Update employee information
 */
export async function updateEmployee(input: UpdateEmployeeInput) {
  // Verify employee exists and belongs to tenant
  const [existing] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, input.id),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError('Employé', input.id);
  }

  // Check email uniqueness if email is being changed
  if (input.email && input.email !== existing.email) {
    const [duplicate] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.tenantId, input.tenantId),
          eq(employees.email, input.email)
        )
      )
      .limit(1);

    if (duplicate) {
      throw new ConflictError('Un employé avec cet email existe déjà', {
        email: input.email,
      });
    }
  }

  // Build update values
  const updateValues: Record<string, any> = {
    updatedBy: input.updatedBy,
    updatedAt: sql`now()`, // Use SQL now() for proper timestamp
  };

  // Only include provided fields
  if (input.firstName !== undefined) updateValues.firstName = input.firstName;
  if (input.lastName !== undefined) updateValues.lastName = input.lastName;
  if (input.preferredName !== undefined) updateValues.preferredName = input.preferredName;
  if (input.dateOfBirth !== undefined) {
    updateValues.dateOfBirth = input.dateOfBirth ? input.dateOfBirth.toISOString().split('T')[0] : null;
  }
  if (input.gender !== undefined) updateValues.gender = input.gender;
  if (input.email !== undefined) updateValues.email = input.email;
  if (input.phone !== undefined) updateValues.phone = input.phone;
  if (input.nationalId !== undefined) updateValues.nationalId = encrypt(input.nationalId);
  if (input.addressLine1 !== undefined) updateValues.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) updateValues.addressLine2 = input.addressLine2;
  if (input.city !== undefined) updateValues.city = input.city;
  if (input.postalCode !== undefined) updateValues.postalCode = input.postalCode;
  if (input.countryCode !== undefined) updateValues.countryCode = input.countryCode;
  if (input.bankName !== undefined) updateValues.bankName = input.bankName;
  if (input.bankAccount !== undefined) updateValues.bankAccount = encrypt(input.bankAccount);
  if (input.cnpsNumber !== undefined) updateValues.cnpsNumber = input.cnpsNumber;
  if (input.taxNumber !== undefined) updateValues.taxNumber = input.taxNumber;
  if (input.taxDependents !== undefined) updateValues.taxDependents = input.taxDependents;

  // Employment fields (handle empty strings for UUID fields)
  if (input.primaryLocationId !== undefined) {
    updateValues.primaryLocationId = input.primaryLocationId === '' ? null : input.primaryLocationId;
  }
  if (input.reportingManagerId !== undefined) {
    updateValues.reportingManagerId = input.reportingManagerId === '' ? null : input.reportingManagerId;
  }
  if (input.categoryCode !== undefined) updateValues.categoryCode = input.categoryCode;
  if (input.coefficient !== undefined) updateValues.coefficient = input.coefficient;
  if (input.rateType !== undefined) updateValues.rateType = input.rateType;
  if (input.dailyRate !== undefined) updateValues.dailyRate = input.dailyRate;
  if (input.hourlyRate !== undefined) updateValues.hourlyRate = input.hourlyRate;
  if (input.sector !== undefined) updateValues.sector = input.sector;
  if (input.sectorCodeCgeci !== undefined) updateValues.sectorCodeCgeci = input.sectorCodeCgeci;
  if (input.conventionCode !== undefined) updateValues.conventionCode = input.conventionCode;
  if (input.professionalLevel !== undefined) updateValues.professionalLevel = input.professionalLevel;

  // Family fields
  if (input.maritalStatus !== undefined) updateValues.maritalStatus = input.maritalStatus;

  // Document fields
  if (input.identityDocumentType !== undefined) updateValues.identityDocumentType = input.identityDocumentType;
  if (input.nationalIdExpiry !== undefined) {
    updateValues.nationalIdExpiry = input.nationalIdExpiry ? input.nationalIdExpiry.toISOString().split('T')[0] : null;
  }
  if (input.workPermitExpiry !== undefined) {
    updateValues.workPermitExpiry = input.workPermitExpiry ? input.workPermitExpiry.toISOString().split('T')[0] : null;
  }
  if (input.passportNumber !== undefined) updateValues.passportNumber = input.passportNumber;
  if (input.isExpat !== undefined) updateValues.isExpat = input.isExpat;

  // Personnel Record fields (Registre du Personnel)
  if (input.nationalityZone !== undefined) updateValues.nationalityZone = input.nationalityZone;
  if (input.employeeType !== undefined) updateValues.employeeType = input.employeeType;
  if (input.fatherName !== undefined) updateValues.fatherName = input.fatherName;
  if (input.motherName !== undefined) updateValues.motherName = input.motherName;
  if (input.placeOfBirth !== undefined) updateValues.placeOfBirth = input.placeOfBirth;
  if (input.emergencyContactName !== undefined) updateValues.emergencyContactName = input.emergencyContactName;

  // Employment fields (Daily Workers Phase 1-3)
  if (input.hireDate !== undefined) {
    updateValues.hireDate = input.hireDate ? input.hireDate.toISOString().split('T')[0] : null;
  }
  if (input.paymentFrequency !== undefined) updateValues.paymentFrequency = input.paymentFrequency;
  if (input.weeklyHoursRegime !== undefined) updateValues.weeklyHoursRegime = input.weeklyHoursRegime;

  // Note: Contract fields (contractType, contractStartDate, contractEndDate) are now managed
  // via the employment_contracts table. Use the contract management API to update contracts.

  // Employee Protection / Labor Law Compliance (Part 8)
  if (input.isPregnant !== undefined) updateValues.isPregnant = input.isPregnant;
  if (input.pregnancyStartDate !== undefined) {
    updateValues.pregnancyStartDate = input.pregnancyStartDate ? input.pregnancyStartDate.toISOString().split('T')[0] : null;
  }
  if (input.expectedDeliveryDate !== undefined) {
    updateValues.expectedDeliveryDate = input.expectedDeliveryDate ? input.expectedDeliveryDate.toISOString().split('T')[0] : null;
  }
  if (input.medicalExemptionNightWork !== undefined) updateValues.medicalExemptionNightWork = input.medicalExemptionNightWork;
  if (input.medicalExemptionExpiryDate !== undefined) {
    updateValues.medicalExemptionExpiryDate = input.medicalExemptionExpiryDate ? input.medicalExemptionExpiryDate.toISOString().split('T')[0] : null;
  }

  // Custom fields
  if (input.customFields !== undefined) updateValues.customFields = input.customFields;

  // Update employee
  let updated;
  try {
    [updated] = await db
      .update(employees)
      .set(updateValues)
      .where(
        and(
          eq(employees.id, input.id),
          eq(employees.tenantId, input.tenantId)
        )
      )
      .returning();
  } catch (error: any) {
    // Expose the actual PostgreSQL error for debugging
    console.error('Database update error:', error);
    throw new Error(`Database error: ${error.message || error.toString()}`);
  }

  if (!updated) {
    throw new NotFoundError('Employé', input.id);
  }

  // Decrypt PII for return (handle decryption failures gracefully)
  let decryptedNationalId = null;
  let decryptedBankAccount = null;

  if (updated.nationalId) {
    try {
      decryptedNationalId = decrypt(updated.nationalId);
    } catch (error) {
      console.warn(`Failed to decrypt nationalId for employee ${updated.id}:`, error);
      decryptedNationalId = null;
    }
  }

  if (updated.bankAccount) {
    try {
      decryptedBankAccount = decrypt(updated.bankAccount);
    } catch (error) {
      console.warn(`Failed to decrypt bankAccount for employee ${updated.id}:`, error);
      decryptedBankAccount = null;
    }
  }

  return {
    ...updated,
    nationalId: decryptedNationalId,
    bankAccount: decryptedBankAccount,
  };
}

/**
 * Terminate employee
 */
export async function terminateEmployee(input: TerminateEmployeeInput) {
  // Verify employee exists
  const [employee] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new NotFoundError('Employé', input.employeeId);
  }

  // Validate termination date
  const hireDate = new Date(employee.hireDate);
  if (input.terminationDate < hireDate) {
    throw new ValidationError(
      "Date de départ antérieure à la date d'embauche",
      {
        hireDate: employee.hireDate,
        terminationDate: input.terminationDate,
      }
    );
  }

  return await db.transaction(async (tx) => {
    // Update employee status
    const [updated] = await tx
      .update(employees)
      .set({
        status: 'terminated',
        terminationDate: input.terminationDate.toISOString().split('T')[0],
        terminationReason: input.terminationReason,
        updatedBy: input.updatedBy,
        updatedAt: sql`now()`, // Use SQL now() for proper timestamp
      })
      .where(
        and(
          eq(employees.id, input.employeeId),
          eq(employees.tenantId, input.tenantId)
        )
      )
      .returning();

    // End all active assignments
    await tx
      .update(assignments)
      .set({
        effectiveTo: input.terminationDate.toISOString().split('T')[0],
      })
      .where(
        and(
          eq(assignments.employeeId, input.employeeId),
          isNull(assignments.effectiveTo)
        )
      );

    return updated!;
  });
}

/**
 * Suspend employee
 */
export async function suspendEmployee(
  employeeId: string,
  tenantId: string,
  updatedBy: string
) {
  const [updated] = await db
    .update(employees)
    .set({
      status: 'suspended',
      updatedBy,
      updatedAt: sql`now()`, // Use SQL now() for proper timestamp
    })
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new NotFoundError('Employé', employeeId);
  }

  return updated;
}

/**
 * Reactivate suspended employee
 */
export async function reactivateEmployee(
  employeeId: string,
  tenantId: string,
  updatedBy: string
) {
  const [updated] = await db
    .update(employees)
    .set({
      status: 'active',
      updatedBy,
      updatedAt: sql`now()`, // Use SQL now() for proper timestamp
    })
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId)
      )
    )
    .returning();

  if (!updated) {
    throw new NotFoundError('Employé', employeeId);
  }

  return updated;
}
