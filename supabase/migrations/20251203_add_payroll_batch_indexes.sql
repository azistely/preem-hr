-- Payroll Batch Processing Indexes
-- These indexes optimize batch queries for payroll calculation
-- Used by batch-prefetch.service.ts to reduce N+1 query patterns

-- Employee salaries: batch lookup by tenant + employees + date range
-- Supports DISTINCT ON (employee_id) ... ORDER BY effective_from DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_salaries_batch
ON employee_salaries (tenant_id, employee_id, effective_from DESC);

-- Employment contracts: batch lookup by employees
-- Supports DISTINCT ON (employee_id) ... ORDER BY start_date DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employment_contracts_batch
ON employment_contracts (employee_id, start_date DESC);

-- Employee dependents: batch aggregation for fiscal parts and CMU
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employee_dependents_batch
ON employee_dependents (tenant_id, employee_id, status)
WHERE status = 'active';

-- Time entries: batch aggregation for payroll period
-- Partial index for only approved entries (reduces index size)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_payroll_batch
ON time_entries (tenant_id, employee_id, clock_in)
WHERE status = 'approved';

-- Salary advances: batch lookup by tenant + employees + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_salary_advances_batch
ON salary_advances (tenant_id, employee_id, status)
WHERE status = 'approved';

-- Salary advance repayments: batch lookup by due month
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_advance_repayments_batch
ON salary_advance_repayments (tenant_id, due_month, status)
WHERE status = 'pending';

-- Variable pay inputs: batch lookup by date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variable_pay_inputs_batch
ON variable_pay_inputs (tenant_id, employee_id, entry_date);

-- Comment for documentation
COMMENT ON INDEX idx_employee_salaries_batch IS 'Batch payroll: fetch most recent salary per employee';
COMMENT ON INDEX idx_employment_contracts_batch IS 'Batch payroll: fetch current contract per employee';
COMMENT ON INDEX idx_employee_dependents_batch IS 'Batch payroll: aggregate fiscal parts and CMU dependents';
COMMENT ON INDEX idx_time_entries_payroll_batch IS 'Batch payroll: aggregate hours and days worked';
COMMENT ON INDEX idx_salary_advances_batch IS 'Batch payroll: fetch disbursable advances';
COMMENT ON INDEX idx_advance_repayments_batch IS 'Batch payroll: fetch repayments due this period';
COMMENT ON INDEX idx_variable_pay_inputs_batch IS 'Batch payroll: fetch variable pay for period';
