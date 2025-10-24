/**
 * Create Bonuses Table - Variable Pay Management
 *
 * Purpose: Track one-time and recurring bonuses/variable pay for employees
 * Priority: P2 - Feature Completion (33% → 100%)
 *
 * Features:
 * - Multiple bonus types (performance, holiday, project, sales, etc.)
 * - Configurable tax/social security treatment
 * - Approval workflow
 * - Payroll integration tracking
 * - Period-based organization
 *
 * Integration Points:
 * - payroll_calculation_v2.ts fetches approved bonuses for period
 * - Included in gross salary calculations
 * - Tracked in payslip line items
 */

-- ============================================================================
-- CREATE BONUSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bonuses (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant isolation
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Bonus classification
    bonus_type VARCHAR(50) NOT NULL,
    -- Types: 'performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other'

    -- Financial details
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',

    -- Period this bonus applies to (month-level granularity)
    period DATE NOT NULL, -- YYYY-MM-01 format (first day of month)

    -- Description and notes
    description TEXT, -- e.g., "Q4 2025 Performance Bonus", "Christmas Bonus 2025"
    notes TEXT, -- Internal notes

    -- Tax and social security treatment
    is_taxable BOOLEAN NOT NULL DEFAULT true,
    is_subject_to_social_security BOOLEAN NOT NULL DEFAULT true,

    -- Approval workflow
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: 'pending' (draft), 'approved' (ready for payroll), 'paid' (included in payroll), 'cancelled'
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_reason TEXT,

    -- Payroll integration
    included_in_payroll_run_id UUID, -- References payroll_runs(id) after payment

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT valid_bonus_type CHECK (
        bonus_type IN ('performance', 'holiday', 'project', 'sales_commission', 'attendance', 'retention', 'other')
    ),
    CONSTRAINT valid_status CHECK (
        status IN ('pending', 'approved', 'paid', 'cancelled')
    ),
    CONSTRAINT valid_period CHECK (
        EXTRACT(DAY FROM period) = 1 -- Ensure period is always first day of month
    ),
    CONSTRAINT approved_fields_consistency CHECK (
        (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
        (status != 'approved')
    )
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Tenant + employee + period lookup (primary query pattern)
CREATE INDEX idx_bonuses_tenant_employee_period
ON bonuses(tenant_id, employee_id, period);

-- Status + period lookup (approval workflows)
CREATE INDEX idx_bonuses_status_period
ON bonuses(tenant_id, status, period)
WHERE status IN ('pending', 'approved');

-- Payroll integration lookup (find bonuses included in payroll run)
CREATE INDEX idx_bonuses_payroll_run
ON bonuses(included_in_payroll_run_id)
WHERE included_in_payroll_run_id IS NOT NULL;

-- Employee-specific bonus history
CREATE INDEX idx_bonuses_employee_created
ON bonuses(employee_id, created_at DESC);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (standard pattern)
DROP POLICY IF EXISTS tenant_isolation ON bonuses;
CREATE POLICY tenant_isolation ON bonuses
    FOR ALL
    USING (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
        OR (auth.jwt() ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        tenant_id::text = (auth.jwt() ->> 'tenant_id')
    );

-- ============================================================================
-- CREATE UPDATE TRIGGER
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bonuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bonuses_updated_at ON bonuses;
CREATE TRIGGER trigger_update_bonuses_updated_at
    BEFORE UPDATE ON bonuses
    FOR EACH ROW
    EXECUTE FUNCTION update_bonuses_updated_at();

-- ============================================================================
-- SEED SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample bonus types for documentation
/*
INSERT INTO bonuses (tenant_id, employee_id, bonus_type, amount, period, description, status) VALUES
-- Performance bonus
('tenant-uuid', 'employee-uuid', 'performance', 50000, '2025-01-01', 'Q4 2024 Performance Bonus', 'approved'),
-- Holiday bonus (13th month)
('tenant-uuid', 'employee-uuid', 'holiday', 125000, '2025-12-01', '13e Mois 2025', 'approved'),
-- Project completion
('tenant-uuid', 'employee-uuid', 'project', 75000, '2025-03-01', 'Prime de fin de projet ABC', 'paid');
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table structure
/*
\d bonuses

-- Verify indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'bonuses'
ORDER BY indexname;

-- Verify RLS is enabled
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'bonuses';

-- Verify policy
SELECT
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'bonuses';

-- Test query performance
EXPLAIN ANALYZE
SELECT *
FROM bonuses
WHERE tenant_id = 'some-uuid'
AND employee_id = 'some-uuid'
AND period >= '2025-01-01'
AND period <= '2025-12-01'
AND status = 'approved';
*/

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Table Created: bonuses
-- Indexes: 4 composite/partial indexes
-- RLS: Enabled with tenant isolation policy
-- Triggers: updated_at auto-update
-- Breaking Changes: None (new table)
-- Rollback: DROP TABLE bonuses CASCADE;
-- Testing: Create test bonuses and verify they appear in payroll calculation
