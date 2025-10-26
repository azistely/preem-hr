-- Create Variable Pay Inputs Table
-- Purpose: Store monthly variable component values (commissions, production bonuses, etc.)
-- that change period-to-period for employees

CREATE TABLE IF NOT EXISTS variable_pay_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Component identifier (matches code from salary_component_definitions)
  component_code VARCHAR(50) NOT NULL,

  -- Period in YYYY-MM-01 format (first day of month)
  period DATE NOT NULL,

  -- Amount for this period
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),

  -- Optional notes (e.g., "Commission sur ventes de janvier")
  notes TEXT,

  -- Audit fields
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_employee_component_period UNIQUE(tenant_id, employee_id, component_code, period)
);

-- Indexes for performance
CREATE INDEX idx_variable_pay_tenant ON variable_pay_inputs(tenant_id);
CREATE INDEX idx_variable_pay_employee ON variable_pay_inputs(employee_id);
CREATE INDEX idx_variable_pay_period ON variable_pay_inputs(tenant_id, period);
CREATE INDEX idx_variable_pay_component ON variable_pay_inputs(component_code);
CREATE INDEX idx_variable_pay_lookup ON variable_pay_inputs(tenant_id, employee_id, period);

-- RLS Policy for tenant isolation
ALTER TABLE variable_pay_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON variable_pay_inputs
  FOR ALL
  TO tenant_user
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Super admin policy (full access)
CREATE POLICY super_admin_access ON variable_pay_inputs
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'super_admin');

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_variable_pay_inputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_variable_pay_inputs_timestamp
  BEFORE UPDATE ON variable_pay_inputs
  FOR EACH ROW
  EXECUTE FUNCTION update_variable_pay_inputs_updated_at();

-- Add component_type to salary_component_definitions if not exists
-- This allows marking components as 'fixed' or 'variable'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'salary_component_definitions'
    AND column_name = 'component_type'
  ) THEN
    ALTER TABLE salary_component_definitions
    ADD COLUMN component_type VARCHAR(50) DEFAULT 'fixed';

    -- Add check constraint
    ALTER TABLE salary_component_definitions
    ADD CONSTRAINT chk_component_type
    CHECK (component_type IN ('fixed', 'variable', 'percentage', 'formula'));
  END IF;
END $$;

-- Comment on table
COMMENT ON TABLE variable_pay_inputs IS 'Monthly variable pay component values that change period-to-period (commissions, production bonuses, etc.)';
COMMENT ON COLUMN variable_pay_inputs.component_code IS 'Component code matching salary_component_definitions.code';
COMMENT ON COLUMN variable_pay_inputs.period IS 'Period in YYYY-MM-01 format (first day of month)';
COMMENT ON COLUMN variable_pay_inputs.amount IS 'Variable amount for this component in this period';
