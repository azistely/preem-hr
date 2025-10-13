/**
 * Onboarding Service V2 - Task-First Approach
 *
 * Simplifies onboarding to 3 questions with immediate action on each.
 * Focuses on getting to payslip preview as fast as possible.
 */

import { db } from '@/lib/db';
import { tenants, employees, positions, assignments, employeeSalaries } from '@/drizzle/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { generateEmployeeNumber } from '@/features/employees/services/employee-number';
import { autoInjectCalculatedComponents } from '@/lib/salary-components/component-calculator';

// ========================================
// TYPES
// ========================================

export interface SetCompanyInfoV2Input {
  tenantId: string;
  legalName: string;
  industry: string;
  sector: 'SERVICES' | 'COMMERCE' | 'TRANSPORT' | 'INDUSTRIE' | 'CONSTRUCTION';
  taxId?: string;
}

export interface CreateFirstEmployeeV2Input {
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  positionTitle: string;
  baseSalary: number;
  hireDate: Date;
  // CRITICAL: Family status (payroll correctness)
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren: number; // 0-10
  // NEW: Component-based salary structure
  components?: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType: 'standard' | 'template';
  }>;
  // DEPRECATED (kept for backward compatibility)
  transportAllowance?: number;
  housingAllowance?: number;
  mealAllowance?: number;
}

export interface CreateFirstPayrollRunInput {
  tenantId: string;
  userId: string;
  frequency: 'monthly' | 'bi_weekly';
}

// ========================================
// SERVICE FUNCTIONS
// ========================================

/**
 * Set company information with sector (V2)
 *
 * Adds sector field which is critical for work accident rate calculation.
 */
export async function setCompanyInfoV2(input: SetCompanyInfoV2Input) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  const currentSettings = (tenant.settings as any) || {};

  const [updated] = await db
    .update(tenants)
    .set({
      name: input.legalName,
      industry: input.industry,
      taxId: input.taxId || null,
      sectorCode: input.sector, // CRITICAL: For work accident rate
      settings: {
        ...currentSettings,
        sector: input.sector, // Also store in settings for backward compatibility
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId))
    .returning();

  return updated;
}

/**
 * Create first employee with family status (V2)
 *
 * CRITICAL CHANGES FROM V1:
 * - Collects maritalStatus and dependentChildren
 * - Calculates fiscalParts for tax deduction
 * - Calculates hasFamily for CMU employer contribution
 * - Returns immediate payslip preview
 */
