-- Migration: Add is_expat field to employees and ITS employer tax
-- Date: 2025-10-29
-- Purpose: Support ITS (Impôt sur les Traitements et Salaires) employer contribution calculation
--          Personnel local: 1.2% x salaire brut imposable
--          Personnel expatrié: 10.4% x salaire brut imposable

-- Step 1: Add is_expat field to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS is_expat BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN employees.is_expat IS 'Indicates if employee is expatriate for ITS employer tax calculation (local: 1.2%, expat: 10.4%)';

-- Step 2: Add applies_to_employee_type column to other_taxes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'other_taxes'
    AND column_name = 'applies_to_employee_type'
  ) THEN
    ALTER TABLE other_taxes
    ADD COLUMN applies_to_employee_type VARCHAR(20);

    COMMENT ON COLUMN other_taxes.applies_to_employee_type IS 'Employee type this tax applies to: local, expat, or NULL for all';
  END IF;
END $$;

-- Step 3: Add ITS employer tax entries to other_taxes table
-- Delete existing ITS entries if any
DELETE FROM other_taxes WHERE code IN ('its_employer_local', 'its_employer_expat');

-- ITS for local personnel (1.2%)
INSERT INTO other_taxes (
  country_code,
  code,
  name,
  tax_rate,
  calculation_base,
  paid_by,
  applies_to_employee_type,
  effective_from,
  effective_to,
  metadata
) VALUES (
  'CI',
  'its_employer_local',
  '{"fr": "ITS Employeur (Personnel Local)", "en": "ITS Employer (Local Personnel)"}'::jsonb,
  0.012,
  'brut_imposable',
  'employer',
  'local',
  '2024-01-01',
  NULL,
  '{"legal_reference": {"fr": "Code Général des Impôts - Article 175", "en": "General Tax Code - Article 175"}}'::jsonb
);

-- ITS for expatriate personnel (10.4%)
INSERT INTO other_taxes (
  country_code,
  code,
  name,
  tax_rate,
  calculation_base,
  paid_by,
  applies_to_employee_type,
  effective_from,
  effective_to,
  metadata
) VALUES (
  'CI',
  'its_employer_expat',
  '{"fr": "ITS Employeur (Personnel Expatrié)", "en": "ITS Employer (Expatriate Personnel)"}'::jsonb,
  0.104,
  'brut_imposable',
  'employer',
  'expat',
  '2024-01-01',
  NULL,
  '{"legal_reference": {"fr": "Code Général des Impôts - Article 175", "en": "General Tax Code - Article 175"}}'::jsonb
);
