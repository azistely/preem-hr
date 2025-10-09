-- Migration: Add family status fields to employees table
-- Date: 2025-10-12
-- Purpose: Support payroll correctness by storing family status for tax calculations

-- Add family status fields to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS dependent_children INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_parts NUMERIC(3,1) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS has_family BOOLEAN DEFAULT false;

-- Add check constraint for valid marital status values
ALTER TABLE employees
  ADD CONSTRAINT valid_marital_status
  CHECK (
    (marital_status = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text]))
    OR (marital_status IS NULL)
  );

-- Set default values for existing employees (assume single with no dependents)
UPDATE employees
SET
  marital_status = 'single',
  dependent_children = 0,
  fiscal_parts = 1.0,
  has_family = false
WHERE marital_status IS NULL;

-- Add comment explaining fiscal_parts calculation
COMMENT ON COLUMN employees.fiscal_parts IS 'Pre-calculated fiscal parts for tax: 1.0 (base) + 1.0 (if married) + 0.5 per child (max 4)';
COMMENT ON COLUMN employees.has_family IS 'Flag indicating if employee has family (married or has children) - used for CMU employer contribution';
COMMENT ON COLUMN employees.marital_status IS 'Marital status: single, married, divorced, widowed - used for tax calculation';
COMMENT ON COLUMN employees.dependent_children IS 'Number of dependent children (0-10) - affects tax calculation via fiscal parts';
