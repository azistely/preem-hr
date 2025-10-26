-- ============================================================================
-- Migration: Add Non-Taxable Salary Components (CI)
-- Date: 2025-10-26
-- Description: Add and update non-taxable allowances for Côte d'Ivoire
--
-- Components:
-- 1. Update existing components to non-taxable
-- 2. Add missing non-taxable allowances
-- ============================================================================

-- ============================================================================
-- 1. Update Existing Components to Non-Taxable
-- ============================================================================

-- Update Code 33: Prime de salissure (Dirtiness Allowance)
-- Should be non-taxable
UPDATE salary_component_definitions
SET
  is_taxable = false,
  is_subject_to_social_security = false,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{taxTreatment}',
    '{"isTaxable": false, "includeInBrutImposable": false, "includeInSalaireCategoriel": false, "exemptionNote": "Exonéré totalement"}'::jsonb
  )
WHERE country_code = 'CI' AND code = '33';

-- Update Indemnité de Responsabilité (Responsibility Allowance)
-- Non-taxable up to 10% of total remuneration
UPDATE salary_component_definitions
SET
  is_taxable = false,
  is_subject_to_social_security = false,
  metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{taxTreatment}',
    '{"isTaxable": false, "includeInBrutImposable": false, "includeInSalaireCategoriel": false, "exemptionCap": "10%", "exemptionNote": "Exonéré dans la limite de 10% de la rémunération totale"}'::jsonb
  )
WHERE country_code = 'CI' AND code = 'responsibility';

-- ============================================================================
-- 2. Add Missing Non-Taxable Components
-- ============================================================================

-- Code 34: Prime de représentation (Representation Allowance)
INSERT INTO salary_component_definitions (
  id,
  country_code,
  code,
  name,
  category,
  component_type,
  is_taxable,
  is_subject_to_social_security,
  calculation_method,
  display_order,
  is_common,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CI',
  '34',
  '{"fr": "Prime de représentation", "en": "Representation Allowance"}'::jsonb,
  'allowance',
  'representation_allowance',
  false,
  false,
  'fixed',
  340,
  true,
  '{
    "description": "Prime de représentation",
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false,
      "exemptionCap": "10%",
      "exemptionNote": "Exonéré dans la limite de 10% de la rémunération totale"
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    }
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (country_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Code 35: Prime de déplacement (Travel/Movement Allowance)
INSERT INTO salary_component_definitions (
  id,
  country_code,
  code,
  name,
  category,
  component_type,
  is_taxable,
  is_subject_to_social_security,
  calculation_method,
  display_order,
  is_common,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CI',
  '35',
  '{"fr": "Prime de déplacement", "en": "Travel Allowance"}'::jsonb,
  'allowance',
  'travel_allowance',
  false,
  false,
  'fixed',
  350,
  true,
  '{
    "description": "Prime de déplacement",
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false,
      "exemptionNote": "Exonéré totalement"
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    }
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (country_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Code 36: Prime de tenue (Uniform/Attire Allowance)
INSERT INTO salary_component_definitions (
  id,
  country_code,
  code,
  name,
  category,
  component_type,
  is_taxable,
  is_subject_to_social_security,
  calculation_method,
  default_value,
  display_order,
  is_common,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CI',
  '36',
  '{"fr": "Prime de tenue", "en": "Uniform Allowance"}'::jsonb,
  'allowance',
  'uniform_allowance',
  false,
  false,
  'fixed',
  3000,
  360,
  true,
  '{
    "description": "Prime de tenue (uniforme)",
    "defaultValue": 3000,
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false,
      "exemptionNote": "Exonéré totalement (montant usuel: 3 000 FCFA)"
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    }
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (country_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security,
  default_value = EXCLUDED.default_value,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Code 37: Prime de caisse (Cashier Allowance)
INSERT INTO salary_component_definitions (
  id,
  country_code,
  code,
  name,
  category,
  component_type,
  is_taxable,
  is_subject_to_social_security,
  calculation_method,
  display_order,
  is_common,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CI',
  '37',
  '{"fr": "Prime de caisse", "en": "Cashier Allowance"}'::jsonb,
  'allowance',
  'cashier_allowance',
  false,
  false,
  'fixed',
  370,
  true,
  '{
    "description": "Prime de caisse",
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false,
      "exemptionCap": "10%",
      "exemptionNote": "Exonéré dans la limite de 10% de la rémunération totale"
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    }
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (country_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Code 38: Prime de panier (Meal Basket Allowance)
INSERT INTO salary_component_definitions (
  id,
  country_code,
  code,
  name,
  category,
  component_type,
  is_taxable,
  is_subject_to_social_security,
  calculation_method,
  display_order,
  is_common,
  metadata,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'CI',
  '38',
  '{"fr": "Prime de panier", "en": "Meal Basket Allowance"}'::jsonb,
  'allowance',
  'meal_basket_allowance',
  false,
  false,
  'fixed',
  380,
  true,
  '{
    "description": "Prime de panier",
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false,
      "exemptionNote": "Exonéré totalement"
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    }
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (country_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ============================================================================
-- Verification Query (for documentation)
-- ============================================================================

-- Run this to verify all non-taxable allowances:
-- SELECT code, name->>'fr' as name_fr, is_taxable, is_subject_to_social_security,
--        metadata->'taxTreatment'->>'exemptionNote' as exemption_note
-- FROM salary_component_definitions
-- WHERE country_code = 'CI'
--   AND code IN ('22', '33', '34', '35', '36', '37', '38', 'responsibility')
-- ORDER BY code;
