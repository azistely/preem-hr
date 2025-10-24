-- Add CGECI sector fields to tenants table
-- This migration adds company-level CGECI sector tracking

-- Add CGECI sector code column (determines employee categories and minimum wages)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS cgeci_sector_code VARCHAR(50);

-- Add generic sector code column (auto-derived from CGECI, used for work accident rates)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS generic_sector_code VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN tenants.cgeci_sector_code IS 'CGECI Barème 2023 sector code (e.g., BANQUES, BTP, COMMERCE) - determines employee categories';
COMMENT ON COLUMN tenants.generic_sector_code IS 'Generic sector code (e.g., SERVICES, CONSTRUCTION, INDUSTRY) - auto-derived from CGECI sector for work accident rates';
