-- Migration: Add employee.coefficient field
-- Phase 1 of Architecture Analysis (Week 2)
-- Purpose: Enable coefficient-based calculations (notice periods, minimum wage, severance)

-- Step 1: Add coefficient column with default
-- Default to 100 (category A1 - lowest category, safest default)
ALTER TABLE employees
  ADD COLUMN coefficient INTEGER DEFAULT 100;

-- Step 2: Add constraint for valid coefficient range
-- Convention Collective: coefficients range from 90 (aide non qualifié) to 1000 (cadre supérieur)
ALTER TABLE employees
  ADD CONSTRAINT check_coefficient_range
    CHECK (coefficient >= 90 AND coefficient <= 1000);

-- Step 3: Make coefficient NOT NULL (already has default)
ALTER TABLE employees
  ALTER COLUMN coefficient SET NOT NULL;

-- Step 4: Add index for performance (used in payroll calculations)
CREATE INDEX idx_employees_coefficient ON employees(coefficient);

-- Step 5: Add comment for documentation
COMMENT ON COLUMN employees.coefficient IS 'Employee category coefficient (90-1000) determining notice periods, minimum wage, and severance calculation per Convention Collective Interprofessionnelle';
