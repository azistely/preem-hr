-- Migration: Add Missing Employee Fields
-- Date: 2025-11-01
-- Description: Add contract, document, and employment fields missing from employees table

-- Add contract-related fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) DEFAULT 'CDI',
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Add document expiry fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS national_id_expiry DATE,
ADD COLUMN IF NOT EXISTS work_permit_expiry DATE;

-- Add employment classification fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS sector VARCHAR(100),
ADD COLUMN IF NOT EXISTS sector_code_cgeci VARCHAR(50),
ADD COLUMN IF NOT EXISTS convention_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS professional_level INTEGER CHECK (professional_level >= 1 AND professional_level <= 10);

-- Add constraint for contract_type
ALTER TABLE employees
ADD CONSTRAINT valid_contract_type CHECK (
  contract_type IN ('CDI', 'CDD', 'CDDTI', 'STAGE')
);

-- Add constraint for CDD end date requirement
ALTER TABLE employees
ADD CONSTRAINT valid_cdd_end_date CHECK (
  (contract_type = 'CDI' AND contract_end_date IS NULL) OR
  (contract_type IN ('CDD', 'CDDTI', 'STAGE') AND contract_end_date IS NOT NULL)
);

-- Add constraint for contract dates
ALTER TABLE employees
ADD CONSTRAINT valid_contract_dates CHECK (
  contract_end_date IS NULL OR contract_end_date > COALESCE(contract_start_date, hire_date)
);

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_employees_contract_type
ON employees(tenant_id, contract_type);

CREATE INDEX IF NOT EXISTS idx_employees_contract_end_date
ON employees(tenant_id, contract_end_date)
WHERE contract_type IN ('CDD', 'CDDTI', 'STAGE') AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_employees_sector
ON employees(sector)
WHERE sector IS NOT NULL;

-- Comment on new columns
COMMENT ON COLUMN employees.contract_type IS 'Type of employment contract: CDI (permanent), CDD (fixed-term), CDDTI (temporary tasks), STAGE (internship)';
COMMENT ON COLUMN employees.contract_start_date IS 'Contract start date (may differ from hire_date for renewals)';
COMMENT ON COLUMN employees.contract_end_date IS 'Contract end date (required for CDD, CDDTI, STAGE)';
COMMENT ON COLUMN employees.national_id_expiry IS 'National ID / CNI expiration date';
COMMENT ON COLUMN employees.work_permit_expiry IS 'Work permit expiration date (for foreign workers)';
COMMENT ON COLUMN employees.sector IS 'Industry sector (SERVICES, INDUSTRY, AGRICULTURE, etc.)';
COMMENT ON COLUMN employees.sector_code_cgeci IS 'CGECI sector code for Côte d''Ivoire';
COMMENT ON COLUMN employees.convention_code IS 'Collective bargaining agreement code';
COMMENT ON COLUMN employees.professional_level IS 'Professional level (1-10) for career progression';
