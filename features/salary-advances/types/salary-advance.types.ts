/**
 * Salary Advances - TypeScript Type Definitions
 *
 * Comprehensive type definitions for salary advance management including:
 * - Request/response types for tRPC endpoints
 * - Validation result types
 * - Calculation types (repayment schedules)
 * - UI state types
 *
 * These types complement the database schema types from Drizzle ORM.
 */

import type {
  SalaryAdvance,
  SalaryAdvanceRepayment,
  SalaryAdvancePolicy,
  AdvanceStatusValue,
  RepaymentStatusValue,
} from '@/lib/db/schema/salary-advances';

/**
 * ============================================================================
 * Request Input Types (for tRPC endpoints)
 * ============================================================================
 */

/**
 * Employee advance request input
 */
export interface AdvanceRequestInput {
  requestedAmount: number;
  repaymentMonths: number;
  requestReason: string;
  requestNotes?: string;
}

/**
 * HR/Manager approval input
 */
export interface AdvanceApprovalInput {
  advanceId: string;
  approved: boolean;
  approvedAmount?: number; // Can adjust amount during approval
  rejectedReason?: string;
}

/**
 * Update advance request (employee can edit pending requests)
 */
export interface AdvanceUpdateInput {
  advanceId: string;
  requestedAmount?: number;
  repaymentMonths?: number;
  requestReason?: string;
  requestNotes?: string;
}

/**
 * Filter/query parameters for listing advances
 */
export interface AdvanceListFilters {
  employeeId?: string;
  status?: AdvanceStatusValue | AdvanceStatusValue[];
  dateFrom?: string; // ISO date string
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * ============================================================================
 * Validation Types
 * ============================================================================
 */

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

/**
 * Validation warning (non-blocking)
 */
export interface ValidationWarning {
  code: string;
  message: string;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  maxAllowedAmount: number;
  employeeNetSalary: number;
  outstandingAdvancesCount: number;
  requestsThisMonth: number;
}

/**
 * Quick validation check (before full form submission)
 */
export interface QuickValidationInput {
  employeeId?: string; // Optional - defaults to current user's employee
  requestedAmount: number;
  repaymentMonths: number;
}

/**
 * ============================================================================
 * Calculation Types
 * ============================================================================
 */

/**
 * Single repayment installment
 */
export interface RepaymentInstallment {
  installmentNumber: number;
  dueMonth: string; // YYYY-MM-01 format
  amount: number;
  status?: RepaymentStatusValue;
}

/**
 * Complete repayment schedule
 */
export interface RepaymentSchedule {
  advanceId?: string;
  totalAmount: number;
  repaymentMonths: number;
  monthlyDeduction: number;
  firstDeductionMonth: string; // YYYY-MM-01
  installments: RepaymentInstallment[];
}

/**
 * Calculation input for repayment schedule generator
 */
export interface RepaymentCalculationInput {
  amount: number;
  repaymentMonths: number;
  disbursementDate?: Date | string;
}

/**
 * ============================================================================
 * Extended/Enriched Types (with joined data)
 * ============================================================================
 */

/**
 * Salary advance with employee details
 */
export interface SalaryAdvanceWithEmployee extends SalaryAdvance {
  employee?: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email?: string;
    position?: string;
  };
  approver?: {
    id: string;
    name: string;
    email?: string;
  };
  rejecter?: {
    id: string;
    name: string;
    email?: string;
  };
  repayments?: SalaryAdvanceRepayment[];
  repaymentSchedule?: RepaymentSchedule;
}

/**
 * Repayment with advance details
 */
export interface RepaymentWithAdvance extends SalaryAdvanceRepayment {
  advance?: {
    id: string;
    requestedAmount: number;
    approvedAmount: number | null;
    employeeName: string | null;
    employeeNumber: string | null;
  };
}

/**
 * ============================================================================
 * Dashboard/Statistics Types
 * ============================================================================
 */

/**
 * Advance statistics for dashboard
 */
export interface AdvanceStatistics {
  // Pending approvals
  pendingCount: number;
  pendingTotalAmount: number;

  // Active advances being repaid
  activeCount: number;
  activeTotalBalance: number;

  // This month's deductions
  thisMonthDeductionsCount: number;
  thisMonthDeductionsAmount: number;

  // Completed (last 30 days)
  recentlyCompletedCount: number;

  // Rejected (last 30 days)
  recentlyRejectedCount: number;

  // By status breakdown
  byStatus: Record<AdvanceStatusValue, { count: number; totalAmount: number }>;
}

/**
 * Employee-specific statistics
 */
export interface EmployeeAdvanceStats {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;

  // Current state
  hasActiveAdvance: boolean;
  activeAdvanceBalance: number;
  nextDeductionAmount: number;
  nextDeductionMonth: string | null;

  // Policy limits
  maxAllowedAmount: number;
  canRequestNewAdvance: boolean;
  requestsThisMonth: number;

  // History
  totalAdvancesReceived: number;
  totalAmountBorrowed: number;
  totalAmountRepaid: number;
}

/**
 * ============================================================================
 * Policy Configuration Types
 * ============================================================================
 */

/**
 * Policy update input (HR/Admin only)
 */
export interface PolicyUpdateInput {
  policyId: string;
  maxPercentageOfNetSalary?: number;
  maxAbsoluteAmount?: number | null;
  minAdvanceAmount?: number;
  maxOutstandingAdvances?: number;
  maxRequestsPerMonth?: number;
  minEmploymentMonths?: number;
  allowedRepaymentMonths?: number[];
  requiresManagerApproval?: boolean;
  requiresHrApproval?: boolean;
  autoApproveBelowAmount?: number | null;
}

