-- Migration: Add Banking Professional Levels (GAP-CONV-BANK-001)
-- Created: 2025-10-22
-- Description: Support banking sector's 9 professional levels (I-IX) with seniority bonuses

-- ========================================
-- Convention Collectives Table
-- ========================================

CREATE TABLE IF NOT EXISTS convention_collectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  convention_code VARCHAR(50) NOT NULL, -- 'INTERPRO', 'BANKING', 'BTP', etc.
  convention_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(country_code, convention_code)
);

-- ========================================
-- Banking Professional Levels
-- ========================================

CREATE TABLE IF NOT EXISTS banking_professional_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id UUID NOT NULL REFERENCES convention_collectives(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL, -- 1-9 (I-IX)
  level_name VARCHAR(10) NOT NULL, -- 'I', 'II', 'III', ..., 'IX'
  minimum_salary DECIMAL(15,2) NOT NULL,
  typical_positions TEXT[], -- ['Caissier', 'Guichetier']
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(convention_id, level_number)
);

-- ========================================
-- Banking Seniority Bonuses
-- ========================================

CREATE TABLE IF NOT EXISTS banking_seniority_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_id UUID NOT NULL REFERENCES convention_collectives(id) ON DELETE CASCADE,
  years_of_service INTEGER NOT NULL,
  bonus_percentage DECIMAL(5,2) NOT NULL, -- 3.00 = 3%
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(convention_id, years_of_service)
);

-- Create indexes
CREATE INDEX idx_convention_collectives_country_code ON convention_collectives(country_code);
CREATE INDEX idx_banking_professional_levels_convention_id ON banking_professional_levels(convention_id);
CREATE INDEX idx_banking_seniority_bonuses_convention_id ON banking_seniority_bonuses(convention_id);

-- Add RLS policies
ALTER TABLE convention_collectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_professional_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE banking_seniority_bonuses ENABLE ROW LEVEL SECURITY;

-- Public read access for convention data (all tenants need to see available conventions)
CREATE POLICY public_read_convention_collectives ON convention_collectives
  FOR SELECT
  TO tenant_user
  USING (true);

CREATE POLICY public_read_banking_professional_levels ON banking_professional_levels
  FOR SELECT
  TO tenant_user
  USING (true);

CREATE POLICY public_read_banking_seniority_bonuses ON banking_seniority_bonuses
  FOR SELECT
  TO tenant_user
  USING (true);

-- Super admin can manage conventions
CREATE POLICY super_admin_manage_convention_collectives ON convention_collectives
  FOR ALL
  TO tenant_user
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY super_admin_manage_banking_professional_levels ON banking_professional_levels
  FOR ALL
  TO tenant_user
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY super_admin_manage_banking_seniority_bonuses ON banking_seniority_bonuses
  FOR ALL
  TO tenant_user
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');

-- ========================================
-- Seed Data: Banking Convention (Côte d'Ivoire)
-- ========================================

-- Insert banking convention
INSERT INTO convention_collectives (country_code, convention_code, convention_name) VALUES
('CI', 'BANKING', 'Convention Collective des Banques et Établissements Financiers')
ON CONFLICT (country_code, convention_code) DO NOTHING;

-- Get the banking convention ID
DO $$
DECLARE
  banking_convention_id UUID;
BEGIN
  SELECT id INTO banking_convention_id
  FROM convention_collectives
  WHERE country_code = 'CI' AND convention_code = 'BANKING';

  -- Professional levels (2025 CI banking sector)
  INSERT INTO banking_professional_levels (convention_id, level_number, level_name, minimum_salary, typical_positions) VALUES
  (banking_convention_id, 1, 'I', 120000, ARRAY['Caissier', 'Standardiste', 'Agent d''accueil']),
  (banking_convention_id, 2, 'II', 150000, ARRAY['Guichetier', 'Agent de crédit junior', 'Secrétaire']),
  (banking_convention_id, 3, 'III', 200000, ARRAY['Conseiller clientèle', 'Chargé de clientèle', 'Comptable']),
  (banking_convention_id, 4, 'IV', 280000, ARRAY['Chef de service', 'Analyste de crédit', 'Contrôleur interne']),
  (banking_convention_id, 5, 'V', 400000, ARRAY['Responsable d''agence', 'Chef de département', 'Auditeur interne']),
  (banking_convention_id, 6, 'VI', 600000, ARRAY['Directeur d''agence', 'Directeur de département', 'Expert métier']),
  (banking_convention_id, 7, 'VII', 900000, ARRAY['Directeur régional', 'Directeur métier', 'Responsable de division']),
  (banking_convention_id, 8, 'VIII', 1400000, ARRAY['Directeur général adjoint', 'Directeur de pôle', 'Directeur central']),
  (banking_convention_id, 9, 'IX', 2000000, ARRAY['Directeur général', 'Président directeur général'])
  ON CONFLICT (convention_id, level_number) DO NOTHING;

  -- Seniority bonuses (+3% every 3 years, up to 15%)
  INSERT INTO banking_seniority_bonuses (convention_id, years_of_service, bonus_percentage) VALUES
  (banking_convention_id, 3, 3.00),
  (banking_convention_id, 6, 6.00),
  (banking_convention_id, 9, 9.00),
  (banking_convention_id, 12, 12.00),
  (banking_convention_id, 15, 15.00)
  ON CONFLICT (convention_id, years_of_service) DO NOTHING;
END $$;

-- ========================================
-- Add Banking Convention to Employees
-- ========================================

-- Add convention tracking to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS convention_code VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS professional_level INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sector VARCHAR(50) DEFAULT 'services';

-- Add index for convention lookups
CREATE INDEX IF NOT EXISTS idx_employees_convention_code ON employees(convention_code);
CREATE INDEX IF NOT EXISTS idx_employees_professional_level ON employees(professional_level);

-- Add check constraint for banking levels (1-9 for banking convention)
ALTER TABLE employees ADD CONSTRAINT chk_banking_professional_level
  CHECK (
    (convention_code != 'BANKING' OR professional_level IS NULL)
    OR
    (convention_code = 'BANKING' AND professional_level BETWEEN 1 AND 9)
  );

COMMENT ON TABLE convention_collectives IS 'Collective labor agreements (conventions collectives) by country';
COMMENT ON TABLE banking_professional_levels IS 'Banking sector professional levels (I-IX) with minimum salaries';
COMMENT ON TABLE banking_seniority_bonuses IS 'Automatic seniority bonuses based on years of service';
COMMENT ON COLUMN employees.convention_code IS 'Convention collective code (e.g., INTERPRO, BANKING, BTP)';
COMMENT ON COLUMN employees.professional_level IS 'Professional level within the convention (e.g., 1-9 for banking)';
COMMENT ON COLUMN employees.sector IS 'Economic sector for social security calculations (services, industry, agriculture)';
