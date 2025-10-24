-- CDD Compliance Tracking Migration
-- Created: 2025-10-22
-- Purpose: Track fixed-term contracts (CDD), renewals, and compliance with 2-year/2-renewal limits

-- ====================================
-- 1. Employment Contracts Table
-- ====================================
-- Tracks all employment contracts (CDD/CDI) with renewal history

CREATE TABLE IF NOT EXISTS employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Contract basics
    contract_type VARCHAR(50) NOT NULL CHECK (contract_type IN ('CDI', 'CDD', 'INTERIM', 'STAGE')),
    contract_number VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for CDI

    -- Renewal tracking
    renewal_count INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    termination_date DATE,
    termination_reason VARCHAR(255),

    -- Contract lineage (for tracking renewals)
    original_contract_id UUID REFERENCES employment_contracts(id),
    replaces_contract_id UUID REFERENCES employment_contracts(id),

    -- CDD specific fields
    cdd_reason VARCHAR(255), -- Legal reason for fixed-term contract
    cdd_total_duration_months INTEGER, -- Total duration across all renewals

    -- Document management
    signed_date DATE,
    contract_file_url TEXT,
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by UUID REFERENCES users(id),

    -- Business rules
    CONSTRAINT valid_cdd_end_date CHECK (
        (contract_type = 'CDI' AND end_date IS NULL) OR
        (contract_type IN ('CDD', 'INTERIM', 'STAGE') AND end_date IS NOT NULL)
    ),
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date > start_date),
    CONSTRAINT valid_renewal_count CHECK (renewal_count >= 0 AND renewal_count <= 2)
);

-- Indexes for performance
CREATE INDEX idx_contracts_employee ON employment_contracts(employee_id, is_active);
CREATE INDEX idx_contracts_tenant ON employment_contracts(tenant_id);
CREATE INDEX idx_contracts_end_date ON employment_contracts(tenant_id, end_date)
    WHERE contract_type = 'CDD' AND is_active = true;
CREATE INDEX idx_contracts_original ON employment_contracts(original_contract_id)
    WHERE original_contract_id IS NOT NULL;

-- RLS Policies
ALTER TABLE employment_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON employment_contracts
    FOR ALL
    TO tenant_user
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    );

-- ====================================
-- 2. Contract Compliance Alerts Table
-- ====================================
-- Stores alerts for contracts approaching compliance limits

CREATE TABLE IF NOT EXISTS contract_compliance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES employment_contracts(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        '90_day_warning',
        '60_day_warning',
        '30_day_warning',
        '2_year_limit',
        '2_renewal_limit',
        'renewal_warning'
    )),
    alert_severity VARCHAR(20) DEFAULT 'warning' NOT NULL CHECK (alert_severity IN ('info', 'warning', 'critical')),
    alert_date DATE NOT NULL,
    alert_message TEXT NOT NULL,

    -- Alert lifecycle
    is_dismissed BOOLEAN DEFAULT false NOT NULL,
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES users(id),
    action_taken VARCHAR(50) CHECK (action_taken IN (
        'converted_to_cdi',
        'renewed',
        'terminated',
        'ignored'
    )),

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_alerts_active ON contract_compliance_alerts(tenant_id, alert_date, is_dismissed)
    WHERE is_dismissed = false;
CREATE INDEX idx_alerts_contract ON contract_compliance_alerts(contract_id);
CREATE INDEX idx_alerts_employee ON contract_compliance_alerts(employee_id);

-- RLS Policies
ALTER TABLE contract_compliance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contract_compliance_alerts
    FOR ALL
    TO tenant_user
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    );

-- ====================================
-- 3. Contract Renewal History Table
-- ====================================
-- Tracks all contract renewals for compliance auditing

CREATE TABLE IF NOT EXISTS contract_renewal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_contract_id UUID NOT NULL REFERENCES employment_contracts(id) ON DELETE CASCADE,
    renewal_number INTEGER NOT NULL,
    renewal_contract_id UUID REFERENCES employment_contracts(id) ON DELETE CASCADE,

    -- Renewal details
    previous_end_date DATE NOT NULL,
    new_end_date DATE NOT NULL,
    renewal_duration_months INTEGER NOT NULL,
    cumulative_duration_months INTEGER NOT NULL,
    renewal_reason TEXT,

    -- Audit fields
    renewed_by UUID REFERENCES users(id),
    renewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT valid_renewal_dates CHECK (new_end_date > previous_end_date),
    CONSTRAINT valid_renewal_number CHECK (renewal_number > 0),
    CONSTRAINT valid_duration CHECK (renewal_duration_months > 0 AND cumulative_duration_months > 0)
);

