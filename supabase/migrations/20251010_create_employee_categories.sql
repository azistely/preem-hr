-- Migration: Create employee_category_coefficients table
-- Phase 1 of Architecture Analysis (Week 2)
-- Purpose: Define A1-F categories with notice periods and minimum wage rules

-- Step 1: Create employee categories lookup table
CREATE TABLE employee_category_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  category VARCHAR(10) NOT NULL, -- A1, A2, B1, B2, C, D, E, F
  label_fr TEXT NOT NULL, -- Human-readable label (e.g., "Ouvrier non qualifié")
  min_coefficient INTEGER NOT NULL,
  max_coefficient INTEGER NOT NULL,

  -- Notice period rules (Convention Collective Article 21)
  notice_period_days INTEGER NOT NULL, -- Days before termination
  notice_reduction_percent INTEGER DEFAULT 0, -- Percentage reduction for time searching (e.g., 2 hours/day = 25%)

  -- Minimum wage multiplier (SMIG × coefficient / 100)
  minimum_wage_base VARCHAR(20) NOT NULL DEFAULT 'SMIG', -- SMIG or SMAG

  -- Metadata
  legal_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT uk_category_country UNIQUE (country_code, category),
  CONSTRAINT uk_coefficient_range UNIQUE (country_code, min_coefficient, max_coefficient),
  CONSTRAINT check_coefficient_order CHECK (min_coefficient <= max_coefficient),
  CONSTRAINT check_notice_period CHECK (notice_period_days > 0),
  CONSTRAINT check_notice_reduction CHECK (notice_reduction_percent >= 0 AND notice_reduction_percent <= 100)
);

-- Step 2: Add indexes for performance
CREATE INDEX idx_employee_categories_country ON employee_category_coefficients(country_code);
CREATE INDEX idx_employee_categories_coefficient_range ON employee_category_coefficients(country_code, min_coefficient, max_coefficient);

-- Step 3: Add RLS policies (inherits from countries)
ALTER TABLE employee_category_coefficients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all authenticated users"
  ON employee_category_coefficients
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert/update/delete for admins only"
  ON employee_category_coefficients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Step 4: Add trigger for updated_at
CREATE TRIGGER update_employee_categories_updated_at
  BEFORE UPDATE ON employee_category_coefficients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Add comments
COMMENT ON TABLE employee_category_coefficients IS 'Employee categories (A1-F) defining coefficient ranges, notice periods, and minimum wage rules per Convention Collective Interprofessionnelle';
COMMENT ON COLUMN employee_category_coefficients.category IS 'Category code: A1 (ouvrier), A2 (ouvrier qualifié), B1 (employé), B2 (employé qualifié), C (agent de maîtrise), D (cadre), E (cadre supérieur), F (directeur)';
COMMENT ON COLUMN employee_category_coefficients.notice_period_days IS 'Required notice period in days before termination (e.g., 15 days for A1-B1, 30 days for B2-C, 90 days for D-F)';
COMMENT ON COLUMN employee_category_coefficients.notice_reduction_percent IS 'Percentage of notice period allocated for job search (Convention Collective: 2 hours/day = 25% for 8-hour workday)';
