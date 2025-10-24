-- ============================================================================
-- SAGE Data Migration - Database Schema
-- Created: 2025-10-22
-- Epic: CONSOLIDATED-IMPLEMENTATION-PLAN-v3.0-EXTENDED.md (Weeks 6-7)
-- Purpose: Import employees, payroll history, and chart of accounts from SAGE/CIEL
-- ============================================================================

-- ============================================================================
-- 1. DATA MIGRATIONS TABLE - Track migration operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Migration details
  migration_type TEXT NOT NULL CHECK (migration_type IN ('sage_employees', 'sage_payroll', 'sage_accounts')),
  source_system TEXT NOT NULL CHECK (source_system IN ('SAGE', 'CIEL', 'EXCEL', 'CSV')),

  -- File information
  file_url TEXT,
  file_name TEXT,
  file_size_bytes INTEGER,

  -- Progress tracking
  total_records INTEGER DEFAULT 0,
  imported_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,

  -- Status
  migration_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    migration_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),

  -- Configuration
  field_mapping JSONB, -- User-configured field mappings: { sageField: preemField }
  validation_results JSONB, -- Validation errors/warnings before import
  error_log JSONB DEFAULT '[]', -- Array of error objects: { row, field, error, timestamp }

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Audit
  migrated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT data_migrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT data_migrations_count_check CHECK (imported_records + failed_records <= total_records)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_data_migrations_tenant ON data_migrations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_migrations_status ON data_migrations(tenant_id, migration_status);
CREATE INDEX IF NOT EXISTS idx_data_migrations_type ON data_migrations(tenant_id, migration_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_migrations_user ON data_migrations(migrated_by, created_at DESC);

-- Partial index for active migrations
CREATE INDEX IF NOT EXISTS idx_data_migrations_active
  ON data_migrations(tenant_id, started_at)
  WHERE migration_status IN ('pending', 'processing');

-- RLS Policy
ALTER TABLE data_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_migrations_tenant_isolation ON data_migrations
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 2. HISTORICAL PAYROLL DATA TABLE - Store historical payroll from SAGE
-- ============================================================================
CREATE TABLE IF NOT EXISTS historical_payroll_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  migration_id UUID REFERENCES data_migrations(id) ON DELETE CASCADE,

  -- Employee identification
  employee_number TEXT NOT NULL, -- Matricule from SAGE
  employee_name TEXT, -- Full name from SAGE

  -- Period
  payroll_period TEXT NOT NULL, -- 'YYYY-MM' format

  -- Salary amounts
  gross_salary NUMERIC(15, 2),
  net_salary NUMERIC(15, 2),

  -- Social security contributions
  cnps_employee NUMERIC(15, 2), -- Employee CNPS contribution
  cnps_employer NUMERIC(15, 2), -- Employer CNPS contribution

  -- Tax
  its NUMERIC(15, 2), -- ITS (Impôt sur les Traitements et Salaires)

  -- Detailed components (JSONB for flexibility)
  components JSONB DEFAULT '{}', -- All salary components: { base: 100000, transport: 25000, ... }
  deductions JSONB DEFAULT '{}', -- All deductions: { cnps: 6300, its: 5000, ... }

  -- Source data (for audit and debugging)
  source_data JSONB, -- Raw SAGE data row (preserves original values)

  -- Payment information
  payment_date DATE,
  payment_method TEXT, -- 'virement', 'cheque', 'especes'

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT historical_payroll_data_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT historical_payroll_unique_period UNIQUE(tenant_id, employee_number, payroll_period)
);

-- Indexes for historical payroll queries
CREATE INDEX IF NOT EXISTS idx_historical_payroll_employee ON historical_payroll_data(tenant_id, employee_number);
CREATE INDEX IF NOT EXISTS idx_historical_payroll_period ON historical_payroll_data(tenant_id, payroll_period DESC);
CREATE INDEX IF NOT EXISTS idx_historical_payroll_migration ON historical_payroll_data(migration_id);

-- Composite index for employee payroll history
CREATE INDEX IF NOT EXISTS idx_historical_payroll_employee_period
  ON historical_payroll_data(tenant_id, employee_number, payroll_period DESC);

-- RLS Policy
ALTER TABLE historical_payroll_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY historical_payroll_data_tenant_isolation ON historical_payroll_data
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 3. EMPLOYEE IMPORT STAGING TABLE - Validate before final insert
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id UUID NOT NULL REFERENCES data_migrations(id) ON DELETE CASCADE,

  -- Row tracking
  row_number INTEGER NOT NULL, -- Row number in source file (for error reporting)

  -- Employee data (mapped from SAGE)
  employee_number TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  category_code TEXT, -- A1, A2, B, C, D, E, F
  base_salary NUMERIC(15, 2),
  hire_date DATE,
  department TEXT,
  position_title TEXT,

  -- Additional fields (optional)
  email TEXT,
  phone TEXT,
  address TEXT,
  family_situation TEXT, -- For fiscal deductions

  -- Source data (preserves all original fields)
  source_data JSONB NOT NULL,

  -- Validation
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    validation_status IN ('pending', 'valid', 'invalid', 'warning')
  ),
  validation_errors JSONB DEFAULT '[]', -- Array of { field, message }
  validation_warnings JSONB DEFAULT '[]', -- Non-blocking issues

  -- Import result
  imported_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  import_error TEXT, -- Error message if import failed despite validation passing

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT employee_import_staging_migration_id_fkey FOREIGN KEY (migration_id) REFERENCES data_migrations(id) ON DELETE CASCADE
);

