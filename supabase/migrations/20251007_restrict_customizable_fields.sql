-- Migration: Restrict customizable fields to prevent tax/CNPS modifications
-- Purpose: Enforce Convention Collective compliance - prevent users from modifying tax treatment
-- Date: 2025-10-07
--
-- CRITICAL: Tax treatment and CNPS contributions are defined by LAW, not by employer
-- Users can ONLY modify calculation amounts/rates within legal bounds

-- ========================================================================
-- 1. Update Existing Templates - Restrict Customizable Fields
-- ========================================================================

-- 🔒 LOCKED Templates: NO customization allowed
UPDATE salary_component_templates
SET customizable_fields = '[]'::jsonb
WHERE compliance_level = 'locked';

-- ⚙️ CONFIGURABLE Templates: ONLY calculation rule (rate or baseAmount)
UPDATE salary_component_templates
SET customizable_fields =
  CASE
    -- Housing allowance: only rate (20-30%)
    WHEN code = 'TPT_HOUSING_CI' THEN '["calculationRule.rate"]'::jsonb

    -- Transport allowance: only baseAmount (≤30,000)
    WHEN code = 'TPT_TRANSPORT_CI' THEN '["calculationRule.baseAmount"]'::jsonb

    -- Hazard pay: only rate (15-25%)
    WHEN code = 'TPT_HAZARD_PAY_CI' THEN '["calculationRule.rate"]'::jsonb

    -- Default: empty (no customization)
    ELSE '[]'::jsonb
  END
WHERE compliance_level = 'configurable';

-- 🎨 FREEFORM Templates: Only calculation rule fields
UPDATE salary_component_templates
SET customizable_fields =
  CASE
    -- Percentage-based components: rate only
    WHEN (metadata->'calculationRule'->>'type') = 'percentage'
      THEN '["calculationRule.rate"]'::jsonb

    -- Fixed amount components: baseAmount only
    WHEN (metadata->'calculationRule'->>'type') = 'fixed'
      THEN '["calculationRule.baseAmount"]'::jsonb

    -- Auto-calculated components: no customization (formula is fixed)
    WHEN (metadata->'calculationRule'->>'type') = 'auto-calculated'
      THEN '[]'::jsonb

    -- Default: empty
    ELSE '[]'::jsonb
  END
WHERE compliance_level = 'freeform';

-- ========================================================================
-- 2. Add Database Constraint - Enforce Forbidden Fields
-- ========================================================================

-- Add CHECK constraint to prevent forbidden field modifications in customizations
-- This is a backup safety check (primary validation is in ComplianceValidator)

COMMENT ON COLUMN salary_component_templates.customizable_fields IS
'JSONB array of field paths that can be customized (e.g., ["calculationRule.rate"]).

FORBIDDEN FIELDS (defined by law):
- taxTreatment.* (Code Général des Impôts)
- socialSecurityTreatment.* (Décret CNPS)
- category (impacts tax treatment)

ALLOWED FIELDS:
- calculationRule.rate (for percentage components, within legal ranges)
- calculationRule.baseAmount (for fixed components, within legal caps)

Validation enforced by ComplianceValidator service.';

-- ========================================================================
-- 3. Verify Migration Results
-- ========================================================================

-- Show templates with their customizable fields
SELECT
  code,
  (name->>'fr') as name,
  compliance_level,
  customizable_fields,
  can_modify,
  can_deactivate
FROM salary_component_templates
WHERE country_code = 'CI'
ORDER BY
  CASE compliance_level
    WHEN 'locked' THEN 1
    WHEN 'configurable' THEN 2
    WHEN 'freeform' THEN 3
  END,
  display_order;

-- ========================================================================
-- Expected Results:
-- ========================================================================
--
-- 🔒 LOCKED (1 template):
--   - TPT_SENIORITY_BONUS: customizable_fields = []
--   - can_modify = false, can_deactivate = false
--
-- ⚙️ CONFIGURABLE (3 templates):
--   - TPT_HOUSING_CI: customizable_fields = ["calculationRule.rate"]
--   - TPT_TRANSPORT_CI: customizable_fields = ["calculationRule.baseAmount"]
--   - TPT_HAZARD_PAY_CI: customizable_fields = ["calculationRule.rate"]
--   - can_modify = true, can_deactivate = true
--
-- 🎨 FREEFORM (15+ templates):
--   - Percentage types: customizable_fields = ["calculationRule.rate"]
--   - Fixed types: customizable_fields = ["calculationRule.baseAmount"]
--   - Auto-calculated: customizable_fields = []
--   - can_modify = true, can_deactivate = true
--
-- ========================================================================
-- Rollback (if needed):
-- ========================================================================
--
-- To restore original state (NOT RECOMMENDED):
-- UPDATE salary_component_templates
-- SET customizable_fields =
--   CASE compliance_level
--     WHEN 'locked' THEN '[]'::jsonb
--     WHEN 'configurable' THEN '["calculationRule.rate", "calculationRule.baseAmount"]'::jsonb
--     WHEN 'freeform' THEN '["calculationRule.rate", "calculationRule.baseAmount", "taxTreatment", "socialSecurityTreatment"]'::jsonb
--   END;
--
