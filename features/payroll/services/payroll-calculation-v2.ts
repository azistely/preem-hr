/**
 * Complete Payroll Calculation Service (V2 - Multi-Country)
 *
 * Database-driven payroll calculation that supports multiple countries.
 * Replaces hardcoded constants with configuration loaded from database.
 *
 * Calculation Flow:
 * 1. Load country configuration from database
 * 2. Calculate gross salary (base + allowances + overtime + bonuses)
 * 3. Calculate social security contributions (database-driven)
 * 4. Calculate tax using progressive strategy (database-driven)
 * 5. Calculate net salary and employer costs
 */

import type {
  PayrollCalculationInput,
  PayrollCalculationResult,
} from '../types';
import type { SalaryComponentInstance } from '@/features/employees/types/salary-components';
import { calculateGrossSalary } from './gross-calculation';
import { loadPayrollConfig, ProgressiveMonthlyTaxStrategy } from '@/features/payroll-config';
import { calculateBankingSeniorityBonus } from '@/features/conventions/services/banking-convention.service';
import { ruleLoader } from './rule-loader';
import { db } from '@/lib/db';
import { employeeSiteAssignments, locations, employees, tenants, payrollRuns, payrollLineItems } from '@/lib/db/schema';
import { and, eq, gte, lte, lt } from 'drizzle-orm';
import { ComponentProcessor, componentDefinitionCache } from '@/lib/salary-components';
import {
  isJournalier,
  calculateHourlyRate,
  calculateHourlyDivisor,
  classifyOvertime,
  calculateEquivalentDays,
  calculateContributionEmployeur,
  type PaymentFrequency,
  type WeeklyHoursRegime,
  type EmployeeType,
} from './daily-workers-utils';
import {
  calculateDailyWorkersGross,
  calculateProratedDeductions,
  calculateDailyITS,
  type DailyWorkersGrossInput,
} from './daily-workers-calculation';

export interface PayrollCalculationInputV2 extends PayrollCalculationInput {
  countryCode: string; // Required for loading config
  tenantId?: string; // Required for tenant-specific component overrides
  fiscalParts?: number; // For tax deductions (1.0, 1.5, 2.0, etc.)
  sectorCode?: string; // For sector-specific contributions
  workAccidentRate?: number; // CNPS-provided work accident rate (overrides sector-based rate)
  seniorityBonus?: number; // Seniority bonus from components
  familyAllowance?: number; // Family allowance from components
  salaireCategoriel?: number; // Code 11 - Base for CNPS Family/Accident (CI)
  sursalaire?: number; // Code 12 - Additional fixed component (CI)
  otherAllowances?: Array<{ code: string; name: string; amount: number; taxable: boolean }>; // Template components (TPT_*, PHONE, etc.)
  customComponents?: SalaryComponentInstance[]; // Custom components for future use

  // CMU calculation (GAP-CMU-001)
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed'; // For dynamic CMU calculation
  dependentChildren?: number; // Number of children under 21 (for CMU)

  // Rate type support (GAP-JOUR-003)
  rateType?: 'MONTHLY' | 'DAILY' | 'HOURLY'; // Payment frequency
  daysWorkedThisMonth?: number; // For DAILY workers
  hoursWorkedThisMonth?: number; // For HOURLY workers

  // Daily workers support (Phase 2)
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'; // Orthogonal to contract type
  weeklyHoursRegime?: '40h' | '44h' | '48h' | '52h' | '56h'; // For hourly divisor and OT threshold
  employeeType?: 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE'; // For contribution employeur + ITS employer rate
  contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'; // For CDDTI-specific components
  saturdayHours?: number; // Hours worked on Saturday (1.40× multiplier)
  sundayHours?: number; // Hours worked on Sunday/holiday (1.40× multiplier)
  nightHours?: number; // Hours worked at night 21h-5h (1.75× multiplier)
  dailyTransportRate?: number; // Transport rate per day (FCFA)

  // Banking convention support (GAP-CONV-BANK-001)
  conventionCode?: string; // 'INTERPRO', 'BANKING', 'BTP'
  professionalLevel?: number; // 1-9 for banking sector

  // Seniority calculation (for component processing)
  yearsOfService?: number; // Pre-calculated years of service

  // Preview mode (for hiring flow before component activation)
  isPreview?: boolean; // If true, use safe defaults for unknown components

  // Cumulative brut imposable for CDDTI AT/PF ceiling (75,000 FCFA/month)
  cumulativeBrutImposableThisMonth?: number; // Sum of brut_imposable from previous approved runs in same month

  // @deprecated Use employeeType instead (GAP-ITS-JOUR-002)
  // ITS employer tax calculation - kept for backward compatibility, maps to employeeType
  isExpat?: boolean; // If true, maps to employeeType='EXPAT'; otherwise employeeType='LOCAL'
}

/**
 * Convert individual allowance fields to component instances
 *
 * For backward compatibility with code that uses individual fields
 * (baseSalary, transportAllowance, etc.) instead of components array.
 *
 * @param input - Payroll calculation input
 * @returns Array of component instances
 */
function convertAllowancesToComponents(
  input: PayrollCalculationInputV2
): SalaryComponentInstance[] {
  const components: SalaryComponentInstance[] = [];

  // Base salary (Code 11)
  if (input.baseSalary > 0) {
    components.push({
      code: '11',
      name: 'Salaire de base',
      amount: input.baseSalary,
      sourceType: 'standard',
    });
  }

  // Seniority bonus (Code 21) - if provided
  if (input.seniorityBonus && input.seniorityBonus > 0) {
    components.push({
      code: '21',
      name: "Prime d'ancienneté",
      amount: input.seniorityBonus,
      sourceType: 'standard',
    });
  }

  // Transport allowance (Code 22)
  if (input.transportAllowance && input.transportAllowance > 0) {
    components.push({
      code: '22',
      name: 'Prime de transport',
      amount: input.transportAllowance,
      sourceType: 'standard',
    });
  }

  // Housing allowance (Code 23)
  if (input.housingAllowance && input.housingAllowance > 0) {
    components.push({
      code: '23',
      name: 'Indemnité de logement',
      amount: input.housingAllowance,
      sourceType: 'standard',
    });
  }

  // Meal allowance (Code 24)
  if (input.mealAllowance && input.mealAllowance > 0) {
    components.push({
      code: '24',
      name: 'Indemnité de repas',
      amount: input.mealAllowance,
      sourceType: 'standard',
    });
  }

  // Family allowance (Code 41)
  if (input.familyAllowance && input.familyAllowance > 0) {
    components.push({
      code: '41',
      name: 'Allocations familiales',
      amount: input.familyAllowance,
      sourceType: 'standard',
    });
  }

  // Other allowances (from template components)
  if (input.otherAllowances && input.otherAllowances.length > 0) {
    for (const allowance of input.otherAllowances) {
      components.push({
        code: allowance.code, // Use actual component code (e.g., TPT_TRANSPORT_CI)
        name: allowance.name,
        amount: allowance.amount,
        sourceType: 'standard', // Template components are always 'standard'
      });
    }
  }

  // Custom components (if provided)
  if (input.customComponents && input.customComponents.length > 0) {
    // For CDDTI workers, convert MONTHLY stored values to period-based amounts
    // ✅ NEW LOGIC: All values stored as MONTHLY, convert based on contract type
    const isCDDTI = input.contractType === 'CDDTI';

    if (isCDDTI && input.hoursWorkedThisMonth) {
      const multipliedComponents = input.customComponents.map(comp => {
        // ✅ IMPORTANT: Transport is based on presence days, NOT hours
        // Per user feedback (2025-11-03): "Les jours sont uniquement utilisés pour l'indemnité de transport"
        const isTransport = comp.code === '22' || comp.code === 'TPT_TRANSPORT_CI' || comp.code.toLowerCase().includes('transport');

        if (isTransport && input.daysWorkedThisMonth !== undefined) {
          // Transport: convert MONTHLY → daily rate, then × presence days
          // Monthly amount stored in DB (e.g., 30,000 FCFA/mois)
          // Convert to daily: 30,000 / 26 = 1,154 FCFA/jour (26 working days/month)
          // Multiply by days worked: 1,154 × 15 = 17,310 FCFA
          const dailyRate = Math.round(comp.amount / 26);
          const transportAmount = Math.round(dailyRate * input.daysWorkedThisMonth);
          console.log(`[TRANSPORT COMPONENT] ${comp.code}: ${comp.amount} FCFA/mois → ${dailyRate} FCFA/jour × ${input.daysWorkedThisMonth} days = ${transportAmount} FCFA`);
          return {
            ...comp,
            amount: transportAmount,
          };
        } else {
          // Salary components: convert MONTHLY → hourly rate, then × hours worked
          // Monthly amount stored in DB (e.g., 100,000 FCFA/mois)
          // Convert to hourly: 100,000 / 173.33 = 577 FCFA/heure
          // Multiply by hours worked: 577 × 120 = 69,240 FCFA
          const weeklyHours = input.weeklyHoursRegime === '40h' ? 40 :
                              input.weeklyHoursRegime === '44h' ? 44 :
                              input.weeklyHoursRegime === '48h' ? 48 :
                              input.weeklyHoursRegime === '52h' ? 52 :
                              input.weeklyHoursRegime === '56h' ? 56 : 40;
          const monthlyHoursDivisor = (weeklyHours * 52) / 12; // e.g., 173.33 for 40h
          const hourlyRate = comp.amount / monthlyHoursDivisor;
          const componentAmount = Math.round(hourlyRate * input.hoursWorkedThisMonth!);
          console.log(`[SALARY COMPONENT] ${comp.code}: ${comp.amount} FCFA/mois → ${hourlyRate.toFixed(2)} FCFA/h × ${input.hoursWorkedThisMonth} hours = ${componentAmount} FCFA`);
          return {
            ...comp,
            amount: componentAmount,
          };
        }
      });
      components.push(...multipliedComponents);
      console.log(`[CDDTI COMPONENTS] Converted ${input.customComponents.length} monthly components to period amounts (${input.hoursWorkedThisMonth} hours, ${input.daysWorkedThisMonth || 0} days)`);
    } else {
      // Non-CDDTI workers: use monthly amounts as-is
      components.push(...input.customComponents);
    }
  }

  return components;
}

/**
 * Calculate location-based allowances for an employee for a payroll period (GAP-LOC-001)
 *
 * Aggregates transport, meal, and site premium allowances from all locations
 * where the employee worked during the payroll period.
 *
 * @param employeeId - Employee UUID
 * @param periodStart - Start date of payroll period
 * @param periodEnd - End date of payroll period
 * @returns Aggregated location-based allowances
 */
