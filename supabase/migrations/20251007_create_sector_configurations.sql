-- Create sector_configurations table for country-sector specific compliance rules
CREATE TABLE sector_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  sector_code VARCHAR(50) NOT NULL,
  sector_name TEXT NOT NULL,

  -- Payroll-specific rates
  work_accident_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0200,

  -- Required social security components for this sector
  -- Array of component codes: ['CNPS_PENSION', 'CNPS_FAMILY', 'CNPS_WORK_ACCIDENT', 'FNE', 'FDFP']
  required_components JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Smart defaults for this sector (auto-populated on tenant creation)
  smart_defaults JSONB,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(country_code, sector_code)
);

-- Create index for lookups
CREATE INDEX idx_sector_configurations_country_sector
  ON sector_configurations(country_code, sector_code);

-- Add RLS policies
ALTER TABLE sector_configurations ENABLE ROW LEVEL SECURITY;

-- Public read access (needed for tenant setup and payroll calculations)
CREATE POLICY "sector_configurations_select_all" ON sector_configurations
  FOR SELECT USING (true);

-- Only super admins can modify
CREATE POLICY "sector_configurations_insert_super_admin" ON sector_configurations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "sector_configurations_update_super_admin" ON sector_configurations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_sector_configurations_updated_at
  BEFORE UPDATE ON sector_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
