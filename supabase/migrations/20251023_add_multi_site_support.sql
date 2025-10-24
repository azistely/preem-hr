-- Migration: Multi-Site/Multi-Location Support for Preem HR
-- Date: 2025-10-23
-- Author: Claude Code
-- Description: Adds support for tracking employees across multiple locations/sites
--              with location-specific allowances (transport, meal, site premium, hazard pay)

-- 1. Locations/Sites master table
CREATE TABLE IF NOT EXISTS locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Location identifiers
    location_code VARCHAR(20) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    location_type VARCHAR(50) NOT NULL, -- 'headquarters', 'branch', 'construction_site', 'client_site'

    -- Address information
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country_code VARCHAR(2) DEFAULT 'CI',

    -- GPS coordinates (for geofencing)
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    geofence_radius_meters INTEGER DEFAULT 100,

    -- Location-specific allowances (in local currency - FCFA)
    transport_allowance NUMERIC(15, 2) DEFAULT 0,
    meal_allowance NUMERIC(15, 2) DEFAULT 0,
    site_premium NUMERIC(15, 2) DEFAULT 0,
    hazard_pay_rate NUMERIC(6, 4) DEFAULT 0, -- percentage (e.g., 0.10 = 10%)

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    notes TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    CONSTRAINT locations_unique_code UNIQUE(tenant_id, location_code),
    CONSTRAINT location_type_valid CHECK (
        location_type IN ('headquarters', 'branch', 'construction_site', 'client_site')
    )
);

-- 2. Employee site assignments (daily tracking)
CREATE TABLE IF NOT EXISTS employee_site_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,

    -- Optional: time tracking integration
    start_time TIME,
    end_time TIME,
    hours_worked NUMERIC(5, 2),

    -- Flags
    is_primary_site BOOLEAN DEFAULT false,
    is_overtime_eligible BOOLEAN DEFAULT true,

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,

    -- Constraints
    CONSTRAINT assignment_unique_employee_date UNIQUE(employee_id, assignment_date, location_id)
);

-- 3. Add location reference to time_entries (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'time_entries' AND column_name = 'location_id'
    ) THEN
        ALTER TABLE time_entries
        ADD COLUMN location_id UUID REFERENCES locations(id);
    END IF;
END $$;

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(tenant_id, location_code);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_site_assignments_employee_date ON employee_site_assignments(employee_id, assignment_date);
CREATE INDEX IF NOT EXISTS idx_site_assignments_location_date ON employee_site_assignments(location_id, assignment_date);
CREATE INDEX IF NOT EXISTS idx_site_assignments_date ON employee_site_assignments(assignment_date);

CREATE INDEX IF NOT EXISTS idx_time_entries_location ON time_entries(location_id) WHERE location_id IS NOT NULL;

-- 5. Enable Row-Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_site_assignments ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies

-- Locations: Tenant isolation
DROP POLICY IF EXISTS locations_tenant_isolation ON locations;
CREATE POLICY locations_tenant_isolation ON locations
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- Site assignments: Tenant isolation via employee
DROP POLICY IF EXISTS site_assignments_tenant_isolation ON employee_site_assignments;
CREATE POLICY site_assignments_tenant_isolation ON employee_site_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = employee_site_assignments.employee_id
            AND (
                employees.tenant_id::text = (auth.jwt() ->> 'tenant_id')
                OR (auth.jwt() ->> 'role') = 'super_admin'
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees
            WHERE employees.id = employee_site_assignments.employee_id
            AND employees.tenant_id::text = (auth.jwt() ->> 'tenant_id')
        )
    );

-- 7. Add helpful comments
COMMENT ON TABLE locations IS 'Master table for company locations/sites (headquarters, branches, construction sites, client sites)';
COMMENT ON TABLE employee_site_assignments IS 'Daily tracking of which employees work at which locations';

COMMENT ON COLUMN locations.location_code IS 'Unique code for location within tenant (e.g., HQ, ABJ-01, BOUAKE-SITE)';
COMMENT ON COLUMN locations.location_type IS 'Type: headquarters, branch, construction_site, client_site';
COMMENT ON COLUMN locations.transport_allowance IS 'Daily transport allowance in FCFA (e.g., 5000 for Abidjan, 15000 for Bouaké)';
COMMENT ON COLUMN locations.meal_allowance IS 'Daily meal allowance in FCFA';
COMMENT ON COLUMN locations.site_premium IS 'Monthly site premium in FCFA (not daily)';
COMMENT ON COLUMN locations.hazard_pay_rate IS 'Hazard pay as percentage of base salary (e.g., 0.10 = 10%)';

COMMENT ON COLUMN employee_site_assignments.assignment_date IS 'Date employee worked at this location';
COMMENT ON COLUMN employee_site_assignments.is_primary_site IS 'Flag indicating if this is the employee default/primary site';

-- 8. Create function to validate location assignments (prevent overlapping assignments on same date)
CREATE OR REPLACE FUNCTION validate_location_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for overlapping assignments on same date for same employee
    IF EXISTS (
        SELECT 1 FROM employee_site_assignments
        WHERE employee_id = NEW.employee_id
        AND assignment_date = NEW.assignment_date
        AND location_id != NEW.location_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'Employee already has a location assignment for this date';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_location_assignment_trigger ON employee_site_assignments;
CREATE TRIGGER validate_location_assignment_trigger
    BEFORE INSERT OR UPDATE ON employee_site_assignments
    FOR EACH ROW
    EXECUTE FUNCTION validate_location_assignment();

-- 9. Create updated_at trigger for locations
CREATE OR REPLACE FUNCTION update_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_locations_updated_at_trigger ON locations;
CREATE TRIGGER update_locations_updated_at_trigger
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_locations_updated_at();