async function calculateLocationBasedAllowances(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  allowances: Array<{
    locationName: string;
    locationCode: string;
    days: number;
    transportAllowance: number;
    mealAllowance: number;
    sitePremium: number;
    hazardPay: number;
  }>;
  totalTransport: number;
  totalMeal: number;
  totalSitePremium: number;
  totalHazardPay: number;
}> {
  try {
    // PREVIEW MODE: If employeeId is 'preview', return empty allowances (no site assignments)
    if (employeeId === 'preview') {
      return {
        allowances: [],
        totalTransport: 0,
        totalMeal: 0,
        totalSitePremium: 0,
        totalHazardPay: 0,
      };
    }

    // Format dates for database query
    const startDateStr = periodStart.toISOString().split('T')[0];
    const endDateStr = periodEnd.toISOString().split('T')[0];

    // Get all site assignments for the period
    const assignments = await db
      .select({
        assignmentDate: employeeSiteAssignments.assignmentDate,
        locationId: employeeSiteAssignments.locationId,
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        transportAllowance: locations.transportAllowance,
        mealAllowance: locations.mealAllowance,
        sitePremium: locations.sitePremium,
        hazardPayRate: locations.hazardPayRate,
      })
      .from(employeeSiteAssignments)
      .leftJoin(locations, eq(employeeSiteAssignments.locationId, locations.id))
      .where(
        and(
          eq(employeeSiteAssignments.employeeId, employeeId),
          gte(employeeSiteAssignments.assignmentDate, startDateStr),
          lte(employeeSiteAssignments.assignmentDate, endDateStr)
        )
      );

    if (assignments.length === 0) {
      return {
        allowances: [],
        totalTransport: 0,
        totalMeal: 0,
        totalSitePremium: 0,
        totalHazardPay: 0,
      };
    }

    // Group by location and count days
    const locationDays: Record<string, {
      locationName: string;
      locationCode: string;
      days: number;
      transportAllowance: string;
      mealAllowance: string;
      sitePremium: string;
      hazardPayRate: string;
    }> = {};

    assignments.forEach((assignment) => {
      if (!assignment.locationId) return;

      const locationId = assignment.locationId;

      if (!locationDays[locationId]) {
        locationDays[locationId] = {
          locationName: assignment.locationName || '',
          locationCode: assignment.locationCode || '',
          days: 0,
          transportAllowance: assignment.transportAllowance || '0',
          mealAllowance: assignment.mealAllowance || '0',
          sitePremium: assignment.sitePremium || '0',
          hazardPayRate: assignment.hazardPayRate || '0',
        };
      }
      locationDays[locationId].days += 1;
    });

    // Calculate allowances per location
    const allowances = Object.values(locationDays).map((loc) => {
      const transportPerDay = Number(loc.transportAllowance || 0);
      const mealPerDay = Number(loc.mealAllowance || 0);
      const sitePremiumMonthly = Number(loc.sitePremium || 0);

      // Transport and meal are daily, multiplied by days worked
      const transportAllowance = Math.round(transportPerDay * loc.days);
      const mealAllowance = Math.round(mealPerDay * loc.days);

      // Site premium is monthly (not prorated by days)
      const sitePremium = Math.round(sitePremiumMonthly);

      // Hazard pay will be calculated in main function (percentage of base salary)
      const hazardPay = 0;

      return {
        locationName: loc.locationName,
        locationCode: loc.locationCode,
        days: loc.days,
        transportAllowance,
        mealAllowance,
        sitePremium,
        hazardPay,
      };
    });

    // Calculate totals
    const totals = {
      totalTransport: allowances.reduce((sum, a) => sum + a.transportAllowance, 0),
      totalMeal: allowances.reduce((sum, a) => sum + a.mealAllowance, 0),
      totalSitePremium: allowances.reduce((sum, a) => sum + a.sitePremium, 0),
      totalHazardPay: 0, // Will be calculated in main function if needed
    };

    return {
      allowances,
      ...totals,
    };
  } catch (error) {
    // If error (e.g., employee has no site assignments), return empty allowances
    console.error('[calculateLocationBasedAllowances] Error:', error);
    return {
      allowances: [],
      totalTransport: 0,
      totalMeal: 0,
      totalSitePremium: 0,
      totalHazardPay: 0,
    };
  }
}

/**
 * Query cumulative brut imposable from previous approved payroll runs in the same month
 *
 * Used for CDDTI workers to enforce 75,000 FCFA cumulative monthly ceiling on AT/PF contributions.
 *
 * @param employeeId - Employee UUID
 * @param currentPeriodStart - Start date of current payroll period
 * @returns Cumulative brut imposable from previous approved runs in same month
 *
 * @example
 * ```typescript
 * // Week 3 of January for CDDTI worker
 * const cumulative = await queryCumulativeBrutImposable(
 *   'employee-uuid',
 *   new Date('2025-01-15')
 * );
 * // Returns sum of brut_imposable from Week 1 + Week 2 (approved runs only)
 * ```
 */
async function queryCumulativeBrutImposable(
  employeeId: string,
  currentPeriodStart: Date
): Promise<number> {
  // Get first day of the month
  const monthStart = new Date(currentPeriodStart);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Query previous approved payroll runs in the same month (before current period)
  const previousRuns = await db
    .select({
      brutImposable: payrollLineItems.brutImposable,
    })
    .from(payrollLineItems)
    .innerJoin(
      payrollRuns,
      eq(payrollLineItems.payrollRunId, payrollRuns.id)
    )
    .where(
      and(
        eq(payrollLineItems.employeeId, employeeId),
        gte(payrollRuns.periodStart, monthStart.toISOString()),
        lt(payrollRuns.periodStart, currentPeriodStart.toISOString()),
        eq(payrollRuns.status, 'approved') // Only count approved runs
      )
    );

  const cumulative = previousRuns.reduce(
    (sum, run) => sum + Number(run.brutImposable || 0),
    0
  );

  console.log(
    `[CDDTI CUMULATIVE] Employee ${employeeId}, month ${monthStart.toISOString().slice(0, 7)}: ` +
    `${previousRuns.length} previous approved runs, cumulative = ${cumulative.toLocaleString('fr-FR')} FCFA`
  );

  return cumulative;
}

/**
 * Calculate complete payroll for an employee (V2 - Multi-Country)
 *
 * This version loads payroll rules from the database based on country code,
 * making it suitable for multi-country deployments.
 *
 * @param input - Payroll calculation input with country code
 * @returns Complete payroll calculation with detailed breakdown
 *
 * @example
 * ```typescript
 * // Côte d'Ivoire employee
 * const resultCI = await calculatePayrollV2({
 *   employeeId: '123',
 *   countryCode: 'CI',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 300000,
 *   fiscalParts: 1.0,
 *   sectorCode: 'services',
 * });
 *
 * // Senegal employee (when Senegal rules are added)
 * const resultSN = await calculatePayrollV2({
 *   employeeId: '456',
 *   countryCode: 'SN',
 *   periodStart: new Date('2025-01-01'),
 *   periodEnd: new Date('2025-01-31'),
 *   baseSalary: 250000,
 * });
 * ```
 */
