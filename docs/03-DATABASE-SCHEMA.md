# 🗄️ Database Schema - SOURCE OF TRUTH

## ⚠️ CRITICAL: This is the authoritative database design

**NEVER** assume table names, columns, or relationships. **ALWAYS** reference this document.

---

## Schema Principles

1. **Multi-tenancy:** Every tenant-scoped table has `tenant_id` + RLS
2. **Effective Dating:** Historical data uses `effective_from` / `effective_to`
3. **Immutability:** Transactions, events, audits are append-only
4. **Type Safety:** ENUMs for fixed values, JSONB for flexible data with Zod validation

---

## Core Tables

### 1. Tenants (Companies)

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- URL-safe identifier
  country_code TEXT NOT NULL DEFAULT 'CI', -- ISO 3166-1 alpha-2
  currency TEXT NOT NULL DEFAULT 'XOF',
  timezone TEXT NOT NULL DEFAULT 'Africa/Abidjan',

  -- Business info
  tax_id TEXT, -- Company tax registration number
  business_registration TEXT,
  industry TEXT,

  -- Subscription & features
  plan TEXT NOT NULL DEFAULT 'trial', -- trial, starter, professional, enterprise
  features JSONB NOT NULL DEFAULT '[]', -- Enabled modules: ["payroll", "time-tracking"]

  -- Configuration
  settings JSONB NOT NULL DEFAULT '{}',

  -- Payroll configuration (multi-country support)
  sector_code VARCHAR(50), -- 'services', 'industry', 'construction', etc.
  default_fiscal_parts NUMERIC(3,1) DEFAULT 1.0,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, archived
  trial_ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_country CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_tenants_country ON tenants(country_code);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
```

### 2. Users (System Access)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,

  -- Profile
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'fr',

  -- Access control
  role TEXT NOT NULL DEFAULT 'employee', -- super_admin, tenant_admin, hr_manager, employee
  permissions JSONB NOT NULL DEFAULT '[]',

  -- Session tracking
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, archived

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_role CHECK (role IN ('super_admin', 'tenant_admin', 'hr_manager', 'employee'))
);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
```

---

## Employee Management

### 3. Employees (People)

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Personal info
  employee_number TEXT NOT NULL, -- Company-specific ID
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  date_of_birth DATE,
  gender TEXT, -- male, female, other, prefer_not_to_say

  -- Contact (PII - should be encrypted)
  email TEXT NOT NULL,
  phone TEXT,
  national_id TEXT, -- Encrypted

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  country_code TEXT NOT NULL DEFAULT 'CI',

  -- Employment
  hire_date DATE NOT NULL,
  termination_date DATE,
  termination_reason TEXT,

  -- Banking (PII - encrypted)
  bank_name TEXT,
  bank_account TEXT, -- Encrypted

  -- CNPS (Social Security)
  cnps_number TEXT,

  -- Tax
  tax_number TEXT,
  tax_dependents INTEGER NOT NULL DEFAULT 0,

  -- Payroll data (multi-country support)
  fiscal_parts NUMERIC(3,1) DEFAULT 1.0,
  has_spouse BOOLEAN DEFAULT FALSE,
  dependent_children INTEGER DEFAULT 0,
  cmu_family_coverage BOOLEAN DEFAULT FALSE,

  -- Custom fields (Zod validated)
  custom_fields JSONB NOT NULL DEFAULT '{}',

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active', -- active, terminated, suspended

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  CONSTRAINT unique_employee_number UNIQUE (tenant_id, employee_number),
  CONSTRAINT valid_status CHECK (status IN ('active', 'terminated', 'suspended'))
);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON employees
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Indexes
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_status ON employees(tenant_id, status);
CREATE INDEX idx_employees_hire_date ON employees(tenant_id, hire_date);
CREATE INDEX idx_employees_number ON employees(tenant_id, employee_number);
```

### 4. Positions (Jobs - Separate from People)

```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Position info
  title TEXT NOT NULL,
  code TEXT, -- Position code (e.g., "ENG-001")
  description TEXT,

  -- Hierarchy
  department_id UUID REFERENCES departments(id),
  reports_to_position_id UUID REFERENCES positions(id),

  -- Compensation
  min_salary NUMERIC(15,2),
  max_salary NUMERIC(15,2),
  currency TEXT NOT NULL DEFAULT 'XOF',

  -- Classification
  job_level TEXT, -- entry, mid, senior, executive
  employment_type TEXT NOT NULL DEFAULT 'full_time', -- full_time, part_time, contract

  -- Work schedule
  weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 40,
  work_schedule JSONB, -- { monday: "08:00-17:00", ... }

  -- Status
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  headcount INTEGER NOT NULL DEFAULT 1, -- How many people can fill this position

  -- Effective dating
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  CONSTRAINT no_position_overlap EXCLUDE USING gist (
    id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
  )
);

-- RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON positions
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_positions_tenant ON positions(tenant_id);
CREATE INDEX idx_positions_department ON positions(department_id);
```

### 5. Assignments (Binding People to Positions)

```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,

  -- Assignment details
  assignment_type TEXT NOT NULL DEFAULT 'primary', -- primary, secondary, temporary

  -- Effective dating
  effective_from DATE NOT NULL,
  effective_to DATE, -- NULL = current assignment

  -- Reason tracking
  assignment_reason TEXT, -- hire, promotion, transfer, demotion
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),

  -- Prevent overlapping primary assignments
  CONSTRAINT no_primary_overlap EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
  ) WHERE (assignment_type = 'primary')
);

-- RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON assignments
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_assignments_employee ON assignments(employee_id, effective_from DESC);
CREATE INDEX idx_assignments_position ON assignments(position_id);
CREATE INDEX idx_assignments_current ON assignments(employee_id, effective_to) WHERE effective_to IS NULL;
```

---

## Payroll Tables

### 6. Employee Salaries (Effective-Dated)

```sql
CREATE TABLE employee_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Salary details
  base_salary NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XOF',
  pay_frequency TEXT NOT NULL DEFAULT 'monthly', -- monthly, biweekly, weekly

  -- Allowances (recurring)
  housing_allowance NUMERIC(15,2) DEFAULT 0,
  transport_allowance NUMERIC(15,2) DEFAULT 0,
  meal_allowance NUMERIC(15,2) DEFAULT 0,
  other_allowances JSONB DEFAULT '[]', -- [{ name, amount, taxable }]

  -- Effective dating
  effective_from DATE NOT NULL,
  effective_to DATE,

  -- Change tracking
  change_reason TEXT, -- hire, promotion, adjustment, cost_of_living

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),

  -- Validation
  CONSTRAINT salary_minimum CHECK (base_salary >= 75000), -- SMIG for CI

  -- Prevent overlapping salaries
  CONSTRAINT no_salary_overlap EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)') WITH &&
  )
);

-- RLS
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON employee_salaries
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_salaries_employee ON employee_salaries(employee_id, effective_from DESC);
CREATE INDEX idx_salaries_current ON employee_salaries(employee_id) WHERE effective_to IS NULL;
```

### 7. Payroll Runs

```sql
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payment_date DATE NOT NULL,

  -- Metadata
  name TEXT NOT NULL, -- "Paie Janvier 2025"
  description TEXT,

  -- Processing
  status TEXT NOT NULL DEFAULT 'draft', -- draft, calculating, calculated, approved, paid, failed
  calculated_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  paid_at TIMESTAMPTZ,

  -- Totals (denormalized for quick access)
  employee_count INTEGER,
  total_gross NUMERIC(15,2),
  total_net NUMERIC(15,2),
  total_employer_cost NUMERIC(15,2),
  total_cnps_employee NUMERIC(15,2),
  total_cnps_employer NUMERIC(15,2),
  total_its NUMERIC(15,2),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_period CHECK (period_start <= period_end),
  CONSTRAINT unique_period UNIQUE (tenant_id, period_start, period_end)
);

