/**
 * Migration: Add Daily/Hourly Rate Type Support
 *
 * Purpose: Enable support for daily and hourly workers (not just monthly salaries)
 *
 * Changes:
 * 1. Add rate_type ENUM to employees table (MONTHLY, DAILY, HOURLY)
 * 2. Add hours_worked to payroll_line_items (for hourly workers)
 * 3. Note: days_worked already exists in payroll_line_items
 *
 * Date: 2025-10-22
 */

-- Step 1: Create rate_type ENUM if it doesn't exist
DO $$ BEGIN
  CREATE TYPE rate_type_enum AS ENUM ('MONTHLY', 'DAILY', 'HOURLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add rate_type column to employees table
-- Use ALTER TABLE ADD COLUMN IF NOT EXISTS to prevent errors on re-run
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'rate_type'
  ) THEN
    ALTER TABLE employees ADD COLUMN rate_type rate_type_enum NOT NULL DEFAULT 'MONTHLY';
    RAISE NOTICE 'Added rate_type column to employees table';
  ELSE
    RAISE NOTICE 'rate_type column already exists in employees table';
  END IF;
END $$;

-- Step 3: Add hours_worked to payroll_line_items
-- Note: days_worked already exists, we only need to add hours_worked
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_line_items' AND column_name = 'hours_worked'
  ) THEN
    ALTER TABLE payroll_line_items
    ADD COLUMN hours_worked numeric(6, 2) DEFAULT 0 CHECK (hours_worked >= 0);
    RAISE NOTICE 'Added hours_worked column to payroll_line_items table';
  ELSE
    RAISE NOTICE 'hours_worked column already exists in payroll_line_items table';
  END IF;
END $$;

-- Step 4: Add index on rate_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_employees_rate_type ON employees(rate_type);

-- Step 5: Add comment documentation
COMMENT ON COLUMN employees.rate_type IS 'Payment frequency: MONTHLY (fixed monthly salary), DAILY (paid per day worked), HOURLY (paid per hour worked)';
COMMENT ON COLUMN payroll_line_items.hours_worked IS 'Total hours worked in the payroll period (for hourly workers). For daily/monthly workers, this is typically 0.';

-- Verification queries
SELECT
  'employees.rate_type' as column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'rate_type';

SELECT
  'payroll_line_items.hours_worked' as column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'payroll_line_items' AND column_name = 'hours_worked';

-- Show sample of existing employees (should all default to MONTHLY)
SELECT
  id,
  first_name,
  last_name,
  rate_type,
  created_at
FROM employees
ORDER BY created_at DESC
LIMIT 5;
