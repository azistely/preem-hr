-- Migration: Migrate allowances to components array (keep base_salary separate)
-- Date: 2025-10-07
-- Description: Migrates housing, transport, meal allowances from individual columns
--              to the components JSONB array using country-specific templates.
--              Base salary remains in its own column for performance and clarity.

BEGIN;

-- Step 0: Disable trigger before any data transformations
ALTER TABLE employee_salaries DISABLE TRIGGER set_updated_at;

-- Step 1: Migrate allowances from old columns to components array using templates
-- This builds components from templates, preserving country-specific metadata
UPDATE employee_salaries es
SET components = (
  SELECT COALESCE(jsonb_agg(component), '[]'::jsonb)
  FROM (
    -- Housing allowance (if > 0)
    SELECT jsonb_build_object(
      'code', sct.code,
      'name', sct.name->>'fr',
      'amount', es.housing_allowance::numeric,
      'sourceType', 'standard',
      'metadata', sct.metadata
    ) AS component
    FROM salary_component_templates sct
    CROSS JOIN tenants t
    WHERE t.id = es.tenant_id
      AND sct.country_code = t.country_code
      AND sct.code = 'TPT_HOUSING_CI'
      AND COALESCE(es.housing_allowance::numeric, 0) > 0

    UNION ALL

    -- Transport allowance (if > 0)
    SELECT jsonb_build_object(
      'code', sct.code,
      'name', sct.name->>'fr',
      'amount', es.transport_allowance::numeric,
      'sourceType', 'standard',
      'metadata', sct.metadata
    )
    FROM salary_component_templates sct
    CROSS JOIN tenants t
    WHERE t.id = es.tenant_id
      AND sct.country_code = t.country_code
      AND sct.code = 'TPT_TRANSPORT_CI'
      AND COALESCE(es.transport_allowance::numeric, 0) > 0

    UNION ALL

    -- Meal allowance (if > 0)
    SELECT jsonb_build_object(
      'code', sct.code,
      'name', sct.name->>'fr',
      'amount', es.meal_allowance::numeric,
      'sourceType', 'standard',
      'metadata', sct.metadata
    )
    FROM salary_component_templates sct
    CROSS JOIN tenants t
    WHERE t.id = es.tenant_id
      AND sct.country_code = t.country_code
      AND sct.code = 'TPT_MEAL_ALLOWANCE'
      AND COALESCE(es.meal_allowance::numeric, 0) > 0

    UNION ALL

    -- Other allowances from JSONB array (legacy format)
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
    ) AS component
    FROM jsonb_array_elements(
      COALESCE(es.other_allowances, '[]'::jsonb)
    ) AS allowance
    WHERE (allowance->>'amount')::numeric > 0
  ) AS all_components
)
WHERE components = '[]'::jsonb OR components IS NULL;

-- Step 2: Merge with existing components (for dual-write records)
-- This preserves any components that were already saved
UPDATE employee_salaries es
SET components = (
  SELECT COALESCE(jsonb_agg(DISTINCT component), '[]'::jsonb)
  FROM (
    -- Existing components
    SELECT component
    FROM jsonb_array_elements(COALESCE(es.components, '[]'::jsonb)) AS component

    UNION

    -- New components from Step 1
    SELECT component
    FROM jsonb_array_elements(es.components) AS component
  ) AS merged
)
WHERE components IS NOT NULL AND components != '[]'::jsonb;

-- Step 3: Drop migrated allowance columns (KEEP base_salary!)
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

-- Step 6: Add helpful comments
COMMENT ON COLUMN employee_salaries.base_salary IS
  'Base salary amount in local currency. This is the anchor for all calculations and remains separate from variable components for performance and clarity.';

COMMENT ON COLUMN employee_salaries.components IS
  'JSONB array of variable salary components (allowances, bonuses, benefits). Each component has: code (template code), name, amount, sourceType, metadata. Base salary is NOT included here.';

COMMIT;
