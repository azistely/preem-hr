-- Make CMU fully database-driven
-- Split CMU into employee and employer contributions with family variants

-- Update CMU structure
DO $$
DECLARE
  v_scheme_id uuid;
BEGIN
  -- Get CI social security scheme
  SELECT id INTO v_scheme_id
  FROM social_security_schemes
  WHERE country_code = 'CI'
  LIMIT 1;

  IF v_scheme_id IS NULL THEN
    RAISE EXCEPTION 'No social security scheme found for CI';
  END IF;

  -- Delete existing CMU record
  DELETE FROM contribution_types
  WHERE scheme_id = v_scheme_id
    AND code = 'cmu';

  -- Add CMU Employee contribution
  INSERT INTO contribution_types (
    scheme_id,
    code,
    name,
    employee_rate,
    employer_rate,
    calculation_base,
    fixed_amount,
    is_variable_by_sector,
    display_order,
    ceiling_amount,
    ceiling_period
  ) VALUES (
    v_scheme_id,
    'cmu_employee',
    '{"fr": "CMU (Cotisation salariale)", "en": "CMU (Employee contribution)"}'::jsonb,
    NULL, -- Not a percentage
    NULL,
    'fixed',
    500, -- Fixed 500 FCFA per employee
    false,
    10,
    NULL,
    NULL
  );

  -- Add CMU Employer Base contribution (no family)
  INSERT INTO contribution_types (
    scheme_id,
    code,
    name,
    employee_rate,
    employer_rate,
    calculation_base,
    fixed_amount,
    is_variable_by_sector,
    display_order,
    ceiling_amount,
    ceiling_period
  ) VALUES (
    v_scheme_id,
    'cmu_employer_base',
    '{"fr": "CMU (Cotisation patronale - employé seul)", "en": "CMU (Employer - single employee)"}'::jsonb,
    NULL,
    NULL,
    'fixed',
    500, -- 500 FCFA for employee alone
    false,
    11,
    NULL,
    NULL
  );

  -- Add CMU Employer Family contribution
  INSERT INTO contribution_types (
    scheme_id,
    code,
    name,
    employee_rate,
    employer_rate,
    calculation_base,
    fixed_amount,
    is_variable_by_sector,
    display_order,
    ceiling_amount,
    ceiling_period
  ) VALUES (
    v_scheme_id,
    'cmu_employer_family',
    '{"fr": "CMU (Cotisation patronale - famille)", "en": "CMU (Employer - with family)"}'::jsonb,
    NULL,
    NULL,
    'fixed',
    4500, -- 4,500 FCFA for family coverage
    false,
    12,
    NULL,
    NULL
  );

  RAISE NOTICE 'CMU contribution structure updated successfully';
END $$;
