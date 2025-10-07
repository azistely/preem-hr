-- Time-Off Policy Templates (Convention Collective Compliant)
-- Following 3-tier compliance system: Locked / Configurable / Freeform

CREATE TABLE IF NOT EXISTS time_off_policy_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code) ON DELETE RESTRICT,

  -- Template identification
  code VARCHAR(50) NOT NULL, -- e.g., 'ANNUAL_LEAVE_CI', 'MATERNITY_CI'
  name JSONB NOT NULL, -- {'fr': 'Congés annuels', 'en': 'Annual Leave'}
  description JSONB,
  category VARCHAR(50) NOT NULL, -- 'annual_leave', 'sick_leave', 'maternity', 'special', 'custom'

  -- Compliance level (3-tier system)
  compliance_level VARCHAR(20) NOT NULL CHECK (compliance_level IN ('locked', 'configurable', 'freeform')),
  legal_reference TEXT, -- e.g., 'Convention Collective Article 28'

  -- Policy configuration
  policy_type VARCHAR(50) NOT NULL,
  accrual_method VARCHAR(50) NOT NULL CHECK (accrual_method IN ('accrued_monthly', 'accrued_yearly', 'fixed', 'none')),

  -- Accrual rates (with legal constraints)
  default_accrual_rate NUMERIC(5, 2) NOT NULL, -- e.g., 2.0 days/month for standard annual leave
  min_accrual_rate NUMERIC(5, 2), -- Legal minimum (for configurable)
  max_accrual_rate NUMERIC(5, 2), -- Legal maximum (for configurable)

  -- Special accrual rules (JSONB for flexibility)
  special_accrual_rules JSONB, -- e.g., {'age_under_21': 2.5, 'seniority_15_years': 2.17, 'seniority_20_years': 2.33}

  -- Balance limits
  default_max_balance NUMERIC(6, 2), -- e.g., 30 days
  carryover_months INTEGER, -- e.g., 6 for CI (must use within 6 months)

  -- Payment
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  payment_rate NUMERIC(4, 2) DEFAULT 1.0, -- 1.0 = 100%, 0.5 = 50%

  -- Approval & notice
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  advance_notice_days INTEGER, -- e.g., 15 days for annual leave
  min_days_per_request NUMERIC(4, 1), -- e.g., 0.5 (half-day minimum)
  max_days_per_request NUMERIC(6, 2), -- e.g., 30 days
  min_continuous_days INTEGER, -- e.g., 12 days minimum continuous leave (Article 28)

  -- Blackout periods (company can add, but cannot override locked ones)
  default_blackout_periods JSONB, -- [{'start': '2025-12-15', 'end': '2026-01-05', 'reason': 'Year-end closing'}]

  -- Restrictions
  can_deactivate BOOLEAN NOT NULL DEFAULT TRUE, -- False for locked policies
  can_modify_accrual BOOLEAN NOT NULL DEFAULT FALSE, -- True only for configurable
  customizable_fields JSONB, -- ['accrual_rate', 'max_balance'] - which fields tenant can customize

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint
  CONSTRAINT unique_policy_template_per_country UNIQUE(country_code, code)
);

CREATE INDEX idx_time_off_policy_templates_country ON time_off_policy_templates(country_code);
CREATE INDEX idx_time_off_policy_templates_compliance ON time_off_policy_templates(compliance_level);
CREATE INDEX idx_time_off_policy_templates_active ON time_off_policy_templates(country_code, is_active) WHERE is_active = TRUE;

COMMENT ON TABLE time_off_policy_templates IS 'Convention Collective compliant time-off policy templates with 3-tier compliance system';
COMMENT ON COLUMN time_off_policy_templates.compliance_level IS 'locked = mandatory as-is, configurable = customizable within legal bounds, freeform = fully customizable';

-- Seed Côte d'Ivoire templates (Convention Collective 1977)

-- 🔒 LOCKED: Annual Leave (Standard - Article 28)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate, min_accrual_rate, max_accrual_rate,
  default_max_balance, carryover_months, is_paid, payment_rate,
  requires_approval, advance_notice_days, min_days_per_request, max_days_per_request, min_continuous_days,
  can_deactivate, can_modify_accrual, customizable_fields, display_order
) VALUES (
  'CI', 'ANNUAL_LEAVE_STANDARD_CI',
  '{"fr": "Congés annuels (standard)", "en": "Annual Leave (Standard)"}',
  '{"fr": "2 jours par mois travaillé (24 jours/an) selon Convention Collective Article 28", "en": "2 days per month worked (24 days/year) per Collective Agreement Article 28"}',
  'annual_leave', 'locked', 'Convention Collective Article 28',
  'annual_leave', 'accrued_monthly', 2.0, 2.0, 2.0, -- LOCKED at 2 days/month
  30, 6, TRUE, 1.0,
  TRUE, 15, 0.5, 30, 12,
  FALSE, FALSE, '[]'::jsonb, -- Cannot deactivate or modify
  1
) ON CONFLICT (country_code, code) DO NOTHING;