-- RLS
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON payroll_runs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_payroll_runs_tenant ON payroll_runs(tenant_id, period_start DESC);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(tenant_id, status);
```

### 8. Payroll Line Items (Individual Employee Pay)

```sql
CREATE TABLE payroll_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Employee snapshot (denormalized for historical accuracy)
  employee_name TEXT NOT NULL,
  employee_number TEXT NOT NULL,
  position_title TEXT,

  -- Earnings
  base_salary NUMERIC(15,2) NOT NULL,
  overtime_pay NUMERIC(15,2) DEFAULT 0,
  bonuses NUMERIC(15,2) DEFAULT 0,
  allowances NUMERIC(15,2) DEFAULT 0,
  gross_salary NUMERIC(15,2) NOT NULL,

  -- Deductions - Employee
  cnps_employee NUMERIC(15,2) NOT NULL,
  cmu_employee NUMERIC(15,2) NOT NULL,
  its NUMERIC(15,2) NOT NULL,
  other_deductions NUMERIC(15,2) DEFAULT 0,
  total_deductions NUMERIC(15,2) NOT NULL,

  -- Employer Contributions
  cnps_employer NUMERIC(15,2) NOT NULL,
  cmu_employer NUMERIC(15,2) NOT NULL,

  -- Other taxes (country-agnostic: FDFP for CI, 3FPT for SN, etc.)
  total_other_taxes NUMERIC(15,2) DEFAULT 0,

  -- Net Pay
  net_salary NUMERIC(15,2) NOT NULL,
  employer_cost NUMERIC(15,2) NOT NULL,

  -- Detailed breakdown (JSONB for flexibility)
  earnings_details JSONB NOT NULL DEFAULT '[]', -- [{ type, description, amount }]
  deductions_details JSONB NOT NULL DEFAULT '[]',
  other_taxes_details JSONB NOT NULL DEFAULT '[]', -- [{ code, name, amount, rate, base }]
  -- Example for CI: [
  --   {"code": "fdfp_tap", "name": "TAP (FDFP)", "amount": 526, "rate": 0.004, "base": 131416},
  --   {"code": "fdfp_tfpc", "name": "TFPC (FDFP)", "amount": 1577, "rate": 0.012, "base": 131416}
  -- ]
  -- Example for SN: [
  --   {"code": "3fpt_training", "name": "3FPT Formation", "amount": 1500, "rate": 0.015, "base": 100000}
  -- ]

  -- Days worked
  days_worked NUMERIC(5,2) NOT NULL DEFAULT 30,
  days_absent NUMERIC(5,2) DEFAULT 0,

  -- Payment
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed
  payment_method TEXT, -- bank_transfer, cash, check
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_employee_run UNIQUE (payroll_run_id, employee_id)
);

-- RLS
ALTER TABLE payroll_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON payroll_line_items
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_payroll_items_run ON payroll_line_items(payroll_run_id);
CREATE INDEX idx_payroll_items_employee ON payroll_line_items(employee_id, created_at DESC);
```

---

## Time Tracking

### 9. Time Entries

```sql
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Time
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  total_hours NUMERIC(5,2),

  -- Location (for geofencing)
  clock_in_location GEOGRAPHY(POINT),
  clock_out_location GEOGRAPHY(POINT),
  geofence_verified BOOLEAN DEFAULT false,

  -- Verification (photo, signature)
  clock_in_photo_url TEXT,
  clock_out_photo_url TEXT,

  -- Classification
  entry_type TEXT NOT NULL DEFAULT 'regular', -- regular, overtime, on_call

  -- Approval
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Notes
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_time CHECK (clock_out IS NULL OR clock_out > clock_in)
);

-- RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON time_entries
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_time_entries_employee ON time_entries(employee_id, clock_in DESC);
CREATE INDEX idx_time_entries_status ON time_entries(tenant_id, status);
CREATE INDEX idx_time_entries_date ON time_entries(tenant_id, DATE(clock_in));
```

---

## Time Off & Leaves

### 10. Time Off Policies

```sql
CREATE TABLE time_off_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  policy_type TEXT NOT NULL, -- annual_leave, sick_leave, maternity, paternity, unpaid

  -- Accrual
  accrual_method TEXT NOT NULL, -- fixed, accrued_monthly, accrued_hourly
  accrual_rate NUMERIC(5,2), -- Days per month/year
  max_balance NUMERIC(5,2), -- Max days that can be carried over

  -- Requirements
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  advance_notice_days INTEGER DEFAULT 0,
  min_days_per_request NUMERIC(3,1) DEFAULT 0.5,
  max_days_per_request NUMERIC(5,1),

  -- Blackout periods (JSONB: [{ start, end, reason }])
  blackout_periods JSONB DEFAULT '[]',

  -- Paid/Unpaid
  is_paid BOOLEAN NOT NULL DEFAULT true,

  -- Effective dating
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- RLS
ALTER TABLE time_off_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON time_off_policies
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 11. Time Off Balances

