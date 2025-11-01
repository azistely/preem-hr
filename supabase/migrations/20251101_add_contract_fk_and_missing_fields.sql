-- Migration: Add Contract FK and Missing Employee Fields
-- Date: 2025-11-01
-- Description: Add foreign key to employment_contracts and non-contract fields to employees table
-- Architecture: Option A (Pure Foreign Key) - Single source of truth for contract data

-- ============================================================================
-- Part 1: Add Foreign Key to employment_contracts
-- ============================================================================

-- Add current_contract_id to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS current_contract_id UUID REFERENCES employment_contracts(id);

-- Create index for fast lookups (payroll queries)
CREATE INDEX IF NOT EXISTS idx_employees_current_contract
ON employees(current_contract_id)
WHERE current_contract_id IS NOT NULL;

-- Add index to employment_contracts for efficient JOIN
CREATE INDEX IF NOT EXISTS idx_employment_contracts_employee_active
ON employment_contracts(employee_id, is_active)
WHERE is_active = true;

-- ============================================================================
-- Part 2: Add Non-Contract Fields to employees table
-- ============================================================================
-- These fields are employee attributes, not contract attributes

-- Document expiry fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS national_id_expiry DATE,
ADD COLUMN IF NOT EXISTS work_permit_expiry DATE;

-- Employment classification fields (for payroll calculations)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS sector VARCHAR(100),
ADD COLUMN IF NOT EXISTS sector_code_cgeci VARCHAR(50),
ADD COLUMN IF NOT EXISTS convention_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS professional_level INTEGER CHECK (professional_level >= 1 AND professional_level <= 10);

-- Create index for sector-based queries
CREATE INDEX IF NOT EXISTS idx_employees_sector
ON employees(sector)
WHERE sector IS NOT NULL;

-- ============================================================================
-- Part 3: Add Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN employees.current_contract_id IS 'Foreign key to active employment contract. Use JOIN to get contract details (type, dates, etc.)';
COMMENT ON COLUMN employees.national_id_expiry IS 'National ID / CNI expiration date';
COMMENT ON COLUMN employees.work_permit_expiry IS 'Work permit expiration date (for foreign workers)';
COMMENT ON COLUMN employees.sector IS 'Industry sector (SERVICES, INDUSTRY, AGRICULTURE, etc.) - used for sector-specific contribution rates';
COMMENT ON COLUMN employees.sector_code_cgeci IS 'CGECI sector code for Côte d''Ivoire';
COMMENT ON COLUMN employees.convention_code IS 'Collective bargaining agreement code (INTERPRO, BANKING, BTP, etc.)';
COMMENT ON COLUMN employees.professional_level IS 'Professional level (1-10) for career progression and banking sector seniority';

-- ============================================================================
-- Part 4: Data Migration (if needed)
-- ============================================================================

-- If there are employees without contracts, create default CDI contracts
-- This ensures referential integrity and proper contract management

DO $$
DECLARE
  employee_record RECORD;
  new_contract_id UUID;
BEGIN
  -- Find employees without contracts
  FOR employee_record IN
    SELECT id, tenant_id, hire_date, created_by
    FROM employees
    WHERE current_contract_id IS NULL
      AND status = 'active'
  LOOP
    -- Create default CDI contract
    INSERT INTO employment_contracts (
      tenant_id,
      employee_id,
      contract_type,
      start_date,
      is_active,
      created_by
    ) VALUES (
      employee_record.tenant_id,
      employee_record.id,
      'CDI',
      COALESCE(employee_record.hire_date, CURRENT_DATE),
      true,
      employee_record.created_by
    )
    RETURNING id INTO new_contract_id;

    -- Update employee with new contract
    UPDATE employees
    SET current_contract_id = new_contract_id
    WHERE id = employee_record.id;

    RAISE NOTICE 'Created default CDI contract for employee %', employee_record.id;
  END LOOP;
END $$;

-- ============================================================================
-- Part 5: Verify Migration
-- ============================================================================

-- Check that all active employees have contracts
DO $$
DECLARE
  missing_contracts INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO missing_contracts
  FROM employees
  WHERE status = 'active'
    AND current_contract_id IS NULL;

  IF missing_contracts > 0 THEN
    RAISE WARNING '% active employees still missing contracts', missing_contracts;
  ELSE
    RAISE NOTICE 'All active employees have contracts assigned';
  END IF;
END $$;