export async function calculatePayrollV2(
  input: PayrollCalculationInputV2
): Promise<PayrollCalculationResult> {
  // ========================================
  // STEP 0: Load Country Configuration
  // ========================================
  const config = await loadPayrollConfig(
    input.countryCode,
    input.periodStart
  );

  // ========================================
  // STEP 0.1: Initialize Component Processor (Database-Driven)
  // ========================================
  const componentProcessor = new ComponentProcessor(componentDefinitionCache);

  // ========================================
  // STEP 0.2: Gather All Salary Components
  // ========================================
  // Convert individual allowance fields to component instances (backward compatibility)
  const allComponents = convertAllowancesToComponents(input);

  // Calculate total remuneration for percentage-based caps
  // (needed before processing components)
  const totalRemuneration = allComponents.reduce((sum, c) => sum + c.amount, 0);

  console.log(`[COMPONENT PROCESSING] Total components: ${allComponents.length}, Total remuneration: ${totalRemuneration.toLocaleString('fr-FR')} FCFA`);
  console.log(`[COMPONENT PROCESSING] tenantId received: ${input.tenantId || 'NONE'}`);

  // ========================================
  // STEP 0.3: Validate Transport Allowance Against City Minimum
  // ========================================
  // Skip validation in preview mode (Q2 onboarding)
  if (input.employeeId !== 'preview') {
    // Fetch employee's primary location to determine city
    const [employee] = await db
      .select({
        primaryLocationId: employees.primaryLocationId,
      })
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);

    if (employee?.primaryLocationId) {
      // Get location details
      const [employeeLocation] = await db
        .select({
          city: locations.city,
          locationName: locations.locationName,
        })
        .from(locations)
        .where(eq(locations.id, employee.primaryLocationId))
        .limit(1);

      if (employeeLocation?.city) {
        // Get city transport minimum
        try {
          const cityMinimum = await ruleLoader.getCityTransportMinimum(
            input.countryCode,
            employeeLocation.city,
            input.periodStart
          );

          // Check transport allowance from both old field-based approach and new component-based approach
          // Transport component has code '22'
          const transportFromComponent = allComponents.find(c => c.code === '22')?.amount || 0;
          const totalTransport = transportFromComponent || (input.transportAllowance || 0);

          // ✅ NEW: Transport is always stored as MONTHLY amount now (no conversion needed)
          // Example: totalTransport = 30,000 FCFA/mois (from DB)
          //          cityMinimum.monthlyMinimum = 30,000 FCFA/mois (from rules)

          // Validate transport meets minimum (only for MONTHLY workers)
          const isNonMonthlyWorker =
            input.paymentFrequency &&
            ['DAILY', 'WEEKLY', 'BIWEEKLY'].includes(input.paymentFrequency);

          if (!isNonMonthlyWorker && totalTransport < cityMinimum.monthlyMinimum) {
            const cityName = cityMinimum.displayName?.fr || cityMinimum.cityName;
            throw new Error(
              `L'indemnité de transport (${totalTransport.toLocaleString('fr-FR')} FCFA/mois) est inférieure au minimum légal pour ${cityName} (${cityMinimum.monthlyMinimum.toLocaleString('fr-FR')} FCFA/mois). Référence: ${cityMinimum.legalReference?.fr || 'Arrêté du 30 janvier 2020'}`
            );
          } else if (isNonMonthlyWorker) {
            console.log(`[TRANSPORT VALIDATION] Skipping monthly minimum check for ${input.paymentFrequency} worker - prorated amount is valid`);
          }
        } catch (error) {
          // If city minimum not configured, log warning but don't fail
          if (error instanceof Error && error.message.includes('No transport minimums configured')) {
            console.warn(`Transport minimum not configured for country ${input.countryCode}, skipping validation`);
          } else {
            // Re-throw validation errors
            throw error;
          }
        }
      }
    }
  }

  // ========================================
  // STEP 0.5: Calculate Banking Seniority Bonus (GAP-CONV-BANK-001)
  // ========================================
  let bankingSeniorityBonus = 0;
  if (input.conventionCode === 'BANKING' && input.hireDate) {
    const bonusResult = await calculateBankingSeniorityBonus(
      input.baseSalary,
      input.hireDate,
      input.countryCode
    );
    bankingSeniorityBonus = bonusResult.bonusAmount;
  }

  // ========================================
  // STEP 0.6: Calculate Location-Based Allowances (GAP-LOC-001)
  // ========================================
  const locationAllowances = await calculateLocationBasedAllowances(
    input.employeeId,
    input.periodStart,
    input.periodEnd
  );

  // ========================================
  // STEP 0.7: Process Components with Metadata-Driven Rules
  // ========================================

  // Get employee's city for city-based caps (e.g., transport exemption)
  let employeeCity: string | undefined;
  if (input.employeeId !== 'preview') {
    try {
      const [employee] = await db
        .select({
          primaryLocationId: employees.primaryLocationId,
        })
        .from(employees)
        .where(eq(employees.id, input.employeeId))
        .limit(1);

      if (employee?.primaryLocationId) {
        const [employeeLocation] = await db
          .select({
            city: locations.city,
          })
          .from(locations)
          .where(eq(locations.id, employee.primaryLocationId))
          .limit(1);

        employeeCity = employeeLocation?.city ?? undefined;
      }
    } catch (error) {
      console.warn('[COMPONENT PROCESSING] Could not fetch employee city:', error);
    }
  }

  // Process all components through metadata-driven processor
  // This will apply tenant overrides if tenantId is provided
  const processedComponents = await componentProcessor.processComponents(
    allComponents,
    {
      totalRemuneration,
      baseSalary: input.baseSalary,
      countryCode: input.countryCode,
      city: employeeCity,
      effectiveDate: input.periodStart,
      tenantId: input.tenantId, // Enables tenant-specific overrides
      hireDate: input.hireDate,
      yearsOfService: input.yearsOfService,
      isPreview: input.isPreview, // Use safe defaults for unknown components in preview mode
      paymentFrequency: input.paymentFrequency, // For transport validation
      weeklyHoursRegime: input.weeklyHoursRegime, // For transport calculation
      contractType: input.contractType, // For CDDTI detection
    }
  );

  // Check for validation errors
  const componentErrors = processedComponents.flatMap((c) => c.errors ?? []);
  if (componentErrors.length > 0) {
    throw new Error(`Component validation failed: ${componentErrors.join('; ')}`);
  }

  // Log component processing results
  console.log('[COMPONENT PROCESSING] Results:');
  for (const pc of processedComponents) {
    if (pc.capApplied) {
      console.log(`  ${pc.name}: ${pc.originalAmount.toLocaleString('fr-FR')} → Exempt: ${pc.exemptPortion.toLocaleString('fr-FR')}, Taxable: ${pc.taxablePortion.toLocaleString('fr-FR')}`);
      console.log(`    Cap: ${pc.capApplied.reason}`);
    } else {
      console.log(`  ${pc.name}: ${pc.originalAmount.toLocaleString('fr-FR')} (${pc.taxablePortion > 0 ? 'taxable' : 'exempt'})`);
    }
  }

  // ========================================
  // STEP 0.8: Calculate Metadata-Driven Bases
  // ========================================

  // Total Gross = Sum of all component amounts
  let totalGrossFromComponents = processedComponents.reduce(
    (sum, c) => sum + c.originalAmount,
    0
  );

  // Brut Imposable = Sum of taxable portions of components marked as includeInBrutImposable
  let brutImposableFromComponents = processedComponents
    .filter((c) => c.includeInBrutImposable)
    .reduce((sum, c) => sum + c.taxablePortion, 0);

  // Salaire Catégoriel = Sum of components marked as includeInSalaireCategoriel (CI only)
  let salaireCategorielFromComponents = processedComponents
    .filter((c) => c.includeInSalaireCategoriel)
    .reduce((sum, c) => sum + c.originalAmount, 0);

  // CNPS Base = Sum of components marked as includeInCnpsBase
  let cnpsBaseFromComponents = processedComponents
    .filter((c) => c.includeInCnpsBase)
    .reduce((sum, c) => sum + c.originalAmount, 0);

  console.log('[COMPONENT PROCESSING] Calculated bases:');
  console.log(`  Total Gross: ${totalGrossFromComponents.toLocaleString('fr-FR')} FCFA`);
  console.log(`  Brut Imposable: ${brutImposableFromComponents.toLocaleString('fr-FR')} FCFA`);
  console.log(`  Salaire Catégoriel: ${salaireCategorielFromComponents.toLocaleString('fr-FR')} FCFA`);
  console.log(`  CNPS Base: ${cnpsBaseFromComponents.toLocaleString('fr-FR')} FCFA`);

  // ========================================
  // STEP 0.8: Add CDDTI Components (if applicable)
  // ========================================
  // For CDDTI contracts with component-based approach, add CDDTI-specific components
  const isComponentBasedCDDTI =
    input.contractType === 'CDDTI' &&
    allComponents.length > 0 &&
    input.baseSalary === 0;

  if (isComponentBasedCDDTI) {
    console.log('[CDDTI COMPONENTS] Adding CDDTI-specific components');

    // Calculate brut base (total gross before CDDTI components)
    // ⚠️ CRITICAL: Exclude transport from brutBase per official document
    // Transport is added AFTER calculating CDDTI components, not included in the base
    // Official doc structure: Base (3,464) → +Grat (216) → +Congés (376) → +Précarité (121) = Salaire Brut (4,177)
    // Then SEPARATELY: +Transport (1,154) = Total (5,331)
    const transportCodes = ['22', 'TPT_TRANSPORT_CI', 'TRANSPORT'];
    const brutBase = processedComponents
      .filter((c) => !transportCodes.includes(c.code))
      .reduce((sum, c) => sum + c.originalAmount, 0);

    // CDDTI-specific rates (derived from official formulas)
    // Source: SALAIRE TYPE JOURNALIER NOUVEAU 2023.txt
    // Gratification: (Monthly × 0.75) / (12 × 173.33) = Hourly × 0.0625
    // Congés payés: (Base + Grat) × 8 × 2.2 / 173.33 = (Base + Grat) × 0.10153
    // Précarité: (Base + Grat + Congés) × 3%
    const gratificationRate = 0.0625; // 6.25% - Prime de 75% répartie sur l'année
    const congesPayesRate = 0.10153; // 10.153% - Provision 2.2 jours/mois
    const indemnitePrecariteRate = 0.03; // 3% (CDDTI only)

    // Calculate CDDTI component amounts
    const gratification = Math.round(brutBase * gratificationRate);
    const congesPayes = Math.round((brutBase + gratification) * congesPayesRate);
    const indemnitPrecarite = Math.round((brutBase + gratification + congesPayes) * indemnitePrecariteRate);

    console.log(`[CDDTI COMPONENTS] Brut base: ${brutBase.toLocaleString('fr-FR')} FCFA`);
    console.log(`[CDDTI COMPONENTS] Gratification (6.25%): ${gratification.toLocaleString('fr-FR')} FCFA`);
    console.log(`[CDDTI COMPONENTS] Congés payés (10.15%): ${congesPayes.toLocaleString('fr-FR')} FCFA`);
    console.log(`[CDDTI COMPONENTS] Indemnité de précarité (3% of ${(brutBase + gratification + congesPayes).toLocaleString('fr-FR')}): ${indemnitPrecarite.toLocaleString('fr-FR')} FCFA`);

    // Add to allComponents (which will be processed later)
    // Use database component codes: GRAT_JOUR, CONGE_JOUR, PREC_JOUR
    allComponents.push(
      {
        code: 'GRAT_JOUR',
        name: 'Prime de gratification',
        amount: gratification,
        sourceType: 'standard',
      },
      {
        code: 'CONGE_JOUR',
        name: 'Provision congés payés',
        amount: congesPayes,
        sourceType: 'standard',
      },
      {
        code: 'PREC_JOUR',
        name: 'Indemnité de précarité',
        amount: indemnitPrecarite,
        sourceType: 'standard',
      }
    );

    // Re-process components to include CDDTI components
    const cddtiProcessedComponents = await componentProcessor.processComponents(
      allComponents,
      {
        tenantId: input.tenantId || '',
        countryCode: input.countryCode,
        baseSalary: brutBase,
        totalRemuneration: brutBase + gratification + congesPayes + indemnitPrecarite,
        effectiveDate: input.periodStart,
        paymentFrequency: input.paymentFrequency,
        weeklyHoursRegime: input.weeklyHoursRegime,
        contractType: input.contractType,
      }
    );

    // Replace processedComponents with the new list
    processedComponents.splice(0, processedComponents.length, ...cddtiProcessedComponents);

    console.log(`[CDDTI COMPONENTS] Reprocessed components: ${processedComponents.length} total`);

    // Recalculate bases with CDDTI components included
    const oldTotalGross = totalGrossFromComponents;
    totalGrossFromComponents = processedComponents.reduce((sum, c) => sum + c.originalAmount, 0);
    brutImposableFromComponents = processedComponents
      .filter((c) => c.includeInBrutImposable)
      .reduce((sum, c) => sum + c.taxablePortion, 0);
    salaireCategorielFromComponents = processedComponents
      .filter((c) => c.includeInSalaireCategoriel)
      .reduce((sum, c) => sum + c.originalAmount, 0);
    cnpsBaseFromComponents = processedComponents
      .filter((c) => c.includeInCnpsBase)
      .reduce((sum, c) => sum + c.originalAmount, 0);

    console.log(`[CDDTI COMPONENTS] Recalculated bases:`);
    console.log(`  New Total Gross: ${totalGrossFromComponents.toLocaleString('fr-FR')} FCFA (was ${oldTotalGross.toLocaleString('fr-FR')})`);
    console.log(`  New Brut Imposable: ${brutImposableFromComponents.toLocaleString('fr-FR')} FCFA`);
    console.log(`  New CNPS Base: ${cnpsBaseFromComponents.toLocaleString('fr-FR')} FCFA`);
  }

  // ========================================
  // STEP 0.9: Detect Daily Workers (Journaliers) and Apply Special Calculation
  // ========================================
  const isJournalierEmployee = input.paymentFrequency ? isJournalier(input.paymentFrequency) : false;

  // Journalier-specific variables (used later if isJournalierEmployee = true)
  let journalierGrossResult: ReturnType<typeof calculateDailyWorkersGross> | null = null;
  let journalierEquivalentDays = 0;

  if (isJournalierEmployee) {
    console.log('[JOURNALIER CALCULATION] Detected daily/weekly/biweekly worker');

    // Only use calculateDailyWorkersGross if using old field-based approach (baseSalary > 0)
    // Component-based approach will use simpler multiplication
    const usingComponentBasedApproach = allComponents.length > 0 && input.baseSalary === 0;

    if (!usingComponentBasedApproach && input.baseSalary > 0) {
      console.log('[JOURNALIER CALCULATION] Using legacy field-based calculation (calculateDailyWorkersGross)');

      // Get tenant's daily transport rate if not provided
      let dailyTransportRate = input.dailyTransportRate ?? 0;
      if (!dailyTransportRate && input.tenantId) {
        const [tenantData] = await db
          .select({
            defaultDailyTransportRate: tenants.defaultDailyTransportRate,
          })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        dailyTransportRate = Number(tenantData?.defaultDailyTransportRate ?? 0);
      }

      // Calculate gross using daily workers formula
      const hoursWorked = input.hoursWorkedThisMonth ||
                         (typeof input.overtimeHours === 'number' ? input.overtimeHours : 0) ||
                         0;

      const dailyWorkersInput: DailyWorkersGrossInput = {
        categoricalSalary: input.baseSalary,
        hoursWorked,
        weeklyHoursRegime: input.weeklyHoursRegime || '40h',
        contractType: input.contractType || 'CDD',
        dailyTransportRate,
        presenceDays: input.daysWorkedThisMonth, // ✅ Pass actual presence days for transport
        saturdayHours: input.saturdayHours,
        sundayHours: input.sundayHours,
        nightHours: input.nightHours,
      };

      journalierGrossResult = calculateDailyWorkersGross(dailyWorkersInput);
      journalierEquivalentDays = journalierGrossResult.equivalentDays;

      console.log('[JOURNALIER CALCULATION] Gross calculation complete:');
      console.log(`  Total Brut: ${journalierGrossResult.totalBrut.toLocaleString('fr-FR')} FCFA`);
      console.log(`  Equivalent Days: ${journalierEquivalentDays}`);
      console.log(`  Hourly Rate: ${journalierGrossResult.hourlyRate.toLocaleString('fr-FR')} FCFA`);
    } else {
      console.log('[JOURNALIER CALCULATION] Using component-based approach - components will be multiplied by hours');
      // Calculate equivalent days from hours worked
      const hoursWorked = input.hoursWorkedThisMonth || 0;
      journalierEquivalentDays = hoursWorked > 0 ? calculateEquivalentDays(hoursWorked) : 0;

      // For CDDTI contracts, we still need to calculate CDDTI-specific components
      if (input.contractType === 'CDDTI') {
        console.log('[JOURNALIER CALCULATION] CDDTI contract detected - will add CDDTI components after gross calculation');
      }
    }
  }

  // ========================================
  // STEP 1: Calculate Gross Salary (Rate Type Aware)
  // ========================================

  // Determine effective base salary and allowances based on rate type
  let effectiveBaseSalary = input.baseSalary;
  let effectiveSalaireCategoriel = input.salaireCategoriel;
  let effectiveTransportAllowance = input.transportAllowance;
  let effectiveHousingAllowance = input.housingAllowance;
  let effectiveMealAllowance = input.mealAllowance;
  let effectiveSeniorityBonus = input.seniorityBonus;
  let effectiveFamilyAllowance = input.familyAllowance;
  const rateType = input.rateType || 'MONTHLY';

  if (rateType === 'DAILY') {
    // Daily workers: multiply daily rate × days worked
    const daysWorked = input.daysWorkedThisMonth || 0;

    console.log(`[DAILY WORKER PRORATION] Days worked: ${daysWorked}`);
    console.log(`[DAILY WORKER PRORATION] Base salary (daily rate): ${input.baseSalary} → ${input.baseSalary * daysWorked}`);

    // Base salary and salaireCategoriel are stored as DAILY rates
    effectiveBaseSalary = input.baseSalary * daysWorked;
    if (effectiveSalaireCategoriel) {
      effectiveSalaireCategoriel = effectiveSalaireCategoriel * daysWorked;
    }

    // Allowances are stored as MONTHLY amounts
    // Convert to daily rate then multiply by days worked
    if (effectiveTransportAllowance) {
      const originalTransport = effectiveTransportAllowance;
      // Transport: ÷26 (working days per month per CI labor law)
      effectiveTransportAllowance = (effectiveTransportAllowance / 26) * daysWorked;
      console.log(`[DAILY WORKER PRORATION] Transport: ${originalTransport} (monthly) → ${effectiveTransportAllowance} (${daysWorked} days)`);
    }
    // Other allowances: ÷30 (calendar days)
    if (effectiveHousingAllowance) {
      effectiveHousingAllowance = (effectiveHousingAllowance / 30) * daysWorked;
    }
    if (effectiveMealAllowance) {
      effectiveMealAllowance = (effectiveMealAllowance / 30) * daysWorked;
    }
    if (effectiveSeniorityBonus) {
      effectiveSeniorityBonus = (effectiveSeniorityBonus / 30) * daysWorked;
    }
    if (effectiveFamilyAllowance) {
      effectiveFamilyAllowance = (effectiveFamilyAllowance / 30) * daysWorked;
    }
  } else if (rateType === 'HOURLY') {
    // Hourly workers: multiply hourly rate × hours worked
    const hoursWorked = input.hoursWorkedThisMonth || 0;

    // Calculate monthly hours based on actual weekly regime (not fixed 173.33)
    const weeklyHours = input.weeklyHoursRegime === '40h' ? 40 :
                        input.weeklyHoursRegime === '44h' ? 44 :
                        input.weeklyHoursRegime === '48h' ? 48 :
                        input.weeklyHoursRegime === '52h' ? 52 :
                        input.weeklyHoursRegime === '56h' ? 56 : 40;
    const monthlyHoursDivisor = (weeklyHours * 52) / 12;

    // Base salary and salaireCategoriel are stored as HOURLY rates
    effectiveBaseSalary = input.baseSalary * hoursWorked;
    if (effectiveSalaireCategoriel) {
      effectiveSalaireCategoriel = effectiveSalaireCategoriel * hoursWorked;
    }

    // Allowances are stored as MONTHLY amounts
    // Convert to hourly rate then multiply by hours worked
    // ⚠️  DEPRECATED: These separate allowance parameters should be in customComponents instead
    if (effectiveTransportAllowance) {
      // Transport: monthly / 26 working days, then × presence days
      const dailyRate = effectiveTransportAllowance / 26;
      effectiveTransportAllowance = Math.round(dailyRate * (input.daysWorkedThisMonth || 0));
    }
    if (effectiveHousingAllowance) {
      effectiveHousingAllowance = (effectiveHousingAllowance / monthlyHoursDivisor) * hoursWorked;
    }
    if (effectiveMealAllowance) {
      effectiveMealAllowance = (effectiveMealAllowance / monthlyHoursDivisor) * hoursWorked;
    }
    if (effectiveSeniorityBonus) {
      effectiveSeniorityBonus = (effectiveSeniorityBonus / monthlyHoursDivisor) * hoursWorked;
    }
    if (effectiveFamilyAllowance) {
      effectiveFamilyAllowance = (effectiveFamilyAllowance / monthlyHoursDivisor) * hoursWorked;
    }
  }
  // else: MONTHLY workers use values as-is

  // Prepare location-based allowances for gross calculation
  // Transport and meal allowances are typically non-taxable (up to legal limits)
  // Site premium is taxable income
  const locationOtherAllowances: Array<{ code: string; name: string; amount: number; taxable: boolean }> = [];

  if (locationAllowances.totalTransport > 0) {
    locationOtherAllowances.push({
      code: 'LOC_TRANSPORT',
      name: 'Indemnité de transport (multi-sites)',
      amount: locationAllowances.totalTransport,
      taxable: false, // Non-taxable up to 30,000 FCFA/month in CI
    });
  }

  if (locationAllowances.totalMeal > 0) {
    locationOtherAllowances.push({
      code: 'LOC_MEAL',
      name: 'Indemnité de repas (multi-sites)',
      amount: locationAllowances.totalMeal,
      taxable: false, // Non-taxable up to 30,000 FCFA/month in CI
    });
  }

  if (locationAllowances.totalSitePremium > 0) {
    locationOtherAllowances.push({
      code: 'LOC_SITE_PREMIUM',
      name: 'Prime de site',
      amount: locationAllowances.totalSitePremium,
      taxable: true, // Site premium is taxable
    });
  }

  // Prorate otherAllowances for daily/hourly workers
  // Template components (TPT_TRANSPORT_CI, etc.) are stored as monthly amounts
  let proratedOtherAllowances = input.otherAllowances || [];
  if (rateType === 'DAILY' && input.daysWorkedThisMonth) {
    console.log(`[DAILY WORKER PRORATION] Prorating ${proratedOtherAllowances.length} other allowances for ${input.daysWorkedThisMonth} days`);
    proratedOtherAllowances = proratedOtherAllowances.map(allowance => {
      // Transport uses 26 working days, other allowances use 30 calendar days
      const divisor = allowance.code.toLowerCase().includes('transport') ? 26 : 30;
      const proratedAmount = (allowance.amount / divisor) * input.daysWorkedThisMonth!;
      console.log(`[DAILY WORKER PRORATION] ${allowance.name}: ${allowance.amount} (monthly) → ${proratedAmount} (${input.daysWorkedThisMonth} days, divisor: ${divisor})`);
      return {
        ...allowance,
        amount: proratedAmount,
      };
    });
  } else if (rateType === 'HOURLY' && input.hoursWorkedThisMonth) {
    // Calculate monthly hours based on actual weekly regime, not fixed 173.33
    const weeklyHours = input.weeklyHoursRegime === '40h' ? 40 :
                        input.weeklyHoursRegime === '44h' ? 44 :
                        input.weeklyHoursRegime === '48h' ? 48 :
                        input.weeklyHoursRegime === '52h' ? 52 :
                        input.weeklyHoursRegime === '56h' ? 56 : 40;
    const monthlyHoursDivisor = (weeklyHours * 52) / 12;

    proratedOtherAllowances = proratedOtherAllowances.map(allowance => {
      // Transport uses days (÷26), other components use monthly hours
      if (allowance.code.toLowerCase().includes('transport')) {
        const dailyRate = allowance.amount / 26;
        const transportAmount = Math.round(dailyRate * (input.daysWorkedThisMonth || 0));
        return { ...allowance, amount: transportAmount };
      } else {
        const hourlyRate = allowance.amount / monthlyHoursDivisor;
        const componentAmount = Math.round(hourlyRate * input.hoursWorkedThisMonth!);
        return { ...allowance, amount: componentAmount };
      }
    });
  }

  // Merge with location-based allowances
  const combinedOtherAllowances = [
    ...proratedOtherAllowances,
    ...locationOtherAllowances,
  ];

  // For DAILY/HOURLY workers: Don't apply hire/termination proration
  // since we're already using actual days/hours worked from time entries
  const shouldApplyProration = rateType === 'MONTHLY';

  // IMPORTANT: When customComponents provided (onboarding preview), use component-based gross
  // Otherwise use legacy calculateGrossSalary with individual fields
  let grossSalary: number;
  let grossCalc: any;

  if (allComponents.length > 0) {
    if (isJournalierEmployee && journalierGrossResult) {
      // JOURNALIER: Use daily workers gross calculation
      grossSalary = journalierGrossResult.totalBrut;
      grossCalc = {
        totalGross: journalierGrossResult.totalBrut,
        baseSalary: journalierGrossResult.brutBase,
        proratedSalary: journalierGrossResult.brutBase,
        allowances: journalierGrossResult.totalBrut - journalierGrossResult.brutBase,
        overtimePay: journalierGrossResult.overtimeGross1 + journalierGrossResult.overtimeGross2 +
                     journalierGrossResult.saturdayGross + journalierGrossResult.sundayGross +
                     journalierGrossResult.nightGross,
        bonuses: 0,
        daysWorked: journalierEquivalentDays,
        daysInPeriod: 30,
        prorationFactor: journalierEquivalentDays / 30,
        breakdown: {
          base: journalierGrossResult.regularGross,
          allowances: journalierGrossResult.gratification + journalierGrossResult.congesPayes +
                      journalierGrossResult.indemnitPrecarite + journalierGrossResult.transportAllowance,
          overtime: journalierGrossResult.overtimeGross1 + journalierGrossResult.overtimeGross2 +
                    journalierGrossResult.saturdayGross + journalierGrossResult.sundayGross +
                    journalierGrossResult.nightGross,
          bonuses: 0,
        },
      };

      console.log('[JOURNALIER GROSS] Using daily workers calculation:');
      console.log(`  Total Gross: ${grossSalary.toLocaleString('fr-FR')} FCFA`);
      console.log(`  Equivalent Days: ${journalierEquivalentDays}`);
      console.log(`  Prorata: ${(journalierEquivalentDays / 30).toFixed(3)}`);
    } else {
      // Component-based approach: Use totalGrossFromComponents
      grossSalary = totalGrossFromComponents;

      // Calculate actual days in period
      const periodStart = new Date(input.periodStart);
      const periodEnd = new Date(input.periodEnd);
      const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // For CDDTI workers, show hours worked instead of days
      const daysWorked = input.contractType === 'CDDTI' && input.hoursWorkedThisMonth
        ? Math.round(input.hoursWorkedThisMonth / 8) // Convert hours to equivalent days for display
        : daysInPeriod;

      // Create a minimal grossCalc for backward compatibility
      grossCalc = {
        totalGross: totalGrossFromComponents,
        baseSalary: input.baseSalary || 0,
        proratedSalary: input.baseSalary || 0,
        allowances: totalGrossFromComponents - (input.baseSalary || 0),
        overtimePay: 0,
        bonuses: input.bonuses || 0,
        daysWorked,
        daysInPeriod,
        prorationFactor: daysWorked / daysInPeriod,
        breakdown: {
          base: input.baseSalary || 0,
          allowances: totalGrossFromComponents - (input.baseSalary || 0),
          overtime: 0,
          bonuses: input.bonuses || 0,
        },
      };
    }
  } else {
    // Legacy approach: Use individual fields
    grossCalc = calculateGrossSalary({
      employeeId: input.employeeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      baseSalary: effectiveBaseSalary, // Use rate-adjusted base salary
      hireDate: shouldApplyProration ? input.hireDate : undefined, // Only prorate for monthly workers
      terminationDate: shouldApplyProration ? input.terminationDate : undefined, // Only prorate for monthly workers
      housingAllowance: effectiveHousingAllowance, // Use rate-adjusted housing
      transportAllowance: effectiveTransportAllowance, // Use rate-adjusted transport
      mealAllowance: effectiveMealAllowance, // Use rate-adjusted meal
      seniorityBonus: (effectiveSeniorityBonus || 0) + bankingSeniorityBonus, // Use rate-adjusted seniority + banking bonus
      familyAllowance: effectiveFamilyAllowance || 0, // Use rate-adjusted family allowance
      otherAllowances: combinedOtherAllowances, // Include template + location components
      bonuses: input.bonuses,
      overtimeHours: input.overtimeHours,
      skipProration: !shouldApplyProration, // Skip period-based proration for daily/hourly workers (amounts already final)
    });
    grossSalary = grossCalc.totalGross;
  }

  // ========================================
  // STEP 1.5: Query Cumulative Brut Imposable for CDDTI Workers
  // ========================================
  // For CDDTI journaliers with multiple payroll runs per month, we need to track
  // cumulative brut imposable to enforce the 75,000 FCFA ceiling on AT/PF contributions.
  let cumulativeBrutImposable = input.cumulativeBrutImposableThisMonth;

  // Auto-query if not provided (and not preview mode)
  if (
    cumulativeBrutImposable === undefined &&
    input.contractType === 'CDDTI' &&
    input.employeeId !== 'preview'
  ) {
    cumulativeBrutImposable = await queryCumulativeBrutImposable(
      input.employeeId,
      input.periodStart
    );
  } else if (input.contractType !== 'CDDTI') {
    // Not CDDTI, no cumulative tracking needed
    cumulativeBrutImposable = undefined;
  }

  // ========================================
  // STEP 2: Calculate Social Security Contributions (Metadata-Driven Bases)
  // ========================================

  let cnpsEmployee: number;
  let cnpsEmployer: number;
  let cmuEmployee: number;
  let cmuEmployer: number;
  let contributionDetails: any[] = []; // Initialize to empty array to prevent undefined errors

  if (isJournalierEmployee && journalierGrossResult) {
    // JOURNALIER: Use prorated deductions
    // Use hardcoded rates for Côte d'Ivoire (simplification for now)
    const cnpsRate = 0.0367; // 3.67% CNPS employee
    const cmuFixed = 0; // IMPORTANT: Journaliers (DAILY workers) are NOT subject to CMU

    const proratedDeductions = calculateProratedDeductions(
      journalierGrossResult.totalBrut,
      journalierEquivalentDays,
      cnpsRate,
      cmuFixed
    );

    cnpsEmployee = proratedDeductions.cnpsEmployee;
    cmuEmployee = 0; // No CMU for journaliers (DAILY workers)

    // Employer contributions (not prorated - always on brutBase)
    const cnpsEmployerRate = 0.0767; // 7.67% CNPS employer
    cnpsEmployer = Math.round(journalierGrossResult.brutBase * cnpsEmployerRate);
    cmuEmployer = 0; // No CMU for journaliers (neither employee nor employer)

    contributionDetails = [
      {
        type: 'pension',
        paidBy: 'employee',
        amount: cnpsEmployee,
        rate: cnpsRate,
        base: journalierGrossResult.totalBrut,
        prorated: true,
        prorata: proratedDeductions.prorata,
      },
      // CMU removed for journaliers - not applicable
      {
        type: 'pension',
        paidBy: 'employer',
        amount: cnpsEmployer,
        rate: cnpsEmployerRate,
        base: journalierGrossResult.brutBase,
        prorated: false,
      },
    ];

    console.log('[JOURNALIER DEDUCTIONS] Prorated social security:');
    console.log(`  CNPS Employee: ${cnpsEmployee} (prorata: ${proratedDeductions.prorata.toFixed(3)})`);
    console.log(`  CMU Employee: ${cmuEmployee} (prorata: ${proratedDeductions.prorata.toFixed(3)})`);
    console.log(`  CNPS Employer: ${cnpsEmployer} (not prorated)`);
  } else {
    // Regular employee: Use full deductions
    const result = calculateSocialSecurityContributions(
      cnpsBaseFromComponents, // ← CNPS base (total gross)
      brutImposableFromComponents, // ← Taxable gross (for pension calculation)
      config.contributions,
      config.sectorOverrides,
      {
        sectorCode: input.sectorCode || config.socialSecurityScheme.defaultSectorCode, // Use database default
        workAccidentRate: input.workAccidentRate, // CNPS-provided rate (overrides sector-based rate)
        hasFamily: input.hasFamily || false,
        salaireCategoriel: salaireCategorielFromComponents, // ← Salaire catégoriel (Code 11) for accident/family
        // Dynamic CMU calculation (GAP-CMU-001)
        maritalStatus: input.maritalStatus,
        dependentChildren: input.dependentChildren,
        countryCode: input.countryCode,
        contractType: input.contractType, // For CMU exemption (CDDTI, journaliers)
        cumulativeBrutImposable, // ← For CDDTI AT/PF ceiling (75,000 FCFA/month)
      }
    );

    cnpsEmployee = result.cnpsEmployee;
    cnpsEmployer = result.cnpsEmployer;
    cmuEmployee = result.cmuEmployee;
    cmuEmployer = result.cmuEmployer;
    contributionDetails = result.contributionDetails;

    console.log('[SOCIAL SECURITY] Contributions calculated on CNPS base:', cnpsBaseFromComponents.toLocaleString('fr-FR'), 'FCFA');

    // For weekly/daily workers using component-based approach, add proration info to contributionDetails
    if (isJournalierEmployee && !journalierGrossResult) {
      const hoursWorked = input.hoursWorkedThisMonth || 0;
      const equivalentDays = hoursWorked > 0 ? calculateEquivalentDays(hoursWorked) : 0;
      const prorata = equivalentDays / 30;

      // Add prorated info to contribution details
      contributionDetails = contributionDetails.map(contrib => {
        if (contrib.paidBy === 'employee') {
          return {
            ...contrib,
            prorated: true,
            prorata,
          };
        }
        return contrib;
      });

      console.log(`[COMPONENT-BASED JOURNALIER] Added proration info: ${equivalentDays} days, prorata: ${prorata.toFixed(3)}`);
      console.log(`[COMPONENT-BASED JOURNALIER] ContributionDetails after proration:`, JSON.stringify(contributionDetails, null, 2));
    }
  }

  console.log('[DEBUG AFTER SS]', { cmuEmployee, cmuEmployer, cnpsEmployee, cnpsEmployer });

  // ========================================
  // STEP 3: Calculate Tax (Metadata-Driven Brut Imposable)
  // ========================================
  const taxStrategy = new ProgressiveMonthlyTaxStrategy(
    config.taxBrackets,
    config.familyDeductions
  );

  // Tax calculation base varies by country (database-driven)
  // - 'gross_before_ss': Tax on gross BEFORE employee SS deductions (e.g., CI uses "Brut Imposable")
  // - 'gross_after_ss': Tax on gross AFTER employee SS deductions (e.g., some other countries)
  const employeeContributionsForTax =
    config.taxSystem.taxCalculationBase === 'gross_before_ss'
      ? 0
      : (cnpsEmployee + cmuEmployee);

  console.log('[TAX CALCULATION] Base for tax:', brutImposableFromComponents.toLocaleString('fr-FR'), 'FCFA (Brut Imposable from metadata)');

  // For DAILY/HOURLY workers, we need to annualize the tax calculation
  // Otherwise, prorated earnings would result in zero or minimal tax
  let taxResult: any;
  let taxProrationFactor = 1.0;

  if (isJournalierEmployee) {
    // JOURNALIER: Use daily ITS calculation (for both legacy and component-based approaches)
    const fiscalParts = input.fiscalParts || 1.0;

    // Convert TaxBracket[] to expected format
    const monthlyBrackets = config.taxBrackets.map(bracket => ({
      min: bracket.minAmount,
      max: bracket.maxAmount,
      rate: bracket.rate,
    }));

    // Convert FamilyDeductionRule[] to expected format
    const familyDeductions = config.familyDeductions.map(rule => ({
      fiscalParts: Number(rule.fiscalParts),
      deductionAmount: Number(rule.deductionAmount),
    }));

    // Use brutBase from journalierGrossResult if available, otherwise use brutImposableFromComponents
    const taxBase = journalierGrossResult ? journalierGrossResult.brutBase : brutImposableFromComponents;

    const dailyITS = calculateDailyITS(
      taxBase, // Tax on brutBase (before CDDTI components for legacy, or brut imposable for component-based)
      journalierEquivalentDays,
      fiscalParts,
      monthlyBrackets,
      familyDeductions // ✅ Pass family deductions (GAP-ITS-JOUR-003)
    );

    taxResult = {
      monthlyTax: dailyITS,
      taxableIncome: taxBase - employeeContributionsForTax,
      grossSalary: taxBase,
      employeeContributions: employeeContributionsForTax,
      fiscalParts,
      brackets: [], // Not applicable for daily calculation
    };

    console.log('[JOURNALIER TAX] Daily ITS:');
    console.log(`  Tax Base: ${taxBase.toLocaleString('fr-FR')} FCFA`);
    console.log(`  Equivalent Days: ${journalierEquivalentDays}`);
    console.log(`  Fiscal Parts: ${fiscalParts}`);
    console.log(`  Daily ITS: ${dailyITS.toLocaleString('fr-FR')} FCFA`);
  } else if (rateType === 'DAILY' && input.daysWorkedThisMonth) {
    const daysWorked = input.daysWorkedThisMonth;
    const standardMonthDays = 30;

    // Calculate full-month brut imposable by annualizing prorated amount
    const annualizedBrutImposable = Math.round((brutImposableFromComponents / daysWorked) * standardMonthDays);
    const annualizedEmployeeContributions = Math.round((employeeContributionsForTax / daysWorked) * standardMonthDays);

    console.log(`[DAILY WORKER TAX ANNUALIZATION] Days worked: ${daysWorked}`);
    console.log(`[DAILY WORKER TAX ANNUALIZATION] Prorated Brut Imposable: ${brutImposableFromComponents} FCFA`);
    console.log(`[DAILY WORKER TAX ANNUALIZATION] Annualized Brut Imposable (full month): ${annualizedBrutImposable} FCFA`);

    // Calculate tax on full-month brut imposable
    const annualizedTaxResult = taxStrategy.calculate({
      grossSalary: annualizedBrutImposable, // Use brut imposable, not total gross
      employeeContributions: annualizedEmployeeContributions,
      fiscalParts: input.fiscalParts || 1.0,
    });

    console.log(`[DAILY WORKER TAX ANNUALIZATION] Full-month tax: ${annualizedTaxResult.monthlyTax} FCFA`);

    // Prorate tax back to days worked
    taxProrationFactor = daysWorked / standardMonthDays;
    const proratedTax = Math.round(annualizedTaxResult.monthlyTax * taxProrationFactor);

    console.log(`[DAILY WORKER TAX ANNUALIZATION] Prorated tax (${daysWorked} days): ${proratedTax} FCFA`);

    // Use prorated tax but keep other values from annualized calculation
    taxResult = {
      ...annualizedTaxResult,
      monthlyTax: proratedTax,
      grossSalary: brutImposableFromComponents, // Keep actual prorated brut imposable for display
      employeeContributions: employeeContributionsForTax, // Keep actual prorated contributions
    };
  } else if (rateType === 'HOURLY' && input.hoursWorkedThisMonth) {
    const hoursWorked = input.hoursWorkedThisMonth;
    const standardMonthlyHours = 173.33;

    // Calculate full-month brut imposable by annualizing prorated amount
    const annualizedBrutImposable = Math.round((brutImposableFromComponents / hoursWorked) * standardMonthlyHours);
    const annualizedEmployeeContributions = Math.round((employeeContributionsForTax / hoursWorked) * standardMonthlyHours);

    console.log(`[HOURLY WORKER TAX ANNUALIZATION] Hours worked: ${hoursWorked}`);
    console.log(`[HOURLY WORKER TAX ANNUALIZATION] Prorated Brut Imposable: ${brutImposableFromComponents} FCFA`);
    console.log(`[HOURLY WORKER TAX ANNUALIZATION] Annualized Brut Imposable (full month): ${annualizedBrutImposable} FCFA`);

    // Calculate tax on full-month brut imposable
    const annualizedTaxResult = taxStrategy.calculate({
      grossSalary: annualizedBrutImposable, // Use brut imposable, not total gross
      employeeContributions: annualizedEmployeeContributions,
      fiscalParts: input.fiscalParts || 1.0,
    });

    console.log(`[HOURLY WORKER TAX ANNUALIZATION] Full-month tax: ${annualizedTaxResult.monthlyTax} FCFA`);

    // Prorate tax back to hours worked
    taxProrationFactor = hoursWorked / standardMonthlyHours;
    const proratedTax = Math.round(annualizedTaxResult.monthlyTax * taxProrationFactor);

    console.log(`[HOURLY WORKER TAX ANNUALIZATION] Prorated tax (${hoursWorked} hours): ${proratedTax} FCFA`);

    // Use prorated tax but keep other values from annualized calculation
    taxResult = {
      ...annualizedTaxResult,
      monthlyTax: proratedTax,
      grossSalary: brutImposableFromComponents, // Keep actual prorated brut imposable for display
      employeeContributions: employeeContributionsForTax, // Keep actual prorated contributions
    };
  } else {
    // MONTHLY workers: calculate tax normally (no annualization needed)
    taxResult = taxStrategy.calculate({
      grossSalary: brutImposableFromComponents, // Use brut imposable from metadata
      employeeContributions: employeeContributionsForTax,
      fiscalParts: input.fiscalParts || 1.0,
    });
  }

  // ========================================
  // STEP 4: Calculate Deductions & Net
  // ========================================
  const totalDeductions = cnpsEmployee + cmuEmployee + taxResult.monthlyTax;
  const netSalary = Math.round(grossSalary - totalDeductions);

  // ========================================
  // STEP 5: Calculate Other Taxes (FDFP, ITS, etc.)
  // ========================================
  // Determine employee type (prioritize employeeType, fallback to isExpat for backward compatibility)
  const employeeType = input.employeeType || (input.isExpat ? 'EXPAT' : 'LOCAL');

  const { employerTaxes, employeeTaxes, otherTaxesDetails } = calculateOtherTaxes(
    grossSalary,
    taxResult.taxableIncome,
    config.otherTaxes,
    employeeType, // Pass employee type for ITS calculation (GAP-ITS-JOUR-002)
    isJournalierEmployee // Skip ITS for journaliers (they use Article 146, not Article 175)
  );

  // ========================================
  // STEP 6: Calculate Employer Cost
  // ========================================
  let employerContributionEmployeur = 0;

  if (isJournalierEmployee) {
    // JOURNALIER: Add contribution employeur (ITS Employeur via Article 146)
    // Article 146: LOCAL/DETACHE/STAGIAIRE = 2.8%, EXPAT = 12%
    // (Regular employees use Article 175: LOCAL = 1.2%, EXPAT = 10.4%)
    const journalierEmployeeType = input.employeeType || (input.isExpat ? 'EXPAT' : 'LOCAL');

    // Determine the base for ITS calculation
    // - Legacy path: use journalierGrossResult.brutBase
    // - Component-based path: use brutImposableFromComponents (taxable gross)
    const itsBase = journalierGrossResult
      ? journalierGrossResult.brutBase
      : brutImposableFromComponents;

    employerContributionEmployeur = calculateContributionEmployeur(
      itsBase,
      journalierEmployeeType
    );

    console.log('[JOURNALIER EMPLOYER COSTS] ITS Employeur (Article 146):', employerContributionEmployeur.toLocaleString('fr-FR'), 'FCFA', `(${journalierEmployeeType}: ${journalierEmployeeType === 'EXPAT' ? '12%' : '2.8%'})`);
    console.log('[JOURNALIER EMPLOYER COSTS] Base used:', itsBase.toLocaleString('fr-FR'), 'FCFA', journalierGrossResult ? '(legacy brutBase)' : '(component brutImposable)');

    // Add to otherTaxesDetails so UI can display it (GAP-ITS-JOUR-002)
    const itsRate = journalierEmployeeType === 'EXPAT' ? 0.12 : 0.028;
    otherTaxesDetails.push({
      code: `its_employer_${journalierEmployeeType.toLowerCase()}_journalier`,
      name: 'ITS Employeur (Art. 146)',
      amount: Math.round(employerContributionEmployeur),
      rate: itsRate,
      base: itsBase,
      paidBy: 'employer',
    });
  }

  const totalEmployerContributions = cnpsEmployer + cmuEmployer + employerTaxes + employerContributionEmployeur;
  const employerCost = Math.round(grossSalary + totalEmployerContributions);

  // ========================================
  // STEP 6: Build Detailed Breakdowns
  // ========================================
  const earningsDetails = buildEarningsDetails(grossCalc, input, processedComponents);
  const deductionsDetails = buildDeductionsDetails(
    cnpsEmployee,
    cmuEmployee,
    taxResult.monthlyTax,
    config.taxSystem, // Pass config for labels
    contributionDetails, // Pass contribution details for rate info
    input.fiscalParts ?? 1 // Pass fiscal parts for ITS display
  );

  console.log('[DEDUCTIONS DETAILS] Built deductions details:', JSON.stringify(deductionsDetails, null, 2));

  // ========================================
  // Return Complete Result
  // ========================================

  // Calculate actual base salary from components (for component-based calculations)
  // For CDDTI and component-based approaches where input.baseSalary is 0,
  // we need to extract the actual base salary from processed components
  let actualBaseSalary = input.baseSalary;

  if (input.baseSalary === 0 && processedComponents.length > 0) {
    // Extract base salary components (code 11, 12, or components that contribute to salaire catégoriel)
    const baseComponents = processedComponents.filter(c =>
      c.code === '11' ||
      c.code === '12' ||
      c.includeInSalaireCategoriel === true
    );

    if (baseComponents.length > 0) {
      actualBaseSalary = baseComponents.reduce((sum, c) => sum + c.originalAmount, 0);
      console.log(`[PAYROLL RESULT] Calculated actual base salary from components: ${actualBaseSalary.toLocaleString('fr-FR')} FCFA`);
    }
  }

  // ========================================
  // STEP 10: Compliance Validation (10% Cap)
  // ========================================
  let complianceWarnings: Array<{
    field: string;
    message: string;
    severity: 'warning' | 'error';
    legalReference?: string;
  }> | undefined;

  // Only validate for CI (Côte d'Ivoire) - can be extended to other countries later
  if (input.countryCode === 'CI') {
    const { complianceValidator } = await import('@/lib/compliance/compliance-validator');

    // Build component list with taxability info
    // Note: ProcessedComponent doesn't track isReimbursement, so we infer from component definitions
    const componentsForValidation = processedComponents.map(c => ({
      code: c.code,
      name: c.name,
      amount: c.originalAmount,
      // A component is taxable if it's included in brut imposable
      isTaxable: c.includeInBrutImposable,
      // We can't determine if it's a reimbursement from ProcessedComponent alone,
      // but reimbursements would typically have exemptPortion = originalAmount
      isReimbursement: c.exemptPortion === c.originalAmount && c.exemptPortion > 0,
    }));

    const validationResult = await complianceValidator.validateGlobalNonTaxableCap(
      {
        totalRemuneration: grossSalary,
        components: componentsForValidation,
      },
      input.countryCode
    );

    // Combine violations and warnings
    const allWarnings = [
      ...validationResult.violations.map(v => ({
        field: v.field,
        message: v.error,
        severity: v.severity as 'warning' | 'error',
        legalReference: v.legalReference,
      })),
      ...validationResult.warnings.map(w => ({
        field: w.field,
        message: w.message,
        severity: w.severity as 'warning' | 'error',
        legalReference: w.legalReference,
      })),
    ];

    if (allWarnings.length > 0) {
      complianceWarnings = allWarnings;
      console.log(`[COMPLIANCE] Found ${allWarnings.length} warnings/violations for ${input.countryCode}`);
      console.log(`[COMPLIANCE] Non-taxable: ${validationResult.totalNonTaxable.toLocaleString('fr-FR')} FCFA (${(validationResult.currentPercentage * 100).toFixed(1)}% of gross)`);
    }
  }

  return {
    // Employee info
    employeeId: input.employeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,

    // Earnings
    baseSalary: actualBaseSalary, // Use calculated base salary instead of input
    proratedBaseSalary: grossCalc.proratedSalary,
    allowances: grossCalc.allowances,
    overtimePay: grossCalc.overtimePay,
    bonuses: grossCalc.bonuses,
    grossSalary,
    brutImposable: brutImposableFromComponents, // Taxable gross (for AT/PF cumulative ceiling)

    // Employee Deductions
    cnpsEmployee,
    cmuEmployee,
    taxableIncome: taxResult.taxableIncome,
    its: taxResult.monthlyTax,
    totalDeductions,

    // Employer Contributions
    cnpsEmployer,
    cmuEmployer,
    otherTaxesEmployer: employerTaxes,
    totalEmployerContributions,

    // Net Pay
    netSalary,
    employerCost,

    // Other Taxes Details
    otherTaxesDetails,

    // Days
    daysWorked: grossCalc.daysWorked,
    daysInPeriod: grossCalc.daysInPeriod,

    // Detailed Breakdowns
    earningsDetails,
    deductionsDetails,
    contributionDetails, // Social security contribution details

    // Components (for detailed component breakdown in UI)
    // For journalier workers using legacy calculation, use journalierGrossResult.components
    // Otherwise, use processedComponents from component processor
    components: isJournalierEmployee && journalierGrossResult
      ? journalierGrossResult.components
      : processedComponents.map(pc => ({
          code: pc.code,
          name: pc.name,
          amount: pc.originalAmount, // Use originalAmount from ProcessedComponent
          sourceType: undefined, // ProcessedComponent doesn't have sourceType
        })),

    itsDetails: {
      grossSalary: taxResult.grossSalary,
      cnpsEmployeeDeduction: cnpsEmployee,
      cmuEmployeeDeduction: cmuEmployee,
      taxableIncome: taxResult.taxableIncome,
      annualTaxableIncome: taxResult.annualTaxableIncome,
      annualTax: taxResult.annualTax,
      monthlyTax: taxResult.monthlyTax,
      effectiveRate: taxResult.effectiveRate,
      bracketDetails: (taxResult.bracketDetails || []).map((b: {
        min: number;
        max: number | null;
        rate: number;
        taxableInBracket: number;
        taxForBracket: number;
      }) => ({
        min: b.min,
        max: b.max || Infinity,
        rate: b.rate,
        taxableInBracket: b.taxableInBracket,
        taxForBracket: b.taxForBracket,
      })),
    },

    // Compliance Warnings
    complianceWarnings,
  };
}

