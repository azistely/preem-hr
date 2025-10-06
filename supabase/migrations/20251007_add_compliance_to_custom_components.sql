-- Migration: Add compliance metadata to custom_salary_components
-- Purpose: Copy compliance rules from templates to enforce editing restrictions
-- Date: 2025-10-07
--
-- This enables the UI to know which fields can be edited without
-- repeatedly querying the template table.

-- ========================================================================
-- 1. Add Compliance Columns
-- ========================================================================

ALTER TABLE custom_salary_components
ADD COLUMN IF NOT EXISTS compliance_level VARCHAR(20) DEFAULT 'freeform',
ADD COLUMN IF NOT EXISTS customizable_fields JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS can_modify BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_deactivate BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS legal_reference TEXT;

COMMENT ON COLUMN custom_salary_components.compliance_level IS
'Compliance level copied from template: locked, configurable, or freeform';

COMMENT ON COLUMN custom_salary_components.customizable_fields IS
'JSONB array of field paths that can be customized (copied from template)';

COMMENT ON COLUMN custom_salary_components.can_modify IS
'Whether this component can be modified (copied from template)';

COMMENT ON COLUMN custom_salary_components.can_deactivate IS
'Whether this component can be deactivated (copied from template)';

COMMENT ON COLUMN custom_salary_components.legal_reference IS
'Legal reference for compliance rules (copied from template)';

-- ========================================================================
-- 2. Backfill Existing Components
-- ========================================================================

-- For components created from templates, copy the compliance metadata
UPDATE custom_salary_components csc
SET
  compliance_level = COALESCE(sct.compliance_level, 'freeform'),
  customizable_fields = COALESCE(sct.customizable_fields, '[]'::jsonb),
  can_modify = COALESCE(sct.can_modify, true),
  can_deactivate = COALESCE(sct.can_deactivate, true),
  legal_reference = sct.legal_reference
FROM salary_component_templates sct
WHERE csc.template_code = sct.code
  AND csc.country_code = sct.country_code;

-- For legacy components without template_code, default to freeform
UPDATE custom_salary_components
SET
  compliance_level = 'freeform',
  customizable_fields = '["calculationRule.rate", "calculationRule.baseAmount"]'::jsonb,
  can_modify = true,
  can_deactivate = true
WHERE template_code IS NULL
  AND compliance_level IS NULL;

-- ========================================================================
-- 3. Verification Query
-- ========================================================================

SELECT
  csc.id,
  csc.name,
  csc.code,
  csc.template_code,
  csc.compliance_level,
  csc.customizable_fields,
  csc.can_modify,
  csc.can_deactivate,
  csc.legal_reference
FROM custom_salary_components csc
ORDER BY csc.created_at DESC
LIMIT 20;

-- ========================================================================
-- Expected Results:
-- ========================================================================
--
-- Components from locked templates:
--   - compliance_level = 'locked'
--   - customizable_fields = []
--   - can_modify = false
--   - can_deactivate = false
--
-- Components from configurable templates:
--   - compliance_level = 'configurable'
--   - customizable_fields = ["calculationRule.rate"] or ["calculationRule.baseAmount"]
--   - can_modify = true
--   - can_deactivate = true
--
-- Components from freeform templates:
--   - compliance_level = 'freeform'
--   - customizable_fields = ["calculationRule.rate"] or ["calculationRule.baseAmount"]
--   - can_modify = true
--   - can_deactivate = true
--
