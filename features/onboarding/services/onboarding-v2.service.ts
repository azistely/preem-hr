/**
 * Onboarding Service V2 - Task-First Approach
 *
 * Simplifies onboarding to 3 questions with immediate action on each.
 * Focuses on getting to payslip preview as fast as possible.
 */

import { db } from '@/lib/db';
import { tenants, employees, positions, assignments, employeeSalaries, employmentContracts } from '@/drizzle/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { differenceInMonths } from 'date-fns';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { generateEmployeeNumber } from '@/features/employees/services/employee-number';
import { autoInjectCalculatedComponents } from '@/lib/salary-components/component-calculator';
import { buildBaseSalaryComponents } from '@/lib/salary-components/base-salary-loader';
import { getGenericSector, type CGECISector } from '@/lib/cgeci/sector-mapping';
import { ensureComponentsActivated } from '@/lib/salary-components/component-activation';

// ========================================
// TYPES
// ========================================

export interface SetCompanyInfoV2Input {
  tenantId: string;
  countryCode: string;
  legalName: string;
  industry: string;
  cgeciSectorCode: string; // CGECI sector code (e.g., 'BANQUES', 'BTP', 'COMMERCE')
  workAccidentRate?: number; // Work accident rate (Taux d'accident du travail) from CNPS
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
  // Base salary components (NEW - replaces baseSalary)
  baseComponents?: Record<string, number>;
  // DEPRECATED: baseSalary - kept for backward compatibility
  baseSalary?: number;
  hireDate: Date;
  // CRITICAL: Family status (payroll correctness)
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren: number; // 0-10
  // NEW: Employment configuration
  contractType: 'CDI' | 'CDD' | 'STAGE';
  contractEndDate?: Date;
  cddReason?: 'REMPLACEMENT' | 'SURCROIT_ACTIVITE' | 'SAISONNIER' | 'PROJET' | 'AUTRE';
  // Dynamic category (CGECI: "1B", "2B", etc. or Banking: "A1", "A2", etc.)
  category: string;
  departmentId?: string;
  primaryLocationId?: string; // For transport validation
  rateType?: 'MONTHLY' | 'DAILY' | 'HOURLY';
  dailyRate?: number;
  hourlyRate?: number;
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
 * Set company information with CGECI sector (V2)
 *
 * CGECI INTEGRATION:
 * - Saves cgeciSectorCode (company-level, determines employee categories and min wages)
 * - Auto-derives genericSectorCode (used for work accident rate calculation)
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

  // Auto-derive generic sector from CGECI sector
  const genericSectorCode = getGenericSector(input.cgeciSectorCode as CGECISector);

