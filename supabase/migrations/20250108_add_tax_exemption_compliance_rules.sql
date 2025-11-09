-- Migration: Add Tax Exemption Compliance Rules for Côte d'Ivoire
-- Description: Implements compliance validation for non-taxable salary components
-- Reference: docs/COMPLIANCE-GUIDED-COMPONENT-CREATION.md
-- Legal Basis: Code Général des Impôts (CI) Article X

-- ============================================================================
-- PART 1: Enhance salary_component_definitions schema
-- ============================================================================

-- Add new columns for reimbursement tracking and cap validation
ALTER TABLE salary_component_definitions
  ADD COLUMN IF NOT EXISTS is_reimbursement BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_cap_validation BOOLEAN DEFAULT FALSE;

-- Add comments for clarity
COMMENT ON COLUMN salary_component_definitions.is_reimbursement IS
  'True if component is a reimbursement (frais remboursable) - automatically non-taxable per Code Général des Impôts';

COMMENT ON COLUMN salary_component_definitions.requires_cap_validation IS
  'True if component is subject to 10% global cap on non-taxable components';

-- ============================================================================
-- PART 2: Insert Compliance Rules for Côte d'Ivoire
-- ============================================================================

-- Rule 1: Global 10% cap on non-taxable components
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'non_taxable_global_cap',
  true,
  false,
  'Code Général des Impôts Article X - Primes et indemnités non imposables',
  jsonb_build_object(
    'max_percentage', 0.10,
    'base', 'total_remuneration',
    'scope', 'global',
    'error_message', 'Le total des primes non imposables ne peut dépasser 10% de la rémunération totale',
    'description', 'Total des primes non imposables ne peut dépasser 10% de la rémunération totale',
    'excludes_reimbursements', true
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- Rule 2: Representation/Responsibility/Function allowance cap (10%)
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'representation_cap',
  true,
  false,
  'Code Général des Impôts Article X',
  jsonb_build_object(
    'max_percentage', 0.10,
    'base', 'total_remuneration',
    'scope', 'component',
    'component_types', jsonb_build_array(
      'representation_allowance',
      'responsibility',
      'function_allowance'
    ),
    'error_message', 'La prime de représentation/responsabilité/fonction ne peut dépasser 10% de la rémunération totale pour rester non imposable',
    'description', 'Prime de représentation/responsabilité/fonction limitée à 10%'
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- Rule 3: Uniform allowance cap (3,000 FCFA)
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'uniform_cap',
  true,
  true,
  'Code Général des Impôts Article X',
  jsonb_build_object(
    'max_amount', 3000,
    'scope', 'component',
    'component_type', 'uniform_allowance',
    'beyond_cap', 'taxable',
    'error_message', 'La prime de tenue ne peut dépasser 3,000 FCFA pour rester non imposable',
    'description', 'Prime de tenue limitée à 3,000 FCFA'
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- Rule 4: Cashier allowance cap (10%)
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'cashier_cap',
  true,
  false,
  'Code Général des Impôts Article X',
  jsonb_build_object(
    'max_percentage', 0.10,
    'base', 'total_remuneration',
    'scope', 'component',
    'component_type', 'cashier_allowance',
    'error_message', 'La prime de caisse ne peut dépasser 10% de la rémunération totale pour rester non imposable',
    'description', 'Prime de caisse limitée à 10%'
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- Rule 5: Transport allowance cap - Abidjan (30,000 FCFA)
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'transport_cap_abidjan',
  false,
  true,
  'Code Général des Impôts Article X - Convention Collective Article 20',
  jsonb_build_object(
    'max_amount', 30000,
    'scope', 'component',
    'component_type', 'transport',
    'city', 'Abidjan',
    'beyond_cap', 'taxable',
    'error_message', 'La prime de transport à Abidjan ne peut dépasser 30,000 FCFA pour rester non imposable',
    'description', 'Prime de transport à Abidjan limitée à 30,000 FCFA'
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- Rule 6: Transport allowance cap - Bouaké (24,000 FCFA)
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'transport_cap_bouake',
  false,
  true,
  'Code Général des Impôts Article X - Convention Collective Article 20',
  jsonb_build_object(
    'max_amount', 24000,
    'scope', 'component',
    'component_type', 'transport',
    'city', 'Bouaké',
    'beyond_cap', 'taxable',
    'error_message', 'La prime de transport à Bouaké ne peut dépasser 24,000 FCFA pour rester non imposable',
    'description', 'Prime de transport à Bouaké limitée à 24,000 FCFA'
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- Rule 7: Transport allowance cap - Other cities (20,000 FCFA)
INSERT INTO compliance_rules (
  country_code,
  rule_type,
  is_mandatory,
  can_exceed,
  legal_reference,
  validation_logic,
  effective_from,
  created_at,
  updated_at
) VALUES (
  'CI',
  'transport_cap_other',
  false,
  true,
  'Code Général des Impôts Article X - Convention Collective Article 20',
  jsonb_build_object(
    'max_amount', 20000,
    'scope', 'component',
    'component_type', 'transport',
    'city', 'autres',
    'beyond_cap', 'taxable',
    'error_message', 'La prime de transport ne peut dépasser 20,000 FCFA pour rester non imposable',
    'description', 'Prime de transport (autres villes) limitée à 20,000 FCFA'
  ),
  '2025-01-01',
  now(),
  now()
)
ON CONFLICT (country_code, rule_type) DO UPDATE SET
  validation_logic = EXCLUDED.validation_logic,
  updated_at = now();

-- ============================================================================
-- PART 3: Update existing component definitions
-- ============================================================================

-- Mark reimbursement-type components
UPDATE salary_component_definitions
SET
  is_reimbursement = TRUE,
  requires_cap_validation = FALSE,
  updated_at = now()
WHERE
  country_code = 'CI'
  AND component_type IN (
    'travel_allowance',      -- Prime de déplacement
    'dirtiness_allowance',   -- Prime de salissure
    'meal_allowance'         -- Prime de panier (if reimbursement)
  )
  AND is_taxable = FALSE;

-- Mark components subject to 10% global cap
UPDATE salary_component_definitions
SET
  requires_cap_validation = TRUE,
  updated_at = now()
WHERE
  country_code = 'CI'
  AND component_type IN (
    'representation_allowance',
    'responsibility',
    'cashier_allowance',
    'function_allowance'
  )
  AND is_taxable = FALSE;

-- Special case: Transport allowance requires cap validation (city-specific)
UPDATE salary_component_definitions
SET
  requires_cap_validation = TRUE,
  updated_at = now()
WHERE
  country_code = 'CI'
  AND component_type = 'transport'
  AND is_taxable = FALSE;

-- ============================================================================
-- PART 4: Create helper function for validation
-- ============================================================================

-- Function to check if a component name suggests it's a reimbursement
CREATE OR REPLACE FUNCTION detect_reimbursement_from_name(component_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Normalize name (lowercase, remove accents)
  component_name := lower(unaccent(component_name));

  -- Check for reimbursement keywords
  RETURN (
    component_name LIKE '%remboursement%' OR
    component_name LIKE '%frais%' OR
    component_name LIKE '%indemnisation%' OR
    component_name LIKE '%indemnite de deplacement%' OR
    component_name LIKE '%indemnite de salissure%' OR
    component_name LIKE '%indemnite kilometrique%' OR
    component_name LIKE '%per diem%'
  );
END;
$$;

COMMENT ON FUNCTION detect_reimbursement_from_name IS
  'Detects if a component name suggests it is a reimbursement (frais remboursable) based on French keywords';

-- ============================================================================
-- PART 5: Create validation stats view
-- ============================================================================

-- View to quickly see compliance status of all components
CREATE OR REPLACE VIEW v_component_compliance_status AS
SELECT
  cd.id,
  cd.country_code,
  cd.code,
  cd.name->>'fr' as name_fr,
  cd.component_type,
  cd.category,
  cd.is_taxable,
  cd.is_reimbursement,
  cd.requires_cap_validation,
  cd.default_value,
  -- Count applicable compliance rules
  (
    SELECT COUNT(*)
    FROM compliance_rules cr
    WHERE cr.country_code = cd.country_code
      AND (
        cr.validation_logic->>'scope' = 'global'
        OR cr.validation_logic->>'component_type' = cd.component_type
        OR cr.validation_logic->'component_types' ? cd.component_type
      )
  ) as applicable_rules_count,
  -- List applicable rule types
  (
    SELECT jsonb_agg(cr.rule_type)
    FROM compliance_rules cr
    WHERE cr.country_code = cd.country_code
      AND (
        cr.validation_logic->>'scope' = 'global'
        OR cr.validation_logic->>'component_type' = cd.component_type
        OR cr.validation_logic->'component_types' ? cd.component_type
      )
  ) as applicable_rules
FROM salary_component_definitions cd
WHERE cd.country_code = 'CI';

COMMENT ON VIEW v_component_compliance_status IS
  'Shows compliance validation status for all salary components in CI';

-- ============================================================================
-- PART 6: Grant permissions
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT ON v_component_compliance_status TO authenticated;
GRANT EXECUTE ON FUNCTION detect_reimbursement_from_name TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (for testing)
-- ============================================================================

-- Verify compliance rules were inserted
DO $$
DECLARE
  rule_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rule_count
  FROM compliance_rules
  WHERE country_code = 'CI'
    AND rule_type LIKE '%cap%';

  IF rule_count >= 7 THEN
    RAISE NOTICE 'SUCCESS: % compliance rules inserted for CI', rule_count;
  ELSE
    RAISE WARNING 'Only % compliance rules found, expected 7+', rule_count;
  END IF;
END $$;

-- Verify component schema updates
DO $$
DECLARE
  reimbursement_count INTEGER;
  cap_validation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO reimbursement_count
  FROM salary_component_definitions
  WHERE country_code = 'CI' AND is_reimbursement = TRUE;

  SELECT COUNT(*) INTO cap_validation_count
  FROM salary_component_definitions
  WHERE country_code = 'CI' AND requires_cap_validation = TRUE;

  RAISE NOTICE 'Reimbursement components: %', reimbursement_count;
  RAISE NOTICE 'Components requiring cap validation: %', cap_validation_count;
END $$;

-- Show compliance status summary
DO $$
DECLARE
  status_record RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COMPLIANCE STATUS SUMMARY (CI)';
  RAISE NOTICE '========================================';

  FOR status_record IN
    SELECT
      component_type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_reimbursement = TRUE) as reimbursements,
      COUNT(*) FILTER (WHERE requires_cap_validation = TRUE) as needs_cap_validation,
      COUNT(*) FILTER (WHERE is_taxable = FALSE) as non_taxable
    FROM salary_component_definitions
    WHERE country_code = 'CI'
    GROUP BY component_type
    ORDER BY component_type
  LOOP
    RAISE NOTICE 'Type: % | Total: % | Reimbursements: % | Cap Validation: % | Non-taxable: %',
      status_record.component_type,
      status_record.total,
      status_record.reimbursements,
      status_record.needs_cap_validation,
      status_record.non_taxable;
  END LOOP;
END $$;
