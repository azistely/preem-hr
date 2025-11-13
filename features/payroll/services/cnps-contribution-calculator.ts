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
 * SALARY BRACKETS (from official CNPS form):
 * =============================================
 * HOURLY/DAILY WORKERS:
 * - Category 1: ≤ 3,231 FCFA/day
 * - Category 2: > 3,231 FCFA/day
 *
 * MONTHLY WORKERS:
 * - Category 1: < 70,000 FCFA/month
 * - Category 2: 70,000 - 1,647,315 FCFA/month
 * - Category 3: > 1,647,315 FCFA/month
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
import { and, eq, gte, lte, inArray, sql } from 'drizzle-orm';

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
  contributionBase: number; // Amount subject to contributions (may be capped)
}

/**
 * Contribution scheme breakdown
 */
export interface ContributionScheme {
  code: string; // 'pension', 'maternity', 'family_benefits', 'work_accidents'
  name: string; // French label
  rate: number; // Percentage rate
  plafond: number | null; // Ceiling amount (null if no ceiling)
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
const MONTHLY_SALARY_BRACKET_1 = 70000; // FCFA
const MONTHLY_SALARY_BRACKET_2 = 1647315; // FCFA (CNPS plafond)

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
 * Categorize employee by salary and work regime
 */
function categorizeEmployee(
  salaryRegime: string | null,
  grossSalary: number,
  daysWorked: number | null,
): {
  isDailyWorker: boolean;
  category: 'daily_1' | 'daily_2' | 'monthly_1' | 'monthly_2' | 'monthly_3';
} {
  const regime = salaryRegime?.toUpperCase();
  const isDailyWorker = regime === 'DAILY' || regime === 'HOURLY';

  if (isDailyWorker) {
    const days = daysWorked || 1;
    const dailyRate = grossSalary / days;
    return {
      isDailyWorker: true,
      category: dailyRate <= DAILY_WAGE_THRESHOLD ? 'daily_1' : 'daily_2',
    };
  }

  // Monthly workers
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

  // 4. Query all line items for these runs with employee data
  const lineItems = await db
    .select({
      lineItem: payrollLineItems,
      employee: employees,
    })
    .from(payrollLineItems)
    .leftJoin(employees, eq(payrollLineItems.employeeId, employees.id))
    .where(
      and(
        inArray(payrollLineItems.payrollRunId, runIds),
        eq(payrollLineItems.tenantId, tenantId),
      ),
    );

  // 5. Initialize salary bracket accumulators
  const brackets = {
    daily_1: { count: 0, gross: 0, base: 0 },
    daily_2: { count: 0, gross: 0, base: 0 },
    monthly_1: { count: 0, gross: 0, base: 0 },
    monthly_2: { count: 0, gross: 0, base: 0 },
    monthly_3: { count: 0, gross: 0, base: 0 },
  };

  // 6. Initialize contribution accumulators
  const contributions = {
    pension_employer: 0,
    pension_employee: 0,
    maternity_employer: 0,
    family_employer: 0,
    work_accident_employer: 0,
    cmu_employer: 0,
    cmu_employee: 0,
  };

  // 7. Process each line item (with CNPS filter)
  for (const { lineItem, employee } of lineItems) {
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

    // Categorize employee
    const { category } = categorizeEmployee(
      employee?.salaryRegime || null,
      grossSalary,
      toNumber(lineItem.daysWorked),
    );

    // Update bracket totals
    brackets[category].count += 1;
    brackets[category].gross += grossSalary;
    brackets[category].base += Math.min(brutImposable, MONTHLY_SALARY_BRACKET_2);

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
    contributions.maternity_employer += extractContribution(
      contributionDetails,
      'maternity',
      'employer',
    );
    contributions.family_employer += extractContribution(
      contributionDetails,
      'family_benefits',
      'employer',
    );
    contributions.work_accident_employer += extractContribution(
      contributionDetails,
      'work_accidents',
      'employer',
    );
    contributions.cmu_employer += extractContribution(
      contributionDetails,
      'cmu',
      'employer',
    );
    contributions.cmu_employee += extractContribution(
      contributionDetails,
      'cmu',
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
    const contribution = scheme?.contributionTypes.find((c) => c.code === code);
    return contribution ? toNumber(contribution.rate) * 100 : 0; // Convert to percentage
  };

  const getPlafond = (code: string): number | null => {
    const contribution = scheme?.contributionTypes.find((c) => c.code === code);
    return contribution?.monthlyPlafond ? toNumber(contribution.monthlyPlafond) : null;
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
      },
      category2: {
        category: 'Horaires, journaliers et occasionnels supérieurs à 3231 F par jour',
        employeeCount: brackets.daily_2.count,
        totalGross: Math.round(brackets.daily_2.gross),
        contributionBase: Math.round(brackets.daily_2.base),
      },
      total: {
        category: 'Total horaires/journaliers',
        employeeCount: brackets.daily_1.count + brackets.daily_2.count,
        totalGross: Math.round(brackets.daily_1.gross + brackets.daily_2.gross),
        contributionBase: Math.round(brackets.daily_1.base + brackets.daily_2.base),
      },
    },

    monthlyWorkers: {
      category1: {
        category: 'Mensuels inférieurs ou égaux à 70.000 F par mois',
        employeeCount: brackets.monthly_1.count,
        totalGross: Math.round(brackets.monthly_1.gross),
        contributionBase: Math.round(brackets.monthly_1.base),
      },
      category2: {
        category: 'Mensuels supérieurs à 70.000 F par mois et inférieurs ou égaux à 1.647.315 F par mois',
        employeeCount: brackets.monthly_2.count,
        totalGross: Math.round(brackets.monthly_2.gross),
        contributionBase: Math.round(brackets.monthly_2.base),
      },
      category3: {
        category: 'Mensuels supérieurs à 1.647.315 F par mois',
        employeeCount: brackets.monthly_3.count,
        totalGross: Math.round(brackets.monthly_3.gross),
        contributionBase: Math.round(brackets.monthly_3.base),
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
      },
    },

    // Contribution schemes
    contributions: {
      retirement: {
        code: 'pension',
        name: 'Régime de Retraite',
        rate: getRate('pension'),
        plafond: getPlafond('pension'),
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
        employerAmount: Math.round(contributions.maternity_employer),
        employeeAmount: 0,
        totalAmount: Math.round(contributions.maternity_employer),
      },
      familyBenefits: {
        code: 'family_benefits',
        name: 'Prestations Familiales',
        rate: getRate('family_benefits'),
        plafond: getPlafond('family_benefits'),
        employerAmount: Math.round(contributions.family_employer),
        employeeAmount: 0,
        totalAmount: Math.round(contributions.family_employer),
      },
      workAccidents: {
        code: 'work_accidents',
        name: 'Accidents du Travail',
        rate: getRate('work_accidents'),
        plafond: getPlafond('work_accidents'),
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
