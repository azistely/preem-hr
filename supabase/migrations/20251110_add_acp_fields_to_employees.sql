-- Migration: Add ACP Payment Fields to Employees Table
-- Description: Add fields to enable/configure ACP payment for each employee
-- Date: 2025-11-10
-- Author: Preem HR Engineering Team

-- Add ACP payment activation fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS acp_payment_date DATE,
ADD COLUMN IF NOT EXISTS acp_payment_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS acp_last_paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS acp_notes TEXT;

-- Create index for efficient payroll queries
-- This index helps find employees with active ACP payments in a given period
CREATE INDEX IF NOT EXISTS idx_employees_acp_payment
  ON employees(acp_payment_active, acp_payment_date)
  WHERE acp_payment_active = TRUE;

-- Create index for last payment tracking
CREATE INDEX IF NOT EXISTS idx_employees_acp_last_paid
  ON employees(acp_last_paid_at)
  WHERE acp_last_paid_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN employees.acp_payment_date IS 'Date on which ACP should be calculated and paid (set by HR)';
COMMENT ON COLUMN employees.acp_payment_active IS 'Whether ACP payment is currently active for this employee';
COMMENT ON COLUMN employees.acp_last_paid_at IS 'Timestamp of last ACP payment (prevents double payment)';
COMMENT ON COLUMN employees.acp_notes IS 'HR notes about ACP payment schedule (e.g., "Paie ACP à chaque départ en congés")';

-- Add constraint: acp_payment_date is required when acp_payment_active is TRUE
ALTER TABLE employees
ADD CONSTRAINT chk_acp_payment_date_required
  CHECK (
    (acp_payment_active = FALSE) OR
    (acp_payment_active = TRUE AND acp_payment_date IS NOT NULL)
  );

-- Add constraint: Only CDI and CDD employees can have active ACP
-- INTERIM and STAGE employees are not eligible
ALTER TABLE employees
ADD CONSTRAINT chk_acp_contract_type_eligible
  CHECK (
    (acp_payment_active = FALSE) OR
    (acp_payment_active = TRUE AND contract_type IN ('CDI', 'CDD'))
  );

-- Update existing records: Set acp_payment_active to FALSE for non-CDI/CDD employees
UPDATE employees
SET acp_payment_active = FALSE
WHERE contract_type NOT IN ('CDI', 'CDD')
  AND acp_payment_active = TRUE;

-- Create function to validate ACP activation
CREATE OR REPLACE FUNCTION validate_acp_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- Check contract type eligibility
  IF NEW.acp_payment_active = TRUE THEN
    IF NEW.contract_type NOT IN ('CDI', 'CDD') THEN
      RAISE EXCEPTION 'ACP payment is only applicable to CDI and CDD employees'
        USING HINT = 'Contract type must be CDI or CDD to activate ACP payment';
    END IF;

    IF NEW.acp_payment_date IS NULL THEN
      RAISE EXCEPTION 'ACP payment date is required when ACP is active'
        USING HINT = 'Set acp_payment_date before activating ACP payment';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate ACP activation
CREATE TRIGGER trigger_validate_acp_activation
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION validate_acp_activation();

-- Create view for employees with active ACP
CREATE OR REPLACE VIEW employees_with_active_acp AS
SELECT
  e.id,
  e.tenant_id,
  e.employee_number,
  e.first_name,
  e.last_name,
  e.first_name || ' ' || e.last_name AS full_name,
  e.contract_type,
  e.hire_date,
  e.acp_payment_date,
  e.acp_payment_active,
  e.acp_last_paid_at,
  e.acp_notes,
  -- Calculate years of service for seniority bonus preview
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) AS years_of_service,
  -- Seniority bonus days (Convention Collective Art. 25.2)
  CASE
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) >= 30 THEN 8
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) >= 25 THEN 7
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) >= 20 THEN 5
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) >= 15 THEN 3
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) >= 10 THEN 2
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) >= 5 THEN 1
    ELSE 0
  END AS seniority_bonus_days
FROM employees e
WHERE e.acp_payment_active = TRUE
  AND e.status = 'active'
  AND e.contract_type IN ('CDI', 'CDD')
ORDER BY e.acp_payment_date;

-- Grant SELECT on view with RLS
ALTER VIEW employees_with_active_acp SET (security_invoker = true);

COMMENT ON VIEW employees_with_active_acp IS 'All employees with active ACP payment configuration (CDI/CDD only)';

-- Migration success message
DO $$
BEGIN
  RAISE NOTICE 'ACP fields added to employees table successfully';
  RAISE NOTICE 'Constraints added: acp_payment_date required when active, CDI/CDD only';
  RAISE NOTICE 'View created: employees_with_active_acp';
END $$;
