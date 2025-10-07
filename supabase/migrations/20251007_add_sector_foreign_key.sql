-- Add foreign key constraint to tenants.sector_code
-- This ensures data integrity and prevents invalid sector codes

-- First, update any NULL sector_code values to 'SERVICES' (safe default)
UPDATE tenants
SET sector_code = 'SERVICES'
WHERE sector_code IS NULL
  AND country_code = 'CI';

-- Now add the foreign key constraint
ALTER TABLE tenants
ADD CONSTRAINT fk_tenants_sector_code
FOREIGN KEY (country_code, sector_code)
REFERENCES sector_configurations(country_code, sector_code)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Create index to improve foreign key lookup performance
CREATE INDEX idx_tenants_country_sector
ON tenants(country_code, sector_code);
