-- Migration: Enhance salary_component_templates for compliance-aware Smart Templates
-- Purpose: Add compliance levels, legal references, and customization controls
-- Date: 2025-10-07

-- ========================================================================
-- 1. Add new columns to salary_component_templates
-- ========================================================================

-- Compliance level: locked (mandatory), configurable (within bounds), freeform (flexible)
ALTER TABLE salary_component_templates
ADD COLUMN IF NOT EXISTS compliance_level TEXT DEFAULT 'freeform'
  CHECK (compliance_level IN ('locked', 'configurable', 'freeform'));

-- Legal reference (Convention Collective article)
ALTER TABLE salary_component_templates
ADD COLUMN IF NOT EXISTS legal_reference TEXT;

-- Fields that can be customized by tenant (JSONB array of field paths)
-- Example: ["calculationRule.rate", "calculationRule.baseAmount"]
ALTER TABLE salary_component_templates
ADD COLUMN IF NOT EXISTS customizable_fields JSONB DEFAULT '[]'::jsonb;

-- Can this template be deactivated?
ALTER TABLE salary_component_templates
ADD COLUMN IF NOT EXISTS can_deactivate BOOLEAN DEFAULT true;

-- Can this template's formula be modified?
ALTER TABLE salary_component_templates
ADD COLUMN IF NOT EXISTS can_modify BOOLEAN DEFAULT true;

-- Comments for documentation
COMMENT ON COLUMN salary_component_templates.compliance_level IS 'locked=mandatory/cannot change, configurable=within legal bounds, freeform=fully flexible';
COMMENT ON COLUMN salary_component_templates.legal_reference IS 'Reference to Convention Collective article (e.g., "Convention Collective Article 16")';
COMMENT ON COLUMN salary_component_templates.customizable_fields IS 'Array of JSON paths that tenant can customize (e.g., ["calculationRule.rate"])';
COMMENT ON COLUMN salary_component_templates.can_deactivate IS 'Whether tenant can disable this component (false for mandatory components)';
COMMENT ON COLUMN salary_component_templates.can_modify IS 'Whether tenant can modify the formula (false for locked formulas)';

-- ========================================================================
-- 2. Create compliance_rules table
-- ========================================================================

CREATE TABLE IF NOT EXISTS compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES countries(code),
  rule_type TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  can_exceed BOOLEAN DEFAULT false, -- Can tenant pay MORE than minimum?
  legal_reference TEXT NOT NULL,
  validation_logic JSONB NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_rule_type CHECK (rule_type IN (
    'minimum_wage',
    'seniority_bonus',
    'notice_period',
    'severance',
    'annual_leave',
    'maternity_leave',
    'overtime_rate',
    'transport_exemption',
    'housing_allowance_range',
    'hazard_pay_range'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_rules_country ON compliance_rules(country_code, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_type ON compliance_rules(rule_type);

-- RLS
ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read compliance rules (needed for validation)
CREATE POLICY "Public read access to compliance rules"
ON compliance_rules
FOR SELECT
TO authenticated
USING (true);

-- Only super admins can modify compliance rules
CREATE POLICY "Super admins can manage compliance rules"
ON compliance_rules
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- Comments
COMMENT ON TABLE compliance_rules IS 'Legal requirements from Convention Collective by country';
COMMENT ON COLUMN compliance_rules.rule_type IS 'Type of compliance rule (minimum_wage, overtime_rate, etc.)';
COMMENT ON COLUMN compliance_rules.is_mandatory IS 'Whether this rule is mandatory (cannot be disabled)';
COMMENT ON COLUMN compliance_rules.can_exceed IS 'Whether tenant can pay MORE than the minimum (e.g., SMIG + bonus)';
COMMENT ON COLUMN compliance_rules.validation_logic IS 'JSON validation rules (e.g., {"minimum": 75000, "maximum": null})';

-- ========================================================================
-- 3. Seed compliance rules for Côte d'Ivoire
-- ========================================================================

-- SMIG minimum wage
INSERT INTO compliance_rules (country_code, rule_type, is_mandatory, can_exceed, legal_reference, validation_logic, effective_from)
VALUES (
  'CI',
  'minimum_wage',
  true,
  true, -- Can pay more
  'Convention Collective Article 11',
  '{
    "minimum": 75000,
    "applies_to": "all_employees",
    "enforcement": "strict"
  }'::jsonb,
  '2025-01-01'
);

-- Seniority bonus rates
INSERT INTO compliance_rules (country_code, rule_type, is_mandatory, can_exceed, legal_reference, validation_logic, effective_from)
VALUES (
  'CI',
  'seniority_bonus',
  true,
  true, -- Can give more
  'Convention Collective Article 16',
  '{
    "rate_per_year": 0.02,
    "cap": 0.12,
    "max_years": 26,
    "calculation_base": "salaire_categoriel"
  }'::jsonb,
  '1977-01-01'
);

-- Transport allowance tax exemption cap
INSERT INTO compliance_rules (country_code, rule_type, is_mandatory, can_exceed, legal_reference, validation_logic, effective_from)
VALUES (
  'CI',
  'transport_exemption',
  false,
  true, -- Can pay more (but taxable)
  'Convention Collective Article 20',
  '{
    "exemption_cap": 30000,
    "beyond_cap": "taxable"
  }'::jsonb,
  '1977-01-01'
);