/**
 * Calculate other taxes (FDFP, ITS, etc.) from database config
 * Filters ITS taxes based on employee type (local vs expat)
 *
 * @param grossSalary - Total gross salary
 * @param taxableGross - Taxable gross (after exemptions)
 * @param otherTaxes - Other tax rules from database
 * @param employeeType - Employee classification (LOCAL, EXPAT, DETACHE, STAGIAIRE)
 * @param skipITSEmployer - If true, skip ITS employer taxes (for journaliers who use Article 146)
 */
function calculateOtherTaxes(
  grossSalary: number,
  taxableGross: number,
  otherTaxes: any[],
  employeeType: 'LOCAL' | 'EXPAT' | 'DETACHE' | 'STAGIAIRE' = 'LOCAL',
  skipITSEmployer: boolean = false
) {
  let employerTaxes = 0;
  let employeeTaxes = 0;
  const details: any[] = [];

  // Map employeeType to database format (lowercase)
  const employeeTypeDb = employeeType === 'EXPAT' ? 'expat' : 'local';

  // DEBUG: Log ITS filtering
  console.log('🔍 [ITS DEBUG] calculateOtherTaxes called:', {
    employeeType,
    employeeTypeDb,
    taxesCount: otherTaxes.length,
    itsTaxes: otherTaxes.filter(t => t.code?.includes('its_employer')).map(t => ({
      code: t.code,
      appliesToEmployeeType: t.appliesToEmployeeType
    }))
  });

  for (const tax of otherTaxes) {
    // Skip ITS employer taxes for journaliers (they use Article 146 via calculateContributionEmployeur)
    if (skipITSEmployer && tax.code?.includes('its_employer')) {
      console.log('🔍 [ITS SKIP] Skipping database ITS for journalier:', {
        code: tax.code,
        reason: 'Journaliers use Article 146 (2.8%/12%) not Article 175 (1.2%/10.4%)'
      });
      continue;
    }

    // Filter ITS taxes based on employee type
    if (tax.appliesToEmployeeType) {
      console.log('🔍 [ITS DEBUG] Checking tax:', {
        code: tax.code,
        appliesToEmployeeType: tax.appliesToEmployeeType,
        employeeTypeDb,
        willSkip: tax.appliesToEmployeeType !== employeeTypeDb
      });
      if (tax.appliesToEmployeeType !== employeeTypeDb) {
        // Skip this tax - it doesn't apply to this employee type
        continue;
      }
    }

    // Determine calculation base according to database configuration
    const base = tax.calculationBase === 'brut_imposable'
      ? taxableGross  // Use taxable gross (excludes non-taxable components like transport)
      : grossSalary;  // Use total gross salary

    const amount = Math.round(base * Number(tax.taxRate));

    // Extract French label if name is an object with {en, fr} keys
    const displayName = typeof tax.name === 'object' && tax.name !== null
      ? (tax.name.fr || tax.name.en || tax.code)
      : tax.name;

    details.push({
      code: tax.code,
      name: displayName,
      amount,
      rate: Number(tax.taxRate),
      base,
      paidBy: tax.paidBy,
    });

    if (tax.paidBy === 'employer') {
      employerTaxes += amount;
    } else if (tax.paidBy === 'employee') {
      employeeTaxes += amount;
    }
  }

  return {
    employerTaxes,
    employeeTaxes,
    otherTaxesDetails: details,
  };
}

