/**
 * Add Performance Indexes - Audit Implementation
 *
 * Purpose: Add composite indexes for high-traffic query patterns
 * Priority: P2 - Performance Optimization
 *
 * Impact: Improves query performance for:
 * - Payroll calculation queries (100-1000+ employees)
 * - Time tracking reports (daily queries)
 * - Leave management lookups
 * - Work schedule queries for payroll integration
 * - Audit log queries
 *
 * Estimated Performance Gains:
 * - Payroll line items: 50-80% faster queries
 * - Time entries: 60-90% faster date range queries
 * - Work schedules: 70-90% faster schedule lookups
 */

-- ============================================================================
-- 1. PAYROLL QUERIES
-- ============================================================================

-- Composite index for payroll run queries
-- Query pattern: SELECT * FROM payroll_line_items WHERE payroll_run_id = X AND employee_id = Y
-- Use case: Fetching specific employee's payslip data
DROP INDEX IF EXISTS idx_payroll_line_items_run_employee;
CREATE INDEX idx_payroll_line_items_run_employee
ON payroll_line_items(payroll_run_id, employee_id);

-- Composite index for tenant payroll period queries
-- Query pattern: SELECT * FROM payroll_runs WHERE tenant_id = X AND period_start >= Y AND period_end <= Z
-- Use case: Dashboard payroll history, period validation
DROP INDEX IF EXISTS idx_payroll_runs_tenant_period;
CREATE INDEX idx_payroll_runs_tenant_period
ON payroll_runs(tenant_id, period_start, period_end);

-- Composite index for payroll run status queries
-- Query pattern: SELECT * FROM payroll_runs WHERE tenant_id = X AND status = 'draft' ORDER BY created_at DESC
-- Use case: Finding pending payroll runs
DROP INDEX IF EXISTS idx_payroll_runs_tenant_status;
CREATE INDEX idx_payroll_runs_tenant_status
ON payroll_runs(tenant_id, status, created_at DESC);

-- ============================================================================
-- 2. TIME TRACKING QUERIES
-- ============================================================================

-- Composite index for employee time entries by date
-- Query pattern: SELECT * FROM time_entries WHERE employee_id = X AND date >= Y AND date <= Z
-- Use case: Time tracking reports, payroll integration
DROP INDEX IF EXISTS idx_time_entries_employee_date;
CREATE INDEX idx_time_entries_employee_date
ON time_entries(employee_id, clock_in);

-- Partial index for pending time entries (approval workflow)
-- Query pattern: SELECT * FROM time_entries WHERE status = 'pending' AND tenant_id = X
-- Use case: Manager approval queue
DROP INDEX IF EXISTS idx_time_entries_status_pending;
CREATE INDEX idx_time_entries_status_pending
ON time_entries(tenant_id, status, clock_in DESC)
WHERE status = 'pending';

-- Composite index for tenant time entries (admin queries)
-- Query pattern: SELECT * FROM time_entries WHERE tenant_id = X AND clock_in >= Y
-- Use case: Admin time tracking reports
DROP INDEX IF EXISTS idx_time_entries_tenant_clock_in;
CREATE INDEX idx_time_entries_tenant_clock_in
ON time_entries(tenant_id, clock_in DESC);

-- ============================================================================
-- 3. LEAVE MANAGEMENT QUERIES
-- ============================================================================

-- Composite index for employee leave requests by status
-- Query pattern: SELECT * FROM time_off_requests WHERE employee_id = X AND status = 'pending'
-- Use case: Employee leave dashboard, approval workflows
DROP INDEX IF EXISTS idx_leave_requests_employee_status;
CREATE INDEX idx_leave_requests_employee_status
ON time_off_requests(employee_id, status, created_at DESC);

-- Composite index for leave balances lookup
-- Query pattern: SELECT * FROM time_off_balances WHERE employee_id = X AND policy_id = Y AND year = Z
-- Use case: Balance checks before approving leave
DROP INDEX IF EXISTS idx_leave_balances_employee_policy;
CREATE INDEX idx_leave_balances_employee_policy
ON time_off_balances(employee_id, policy_id, year);

-- Composite index for tenant leave requests (HR dashboard)
-- Query pattern: SELECT * FROM time_off_requests WHERE tenant_id = X AND status = 'pending' ORDER BY created_at
-- Use case: HR approval dashboard
DROP INDEX IF EXISTS idx_leave_requests_tenant_status;
CREATE INDEX idx_leave_requests_tenant_status
ON time_off_requests(tenant_id, status, created_at DESC);

