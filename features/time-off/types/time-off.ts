/**
 * Time-Off Types
 *
 * Type definitions for time-off policies, balances, and requests
 */

export interface TimeOffPolicy {
  id: string;
  name: string;
  description?: string;
  allowanceType: 'fixed' | 'accrued';
  defaultDays?: number;
  accrualRate?: number;
  carryoverAllowed: boolean;
  maxCarryover?: number;
  requiresApproval: boolean;
}

export interface TimeOffBalance {
  id: string;
  employeeId: string;
  policyId: string;
  policy: TimeOffPolicy;
  balance: number | string;
  used: number | string;
  pending: number | string;
  year: number;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  policyId: string;
  policy: TimeOffPolicy;
  startDate: Date | string;
  endDate: Date | string;
  totalDays: number | string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: Date | string | null;
  createdAt: Date | string;
}