-- ⚙️ CONFIGURABLE: Annual Leave (Under 21)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate, min_accrual_rate, max_accrual_rate,
  default_max_balance, carryover_months, is_paid, payment_rate,
  requires_approval, advance_notice_days, min_days_per_request, max_days_per_request, min_continuous_days,
  can_deactivate, can_modify_accrual, customizable_fields, display_order
) VALUES (
  'CI', 'ANNUAL_LEAVE_UNDER_21_CI',
  '{"fr": "Congés annuels (moins de 21 ans)", "en": "Annual Leave (Under 21)"}',
  '{"fr": "2.5 jours par mois pour employés de moins de 21 ans (Article 28)", "en": "2.5 days per month for employees under 21 (Article 28)"}',
  'annual_leave', 'locked', 'Convention Collective Article 28',
  'annual_leave', 'accrued_monthly', 2.5, 2.5, 2.5,
  36, 6, TRUE, 1.0,
  TRUE, 15, 0.5, 30, 12,
  FALSE, FALSE, '[]'::jsonb,
  2
) ON CONFLICT (country_code, code) DO NOTHING;

-- 🔒 LOCKED: Seniority Bonus Leave (15+ years)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate, min_accrual_rate, max_accrual_rate,
  default_max_balance, carryover_months, is_paid, payment_rate,
  requires_approval, advance_notice_days,
  can_deactivate, can_modify_accrual, customizable_fields, display_order,
  special_accrual_rules
) VALUES (
  'CI', 'SENIORITY_LEAVE_15Y_CI',
  '{"fr": "Congés ancienneté (+15 ans)", "en": "Seniority Leave (+15 years)"}',
  '{"fr": "+2 jours après 15 ans de service (26 jours/an total)", "en": "+2 days after 15 years of service (26 days/year total)"}',
  'annual_leave', 'locked', 'Convention Collective Article 28',
  'seniority_leave', 'fixed', 2.0, 2.0, 2.0, -- +2 days total per year
  NULL, NULL, TRUE, 1.0,
  TRUE, 15,
  FALSE, FALSE, '[]'::jsonb, 3,
  '{"min_years_service": 15}'::jsonb
) ON CONFLICT (country_code, code) DO NOTHING;

-- 🔒 LOCKED: Maternity Leave (Article 30)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate, min_accrual_rate, max_accrual_rate,
  is_paid, payment_rate, requires_approval, advance_notice_days,
  can_deactivate, can_modify_accrual, customizable_fields, display_order,
  metadata
) VALUES (
  'CI', 'MATERNITY_LEAVE_CI',
  '{"fr": "Congé de maternité", "en": "Maternity Leave"}',
  '{"fr": "14 semaines (8 avant, 6 après accouchement) à 100% du salaire (Article 30)", "en": "14 weeks (8 before, 6 after birth) at 100% salary (Article 30)"}',
  'maternity', 'locked', 'Convention Collective Article 30',
  'maternity', 'fixed', 98, 98, 98, -- 14 weeks = 98 days
  TRUE, 1.0, FALSE, 90, -- No approval, 3 months notice
  FALSE, FALSE, '[]'::jsonb, 10,
  '{"total_weeks": 14, "pre_birth_weeks": 8, "post_birth_weeks": 6, "cnps_reimbursed": true, "job_protected": true}'::jsonb
) ON CONFLICT (country_code, code) DO NOTHING;

-- 🔒 LOCKED: Special Leave - Marriage (Article 28)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate,
  is_paid, payment_rate, requires_approval, advance_notice_days,
  can_deactivate, can_modify_accrual, display_order
) VALUES (
  'CI', 'SPECIAL_MARRIAGE_EMPLOYEE_CI',
  '{"fr": "Congé mariage (employé)", "en": "Marriage Leave (Employee)"}',
  '{"fr": "4 jours payés lors du mariage de l\'employé", "en": "4 paid days for employee\'s own marriage"}',
  'special', 'locked', 'Convention Collective Article 28',
  'special_marriage', 'fixed', 4,
  TRUE, 1.0, TRUE, 7,
  FALSE, FALSE, 20
) ON CONFLICT (country_code, code) DO NOTHING;

