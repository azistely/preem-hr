-- Migration: Add Probation Period Tracking Fields
-- Date: 2025-12-14
-- Description: Adds fields to track employee probation periods per Ivorian labor law
--
-- Context:
-- - CDI contracts in Ivory Coast have probation periods of 1-4 months
-- - Probation can be extended once for same duration (max total 8 months for category M/HC)
-- - HR needs alerts before probation ends to evaluate employee
-- - Confirmation decision must be documented

-- Add probation tracking columns to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS probation_start_date DATE,
ADD COLUMN IF NOT EXISTS probation_end_date DATE,
ADD COLUMN IF NOT EXISTS probation_duration_months INTEGER,
ADD COLUMN IF NOT EXISTS probation_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS probation_confirmed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS probation_confirmed_by UUID,
ADD COLUMN IF NOT EXISTS probation_extension_months INTEGER,
ADD COLUMN IF NOT EXISTS probation_notes TEXT;

-- Add check constraint for valid probation status values
ALTER TABLE employees
ADD CONSTRAINT chk_probation_status
CHECK (probation_status IS NULL OR probation_status IN ('in_progress', 'confirmed', 'extended', 'terminated', 'not_applicable'));

-- Add check constraint for probation duration (1-4 months per CI labor code)
ALTER TABLE employees
ADD CONSTRAINT chk_probation_duration
CHECK (probation_duration_months IS NULL OR (probation_duration_months >= 1 AND probation_duration_months <= 4));

-- Add check constraint for extension (cannot exceed original duration)
ALTER TABLE employees
ADD CONSTRAINT chk_probation_extension
CHECK (probation_extension_months IS NULL OR probation_extension_months <= probation_duration_months);

-- Create index for probation end date lookups (for alerts)
CREATE INDEX IF NOT EXISTS idx_employees_probation_end_date
ON employees(probation_end_date)
WHERE probation_status = 'in_progress';

-- Create index for probation status
CREATE INDEX IF NOT EXISTS idx_employees_probation_status
ON employees(tenant_id, probation_status)
WHERE probation_status IS NOT NULL;

-- Add comment explaining probation rules
COMMENT ON COLUMN employees.probation_status IS 'Probation period status: in_progress (active probation), confirmed (employee confirmed), extended (probation renewed once), terminated (let go during probation), not_applicable (no probation for this contract type)';
COMMENT ON COLUMN employees.probation_duration_months IS 'Initial probation duration in months (1-4 per Ivorian labor code Art. 14.2). Duration depends on employee category.';
COMMENT ON COLUMN employees.probation_extension_months IS 'Extension duration if probation renewed. Cannot exceed original duration. Max 1 renewal per CI labor code.';
