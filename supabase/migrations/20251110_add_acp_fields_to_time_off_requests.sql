-- Migration: Add ACP Tracking Fields to Time Off Requests Table
-- Description: Track ACP payment status and deductibility for each leave request
-- Date: 2025-11-10
-- Author: Preem HR Engineering Team

-- Add ACP tracking fields
ALTER TABLE time_off_requests
ADD COLUMN IF NOT EXISTS is_deductible_for_acp BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS acp_amount NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS acp_paid_in_payroll_run_id UUID REFERENCES payroll_runs(id),
ADD COLUMN IF NOT EXISTS acp_paid_at TIMESTAMPTZ;

-- Create indexes for ACP calculation queries
CREATE INDEX IF NOT EXISTS idx_time_off_acp_tracking
  ON time_off_requests(employee_id, is_deductible_for_acp)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_time_off_acp_payment
  ON time_off_requests(acp_paid_in_payroll_run_id)
  WHERE acp_paid_in_payroll_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_time_off_acp_paid_at
  ON time_off_requests(acp_paid_at)
  WHERE acp_paid_at IS NOT NULL;

-- Create index for finding unpaid approved leave
CREATE INDEX IF NOT EXISTS idx_time_off_unpaid_leave
  ON time_off_requests(employee_id, start_date, end_date)
  WHERE status = 'approved' AND acp_paid_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN time_off_requests.is_deductible_for_acp IS
  'FALSE if this absence should reduce paid days for ACP calculation (e.g., unpaid leave, permission, unjustified absence). Default TRUE for annual leave.';

COMMENT ON COLUMN time_off_requests.acp_amount IS
  'ACP amount paid for this leave request (if applicable). Calculated during payroll run.';

COMMENT ON COLUMN time_off_requests.acp_paid_in_payroll_run_id IS
  'Reference to payroll run that paid the ACP for this leave (prevents double payment)';

COMMENT ON COLUMN time_off_requests.acp_paid_at IS
  'Timestamp when ACP was paid for this leave request';

-- Add constraint: acp_amount must be non-negative
ALTER TABLE time_off_requests
ADD CONSTRAINT chk_acp_amount_non_negative
  CHECK (acp_amount IS NULL OR acp_amount >= 0);

-- Add constraint: if acp_paid_at is set, acp_paid_in_payroll_run_id must also be set
ALTER TABLE time_off_requests
ADD CONSTRAINT chk_acp_payment_consistency
  CHECK (
    (acp_paid_at IS NULL AND acp_paid_in_payroll_run_id IS NULL) OR
    (acp_paid_at IS NOT NULL AND acp_paid_in_payroll_run_id IS NOT NULL)
  );

-- Update existing records: Set default values
-- Annual leave is deductible (TRUE), other types may vary
UPDATE time_off_requests
SET is_deductible_for_acp = TRUE
WHERE is_deductible_for_acp IS NULL;

-- Create function to auto-mark certain leave types as non-deductible
CREATE OR REPLACE FUNCTION auto_set_acp_deductibility()
RETURNS TRIGGER AS $$
DECLARE
  policy_type TEXT;
BEGIN
  -- Get policy type for this request
  SELECT pt.policy_type INTO policy_type
  FROM time_off_policies pt
  WHERE pt.id = NEW.policy_id;

  -- Auto-mark unpaid leave and permissions as non-deductible
  -- These reduce "jours payés" in ACP calculation
  IF policy_type IN ('unpaid', 'permission') THEN
    NEW.is_deductible_for_acp := FALSE;
  ELSE
    -- Default to TRUE for other types (annual, sick, maternity, etc.)
    NEW.is_deductible_for_acp := COALESCE(NEW.is_deductible_for_acp, TRUE);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set deductibility on insert
CREATE TRIGGER trigger_auto_set_acp_deductibility
  BEFORE INSERT ON time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_acp_deductibility();

-- Create view for non-deductible absences (used in ACP calculation)
CREATE OR REPLACE VIEW non_deductible_absences AS
SELECT
  tor.id,
  tor.tenant_id,
  tor.employee_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name AS employee_name,
  tor.policy_id,
  p.name AS policy_name,
  p.policy_type,
  tor.start_date,
  tor.end_date,
  tor.days_requested,
  tor.status,
  tor.is_deductible_for_acp,
  tor.created_at
FROM time_off_requests tor
JOIN employees e ON tor.employee_id = e.id
LEFT JOIN time_off_policies p ON tor.policy_id = p.id
WHERE tor.is_deductible_for_acp = FALSE
  AND tor.status = 'approved'
ORDER BY tor.start_date DESC;

ALTER VIEW non_deductible_absences SET (security_invoker = true);

COMMENT ON VIEW non_deductible_absences IS
  'All approved absences that reduce paid days in ACP calculation (permissions, unpaid leave, unjustified absences)';

-- Create view for ACP payment tracking
CREATE OR REPLACE VIEW acp_payments_by_leave AS
SELECT
  tor.id AS time_off_request_id,
  tor.tenant_id,
  tor.employee_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name AS employee_name,
  tor.start_date,
  tor.end_date,
  tor.days_requested,
  tor.acp_amount,
  tor.acp_paid_at,
  tor.acp_paid_in_payroll_run_id,
  pr.period_start AS payroll_period_start,
  pr.period_end AS payroll_period_end,
  pr.status AS payroll_run_status
FROM time_off_requests tor
JOIN employees e ON tor.employee_id = e.id
LEFT JOIN payroll_runs pr ON tor.acp_paid_in_payroll_run_id = pr.id
WHERE tor.acp_paid_at IS NOT NULL
ORDER BY tor.acp_paid_at DESC;

ALTER VIEW acp_payments_by_leave SET (security_invoker = true);

COMMENT ON VIEW acp_payments_by_leave IS
  'All leave requests that have received ACP payment, with payroll run details';

-- Create function to prevent modification of paid ACP records
CREATE OR REPLACE FUNCTION prevent_acp_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changes to leave requests that have already been paid ACP
  IF OLD.acp_paid_at IS NOT NULL THEN
    IF NEW.start_date != OLD.start_date OR NEW.end_date != OLD.end_date THEN
      RAISE EXCEPTION 'Cannot modify leave dates after ACP has been paid'
        USING HINT = 'Create a new leave request or cancel this one';
    END IF;

    IF NEW.days_requested != OLD.days_requested THEN
      RAISE EXCEPTION 'Cannot modify leave duration after ACP has been paid'
        USING HINT = 'Create a new leave request or contact payroll to reverse ACP payment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to protect paid ACP records
CREATE TRIGGER trigger_prevent_acp_modification
  BEFORE UPDATE ON time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_acp_modification();

-- Migration success message
DO $$
BEGIN
  RAISE NOTICE 'ACP tracking fields added to time_off_requests table successfully';
  RAISE NOTICE 'Triggers created: auto-set deductibility, prevent modification of paid records';
  RAISE NOTICE 'Views created: non_deductible_absences, acp_payments_by_leave';
END $$;