/**
 * Calculate CMU (Couverture Maladie Universelle) dynamically based on family size
 *
 * Legal basis: Décret n° 2015-862 du 28 octobre 2015
 *
 * Rules:
 * - 1,000 FCFA per person (employee + spouse if married + children under 21)
 * - Up to 8,000 FCFA total: Split 50/50 between employer and employee
 * - Above 8,000 FCFA: Employer capped at 4,000 FCFA, employee pays surplus
 *
 * @param maritalStatus - Employee marital status
 * @param dependentChildren - Number of children under 21 (or with school certificate)
 * @returns CMU amounts for employee and employer
 */
function calculateCMU(
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed' = 'single',
  dependentChildren: number = 0
): { cmuEmployee: number; cmuEmployer: number; totalCMU: number; totalPersons: number } {
  // Count persons covered: employee (1) + spouse (if married) + children
  const totalPersons = 1
    + (maritalStatus === 'married' ? 1 : 0)
    + dependentChildren;

  // Base: 1,000 FCFA per person
  const totalCMU = 1000 * totalPersons;

  // Cost sharing rules
  let cmuEmployee: number;
  let cmuEmployer: number;

  if (totalCMU <= 8000) {
    // Split 50/50 up to 8,000 FCFA
    cmuEmployee = totalCMU / 2;
    cmuEmployer = totalCMU / 2;
  } else {
    // Above 8,000 FCFA: Employer capped at 4,000 FCFA
    // Employee pays the surplus alone
    cmuEmployer = 4000;
    cmuEmployee = totalCMU - 4000;
  }

  console.log(`[CMU CALCULATION] Status: ${maritalStatus}, Children: ${dependentChildren}, Persons: ${totalPersons}`);
  console.log(`[CMU CALCULATION] Total: ${totalCMU}, Employee: ${cmuEmployee}, Employer: ${cmuEmployer}`);

  return { cmuEmployee, cmuEmployer, totalCMU, totalPersons };
}

