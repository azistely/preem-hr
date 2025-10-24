-- =====================================================
-- Accounting Integration Tables
-- Created: 2025-10-22
-- Purpose: GL Export, CMU, ETAT 301 functionality
-- =====================================================

-- Chart of accounts
CREATE TABLE IF NOT EXISTS accounting_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50), -- 'expense', 'liability', 'asset'
    parent_account_code VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    accounting_system VARCHAR(50) DEFAULT 'SYSCOHADA', -- 'SYSCOHADA', 'IFRS', 'Custom'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, account_code)
);

CREATE INDEX idx_accounting_accounts_tenant ON accounting_accounts(tenant_id);
CREATE INDEX idx_accounting_accounts_code ON accounting_accounts(account_code);

-- Payroll component to account mapping
CREATE TABLE IF NOT EXISTS payroll_account_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type VARCHAR(100) NOT NULL, -- 'base_salary', 'cnps_employee', 'its'
    debit_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
    credit_account_id UUID REFERENCES accounting_accounts(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    cost_center VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, component_type, department_id)
);

CREATE INDEX idx_payroll_account_mappings_tenant ON payroll_account_mappings(tenant_id);
CREATE INDEX idx_payroll_account_mappings_component ON payroll_account_mappings(component_type);

-- GL export history
CREATE TABLE IF NOT EXISTS gl_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
    export_date TIMESTAMPTZ DEFAULT NOW(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    export_format VARCHAR(50), -- 'SYSCOHADA_CSV', 'SAGE_TXT', 'CIEL_IIF', 'EXCEL'
    file_url TEXT,
    file_name VARCHAR(255),
    total_debit NUMERIC(15,2),
    total_credit NUMERIC(15,2),
    entry_count INTEGER,
    exported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'generated', -- 'generated', 'downloaded', 'imported'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gl_exports_tenant ON gl_exports(tenant_id);
CREATE INDEX idx_gl_exports_payroll_run ON gl_exports(payroll_run_id);
CREATE INDEX idx_gl_exports_period ON gl_exports(tenant_id, period_start, period_end);

-- GL journal entries (for preview)
CREATE TABLE IF NOT EXISTS gl_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_id UUID NOT NULL REFERENCES gl_exports(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(255),
    debit_amount NUMERIC(15,2) DEFAULT 0,
    credit_amount NUMERIC(15,2) DEFAULT 0,
    department VARCHAR(100),
    cost_center VARCHAR(50),
    description TEXT,
    reference VARCHAR(100), -- Payroll run reference
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    line_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gl_journal_entries_export ON gl_journal_entries(export_id);
CREATE INDEX idx_gl_journal_entries_account ON gl_journal_entries(account_code);
CREATE INDEX idx_gl_journal_entries_employee ON gl_journal_entries(employee_id);

-- CMU export config
CREATE TABLE IF NOT EXISTS cmu_export_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cmu_employer_number VARCHAR(50),
    cmu_rate NUMERIC(5,2) DEFAULT 1.0, -- 1% CMU rate
    include_dependents BOOLEAN DEFAULT true,
    export_format VARCHAR(50) DEFAULT 'CSV',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_cmu_export_config_tenant ON cmu_export_config(tenant_id);

-- ETAT 301 config
CREATE TABLE IF NOT EXISTS etat_301_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    dgi_tax_number VARCHAR(50),
    export_format VARCHAR(50) DEFAULT 'PDF',
    include_attachments BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_etat_301_config_tenant ON etat_301_config(tenant_id);

-- Tenant-specific component code overrides (e.g., Code 11 customization)
CREATE TABLE IF NOT EXISTS tenant_component_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_definition_id UUID REFERENCES salary_component_definitions(id) ON DELETE CASCADE,
    component_type VARCHAR(100),
    custom_code VARCHAR(20) NOT NULL,
    custom_description VARCHAR(255),
    effective_from DATE DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, component_definition_id, effective_from)
);

CREATE INDEX idx_tenant_component_codes_tenant ON tenant_component_codes(tenant_id);
CREATE INDEX idx_tenant_component_codes_component ON tenant_component_codes(component_definition_id);

-- Seed default SYSCOHADA accounts (tenant_id = NULL means system-wide defaults)
INSERT INTO accounting_accounts (tenant_id, account_code, account_name, account_type, accounting_system)
VALUES
(NULL, '6611', 'Appointements et salaires', 'expense', 'SYSCOHADA'),
(NULL, '6612', 'Primes et gratifications', 'expense', 'SYSCOHADA'),
(NULL, '6613', 'Congés payés', 'expense', 'SYSCOHADA'),
(NULL, '6614', 'Indemnités de préavis, de licenciement et de recherche d''embauche', 'expense', 'SYSCOHADA'),
(NULL, '6641', 'Charges sociales (CNPS)', 'expense', 'SYSCOHADA'),
(NULL, '4211', 'Personnel - Rémunérations dues', 'liability', 'SYSCOHADA'),
(NULL, '4311', 'CNPS', 'liability', 'SYSCOHADA'),
(NULL, '4471', 'ITS retenu à la source', 'liability', 'SYSCOHADA')
ON CONFLICT (tenant_id, account_code) DO NOTHING;

-- Enable RLS
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmu_export_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE etat_301_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_component_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view system-wide and their tenant's accounts"
    ON accounting_accounts FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can manage their tenant's accounts"
    ON accounting_accounts FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can view their tenant's mappings"
    ON payroll_account_mappings FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can manage their tenant's mappings"
    ON payroll_account_mappings FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can view their tenant's GL exports"
    ON gl_exports FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can create GL exports"
    ON gl_exports FOR INSERT
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can update their tenant's GL exports"
    ON gl_exports FOR UPDATE
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can view journal entries for their tenant's exports"
    ON gl_journal_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM gl_exports
        WHERE gl_exports.id = gl_journal_entries.export_id
        AND gl_exports.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    ));

CREATE POLICY "Admins can manage journal entries for their tenant's exports"
    ON gl_journal_entries FOR ALL
    USING (EXISTS (
        SELECT 1 FROM gl_exports
        WHERE gl_exports.id = gl_journal_entries.export_id
        AND gl_exports.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM gl_exports
        WHERE gl_exports.id = gl_journal_entries.export_id
        AND gl_exports.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    ));

CREATE POLICY "Users can view their tenant's CMU config"
    ON cmu_export_config FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can manage their tenant's CMU config"
    ON cmu_export_config FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can view their tenant's ETAT 301 config"
    ON etat_301_config FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can manage their tenant's ETAT 301 config"
    ON etat_301_config FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can view their tenant's component codes"
    ON tenant_component_codes FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Admins can manage their tenant's component codes"
    ON tenant_component_codes FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
