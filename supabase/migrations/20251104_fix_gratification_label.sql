-- Fix CDDTI Gratification Label
-- Change "Gratification congés non pris" to "Prime de gratification"
-- The gratification is a 75% annual bonus, NOT for unpaid leave

-- Update component definition label
UPDATE salary_component_definitions
SET
  name = '{"fr": "Prime de gratification", "en": "Annual bonus"}',
  updated_at = NOW()
WHERE code = 'GRAT_JOUR' AND country_code = 'CI';

-- Verification
SELECT
  code,
  name->>'fr' as name_fr,
  name->>'en' as name_en,
  category,
  component_type
FROM salary_component_definitions
WHERE code = 'GRAT_JOUR' AND country_code = 'CI';
