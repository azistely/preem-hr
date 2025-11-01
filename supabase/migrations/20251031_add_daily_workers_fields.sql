-- Migration: Add Daily Workers (Journaliers) Support
-- Version: 3.0 from DAILY-WORKERS-ARCHITECTURE-V2.md
-- Date: 2025-10-31
-- Purpose: Add critical fields for daily workers payroll calculation

-- ================================================================
-- EMPLOYEES TABLE EXTENSIONS
-- ================================================================

-- Add weekly hours regime (for hourly divisor calculation)
-- Determines overtime thresholds and hourly rate divisor
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS weekly_hours_regime VARCHAR(10) NOT NULL DEFAULT '40h';

ALTER TABLE employees
  ADD CONSTRAINT IF NOT EXISTS valid_weekly_hours_regime
  CHECK (weekly_hours_regime IN ('40h', '44h', '48h', '52h', '56h'));

COMMENT ON COLUMN employees.weekly_hours_regime IS
  'Weekly hours regime for hourly divisor calculation:
  - 40h: Standard (non-agricultural services)
  - 44h: Retail/commerce
  - 48h: Agriculture, fishing, livestock
  - 52h: Seasonal/temporary
  - 56h: Security, domestic workers
  Formula: hourlyDivisor = (weeklyHours × 52) / 12
  Reference: Décret N° 96-203 Article 3';

-- Add employee type (for contribution employeur calculation)
-- Critical for employer payroll tax (Article 146 CGI)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS employee_type VARCHAR(20) NOT NULL DEFAULT 'local';

ALTER TABLE employees
  ADD CONSTRAINT IF NOT EXISTS valid_employee_type
  CHECK (employee_type IN ('local', 'expatriate'));

COMMENT ON COLUMN employees.employee_type IS
  'Employee residency status for contribution employeur:
  - local: 2.8% employer payroll tax
  - expatriate: 12% employer payroll tax
  Reference: Article 146 du Code Général des Impôts (CGI)';

