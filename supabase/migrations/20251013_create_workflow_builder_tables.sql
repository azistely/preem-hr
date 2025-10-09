-- ============================================================================
-- Phase 4: Visual Workflow Builder - Database Schema
-- Created: 2025-10-13
-- Epic: 09-EPIC-WORKFLOW-AUTOMATION.md (Phase 4)
-- ============================================================================

-- ============================================================================
-- 1. WORKFLOW DEFINITIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Workflow metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Trigger configuration
  trigger_type TEXT NOT NULL, -- 'contract_expiry', 'salary_change', 'employee_hired', 'leave_approved', etc.
  trigger_config JSONB NOT NULL DEFAULT '{}', -- Configuration for trigger (e.g., days_before for contract_expiry)

  -- Conditions (optional filtering)
  conditions JSONB DEFAULT '[]', -- Array of condition objects

  -- Actions to execute
  actions JSONB NOT NULL DEFAULT '[]', -- Array of action objects

  -- Metadata
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_by UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,

  -- Execution stats
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,

  -- Template metadata
  is_template BOOLEAN DEFAULT false,
  template_category TEXT, -- 'contract_management', 'payroll', 'onboarding', 'offboarding'

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT workflow_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for workflow definitions
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_status ON workflow_definitions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_trigger ON workflow_definitions(tenant_id, trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_templates ON workflow_definitions(is_template, template_category) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(tenant_id, trigger_type) WHERE status = 'active';

-- RLS Policy
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_definitions_tenant_isolation ON workflow_definitions
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 2. WORKFLOW EXECUTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Execution context
  trigger_event_id UUID, -- Reference to event that triggered this (if applicable)
  employee_id UUID REFERENCES employees(id), -- If employee-specific workflow

  -- Execution results
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- What happened
  actions_executed JSONB DEFAULT '[]', -- Array of executed action results
  error_message TEXT,
  execution_log JSONB DEFAULT '[]', -- Detailed step-by-step log

  -- Context data (snapshot of workflow definition at execution time)
  workflow_snapshot JSONB NOT NULL, -- Snapshot of workflow definition
  trigger_data JSONB NOT NULL DEFAULT '{}', -- Data that triggered the workflow

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT workflow_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for workflow executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_employee ON workflow_executions(employee_id, started_at DESC) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(tenant_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id, started_at DESC);

-- Partial index for recent failed executions (debugging)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_failed
  ON workflow_executions(workflow_id, started_at DESC)
  WHERE status = 'failed';

-- RLS Policy
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_executions_tenant_isolation ON workflow_executions
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- ============================================================================
-- 3. UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Update workflow execution stats after each execution
CREATE OR REPLACE FUNCTION update_workflow_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if execution completed (not running)
  IF NEW.status IN ('success', 'failed', 'skipped') AND OLD.status = 'running' THEN
    UPDATE workflow_definitions
    SET
      execution_count = execution_count + 1,
      last_executed_at = NEW.completed_at,
      success_count = success_count + CASE WHEN NEW.status = 'success' THEN 1 ELSE 0 END,
      error_count = error_count + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE id = NEW.workflow_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_executions_update_stats
  AFTER UPDATE ON workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_stats();

-- Function to get workflow execution success rate
CREATE OR REPLACE FUNCTION get_workflow_success_rate(p_workflow_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total INTEGER;
  v_success INTEGER;
BEGIN
  SELECT execution_count, success_count
  INTO v_total, v_success
  FROM workflow_definitions
  WHERE id = p_workflow_id;

  IF v_total = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((v_success::NUMERIC / v_total::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to archive old workflow executions (for cleanup)
CREATE OR REPLACE FUNCTION archive_old_workflow_executions(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete executions older than specified days (but keep failed ones for debugging)
  DELETE FROM workflow_executions
  WHERE created_at < now() - (p_days_old || ' days')::INTERVAL
    AND status = 'success';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. SEED PRE-BUILT WORKFLOW TEMPLATES
-- ============================================================================

-- Template 1: Contract Expiry Reminder (30 days before)
INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  conditions,
  actions,
  status,
  created_by,
  is_template,
  template_category
) VALUES (
  (SELECT id FROM tenants LIMIT 1), -- Will be cloned per tenant
  'Rappels de fin de contrat',
  'Alerte automatique 30 jours avant l''expiration d''un contrat',
  'contract_expiry',
  '{"days_before": 30}',
  '[]',
  '[
    {
      "type": "create_alert",
      "config": {
        "severity": "info",
        "message": "Le contrat de {{employee.fullName}} expire dans 30 jours",
        "actionUrl": "/employees/{{employee.id}}/contract/renew",
        "actionLabel": "Renouveler le contrat"
      }
    },
    {
      "type": "send_notification",
      "config": {
        "channel": "email",
        "template": "contract_expiry_reminder",
        "recipients": ["hr_manager"]
      }
    }
  ]',
  'active',
  (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
  true,
  'contract_management'
) ON CONFLICT DO NOTHING;

-- Template 2: Salary Increase Approval (>15%)
INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  conditions,
  actions,
  status,
  created_by,
  is_template,
  template_category
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  'Validation des augmentations',
  'Demande d''approbation pour les augmentations supérieures à 15%',
  'salary_change',
  '{}',
  '[
    {
      "field": "increase_percentage",
      "operator": "gt",
      "value": 15
    }
  ]',
  '[
    {
      "type": "create_alert",
      "config": {
        "severity": "warning",
        "message": "Augmentation de {{increase_percentage}}% pour {{employee.fullName}} nécessite une approbation",
        "actionUrl": "/salaries/review/{{salary.id}}",
        "actionLabel": "Examiner"
      }
    },
    {
      "type": "request_approval",
      "config": {
        "approvers": ["hr_director"],
        "timeout_days": 7
      }
    }
  ]',
  'active',
  (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
  true,
  'payroll'
) ON CONFLICT DO NOTHING;

-- Template 3: New Employee Onboarding
INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  conditions,
  actions,
  status,
  created_by,
  is_template,
  template_category
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  'Onboarding des nouveaux employés',
  'Crée automatiquement une checklist d''onboarding lors de l''embauche',
  'employee_hired',
  '{}',
  '[]',
  '[
    {
      "type": "create_tasks",
      "config": {
        "tasks": [
          {
            "title": "Créer le contrat de travail",
            "assignee": "hr_manager",
            "due_days": 3
          },
          {
            "title": "Commander l''équipement",
            "assignee": "it_manager",
            "due_days": 5
          },
          {
            "title": "Configurer les accès email",
            "assignee": "it_manager",
            "due_days": 1
          },
          {
            "title": "Planifier la formation d''accueil",
            "assignee": "hr_manager",
            "due_days": 7
          }
        ]
      }
    },
    {
      "type": "send_notification",
      "config": {
        "channel": "email",
        "template": "welcome_new_employee",
        "recipients": ["employee", "manager"]
      }
    }
  ]',
  'active',
  (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
  true,
  'onboarding'
) ON CONFLICT DO NOTHING;

-- Template 4: Final Payroll Calculation (Termination)
INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  conditions,
  actions,
  status,
  created_by,
  is_template,
  template_category
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  'Calcul de la paie de sortie',
  'Calcule automatiquement la paie de sortie lors d''une résiliation',
  'employee_terminated',
  '{}',
  '[]',
  '[
    {
      "type": "calculate_final_payroll",
      "config": {
        "include_prorated_salary": true,
        "include_vacation_payout": true,
        "include_exit_benefits": true
      }
    },
    {
      "type": "create_alert",
      "config": {
        "severity": "info",
        "message": "Paie de sortie calculée pour {{employee.fullName}}",
        "actionUrl": "/payroll/review/{{payroll.id}}",
        "actionLabel": "Examiner"
      }
    }
  ]',
  'active',
  (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
  true,
  'offboarding'
) ON CONFLICT DO NOTHING;

