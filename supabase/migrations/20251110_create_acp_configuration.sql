-- Migration: Create ACP Configuration Table
-- Description: Store country-specific ACP calculation parameters for multi-country support
-- Date: 2025-11-10
-- Author: Preem HR Engineering Team

-- Create acp_configuration table
CREATE TABLE IF NOT EXISTS acp_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),

  -- Formula parameters
  days_per_month_factor NUMERIC(3, 1) NOT NULL DEFAULT 2.2,
  calendar_day_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1.25,
  default_paid_days_per_month INTEGER NOT NULL DEFAULT 30,

  -- Salary components to include in ACP calculation
  includes_base_salary BOOLEAN NOT NULL DEFAULT TRUE,
  includes_taxable_allowances BOOLEAN NOT NULL DEFAULT TRUE,
  includes_non_taxable_allowances BOOLEAN NOT NULL DEFAULT FALSE,
  includes_bonuses BOOLEAN NOT NULL DEFAULT FALSE,
  includes_overtime BOOLEAN NOT NULL DEFAULT FALSE,

  -- Reference period configuration
  reference_period_type VARCHAR(20) NOT NULL DEFAULT 'since_last_leave',
  -- Options: 'since_last_leave', 'fixed_12_months', 'calendar_year'

  -- Effective dates (for configuration versioning)
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_acp_config_country ON acp_configuration(country_code);
CREATE INDEX idx_acp_config_effective ON acp_configuration(effective_from, effective_to);

-- Create unique constraint: only one active config per country at a time
CREATE UNIQUE INDEX idx_acp_config_country_active
  ON acp_configuration(country_code)
  WHERE effective_to IS NULL;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_acp_configuration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_acp_configuration_updated_at
  BEFORE UPDATE ON acp_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_acp_configuration_updated_at();

-- Seed data for Côte d'Ivoire (Convention Collective Interprofessionnelle)
INSERT INTO acp_configuration (
  country_code,
  days_per_month_factor,
  calendar_day_multiplier,
  default_paid_days_per_month,
  includes_base_salary,
  includes_taxable_allowances,
  includes_non_taxable_allowances,
  includes_bonuses,
  includes_overtime,
  reference_period_type,
  effective_from
) VALUES (
  'CI',
  2.2,  -- Convention Collective Art. 25.1: 2.2 jours ouvrables/mois
  1.25, -- Conversion factor: jours ouvrables → jours calendaires
  30,   -- Default assumption: 30 paid days per month
  TRUE, -- Include base salary in ACP calculation
  TRUE, -- Include taxable allowances (transport, housing, meal)
  FALSE,-- Exclude non-taxable allowances (family allowances)
  FALSE,-- Exclude bonuses from ACP calculation
  FALSE,-- Exclude overtime from ACP calculation
  'since_last_leave', -- Reference period: last leave return or hire date
  '2024-01-01'
) ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE acp_configuration IS 'Country-specific ACP (Allocations de Congés Payés) calculation parameters';
COMMENT ON COLUMN acp_configuration.days_per_month_factor IS 'Base leave accrual rate (e.g., 2.2 for CI per Convention Collective Art. 25.1)';
COMMENT ON COLUMN acp_configuration.calendar_day_multiplier IS 'Multiplier to convert seniority bonus from working days to calendar days (1.25)';
COMMENT ON COLUMN acp_configuration.default_paid_days_per_month IS 'Default paid days per month when no attendance tracking (typically 30)';
COMMENT ON COLUMN acp_configuration.reference_period_type IS 'How to calculate reference period: since_last_leave (from last leave return or hire date), fixed_12_months (always 12 months), calendar_year (Jan 1 - Dec 31)';

-- Grant permissions (adjust based on your RLS policy)
ALTER TABLE acp_configuration ENABLE ROW LEVEL SECURITY;

-- Super admin can read all configs
CREATE POLICY acp_config_read_all ON acp_configuration
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Tenants can read configs for their country
CREATE POLICY acp_config_read_tenant_country ON acp_configuration
  FOR SELECT
  USING (
    country_code IN (
      SELECT country_code
      FROM tenants
      WHERE id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

-- Only super admin can modify configs
CREATE POLICY acp_config_modify_super_admin ON acp_configuration
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');
