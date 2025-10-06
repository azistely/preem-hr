-- Add minimum_wage column to countries table
-- Migration: 20251005_add_minimum_wage_to_countries.sql
-- Purpose: Support multi-country minimum wage validation

-- =============================================================================
-- ADD MINIMUM_WAGE COLUMN
-- =============================================================================

-- Add minimum_wage column with default value (Côte d'Ivoire SMIG)
ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS minimum_wage NUMERIC(15, 2) DEFAULT 75000;

-- Add comment for documentation
COMMENT ON COLUMN countries.minimum_wage IS 'Minimum monthly wage (SMIG) in local currency';

-- =============================================================================
-- SEED MINIMUM WAGE DATA FOR WEST AFRICAN COUNTRIES
-- =============================================================================

-- Update existing countries with correct SMIG values (as of 2025)
UPDATE countries SET minimum_wage = 75000 WHERE code = 'CI'; -- Côte d'Ivoire
UPDATE countries SET minimum_wage = 60000 WHERE code = 'SN'; -- Sénégal
UPDATE countries SET minimum_wage = 40000 WHERE code = 'BF'; -- Burkina Faso
UPDATE countries SET minimum_wage = 52000 WHERE code = 'TG'; -- Togo
UPDATE countries SET minimum_wage = 40000 WHERE code = 'BJ'; -- Bénin
UPDATE countries SET minimum_wage = 35000 WHERE code = 'ML'; -- Mali
UPDATE countries SET minimum_wage = 36000 WHERE code = 'NE'; -- Niger

-- =============================================================================
-- CREATE INDEX FOR PERFORMANCE
-- =============================================================================

-- Index for efficient lookup by country code and minimum wage
CREATE INDEX IF NOT EXISTS idx_countries_minimum_wage
  ON countries(code, minimum_wage)
  WHERE is_active = true;
