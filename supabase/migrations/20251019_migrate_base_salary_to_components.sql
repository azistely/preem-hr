/**
 * Data Migration: Add Code 11 Component to Existing Salaries
 *
 * Purpose: Migrate all employee_salaries records to use the new base salary component structure.
 * For each salary record without a Code 11 component, add it using the base_salary value.
 *
 * Background:
 * - Previously: base_salary column stored the single base salary amount
 * - Now: components JSONB array stores Code 11 (Salaire catégoriel) + Code 12 (Sursalaire)
 * - This migration ensures all existing salaries have Code 11 for multi-country support
 *
 * Date: 2025-10-19
 */

-- Add Code 11 component to all salaries that don't have it
-- This is a one-time migration for existing data

DO $$
DECLARE
  salary_record RECORD;
  new_components jsonb;
  migrated_count INTEGER := 0;
BEGIN
  -- Loop through all salaries missing Code 11
  FOR salary_record IN
    SELECT id, employee_id, base_salary, components
    FROM employee_salaries
    WHERE NOT (components @> '[{"code": "11"}]'::jsonb)
  LOOP
    -- Build new components array with Code 11 prepended
    -- Prepend ensures Code 11 appears first in the array
    new_components := jsonb_build_array(
      jsonb_build_object(
        'code', '11',
        'name', 'Salaire catégoriel',
        'amount', salary_record.base_salary::numeric,
        'sourceType', 'standard',
        'metadata', jsonb_build_object(
          'migratedFrom', 'baseSalary',
          'migratedAt', NOW()::text
        )
      )
    ) || COALESCE(salary_record.components, '[]'::jsonb);

    -- Update the record
    UPDATE employee_salaries
    SET components = new_components
    WHERE id = salary_record.id;

    migrated_count := migrated_count + 1;

    RAISE NOTICE 'Migrated salary % (employee %) - added Code 11 with amount %',
      salary_record.id,
      salary_record.employee_id,
      salary_record.base_salary;
  END LOOP;

  RAISE NOTICE 'Migration complete. Updated % salary records.', migrated_count;
END $$;

-- Verify migration
SELECT
  COUNT(*) as total_salaries,
  COUNT(*) FILTER (WHERE components @> '[{"code": "11"}]'::jsonb) as with_code_11,
  COUNT(*) FILTER (WHERE NOT (components @> '[{"code": "11"}]'::jsonb)) as missing_code_11
FROM employee_salaries;

-- Show sample of migrated records
SELECT
  id,
  employee_id,
  base_salary,
  jsonb_array_length(components) as component_count,
  components->0->>'code' as first_component_code,
  components->0->>'amount' as first_component_amount,
  components @> '[{"code": "11"}]'::jsonb as has_code_11
FROM employee_salaries
ORDER BY created_at DESC
LIMIT 5;