-- Template 5: Unpaid Leave Alert (>5 days)
INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  trigger_type,
  trigger_config,
  conditions,
  actions,
  status,
  created_by,
  is_template,
  template_category
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  'Alerte congés sans solde',
  'Notifie quand un congé sans solde dépasse 5 jours',
  'leave_approved',
  '{}',
  '[
    {
      "field": "leave_type",
      "operator": "eq",
      "value": "unpaid"
    },
    {
      "field": "duration_days",
      "operator": "gt",
      "value": 5
    }
  ]',
  '[
    {
      "type": "create_alert",
      "config": {
        "severity": "warning",
        "message": "{{employee.fullName}} a {{duration_days}} jours de congé sans solde",
        "actionUrl": "/time-off/{{leave.id}}",
        "actionLabel": "Voir les détails"
      }
    },
    {
      "type": "send_notification",
      "config": {
        "channel": "email",
        "template": "unpaid_leave_alert",
        "recipients": ["hr_manager", "manager"]
      }
    }
  ]',
  'active',
  (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
  true,
  'payroll'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE workflow_definitions IS 'Visual workflow builder definitions (Phase 4)';
COMMENT ON TABLE workflow_executions IS 'Workflow execution history with detailed logs';

COMMENT ON COLUMN workflow_definitions.trigger_type IS 'Event type that triggers this workflow (contract_expiry, salary_change, employee_hired, etc.)';
COMMENT ON COLUMN workflow_definitions.trigger_config IS 'Configuration for trigger (e.g., {"days_before": 30} for contract_expiry)';
COMMENT ON COLUMN workflow_definitions.conditions IS 'Array of condition objects to filter when workflow runs';
COMMENT ON COLUMN workflow_definitions.actions IS 'Array of action objects to execute when workflow runs';
COMMENT ON COLUMN workflow_definitions.status IS 'Workflow status: draft, active, paused, archived';
COMMENT ON COLUMN workflow_definitions.is_template IS 'True if this is a pre-built template that can be cloned';

COMMENT ON COLUMN workflow_executions.workflow_snapshot IS 'Snapshot of workflow definition at execution time (for auditability)';
COMMENT ON COLUMN workflow_executions.trigger_data IS 'Data that triggered the workflow (employee data, event data, etc.)';
COMMENT ON COLUMN workflow_executions.actions_executed IS 'Array of executed action results with timestamps';
COMMENT ON COLUMN workflow_executions.execution_log IS 'Detailed step-by-step execution log for debugging';
