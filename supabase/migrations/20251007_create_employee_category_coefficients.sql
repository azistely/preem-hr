-- Create employee_category_coefficients table
-- Maps employee categories (A1-F) to their minimum salary coefficients per country

CREATE TABLE employee_category_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,
  category_code VARCHAR(10) NOT NULL,
  category_name JSONB NOT NULL, -- { fr: "Employé qualifié", en: "Qualified employee" }

  -- Coefficient multiplier for minimum wage
  -- Salary must be >= (minimum_wage * coefficient)
  coefficient DECIMAL(6,2) NOT NULL,

  -- Minimum value allowed (per Convention Collective 1977: coefficient >= 90)
  CONSTRAINT coefficient_minimum CHECK (coefficient >= 90),

  -- Legal reference
  legal_reference TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(country_code, category_code)
);

-- Create index for lookups
CREATE INDEX idx_employee_category_coefficients_country
  ON employee_category_coefficients(country_code);

-- Add RLS policies
ALTER TABLE employee_category_coefficients ENABLE ROW LEVEL SECURITY;

-- Public read access (needed for salary validation)
CREATE POLICY "employee_category_coefficients_select_all" ON employee_category_coefficients
  FOR SELECT USING (true);

-- Only super admins can modify
CREATE POLICY "employee_category_coefficients_insert_super_admin" ON employee_category_coefficients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "employee_category_coefficients_update_super_admin" ON employee_category_coefficients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'SUPER_ADMIN'
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_employee_category_coefficients_updated_at
  BEFORE UPDATE ON employee_category_coefficients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
