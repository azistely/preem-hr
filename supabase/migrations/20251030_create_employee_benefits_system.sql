-- Migration: Create Employee Benefits Management System
-- Comprehensive system for managing employee benefits (health, dental, insurance, etc.)
-- with enrollment tracking, effective dates, and cost management

-- ============================================================================
-- Table 1: benefit_plans - Company-wide benefit plan definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS benefit_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Plan identification
  plan_name VARCHAR(255) NOT NULL,
  plan_code VARCHAR(50) NOT NULL,
  benefit_type VARCHAR(50) NOT NULL, -- 'health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other'

  -- Plan details
  description TEXT,
  provider_name VARCHAR(255), -- Insurance company or benefit provider
  coverage_level VARCHAR(50), -- 'individual', 'family', 'employee_spouse', 'employee_children'

  -- Cost structure
  employee_cost DECIMAL(12,2), -- Monthly cost to employee (can be 0)
  employer_cost DECIMAL(12,2), -- Monthly cost to employer
  total_cost DECIMAL(12,2), -- Total monthly cost
  currency VARCHAR(3) DEFAULT 'XOF',
  cost_frequency VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'annual', 'per_payroll'

  -- Eligibility rules
  eligible_employee_types JSONB, -- ['LOCAL', 'EXPAT'] or null for all types
  waiting_period_days INTEGER DEFAULT 0, -- Days before benefit becomes active after enrollment
  requires_dependent_verification BOOLEAN DEFAULT false, -- Whether dependent documents are required

  -- Plan lifecycle
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Payroll integration
  links_to_salary_component_id UUID REFERENCES salary_component_definitions(id), -- For automatic payroll deductions

  -- Metadata
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(tenant_id, plan_code),
  CONSTRAINT valid_cost_frequency CHECK (cost_frequency IN ('monthly', 'annual', 'per_payroll')),
  CONSTRAINT valid_benefit_type CHECK (benefit_type IN ('health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other'))
);

-- ============================================================================
-- Table 2: employee_benefit_enrollments - Individual employee enrollments
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_benefit_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  benefit_plan_id UUID NOT NULL REFERENCES benefit_plans(id) ON DELETE RESTRICT,

  -- Enrollment lifecycle
  enrollment_date DATE NOT NULL, -- When employee enrolled
  effective_date DATE NOT NULL, -- When coverage starts
  termination_date DATE, -- When coverage ends (null if active)

  -- External enrollment identification
  enrollment_number VARCHAR(100), -- External policy/enrollment number (e.g., N° CMU for CI)
  policy_number VARCHAR(100), -- Insurance policy number

  -- Coverage details
  coverage_level VARCHAR(50), -- May override plan default
  covered_dependents JSONB DEFAULT '[]'::jsonb, -- [{dependent_id, name, relationship}]

  -- Cost overrides (if different from plan defaults)
  employee_cost_override DECIMAL(12,2),
  employer_cost_override DECIMAL(12,2),

  -- Enrollment status
  enrollment_status VARCHAR(50) DEFAULT 'active', -- 'active', 'pending', 'terminated', 'suspended'
  termination_reason VARCHAR(255),

  -- Supporting documents
  enrollment_document_url TEXT, -- Link to enrollment form or approval document
  beneficiary_designation JSONB, -- For life insurance, etc. [{name, relationship, percentage}]

  -- Metadata
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  CONSTRAINT valid_enrollment_dates CHECK (effective_date >= enrollment_date),
  CONSTRAINT valid_termination_date CHECK (termination_date IS NULL OR termination_date >= effective_date),
  CONSTRAINT valid_enrollment_status CHECK (enrollment_status IN ('active', 'pending', 'terminated', 'suspended'))
);

-- ============================================================================
-- Table 3: employee_benefit_enrollment_history - Audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_benefit_enrollment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES employee_benefit_enrollments(id) ON DELETE CASCADE,

  -- What changed
  change_type VARCHAR(50) NOT NULL, -- 'enrolled', 'modified', 'terminated', 'cost_changed', 'dependent_added', 'dependent_removed'
  change_description TEXT,

  -- Change tracking
  previous_values JSONB, -- Snapshot of previous values
  new_values JSONB, -- Snapshot of new values

  -- When and why
  change_date DATE NOT NULL,
  change_reason VARCHAR(255),
  effective_date DATE NOT NULL, -- When the change becomes effective

  -- Who made the change
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_change_type CHECK (change_type IN ('enrolled', 'modified', 'terminated', 'cost_changed', 'dependent_added', 'dependent_removed', 'status_changed'))
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- benefit_plans indexes
CREATE INDEX IF NOT EXISTS idx_benefit_plans_tenant ON benefit_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_benefit_plans_type ON benefit_plans(benefit_type);
CREATE INDEX IF NOT EXISTS idx_benefit_plans_active ON benefit_plans(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_benefit_plans_effective_dates ON benefit_plans(effective_from, effective_to);

-- employee_benefit_enrollments indexes
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollments_tenant ON employee_benefit_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollments_employee ON employee_benefit_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollments_plan ON employee_benefit_enrollments(benefit_plan_id);
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollments_status ON employee_benefit_enrollments(enrollment_status) WHERE enrollment_status = 'active';
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollments_effective_date ON employee_benefit_enrollments(effective_date);
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollments_enrollment_number ON employee_benefit_enrollments(enrollment_number) WHERE enrollment_number IS NOT NULL;

-- employee_benefit_enrollment_history indexes
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollment_history_enrollment ON employee_benefit_enrollment_history(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_employee_benefit_enrollment_history_change_date ON employee_benefit_enrollment_history(change_date);

-- ============================================================================
-- Table comments for documentation
-- ============================================================================

COMMENT ON TABLE benefit_plans IS 'Company-wide benefit plan definitions (health insurance, dental, life insurance, retirement, etc.)';
COMMENT ON TABLE employee_benefit_enrollments IS 'Individual employee enrollments in benefit plans with effective dates, costs, and covered dependents';
COMMENT ON TABLE employee_benefit_enrollment_history IS 'Complete audit trail of all changes to employee benefit enrollments';

-- Column comments
COMMENT ON COLUMN benefit_plans.benefit_type IS 'Type of benefit: health, dental, vision, life_insurance, retirement, disability, transport, meal, other';
COMMENT ON COLUMN benefit_plans.eligible_employee_types IS 'JSON array of eligible employee types (e.g., ["LOCAL", "EXPAT"]) or null for all types';
COMMENT ON COLUMN benefit_plans.links_to_salary_component_id IS 'Links to salary component for automatic payroll deductions of employee cost';

COMMENT ON COLUMN employee_benefit_enrollments.enrollment_number IS 'External enrollment/policy number (e.g., N° CMU for Côte d''Ivoire employees enrolled in CMU)';
COMMENT ON COLUMN employee_benefit_enrollments.covered_dependents IS 'JSON array of covered dependents: [{dependent_id, name, relationship}]';
COMMENT ON COLUMN employee_benefit_enrollments.beneficiary_designation IS 'JSON array of beneficiaries (for life insurance): [{name, relationship, percentage}]';

COMMENT ON COLUMN employee_benefit_enrollment_history.previous_values IS 'JSON snapshot of field values before the change';
COMMENT ON COLUMN employee_benefit_enrollment_history.new_values IS 'JSON snapshot of field values after the change';