/**
 * Calculate social security contributions from database config
 *
 * COUNTRY-AGNOSTIC: Works for any country by categorizing contributions
 * based on who pays (employee vs employer) and type (retirement, health, other).
 *
 * Categorization logic:
 * - Retirement/Pension contributions → cnpsEmployee + cnpsEmployer
 * - Health/Medical contributions → cmuEmployee + cmuEmployer
 * - Other employer-only contributions → cnpsEmployer
 */
function calculateSocialSecurityContributions(
  cnpsBase: number, // Base for most CNPS calculations (gross salary)
  brutImposable: number, // Taxable gross for pension/retirement
  contributions: any[],
  sectorOverrides: any[],
  options: {
    sectorCode: string;
    workAccidentRate?: number; // CNPS-provided work accident rate (overrides sector-based rate)
    hasFamily: boolean;
    salaireCategoriel?: number; // Code 11 - For CNPS calculations
    // Dynamic CMU calculation (GAP-CMU-001)
    maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
    dependentChildren?: number;
    countryCode?: string; // To determine if dynamic CMU applies
    contractType?: 'CDI' | 'CDD' | 'CDDTI' | 'INTERIM' | 'STAGE'; // To determine CMU exemption
    cumulativeBrutImposable?: number; // For CDDTI AT/PF ceiling (75,000 FCFA/month)
  }
) {
  console.log('[DEBUG SS START]', { cnpsBase, brutImposable, hasFamily: options.hasFamily, numContributions: contributions.length });
  let cnpsEmployee = 0;
  let cnpsEmployer = 0;
  let cmuEmployee = 0;
  let cmuEmployer = 0;
  const contributionDetails: Array<{
    code: string;
    name: string;
    amount: number;
    paidBy: 'employee' | 'employer';
    rate?: number; // Percentage rate (0.063 for 6.3%)
    base?: number; // Calculation base
  }> = [];

  for (const contrib of contributions) {
    const code = contrib.code.toLowerCase();

    console.log(`[DEBUG CONTRIB] ${contrib.code}: fixedAmount=${contrib.fixedAmount}, employeeRate=${contrib.employeeRate}, employerRate=${contrib.employerRate}, calculationBase=${contrib.calculationBase}`);

    // Determine calculation base based on contribution type
    let calculationBase = cnpsBase; // Default to CNPS base

    // IMPORTANT: AT (Accident de Travail) and PF (Prestations Familiales) base depends on contract type:
    // - CDDTI workers: Override to use brut_imposable with cumulative monthly ceiling
    // - Regular employees: Follow database config (salaire_categoriel with 75,000 cap)
    const isATorPF = code.includes('accident') || code.includes('family') || code.includes('familial') || code.includes('pf');
    const isCDDTI = options.contractType === 'CDDTI';

    console.log(`[AT/PF CHECK] ${contrib.code}: isATorPF=${isATorPF}, isCDDTI=${isCDDTI}, condition=${isATorPF && isCDDTI}`);

    if (isATorPF && isCDDTI) {
      // CDDTI workers: Use brut_imposable with cumulative ceiling
      const ceiling = 75000;

      if (options.cumulativeBrutImposable !== undefined) {
        // CDDTI: Prorated ceiling based on cumulative brut imposable this month
        const remainingCeiling = Math.max(0, ceiling - options.cumulativeBrutImposable);
        calculationBase = Math.min(brutImposable, remainingCeiling);

        console.log(
          `[CDDTI AT/PF] ${contrib.code}: Cumulative ${options.cumulativeBrutImposable.toLocaleString('fr-FR')}, ` +
          `Remaining ${remainingCeiling.toLocaleString('fr-FR')}, ` +
          `Current ${brutImposable.toLocaleString('fr-FR')}, ` +
          `Base ${calculationBase.toLocaleString('fr-FR')}`
        );
      } else {
        // CDDTI without cumulative tracking: simple cap
        calculationBase = Math.min(brutImposable, ceiling);
      }
    } else if (contrib.calculationBase === 'brut_imposable') {
      // Explicit brut_imposable in database (non-AT/PF or other contributions)
      calculationBase = Math.min(
        brutImposable,
        contrib.ceilingAmount ? Number(contrib.ceilingAmount) : Infinity
      );
    } else if (contrib.calculationBase === 'salaire_categoriel') {
      // For salaire_categoriel: use Code 11 (salaire catégoriel), capped at ceiling
      // Used for regular employees' AT and PF (database config: salaire_categoriel with 75,000 cap)
      if (options.salaireCategoriel) {
        calculationBase = Math.min(
          options.salaireCategoriel,
          contrib.ceilingAmount ? Number(contrib.ceilingAmount) : Infinity
        );
      } else if (contrib.ceilingAmount) {
        // Fallback: use ceiling amount as the base (country-specific, from database)
        calculationBase = Number(contrib.ceilingAmount);
      } else {
        // No salaireCategoriel and no ceiling defined - this is a configuration error
        throw new Error(
          `Contribution ${contrib.code} requires salaireCategoriel but none provided and no ceiling defined in database`
        );
      }
    } else if (contrib.calculationBase === 'brut_imposable') {
      // For brut_imposable: use taxable gross (excludes non-taxable components like transport)
      calculationBase = Math.min(
        brutImposable,
        contrib.ceilingAmount ? Number(contrib.ceilingAmount) : Infinity
      );
    } else if (contrib.calculationBase === 'gross_salary') {
      // For gross_salary: use total CNPS base
      calculationBase = Math.min(
        cnpsBase,
        contrib.ceilingAmount ? Number(contrib.ceilingAmount) : Infinity
      );
    }
    // else: use cnpsBase as default

    // Fixed amount contributions
    // NOTE: CMU for Côte d'Ivoire now calculated dynamically (GAP-CMU-001)
    // Skip CMU database entries if countryCode is CI and dynamic data is available
    if (contrib.fixedAmount) {
      const fixedAmount = Number(contrib.fixedAmount);

      console.log(`[DEBUG CMU] Processing ${code}, fixedAmount: ${fixedAmount}, hasFamily: ${options.hasFamily}`);

      // Extract display name (French label)
      const displayName = typeof contrib.name === 'object' && contrib.name !== null
        ? (contrib.name.fr || contrib.name.en || contrib.code)
        : contrib.name;

      // Categorize by code pattern
      if (code.includes('cmu') || code.includes('health') || code.includes('medical')) {
        // Skip fixed CMU for Côte d'Ivoire if we have dynamic data (GAP-CMU-001)
        if (options.countryCode === 'CI' && options.maritalStatus !== undefined && options.dependentChildren !== undefined) {
          console.log(`[CMU] Skipping fixed amount CMU (${code}) for CI - will use dynamic calculation`);
          continue; // Skip this contribution, use dynamic CMU instead
        }

        // LEGACY: For other countries or when dynamic data not available, use fixed amounts
        // CMU Employee (e.g., cmu_employee)
        if (code === 'cmu_employee') {
          console.log(`[DEBUG CMU] Setting cmuEmployee to ${fixedAmount}`);
          cmuEmployee = fixedAmount;
          contributionDetails.push({
            code: contrib.code,
            name: displayName,
            amount: fixedAmount,
            paidBy: 'employee',
            rate: undefined, // Fixed amount, not percentage
            base: undefined,
          });
        }
        // CMU Employer Base (no family)
        else if (code === 'cmu_employer_base' && !options.hasFamily) {
          console.log(`[DEBUG CMU] Setting cmuEmployer (base) to ${fixedAmount}`);
          cmuEmployer = fixedAmount;
          contributionDetails.push({
            code: contrib.code,
            name: displayName,
            amount: fixedAmount,
            paidBy: 'employer',
            rate: undefined, // Fixed amount, not percentage
            base: undefined,
          });
        }
        // CMU Employer Family (with family)
        else if (code === 'cmu_employer_family' && options.hasFamily) {
          console.log(`[DEBUG CMU] Setting cmuEmployer (family) to ${fixedAmount}`);
          cmuEmployer = fixedAmount;
          contributionDetails.push({
            code: contrib.code,
            name: displayName,
            amount: fixedAmount,
            paidBy: 'employer',
            rate: undefined, // Fixed amount, not percentage
            base: undefined,
          });
        }
      } else {
        // Other fixed contributions go to CNPS employer bucket
        cnpsEmployer += fixedAmount;
        contributionDetails.push({
          code: contrib.code,
          name: displayName,
          amount: fixedAmount,
          paidBy: 'employer',
          rate: undefined, // Fixed amount, not percentage
          base: undefined,
        });
      }
      continue;
    }

    // Percentage-based contributions
    const employeeRate = contrib.employeeRate ? Number(contrib.employeeRate) : 0;
    let employerRate = contrib.employerRate ? Number(contrib.employerRate) : 0;

    // Check for work accident rate override or sector override
    if (contrib.isVariableBySector) {
      // PRIORITY 1: Use manual workAccidentRate if provided (from Q1 onboarding)
      if (options.workAccidentRate !== undefined && isATorPF) {
        employerRate = options.workAccidentRate;
        console.log(`[WORK ACCIDENT] Using manual rate for ${contrib.code}: ${employerRate}`);
      }
      // PRIORITY 2: Use sector override from database
      else {
        const override = sectorOverrides.find(
          o =>
            o.contributionTypeId === contrib.id &&
            o.sectorCode === options.sectorCode
        );
        if (override) {
          employerRate = Number(override.employerRate);
        }
      }
    }

    const employeeAmount = Math.round(calculationBase * employeeRate);
    const employerAmount = Math.round(calculationBase * employerRate);

    // Log AT/PF calculations
    if (isATorPF) {
      console.log(
        `[AT/PF CALC] ${contrib.code}: base=${calculationBase}, ` +
        `employerRate=${employerRate}, employerAmount=${employerAmount}`
      );
    }

    // Extract display name (French label)
    const displayName = typeof contrib.name === 'object' && contrib.name !== null
      ? (contrib.name.fr || contrib.name.en || contrib.code)
      : contrib.name;

    // Add individual contribution details
    if (employeeAmount > 0) {
      contributionDetails.push({
        code: contrib.code,
        name: displayName,
        amount: employeeAmount,
        paidBy: 'employee',
        rate: employeeRate, // Percentage rate (e.g., 0.063 for 6.3%)
        base: calculationBase, // Base amount used for calculation
      });
    }
    if (employerAmount > 0) {
      contributionDetails.push({
        code: contrib.code,
        name: displayName,
        amount: employerAmount,
        paidBy: 'employer',
        rate: employerRate, // Percentage rate (e.g., 0.0575 for 5.75%)
        base: calculationBase, // Base amount used for calculation
      });
    }

    // Categorize contributions by code pattern (country-agnostic) for totals
    // Retirement/Pension → CNPS buckets (both employee and employer)
    if (code.includes('pension') || code.includes('retraite') || code.includes('retirement')) {
      cnpsEmployee += employeeAmount;
      cnpsEmployer += employerAmount;
    }
    // Health/Medical → CMU buckets
    else if (code.includes('health') || code.includes('medical') || code.includes('ipress') || code.includes('maladie')) {
      cmuEmployee += employeeAmount;
      cmuEmployer += employerAmount;
    }
    // Family, Work Accident, and other employer-only → CNPS employer bucket
    else if (code.includes('family') || code.includes('familial') || code.includes('pf') ||
             code.includes('work_accident') || code.includes('accident') || code.includes('at') ||
             code.includes('maternity') || code.includes('maternite')) {
      // These are typically employer-only, but add both just in case
      console.log(
        `[CNPS AGGREGATION] Adding ${contrib.code} to cnpsEmployer: ` +
        `employerAmount=${employerAmount}, cnpsEmployer before=${cnpsEmployer}, after=${cnpsEmployer + employerAmount}`
      );
      cnpsEmployee += employeeAmount;
      cnpsEmployer += employerAmount;
    }
    // Catch-all: any other contribution type → CNPS buckets
    else {
      cnpsEmployee += employeeAmount;
      cnpsEmployer += employerAmount;
    }
  }

  // Apply dynamic CMU calculation for Côte d'Ivoire (GAP-CMU-001)
  // IMPORTANT: CDDTI workers are NOT subject to CMU (neither employee nor employer)
  const isCDDTI = options.contractType === 'CDDTI';

  if (options.countryCode === 'CI' && !isCDDTI && options.maritalStatus !== undefined && options.dependentChildren !== undefined) {
    const dynamicCMU = calculateCMU(options.maritalStatus, options.dependentChildren);

    // Override CMU values with dynamic calculation
    cmuEmployee = dynamicCMU.cmuEmployee;
    cmuEmployer = dynamicCMU.cmuEmployer;

    // Add to contribution details
    contributionDetails.push({
      code: 'cmu_employee_dynamic',
      name: `CMU (Cotisation salariale) - ${dynamicCMU.totalPersons} personne${dynamicCMU.totalPersons > 1 ? 's' : ''}`,
      amount: cmuEmployee,
      paidBy: 'employee',
      rate: undefined,
      base: undefined,
    });

    contributionDetails.push({
      code: 'cmu_employer_dynamic',
      name: `CMU (Cotisation patronale) - ${dynamicCMU.totalPersons} personne${dynamicCMU.totalPersons > 1 ? 's' : ''}`,
      amount: cmuEmployer,
      paidBy: 'employer',
      rate: undefined,
      base: undefined,
    });

    console.log('[CMU DYNAMIC] Applied dynamic CMU:', { cmuEmployee, cmuEmployer, totalPersons: dynamicCMU.totalPersons });
  } else if (isCDDTI) {
    console.log('[CMU] CDDTI worker - CMU exempted (employee and employer)');
    cmuEmployee = 0;
    cmuEmployer = 0;
  }

  console.log('[DEBUG FINAL] Contribution totals:', { cnpsEmployee, cnpsEmployer, cmuEmployee, cmuEmployer });
  return {
    cnpsEmployee,
    cnpsEmployer,
    cmuEmployee,
    cmuEmployer,
    contributionDetails,
  };
}

