-- Add Salaire Catégoriel (Code 11) and Sursalaire (Code 12) as distinct components
-- Per payroll-joel-ci-hr-.md documentation

-- First, check if codes already exist
DO $$
BEGIN
  -- Update Code 11 to be more specific
  UPDATE salary_component_definitions
  SET
    name = '{"fr": "Salaire catégoriel", "en": "Category Salary"}'::jsonb,
    component_type = 'salaire_categoriel',
    metadata = jsonb_build_object(
      'description', 'Base salary by employee category (used for CNPS Family Benefits and Work Accident)',
      'is_base_for_cnps_family', true,
      'is_base_for_cnps_accident', true
    ),
    updated_at = NOW()
  WHERE country_code = 'CI'
    AND code = '11';

  -- Add Code 12 if it doesn't exist
  INSERT INTO salary_component_definitions (
    country_code,
    code,
    name,
    category,
    component_type,
    is_taxable,
    is_subject_to_social_security,
    display_order,
    is_common,
    metadata
  ) VALUES (
    'CI',
    '12',
    '{"fr": "Sursalaire", "en": "Over-salary"}'::jsonb,
    'allowance',
    'sursalaire',
    true,
    true,
    12,
    true,
    '{"description": "Additional fixed salary component"}'::jsonb
  )
  ON CONFLICT (country_code, code) DO UPDATE
  SET
    name = EXCLUDED.name,
    component_type = EXCLUDED.component_type,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  -- Verify CNPS contribution types use correct calculation base
  -- Work Accident should use salaire_categoriel with 70,000 ceiling
  UPDATE contribution_types
  SET
    calculation_base = 'salaire_categoriel',
    ceiling_amount = 70000
  WHERE code = 'work_accident'
    AND scheme_id IN (
      SELECT id FROM social_security_schemes WHERE country_code = 'CI'
    );

  -- Family Benefits should also use salaire_categoriel with 70,000 ceiling
  UPDATE contribution_types
  SET
    calculation_base = 'salaire_categoriel',
    ceiling_amount = 70000,
    employer_rate = 0.0575 -- 5.75% (includes maternity)
  WHERE code = 'family_benefits'
    AND scheme_id IN (
      SELECT id FROM social_security_schemes WHERE country_code = 'CI'
    );

  RAISE NOTICE 'Salaire Catégoriel component and CNPS bases updated successfully';
END $$;