```sql
CREATE TABLE time_off_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES time_off_policies(id) ON DELETE CASCADE,

  -- Balance
  balance NUMERIC(5,2) NOT NULL DEFAULT 0,
  used NUMERIC(5,2) NOT NULL DEFAULT 0,
  pending NUMERIC(5,2) NOT NULL DEFAULT 0, -- Requested but not approved

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Last accrual
  last_accrual_date DATE,

  -- Audit
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_employee_policy_period UNIQUE (employee_id, policy_id, period_start)
);

-- RLS
ALTER TABLE time_off_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON time_off_balances
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 12. Time Off Requests

```sql
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES time_off_policies(id),

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL,

  -- Details
  reason TEXT,
  notes TEXT,

  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_dates CHECK (start_date <= end_date)
);

-- RLS
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON time_off_requests
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_timeoff_requests_employee ON time_off_requests(employee_id, start_date DESC);
CREATE INDEX idx_timeoff_requests_status ON time_off_requests(tenant_id, status);
```

---

## Country-Specific Rules (Super Admin)

### 13. Countries

Master table of supported countries.

```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 ('CI', 'SN', 'BF', etc.)
  name JSONB NOT NULL, -- {'fr': 'Côte d\'Ivoire', 'en': 'Ivory Coast'}
  currency_code VARCHAR(3) NOT NULL, -- 'XOF', 'GNF'
  decimal_places INTEGER NOT NULL DEFAULT 0, -- 0 for CFA, 2 for GNF
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data for West African countries
INSERT INTO countries (code, name, currency_code) VALUES
  ('CI', '{"fr": "Côte d''Ivoire", "en": "Ivory Coast"}', 'XOF'),
  ('SN', '{"fr": "Sénégal", "en": "Senegal"}', 'XOF'),
  ('BF', '{"fr": "Burkina Faso", "en": "Burkina Faso"}', 'XOF'),
  ('ML', '{"fr": "Mali", "en": "Mali"}', 'XOF'),
  ('BJ', '{"fr": "Bénin", "en": "Benin"}', 'XOF'),
  ('TG', '{"fr": "Togo", "en": "Togo"}', 'XOF'),
  ('GN', '{"fr": "Guinée", "en": "Guinea"}', 'GNF');

CREATE INDEX idx_countries_code ON countries(code);
```

### 14. Tax Systems

Configuration for each country's tax system (ITS, IRPP, IUTS, etc.).

```sql
CREATE TABLE tax_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  name VARCHAR(100) NOT NULL, -- 'ITS', 'IRPP', 'IUTS'
  display_name JSONB NOT NULL, -- {'fr': 'Impôt sur les Traitements et Salaires'}
  calculation_method VARCHAR(50) NOT NULL, -- 'progressive_monthly', 'progressive_annual'
  supports_family_deductions BOOLEAN NOT NULL DEFAULT FALSE,
  calculation_base VARCHAR(50) NOT NULL, -- 'brut_imposable', 'net_imposable'
  effective_from DATE NOT NULL,
  effective_to DATE,
  metadata JSONB, -- Additional country-specific configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_tax_systems_country_effective ON tax_systems(country_code, effective_from, effective_to);

-- Côte d'Ivoire ITS (2024 reform - CURRENT CORRECT BRACKETS)
INSERT INTO tax_systems (country_code, name, display_name, calculation_method, supports_family_deductions, calculation_base, effective_from)
VALUES (
  'CI',
  'ITS',
  '{"fr": "Impôt sur les Traitements et Salaires", "en": "Tax on Salaries"}',
  'progressive_monthly',
  TRUE,
  'brut_imposable',
  '2024-01-01'
);
```

### 15. Tax Brackets

Tax bracket definitions for each tax system.

```sql
CREATE TABLE tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_system_id UUID NOT NULL REFERENCES tax_systems(id) ON DELETE CASCADE,
  bracket_order INTEGER NOT NULL, -- 1, 2, 3, etc.
  min_amount NUMERIC(15,2) NOT NULL,
  max_amount NUMERIC(15,2), -- NULL for last bracket (infinity)
  rate NUMERIC(6,4) NOT NULL, -- 0.16 = 16%
  description JSONB, -- Optional bracket description

  CONSTRAINT chk_bracket_amounts CHECK (max_amount IS NULL OR max_amount > min_amount),
  CONSTRAINT chk_rate_valid CHECK (rate >= 0 AND rate <= 1),
  UNIQUE (tax_system_id, bracket_order)
);

