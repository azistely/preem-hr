-- Migration: Add Salary Components System (Three-Level Admin Architecture)
-- Date: 2025-10-06
-- Purpose: Implement comprehensive multi-country salary components with metadata

-- 1. Add components column to employee_salaries (backward compatible)
ALTER TABLE employee_salaries
ADD COLUMN IF NOT EXISTS components JSONB DEFAULT '[]'::jsonb NOT NULL;

-- 2. Create salary_component_templates table (template library)
CREATE TABLE IF NOT EXISTS salary_component_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  suggested_amount NUMERIC(15, 2),
  is_popular BOOLEAN DEFAULT false NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT salary_component_templates_country_code_code_key UNIQUE (country_code, code),
  CONSTRAINT chk_template_category CHECK (category = ANY(ARRAY['allowance', 'bonus', 'deduction']))
);

CREATE INDEX IF NOT EXISTS idx_salary_templates_country ON salary_component_templates(country_code);
CREATE INDEX IF NOT EXISTS idx_salary_templates_popular ON salary_component_templates(country_code, is_popular) WHERE is_popular = true;

-- 3. Create sector_configurations table
CREATE TABLE IF NOT EXISTS sector_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  sector_code VARCHAR(50) NOT NULL,
  name JSONB NOT NULL,
  work_accident_rate NUMERIC(6, 4) NOT NULL,
  default_components JSONB DEFAULT '{}'::jsonb NOT NULL,
  smart_defaults JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT sector_configurations_country_code_sector_code_key UNIQUE (country_code, sector_code)
);

CREATE INDEX IF NOT EXISTS idx_sector_configs_country ON sector_configurations(country_code);

-- 4. Create custom_salary_components table (tenant-specific)
CREATE TABLE IF NOT EXISTS custom_salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_code VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES users(id),
  CONSTRAINT custom_salary_components_tenant_id_country_code_code_key UNIQUE (tenant_id, country_code, code)
);

CREATE INDEX IF NOT EXISTS idx_custom_components_tenant ON custom_salary_components(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_components_active ON custom_salary_components(tenant_id, is_active) WHERE is_active = true;

-- 5. Enable RLS on custom_salary_components
ALTER TABLE custom_salary_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON custom_salary_components
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR
    (auth.jwt() ->> 'role')::text = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create triggers for updated_at
CREATE TRIGGER update_salary_component_templates_updated_at
  BEFORE UPDATE ON salary_component_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sector_configurations_updated_at
  BEFORE UPDATE ON sector_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_salary_components_updated_at
  BEFORE UPDATE ON custom_salary_components
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
