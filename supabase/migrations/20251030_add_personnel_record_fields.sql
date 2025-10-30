-- Migration: Add missing personnel record fields to employees table
-- Only adds NEW fields that don't already exist

-- Add missing personal information fields to employees table
ALTER TABLE employees
  -- Nationality classification
  ADD COLUMN IF NOT EXISTS nationality_zone VARCHAR(10) CHECK (nationality_zone IN ('CEDEAO', 'HORS_CEDEAO', 'LOCAL')),

  -- Employee classification
  ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50) CHECK (employee_type IN ('LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE')),

  -- Parent names (required for legal documents in West Africa)
  ADD COLUMN IF NOT EXISTS father_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255),

  -- Emergency contact
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),

  -- Birth information
  ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(255);

-- Add indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_employees_nationality_zone ON employees(nationality_zone);
CREATE INDEX IF NOT EXISTS idx_employees_employee_type ON employees(employee_type);

-- Add column comments for clarity
COMMENT ON COLUMN employees.nationality_zone IS 'Nationality classification: CEDEAO (West African Economic Community) or HORS_CEDEAO (non-West African)';
COMMENT ON COLUMN employees.employee_type IS 'Employment classification: LOCAL (local hire), EXPAT (expatriate), DETACHE (seconded), STAGIAIRE (intern)';
COMMENT ON COLUMN employees.father_name IS 'Father''s full name (required for official employment records in many West African countries)';
COMMENT ON COLUMN employees.mother_name IS 'Mother''s full name (required for official employment records in many West African countries)';
COMMENT ON COLUMN employees.place_of_birth IS 'Place/city of birth (required for legal documents and identity verification)';
COMMENT ON COLUMN employees.emergency_contact_name IS 'Emergency contact person''s full name';
