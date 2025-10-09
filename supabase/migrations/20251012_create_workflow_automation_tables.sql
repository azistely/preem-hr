-- ============================================================================
-- Workflow Automation & Orchestration - Database Schema
-- Created: 2025-10-12
-- Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
-- ============================================================================

-- ============================================================================
-- 1. ALERTS TABLE - Proactive notifications for HR managers
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Alert details
  type TEXT NOT NULL, -- 'contract_expiry', 'leave_notification', 'document_expiry', 'payroll_reminder'
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'urgent')),
  message TEXT NOT NULL,

  -- Assignment
  assignee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE, -- Related employee (optional)

  -- Action
  action_url TEXT, -- Where to navigate on click
  action_label TEXT, -- "Renouveler le contrat"
  due_date TIMESTAMPTZ,

  -- State
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'completed')),
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_alerts_assignee ON alerts(assignee_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_alerts_due_date ON alerts(due_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(tenant_id, severity) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(tenant_id, type, status);
CREATE INDEX IF NOT EXISTS idx_alerts_employee ON alerts(employee_id) WHERE employee_id IS NOT NULL;

-- Partial index for urgent alerts (fastest queries)
CREATE INDEX IF NOT EXISTS idx_alerts_active_urgent
  ON alerts(assignee_id, due_date)
  WHERE status = 'active' AND severity = 'urgent';

-- RLS Policy
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_tenant_isolation ON alerts
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 2. BATCH OPERATIONS TABLE - Track bulk operations with progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Operation details
  operation_type TEXT NOT NULL, -- 'salary_update', 'document_generation', 'contract_renewal'
  entity_type TEXT NOT NULL, -- 'employees', 'contracts', 'payroll_line_items'
  entity_ids UUID[] NOT NULL, -- Array of affected entity IDs

  -- Parameters (operation-specific data)
  params JSONB NOT NULL,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_count INTEGER NOT NULL,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]', -- Array of { entityId, error, timestamp }

  -- Execution timing
  started_by UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,

  -- Result data
  result_data JSONB DEFAULT '{}', -- Operation-specific results

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT batch_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT batch_operations_count_check CHECK (total_count >= 0),
  CONSTRAINT batch_operations_progress_check CHECK (processed_count <= total_count)
);

-- Indexes for batch operations
CREATE INDEX IF NOT EXISTS idx_batch_operations_status ON batch_operations(tenant_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_operations_user ON batch_operations(started_by, status);
CREATE INDEX IF NOT EXISTS idx_batch_operations_type ON batch_operations(tenant_id, operation_type, created_at DESC);

-- Partial index for active operations
CREATE INDEX IF NOT EXISTS idx_batch_operations_active
  ON batch_operations(tenant_id, started_at)
  WHERE status IN ('pending', 'running');

-- RLS Policy
ALTER TABLE batch_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY batch_operations_tenant_isolation ON batch_operations
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 3. PAYROLL EVENTS TABLE - Event-driven payroll changes audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS payroll_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL, -- 'termination', 'hire', 'salary_change', 'unpaid_leave', 'position_change'
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,

  -- Event data
  event_date DATE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}', -- Event-specific data (old_salary, new_salary, etc.)

  -- Calculated amounts
  amount_calculated NUMERIC(15, 2),
  is_prorated BOOLEAN DEFAULT false,
  working_days INTEGER,
  days_worked INTEGER,
  proration_percentage NUMERIC(5, 2),

  -- Processing state
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Impact tracking
  impacted_payroll_runs UUID[] DEFAULT '{}', -- Array of affected payroll run IDs

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),

  CONSTRAINT payroll_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for payroll events
CREATE INDEX IF NOT EXISTS idx_payroll_events_employee ON payroll_events(employee_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_events_run ON payroll_events(payroll_run_id) WHERE payroll_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_events_type ON payroll_events(tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_events_date ON payroll_events(tenant_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_events_pending ON payroll_events(tenant_id, processing_status) WHERE processing_status = 'pending';

-- RLS Policy
ALTER TABLE payroll_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_events_tenant_isolation ON payroll_events
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 4. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_operations_updated_at
  BEFORE UPDATE ON batch_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get urgent alert count for a user
CREATE OR REPLACE FUNCTION get_urgent_alert_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM alerts
    WHERE assignee_id = p_user_id
      AND status = 'active'
      AND severity = 'urgent'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark batch operation as failed
CREATE OR REPLACE FUNCTION fail_batch_operation(
  p_operation_id UUID,
  p_entity_id UUID,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE batch_operations
  SET
    error_count = error_count + 1,
    processed_count = processed_count + 1,
    errors = errors || jsonb_build_object(
      'entityId', p_entity_id,
      'error', p_error_message,
      'timestamp', now()
    ),
    status = CASE
      WHEN processed_count + 1 >= total_count THEN 'completed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = p_operation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark batch operation item as successful
CREATE OR REPLACE FUNCTION success_batch_operation(
  p_operation_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE batch_operations
  SET
    success_count = success_count + 1,
    processed_count = processed_count + 1,
    status = CASE
      WHEN processed_count + 1 >= total_count THEN 'completed'
      ELSE status
    END,
    completed_at = CASE
      WHEN processed_count + 1 >= total_count THEN now()
      ELSE completed_at
    END,
    updated_at = now()
  WHERE id = p_operation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE alerts IS 'Proactive alerts for HR managers (contract expiry, leave notifications, document expiry)';
COMMENT ON TABLE batch_operations IS 'Tracks bulk operations with progress monitoring (salary updates, document generation)';
COMMENT ON TABLE payroll_events IS 'Event-driven payroll changes audit trail (termination, hire, salary change, leave)';

COMMENT ON COLUMN alerts.severity IS 'info: 30 days notice, warning: 15 days, urgent: 7 days or less';
COMMENT ON COLUMN alerts.action_url IS 'Navigation URL when user clicks alert action button';
COMMENT ON COLUMN batch_operations.entity_ids IS 'Array of UUIDs for all entities affected by this batch operation';
COMMENT ON COLUMN batch_operations.errors IS 'Array of error objects: {entityId, error, timestamp}';
COMMENT ON COLUMN payroll_events.is_prorated IS 'True if payroll calculation was prorated (mid-month hire/termination)';
COMMENT ON COLUMN payroll_events.impacted_payroll_runs IS 'Array of payroll run IDs affected by this event';
