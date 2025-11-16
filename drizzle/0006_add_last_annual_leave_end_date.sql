-- Migration: Add last_annual_leave_end_date column to employees
-- Date: 2025-11-16
-- Purpose: Track when employee returned from last annual leave (before system implementation)
--          Used to determine ACP reference period start date
--
-- Context:
-- - ACP reference period = "depuis les derniers congés ou depuis la date d'embauche"
-- - During employee import, HR can specify the last annual leave end date
-- - Formula: Reference Period = last_annual_leave_end_date + 1 day → ACP payment date - 1 day
-- - If NULL, reference period starts from hire_date

-- Add column (nullable, default NULL for existing employees)
ALTER TABLE employees
ADD COLUMN last_annual_leave_end_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN employees.last_annual_leave_end_date IS
'Date when employee returned from their last annual leave (before system implementation). Used to calculate ACP reference period start date. If NULL, reference period starts from hire_date.';

-- Example: Employee took leave from 2024-08-01 to 2024-08-15
-- last_annual_leave_end_date = 2024-08-15
-- ACP reference period starts = 2024-08-16 (day after return)