-- Indexes
CREATE INDEX idx_renewal_history_original ON contract_renewal_history(original_contract_id, renewal_number);

-- No RLS needed - accessed through parent contract's RLS

-- ====================================
-- 4. Update employees table
-- ====================================
-- Add employment_type field if not exists (for compatibility)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'employment_type'
    ) THEN
        ALTER TABLE employees ADD COLUMN employment_type VARCHAR(50) DEFAULT 'CDI';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees' AND column_name = 'contract_start_date'
    ) THEN
        ALTER TABLE employees ADD COLUMN contract_start_date DATE;
    END IF;
END $$;

-- ====================================
-- 5. Helper Views
-- ====================================
-- View for active CDD contracts with compliance status

CREATE OR REPLACE VIEW active_cdd_contracts_with_compliance AS
SELECT
    ec.id as contract_id,
    ec.tenant_id,
    ec.employee_id,
    e.first_name,
    e.last_name,
    e.employee_number,
    ec.contract_number,
    ec.start_date,
    ec.end_date,
    ec.renewal_count,
    ec.original_contract_id,

    -- Calculate days until end
    CASE
        WHEN ec.end_date IS NOT NULL
        THEN (ec.end_date - CURRENT_DATE)
        ELSE NULL
    END as days_until_end,

    -- Calculate total duration
    CASE
        WHEN ec.original_contract_id IS NOT NULL THEN (
            SELECT COALESCE(SUM(renewal_duration_months), 0)
            FROM contract_renewal_history
            WHERE original_contract_id = ec.original_contract_id
        )
        ELSE EXTRACT(MONTH FROM AGE(COALESCE(ec.end_date, CURRENT_DATE), ec.start_date))
    END as total_duration_months,

    -- Compliance flags
    ec.renewal_count >= 2 as at_renewal_limit,
    CASE
        WHEN ec.original_contract_id IS NOT NULL THEN (
            SELECT COALESCE(SUM(renewal_duration_months), 0) >= 24
            FROM contract_renewal_history
            WHERE original_contract_id = ec.original_contract_id
        )
        ELSE EXTRACT(MONTH FROM AGE(COALESCE(ec.end_date, CURRENT_DATE), ec.start_date)) >= 24
    END as at_duration_limit,

    -- Active alerts count
    (SELECT COUNT(*)
     FROM contract_compliance_alerts
     WHERE contract_id = ec.id AND is_dismissed = false
    ) as active_alerts_count

FROM employment_contracts ec
INNER JOIN employees e ON ec.employee_id = e.id
WHERE ec.contract_type = 'CDD'
  AND ec.is_active = true
  AND ec.end_date IS NOT NULL;

-- Grant access
GRANT SELECT ON active_cdd_contracts_with_compliance TO tenant_user;

-- ====================================
-- 6. Update timestamp trigger
-- ====================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employment_contracts_updated_at
    BEFORE UPDATE ON employment_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- Comments for documentation
-- ====================================

COMMENT ON TABLE employment_contracts IS 'Tracks all employment contracts (CDD/CDI) with renewal history and compliance monitoring';
COMMENT ON TABLE contract_compliance_alerts IS 'Alerts for contracts approaching 2-year or 2-renewal limits';
COMMENT ON TABLE contract_renewal_history IS 'Historical record of all contract renewals for audit purposes';
COMMENT ON VIEW active_cdd_contracts_with_compliance IS 'Denormalized view of active CDD contracts with compliance calculations';

COMMENT ON COLUMN employment_contracts.renewal_count IS 'Number of times this contract has been renewed (max 2 for CDD)';
COMMENT ON COLUMN employment_contracts.original_contract_id IS 'Reference to the first contract in a renewal chain';
COMMENT ON COLUMN contract_compliance_alerts.alert_type IS 'Type of compliance alert: 90/60/30 day warnings or limit violations';
COMMENT ON COLUMN contract_renewal_history.cumulative_duration_months IS 'Total months from start to new end date (cannot exceed 24 for CDD)';