/**
 * Policy create input (for new tenants)
 */
export interface PolicyCreateInput extends Omit<PolicyUpdateInput, 'policyId'> {
  countryCode: string;
  effectiveFrom?: string; // ISO date
}

/**
 * ============================================================================
 * UI State Types
 * ============================================================================
 */

/**
 * Form state for advance request
 */
export interface AdvanceRequestFormState {
  step: 1 | 2 | 3; // Wizard steps
  requestedAmount: string; // String for input control
  repaymentMonths: number;
  requestReason: string;
  requestNotes: string;
  isValidating: boolean;
  validationResult: ValidationResult | null;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Form state for approval
 */
export interface AdvanceApprovalFormState {
  approved: boolean | null;
  approvedAmount: string; // Can adjust amount
  rejectedReason: string;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Filter state for advances list
 */
export interface AdvanceListFilterState {
  status: AdvanceStatusValue[];
  employeeSearch: string;
  dateFrom: string | null;
  dateTo: string | null;
  sortBy: 'requestDate' | 'amount' | 'status';
  sortOrder: 'asc' | 'desc';
}

/**
 * ============================================================================
 * Payroll Integration Types
 * ============================================================================
 */

/**
 * Advance disbursement info for payroll
 */
export interface AdvanceDisbursementInfo {
  advanceId: string;
  employeeId: string;
  amount: number;
  description: string;
}

/**
 * Advance deduction info for payroll
 */
export interface AdvanceDeductionInfo {
  advanceId: string;
  repaymentId: string;
  employeeId: string;
  amount: number;
  installmentNumber: number;
  description: string;
}

/**
 * Payroll period advances summary
 */
export interface PayrollPeriodAdvances {
  periodStart: string;
  periodEnd: string;

  // Disbursements (adding to gross)
  disbursements: AdvanceDisbursementInfo[];
  totalDisbursements: number;

  // Deductions (subtracting from net)
  deductions: AdvanceDeductionInfo[];
  totalDeductions: number;
}

/**
 * ============================================================================
 * Notification Types
 * ============================================================================
 */

/**
 * Advance notification event
 */
export interface AdvanceNotification {
  type: 'request_submitted' | 'request_approved' | 'request_rejected' | 'disbursed' | 'deduction_processed' | 'completed';
  advanceId: string;
  employeeId: string;
  recipientIds: string[]; // User IDs to notify
  data: {
    advanceAmount: number;
    employeeName: string;
    requestReason?: string;
    rejectedReason?: string;
    [key: string]: any;
  };
}

/**
 * ============================================================================
 * Audit/Export Types
 * ============================================================================
 */

/**
 * Advance register entry (for compliance export)
 */
export interface AdvanceRegisterEntry {
  advanceId: string;
  employeeName: string;
  employeeNumber: string;
  requestDate: string;
  approvedDate: string | null;
  approvedAmount: number | null;
  disbursementDate: string | null;
  repaymentMonths: number;
  status: AdvanceStatusValue;
  totalRepaid: number;
  remainingBalance: number | null;
}

/**
 * Export parameters for advance register
 */
export interface AdvanceRegisterExportParams {
  dateFrom: string;
  dateTo: string;
  status?: AdvanceStatusValue[];
  format: 'excel' | 'pdf' | 'csv';
}

/**
 * ============================================================================
 * Error Types
 * ============================================================================
 */

/**
 * Custom error for advance operations
 */
export class AdvanceOperationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AdvanceOperationError';
  }
}

/**
 * Error codes
 */
export const AdvanceErrorCodes = {
  // Validation errors
  AMOUNT_TOO_HIGH: 'AMOUNT_TOO_HIGH',
  AMOUNT_TOO_LOW: 'AMOUNT_TOO_LOW',
  INVALID_REPAYMENT_PERIOD: 'INVALID_REPAYMENT_PERIOD',
  INSUFFICIENT_EMPLOYMENT: 'INSUFFICIENT_EMPLOYMENT',
  TOO_MANY_OUTSTANDING: 'TOO_MANY_OUTSTANDING',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  SMIG_VIOLATION: 'SMIG_VIOLATION',

  // Business logic errors
  NO_POLICY: 'NO_POLICY',
  NO_ACTIVE_SALARY: 'NO_ACTIVE_SALARY',
  EMPLOYEE_NOT_FOUND: 'EMPLOYEE_NOT_FOUND',
  ADVANCE_NOT_FOUND: 'ADVANCE_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  ALREADY_APPROVED: 'ALREADY_APPROVED',
  ALREADY_DISBURSED: 'ALREADY_DISBURSED',
  CANNOT_CANCEL: 'CANNOT_CANCEL',

  // Permission errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_ALLOWED: 'NOT_ALLOWED',
} as const;

export type AdvanceErrorCode = typeof AdvanceErrorCodes[keyof typeof AdvanceErrorCodes];

/**
 * ============================================================================
 * Utility Types
 * ============================================================================
 */

/**
 * Advance list response
 */
export interface AdvanceListResponse {
  advances: SalaryAdvanceWithEmployee[];
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

/**
 * Repayment list response
 */
export interface RepaymentListResponse {
  repayments: RepaymentWithAdvance[];
  total: number;
}

/**
 * Single advance response (with full details)
 */
export interface AdvanceDetailResponse extends SalaryAdvanceWithEmployee {
  policy: SalaryAdvancePolicy;
  repaymentSchedule: RepaymentSchedule;
  canEdit: boolean;
  canCancel: boolean;
  canApprove: boolean;
}
