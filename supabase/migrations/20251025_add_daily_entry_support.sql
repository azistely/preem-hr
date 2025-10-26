-- Add Daily Entry Support to Variable Pay Inputs
-- Allows multiple entries per component per period (for daily workers, performance bonuses)

-- ============================================================================
-- 1. Add entry_date column
-- ============================================================================

ALTER TABLE variable_pay_inputs
ADD COLUMN entry_date DATE;

-- Set entry_date to period start for existing records
UPDATE variable_pay_inputs
SET entry_date = period
WHERE entry_date IS NULL;

-- Make entry_date required for new records
ALTER TABLE variable_pay_inputs
ALTER COLUMN entry_date SET NOT NULL;

-- ============================================================================
-- 2. Update unique constraint to support multiple entries
-- ============================================================================

-- Drop old constraint (one entry per component per period)
ALTER TABLE variable_pay_inputs
DROP CONSTRAINT unique_employee_component_period;

-- Add new constraint (one entry per component per DATE)
ALTER TABLE variable_pay_inputs
ADD CONSTRAINT unique_employee_component_date
  UNIQUE(tenant_id, employee_id, component_code, entry_date);

-- ============================================================================
-- 3. Add index for period-based queries (payroll calculation)
-- ============================================================================

CREATE INDEX idx_variable_pay_period_sum ON variable_pay_inputs(
  tenant_id,
  employee_id,
  period
);

-- ============================================================================
-- 4. Add helpful comments
-- ============================================================================

COMMENT ON COLUMN variable_pay_inputs.entry_date IS
'Date of this specific entry.
- For daily workers: Date worked (e.g., 2024-10-15)
- For performance bonuses: Date earned or date of entry
- For monthly lump sum: First day of period (e.g., 2024-10-01)
Multiple entries allowed per component per period.';

COMMENT ON COLUMN variable_pay_inputs.period IS
'Period in YYYY-MM-01 format (first day of month).
Used for grouping entries and payroll calculation.
All entries with same period are summed during payroll.';

-- ============================================================================
-- 5. Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Daily entry support migration complete!';
  RAISE NOTICE 'Constraints:';
  RAISE NOTICE '  - One entry per component per DATE (not per period)';
  RAISE NOTICE '  - Multiple entries per period are summed during payroll';
  RAISE NOTICE '';
  RAISE NOTICE 'Example usage:';
  RAISE NOTICE '  Daily: Oct 1 (5000), Oct 3 (8000), Oct 15 (6000) → Total: 19,000';
  RAISE NOTICE '  Monthly: Oct 1 (19000) → Total: 19,000';
END $$;