/**
 * Build earnings details array
 *
 * For component-based calculation (CDDTI), uses processedComponents.
 * For field-based calculation (legacy), uses input allowances.
 */
function buildEarningsDetails(grossCalc: any, input: PayrollCalculationInputV2, processedComponents: any[]) {
  const details: any[] = [];

  // If we have processed components (CDDTI), use them directly
  if (processedComponents && processedComponents.length > 0) {
    processedComponents.forEach(comp => {
      details.push({
        type: comp.code || 'component',
        name: comp.name,
        description: comp.name,
        amount: comp.originalAmount, // Use originalAmount (already includes hours multiplication for CDDTI)
      });
    });
    return details;
  }

  // Legacy: field-based calculation
  details.push({
    type: 'base_salary',
    description: 'Salaire de base',
    amount: grossCalc.proratedSalary,
  });

  // Add individual allowance components
  if (input.housingAllowance && input.housingAllowance > 0) {
    details.push({
      type: 'housing_allowance',
      description: 'Prime de logement',
      amount: input.housingAllowance,
    });
  }

  if (input.transportAllowance && input.transportAllowance > 0) {
    details.push({
      type: 'transport_allowance',
      description: 'Prime de transport',
      amount: input.transportAllowance,
    });
  }

  if (input.mealAllowance && input.mealAllowance > 0) {
    details.push({
      type: 'meal_allowance',
      description: 'Prime de panier',
      amount: input.mealAllowance,
    });
  }

  if (input.seniorityBonus && input.seniorityBonus > 0) {
    details.push({
      type: 'seniority_bonus',
      description: 'Prime d\'ancienneté',
      amount: input.seniorityBonus,
    });
  }

  if (input.familyAllowance && input.familyAllowance > 0) {
    details.push({
      type: 'family_allowance',
      description: 'Allocations familiales',
      amount: input.familyAllowance,
    });
  }

  if (grossCalc.overtimePay > 0) {
    details.push({
      type: 'overtime',
      description: 'Heures supplémentaires',
      amount: grossCalc.overtimePay,
    });
  }

  if (grossCalc.bonuses > 0) {
    details.push({
      type: 'bonuses',
      description: 'Primes',
      amount: grossCalc.bonuses,
    });
  }

  return details;
}

