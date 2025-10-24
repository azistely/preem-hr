-- Migration: Add Customizable Pay Slip Templates (GAP-DOC-002)
-- Created: 2025-10-22
-- Description: Allow companies to customize pay slip layout (logo, colors, sections)

-- ========================================
-- Payslip Templates Table
-- ========================================

CREATE TABLE IF NOT EXISTS payslip_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Template identification
  template_name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,

  -- Branding
  logo_url TEXT,
  company_name_override VARCHAR(255), -- Optional override for company name
  header_text TEXT,
  footer_text TEXT,

  -- Layout options
  layout_type VARCHAR(50) DEFAULT 'STANDARD', -- 'STANDARD', 'COMPACT', 'DETAILED'
  font_family VARCHAR(50) DEFAULT 'Helvetica',
  primary_color VARCHAR(7) DEFAULT '#000000', -- Hex color

  -- Sections visibility
  show_employer_contributions BOOLEAN DEFAULT true,
  show_year_to_date BOOLEAN DEFAULT true,
  show_leave_balance BOOLEAN DEFAULT true,

  -- Custom fields (Handlebars variables)
  custom_fields JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"label": "Matricule Bancaire", "value": "{{bankAccount}}"}]

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, template_name)
);

-- Create index for tenant lookups
CREATE INDEX idx_payslip_templates_tenant_id ON payslip_templates(tenant_id);
CREATE INDEX idx_payslip_templates_is_default ON payslip_templates(tenant_id, is_default) WHERE is_default = true;

-- Add RLS policies
ALTER TABLE payslip_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_payslip_templates ON payslip_templates
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Add default template for existing tenants
INSERT INTO payslip_templates (tenant_id, template_name, is_default, header_text, footer_text)
SELECT
  id,
  'Modèle Standard',
  true,
  'BULLETIN DE PAIE',
  'Ce document est confidentiel. Conservez-le précieusement.'
FROM tenants
ON CONFLICT (tenant_id, template_name) DO NOTHING;

COMMENT ON TABLE payslip_templates IS 'Customizable pay slip templates for each tenant';
COMMENT ON COLUMN payslip_templates.layout_type IS 'Template layout: STANDARD (default), COMPACT (minimal), DETAILED (comprehensive)';
COMMENT ON COLUMN payslip_templates.custom_fields IS 'Array of custom fields with Handlebars variables: [{"label": "Field Name", "value": "{{variable}}"}]';