  // ✅ OPTIMIZATION: Update country + company info in ONE query
  // BEFORE: selectCountry + setCompanyInfoV2 = 2 queries
  // AFTER: Single update with all fields = 1 query
  // ✅ CGECI INTEGRATION: Save CGECI sector + auto-derive generic sector
  const [updated] = await db
    .update(tenants)
    .set({
      countryCode: input.countryCode,
      currency: input.countryCode === 'CI' ? 'XOF' : 'XOF', // Default to XOF for West Africa
      name: input.legalName,
      industry: input.industry,
      taxId: input.taxId || null,
      cgeciSectorCode: input.cgeciSectorCode, // CGECI sector (e.g., 'BANQUES', 'BTP')
      genericSectorCode: genericSectorCode, // Auto-derived (e.g., 'SERVICES', 'CONSTRUCTION')
      workAccidentRate: input.workAccidentRate ? String(input.workAccidentRate) : undefined, // CNPS-provided rate
      settings: {
        ...currentSettings,
        cgeciSectorCode: input.cgeciSectorCode, // Store in settings for easy access
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

  // ========================================
  // CALCULATE BASE SALARY (from baseComponents or baseSalary)
  // ========================================
  // Calculate base salary from baseComponents (NEW) or use legacy baseSalary field
  let effectiveBaseSalary: number;
  if (input.baseComponents && Object.keys(input.baseComponents).length > 0) {
    // NEW: Sum all base components
    effectiveBaseSalary = Object.values(input.baseComponents).reduce((sum, amount) => sum + amount, 0);
  } else if (input.baseSalary !== undefined && input.baseSalary > 0) {
    // LEGACY: Use baseSalary field
    effectiveBaseSalary = input.baseSalary;
  } else {
    throw new ValidationError('Le salaire de base ou les composants de base sont requis');
  }

  // Validate minimum salary (country-specific) - Check GROSS salary (base + components)
  // NOTE: This validation is rate-type-aware (handled at API level in onboarding.ts)
  const countryCode = tenant.countryCode || 'CI';
  const minimumWages: Record<string, number> = {
    CI: 75000,  // Côte d'Ivoire
    SN: 52500,  // Sénégal
    BF: 34664,  // Burkina Faso
    ML: 40000,  // Mali
    BJ: 40000,  // Bénin
    TG: 35000,  // Togo
  };
  const monthlyMinimumWage = minimumWages[countryCode] || 75000;

  // Convert minimum wage based on rate type
  const rateType = input.rateType || 'MONTHLY';
  let applicableMinimumWage = monthlyMinimumWage;
  let rateLabel = 'mensuel';

  if (rateType === 'DAILY') {
    applicableMinimumWage = Math.round(monthlyMinimumWage / 30);
    rateLabel = 'journalier';
  } else if (rateType === 'HOURLY') {
    applicableMinimumWage = Math.round(monthlyMinimumWage / (30 * 8));
    rateLabel = 'horaire';
  }

  // Calculate gross salary (base + all components)
  const componentsTotal = input.components?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const grossSalary = effectiveBaseSalary + componentsTotal;

  if (grossSalary < applicableMinimumWage) {
    const countryNames: Record<string, string> = {
      CI: 'Côte d\'Ivoire',
      SN: 'Sénégal',
      BF: 'Burkina Faso',
      ML: 'Mali',
      BJ: 'Bénin',
      TG: 'Togo',
    };
    const rateSuffix = rateType === 'MONTHLY' ? '' : rateType === 'DAILY' ? '/jour' : '/heure';
    throw new ValidationError(
      `Le salaire brut total ${rateLabel} (salaire de base + indemnités) doit être supérieur ou égal au SMIG de ${countryNames[countryCode] || countryCode} (${applicableMinimumWage.toLocaleString('fr-FR')} FCFA${rateSuffix})`
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
  // PRE-CALCULATE COMPONENTS (BEFORE TRANSACTION)
  // ========================================
  // ✅ CRITICAL FIX: Calculate components BEFORE transaction to avoid deadlock
  // This function makes DB queries to load formula metadata, which would deadlock
  // if called inside the transaction (separate connection waiting for transaction locks)
  console.time('[Employee Creation] Pre-calculate components');
  const preCalcStart = Date.now();
  const componentsWithCalculated = await autoInjectCalculatedComponents({
    tenantId: input.tenantId,
    countryCode: tenant.countryCode || 'CI',
    baseSalary: effectiveBaseSalary, // Use calculated base salary
    hireDate: hireDate,
    numberOfDependents: input.dependentChildren,
  });
  console.timeEnd('[Employee Creation] Pre-calculate components');
  console.log(`[Employee Creation] Components pre-calculated in ${Date.now() - preCalcStart}ms`);

  // ========================================
  // ✅ CRITICAL FIX: Build base salary components BEFORE transaction to avoid timeout
  // buildBaseSalaryComponents makes DB queries to load component definitions
  // Calling it inside transaction causes timeout on Vercel (30s serverless limit)
  // ========================================
  console.time('[Employee Creation] Pre-build base components');
  const baseCompStart = Date.now();
  let baseComponentsArray: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType: string;
    metadata?: Record<string, any>;
  }> = [];

  if (input.baseComponents && Object.keys(input.baseComponents).length > 0) {
    // Build base components using database-driven loader
    baseComponentsArray = await buildBaseSalaryComponents(
      input.baseComponents,
      tenant.countryCode || 'CI'
    );
  } else if (effectiveBaseSalary > 0) {
    // LEGACY: If no baseComponents provided, create Code 11 with the baseSalary amount
    // This ensures backward compatibility and prevents missing Code 11
    baseComponentsArray = await buildBaseSalaryComponents(
      { '11': effectiveBaseSalary },
      tenant.countryCode || 'CI'
    );
  }
  console.timeEnd('[Employee Creation] Pre-build base components');
  console.log(`[Employee Creation] Base components pre-built in ${Date.now() - baseCompStart}ms`);

  // ========================================
  // CREATE RECORDS IN TRANSACTION
  // ========================================
  console.log('[Employee Creation] Starting transaction...');
  const startTime = Date.now();

  return await db.transaction(async (tx) => {
    // Step 1: Create position (with department if provided)
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
        minSalary: String(effectiveBaseSalary),
        maxSalary: String(effectiveBaseSalary),
        departmentId: input.departmentId || null,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Position insert');
    console.log(`[Employee Creation] Position created in ${Date.now() - positionStart}ms`);

    // Step 2: Generate employee number
    console.time('[Employee Creation] Employee number generation');
    const empNumStart = Date.now();
    // ✅ CRITICAL FIX: Pass transaction to avoid deadlock
    // BEFORE: generateEmployeeNumber used separate db connection → deadlock/timeout
    // AFTER: Use same transaction connection → no deadlock
    const employeeNumber = await generateEmployeeNumber(input.tenantId, tx);
    console.timeEnd('[Employee Creation] Employee number generation');
    console.log(`[Employee Creation] Employee number generated in ${Date.now() - empNumStart}ms`);

    // Step 3: Create employee with fiscal parts and employment details
    console.time('[Employee Creation] Employee insert');
    const employeeStart = Date.now();

    // Map category to coefficient (approximate ranges)
    // NOTE: For CGECI categories, coefficient is stored in the database (cgeci_bareme_2023 table)
    // For backward compatibility, we provide default mapping for legacy banking categories
    const categoryCoefficients: Record<string, number> = {
      'A1': 100,
      'A2': 115,
      'B1': 135,
      'B2': 155,
      'C': 175,
      'D': 200,
      'E': 250,
      'F': 300,
    };
    // Use 100 as default for unknown categories (CGECI categories will be handled via database)
    const coefficient = categoryCoefficients[input.category] || 100;

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
        coefficient: coefficient,
        status: 'active',

        // NEW: Employment configuration
        rateType: input.rateType || 'MONTHLY',
        categoryCode: input.category, // Dynamic category (CGECI or Banking)
        dailyRate: input.dailyRate ? String(input.dailyRate) : null,
        hourlyRate: input.hourlyRate ? String(input.hourlyRate) : null,
        primaryLocationId: input.primaryLocationId || null, // For transport validation

        // Contract end date for CDD
        terminationDate: input.contractType === 'CDD' && input.contractEndDate
          ? input.contractEndDate.toISOString().split('T')[0]
          : null,

        // CRITICAL: Store family status for payroll
        maritalStatus: input.maritalStatus,
        dependentChildren: input.dependentChildren,
        fiscalParts: String(fiscalParts), // Pre-calculated for tax
        hasFamily: hasFamily, // For CMU employer contribution

        customFields: {
          contractType: input.contractType,
        },
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Employee insert');
    console.log(`[Employee Creation] Employee created in ${Date.now() - employeeStart}ms`);

    // Step 3.5: Create employment contract (CDD compliance tracking)
    console.time('[Employee Creation] Contract insert');
    const contractStart = Date.now();
    const [contract] = await tx
      .insert(employmentContracts)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        contractType: input.contractType,
        contractNumber: `${input.contractType}-${employeeNumber}`,
        startDate: hireDate.toISOString().split('T')[0],
        endDate: input.contractType === 'CDD' && input.contractEndDate
          ? input.contractEndDate.toISOString().split('T')[0]
          : null,
        renewalCount: 0, // Always 0 for new contracts
        isActive: true,
        cddReason: input.contractType === 'CDD' ? (input.cddReason || null) : null,
        cddTotalDurationMonths: input.contractType === 'CDD' && input.contractEndDate
          ? differenceInMonths(input.contractEndDate, hireDate)
          : null,
        createdBy: input.userId,
      })
      .returning();
    console.timeEnd('[Employee Creation] Contract insert');
    console.log(`[Employee Creation] Contract ${contract.contractNumber} created in ${Date.now() - contractStart}ms`);

    // Step 3.6: Link contract ID to employee customFields (for backward compatibility)
    await tx
      .update(employees)
      .set({
        customFields: {
          contractType: input.contractType,
          contractId: contract.id,
        },
      })
      .where(eq(employees.id, employee.id));

    // Step 4: Create assignment
    // NOTE: Department is linked through position, not directly through assignment
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
    // (componentsWithCalculated and baseComponentsArray already pre-calculated before transaction)
    console.log('[Employee Creation] Using pre-calculated base components and formula components');

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

    // ========================================
    // AUTO-ACTIVATE COMPONENTS AT TENANT LEVEL
    // ========================================
    // CRITICAL: Ensure all user-provided components are activated at tenant level
    // This allows components to be used without manual activation in Settings
    console.log('[Employee Creation] Auto-activating components at tenant level...');
    const activationStart = Date.now();

    if (userComponents.length > 0) {
      const activationInputs = userComponents.map(comp => ({
        code: comp.code,
        sourceType: comp.sourceType,
        tenantId: input.tenantId,
        countryCode: tenant.countryCode || 'CI',
        userId: input.userId,
      }));

      const activationResults = await ensureComponentsActivated(activationInputs, tx);

      const newActivations = activationResults.filter(r => r.isNewActivation);
      if (newActivations.length > 0) {
        console.log(`[Employee Creation] Auto-activated ${newActivations.length} new components at tenant level`);
      } else {
        console.log('[Employee Creation] All components already activated at tenant level');
      }
    }

    console.log(`[Employee Creation] Component activation completed in ${Date.now() - activationStart}ms`);

    // Combine all components: base components + auto-calculated + user-provided
    const allComponents = [
      ...baseComponentsArray, // Code 11, Code 12, etc.
      ...componentsWithCalculated, // Family allowance, etc.
      ...userComponents, // Transport, housing, etc.
    ];

    console.time('[Employee Creation] Salary insert');
    const salaryStart = Date.now();
    const [salary] = await tx
      .insert(employeeSalaries)
      .values({
        tenantId: input.tenantId,
        employeeId: employee.id,
        baseSalary: String(effectiveBaseSalary), // Use calculated base salary (sum of baseComponents or legacy baseSalary)
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