export async function createFirstEmployeeV2(input: CreateFirstEmployeeV2Input) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Validate minimum salary (country-specific) - Check GROSS salary (base + components)
  const countryCode = tenant.countryCode || 'CI';
  const minimumWages: Record<string, number> = {
    CI: 75000,  // Côte d'Ivoire
    SN: 52500,  // Sénégal
    BF: 34664,  // Burkina Faso
    ML: 40000,  // Mali
    BJ: 40000,  // Bénin
    TG: 35000,  // Togo
  };
  const minimumWage = minimumWages[countryCode] || 75000;

  // Calculate gross salary (base + all components)
  const componentsTotal = input.components?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const grossSalary = input.baseSalary + componentsTotal;

  if (grossSalary < minimumWage) {
    const countryNames: Record<string, string> = {
      CI: 'Côte d\'Ivoire',
      SN: 'Sénégal',
      BF: 'Burkina Faso',
      ML: 'Mali',
      BJ: 'Bénin',
      TG: 'Togo',
    };
    throw new ValidationError(
      `Le salaire brut total (salaire de base + indemnités) doit être supérieur ou égal au SMIG de ${countryNames[countryCode] || countryCode} (${minimumWage.toLocaleString('fr-FR')} FCFA)`
    );
  }

  // Validate hireDate
  if (!input.hireDate) {
    throw new ValidationError('La date d\'embauche est requise');
  }

  // Ensure hireDate is a valid Date object
  const hireDate = input.hireDate instanceof Date ? input.hireDate : new Date(input.hireDate);
  if (isNaN(hireDate.getTime())) {
    throw new ValidationError('La date d\'embauche est invalide');
  }

  // ========================================
  // CALCULATE FISCAL PARTS (Critical for tax)
  // ========================================
  let fiscalParts = 1.0; // Base

  if (input.maritalStatus === 'married') {
    fiscalParts += 1.0; // +1 for spouse
  }

  // +0.5 per child (max 4 children counted)
  const countedChildren = Math.min(input.dependentChildren, 4);
  fiscalParts += countedChildren * 0.5;

  // ========================================
  // CALCULATE CMU FLAG (Critical for CMU employer contribution)
  // ========================================
  const hasFamily = input.maritalStatus === 'married' || input.dependentChildren > 0;

  // ========================================
  // CREATE RECORDS IN TRANSACTION
  // ========================================
  console.log('[Employee Creation] Starting transaction...');
  const startTime = Date.now();

  return await db.transaction(async (tx) => {
    // Step 1: Create position
    console.time('[Employee Creation] Position insert');
    const positionStart = Date.now();
    const [position] = await tx
      .insert(positions)
      .values({
        tenantId: input.tenantId,
        title: input.positionTitle,
        employmentType: 'full_time',
        status: 'active',
        headcount: 1,
        currency: tenant.currency || 'XOF',
        weeklyHours: '40',
        minSalary: String(input.baseSalary),
        maxSalary: String(input.baseSalary),
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Position insert');
    console.log(`[Employee Creation] Position created in ${Date.now() - positionStart}ms`);

    // Step 2: Generate employee number
    console.time('[Employee Creation] Employee number generation');
    const empNumStart = Date.now();
    const employeeNumber = await generateEmployeeNumber(input.tenantId);
    console.timeEnd('[Employee Creation] Employee number generation');
    console.log(`[Employee Creation] Employee number generated in ${Date.now() - empNumStart}ms`);

    // Step 3: Create employee with fiscal parts
    console.time('[Employee Creation] Employee insert');
    const employeeStart = Date.now();
    const [employee] = await tx
      .insert(employees)
      .values({
        tenantId: input.tenantId,
        employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone,
        hireDate: hireDate.toISOString().split('T')[0],
        countryCode: tenant.countryCode || 'CI',
        coefficient: 100,
        status: 'active',

        // CRITICAL: Store family status for payroll
        maritalStatus: input.maritalStatus,
        dependentChildren: input.dependentChildren,
        fiscalParts: String(fiscalParts), // Pre-calculated for tax
        hasFamily: hasFamily, // For CMU employer contribution

        customFields: {},
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Employee insert');
    console.log(`[Employee Creation] Employee created in ${Date.now() - employeeStart}ms`);

    // Step 4: Create assignment
    console.time('[Employee Creation] Assignment insert');
    const assignmentStart = Date.now();
    const [assignment] = await tx
      .insert(assignments)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        positionId: position.id,
        assignmentType: 'primary',
        effectiveFrom: hireDate.toISOString().split('T')[0],
        effectiveTo: null,
        createdBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Assignment insert');
    console.log(`[Employee Creation] Assignment created in ${Date.now() - assignmentStart}ms`);

    // Step 5: Create salary with components
    // Auto-inject CNPS, ITS, CMU components
    console.time('[Employee Creation] Auto-inject components');
    const componentsStart = Date.now();
    const componentsWithCalculated = await autoInjectCalculatedComponents({
      tenantId: input.tenantId,
      countryCode: tenant.countryCode || 'CI',
      baseSalary: input.baseSalary,
      hireDate: hireDate, // Required for seniority bonus calculation
      numberOfDependents: input.dependentChildren,
    });
    console.timeEnd('[Employee Creation] Auto-inject components');
    console.log(`[Employee Creation] Components auto-injected in ${Date.now() - componentsStart}ms`);

    // Handle user-provided components (NEW approach)
    let userComponents: Array<{
      code: string;
      name: string;
      amount: number;
      sourceType: 'standard' | 'template';
    }> = [];

    if (input.components && input.components.length > 0) {
      // Modern component-based approach
      userComponents = input.components;
    } else {
      // BACKWARD COMPATIBILITY: Convert individual allowance fields to components
      if (input.transportAllowance && input.transportAllowance > 0) {
        userComponents.push({
          code: 'TPT_TRANSPORT_CI',
          name: 'Indemnité de transport',
          amount: input.transportAllowance,
          sourceType: 'standard',
        });
      }

      if (input.housingAllowance && input.housingAllowance > 0) {
        userComponents.push({
          code: 'TPT_HOUSING_CI',
          name: 'Indemnité de logement',
          amount: input.housingAllowance,
          sourceType: 'standard',
        });
      }

      if (input.mealAllowance && input.mealAllowance > 0) {
        userComponents.push({
          code: 'TPT_MEAL_ALLOWANCE',
          name: 'Indemnité de panier',
          amount: input.mealAllowance,
          sourceType: 'standard',
        });
      }
    }

    // Combine all components (auto-calculated + user-provided)
    const allComponents = [
      ...componentsWithCalculated,
      ...userComponents,
    ];

    console.time('[Employee Creation] Salary insert');
    const salaryStart = Date.now();
    const [salary] = await tx
      .insert(employeeSalaries)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        baseSalary: String(input.baseSalary),
        components: allComponents,
        currency: tenant.currency || 'XOF',
        effectiveFrom: hireDate.toISOString().split('T')[0],
        effectiveTo: null,
        changeReason: 'Initial hire',
        createdBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Salary insert');
    console.log(`[Employee Creation] Salary created in ${Date.now() - salaryStart}ms`);

    // ========================================
    // SKIP PAYSLIP CALCULATION (Already done in preview)
    // ========================================
    // NOTE: Payslip preview is calculated separately via calculatePayslipPreview endpoint
    // before calling this function. We don't need to recalculate it here.
    // This significantly improves performance by avoiding redundant DB queries.

    // Return null for payslipPreview - it's already been calculated and shown to user
    const payslipPreview = null;

    // Update onboarding state
    console.time('[Employee Creation] Tenant settings update');
    const tenantUpdateStart = Date.now();
    const currentSettings = (tenant.settings as any) || {};
    await tx
      .update(tenants)
      .set({
        settings: {
          ...currentSettings,
          onboarding: {
            ...currentSettings.onboarding,
            firstEmployeeId: employee.id,
            current_question: 3, // Move to Q3
          },
        },
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, input.tenantId));
    console.timeEnd('[Employee Creation] Tenant settings update');
    console.log(`[Employee Creation] Tenant updated in ${Date.now() - tenantUpdateStart}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`[Employee Creation] TOTAL TRANSACTION TIME: ${totalTime}ms`);

    return {
      employee,
      position,
      assignment,
      salary,
      payslipPreview,
    };
  });
}

/**
 * Create first payroll run (V2)
 *
 * Stores payroll frequency and creates draft payroll run summary.
 */
export async function createFirstPayrollRun(input: CreateFirstPayrollRunInput) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Calculate next period based on frequency
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Get employee count
  const employeesList = await db
    .select()
    .from(employees)
    .where(and(eq(employees.tenantId, input.tenantId), eq(employees.status, 'active')));

  const employeeCount = employeesList.length;

  // Calculate total net salary (simplified - would use calculatePayrollV2 for each)
  let totalNetSalary = 0;
  for (const emp of employeesList) {
    const [salary] = await db
      .select()
      .from(employeeSalaries)
      .where(and(eq(employeeSalaries.employeeId, emp.id), eq(employeeSalaries.tenantId, input.tenantId)))
      .orderBy(desc(employeeSalaries.effectiveFrom))
      .limit(1);

    if (salary) {
      // Quick approximation (actual would use calculatePayrollV2)
      const baseSalary = parseFloat(salary.baseSalary);
      const estimatedNet = baseSalary * 0.85; // ~85% after deductions
      totalNetSalary += estimatedNet;
    }
  }

  // Update tenant settings with payroll frequency
  const currentSettings = (tenant.settings as any) || {};
  await db
    .update(tenants)
    .set({
      settings: {
        ...currentSettings,
        payrollFrequency: input.frequency,
        onboarding: {
          ...currentSettings.onboarding,
          current_question: 4, // Move to success screen
        },
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId));

  return {
    payrollRun: {
      periodStart,
      periodEnd,
      frequency: input.frequency,
      status: 'draft',
    },
    employeeCount,
    totalNetSalary: Math.round(totalNetSalary),
  };
}

/**
 * Complete onboarding (V2)
 *
 * Marks onboarding as complete in tenant settings.
 */
export async function completeOnboardingV2(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', tenantId);
  }

  const currentSettings = (tenant.settings as any) || {};

  // Mark onboarding as complete
  await db
    .update(tenants)
    .set({
      settings: {
        ...currentSettings,
        onboarding: {
          ...currentSettings.onboarding,
          onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
          current_question: null,
        },
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));

  return {
    onboarding_complete: true,
    onboarding_completed_at: new Date().toISOString(),
  };
}
