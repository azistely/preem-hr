-- Migration: Create ACP Payment History Table
-- Description: Audit trail for all ACP payments with full calculation breakdown
-- Date: 2025-11-10
-- Author: Preem HR Engineering Team

-- Create acp_payment_history table
CREATE TABLE IF NOT EXISTS acp_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,

  -- Reference period for this calculation
  reference_period_start DATE NOT NULL,
  reference_period_end DATE NOT NULL,
  number_of_months NUMERIC(5, 2) NOT NULL,

  -- Salary calculation components
  total_gross_taxable_salary NUMERIC(15, 2) NOT NULL,
  total_paid_days INTEGER NOT NULL,
  non_deductible_absence_days INTEGER NOT NULL DEFAULT 0,
  daily_average_salary NUMERIC(15, 2) NOT NULL,

  -- Leave calculation components
  leave_days_accrued_base NUMERIC(5, 2) NOT NULL, -- Base leave accrued (from formula)
  seniority_bonus_days INTEGER NOT NULL DEFAULT 0, -- Seniority bonus (Art. 25.2)
  leave_days_accrued_total NUMERIC(5, 2) NOT NULL, -- Total accrued (base + seniority)
  leave_days_taken_calendar NUMERIC(5, 2) NOT NULL, -- Days actually taken

  -- Final ACP amount paid
  acp_amount NUMERIC(15, 2) NOT NULL,

  -- Reference to configuration used
  acp_configuration_id UUID REFERENCES acp_configuration(id),

  -- Metadata for debugging and audit
  calculation_metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: {
  --   "salaryHistory": [...],
  --   "timeOffRequests": [...],
  --   "formulaInputs": {...}
  -- }

  -- Warnings generated during calculation
  warnings JSONB DEFAULT '[]'::jsonb,
  -- Example: [
  --   {"type": "LEAVE_EXCEEDS_ACCRUAL", "message": "..."},
  --   {"type": "NO_PAYROLL_HISTORY", "message": "..."}
  -- ]

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes for common queries
CREATE INDEX idx_acp_history_employee ON acp_payment_history(employee_id);
CREATE INDEX idx_acp_history_payroll_run ON acp_payment_history(payroll_run_id);
CREATE INDEX idx_acp_history_tenant ON acp_payment_history(tenant_id);
CREATE INDEX idx_acp_history_created ON acp_payment_history(created_at DESC);
CREATE INDEX idx_acp_history_reference_period ON acp_payment_history(reference_period_start, reference_period_end);

-- Create composite index for duplicate detection
CREATE UNIQUE INDEX idx_acp_history_unique_payment
  ON acp_payment_history(employee_id, payroll_run_id);

-- Add constraints
ALTER TABLE acp_payment_history
ADD CONSTRAINT chk_acp_amount_non_negative CHECK (acp_amount >= 0);

ALTER TABLE acp_payment_history
ADD CONSTRAINT chk_daily_salary_positive CHECK (daily_average_salary > 0);

ALTER TABLE acp_payment_history
ADD CONSTRAINT chk_reference_period_valid CHECK (reference_period_end >= reference_period_start);

ALTER TABLE acp_payment_history
ADD CONSTRAINT chk_months_positive CHECK (number_of_months > 0);

-- Add comments for documentation
COMMENT ON TABLE acp_payment_history IS 'Complete audit trail of all ACP (Allocations de Congés Payés) payments with calculation breakdown';
COMMENT ON COLUMN acp_payment_history.reference_period_start IS 'Start of reference period (last leave return or hire date)';
COMMENT ON COLUMN acp_payment_history.reference_period_end IS 'End of reference period (day before leave departure)';
COMMENT ON COLUMN acp_payment_history.total_gross_taxable_salary IS 'Sum of all gross taxable salaries in reference period';
COMMENT ON COLUMN acp_payment_history.total_paid_days IS 'Total paid days in reference period (months × 30 - non-deductible absences)';
COMMENT ON COLUMN acp_payment_history.daily_average_salary IS 'Average daily salary (total gross / total paid days)';
COMMENT ON COLUMN acp_payment_history.leave_days_accrued_base IS 'Base leave accrued using formula: (paid_days / months) × 2.2';
COMMENT ON COLUMN acp_payment_history.seniority_bonus_days IS 'Additional days from seniority (Convention Collective Art. 25.2)';
COMMENT ON COLUMN acp_payment_history.leave_days_taken_calendar IS 'Calendar days of leave taken (used for ACP payment)';
COMMENT ON COLUMN acp_payment_history.acp_amount IS 'Final ACP amount: daily_average_salary × leave_days_taken_calendar';
COMMENT ON COLUMN acp_payment_history.calculation_metadata IS 'Detailed calculation inputs for debugging (JSONB)';
COMMENT ON COLUMN acp_payment_history.warnings IS 'Warnings generated during calculation (e.g., leave exceeds accrual)';

-- Enable RLS
ALTER TABLE acp_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant isolation
CREATE POLICY acp_history_tenant_isolation ON acp_payment_history
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create view for easy reporting
CREATE OR REPLACE VIEW acp_payment_summary AS
SELECT
  h.id,
  h.tenant_id,
  h.employee_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name AS employee_name,
  h.payroll_run_id,
  pr.period_start AS payroll_period_start,
  pr.period_end AS payroll_period_end,
  h.reference_period_start,
  h.reference_period_end,
  h.number_of_months,
  h.daily_average_salary,
  h.leave_days_taken_calendar,
  h.acp_amount,
  h.seniority_bonus_days,
  h.warnings,
  h.created_at AS paid_at
FROM acp_payment_history h
JOIN employees e ON h.employee_id = e.id
JOIN payroll_runs pr ON h.payroll_run_id = pr.id
ORDER BY h.created_at DESC;

-- Grant SELECT on view with same RLS
ALTER VIEW acp_payment_summary SET (security_invoker = true);

COMMENT ON VIEW acp_payment_summary IS 'Simplified view of ACP payments with employee and payroll run details';
