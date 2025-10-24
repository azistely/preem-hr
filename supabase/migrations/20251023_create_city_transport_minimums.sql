-- Create city_transport_minimums table
-- Stores legal minimum transport allowances by city for each country
-- Follows multi-country architecture pattern

CREATE TABLE IF NOT EXISTS city_transport_minimums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Country reference
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,

  -- City identification
  city_name VARCHAR(100) NOT NULL,
  city_name_normalized VARCHAR(100) NOT NULL,

  -- Display names (multilingual JSONB)
  display_name JSONB NOT NULL,

  -- Transport allowance minimums
  monthly_minimum NUMERIC(15, 2) NOT NULL,
  daily_rate NUMERIC(15, 2) NOT NULL,

  -- Tax exemption cap (country-specific)
  tax_exemption_cap NUMERIC(15, 2),

  -- Effective dates
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Legal reference (JSONB)
  legal_reference JSONB,

  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(country_code, city_name_normalized, effective_from)
);

-- Indexes for fast lookups
CREATE INDEX idx_city_transport_country_date
  ON city_transport_minimums(country_code, effective_from, effective_to);

CREATE INDEX idx_city_transport_normalized
  ON city_transport_minimums(city_name_normalized);

-- Comments
COMMENT ON TABLE city_transport_minimums IS
'City-based minimum transport allowances for multi-country payroll.
Example (CI - Arrêté 2020): Abidjan 30k/month, Bouaké 24k/month, Other 20k/month.';

COMMENT ON COLUMN city_transport_minimums.city_name_normalized IS
'Lowercase normalized city name for case-insensitive matching';

COMMENT ON COLUMN city_transport_minimums.monthly_minimum IS
'Minimum monthly transport allowance for this city (FCFA/month for CI)';

COMMENT ON COLUMN city_transport_minimums.daily_rate IS
'Daily transport rate calculated as monthly_minimum ÷ 30 days';

COMMENT ON COLUMN city_transport_minimums.tax_exemption_cap IS
'Maximum non-taxable transport allowance amount (country-specific, e.g., 30,000 FCFA for CI)';
