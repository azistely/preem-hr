/**
 * Overtime Types
 *
 * Type definitions for overtime calculations and summaries
 */

export interface OvertimeBreakdown {
  regular: number; // Regular hours (up to 40)
  hours_41_to_46?: number; // Hours 41-46 (CI: x1.15)
  hours_above_46?: number; // Hours 46+ (CI: x1.50)
  night_work?: number; // Night hours (21h-6h, CI: x1.75)
  saturday?: number; // Saturday hours (CI: x1.50)
  sunday?: number; // Sunday hours (CI: x1.75)
  public_holiday?: number; // Public holiday hours (CI: x2.00)
  weekend?: number; // Deprecated: use saturday/sunday instead
  totalOvertimeHours?: number; // Total overtime hours (calculated field)
  overtimePay?: number; // Total overtime pay (calculated field)
}

export interface OvertimeSummary {
  totalOvertimeHours: number;
  overtimePay?: number; // Total overtime pay (optional calculated field)
  breakdown: OvertimeBreakdown;
  periodStart: Date | string;
  periodEnd: Date | string;
}