CREATE INDEX idx_tax_brackets_system ON tax_brackets(tax_system_id, bracket_order);

-- Côte d'Ivoire 6 brackets (MONTHLY progressive - 2024 reform)
INSERT INTO tax_brackets (tax_system_id, bracket_order, min_amount, max_amount, rate) VALUES
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 1, 0, 75000, 0),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 2, 75000, 240000, 0.16),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 3, 240000, 800000, 0.21),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 4, 800000, 2400000, 0.24),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 5, 2400000, 8000000, 0.28),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 6, 8000000, NULL, 0.32);
```

### 16. Family Deduction Rules

Family deductions for countries that support them (e.g., Côte d'Ivoire).

```sql
CREATE TABLE family_deduction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_system_id UUID NOT NULL REFERENCES tax_systems(id) ON DELETE CASCADE,
  fiscal_parts NUMERIC(3,1) NOT NULL, -- 1.0, 1.5, 2.0, etc.
  deduction_amount NUMERIC(15,2) NOT NULL,
  description JSONB, -- e.g., {'fr': 'Célibataire sans enfant'}

  UNIQUE (tax_system_id, fiscal_parts)
);

CREATE INDEX idx_family_deductions_system ON family_deduction_rules(tax_system_id);

-- Côte d'Ivoire family deductions (parts fiscales)
INSERT INTO family_deduction_rules (tax_system_id, fiscal_parts, deduction_amount, description) VALUES
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 1.0, 0, '{"fr": "Célibataire sans enfant"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 1.5, 5500, '{"fr": "Marié sans enfant OU célibataire 1 enfant"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 2.0, 11000, '{"fr": "Marié 1 enfant OU célibataire 2 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 2.5, 16500, '{"fr": "Marié 2 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 3.0, 22000, '{"fr": "Marié 3 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 3.5, 27500, '{"fr": "Marié 4 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 4.0, 33000, '{"fr": "Marié 5 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 4.5, 38500, '{"fr": "Marié 6 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 5.0, 44000, '{"fr": "Marié 7+ enfants"}');
```

### 17. Social Security Schemes

Social security agency and scheme configuration.

```sql
CREATE TABLE social_security_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  agency_code VARCHAR(10) NOT NULL, -- 'CNPS', 'CSS', 'INPS'
  agency_name JSONB NOT NULL, -- {'fr': 'Caisse Nationale de Prévoyance Sociale'}
  effective_from DATE NOT NULL,
  effective_to DATE,
  metadata JSONB, -- Additional country-specific config
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_social_schemes_country_effective ON social_security_schemes(country_code, effective_from, effective_to);

-- Côte d'Ivoire CNPS
INSERT INTO social_security_schemes (country_code, agency_code, agency_name, effective_from)
VALUES (
  'CI',
  'CNPS',
  '{"fr": "Caisse Nationale de Prévoyance Sociale", "en": "National Social Security Fund"}',
  '2024-01-01'
);
```

### 18. Contribution Types

Types of social security contributions (pension, family, health, etc.).

```sql
CREATE TABLE contribution_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES social_security_schemes(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL, -- 'pension', 'family_benefits', 'work_accident', 'cmu'
  name JSONB NOT NULL, -- {'fr': 'Retraite', 'en': 'Pension'}
  employee_rate NUMERIC(6,4), -- NULL if employer-only
  employer_rate NUMERIC(6,4), -- NULL if employee-only
  calculation_base VARCHAR(50) NOT NULL, -- 'brut_imposable', 'salaire_categoriel', 'fixed'
  ceiling_amount NUMERIC(15,2), -- NULL if no ceiling
  ceiling_period VARCHAR(20), -- 'monthly', 'annual'
  fixed_amount NUMERIC(15,2), -- For fixed contributions (CMU)
  is_variable_by_sector BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,

  UNIQUE (scheme_id, code)
);

CREATE INDEX idx_contribution_types_scheme ON contribution_types(scheme_id);

-- Côte d'Ivoire CNPS contributions (CORRECTED RATES)
INSERT INTO contribution_types (scheme_id, code, name, employee_rate, employer_rate, calculation_base, ceiling_amount, ceiling_period, display_order) VALUES
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'CI' AND effective_to IS NULL),
    'pension',
    '{"fr": "Retraite", "en": "Pension"}',
    0.063, -- 6.3%
    0.077, -- 7.7%
    'brut_imposable',
    281250, -- 3,375,000 annual / 12 = 281,250 monthly
    'monthly',
    1
  ),
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'CI' AND effective_to IS NULL),
    'family_benefits',
    '{"fr": "Prestations Familiales (inclut maternité)", "en": "Family Benefits (includes maternity)"}',
    NULL,
    0.05, -- 5.0% (CORRECTED from 5.75%)
    'salaire_categoriel',
    70000,
    'monthly',
    2
  ),
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'CI' AND effective_to IS NULL),
    'work_accident',
    '{"fr": "Accident du Travail", "en": "Work Accident"}',
    NULL,
    0.03, -- Default 3%, overridden by sector
    'salaire_categoriel',
    70000,
    'monthly',
    3
  ),
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'CI' AND effective_to IS NULL),
    'cmu',
    '{"fr": "Couverture Maladie Universelle", "en": "Universal Health Coverage"}',
    NULL,
    NULL,
    'fixed',
    NULL,
    NULL,
    4
  );