-- ============================================================================
-- 4. WORK SCHEDULE QUERIES
-- ============================================================================

-- Composite index for employee work schedules by date
-- Query pattern: SELECT * FROM work_schedules WHERE employee_id = X AND work_date >= Y AND work_date <= Z
-- Use case: Payroll integration, schedule reports
DROP INDEX IF EXISTS idx_work_schedules_employee_date;
CREATE INDEX idx_work_schedules_employee_date
ON work_schedules(employee_id, work_date);

-- Partial index for active schedules (tenant + active status)
-- Query pattern: SELECT * FROM work_schedules WHERE tenant_id = X AND status = 'approved'
-- Use case: Active schedule lookups for payroll calculation
DROP INDEX IF EXISTS idx_work_schedules_active;
CREATE INDEX idx_work_schedules_active
ON work_schedules(tenant_id, status, work_date DESC)
WHERE status = 'approved';

-- Composite index for weekly schedule grouping (approval workflow)
-- Query pattern: SELECT * FROM work_schedules WHERE employee_id = X AND week_start_date = Y
-- Use case: Bulk weekly schedule approval
DROP INDEX IF EXISTS idx_work_schedules_employee_week;
CREATE INDEX idx_work_schedules_employee_week
ON work_schedules(employee_id, week_start_date, work_date);

-- ============================================================================
-- 5. AUDIT LOG QUERIES
-- ============================================================================

-- Composite index for tenant audit logs by timestamp
-- Query pattern: SELECT * FROM audit_logs WHERE tenant_id = X AND created_at >= Y ORDER BY created_at DESC
-- Use case: Audit log queries, GDPR compliance reports
DROP INDEX IF EXISTS idx_audit_logs_tenant_timestamp;
CREATE INDEX idx_audit_logs_tenant_timestamp
ON audit_logs(tenant_id, created_at DESC);

-- Composite index for table-specific audit lookups
-- Query pattern: SELECT * FROM audit_logs WHERE table_name = 'employees' AND record_id = X
-- Use case: Entity-specific audit trail
DROP INDEX IF EXISTS idx_audit_logs_table_record;
CREATE INDEX idx_audit_logs_table_record
ON audit_logs(table_name, record_id, created_at DESC);

-- ============================================================================
-- 6. ADDITIONAL OPTIMIZATION INDEXES
-- ============================================================================

-- Index for employee register entries (compliance exports)
-- Query pattern: SELECT * FROM employee_register_entries WHERE tenant_id = X AND entry_date >= Y AND entry_date <= Z
-- Use case: Registre personnel exports by date range
DROP INDEX IF EXISTS idx_employee_register_entries_tenant_date;
CREATE INDEX IF NOT EXISTS idx_employee_register_entries_tenant_date
ON employee_register_entries(tenant_id, entry_date DESC);

-- Index for GL exports by payroll run (accounting integration)
-- Query pattern: SELECT * FROM gl_exports WHERE payroll_run_id = X
-- Use case: Finding GL export for a specific payroll run
DROP INDEX IF EXISTS idx_gl_exports_payroll_run;
CREATE INDEX idx_gl_exports_payroll_run
ON gl_exports(payroll_run_id, export_date DESC);

-- Index for GL exports by period (accounting queries)
-- Query pattern: SELECT * FROM gl_exports WHERE tenant_id = X AND period_start >= Y AND period_end <= Z
-- Use case: Finding GL exports for a specific period
DROP INDEX IF EXISTS idx_gl_exports_period;
CREATE INDEX idx_gl_exports_period
ON gl_exports(tenant_id, period_start, period_end);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify indexes were created (run separately after migration)
/*
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
AND tablename IN (
    'payroll_runs',
    'payroll_line_items',
    'time_entries',
    'time_off_requests',
    'time_off_balances',
    'work_schedules',
    'audit_logs',
    'gl_exports',
    'employee_register_entries'
)
ORDER BY tablename, indexname;

-- Check index sizes (monitor disk usage)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Test query performance (example)
EXPLAIN ANALYZE
SELECT * FROM payroll_line_items
WHERE payroll_run_id = 'some-uuid'
AND employee_id = 'some-uuid';
*/

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Indexes Created: 17 composite/partial indexes
-- Tables Optimized: 9 tables
-- Performance Impact: 50-90% query speed improvement (estimated)
-- Disk Space Impact: ~100-500 MB (depends on data volume)
-- Breaking Changes: None
-- Rollback: DROP INDEX IF EXISTS idx_name;
-- Testing: Run EXPLAIN ANALYZE on critical queries before/after