-- 🔒 LOCKED: Special Leave - Birth (Article 28)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate,
  is_paid, payment_rate, requires_approval, advance_notice_days,
  can_deactivate, can_modify_accrual, display_order
) VALUES (
  'CI', 'SPECIAL_BIRTH_CI',
  '{"fr": "Congé naissance", "en": "Paternity Leave"}',
  '{"fr": "3 jours payés lors de la naissance d\'un enfant", "en": "3 paid days for child birth"}',
  'special', 'locked', 'Convention Collective Article 28',
  'paternity', 'fixed', 3,
  TRUE, 1.0, FALSE, 1,
  FALSE, FALSE, 21
) ON CONFLICT (country_code, code) DO NOTHING;

-- 🔒 LOCKED: Special Leave - Death of Spouse/Child
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate,
  is_paid, payment_rate, requires_approval,
  can_deactivate, can_modify_accrual, display_order
) VALUES (
  'CI', 'SPECIAL_DEATH_SPOUSE_CHILD_CI',
  '{"fr": "Congé décès (conjoint/enfant)", "en": "Bereavement Leave (Spouse/Child)"}',
  '{"fr": "5 jours payés lors du décès d\'un conjoint ou enfant", "en": "5 paid days for death of spouse or child"}',
  'special', 'locked', 'Convention Collective Article 28',
  'bereavement', 'fixed', 5,
  TRUE, 1.0, FALSE,
  FALSE, FALSE, 22
) ON CONFLICT (country_code, code) DO NOTHING;

-- ⚙️ CONFIGURABLE: Sick Leave (tenant can configure days, within legal minimum)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate, min_accrual_rate, max_accrual_rate,
  is_paid, payment_rate, requires_approval, advance_notice_days,
  can_deactivate, can_modify_accrual, customizable_fields, display_order,
  metadata
) VALUES (
  'CI', 'SICK_LEAVE_CI',
  '{"fr": "Congé maladie", "en": "Sick Leave"}',
  '{"fr": "Congé maladie avec certificat médical (configurable selon politique entreprise)", "en": "Sick leave with medical certificate (configurable per company policy)"}',
  'sick_leave', 'configurable', NULL,
  'sick_leave', 'fixed', 15, 10, 30, -- Default 15, min 10, max 30 days/year
  TRUE, 1.0, FALSE, 0,
  TRUE, TRUE, '["default_accrual_rate", "default_max_balance"]'::jsonb, 30,
  '{"requires_medical_certificate": true, "max_consecutive_days_without_cert": 3}'::jsonb
) ON CONFLICT (country_code, code) DO NOTHING;

-- 🎨 FREEFORM: Remote Work Days (not regulated)
INSERT INTO time_off_policy_templates (
  country_code, code, name, description, category, compliance_level, legal_reference,
  policy_type, accrual_method, default_accrual_rate,
  is_paid, payment_rate, requires_approval, advance_notice_days,
  can_deactivate, can_modify_accrual, customizable_fields, display_order
) VALUES (
  'CI', 'REMOTE_WORK_DAYS_CI',
  '{"fr": "Jours de télétravail", "en": "Remote Work Days"}',
  '{"fr": "Jours de télétravail autorisés (politique interne)", "en": "Authorized remote work days (internal policy)"}',
  'custom', 'freeform', NULL,
  'remote_work', 'accrued_monthly', 4, -- Example: 4 days/month
  TRUE, 1.0, TRUE, 7,
  TRUE, TRUE, '["default_accrual_rate", "default_max_balance", "requires_approval", "advance_notice_days"]'::jsonb, 100
) ON CONFLICT (country_code, code) DO NOTHING;

-- Update time_off_policies table to link to templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_off_policies' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE time_off_policies
    ADD COLUMN template_id UUID REFERENCES time_off_policy_templates(id) ON DELETE SET NULL,
    ADD COLUMN compliance_level VARCHAR(20),
    ADD COLUMN legal_reference TEXT;

    CREATE INDEX idx_time_off_policies_template ON time_off_policies(template_id);
  END IF;
END $$;

COMMENT ON COLUMN time_off_policies.template_id IS 'Link to template used to create this policy (null for fully custom policies)';
COMMENT ON COLUMN time_off_policies.compliance_level IS 'Inherited from template: locked, configurable, or freeform';