-- CMU fixed amounts
UPDATE contribution_types
SET employee_rate = NULL,
    employer_rate = NULL,
    fixed_amount = 1000 -- Employee fixed
WHERE code = 'cmu';
```

### 19. Sector Contribution Overrides

Sector-specific contribution rate overrides (e.g., work accident rates by sector).

```sql
CREATE TABLE sector_contribution_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_type_id UUID NOT NULL REFERENCES contribution_types(id) ON DELETE CASCADE,
  sector_code VARCHAR(50) NOT NULL, -- 'services', 'industry', 'construction', etc.
  sector_name JSONB NOT NULL,
  employer_rate NUMERIC(6,4) NOT NULL, -- Override rate for this sector
  risk_level VARCHAR(20), -- 'low', 'medium', 'high', 'very_high'

  UNIQUE (contribution_type_id, sector_code)
);

-- Work accident rates by sector (Côte d'Ivoire)
INSERT INTO sector_contribution_overrides (contribution_type_id, sector_code, sector_name, employer_rate, risk_level) VALUES
  (
    (SELECT id FROM contribution_types WHERE code = 'work_accident' AND scheme_id IN (SELECT id FROM social_security_schemes WHERE country_code = 'CI')),
    'services',
    '{"fr": "Services/Commerce", "en": "Services/Commerce"}',
    0.02, -- 2%
    'low'
  ),
  (
    (SELECT id FROM contribution_types WHERE code = 'work_accident' AND scheme_id IN (SELECT id FROM social_security_schemes WHERE country_code = 'CI')),
    'industry',
    '{"fr": "Industrie/Manufacture", "en": "Industry/Manufacturing"}',
    0.03, -- 3%
    'medium'
  ),
  (
    (SELECT id FROM contribution_types WHERE code = 'work_accident' AND scheme_id IN (SELECT id FROM social_security_schemes WHERE country_code = 'CI')),
    'construction',
    '{"fr": "BTP/Construction", "en": "Construction"}',
    0.05, -- 5%
    'very_high'
  );
```

### 20. Other Taxes

Other payroll-related taxes (FDFP training taxes, ANPE, etc.).

```sql
CREATE TABLE other_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  code VARCHAR(50) NOT NULL, -- 'fdfp_tap', 'fdfp_tfpc', 'anpe'
  name JSONB NOT NULL,
  tax_rate NUMERIC(6,4) NOT NULL,
  calculation_base VARCHAR(50) NOT NULL, -- 'brut_imposable', 'total_brut'
  paid_by VARCHAR(20) NOT NULL, -- 'employer', 'employee', 'both'
  effective_from DATE NOT NULL,
  effective_to DATE,

  UNIQUE (country_code, code, effective_from)
);

-- Côte d'Ivoire FDFP taxes (CRITICAL - was missing)
INSERT INTO other_taxes (country_code, code, name, tax_rate, calculation_base, paid_by, effective_from) VALUES
  (
    'CI',
    'fdfp_tap',
    '{"fr": "Taxe d''Apprentissage (FDFP)", "en": "Apprenticeship Tax"}',
    0.004, -- 0.4%
    'brut_imposable',
    'employer',
    '2024-01-01'
  ),
  (
    'CI',
    'fdfp_tfpc',
    '{"fr": "Taxe Formation Professionnelle Continue (FDFP)", "en": "Continuous Professional Training Tax"}',
    0.012, -- 1.2%
    'brut_imposable',
    'employer',
    '2024-01-01'
  );
