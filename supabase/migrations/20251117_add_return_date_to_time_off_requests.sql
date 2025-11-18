-- Migration: Add Return Date to Time Off Requests
-- Description: Add explicit "date de reprise" (return-to-work date) field to avoid confusion
--              between "last day of leave" and "first day back at work"
-- Date: 2025-11-17
-- Author: Preem HR Engineering Team
--
-- Context: Previously, users were confused about "date de fin":
--   - Does it mean the last day OFF work?
--   - Or the first day BACK at work?
-- This migration adds explicit return_date field for clarity.

-- Step 1: Add return_date column (nullable initially for backfill)
ALTER TABLE time_off_requests
ADD COLUMN IF NOT EXISTS return_date DATE;

-- Step 2: Backfill existing records with simple calculation
-- NOTE: This uses basic date arithmetic (end_date + 1).
--       The application will recalculate properly accounting for weekends/holidays
--       when these records are next updated.
UPDATE time_off_requests
SET return_date = end_date + INTERVAL '1 day'
WHERE return_date IS NULL;

-- Step 3: Make return_date NOT NULL now that all rows have values
ALTER TABLE time_off_requests
ALTER COLUMN return_date SET NOT NULL;

-- Step 4: Add constraint: return_date must be after end_date
ALTER TABLE time_off_requests
ADD CONSTRAINT chk_return_date_after_end_date
  CHECK (return_date > end_date);

-- Step 5: Create index for queries filtering by return date
CREATE INDEX IF NOT EXISTS idx_time_off_return_date
  ON time_off_requests(return_date)
  WHERE status IN ('approved', 'pending');

-- Step 6: Create index for finding current absences
-- (employees who are off today: start_date <= today < return_date)
CREATE INDEX IF NOT EXISTS idx_time_off_current_absences
  ON time_off_requests(employee_id, start_date, return_date)
  WHERE status = 'approved';

-- Step 7: Add documentation comments
COMMENT ON COLUMN time_off_requests.return_date IS
  'Date de reprise du travail (first day back at work). Must be strictly after end_date. Calculated to skip weekends and public holidays.';

COMMENT ON COLUMN time_off_requests.start_date IS
  'Date de début du congé (first day of leave, inclusive)';

COMMENT ON COLUMN time_off_requests.end_date IS
  'Dernier jour de congé (last day of leave, inclusive). The employee returns to work on return_date.';

-- Step 8: Update trigger to prevent modification of dates after ACP payment
-- (extend existing prevent_acp_modification function to include return_date)
CREATE OR REPLACE FUNCTION prevent_acp_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changes to leave requests that have already been paid ACP
  IF OLD.acp_paid_at IS NOT NULL THEN
    IF NEW.start_date != OLD.start_date OR NEW.end_date != OLD.end_date OR NEW.return_date != OLD.return_date THEN
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

-- Step 9: Create view for employees currently on leave
CREATE OR REPLACE VIEW employees_currently_on_leave AS
SELECT
  tor.id AS time_off_request_id,
  tor.tenant_id,
  tor.employee_id,
  e.employee_number,
  e.first_name || ' ' || e.last_name AS employee_name,
  e.department_id,
  d.name AS department_name,
  tor.policy_id,
  p.name AS policy_name,
  p.policy_type,
  tor.start_date,
  tor.end_date,
  tor.return_date,
  tor.days_requested AS total_days,
  tor.reason,
  CURRENT_DATE - tor.start_date + 1 AS days_elapsed,
  tor.return_date - CURRENT_DATE AS days_remaining
FROM time_off_requests tor
JOIN employees e ON tor.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN time_off_policies p ON tor.policy_id = p.id
WHERE tor.status = 'approved'
  AND tor.start_date <= CURRENT_DATE
  AND tor.return_date > CURRENT_DATE
ORDER BY tor.return_date ASC;

ALTER VIEW employees_currently_on_leave SET (security_invoker = true);

COMMENT ON VIEW employees_currently_on_leave IS
  'All employees currently on approved leave (start_date <= today < return_date). Useful for absence tracking and coverage planning.';

-- Migration success message
DO $$
BEGIN
  RAISE NOTICE '✅ return_date field added to time_off_requests table successfully';
  RAISE NOTICE '✅ Backfilled % existing records with simple date arithmetic', (SELECT COUNT(*) FROM time_off_requests);
  RAISE NOTICE '✅ Constraint added: return_date > end_date';
  RAISE NOTICE '✅ Indexes created for performance optimization';
  RAISE NOTICE '✅ View created: employees_currently_on_leave';
  RAISE NOTICE 'ℹ️  Note: Application will recalculate return_date accounting for weekends/holidays on next update';
END $$;
