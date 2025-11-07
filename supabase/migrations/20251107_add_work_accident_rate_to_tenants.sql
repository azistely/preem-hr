-- Migration: Add work_accident_rate to tenants table
-- Date: 2025-11-07
-- Purpose: Allow companies to input their CNPS-provided work accident rate
--          which will be used in payroll calculations instead of auto-derived rates

-- Add work_accident_rate column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS work_accident_rate NUMERIC(5,4) DEFAULT 0.0200;

-- Set default work accident rates based on existing generic_sector_code
-- This ensures existing tenants get appropriate default values
UPDATE tenants
SET work_accident_rate = CASE
  WHEN generic_sector_code = 'SERVICES' THEN 0.0200       -- 2%
  WHEN generic_sector_code = 'AGRICULTURE' THEN 0.0250    -- 2.5%
  WHEN generic_sector_code = 'INDUSTRY' THEN 0.0300       -- 3%
  WHEN generic_sector_code = 'TRANSPORT' THEN 0.0350      -- 3.5%
  WHEN generic_sector_code = 'CONSTRUCTION' THEN 0.0500   -- 5%
  WHEN generic_sector_code = 'MINING' THEN 0.0500         -- 5%
  ELSE 0.0200  -- Default to 2% (SERVICES) if sector unknown
END
WHERE work_accident_rate IS NULL OR work_accident_rate = 0.0200;

-- Add comment explaining the field
COMMENT ON COLUMN tenants.work_accident_rate IS
'Work accident rate (Taux d''accident du travail) provided by CNPS.
This rate is used to calculate employer contributions for work accidents (AT).
Companies can override the default sector-based rate with their specific CNPS rate.
Value range: typically 0.0000 to 0.1000 (0% to 10%)';
