-- Migration: Add CDDTI Component Definitions
-- Date: 2025-11-01
-- Purpose: Add salary component definitions for CDDTI workers (gratification, congés payés, indemnité de précarité)
-- Reference: docs/DAILY-WORKERS-ARCHITECTURE-V2.md (lines 1039-1154)

-- Gratification (year-end bonus, applies to all contract types)
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
  metadata,
  is_common,
  is_popular,
  display_order
) VALUES (
  gen_random_uuid(),
  'CI',
  'GRAT_JOUR',
  '{"fr": "Gratification congés non pris", "en": "Unpaid leave compensation"}',
  'bonus',
  'gratification',
  true,
  true,
  'FORMULA',
  '{
    "formula": "GROSS * 0.0333",
    "applies_to_contract_types": ["CDI", "CDD", "CDDTI", "INTERIM"],
    "calculation_notes": "3.33% du salaire brut (1/30 pour congés non pris)",
    "legal_reference": "Convention Collective - compensation for unpaid leave days"
  }',
  true,
  true,
  110
) ON CONFLICT (country_code, code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security;

-- Congés payés (paid leave provision, applies to all contract types)
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
  metadata,
  is_common,
  is_popular,
  display_order
) VALUES (
  gen_random_uuid(),
  'CI',
  'CONGE_JOUR',
  '{"fr": "Provision congés payés", "en": "Paid leave provision"}',
  'bonus',
  'paid_leave_provision',
  true,
  true,
  'FORMULA',
  '{
    "formula": "(GROSS + GRAT_JOUR) * 0.10",
    "applies_to_contract_types": ["CDI", "CDD", "CDDTI", "INTERIM"],
    "depends_on": ["GRAT_JOUR"],
    "calculation_notes": "10% de (salaire brut + gratification)",
    "legal_reference": "Code du Travail - paid leave provision"
  }',
  true,
  true,
  120
) ON CONFLICT (country_code, code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security;

-- Indemnité de précarité (CDDTI ONLY - job insecurity compensation)
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
  metadata,
  is_common,
  is_popular,
  display_order
) VALUES (
  gen_random_uuid(),
  'CI',
  'PREC_JOUR',
  '{"fr": "Indemnité de précarité (3%)", "en": "Precarity allowance (3%)"}',
  'bonus',
  'precarity_allowance',
  true,
  false,
  'FORMULA',
  '{
    "formula": "GROSS * 0.03",
    "applies_to_contract_types": ["CDDTI"],
    "calculation_notes": "3% du salaire brut. UNIQUEMENT pour CDDTI.",
    "legal_reference": "Article 7, 3ème alinéa de la Convention collective annexe",
    "replaces": ["notice_pay", "severance_pay"],
    "highlight_on_bulletin": true
  }',
  true,
  true,
  130
) ON CONFLICT (country_code, code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  name = EXCLUDED.name,
  is_taxable = EXCLUDED.is_taxable,
  is_subject_to_social_security = EXCLUDED.is_subject_to_social_security;

-- Add comment
COMMENT ON TABLE salary_component_definitions IS
  'Salary component definitions for all supported countries.
  CDDTI components added: GRAT_JOUR (gratification), CONGE_JOUR (congés payés), PREC_JOUR (indemnité de précarité)';
