-- Migration: Transform legacy salary columns to components-only architecture
-- Date: 2025-10-07
-- Description: Migrates all employee_salaries records to use ONLY the components JSONB array
--              and drops legacy individual allowance columns.

BEGIN;

-- Step 0: Disable trigger before any data transformations to prevent trigger errors
ALTER TABLE employee_salaries DISABLE TRIGGER set_updated_at;

-- Step 1: Ensure all existing records have their legacy data transformed to components array
-- This handles records that might not have been created with the dual-write system
UPDATE employee_salaries
SET components = (
  SELECT jsonb_agg(component)
  FROM (
    -- Base salary (always present)
    SELECT jsonb_build_object(
      'code', '11',
      'name', 'Salaire de base',
      'amount', COALESCE(base_salary::numeric, 0),
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', true
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', true
        )
      )
    ) AS component

    UNION ALL

    -- Housing allowance (if > 0)
    SELECT jsonb_build_object(
      'code', '23',
      'name', 'Prime de logement',
      'amount', housing_allowance::numeric,
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', false,
          'exemptionLimit', 75000
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', false
        )
      )
    )
    WHERE COALESCE(housing_allowance::numeric, 0) > 0

    UNION ALL

    -- Transport allowance (if > 0)
    SELECT jsonb_build_object(
      'code', '22',
      'name', 'Prime de transport',
      'amount', transport_allowance::numeric,
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', false,
          'exemptionLimit', 75000
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', false
        )
      )
    )
    WHERE COALESCE(transport_allowance::numeric, 0) > 0

    UNION ALL

    -- Meal allowance (if > 0)
    SELECT jsonb_build_object(
      'code', '24',
      'name', 'Prime de panier',
      'amount', meal_allowance::numeric,
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', false,
          'exemptionLimit', 75000
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', false
        )
      )
    )
    WHERE COALESCE(meal_allowance::numeric, 0) > 0

    UNION ALL

    -- Other allowances from JSONB array (legacy)
    SELECT jsonb_build_object(
      'code', 'CUSTOM_' || md5(allowance->>'name')::text,
      'name', allowance->>'name',
      'amount', (allowance->>'amount')::numeric,
      'sourceType', 'custom',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', COALESCE((allowance->>'taxable')::boolean, true),
          'includeInBrutImposable', COALESCE((allowance->>'taxable')::boolean, true),
          'includeInSalaireCategoriel', false
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', COALESCE((allowance->>'taxable')::boolean, true)
        )
      )
    )
    FROM jsonb_array_elements(
      COALESCE(other_allowances, '[]'::jsonb)
    ) AS allowance
    WHERE (allowance->>'amount')::numeric > 0
  ) AS all_components
)
WHERE components = '[]'::jsonb OR components IS NULL;

-- Step 2: Merge existing components with transformed legacy data (for dual-write records)
-- This preserves any components that were already saved while ensuring legacy data is not lost
UPDATE employee_salaries
SET components = (
  SELECT jsonb_agg(DISTINCT component)
  FROM (
    -- Existing components (if any)
    SELECT component
    FROM jsonb_array_elements(COALESCE(components, '[]'::jsonb)) AS component

    UNION

    -- Legacy data transformed (only add if not already in components by code)
    SELECT jsonb_build_object(
      'code', '11',
      'name', 'Salaire de base',
      'amount', COALESCE(base_salary::numeric, 0),
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', true
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', true
        )
      )
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(components, '[]'::jsonb)) c
      WHERE c->>'code' = '11'
    )

    UNION

    SELECT jsonb_build_object(
      'code', '23',
      'name', 'Prime de logement',
      'amount', housing_allowance::numeric,
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', false,
          'exemptionLimit', 75000
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', false
        )
      )
    )
    WHERE COALESCE(housing_allowance::numeric, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(components, '[]'::jsonb)) c
        WHERE c->>'code' = '23'
      )

    UNION

    SELECT jsonb_build_object(
      'code', '22',
      'name', 'Prime de transport',
      'amount', transport_allowance::numeric,
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', false,
          'exemptionLimit', 75000
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', false
        )
      )
    )
    WHERE COALESCE(transport_allowance::numeric, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(components, '[]'::jsonb)) c
        WHERE c->>'code' = '22'
      )

    UNION

    SELECT jsonb_build_object(
      'code', '24',
      'name', 'Prime de panier',
      'amount', meal_allowance::numeric,
      'sourceType', 'standard',
      'metadata', jsonb_build_object(
        'taxTreatment', jsonb_build_object(
          'isTaxable', true,
          'includeInBrutImposable', true,
          'includeInSalaireCategoriel', false,
          'exemptionLimit', 75000
        ),
        'socialSecurityTreatment', jsonb_build_object(
          'includeInCnpsBase', false
        )
      )
    )
    WHERE COALESCE(meal_allowance::numeric, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(components, '[]'::jsonb)) c
        WHERE c->>'code' = '24'
      )
  ) AS merged_components
)
WHERE components IS NOT NULL AND components != '[]'::jsonb;

-- Step 3: Drop legacy columns (single source of truth)
ALTER TABLE employee_salaries
  DROP COLUMN IF EXISTS housing_allowance,
  DROP COLUMN IF EXISTS transport_allowance,
  DROP COLUMN IF EXISTS meal_allowance,
  DROP COLUMN IF EXISTS other_allowances;

-- Step 4: Re-enable trigger
ALTER TABLE employee_salaries ENABLE TRIGGER set_updated_at;

-- Step 5: Add GIN index on components JSONB for performance
CREATE INDEX IF NOT EXISTS idx_employee_salaries_components
  ON employee_salaries USING GIN (components);

-- Step 6: Add helpful comment
COMMENT ON COLUMN employee_salaries.components IS
  'JSONB array of salary component instances. Each component has: code, name, amount, sourceType, metadata. Must always contain base salary (code 11).';

COMMIT;
