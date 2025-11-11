-- Migration: Add CMU Tracking and Identification Fields to Employee Dependents
-- Date: 2025-11-10
-- Description: Adds gender, CNPS/CMU numbers, and coverage certificate tracking
--              to properly handle dependents covered by other employers

-- ============================================================================
-- 1. Add new columns to employee_dependents table
-- ============================================================================

-- Gender field (will be required, but nullable initially for migration)
ALTER TABLE employee_dependents
ADD COLUMN gender varchar(20);

COMMENT ON COLUMN employee_dependents.gender IS 'Gender of dependent: male or female (required for all dependents)';

-- CNPS number (optional - for working dependents with own social security)
ALTER TABLE employee_dependents
ADD COLUMN cnps_number varchar(50);

COMMENT ON COLUMN employee_dependents.cnps_number IS 'CNPS registration number if dependent has own coverage (working adults)';

-- CMU number (optional - for dependents with own health insurance)
ALTER TABLE employee_dependents
ADD COLUMN cmu_number varchar(50);

COMMENT ON COLUMN employee_dependents.cmu_number IS 'CMU registration number if dependent has own coverage';

-- Covered by other employer flag
ALTER TABLE employee_dependents
ADD COLUMN covered_by_other_employer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN employee_dependents.covered_by_other_employer IS 'True if dependent is covered by spouse/another employer CMU (requires certificate)';

-- Coverage certificate fields (required if covered_by_other_employer = true)
ALTER TABLE employee_dependents
ADD COLUMN coverage_certificate_type varchar(100);

COMMENT ON COLUMN employee_dependents.coverage_certificate_type IS 'Type of coverage certificate (e.g., Attestation de couverture CMU)';

ALTER TABLE employee_dependents
ADD COLUMN coverage_certificate_number varchar(100);

COMMENT ON COLUMN employee_dependents.coverage_certificate_number IS 'Certificate reference number';

ALTER TABLE employee_dependents
ADD COLUMN coverage_certificate_url text;

COMMENT ON COLUMN employee_dependents.coverage_certificate_url IS 'Storage URL for uploaded coverage certificate document';

ALTER TABLE employee_dependents
ADD COLUMN coverage_certificate_expiry_date date;

COMMENT ON COLUMN employee_dependents.coverage_certificate_expiry_date IS 'Certificate expiration date (used to validate ongoing coverage)';

-- ============================================================================
-- 2. Add check constraints for data integrity
-- ============================================================================

-- Ensure gender is either 'male' or 'female' when provided
ALTER TABLE employee_dependents
ADD CONSTRAINT check_gender_valid
CHECK (gender IS NULL OR gender IN ('male', 'female'));

-- If covered by other employer, certificate fields must be provided
ALTER TABLE employee_dependents
ADD CONSTRAINT check_coverage_certificate_required
CHECK (
  covered_by_other_employer = false
  OR (
    coverage_certificate_type IS NOT NULL
    AND coverage_certificate_url IS NOT NULL
    AND coverage_certificate_expiry_date IS NOT NULL
  )
);

-- Certificate expiry date must be in future when provided
ALTER TABLE employee_dependents
ADD CONSTRAINT check_coverage_certificate_not_expired
CHECK (
  coverage_certificate_expiry_date IS NULL
  OR coverage_certificate_expiry_date >= CURRENT_DATE
);

-- ============================================================================
-- 3. Create indexes for performance
-- ============================================================================

-- Index on covered_by_other_employer for fast CMU calculation queries
CREATE INDEX idx_employee_dependents_covered_by_other_employer
ON employee_dependents(covered_by_other_employer)
WHERE covered_by_other_employer = true;

-- Index on gender for reporting
CREATE INDEX idx_employee_dependents_gender
ON employee_dependents(gender)
WHERE gender IS NOT NULL;

-- ============================================================================
-- 4. Update existing records
-- ============================================================================

-- For existing dependents without gender, leave as NULL
-- This will be handled through UI prompts and eventual NOT NULL constraint
-- after migration grace period

-- ============================================================================
-- 5. Post-deployment TODO
-- ============================================================================

-- After 4-6 weeks grace period and all dependents have gender filled in:
--
-- ALTER TABLE employee_dependents
-- ALTER COLUMN gender SET NOT NULL;
--
-- This will enforce gender as required field at database level

-- ============================================================================
-- 6. Rollback plan (if needed)
-- ============================================================================

/*
-- To rollback this migration:

DROP INDEX IF EXISTS idx_employee_dependents_covered_by_other_employer;
DROP INDEX IF EXISTS idx_employee_dependents_gender;

ALTER TABLE employee_dependents DROP CONSTRAINT IF EXISTS check_gender_valid;
ALTER TABLE employee_dependents DROP CONSTRAINT IF EXISTS check_coverage_certificate_required;
ALTER TABLE employee_dependents DROP CONSTRAINT IF EXISTS check_coverage_certificate_not_expired;

ALTER TABLE employee_dependents DROP COLUMN IF EXISTS gender;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS cnps_number;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS cmu_number;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS covered_by_other_employer;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS coverage_certificate_type;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS coverage_certificate_number;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS coverage_certificate_url;
ALTER TABLE employee_dependents DROP COLUMN IF EXISTS coverage_certificate_expiry_date;
*/
