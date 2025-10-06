-- Migration: Option B - Template References with Overrides
-- Purpose: Single source of truth for compliance, tenant owns only customizations
-- Date: 2025-10-07
--
-- Architecture:
-- - Templates = Law (managed by super admin, single source of truth)
-- - Activations = Tenant choices (which templates to use, customizations within bounds)
-- - Runtime = Merge template + overrides

-- ========================================================================
-- 1. Create Tenant Salary Component Activations Table
-- ========================================================================

CREATE TABLE IF NOT EXISTS tenant_salary_component_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,
  template_code VARCHAR(50) NOT NULL,

  -- Overrides (ONLY allowed fields from template.customizable_fields)
  overrides JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Tenant-specific metadata
  custom_name TEXT, -- Optional: override display name
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(tenant_id, country_code, template_code),

  -- Foreign key to template
  FOREIGN KEY (template_code, country_code)
    REFERENCES salary_component_templates(code, country_code)
    ON DELETE RESTRICT -- Prevent deleting templates that are in use
);

-- Indexes for performance
CREATE INDEX idx_activations_tenant ON tenant_salary_component_activations(tenant_id);
CREATE INDEX idx_activations_active ON tenant_salary_component_activations(tenant_id, is_active)
  WHERE is_active = true;

-- RLS Policy (tenant isolation)
ALTER TABLE tenant_salary_component_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_salary_component_activations
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Comments
COMMENT ON TABLE tenant_salary_component_activations IS
'Tenant activations of salary component templates with customizations.
Only stores OVERRIDES of customizable fields - all other metadata comes from template.';

COMMENT ON COLUMN tenant_salary_component_activations.overrides IS
'JSONB object containing ONLY customizable fields.
Example: {"calculationRule": {"rate": 0.25}}
Validation: Must only contain fields listed in template.customizable_fields';

COMMENT ON COLUMN tenant_salary_component_activations.custom_name IS
'Optional: Override the template name for this tenant (e.g., localization)';

-- ========================================================================
-- 2. Migrate Existing custom_salary_components to Activations
-- ========================================================================

-- For components created from templates
INSERT INTO tenant_salary_component_activations (
  tenant_id,
  country_code,
  template_code,
  overrides,
  custom_name,
  is_active,
  display_order,
  created_at,
  updated_at,
  created_by
)
SELECT
  csc.tenant_id,
  csc.country_code,
  csc.template_code,
  -- Extract ONLY customizable fields from metadata
  CASE
    WHEN sct.customizable_fields @> '["calculationRule.rate"]'::jsonb
      THEN jsonb_build_object(
        'calculationRule',
        jsonb_build_object('rate', (csc.metadata->'calculationRule'->>'rate')::numeric)
      )
    WHEN sct.customizable_fields @> '["calculationRule.baseAmount"]'::jsonb
      THEN jsonb_build_object(
        'calculationRule',
        jsonb_build_object('baseAmount', (csc.metadata->'calculationRule'->>'baseAmount')::numeric)
      )
    ELSE '{}'::jsonb
  END as overrides,
  -- Custom name if different from template
  CASE
    WHEN csc.name != (sct.name->>'fr') THEN csc.name
    ELSE NULL
  END as custom_name,
  csc.is_active,
  csc.display_order,
  csc.created_at,
  csc.updated_at,
  csc.created_by
FROM custom_salary_components csc
INNER JOIN salary_component_templates sct
  ON csc.template_code = sct.code
  AND csc.country_code = sct.country_code
WHERE csc.template_code IS NOT NULL
ON CONFLICT (tenant_id, country_code, template_code) DO NOTHING;

-- ========================================================================
-- 3. Verification
-- ========================================================================

SELECT
  a.id,
  a.tenant_id,
  a.template_code,
  (t.name->>'fr') as template_name,
  t.compliance_level,
  t.customizable_fields,
  a.overrides,
  a.custom_name,
  a.is_active
FROM tenant_salary_component_activations a
INNER JOIN salary_component_templates t
  ON a.template_code = t.code
  AND a.country_code = t.country_code
LIMIT 10;

-- ========================================================================
-- Expected Results:
-- ========================================================================
--
-- Locked templates (e.g., Seniority Bonus):
--   - overrides = {} (no customization allowed)
--   - All metadata comes from template at runtime
--
-- Configurable templates (e.g., Housing Allowance):
--   - overrides = {"calculationRule": {"rate": 0.25}}
--   - Tax treatment, CNPS always from template
--
-- Freeform templates (e.g., Phone Allowance):
--   - overrides = {"calculationRule": {"baseAmount": 15000}}
--   - Tax treatment, CNPS always from template
--
