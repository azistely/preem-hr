/**
 * CNPS Monthly Contribution Declaration Calculator
 *
 * Aggregates payroll data for a given month to generate the official
 * "APPEL DE COTISATION MENSUEL" form required by CNPS.
 *
 * This service:
 * 1. Queries all approved/paid payroll runs for the specified month
 * 2. Categorizes employees by salary brackets
 * 3. Calculates contribution totals by scheme
 * 4. Returns structured data for form display and PDF export
 *
 * EMPLOYEE CATEGORIZATION:
 * =============================================
 * DAILY/HOURLY WORKERS (Journalier/Horaire):
 * - All CDDTI contract employees
 * - Categorized by daily wage:
 *   - Category 1: ≤ 3,231 FCFA/day
 *   - Category 2: > 3,231 FCFA/day
 *
 * MONTHLY WORKERS (Mensuel):
 * - All non-CDDTI employees (CDI, CDD, etc.)
 * - Categorized by monthly salary:
 *   - Category 1: < 70,000 FCFA/month
 *   - Category 2: 70,000 - 1,647,315 FCFA/month
 *   - Category 3: > 1,647,315 FCFA/month
 *
 * CONTRIBUTION SCHEMES:
 * =============================================
 * 1. Régime de Retraite (Retirement)
 *    - Plafond: 1,647,315 FCFA/month
 *    - Rate: Variable by country (CI: 7.7% employer + 3.2% employee)
 *
 * 2. Assurance Maternité (Maternity Insurance)
 *    - Rate: 0.75% employer
 *
 * 3. Prestations Familiales (Family Benefits)
 *    - Rate: 5.75% employer (CI), varies by country
 *
 * 4. Accidents du Travail (Work Accidents)
 *    - Rate: Variable by sector (typically 2-4%)
 *    - Applied on salaireCategoriel for CI
 */

import { db } from '@/lib/db';
import {
  payrollRuns,
  payrollLineItems,
  employees,
  tenants,
  socialSecuritySchemes,
  contributionTypes,
} from '@/lib/db/schema';
import { and, eq, gte, lte, inArray, sql, desc } from 'drizzle-orm';
import * as schema from '@/drizzle/schema';

// ========================================
// Types
// ========================================

/**
 * Salary bracket for employee categorization
 */
export interface SalaryBracket {
  category: string; // Label for the bracket
  employeeCount: number;
  totalGross: number;
  contributionBase: number; // Retirement contribution base (plafond: 1.647.315 F)
  retirementBase: number; // Explicit retirement base (plafond: 1.647.315 F)
  otherRegimesBase: number; // Base for maternity/family/work accidents (plafond: 75.000 F)
}

/**
 * Contribution scheme breakdown
 */
export interface ContributionScheme {
  code: string; // 'pension', 'maternity', 'family_benefits', 'work_accidents'
  name: string; // French label
  rate: number; // Percentage rate
  plafond: number | null; // Ceiling amount (null if no ceiling)
  contributionBase: number; // Base amount subject to this specific contribution
  employerAmount: number;
  employeeAmount: number;
  totalAmount: number;
}

/**
 * Complete CNPS declaration data structure
 */
export interface CNPSDeclarationData {
  // Company information
  companyName: string;
  companyCNPS: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  countryCode: string;

  // Period information
  month: number; // 1-12
  year: number;
  periodStart: Date;
  periodEnd: Date;

  // Aggregate statistics
  totalEmployeeCount: number;
  totalGrossSalary: number;
  totalContributionBase: number; // Total amount subject to contributions

  // Employee categorization
  dailyWorkers: {
    category1: SalaryBracket; // ≤ 3,231 F/day
    category2: SalaryBracket; // > 3,231 F/day
    total: SalaryBracket;
  };
  monthlyWorkers: {
    category1: SalaryBracket; // < 70,000 F/month
    category2: SalaryBracket; // 70,000 - 1,647,315 F/month
    category3: SalaryBracket; // > 1,647,315 F/month
    total: SalaryBracket;
  };

  // Contribution schemes
  contributions: {
    retirement: ContributionScheme;
    maternity: ContributionScheme;
    familyBenefits: ContributionScheme;
    workAccidents: ContributionScheme;
    cmu?: ContributionScheme; // Optional CMU for CI
  };

  // Total amounts
  totalEmployerContributions: number;
  totalEmployeeContributions: number;
  totalContributions: number;

  // Metadata
  generatedAt: Date;
  payrollRunIds: string[]; // IDs of included payroll runs
}

/**
 * Input parameters for declaration generation
 */
