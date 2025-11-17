-- Add employee protection fields for labor law compliance
-- Supports tracking pregnancy status and medical exemptions for night work restrictions

-- Add pregnancy tracking fields
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_pregnant BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pregnancy_start_date DATE,
ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;

-- Add medical exemption fields for night work
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS medical_exemption_night_work BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS medical_exemption_expiry_date DATE,
ADD COLUMN IF NOT EXISTS medical_exemption_document_url TEXT,
ADD COLUMN IF NOT EXISTS medical_exemption_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN employees.is_pregnant IS 'Indicates if employee is pregnant (for labor law protections)';
COMMENT ON COLUMN employees.pregnancy_start_date IS 'Start date of pregnancy';
COMMENT ON COLUMN employees.expected_delivery_date IS 'Expected delivery date';
COMMENT ON COLUMN employees.medical_exemption_night_work IS 'Medical exemption allowing night work for pregnant women';
COMMENT ON COLUMN employees.medical_exemption_expiry_date IS 'Expiry date of medical exemption';
COMMENT ON COLUMN employees.medical_exemption_document_url IS 'URL to medical certificate document';
COMMENT ON COLUMN employees.medical_exemption_notes IS 'Additional notes about medical exemption';

-- Index for querying protected employees
CREATE INDEX IF NOT EXISTS idx_employees_protected_status
ON employees (is_pregnant, medical_exemption_night_work)
WHERE is_pregnant = TRUE OR medical_exemption_night_work = TRUE;