/**
 * Build deductions details array with country-specific labels and rate information
 */
function buildDeductionsDetails(
  cnpsEmployee: number,
  cmuEmployee: number,
  tax: number,
  taxSystem: {
    retirementContributionLabel: Record<string, string>;
    healthContributionLabel: Record<string, string>;
    incomeTaxLabel: Record<string, string>;
  },
  contributionDetails: Array<{
    code?: string;
    name?: string;
    type?: string;
    amount: number;
    paidBy: 'employee' | 'employer';
    rate?: number;
    base?: number;
    prorated?: boolean;
    prorata?: number;
    fixedAmount?: number;
  }>,
  fiscalParts: number
) {
  // Find employee contributions with rate info
  const cnpsEmployeeContrib = contributionDetails.find(
    c => c.paidBy === 'employee' && ((c.code && (c.code.includes('pension') || c.code.includes('retraite'))) || c.type === 'pension')
  );
  const cmuEmployeeContrib = contributionDetails.find(
    c => c.paidBy === 'employee' && ((c.code && (c.code.includes('cmu') || c.code.includes('health'))) || c.type === 'health')
  );

  // Helper to format rate percentage (up to 2 decimals, remove trailing zeros)
  const formatRate = (rate: number) => (rate * 100).toFixed(2).replace(/\.?0+$/, '');

  // Helper to format prorated description
  const getProratedSuffix = (contrib: typeof cnpsEmployeeContrib) => {
    if (contrib?.prorated && contrib?.prorata) {
      const days = Math.round(contrib.prorata * 30);
      return ` - ${days}j/${30}j`;
    }
    return '';
  };

  return [
    {
      type: 'cnps_employee',
      description: cnpsEmployeeContrib?.prorated
        ? `${taxSystem.retirementContributionLabel.fr}${getProratedSuffix(cnpsEmployeeContrib)}`
        : taxSystem.retirementContributionLabel.fr,
      amount: cnpsEmployee,
    },
    {
      type: 'cmu_employee',
      description: cmuEmployeeContrib?.prorated
        ? `${taxSystem.healthContributionLabel.fr}${getProratedSuffix(cmuEmployeeContrib)}`
        : taxSystem.healthContributionLabel.fr,
      amount: cmuEmployee,
    },
    {
      type: 'its',
      description: taxSystem.incomeTaxLabel.fr,
      amount: tax,
    },
  ];
}