-- Add payment frequency (separate from contract type)
-- Determines number of payroll closures per month
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE employees
  ADD CONSTRAINT IF NOT EXISTS valid_payment_frequency
  CHECK (payment_frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'));

COMMENT ON COLUMN employees.payment_frequency IS
  'Payment frequency (separate from contract type):
  - MONTHLY: 1 closure/month (standard)
  - WEEKLY: 4 closures/month (semaine 1-4)
  - BIWEEKLY: 2 closures/month (quinzaine 1-2)
  - DAILY: Rare, daily payments
  Note: Contract type ≠ payment frequency. CDDTI can be paid monthly.';

-- ================================================================
-- TENANTS TABLE EXTENSIONS
-- ================================================================

-- Add default daily transport rate (tenant-level configuration)
-- Simplifies transport allowance calculation (per HR clarification)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_daily_transport_rate NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN tenants.default_daily_transport_rate IS
  'Fixed daily transport allowance rate in FCFA.
  Applied as: transportTotal = rate × daysWorked
  HR Clarification (2025-10-31): Fixed rate per company, not by locality.';

-- ================================================================
-- EMPLOYMENT CONTRACTS TABLE EXTENSIONS
-- ================================================================

-- Add CDDTI task description (required by law)
-- Article 4 de la Convention Collective
ALTER TABLE employment_contracts
  ADD COLUMN IF NOT EXISTS cddti_task_description TEXT;

COMMENT ON COLUMN employment_contracts.cddti_task_description IS
  'For CDDTI contracts: description of the imprecise task/project.
  REQUIRED by Article 4 de la Convention Collective.
  Example: "Travaux de récolte saisonnière", "Construction temporaire batiment A"';

-- Add validation constraint: CDDTI requires task description
ALTER TABLE employment_contracts
  DROP CONSTRAINT IF EXISTS cddti_task_required;

ALTER TABLE employment_contracts
  ADD CONSTRAINT cddti_task_required
  CHECK (
    contract_type != 'CDDTI' OR
    (contract_type = 'CDDTI' AND cddti_task_description IS NOT NULL AND length(cddti_task_description) > 10)
  );

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Function: Auto-suggest weekly hours based on employee sector
CREATE OR REPLACE FUNCTION suggest_weekly_hours_for_sector(p_sector VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE
    WHEN p_sector IN ('agriculture', 'élevage', 'pêche', 'agricole') THEN '48h'
    WHEN p_sector IN ('sécurité', 'gardiennage', 'domestique', 'security') THEN '56h'
    WHEN p_sector IN ('commerce', 'retail') THEN '44h'
    WHEN p_sector IN ('saisonnier', 'seasonal') THEN '52h'
    ELSE '40h'
  END;
END;
$$;

COMMENT ON FUNCTION suggest_weekly_hours_for_sector IS
  'Helper function to suggest weekly_hours_regime based on employee sector.
  Used in UI to auto-populate field during employee creation.';

-- Function: Calculate hourly divisor from weekly hours regime
CREATE OR REPLACE FUNCTION calculate_hourly_divisor(p_weekly_hours_regime VARCHAR)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_weekly_hours INTEGER;
BEGIN
  -- Extract numeric part from regime (e.g., '40h' → 40)
  v_weekly_hours := SUBSTRING(p_weekly_hours_regime FROM 1 FOR LENGTH(p_weekly_hours_regime) - 1)::INTEGER;

  -- Formula: (weeklyHours × 52) / 12
  RETURN (v_weekly_hours * 52.0) / 12.0;
END;
$$;

COMMENT ON FUNCTION calculate_hourly_divisor IS
  'Calculate monthly hourly divisor from weekly hours regime.
  Formula: (weeklyHours × 52 weeks) / 12 months
  Example: 40h → (40 × 52) / 12 = 173.33 hours/month
  Reference: Décret N° 96-203 Article 3';

-- Function: Get daily transport rate for employee
CREATE OR REPLACE FUNCTION get_daily_transport_rate(
  p_employee_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  -- Get tenant's default transport rate for employee
  SELECT t.default_daily_transport_rate INTO v_rate
  FROM employees e
  JOIN tenants t ON e.tenant_id = t.id
  WHERE e.id = p_employee_id;

  RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_daily_transport_rate IS
  'Get daily transport allowance rate for an employee.
  Returns tenant''s default_daily_transport_rate.
  HR Clarification (2025-10-31): Fixed per company, not by locality.';

-- ================================================================
-- DATA MIGRATION (existing employees)
-- ================================================================

-- Set weekly_hours_regime based on existing sector field
UPDATE employees
SET weekly_hours_regime = suggest_weekly_hours_for_sector(sector)
WHERE weekly_hours_regime = '40h' AND sector IS NOT NULL;

-- Set employee_type based on existing is_expat flag (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'employees' AND column_name = 'is_expat') THEN
    UPDATE employees
    SET employee_type = CASE WHEN is_expat = true THEN 'expatriate' ELSE 'local' END
    WHERE employee_type = 'local';
  END IF;
END
$$;

-- Set payment_frequency based on existing rate_type
UPDATE employees
SET payment_frequency = CASE
  WHEN rate_type IN ('DAILY', 'HOURLY') THEN 'WEEKLY'
  ELSE 'MONTHLY'
END
WHERE payment_frequency = 'MONTHLY';

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

-- Index for filtering by payment frequency
CREATE INDEX IF NOT EXISTS idx_employees_payment_frequency
  ON employees(tenant_id, payment_frequency)
  WHERE status = 'active';

-- Index for filtering by weekly hours regime
CREATE INDEX IF NOT EXISTS idx_employees_weekly_hours
  ON employees(weekly_hours_regime);

-- Index for filtering by employee type
CREATE INDEX IF NOT EXISTS idx_employees_employee_type
  ON employees(employee_type);

-- Index for CDDTI contracts
CREATE INDEX IF NOT EXISTS idx_employment_contracts_cddti
  ON employment_contracts(employee_id, contract_type, start_date)
  WHERE contract_type = 'CDDTI';

-- ================================================================
-- VERIFICATION QUERIES (for testing)
-- ================================================================

-- Verify employees have valid weekly hours regime
DO $$
DECLARE
  v_invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_invalid_count
  FROM employees
  WHERE weekly_hours_regime NOT IN ('40h', '44h', '48h', '52h', '56h');

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % employees with invalid weekly_hours_regime', v_invalid_count;
  ELSE
    RAISE NOTICE 'All employees have valid weekly_hours_regime ✓';
  END IF;
END
$$;

-- Verify CDDTI contracts have task descriptions
DO $$
DECLARE
  v_missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_count
  FROM employment_contracts
  WHERE contract_type = 'CDDTI'
    AND (cddti_task_description IS NULL OR length(cddti_task_description) <= 10);

  IF v_missing_count > 0 THEN
    RAISE WARNING 'Found % CDDTI contracts missing task description - will need manual update', v_missing_count;
  ELSE
    RAISE NOTICE 'All CDDTI contracts have valid task descriptions ✓';
  END IF;
END
$$;
