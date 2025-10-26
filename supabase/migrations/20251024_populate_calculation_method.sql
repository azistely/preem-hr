-- Populate calculation_method for salary component definitions
-- Based on component semantics and business rules

-- ============================================================================
-- 1. Set variable components (monthly input required)
-- ============================================================================

UPDATE salary_component_definitions
SET calculation_method = 'variable'
WHERE component_type IN (
  'performance',      -- Prime de Rendement (varies by performance)
  'advance',          -- Avance sur Salaire (ad-hoc)
  'loan',             -- Prêt Employeur (varies by period)
  'end_of_year'       -- Gratification de Fin d'Année (once per year)
)
AND calculation_method IS NULL;

-- ============================================================================
-- 2. Set percentage components (auto-calculated from base)
-- ============================================================================

-- Already set in previous seed: Prime d'Ancienneté, Indemnité de Responsabilité

-- ============================================================================
-- 3. Set fixed components (regular monthly amounts)
-- ============================================================================

UPDATE salary_component_definitions
SET calculation_method = 'fixed'
WHERE component_type IN (
  'housing',          -- Indemnité de Logement
  'transport',        -- Indemnité de Transport
  'meal',             -- Indemnité de Repas
  'salaire_categoriel', -- Salaire catégoriel (SMIG-based)
  'seniority',        -- Prime d'ancienneté (if not already percentage)
  'responsibility',   -- Indemnité de Responsabilité
  'technical_allowance', -- Prime de technicité
  'risk_allowance',   -- Prime de risque
  'dirtiness_allowance', -- Prime de salissure
  'sursalaire'        -- Sursalaire
)
AND calculation_method IS NULL;

-- ============================================================================
-- 4. Set formula components (complex calculations)
-- ============================================================================

UPDATE salary_component_definitions
SET calculation_method = 'formula'
WHERE component_type IN (
  'family_allowances' -- Allocations familiales (based on # of children, complex rules)
)
AND calculation_method IS NULL;

-- ============================================================================
-- 5. Set benefits in kind as fixed (taxable amount is known)
-- ============================================================================

UPDATE salary_component_definitions
SET calculation_method = 'fixed'
WHERE component_type LIKE 'benefit_in_kind_%'
AND calculation_method IS NULL;

-- ============================================================================
-- 6. Default remaining components to fixed
-- ============================================================================

UPDATE salary_component_definitions
SET calculation_method = 'fixed'
WHERE calculation_method IS NULL;

-- ============================================================================
-- Verification
-- ============================================================================

-- Show distribution after migration
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Calculation Method Distribution:';
  FOR rec IN
    SELECT
      calculation_method,
      COUNT(*) as count,
      array_agg(name->>'fr' ORDER BY name->>'fr') as components
    FROM salary_component_definitions
    WHERE country_code = 'CI'
    GROUP BY calculation_method
    ORDER BY calculation_method
  LOOP
    RAISE NOTICE '  % (%): %', rec.calculation_method, rec.count, rec.components;
  END LOOP;
END $$;

-- ============================================================================
-- Add helpful comment
-- ============================================================================

COMMENT ON COLUMN salary_component_definitions.calculation_method IS
'How this component is calculated:
- fixed: Regular monthly amount (e.g., housing allowance)
- variable: Changes monthly, requires input via variable_pay_inputs (e.g., commission)
- percentage: Auto-calculated as % of base salary (e.g., seniority bonus)
- formula: Complex calculation (e.g., family allowances based on # of children)';
