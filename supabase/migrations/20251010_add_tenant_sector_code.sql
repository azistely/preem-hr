-- Migration: Add tenant.sector_code field
-- Phase 1 of Architecture Analysis (Week 1)
-- Purpose: Enable sector-based compliance (work accident rates, required components)

-- Step 1: Add sector_code column (nullable initially)
ALTER TABLE tenants
  ADD COLUMN sector_code VARCHAR(50);

-- Step 2: Set default value for existing tenants
-- Use SERVICES as the safest default (lowest work accident rate: 2%)
UPDATE tenants
SET sector_code = 'SERVICES'
WHERE country_code = 'CI' AND sector_code IS NULL;

-- For other countries, set based on country default
UPDATE tenants
SET sector_code = (
  SELECT sector_code
  FROM sector_configurations sc
  WHERE sc.country_code = tenants.country_code
  ORDER BY sc.work_accident_rate ASC
  LIMIT 1
)
WHERE sector_code IS NULL;

-- Step 3: Add foreign key constraint
ALTER TABLE tenants
  ADD CONSTRAINT fk_tenant_sector
    FOREIGN KEY (country_code, sector_code)
    REFERENCES sector_configurations(country_code, sector_code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Step 4: Make sector_code NOT NULL (after all rows have values)
ALTER TABLE tenants
  ALTER COLUMN sector_code SET NOT NULL;

-- Step 5: Add index for performance
CREATE INDEX idx_tenants_sector ON tenants(country_code, sector_code);

-- Step 6: Add comment for documentation
COMMENT ON COLUMN tenants.sector_code IS 'Business activity sector determining work accident rates and required salary components (e.g., CONSTRUCTION, SERVICES, TRANSPORT)';