-- Indexes for staging table
CREATE INDEX IF NOT EXISTS idx_employee_staging_migration ON employee_import_staging(migration_id);
CREATE INDEX IF NOT EXISTS idx_employee_staging_status ON employee_import_staging(migration_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_employee_staging_employee ON employee_import_staging(imported_employee_id) WHERE imported_employee_id IS NOT NULL;

-- RLS Policy (inherits from migration)
ALTER TABLE employee_import_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_import_staging_via_migration ON employee_import_staging
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM data_migrations dm
      WHERE dm.id = employee_import_staging.migration_id
        AND (
          dm.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
          OR (auth.jwt() ->> 'role') = 'super_admin'
        )
    )
  );

-- ============================================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_data_migrations_updated_at
  BEFORE UPDATE ON data_migrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get migration summary statistics
CREATE OR REPLACE FUNCTION get_migration_summary(p_migration_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'migrationId', dm.id,
    'migrationType', dm.migration_type,
    'sourceSystem', dm.source_system,
    'status', dm.migration_status,
    'totalRecords', dm.total_records,
    'importedRecords', dm.imported_records,
    'failedRecords', dm.failed_records,
    'successRate', CASE
      WHEN dm.total_records > 0
      THEN ROUND((dm.imported_records::NUMERIC / dm.total_records::NUMERIC) * 100, 2)
      ELSE 0
    END,
    'duration', CASE
      WHEN dm.completed_at IS NOT NULL AND dm.started_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (dm.completed_at - dm.started_at))
      ELSE NULL
    END,
    'stagingValidRecords', (
      SELECT COUNT(*) FROM employee_import_staging
      WHERE migration_id = p_migration_id
        AND validation_status = 'valid'
    ),
    'stagingInvalidRecords', (
      SELECT COUNT(*) FROM employee_import_staging
      WHERE migration_id = p_migration_id
        AND validation_status = 'invalid'
    )
  )
  INTO v_result
  FROM data_migrations dm
  WHERE dm.id = p_migration_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark migration record as processed (success or failure)
CREATE OR REPLACE FUNCTION update_migration_progress(
  p_migration_id UUID,
  p_success BOOLEAN,
  p_error_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_success THEN
    UPDATE data_migrations
    SET
      imported_records = imported_records + 1,
      updated_at = now()
    WHERE id = p_migration_id;
  ELSE
    UPDATE data_migrations
    SET
      failed_records = failed_records + 1,
      error_log = error_log || COALESCE(p_error_details, '{}'::jsonb),
      updated_at = now()
    WHERE id = p_migration_id;
  END IF;

  -- Auto-complete migration if all records processed
  UPDATE data_migrations
  SET
    migration_status = 'completed',
    completed_at = now()
  WHERE id = p_migration_id
    AND (imported_records + failed_records) >= total_records
    AND migration_status = 'processing';
END;
$$ LANGUAGE plpgsql;

-- Function to get employee payroll history from historical data
CREATE OR REPLACE FUNCTION get_employee_payroll_history(
  p_tenant_id UUID,
  p_employee_number TEXT,
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  period TEXT,
  gross_salary NUMERIC,
  net_salary NUMERIC,
  cnps_employee NUMERIC,
  its NUMERIC,
  payment_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hpd.payroll_period,
    hpd.gross_salary,
    hpd.net_salary,
    hpd.cnps_employee,
    hpd.its,
    hpd.payment_date
  FROM historical_payroll_data hpd
  WHERE hpd.tenant_id = p_tenant_id
    AND hpd.employee_number = p_employee_number
  ORDER BY hpd.payroll_period DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE data_migrations IS 'Tracks SAGE/CIEL data migration operations (employees, payroll history, accounts)';
COMMENT ON TABLE historical_payroll_data IS 'Stores historical payroll data imported from SAGE/CIEL for analysis and reporting';
COMMENT ON TABLE employee_import_staging IS 'Staging table for employee imports - validates data before final insert to employees table';

COMMENT ON COLUMN data_migrations.field_mapping IS 'User-configured mapping between SAGE fields and Preem HR fields';
COMMENT ON COLUMN data_migrations.validation_results IS 'Pre-import validation results with errors and warnings';
COMMENT ON COLUMN historical_payroll_data.components IS 'JSONB object with all salary components from SAGE';
COMMENT ON COLUMN historical_payroll_data.source_data IS 'Raw SAGE data row preserved for audit and debugging';
COMMENT ON COLUMN employee_import_staging.validation_status IS 'pending: not validated, valid: ready to import, invalid: has blocking errors, warning: has non-blocking issues';