export interface GenerateDeclarationInput {
  tenantId: string;
  month: number; // 1-12
  year: number;
  countryCode: string;
  cnpsFilter?: 'all' | 'with_cnps' | 'without_cnps'; // Filter by CNPS number
}

// ========================================
// Constants
// ========================================

const DAILY_WAGE_THRESHOLD = 3231; // FCFA per day
const MONTHLY_SALARY_BRACKET_1 = 70000; // FCFA (SMIG - minimum wage)
const MONTHLY_SALARY_BRACKET_2 = 1647315; // FCFA (CNPS plafond for retirement)
const OTHER_REGIMES_PLAFOND = 75000; // FCFA (plafond for maternity, family, work accidents)

// ========================================
// Helper Functions
// ========================================

/**
 * Convert database numeric/Decimal to number safely
 */
function toNumber(value: string | number | { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  // Decimal-like type (has toString method)
  return parseFloat(value.toString()) || 0;
}

/**
 * Categorize employee by contract type and salary
 *
 * IMPORTANT: CDDTI employees are always daily/hourly workers (journalier/horaire)
 * All other employees are monthly workers (mensuel)
 */
function categorizeEmployee(
  contractType: string | null,
  grossSalary: number,
  daysWorked: number | null,
): {
  isDailyWorker: boolean;
  category: 'daily_1' | 'daily_2' | 'monthly_1' | 'monthly_2' | 'monthly_3';
} {
  // CDDTI employees are always daily/hourly workers
  const isDailyWorker = contractType?.toUpperCase() === 'CDDTI';

  if (isDailyWorker) {
    const days = daysWorked || 1;
    const dailyRate = grossSalary / days;
    return {
      isDailyWorker: true,
      category: dailyRate <= DAILY_WAGE_THRESHOLD ? 'daily_1' : 'daily_2',
    };
  }

  // Monthly workers (all non-CDDTI employees)
  if (grossSalary < MONTHLY_SALARY_BRACKET_1) {
    return { isDailyWorker: false, category: 'monthly_1' };
  } else if (grossSalary <= MONTHLY_SALARY_BRACKET_2) {
    return { isDailyWorker: false, category: 'monthly_2' };
  } else {
    return { isDailyWorker: false, category: 'monthly_3' };
  }
}

/**
 * Extract contribution amount from contributionDetails JSONB
 */
function extractContribution(
  contributionDetails: any,
  code: string,
  paidBy: 'employer' | 'employee',
): number {
  if (!Array.isArray(contributionDetails)) return 0;

  const contribution = contributionDetails.find(
    (c: any) => c.code === code && c.paidBy === paidBy,
  );

  return contribution ? toNumber(contribution.amount) : 0;
}

// ========================================
// Main Service Function
// ========================================

/**
 * Generate CNPS monthly contribution declaration data
 *
 * @param input - Month, year, tenant, and country information
 * @returns Structured declaration data ready for form display
 */
export async function generateCNPSDeclaration(
  input: GenerateDeclarationInput,
): Promise<CNPSDeclarationData> {
  const { tenantId, month, year, countryCode, cnpsFilter = 'all' } = input;

  // 1. Calculate date range for the month
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59); // Last day of month

  // 2. Query tenant information
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // 3. Query all approved/paid payroll runs for the month
  const runs = await db.query.payrollRuns.findMany({
    where: and(
      eq(payrollRuns.tenantId, tenantId),
      eq(payrollRuns.countryCode, countryCode),
      gte(payrollRuns.periodStart, periodStart.toISOString().split('T')[0]),
      lte(payrollRuns.periodEnd, periodEnd.toISOString().split('T')[0]),
      inArray(payrollRuns.status, ['approved', 'paid']),
    ),
  });

  if (runs.length === 0) {
    throw new Error(`No approved/paid payroll runs found for ${month}/${year}`);
  }

  const runIds = runs.map((r) => r.id);

  // 4. Query all line items for these runs with employee data and current employment contract
  const lineItems = await db
    .select({
      lineItem: payrollLineItems,
      employee: employees,
      contract: schema.employmentContracts,
    })
    .from(payrollLineItems)
    .leftJoin(employees, eq(payrollLineItems.employeeId, employees.id))
    .leftJoin(
      schema.employmentContracts,
      eq(schema.employmentContracts.id, employees.currentContractId)
    )
    .where(
      and(
        inArray(payrollLineItems.payrollRunId, runIds),
        eq(payrollLineItems.tenantId, tenantId),
      ),
    );

  // 5. Initialize salary bracket accumulators
  const brackets = {
    daily_1: { count: 0, gross: 0, base: 0, retirementBase: 0, otherRegimesBase: 0 },
    daily_2: { count: 0, gross: 0, base: 0, retirementBase: 0, otherRegimesBase: 0 },
    monthly_1: { count: 0, gross: 0, base: 0, retirementBase: 0, otherRegimesBase: 0 },
    monthly_2: { count: 0, gross: 0, base: 0, retirementBase: 0, otherRegimesBase: 0 },
    monthly_3: { count: 0, gross: 0, base: 0, retirementBase: 0, otherRegimesBase: 0 },
  };

  // 6. Initialize contribution accumulators
  const contributions = {
    pension_employer: 0,
    pension_employee: 0,
    pension_base: 0, // Base for retirement (plafond: 1.647.315 F)
    maternity_employer: 0,
    maternity_base: 0, // Base for maternity (plafond: 75.000 F)
    family_employer: 0,
    family_base: 0, // Base for family benefits (plafond: 75.000 F)
    work_accident_employer: 0,
    work_accident_base: 0, // Base for work accidents (plafond: 75.000 F)
    cmu_employer: 0,
    cmu_employee: 0,
    cmu_base: 0,
  };

  // 7. Process each line item (with CNPS filter)
  for (const { lineItem, employee, contract } of lineItems) {
    // Apply CNPS number filter
    if (cnpsFilter === 'with_cnps' && (!employee?.cnpsNumber || employee.cnpsNumber.trim() === '')) {
      continue; // Skip employees without CNPS number
    }
    if (cnpsFilter === 'without_cnps' && employee?.cnpsNumber && employee.cnpsNumber.trim() !== '') {
      continue; // Skip employees with CNPS number
    }

    const grossSalary = toNumber(lineItem.grossSalary);
    const brutImposable = toNumber(lineItem.brutImposable) || grossSalary;
    const contributionDetails = lineItem.contributionDetails as any;

    // Categorize employee (CDDTI = daily/hourly, all others = monthly)
    // Use contract type from employment_contracts table (active contract)
    const { category, isDailyWorker } = categorizeEmployee(
      contract?.contractType || null,
      grossSalary,
      toNumber(lineItem.daysWorked),
    );

    // Calculate regime-specific contribution bases
    // Régime de Retraite: plafond = 1.647.315 F (for all employees)
    const pensionBase = Math.min(brutImposable, MONTHLY_SALARY_BRACKET_2);
    contributions.pension_base += pensionBase;

    // Other regimes: plafond = 75.000 F
    // - For CDDTI: use actual salary up to 75.000 F
    // - For monthly workers: use fixed 75.000 F if salary >= 75.000 F
    let otherRegimesBase: number;
    if (isDailyWorker) {
      // CDDTI: sum actual contributions in period, capped at 75.000 F
      otherRegimesBase = Math.min(brutImposable, OTHER_REGIMES_PLAFOND);
    } else {
      // Monthly workers: fixed 75.000 F if they earn at least 75.000 F
      otherRegimesBase = brutImposable >= OTHER_REGIMES_PLAFOND ? OTHER_REGIMES_PLAFOND : brutImposable;
    }

    // Update bracket totals
    brackets[category].count += 1;
    brackets[category].gross += grossSalary;
    brackets[category].base += pensionBase; // Keep legacy base as retirement base
    brackets[category].retirementBase += pensionBase;
    brackets[category].otherRegimesBase += otherRegimesBase;

    contributions.maternity_base += otherRegimesBase;
    contributions.family_base += otherRegimesBase;
    contributions.work_accident_base += otherRegimesBase;
    contributions.cmu_base += otherRegimesBase; // CMU uses same base as other regimes

    // Extract and sum contributions
    contributions.pension_employer += extractContribution(
      contributionDetails,
      'pension',
      'employer',
    );
    contributions.pension_employee += extractContribution(
      contributionDetails,
      'pension',
      'employee',
    );

    // IMPORTANT: Family benefits includes both maternity (0.75%) and family (5%) = 5.75% total
    // During payroll, this is stored as a single "family_benefits" contribution
    // We need to split it proportionally for the CNPS declaration
    const familyBenefitsCombined = extractContribution(
      contributionDetails,
      'family_benefits',
      'employer',
    );
    // Split: Maternity = 0.75%, Family = 5%, Total = 5.75%
    contributions.maternity_employer += familyBenefitsCombined * (0.75 / 5.75);
    contributions.family_employer += familyBenefitsCombined * (5.0 / 5.75);

    contributions.work_accident_employer += extractContribution(
      contributionDetails,
      'work_accidents',
      'employer',
    ) || extractContribution(
      contributionDetails,
      'work_accident',
      'employer',
    );
    contributions.cmu_employer += extractContribution(
      contributionDetails,
      'cmu_employer_base',
      'employer',
    ) + extractContribution(
      contributionDetails,
      'cmu_employer_family',
      'employer',
    );
    contributions.cmu_employee += extractContribution(
      contributionDetails,
      'cmu_employee',
      'employee',
    );
  }

  // 8. Query contribution rates from database (for display/reference)
  const scheme = await db.query.socialSecuritySchemes.findFirst({
    where: eq(socialSecuritySchemes.countryCode, countryCode),
    with: {
      contributionTypes: true,
    },
  });

  const getRate = (code: string): number => {
    // Special handling for maternity and family benefits
    // In the database, they're combined as "family_benefits" at 5.75%
    // But CNPS declaration needs them split:
    if (code === 'maternity') return 0.75; // 0.75%
    if (code === 'family_benefits') return 5.0; // 5%

    const contribution = scheme?.contributionTypes.find((c) => c.code === code);
    if (!contribution) return 0;

    // Use employerRate for employer-only contributions, otherwise sum both
    const employerRate = contribution.employerRate ? toNumber(contribution.employerRate) : 0;
    const employeeRate = contribution.employeeRate ? toNumber(contribution.employeeRate) : 0;
    return (employerRate + employeeRate) * 100; // Convert to percentage
  };

  const getPlafond = (code: string): number | null => {
    const contribution = scheme?.contributionTypes.find((c) => c.code === code);
    return contribution?.ceilingAmount ? toNumber(contribution.ceilingAmount) : null;
  };

  // 9. Build result structure
  const totalEmployeeCount =
    brackets.daily_1.count +
    brackets.daily_2.count +
    brackets.monthly_1.count +
    brackets.monthly_2.count +
    brackets.monthly_3.count;

  const totalGrossSalary =
    brackets.daily_1.gross +
    brackets.daily_2.gross +
    brackets.monthly_1.gross +
    brackets.monthly_2.gross +
    brackets.monthly_3.gross;

  const totalContributionBase =
    brackets.daily_1.base +
    brackets.daily_2.base +
    brackets.monthly_1.base +
    brackets.monthly_2.base +
    brackets.monthly_3.base;

  const totalEmployerContributions =
    contributions.pension_employer +
    contributions.maternity_employer +
    contributions.family_employer +
    contributions.work_accident_employer +
    contributions.cmu_employer;

  const totalEmployeeContributions =
    contributions.pension_employee + contributions.cmu_employee;

  const result: CNPSDeclarationData = {
    // Company information
    companyName: tenant.name,
    companyCNPS: tenant.taxId || null,
    companyAddress: null, // Address not stored on tenant
    companyPhone: null, // Phone not stored on tenant
    countryCode,

    // Period information
    month,
    year,
    periodStart,
    periodEnd,

    // Aggregate statistics
    totalEmployeeCount,
    totalGrossSalary: Math.round(totalGrossSalary),
    totalContributionBase: Math.round(totalContributionBase),

    // Employee categorization
    dailyWorkers: {
      category1: {
        category: 'Horaires, journaliers et occasionnels inférieurs ou égaux à 3231 F par jour',
        employeeCount: brackets.daily_1.count,
        totalGross: Math.round(brackets.daily_1.gross),
        contributionBase: Math.round(brackets.daily_1.base),
        retirementBase: Math.round(brackets.daily_1.retirementBase),
        otherRegimesBase: Math.round(brackets.daily_1.otherRegimesBase),
      },
      category2: {
        category: 'Horaires, journaliers et occasionnels supérieurs à 3231 F par jour',
        employeeCount: brackets.daily_2.count,
        totalGross: Math.round(brackets.daily_2.gross),
        contributionBase: Math.round(brackets.daily_2.base),
        retirementBase: Math.round(brackets.daily_2.retirementBase),
        otherRegimesBase: Math.round(brackets.daily_2.otherRegimesBase),
      },
      total: {
        category: 'Total horaires/journaliers',
        employeeCount: brackets.daily_1.count + brackets.daily_2.count,
        totalGross: Math.round(brackets.daily_1.gross + brackets.daily_2.gross),
        contributionBase: Math.round(brackets.daily_1.base + brackets.daily_2.base),
        retirementBase: Math.round(brackets.daily_1.retirementBase + brackets.daily_2.retirementBase),
        otherRegimesBase: Math.round(brackets.daily_1.otherRegimesBase + brackets.daily_2.otherRegimesBase),
      },
    },

    monthlyWorkers: {
      category1: {
        category: 'Mensuels inférieurs ou égaux à 70.000 F par mois',
        employeeCount: brackets.monthly_1.count,
        totalGross: Math.round(brackets.monthly_1.gross),
        contributionBase: Math.round(brackets.monthly_1.base),
        retirementBase: Math.round(brackets.monthly_1.retirementBase),
        otherRegimesBase: Math.round(brackets.monthly_1.otherRegimesBase),
      },
      category2: {
        category: 'Mensuels supérieurs à 70.000 F par mois et inférieurs ou égaux à 1.647.315 F par mois',
        employeeCount: brackets.monthly_2.count,
        totalGross: Math.round(brackets.monthly_2.gross),
        contributionBase: Math.round(brackets.monthly_2.base),
        retirementBase: Math.round(brackets.monthly_2.retirementBase),
        otherRegimesBase: Math.round(brackets.monthly_2.otherRegimesBase),
      },
      category3: {
        category: 'Mensuels supérieurs à 1.647.315 F par mois',
        employeeCount: brackets.monthly_3.count,
        totalGross: Math.round(brackets.monthly_3.gross),
        contributionBase: Math.round(brackets.monthly_3.base),
        retirementBase: Math.round(brackets.monthly_3.retirementBase),
        otherRegimesBase: Math.round(brackets.monthly_3.otherRegimesBase),
      },
      total: {
        category: 'Total mensuels',
        employeeCount:
          brackets.monthly_1.count + brackets.monthly_2.count + brackets.monthly_3.count,
        totalGross: Math.round(
          brackets.monthly_1.gross + brackets.monthly_2.gross + brackets.monthly_3.gross,
        ),
        contributionBase: Math.round(
          brackets.monthly_1.base + brackets.monthly_2.base + brackets.monthly_3.base,
        ),
        retirementBase: Math.round(
          brackets.monthly_1.retirementBase + brackets.monthly_2.retirementBase + brackets.monthly_3.retirementBase,
        ),
        otherRegimesBase: Math.round(
          brackets.monthly_1.otherRegimesBase + brackets.monthly_2.otherRegimesBase + brackets.monthly_3.otherRegimesBase,
        ),
      },
    },

    // Contribution schemes
    contributions: {
      retirement: {
        code: 'pension',
        name: 'Régime de Retraite',
        rate: getRate('pension'),
        plafond: getPlafond('pension'),
        contributionBase: Math.round(contributions.pension_base),
        employerAmount: Math.round(contributions.pension_employer),
        employeeAmount: Math.round(contributions.pension_employee),
        totalAmount: Math.round(
          contributions.pension_employer + contributions.pension_employee,
        ),
      },
      maternity: {
        code: 'maternity',
        name: 'Assurance Maternité',
        rate: getRate('maternity'),
        plafond: null,
        contributionBase: Math.round(contributions.maternity_base),
        employerAmount: Math.round(contributions.maternity_employer),
        employeeAmount: 0,
        totalAmount: Math.round(contributions.maternity_employer),
      },
      familyBenefits: {
        code: 'family_benefits',
        name: 'Prestations Familiales',
        rate: getRate('family_benefits'),
        plafond: getPlafond('family_benefits'),
        contributionBase: Math.round(contributions.family_base),
        employerAmount: Math.round(contributions.family_employer),
        employeeAmount: 0,
        totalAmount: Math.round(contributions.family_employer),
      },
      workAccidents: {
        code: 'work_accident',
        name: 'Accidents du Travail',
        rate: getRate('work_accident'),
        plafond: getPlafond('work_accident'),
        contributionBase: Math.round(contributions.work_accident_base),
        employerAmount: Math.round(contributions.work_accident_employer),
        employeeAmount: 0,
        totalAmount: Math.round(contributions.work_accident_employer),
      },
      ...(contributions.cmu_employer > 0 || contributions.cmu_employee > 0
        ? {
            cmu: {
              code: 'cmu',
              name: 'CMU (Couverture Maladie Universelle)',
              rate: getRate('cmu'),
              plafond: null,
              contributionBase: Math.round(contributions.cmu_base),
              employerAmount: Math.round(contributions.cmu_employer),
              employeeAmount: Math.round(contributions.cmu_employee),
              totalAmount: Math.round(contributions.cmu_employer + contributions.cmu_employee),
            },
          }
        : {}),
    },

    // Total amounts
    totalEmployerContributions: Math.round(totalEmployerContributions),
    totalEmployeeContributions: Math.round(totalEmployeeContributions),
    totalContributions: Math.round(totalEmployerContributions + totalEmployeeContributions),

    // Metadata
    generatedAt: new Date(),
    payrollRunIds: runIds,
  };

  return result;
}
