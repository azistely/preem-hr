-- Add geofence configurations for time tracking
CREATE TABLE IF NOT EXISTS geofence_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Geofence location (center point)
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,

  -- Effective dating
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),

  CONSTRAINT valid_radius CHECK (radius_meters > 0 AND radius_meters <= 5000),
  CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180)
);

-- RLS for geofence_configs
ALTER TABLE geofence_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON geofence_configs
  FOR ALL
  TO tenant_user
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin')
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_geofence_configs_tenant ON geofence_configs(tenant_id);
CREATE INDEX idx_geofence_configs_active ON geofence_configs(tenant_id, is_active) WHERE is_active = TRUE;

-- Add overtime rules table (country-specific)
CREATE TABLE IF NOT EXISTS overtime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,

  -- Rule definition
  rule_type TEXT NOT NULL, -- 'hours_41_to_46', 'hours_above_46', 'night_work', 'weekend', 'holiday'
  display_name JSONB NOT NULL, -- {'fr': 'Heures 41-46', 'en': 'Hours 41-46'}
  description JSONB,

  -- Multiplier
  multiplier NUMERIC(4, 2) NOT NULL, -- 1.15, 1.50, 1.75, 2.00

  -- Constraints
  min_hours_per_day NUMERIC(4, 2),
  max_hours_per_day NUMERIC(4, 2),
  max_hours_per_week NUMERIC(5, 2),
  max_hours_per_month NUMERIC(6, 2),

  -- Time-based rules (for night work, weekend)
  applies_from_time TIME, -- e.g., 21:00 for night work
  applies_to_time TIME, -- e.g., 06:00 for night work
  applies_to_days JSONB, -- ['saturday', 'sunday'] for weekend

  -- Effective dating
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_multiplier CHECK (multiplier >= 1.0 AND multiplier <= 3.0),
  CONSTRAINT valid_rule_type CHECK (rule_type IN ('hours_41_to_46', 'hours_above_46', 'night_work', 'weekend', 'holiday', 'public_holiday')),
  CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_overtime_rules_country_effective ON overtime_rules(country_code, effective_from, effective_to);
CREATE INDEX idx_overtime_rules_type ON overtime_rules(country_code, rule_type);

-- Seed Côte d'Ivoire overtime rules
INSERT INTO overtime_rules (country_code, rule_type, display_name, multiplier, effective_from, max_hours_per_week) VALUES
  ('CI', 'hours_41_to_46', '{"fr": "Heures 41 à 46", "en": "Hours 41-46"}', 1.15, '2024-01-01', 15),
  ('CI', 'hours_above_46', '{"fr": "Heures au-delà de 46", "en": "Hours above 46"}', 1.50, '2024-01-01', 15),
  ('CI', 'night_work', '{"fr": "Travail de nuit (21h-6h)", "en": "Night work (9PM-6AM)"}', 1.75, '2024-01-01', NULL),
  ('CI', 'weekend', '{"fr": "Weekend", "en": "Weekend"}', 1.75, '2024-01-01', NULL),
  ('CI', 'public_holiday', '{"fr": "Jours fériés", "en": "Public holidays"}', 1.75, '2024-01-01', NULL)
ON CONFLICT DO NOTHING;

-- Update night work rule with time constraints
UPDATE overtime_rules
SET applies_from_time = '21:00:00', applies_to_time = '06:00:00'
WHERE country_code = 'CI' AND rule_type = 'night_work';

-- Update weekend rule with day constraints
UPDATE overtime_rules
SET applies_to_days = '["saturday", "sunday"]'::jsonb
WHERE country_code = 'CI' AND rule_type = 'weekend';

-- Seed Senegal overtime rules
INSERT INTO overtime_rules (country_code, rule_type, display_name, multiplier, effective_from, max_hours_per_week) VALUES
  ('SN', 'hours_41_to_46', '{"fr": "Heures supplémentaires (1-8h)", "en": "Overtime (1-8h)"}', 1.15, '2024-01-01', NULL),
  ('SN', 'hours_above_46', '{"fr": "Heures supplémentaires (8h+)", "en": "Overtime (8h+)"}', 1.40, '2024-01-01', NULL),
  ('SN', 'night_work', '{"fr": "Travail de nuit", "en": "Night work"}', 1.60, '2024-01-01', NULL),
  ('SN', 'weekend', '{"fr": "Dimanche", "en": "Sunday"}', 1.60, '2024-01-01', NULL)
ON CONFLICT DO NOTHING;

-- Add overtime hours breakdown to time_entries (if not exists)
-- This is a JSONB field to store detailed hour classification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'overtime_breakdown'
  ) THEN
    ALTER TABLE time_entries
    ADD COLUMN overtime_breakdown JSONB DEFAULT '{}';
  END IF;
END $$;

COMMENT ON COLUMN time_entries.overtime_breakdown IS 'Detailed breakdown of hours by type: {regular: 8, hours_41_to_46: 2, night_work: 4, etc.}';

-- Create helper function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 NUMERIC, lon1 NUMERIC,
  lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  earth_radius CONSTANT NUMERIC := 6371000; -- meters
  dlat NUMERIC;
  dlon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat/2) * sin(dlat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon/2) * sin(dlon/2);

  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance_meters IS 'Calculate distance in meters between two GPS coordinates using Haversine formula';
