-- Add missing standard CI salary component codes
-- Based on payroll-joel-ci-hr-.md documentation

INSERT INTO salary_component_definitions (
  country_code, code, name, category, component_type,
  is_taxable, is_subject_to_social_security, display_order, is_common, metadata
) VALUES
-- Avantages en nature (Benefits in Kind) - Codes 23-27
('CI', '23', '{"fr": "Avantage en nature - Logement", "en": "Benefit in Kind - Housing"}'::jsonb,
 'allowance', 'benefit_in_kind_housing', true, true, 23, false,
 '{"description": "Housing benefit in kind", "type": "non_monetary"}'::jsonb),

('CI', '24', '{"fr": "Avantage en nature - Véhicule", "en": "Benefit in Kind - Vehicle"}'::jsonb,
 'allowance', 'benefit_in_kind_vehicle', true, true, 24, false,
 '{"description": "Vehicle benefit in kind", "type": "non_monetary"}'::jsonb),

('CI', '25', '{"fr": "Avantage en nature - Nourriture", "en": "Benefit in Kind - Food"}'::jsonb,
 'allowance', 'benefit_in_kind_food', true, true, 25, false,
 '{"description": "Food benefit in kind", "type": "non_monetary"}'::jsonb),

('CI', '26', '{"fr": "Avantage en nature - Domestique", "en": "Benefit in Kind - Domestic Help"}'::jsonb,
 'allowance', 'benefit_in_kind_domestic', true, true, 26, false,
 '{"description": "Domestic help benefit in kind", "type": "non_monetary"}'::jsonb),

('CI', '27', '{"fr": "Avantage en nature - Autres", "en": "Benefit in Kind - Other"}'::jsonb,
 'allowance', 'benefit_in_kind_other', true, true, 27, false,
 '{"description": "Other benefits in kind", "type": "non_monetary"}'::jsonb),

-- Autres primes (Other allowances) - Codes 31-33
('CI', '31', '{"fr": "Prime de technicité", "en": "Technical Allowance"}'::jsonb,
 'allowance', 'technical_allowance', true, true, 31, false,
 '{"description": "Technical skills allowance"}'::jsonb),

('CI', '32', '{"fr": "Prime de risque", "en": "Risk Allowance"}'::jsonb,
 'allowance', 'risk_allowance', true, true, 32, false,
 '{"description": "Hazard/risk allowance"}'::jsonb),

('CI', '33', '{"fr": "Prime de salissure", "en": "Dirtiness Allowance"}'::jsonb,
 'allowance', 'dirtiness_allowance', true, true, 33, false,
 '{"description": "Allowance for dirty work conditions"}'::jsonb),

-- Code 41: Allocations familiales
('CI', '41', '{"fr": "Allocations familiales", "en": "Family Allowances"}'::jsonb,
 'allowance', 'family_allowances', true, true, 41, false,
 '{"description": "Family allowances from CNPS"}'::jsonb)

ON CONFLICT (country_code, code) DO UPDATE
SET
  name = EXCLUDED.name,
  component_type = EXCLUDED.component_type,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Verify insertions
SELECT
  code,
  name->>'fr' as name_fr,
  category,
  component_type,
  is_taxable
FROM salary_component_definitions
WHERE country_code = 'CI'
  AND code IN ('11', '12', '21', '22', '23', '24', '25', '26', '27', '31', '32', '33', '41')
ORDER BY code;
