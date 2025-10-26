-- Migration: Standardize Exemption Cap Metadata Structure
-- Date: 2025-10-26
-- Purpose: Convert exemption caps to structured format for metadata-driven processing
-- Reference: DATABASE-DRIVEN-COMPONENT-ARCHITECTURE.md

-- ========================================
-- STEP 1: Add temporary metadata_v2 column
-- ========================================

ALTER TABLE salary_component_definitions
ADD COLUMN IF NOT EXISTS metadata_v2 jsonb;

-- ========================================
-- STEP 2: Migrate existing metadata to structured format
-- ========================================

-- Code 22 (Transport) - City-based cap with fallback
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionCap', jsonb_build_object(
      'type', 'city_based',
      'cityTable', 'city_transport_minimums',
      'fallbackValue', 30000
    ),
    'exemptionNote', 'Exonéré selon le barème de la ville (30 000 FCFA max par défaut)'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '22';

-- Code 33 (Prime de salissure) - Fully exempt
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Prime de salissure - Prime accordée aux travailleurs exposés à des conditions de travail salissantes',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionNote', 'Totalement exonéré d''impôt'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '33';

-- Code 34 (Prime de représentation) - Percentage cap (10% of total remuneration)
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Prime de représentation - Prime pour frais de représentation professionnelle',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionCap', jsonb_build_object(
      'type', 'percentage',
      'value', 0.10,
      'appliesTo', 'total_remuneration'
    ),
    'exemptionNote', 'Exonéré dans la limite de 10% de la rémunération totale'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '34';

-- Code 35 (Prime de déplacement) - Fully exempt
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Prime de déplacement - Indemnité pour déplacements professionnels',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionNote', 'Totalement exonéré d''impôt'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '35';

-- Code 36 (Prime de tenue) - Fully exempt
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Prime de tenue - Indemnité pour frais de vêtements professionnels',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionNote', 'Totalement exonéré d''impôt'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '36';

-- Code 37 (Prime de caisse) - Percentage cap (10% of total remuneration)
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Prime de caisse - Prime pour manipulation de fonds',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionCap', jsonb_build_object(
      'type', 'percentage',
      'value', 0.10,
      'appliesTo', 'total_remuneration'
    ),
    'exemptionNote', 'Exonéré dans la limite de 10% de la rémunération totale'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '37';

-- Code 38 (Prime de panier) - Fully exempt
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Prime de panier - Indemnité de repas',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionNote', 'Totalement exonéré d''impôt'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = '38';

-- responsibility (Indemnité de responsabilité) - Percentage cap (10% of total remuneration)
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_build_object(
  'description', 'Indemnité de responsabilité - Prime pour postes de responsabilité',
  'taxTreatment', jsonb_build_object(
    'isTaxable', false,
    'includeInBrutImposable', false,
    'includeInSalaireCategoriel', false,
    'exemptionCap', jsonb_build_object(
      'type', 'percentage',
      'value', 0.10,
      'appliesTo', 'total_remuneration'
    ),
    'exemptionNote', 'Exonéré dans la limite de 10% de la rémunération totale'
  ),
  'socialSecurityTreatment', jsonb_build_object(
    'includeInCnpsBase', false
  )
)
WHERE country_code = 'CI' AND code = 'responsibility';

-- ========================================
-- STEP 3: Backfill metadata for fully taxable components
-- ========================================

-- Code 11 (Salaire de base) - Fully taxable and included in all bases
UPDATE salary_component_definitions
SET metadata_v2 = COALESCE(metadata_v2, metadata, '{}'::jsonb)
WHERE country_code = 'CI' AND code = '11' AND metadata_v2 IS NULL;

-- Code 21 (Prime d'ancienneté) - Fully taxable
UPDATE salary_component_definitions
SET metadata_v2 = COALESCE(metadata_v2, metadata, '{}'::jsonb)
WHERE country_code = 'CI' AND code = '21' AND metadata_v2 IS NULL;

-- Code 23 (Indemnité de logement) - Fully taxable
UPDATE salary_component_definitions
SET metadata_v2 = COALESCE(metadata_v2, metadata, '{}'::jsonb)
WHERE country_code = 'CI' AND code = '23' AND metadata_v2 IS NULL;

-- Code 24 (Indemnité de repas) - Fully taxable
UPDATE salary_component_definitions
SET metadata_v2 = COALESCE(metadata_v2, metadata, '{}'::jsonb)
WHERE country_code = 'CI' AND code = '24' AND metadata_v2 IS NULL;

-- Code 41 (Allocations familiales) - Fully taxable
UPDATE salary_component_definitions
SET metadata_v2 = COALESCE(metadata_v2, metadata, '{}'::jsonb)
WHERE country_code = 'CI' AND code = '41' AND metadata_v2 IS NULL;

-- ========================================
-- STEP 4: Ensure all components have complete metadata
-- ========================================

-- Fill in missing taxTreatment for any components that don't have it
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_set(
  COALESCE(metadata_v2, '{}'::jsonb),
  '{taxTreatment}',
  jsonb_build_object(
    'isTaxable', COALESCE((metadata_v2->'taxTreatment'->>'isTaxable')::boolean, is_taxable, true),
    'includeInBrutImposable', COALESCE((metadata_v2->'taxTreatment'->>'includeInBrutImposable')::boolean, is_taxable, true),
    'includeInSalaireCategoriel', COALESCE((metadata_v2->'taxTreatment'->>'includeInSalaireCategoriel')::boolean, false)
  )
)
WHERE country_code = 'CI'
  AND (metadata_v2 IS NULL OR metadata_v2->'taxTreatment' IS NULL);

-- Fill in missing socialSecurityTreatment for any components that don't have it
UPDATE salary_component_definitions
SET metadata_v2 = jsonb_set(
  COALESCE(metadata_v2, '{}'::jsonb),
  '{socialSecurityTreatment}',
  jsonb_build_object(
    'includeInCnpsBase', COALESCE((metadata_v2->'socialSecurityTreatment'->>'includeInCnpsBase')::boolean, is_subject_to_social_security, true)
  )
)
WHERE country_code = 'CI'
  AND (metadata_v2 IS NULL OR metadata_v2->'socialSecurityTreatment' IS NULL);

-- ========================================
-- STEP 5: Verification query
-- ========================================

-- Verify migration (this will output results for manual review)
DO $$
DECLARE
  component_record RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION: Exemption Cap Migration';
  RAISE NOTICE '========================================';

  FOR component_record IN
    SELECT
      code,
      name->>'fr' as name_fr,
      metadata_v2->'taxTreatment'->'exemptionCap' as cap_format,
      metadata_v2->'taxTreatment'->>'exemptionNote' as note
    FROM salary_component_definitions
    WHERE country_code = 'CI'
    ORDER BY code
  LOOP
    RAISE NOTICE 'Code %: % | Cap: % | Note: %',
      component_record.code,
      component_record.name_fr,
      component_record.cap_format,
      component_record.note;
  END LOOP;
END $$;

-- ========================================
-- STEP 6: Swap columns (only after verification!)
-- ========================================

-- Comment out this section initially - uncomment after manual verification
-- ALTER TABLE salary_component_definitions DROP COLUMN metadata;
-- ALTER TABLE salary_component_definitions RENAME COLUMN metadata_v2 TO metadata;

COMMENT ON COLUMN salary_component_definitions.metadata_v2 IS 'Temporary column during migration - will replace metadata after verification';
