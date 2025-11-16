-- Migration: Add historical_unpaid_leave_days column to employees
-- Date: 2025-11-16
-- Purpose: Track unpaid leave taken before system implementation for accurate ACP calculation
--
-- Context:
-- - During employee import, HR can specify historical unpaid leave days
-- - These days are deducted from "total paid days" in ACP calculation
-- - Formula: Total Paid Days = (Months × 30) - Historical Unpaid Days - Current Unpaid Days

-- Add column (nullable, default NULL for existing employees)
ALTER TABLE employees
ADD COLUMN historical_unpaid_leave_days NUMERIC(5, 2);

-- Add comment for documentation
COMMENT ON COLUMN employees.historical_unpaid_leave_days IS
'Total unpaid leave days taken before system implementation (permission, congé sans solde, grève, etc.). Used in ACP calculation to reduce total paid days.';

-- Example update for existing employees (if needed)
-- UPDATE employees
-- SET historical_unpaid_leave_days = 0
-- WHERE historical_unpaid_leave_days IS NULL;

-- Verify column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'employees'
AND column_name = 'historical_unpaid_leave_days';