```

### 21. Salary Component Definitions

Defines standard salary components and their tax treatment per country.

```sql
CREATE TABLE salary_component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  code VARCHAR(10) NOT NULL, -- '11', '12', '21', '22'
  name JSONB NOT NULL,
  component_type VARCHAR(50) NOT NULL, -- 'base', 'allowance', 'bonus', 'benefit_in_kind'
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_brut_imposable BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_salaire_categoriel BOOLEAN NOT NULL DEFAULT FALSE,
  tax_exempt_threshold NUMERIC(15,2), -- e.g., 30000 for transport allowance
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE (country_code, code)
);

-- Côte d'Ivoire salary components
INSERT INTO salary_component_definitions (country_code, code, name, component_type, is_taxable, include_in_brut_imposable, include_in_salaire_categoriel, display_order) VALUES
  ('CI', '11', '{"fr": "Salaire catégoriel", "en": "Base Salary"}', 'base', TRUE, TRUE, TRUE, 1),
  ('CI', '12', '{"fr": "Sursalaire", "en": "Additional Salary"}', 'base', TRUE, TRUE, FALSE, 2),
  ('CI', '21', '{"fr": "Prime d''ancienneté", "en": "Seniority Bonus"}', 'bonus', TRUE, TRUE, FALSE, 3),
  ('CI', '22', '{"fr": "Prime de transport", "en": "Transport Allowance"}', 'allowance', TRUE, TRUE, FALSE, 4);

-- Transport allowance with 30,000 FCFA threshold
UPDATE salary_component_definitions
SET tax_exempt_threshold = 30000
WHERE country_code = 'CI' AND code = '22';
```

---

## Event Store & Audit

### 14. Events (Immutable)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  aggregate_id UUID, -- Entity ID this event relates to

  -- Event data
  data JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Causation (event chain)
  correlation_id UUID, -- Groups related events
  causation_id UUID, -- Parent event that caused this

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- Prevent updates/deletes (append-only)
CREATE OR REPLACE FUNCTION prevent_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_event_update
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

CREATE INDEX idx_events_type ON events(event_type, created_at DESC);
CREATE INDEX idx_events_tenant ON events(tenant_id, created_at DESC);
CREATE INDEX idx_events_aggregate ON events(aggregate_id, created_at);
```

### 15. Audit Logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),

  -- Who
  user_id UUID REFERENCES users(id),
  user_email TEXT NOT NULL,

  -- What
  action TEXT NOT NULL, -- create, update, delete, approve, etc.
  entity_type TEXT NOT NULL, -- employee, payroll_run, etc.
  entity_id UUID,

  -- Changes
  old_values JSONB,
  new_values JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id UUID,

  -- When
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only
CREATE TRIGGER prevent_audit_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
```

---

## Workflow Engine

### 16. Workflows

```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL, -- Event that starts this workflow

  -- Workflow definition (state machine)
  definition JSONB NOT NULL, -- { states: [...], transitions: [...] }

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id)
);

-- RLS
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON workflows
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### 17. Workflow Instances

```sql
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id),

  -- Context
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  -- State
  current_state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, cancelled

  -- Data
  context JSONB NOT NULL DEFAULT '{}', -- Workflow variables

  -- Execution
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON workflow_instances
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(tenant_id, status);
```

---

## Utility Functions

```sql
-- Get current effective record
CREATE FUNCTION get_current_record(
  p_table_name TEXT,
  p_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS SETOF RECORD AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT * FROM %I WHERE id = $1 AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)',
    p_table_name
  ) USING p_id, p_as_of_date;
END;
$$ LANGUAGE plpgsql;

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Repeat for other tables...
```

---

## Verification Checklist

Before implementing, verify:

- [ ] All tenant-scoped tables have `tenant_id` column
- [ ] All tenant-scoped tables have RLS policy enabled
- [ ] Effective-dated tables have `(effective_from, effective_to)` with EXCLUDE constraint
- [ ] Immutable tables (events, audit_logs) have mutation prevention triggers
- [ ] All foreign keys have appropriate `ON DELETE` action
- [ ] Indexes exist for common query patterns
- [ ] JSONB columns have Zod validation in application layer

---

**Next:** Read `04-DOMAIN-MODELS.md` to understand business logic and validation rules.
