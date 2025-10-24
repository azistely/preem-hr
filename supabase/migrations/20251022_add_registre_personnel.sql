/**
 * Digital Registre du Personnel (Employee Register)
 *
 * Purpose: Create tables for legally compliant employee register
 * - Required by West African labor laws for inspection
 * - Tracks all employee entries and exits
 * - Generates compliant PDF exports
 *
 * Date: 2025-10-22
 * Ref: Week 16 - CONSOLIDATED-IMPLEMENTATION-PLAN-v3.0-EXTENDED.md
 */

-- Digital employee register entries
CREATE TABLE employee_register_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('hire', 'exit', 'modification')),
    entry_date DATE NOT NULL,
    entry_number INTEGER NOT NULL,

    -- Employee details at time of entry (snapshot)
    employee_number VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    nationality VARCHAR(100),
    position VARCHAR(255),
    department VARCHAR(255),
    hire_date DATE,
    exit_date DATE,
    exit_reason VARCHAR(255),

    -- Legal details
    contract_type VARCHAR(50), -- CDI, CDD, INTERIM, STAGE
    cnps_number VARCHAR(50),
    qualification VARCHAR(255), -- Professional category

    -- Metadata
    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT unique_tenant_entry_number UNIQUE(tenant_id, entry_number)
);

-- Indexes for performance
CREATE INDEX idx_register_tenant_date ON employee_register_entries(tenant_id, entry_date DESC);
CREATE INDEX idx_register_employee ON employee_register_entries(employee_id, entry_date DESC);
CREATE INDEX idx_register_entry_type ON employee_register_entries(tenant_id, entry_type);
CREATE INDEX idx_register_entry_number ON employee_register_entries(tenant_id, entry_number);

-- Audit log for register modifications
CREATE TABLE register_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    register_entry_id UUID REFERENCES employee_register_entries(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'export')),
    old_data JSONB,
    new_data JSONB,
    performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    ip_address VARCHAR(45),
    performed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for audit log
CREATE INDEX idx_audit_tenant_date ON register_audit_log(tenant_id, performed_at DESC);
CREATE INDEX idx_audit_entry ON register_audit_log(register_entry_id);
CREATE INDEX idx_audit_user ON register_audit_log(performed_by);

-- Register export history
CREATE TABLE register_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    export_type VARCHAR(50) NOT NULL CHECK (export_type IN ('full', 'period', 'active_only')),
    export_format VARCHAR(50) NOT NULL CHECK (export_format IN ('PDF', 'EXCEL')),
    date_from DATE,
    date_to DATE,
    total_entries INTEGER NOT NULL,
    file_url TEXT,
    exported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    exported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for exports
CREATE INDEX idx_exports_tenant_date ON register_exports(tenant_id, exported_at DESC);
CREATE INDEX idx_exports_user ON register_exports(exported_by);

-- Comments for documentation
COMMENT ON TABLE employee_register_entries IS 'Digital employee register (Registre du Personnel) - legally required for labor inspection';
COMMENT ON COLUMN employee_register_entries.entry_number IS 'Sequential number per tenant, starts at 1';
COMMENT ON COLUMN employee_register_entries.entry_type IS 'Type of entry: hire (embauche), exit (sortie), modification';
COMMENT ON TABLE register_audit_log IS 'Audit trail for all register modifications';
COMMENT ON TABLE register_exports IS 'History of register exports for compliance tracking';

-- Function to get next entry number for a tenant
CREATE OR REPLACE FUNCTION get_next_register_entry_number(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    SELECT COALESCE(MAX(entry_number), 0) + 1
    INTO v_next_number
    FROM employee_register_entries
    WHERE tenant_id = p_tenant_id;

    RETURN v_next_number;
END;
$$;

COMMENT ON FUNCTION get_next_register_entry_number IS 'Get next sequential entry number for a tenant';
