/**
 * Côte d'Ivoire Payroll Constants (2025)
 *
 * This file contains all regulatory constants for payroll calculations
 * in Côte d'Ivoire as per the official government regulations.
 *
 * Sources:
 * - Code du travail (Labor Code)
 * - Code général des impôts (Tax Code - 2024 Reform)
 * - CNPS regulations (Social Security)
 * - CMU regulations (Universal Health Coverage)
 */

// ========================================
// SMIG (Minimum Wage)
// ========================================
export const SMIG = 75_000; // FCFA per month (40h/week)

// ========================================
// CNPS Contribution Rates
// ========================================
export const CNPS_RATES = {
  // Pension (Retraite)
  pension: {
    employee: 0.063, // 6.3%
    employer: 0.077, // 7.7%
    ceiling: 3_375_000, // 45 × SMIG
  },

  // Maternity (employer only)
  maternity: {
    employee: 0,
    employer: 0.0075, // 0.75%
    ceiling: 70_000,
  },

  // Family Allowance (employer only)
  family: {
    employee: 0,
    employer: 0.05, // 5%
    ceiling: 70_000,
  },

  // Work Accident (employer only, varies by sector)
  workAccident: {
    employee: 0,
    employerMin: 0.02, // 2% (services)
    employerMax: 0.05, // 5% (construction/BTP)
    ceiling: 70_000,
  },
} as const;

// ========================================
// CMU (Universal Health Coverage)
// ========================================
export const CMU_RATES = {
  employeeFixed: 1_000, // Fixed 1,000 FCFA per person
  employerEmployee: 500, // 500 FCFA for employee
  employerFamily: 4_500, // 4,500 FCFA for family (spouse + up to 6 children)
} as const;

// ========================================
// ITS (Tax on Salaries) - 2024 Reform
// ========================================
// Progressive tax brackets (Annual income in FCFA)
export const ITS_BRACKETS = [
  { min: 0, max: 300_000, rate: 0 },
  { min: 300_000, max: 547_000, rate: 0.10 },
  { min: 547_000, max: 979_000, rate: 0.15 },
  { min: 979_000, max: 1_519_000, rate: 0.20 },
  { min: 1_519_000, max: 2_644_000, rate: 0.25 },
  { min: 2_644_000, max: 4_669_000, rate: 0.35 },
  { min: 4_669_000, max: 10_106_000, rate: 0.45 },
  { min: 10_106_000, max: Infinity, rate: 0.60 },
] as const;

// ========================================
// Working Hours
// ========================================
export const WORKING_HOURS = {
  legalWeekly: 40, // hours/week (private sector)
  legalWeeklyAgriculture: 48, // hours/week (agriculture)
  monthlyHours: 173.33, // (40h × 52 weeks) / 12 months
} as const;

// ========================================
// Overtime Multipliers
// ========================================
export const OVERTIME_MULTIPLIERS = {
  hours_41_to_46: 1.15, // 15% increase
  hours_above_46: 1.50, // 50% increase
  night: 1.75, // 75% increase
  sunday_or_holiday: 1.75, // 75% increase
  night_sunday_or_holiday: 2.00, // 100% increase
} as const;

// ========================================
// Overtime Limits
// ========================================
export const OVERTIME_LIMITS = {
  maxHoursPerWeek: 15,
  maxHoursPerDay: 3,
} as const;

// ========================================
// Currency
// ========================================
export const CURRENCY = 'XOF'; // West African CFA Franc

// ========================================
// Days in Month (for proration)
// ========================================
export const STANDARD_DAYS_IN_MONTH = 30;
