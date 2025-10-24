-- =====================================================
-- Add CGECI Barème 2023 Support
-- =====================================================
--
-- This migration extends the database schema to support sector-specific
-- minimum wages from the CGECI (Confédération Générale des Entreprises
-- de Côte d'Ivoire) salary grid for 2023.
--
-- Changes:
-- 1. employee_category_coefficients: Add sector differentiation
-- 2. employees: Add CGECI category tracking
--
-- Backward Compatibility:
-- - Existing generic categories (Convention Collective 1977): sector_code = NULL
-- - New CGECI entries: sector_code = 'BTP', 'BANQUES', 'COMMERCE', etc.
-- =====================================================

-- =====================================================
-- 1. Extend employee_category_coefficients Table
-- =====================================================

-- Add sector differentiation column
ALTER TABLE employee_category_coefficients
  ADD COLUMN IF NOT EXISTS sector_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS actual_minimum_wage NUMERIC(15, 2);

-- Add helpful comments
COMMENT ON COLUMN employee_category_coefficients.sector_code IS
  'CGECI sector code (BTP, BANQUES, COMMERCE, etc.). NULL for generic Convention Collective 1977 categories.';

COMMENT ON COLUMN employee_category_coefficients.actual_minimum_wage IS
  'Actual minimum wage amount in local currency. Used for CGECI sector-specific minimums.';

-- Update unique constraint to include sector_code
-- This allows same category code across different sectors
ALTER TABLE employee_category_coefficients
  DROP CONSTRAINT IF EXISTS uk_category_country CASCADE;

ALTER TABLE employee_category_coefficients
  ADD CONSTRAINT uk_category_country_sector
  UNIQUE(country_code, category, sector_code);

-- Add index for fast lookups during payroll calculation
CREATE INDEX IF NOT EXISTS idx_category_coefficients_lookup
  ON employee_category_coefficients(country_code, category, sector_code)
  WHERE sector_code IS NOT NULL;

-- Add index for generic category lookups
CREATE INDEX IF NOT EXISTS idx_category_coefficients_generic
  ON employee_category_coefficients(country_code, category)
  WHERE sector_code IS NULL;

-- =====================================================
-- 2. Extend employees Table for CGECI Support
-- =====================================================

-- Add CGECI category tracking
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS category_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS sector_code_cgeci VARCHAR(50);

-- Add helpful comments
COMMENT ON COLUMN employees.category_code IS
  'CGECI category code (e.g., C, M1, 1A, 2B). Used for sector-specific minimum wage lookups.';

COMMENT ON COLUMN employees.sector_code_cgeci IS
  'CGECI sector code (e.g., BTP, BANQUES, COMMERCE). Corresponds to sector_code in employee_category_coefficients.';

-- Add index for fast payroll category lookups
CREATE INDEX IF NOT EXISTS idx_employees_cgeci_category
  ON employees(category_code, sector_code_cgeci)
  WHERE category_code IS NOT NULL;

-- Add index for country + CGECI lookup (payroll optimization)
CREATE INDEX IF NOT EXISTS idx_employees_country_cgeci
  ON employees(country_code, category_code, sector_code_cgeci)
  WHERE category_code IS NOT NULL;

-- =====================================================
-- 3. Update Existing Data (Preserve Generic Categories)
-- =====================================================

-- No data updates needed - existing 8 generic categories will have:
-- - sector_code = NULL (default)
-- - actual_minimum_wage = NULL (calculated from coefficient)
--
-- New CGECI data will have:
-- - sector_code = 'BTP', 'BANQUES', etc.
-- - actual_minimum_wage = 172911, 180000, etc.

-- =====================================================
-- 4. Validation Function (Optional Helper)
-- =====================================================

-- Function to validate employee minimum wage against CGECI requirements
CREATE OR REPLACE FUNCTION validate_employee_minimum_wage(
  p_country_code VARCHAR(2),
  p_category_code VARCHAR(10),
  p_sector_code VARCHAR(50),
  p_base_salary NUMERIC
)
RETURNS TABLE(
  is_valid BOOLEAN,
  minimum_required NUMERIC,
  category_label TEXT,
  message TEXT
) AS $$
DECLARE
  v_min_wage NUMERIC;
  v_label TEXT;
  v_smig NUMERIC;
BEGIN
  -- Try sector-specific minimum first
  SELECT actual_minimum_wage, label_fr
  INTO v_min_wage, v_label
  FROM employee_category_coefficients
  WHERE country_code = p_country_code
    AND category = p_category_code
    AND sector_code = p_sector_code
  LIMIT 1;

  -- Fall back to generic category if no sector-specific found
  IF v_min_wage IS NULL THEN
    -- Get SMIG for coefficient calculation
    SELECT base_monthly_wage INTO v_smig
    FROM countries
    WHERE code = p_country_code;

    -- Calculate from coefficient
    SELECT (min_coefficient::NUMERIC / 100.0) * COALESCE(v_smig, 75000), label_fr
    INTO v_min_wage, v_label
    FROM employee_category_coefficients
    WHERE country_code = p_country_code
      AND category = p_category_code
      AND sector_code IS NULL
    LIMIT 1;
  END IF;

  -- Return validation result
  RETURN QUERY SELECT
    CASE
      WHEN v_min_wage IS NULL THEN true -- No minimum found, allow
      WHEN p_base_salary >= v_min_wage THEN true
      ELSE false
    END AS is_valid,
    v_min_wage AS minimum_required,
    v_label AS category_label,
    CASE
      WHEN v_min_wage IS NULL THEN 'Aucun salaire minimum défini'
      WHEN p_base_salary >= v_min_wage THEN 'Salaire conforme'
      ELSE 'Salaire inférieur au minimum requis (' || v_min_wage || ' FCFA)'
    END AS message;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validate_employee_minimum_wage IS
  'Validates employee base salary against CGECI minimum wage requirements. Tries sector-specific minimum first, falls back to generic category.';

-- =====================================================
-- 5. Grant Permissions
-- =====================================================

-- Grant necessary permissions to tenant_user role
GRANT SELECT ON employee_category_coefficients TO tenant_user;
GRANT SELECT ON employees TO tenant_user;

-- =====================================================
-- End of Migration
-- =====================================================
