/**
 * Shared types for unified salary preview system
 */

export type SalaryPreviewContext = 'hiring' | 'salary_edit' | 'what_if';

export interface SalaryComponent {
  code: string;
  name: string;
  amount: number;
  category: 'base' | 'allowance' | 'bonus' | 'deduction';
}

export interface ContributionDetail {
  code: string;
  name: string;
  amount: number;
  paidBy: 'employee' | 'employer';
  rate?: number; // Percentage rate (e.g., 0.063 for 6.3%)
  base?: number; // Calculation base
}

export interface OtherTaxDetail {
  code: string;
  name: string;
  amount: number;
  rate: number;
  base: number;
  paidBy: 'employee' | 'employer';
}

export interface SalaryPreviewData {
  // Calculated amounts
  grossSalary: number;
  netSalary: number;
  totalEmployerCost: number;

  // Deductions (aggregated for backward compatibility)
  cnpsEmployee: number;
  cnpsEmployer: number;
  its: number;
  cmuEmployee: number;
  cmuEmployer: number;

  // Detailed breakdowns (NEW)
  contributionDetails?: ContributionDetail[]; // Line-by-line social security contributions
  deductionsDetails?: Array<{
    type: string;
    description: string;
    amount: number;
  }>; // Line-by-line deductions with formatted labels
  otherTaxesDetails?: OtherTaxDetail[]; // Line-by-line other taxes (FDFP, etc.)

  // Components breakdown
  components: SalaryComponent[];

  // Tax context
  fiscalParts: number;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  dependentChildren: number;

  // Contract context
  rateType: 'MONTHLY' | 'DAILY' | 'HOURLY';
  contractType?: 'CDI' | 'CDD' | 'STAGE';

  // Metadata
  countryCode: string;
  currencySymbol: string;

  // Payment period context (for understanding hourly/weekly calculations)
  paymentPeriodContext?: {
    paymentFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    weeklyHoursRegime: string; // e.g., '40h', '44h'
    hoursInPeriod: number; // e.g., 40 for weekly, 8 for daily
    daysInPeriod: number; // e.g., 5 for weekly, 1 for daily
    periodLabel: string; // French label: 'jour', 'semaine', 'mois'
  };
}

export interface SalaryPreviewComparison {
  // Full comparison (optional - for detailed before/after)
  current?: SalaryPreviewData;
  new?: SalaryPreviewData;

  // Simple comparison (required - for quick display)
  previousNetSalary?: number;
  newNetSalary?: number;
  netDifference: number;
  employerCostDifference?: number;
}