-- Housing allowance legal range
INSERT INTO compliance_rules (country_code, rule_type, is_mandatory, can_exceed, legal_reference, validation_logic, effective_from)
VALUES (
  'CI',
  'housing_allowance_range',
  false,
  true,
  'Convention Collective Article 20',
  '{
    "min_rate": 0.20,
    "max_rate": 0.30,
    "calculation_base": "base_salary",
    "recommended": 0.25
  }'::jsonb,
  '1977-01-01'
);

-- Hazard pay legal range
INSERT INTO compliance_rules (country_code, rule_type, is_mandatory, can_exceed, legal_reference, validation_logic, effective_from)
VALUES (
  'CI',
  'hazard_pay_range',
  false,
  true,
  'Convention Collective Article 18',
  '{
    "min_rate": 0.15,
    "max_rate": 0.25,
    "calculation_base": "base_salary",
    "requires_certification": true
  }'::jsonb,
  '1977-01-01'
);

-- Annual leave minimum
INSERT INTO compliance_rules (country_code, rule_type, is_mandatory, can_exceed, legal_reference, validation_logic, effective_from)
VALUES (
  'CI',
  'annual_leave',
  true,
  true, -- Can give more days
  'Convention Collective Article 28',
  '{
    "standard_days": 24,
    "accrual_rate": 2.0,
    "under_21_days": 30,
    "seniority_bonuses": {
      "15_years": 2,
      "20_years": 4,
      "25_years": 6
    }
  }'::jsonb,
  '1977-01-01'
);

-- ========================================================================
-- 4. Add indexes for performance
-- ========================================================================

-- Index for template lookups by compliance level
CREATE INDEX IF NOT EXISTS idx_templates_compliance_level
ON salary_component_templates(compliance_level, country_code, is_popular);

-- Index for legal reference lookups
CREATE INDEX IF NOT EXISTS idx_templates_legal_ref
ON salary_component_templates(legal_reference)
WHERE legal_reference IS NOT NULL;

-- ========================================================================
-- 5. Update existing templates to set compliance levels
-- ========================================================================

-- Note: We'll do this in a separate seed migration to avoid conflicts
-- with existing data. For now, new columns have safe defaults.

-- ========================================================================
-- 6. Create helper function to validate component customization
-- ========================================================================

CREATE OR REPLACE FUNCTION validate_component_customization(
  p_template_code TEXT,
  p_country_code TEXT,
  p_customization JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_rule RECORD;
  v_violations JSONB := '[]'::jsonb;
  v_custom_rate NUMERIC;
  v_custom_amount NUMERIC;
BEGIN
  -- Get template
  SELECT * INTO v_template
  FROM salary_component_templates
  WHERE code = p_template_code
  AND country_code = p_country_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'violations', jsonb_build_array(
        jsonb_build_object(
          'field', 'template',
          'error', 'Template not found'
        )
      )
    );
  END IF;

  -- If template is locked, no customization allowed
  IF v_template.compliance_level = 'locked' AND p_customization IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'violations', jsonb_build_array(
        jsonb_build_object(
          'field', 'compliance',
          'error', 'Ce composant est obligatoire et ne peut pas être modifié',
          'legal_reference', v_template.legal_reference
        )
      )
    );
  END IF;

  -- If configurable, validate against legal ranges
  IF v_template.compliance_level = 'configurable' THEN
    -- Check housing allowance rate (20-30%)
    IF v_template.code LIKE '%HOUSING%' THEN
      v_custom_rate := (p_customization->'calculationRule'->>'rate')::numeric;
      IF v_custom_rate IS NOT NULL THEN
        IF v_custom_rate < 0.20 OR v_custom_rate > 0.30 THEN
          v_violations := v_violations || jsonb_build_array(
            jsonb_build_object(
              'field', 'calculationRule.rate',
              'error', 'Le pourcentage doit être entre 20% et 30%',
              'legal_reference', v_template.legal_reference
            )
          );
        END IF;
      END IF;
    END IF;

    -- Check transport amount (≤30,000 for tax exemption)
    IF v_template.code LIKE '%TRANSPORT%' THEN
      v_custom_amount := (p_customization->'calculationRule'->>'baseAmount')::numeric;
      IF v_custom_amount IS NOT NULL THEN
        IF v_custom_amount > 30000 THEN
          v_violations := v_violations || jsonb_build_array(
            jsonb_build_object(
              'field', 'calculationRule.baseAmount',
              'error', 'Au-delà de 30,000 FCFA, la prime devient imposable',
              'legal_reference', v_template.legal_reference,
              'severity', 'warning'
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;

  -- Return validation result
  RETURN jsonb_build_object(
    'valid', jsonb_array_length(v_violations) = 0,
    'violations', v_violations
  );
END;
$$;

COMMENT ON FUNCTION validate_component_customization IS 'Validates tenant customization against compliance rules';

-- ========================================================================
-- Done!
-- ========================================================================
