# Multi-Country Payroll Architecture
**Date:** October 2025
**Purpose:** Design flexible, country-agnostic payroll system for West Africa

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Principles](#design-principles)
3. [Database Schema](#database-schema)
4. [Component Architecture](#component-architecture)
5. [Configuration Management](#configuration-management)
6. [Calculation Engine](#calculation-engine)
7. [Adding New Countries](#adding-new-countries)
8. [Migration Strategy](#migration-strategy)
9. [Code Examples](#code-examples)

---

## Architecture Overview

### Current Problem

Our existing implementation is hardcoded for Côte d'Ivoire with:
- Fixed tax brackets in code
- Hardcoded contribution rates
- Country-specific logic scattered throughout
- No abstraction for different calculation methods
- Limited extensibility

### Target Solution

A flexible, rule-based system that:
- Supports multiple West African countries (Côte d'Ivoire, Senegal, Burkina Faso, Mali, Benin, Togo, Guinea)
- Configures tax brackets, social security schemes via database
- Abstracts calculation logic through strategy patterns
- Allows sector-specific variations
- Maintains historical accuracy (rates change over time)
- Supports country-specific terminology and rules

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                      │
│  (tRPC API, React Components, PDF Generation)               │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                    │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Payroll Service │  │  Calculation     │                │
│  │  Orchestrator    │→ │  Engine          │                │
│  └──────────────────┘  └──────────────────┘                │
│           ↓                      ↓                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Rule Engine     │  │  Component       │                │
│  │  (Strategy)      │  │  Aggregator      │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐                 │
│  │ Country  │  │  Tenant  │  │ Employee  │                 │
│  │ Rules    │  │  Config  │  │ Data      │                 │
│  └──────────┘  └──────────┘  └───────────┘                 │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                      Database (Postgres)                     │
│  country_rules, tax_brackets, social_schemes, etc.          │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principles

### 1. Configuration Over Code

**Bad (Current):**
```typescript
// Hardcoded in calculation service
const TAX_BRACKETS = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300000, max: 547000, rate: 0.10 },
  // ...
];
```

**Good (Target):**
```typescript
// Loaded from database based on country and effective date
const brackets = await getTaxBrackets({
  countryCode: 'CI',
  effectiveDate: payrollDate,
});
```

### 2. Country Abstraction

Each country is a configuration entity, not a separate codebase.

```typescript
interface CountryConfig {
  code: string;              // 'CI', 'SN', 'BF', etc.
  name: string;
  currency: string;          // 'XOF' (CFA), 'GNF', etc.
  taxSystem: string;         // 'ITS', 'IRPP', 'IUTS', etc.
  socialSecurityAgency: string;  // 'CNPS', 'CSS', 'INPS', etc.
  calculationMethod: 'progressive' | 'flat' | 'hybrid';
  supportsFamily Deductions: boolean;
}
```

### 3. Temporal Accuracy

Tax rates and social security contributions change over time. Always query by effective date.

```typescript
interface EffectiveDatedRule {
  id: string;
  effective_from: Date;
  effective_to: Date | null;  // null = current/active
  // ... rule data
}
```

### 4. Extensibility Through Strategy Pattern

Different countries have different calculation methods. Use strategy pattern to handle variations.

```typescript
interface TaxCalculationStrategy {
  calculate(input: TaxInput): TaxResult;
}

class ProgressiveTaxStrategy implements TaxCalculationStrategy {
  // Côte d'Ivoire, Senegal, etc.
}

class HybridTaxStrategy implements TaxCalculationStrategy {
  // Countries with mixed flat/progressive
}
```

### 5. Separation of Concerns

- **Rules:** What to calculate (brackets, rates, ceilings)
- **Calculation:** How to calculate (progressive, tiered, flat)
- **Aggregation:** Combining results (gross → net)
- **Presentation:** Formatting for display/PDF

---

## Database Schema

### Core Tables

#### 1. countries

Master table of supported countries.

```sql
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE,              -- 'CI', 'SN', 'BF', etc.
  name JSONB NOT NULL,                          -- {'fr': 'Côte d\'Ivoire', 'en': 'Ivory Coast'}
  currency_code VARCHAR(3) NOT NULL,            -- 'XOF', 'GNF'
  decimal_places INTEGER NOT NULL DEFAULT 0,    -- 0 for CFA, 2 for GNF
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed data
INSERT INTO countries (code, name, currency_code) VALUES
  ('CI', '{"fr": "Côte d''Ivoire", "en": "Ivory Coast"}', 'XOF'),
  ('SN', '{"fr": "Sénégal", "en": "Senegal"}', 'XOF'),
  ('BF', '{"fr": "Burkina Faso", "en": "Burkina Faso"}', 'XOF'),
  ('ML', '{"fr": "Mali", "en": "Mali"}', 'XOF'),
  ('BJ', '{"fr": "Bénin", "en": "Benin"}', 'XOF'),
  ('TG', '{"fr": "Togo", "en": "Togo"}', 'XOF'),
  ('GN', '{"fr": "Guinée", "en": "Guinea"}', 'GNF');
```

#### 2. tax_systems

Configuration for each country's tax system.

```sql
CREATE TABLE tax_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  name VARCHAR(100) NOT NULL,                   -- 'ITS', 'IRPP', 'IUTS'
  display_name JSONB NOT NULL,                  -- {'fr': 'Impôt sur les Traitements et Salaires'}
  calculation_method VARCHAR(50) NOT NULL,      -- 'progressive_monthly', 'progressive_annual'
  supports_family_deductions BOOLEAN NOT NULL DEFAULT FALSE,
  calculation_base VARCHAR(50) NOT NULL,        -- 'brut_imposable', 'net_imposable'
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_tax_systems_country_effective ON tax_systems(country_code, effective_from, effective_to);

-- Example: Côte d'Ivoire ITS (2024 reform)
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

#### 3. tax_brackets

Tax bracket definitions for each tax system.

```sql
CREATE TABLE tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_system_id UUID NOT NULL REFERENCES tax_systems(id) ON DELETE CASCADE,
  bracket_order INTEGER NOT NULL,               -- 1, 2, 3, etc.
  min_amount DECIMAL(15,2) NOT NULL,
  max_amount DECIMAL(15,2),                     -- NULL for last bracket (infinity)
  rate DECIMAL(5,4) NOT NULL,                   -- 0.16 = 16%, stored as decimal
  description JSONB,                            -- Optional bracket description

  CONSTRAINT chk_bracket_amounts CHECK (max_amount IS NULL OR max_amount > min_amount),
  CONSTRAINT chk_rate_valid CHECK (rate >= 0 AND rate <= 1),
  UNIQUE (tax_system_id, bracket_order)
);

CREATE INDEX idx_tax_brackets_system ON tax_brackets(tax_system_id, bracket_order);

-- Example: Côte d'Ivoire 6 brackets
INSERT INTO tax_brackets (tax_system_id, bracket_order, min_amount, max_amount, rate) VALUES
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 1, 0, 75000, 0),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 2, 75000, 240000, 0.16),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 3, 240000, 800000, 0.21),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 4, 800000, 2400000, 0.24),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 5, 2400000, 8000000, 0.28),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 6, 8000000, NULL, 0.32);
```

#### 4. family_deduction_rules

Family deductions for countries that support them.

```sql
CREATE TABLE family_deduction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_system_id UUID NOT NULL REFERENCES tax_systems(id) ON DELETE CASCADE,
  fiscal_parts DECIMAL(3,1) NOT NULL,           -- 1.0, 1.5, 2.0, etc.
  deduction_amount DECIMAL(15,2) NOT NULL,
  description JSONB,                            -- e.g., {'fr': 'Célibataire sans enfant'}

  UNIQUE (tax_system_id, fiscal_parts)
);

CREATE INDEX idx_family_deductions_system ON family_deduction_rules(tax_system_id);

-- Example: Côte d'Ivoire family deductions
INSERT INTO family_deduction_rules (tax_system_id, fiscal_parts, deduction_amount, description) VALUES
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 1.0, 0, '{"fr": "Célibataire sans enfant"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 1.5, 5500, '{"fr": "Marié sans enfant OU célibataire 1 enfant"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 2.0, 11000, '{"fr": "Marié 1 enfant OU célibataire 2 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 2.5, 16500, '{"fr": "Marié 2 enfants OU célibataire 3 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 3.0, 22000, '{"fr": "Marié 3 enfants OU célibataire 4 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 3.5, 27500, '{"fr": "Marié 4 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 4.0, 33000, '{"fr": "Marié 5 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 4.5, 38500, '{"fr": "Marié 6 enfants"}'),
  ((SELECT id FROM tax_systems WHERE country_code = 'CI' AND effective_to IS NULL), 5.0, 44000, '{"fr": "Marié 7+ enfants"}');
```

#### 5. social_security_schemes

Social security agency and scheme configuration.

```sql
CREATE TABLE social_security_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  agency_code VARCHAR(10) NOT NULL,             -- 'CNPS', 'CSS', 'INPS'
  agency_name JSONB NOT NULL,                   -- {'fr': 'Caisse Nationale de Prévoyance Sociale'}
  effective_from DATE NOT NULL,
  effective_to DATE,
  metadata JSONB,                               -- Additional country-specific config
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_social_schemes_country_effective ON social_security_schemes(country_code, effective_from, effective_to);

-- Example: Côte d'Ivoire CNPS
INSERT INTO social_security_schemes (country_code, agency_code, agency_name, effective_from)
VALUES (
  'CI',
  'CNPS',
  '{"fr": "Caisse Nationale de Prévoyance Sociale", "en": "National Social Security Fund"}',
  '2024-01-01'
);
```

#### 6. contribution_types

Types of social security contributions.

```sql
CREATE TABLE contribution_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES social_security_schemes(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,                    -- 'pension', 'family_benefits', 'work_accident', etc.
  name JSONB NOT NULL,                          -- {'fr': 'Retraite', 'en': 'Pension'}
  employee_rate DECIMAL(6,4),                   -- NULL if employer-only
  employer_rate DECIMAL(6,4),                   -- NULL if employee-only
  calculation_base VARCHAR(50) NOT NULL,        -- 'brut_imposable', 'salaire_categoriel', 'fixed'
  ceiling_amount DECIMAL(15,2),                 -- NULL if no ceiling
  ceiling_period VARCHAR(20),                   -- 'monthly', 'annual'
  fixed_amount DECIMAL(15,2),                   -- For fixed contributions (CMU)
  is_variable_by_sector BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,

  UNIQUE (scheme_id, code)
);

CREATE INDEX idx_contribution_types_scheme ON contribution_types(scheme_id);

-- Example: Côte d'Ivoire CNPS contributions
INSERT INTO contribution_types (scheme_id, code, name, employee_rate, employer_rate, calculation_base, ceiling_amount, ceiling_period, display_order) VALUES
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'CI' AND effective_to IS NULL),
    'pension',
    '{"fr": "Retraite", "en": "Pension"}',
    0.063,
    0.077,
    'brut_imposable',
    281250,  -- 3,375,000 annual / 12
    'monthly',
    1
  ),
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'CI' AND effective_to IS NULL),
    'family_benefits',
    '{"fr": "Prestations Familiales", "en": "Family Benefits"}',
    NULL,
    0.05,
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
    0.03,  -- Default, can be overridden by sector
    'salaire_categoriel',
    70000,
    'monthly',
    3
  );
```

#### 7. sector_contribution_overrides

Sector-specific contribution rate overrides (e.g., work accident rates).

```sql
CREATE TABLE sector_contribution_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_type_id UUID NOT NULL REFERENCES contribution_types(id) ON DELETE CASCADE,
  sector_code VARCHAR(50) NOT NULL,             -- 'services', 'industry', 'construction', etc.
  sector_name JSONB NOT NULL,
  employer_rate DECIMAL(6,4) NOT NULL,          -- Override rate for this sector
  risk_level VARCHAR(20),                       -- 'low', 'medium', 'high', 'very_high'

  UNIQUE (contribution_type_id, sector_code)
);

-- Example: Work accident rates by sector (Côte d'Ivoire)
INSERT INTO sector_contribution_overrides (contribution_type_id, sector_code, sector_name, employer_rate, risk_level) VALUES
  (
    (SELECT id FROM contribution_types WHERE code = 'work_accident' AND scheme_id IN (SELECT id FROM social_security_schemes WHERE country_code = 'CI')),
    'services',
    '{"fr": "Services/Commerce", "en": "Services/Commerce"}',
    0.02,
    'low'
  ),
  (
    (SELECT id FROM contribution_types WHERE code = 'work_accident' AND scheme_id IN (SELECT id FROM social_security_schemes WHERE country_code = 'CI')),
    'industry',
    '{"fr": "Industrie/Manufacture", "en": "Industry/Manufacturing"}',
    0.03,
    'medium'
  ),
  (
    (SELECT id FROM contribution_types WHERE code = 'work_accident' AND scheme_id IN (SELECT id FROM social_security_schemes WHERE country_code = 'CI')),
    'construction',
    '{"fr": "BTP/Construction", "en": "Construction"}',
    0.05,
    'very_high'
  );
```

#### 8. other_taxes

Other payroll-related taxes (training, etc.).

```sql
CREATE TABLE other_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  code VARCHAR(50) NOT NULL,                    -- 'fdfp_tap', 'fdfp_tfpc', 'anpe'
  name JSONB NOT NULL,
  tax_rate DECIMAL(6,4) NOT NULL,
  calculation_base VARCHAR(50) NOT NULL,        -- 'brut_imposable', 'total_brut'
  paid_by VARCHAR(20) NOT NULL,                 -- 'employer', 'employee', 'both'
  effective_from DATE NOT NULL,
  effective_to DATE,

  UNIQUE (country_code, code, effective_from)
);

-- Example: Côte d'Ivoire FDFP taxes
INSERT INTO other_taxes (country_code, code, name, tax_rate, calculation_base, paid_by, effective_from) VALUES
  (
    'CI',
    'fdfp_tap',
    '{"fr": "Taxe d''Apprentissage", "en": "Apprenticeship Tax"}',
    0.004,
    'brut_imposable',
    'employer',
    '2024-01-01'
  ),
  (
    'CI',
    'fdfp_tfpc',
    '{"fr": "Taxe Formation Professionnelle Continue", "en": "Continuous Professional Training Tax"}',
    0.012,
    'brut_imposable',
    'employer',
    '2024-01-01'
  );
```

#### 9. salary_component_definitions

Defines standard salary components and their treatment.

```sql
CREATE TABLE salary_component_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  code VARCHAR(10) NOT NULL,                    -- '11', '12', '21', '22'
  name JSONB NOT NULL,
  component_type VARCHAR(50) NOT NULL,          -- 'base', 'allowance', 'bonus', 'benefit_in_kind'
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_brut_imposable BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_salaire_categoriel BOOLEAN NOT NULL DEFAULT FALSE,
  tax_exempt_threshold DECIMAL(15,2),           -- e.g., 30000 for transport allowance
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  UNIQUE (country_code, code)
);

-- Example: Côte d'Ivoire salary components
INSERT INTO salary_component_definitions (country_code, code, name, component_type, is_taxable, include_in_brut_imposable, include_in_salaire_categoriel, display_order) VALUES
  ('CI', '11', '{"fr": "Salaire catégoriel", "en": "Base Salary"}', 'base', TRUE, TRUE, TRUE, 1),
  ('CI', '12', '{"fr": "Sursalaire", "en": "Additional Salary"}', 'base', TRUE, TRUE, FALSE, 2),
  ('CI', '21', '{"fr": "Prime d''ancienneté", "en": "Seniority Bonus"}', 'bonus', TRUE, TRUE, FALSE, 3),
  ('CI', '22', '{"fr": "Prime de transport", "en": "Transport Allowance"}', 'allowance', FALSE, FALSE, FALSE, 4);

-- Transport allowance with threshold
UPDATE salary_component_definitions
SET tax_exempt_threshold = 30000,
    is_taxable = TRUE  -- Taxable above threshold
WHERE country_code = 'CI' AND code = '22';
```

#### 10. Tenant Configuration

Add country and sector to tenant settings.

```sql
-- Modify existing tenants table
ALTER TABLE tenants
  ADD COLUMN country_code VARCHAR(2) REFERENCES countries(code),
  ADD COLUMN sector_code VARCHAR(50),
  ADD COLUMN default_fiscal_parts DECIMAL(3,1) DEFAULT 1.0;

CREATE INDEX idx_tenants_country ON tenants(country_code);
```

#### 11. Employee Extensions

Add payroll-specific fields to employees.

```sql
-- Modify existing employees table
ALTER TABLE employees
  ADD COLUMN fiscal_parts DECIMAL(3,1) DEFAULT 1.0,
  ADD COLUMN has_spouse BOOLEAN DEFAULT FALSE,
  ADD COLUMN dependent_children INTEGER DEFAULT 0,
  ADD COLUMN cmu_family_coverage BOOLEAN DEFAULT FALSE;

-- Or use custom_fields JSONB if you prefer flexibility
UPDATE employees SET custom_fields = jsonb_set(
  COALESCE(custom_fields, '{}'::jsonb),
  '{payroll}',
  '{"fiscal_parts": 1.0, "has_spouse": false, "dependent_children": 0}'::jsonb
);
```

---

## Component Architecture

### Service Layer Structure

```
src/features/payroll/
├── services/
│   ├── orchestrator.ts              # Main payroll run orchestration
│   ├── calculation-engine.ts        # Core calculation logic
│   ├── rule-loader.ts               # Load rules from DB
│   ├── tax-calculator.ts            # Tax calculation strategies
│   ├── social-calculator.ts         # Social security calculations
│   ├── component-aggregator.ts      # Aggregate salary components
│   └── rounding.ts                  # Country-specific rounding
├── strategies/
│   ├── tax/
│   │   ├── progressive-monthly.ts   # CI, BJ
│   │   ├── progressive-annual.ts    # (future use)
│   │   └── hybrid.ts                # (future use)
│   └── social/
│       ├── cnps-calculator.ts       # CI, BF, BJ, TG
│       ├── css-calculator.ts        # SN
│       └── inps-calculator.ts       # ML
├── models/
│   ├── country-config.ts            # Country configuration types
│   ├── tax-input.ts                 # Tax calculation input
│   ├── tax-result.ts                # Tax calculation result
│   └── payroll-result.ts            # Complete payroll result
├── repositories/
│   ├── country-rules.repository.ts  # Query country rules
│   ├── tax-brackets.repository.ts   # Query tax brackets
│   └── social-schemes.repository.ts # Query social security
└── utils/
    ├── date-helpers.ts              # Effective date queries
    ├── amount-helpers.ts            # Ceiling, rounding
    └── component-helpers.ts         # Salary component logic
```

---

## Configuration Management

### Country Rule Loader

```typescript
// src/features/payroll/services/rule-loader.ts

import { db } from '@/server/db';
import { eq, and, lte, or, isNull } from 'drizzle-orm';

export class RuleLoader {
  /**
   * Get active tax system for a country on a specific date
   */
  async getTaxSystem(countryCode: string, effectiveDate: Date) {
    const system = await db.query.tax_systems.findFirst({
      where: and(
        eq(tax_systems.country_code, countryCode),
        lte(tax_systems.effective_from, effectiveDate),
        or(
          isNull(tax_systems.effective_to),
          gte(tax_systems.effective_to, effectiveDate)
        )
      ),
      with: {
        brackets: {
          orderBy: [asc(tax_brackets.bracket_order)],
        },
        familyDeductions: true,
      },
    });

    if (!system) {
      throw new Error(`No tax system found for ${countryCode} on ${effectiveDate}`);
    }

    return system;
  }

  /**
   * Get social security scheme for a country
   */
  async getSocialScheme(countryCode: string, effectiveDate: Date) {
    const scheme = await db.query.social_security_schemes.findFirst({
      where: and(
        eq(social_security_schemes.country_code, countryCode),
        lte(social_security_schemes.effective_from, effectiveDate),
        or(
          isNull(social_security_schemes.effective_to),
          gte(social_security_schemes.effective_to, effectiveDate)
        )
      ),
      with: {
        contributionTypes: {
          with: {
            sectorOverrides: true,
          },
        },
      },
    });

    if (!scheme) {
      throw new Error(`No social security scheme found for ${countryCode}`);
    }

    return scheme;
  }

  /**
   * Get other taxes (FDFP, etc.)
   */
  async getOtherTaxes(countryCode: string, effectiveDate: Date) {
    return await db.query.other_taxes.findMany({
      where: and(
        eq(other_taxes.country_code, countryCode),
        lte(other_taxes.effective_from, effectiveDate),
        or(
          isNull(other_taxes.effective_to),
          gte(other_taxes.effective_to, effectiveDate)
        )
      ),
    });
  }

  /**
   * Get complete country configuration
   */
  async getCountryConfig(countryCode: string, effectiveDate: Date) {
    const [country, taxSystem, socialScheme, otherTaxes] = await Promise.all([
      db.query.countries.findFirst({ where: eq(countries.code, countryCode) }),
      this.getTaxSystem(countryCode, effectiveDate),
      this.getSocialScheme(countryCode, effectiveDate),
      this.getOtherTaxes(countryCode, effectiveDate),
    ]);

    return {
      country: country!,
      taxSystem,
      socialScheme,
      otherTaxes,
    };
  }
}
```

---

## Calculation Engine

### Tax Calculation Strategy

```typescript
// src/features/payroll/strategies/tax/progressive-monthly.ts

export interface TaxInput {
  taxableIncome: number;
  fiscalParts?: number;
  countryCode: string;
}

export interface TaxResult {
  grossTax: number;
  familyDeduction: number;
  netTax: number;
  effectiveRate: number;
  bracketBreakdown: BracketResult[];
}

export interface BracketResult {
  bracketOrder: number;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
  taxableInBracket: number;
  taxAmount: number;
}

export class ProgressiveMonthlyTaxStrategy {
  constructor(
    private brackets: TaxBracket[],
    private familyDeductions: FamilyDeductionRule[]
  ) {}

  calculate(input: TaxInput): TaxResult {
    const bracketBreakdown: BracketResult[] = [];
    let remainingIncome = input.taxableIncome;
    let totalTax = 0;

    // Calculate progressive tax
    for (const bracket of this.brackets) {
      if (remainingIncome <= 0) break;

      const bracketMin = bracket.min_amount;
      const bracketMax = bracket.max_amount ?? Infinity;
      const bracketSize = bracketMax - bracketMin;

      const taxableInBracket = Math.min(remainingIncome, bracketSize);
      const taxForBracket = taxableInBracket * bracket.rate;

      bracketBreakdown.push({
        bracketOrder: bracket.bracket_order,
        minAmount: bracketMin,
        maxAmount: bracket.max_amount,
        rate: bracket.rate,
        taxableInBracket,
        taxAmount: taxForBracket,
      });

      totalTax += taxForBracket;
      remainingIncome -= taxableInBracket;
    }

    // Apply family deduction
    const familyDeduction = this.getFamilyDeduction(input.fiscalParts ?? 1.0);
    const netTax = Math.max(0, totalTax - familyDeduction);

    return {
      grossTax: totalTax,
      familyDeduction,
      netTax,
      effectiveRate: input.taxableIncome > 0 ? (netTax / input.taxableIncome) : 0,
      bracketBreakdown,
    };
  }

  private getFamilyDeduction(fiscalParts: number): number {
    const rule = this.familyDeductions.find(r => r.fiscal_parts === fiscalParts);
    return rule?.deduction_amount ?? 0;
  }
}
```

### Social Security Calculator

```typescript
// src/features/payroll/services/social-calculator.ts

export interface SocialSecurityInput {
  brutImposable: number;
  salaireCategoriel: number;
  sectorCode?: string;
}

export interface SocialSecurityResult {
  contributions: ContributionResult[];
  totalEmployee: number;
  totalEmployer: number;
}

export interface ContributionResult {
  code: string;
  name: string;
  base: number;
  employeeRate: number;
  employerRate: number;
  employeeAmount: number;
  employerAmount: number;
  ceiling?: number;
}

export class SocialSecurityCalculator {
  constructor(
    private scheme: SocialSecurityScheme,
    private sectorCode?: string
  ) {}

  calculate(input: SocialSecurityInput): SocialSecurityResult {
    const contributions: ContributionResult[] = [];

    for (const contributionType of this.scheme.contributionTypes) {
      // Determine calculation base
      let base = 0;
      switch (contributionType.calculation_base) {
        case 'brut_imposable':
          base = input.brutImposable;
          break;
        case 'salaire_categoriel':
          base = input.salaireCategoriel;
          break;
        case 'fixed':
          base = contributionType.fixed_amount ?? 0;
          break;
      }

      // Apply ceiling if applicable
      if (contributionType.ceiling_amount) {
        base = Math.min(base, contributionType.ceiling_amount);
      }

      // Get rates (check for sector override)
      let employerRate = contributionType.employer_rate ?? 0;

      if (contributionType.is_variable_by_sector && this.sectorCode) {
        const override = contributionType.sectorOverrides?.find(
          o => o.sector_code === this.sectorCode
        );
        if (override) {
          employerRate = override.employer_rate;
        }
      }

      const employeeRate = contributionType.employee_rate ?? 0;

      contributions.push({
        code: contributionType.code,
        name: contributionType.name,
        base,
        employeeRate,
        employerRate,
        employeeAmount: base * employeeRate,
        employerAmount: base * employerRate,
        ceiling: contributionType.ceiling_amount,
      });
    }

    return {
      contributions,
      totalEmployee: contributions.reduce((sum, c) => sum + c.employeeAmount, 0),
      totalEmployer: contributions.reduce((sum, c) => sum + c.employerAmount, 0),
    };
  }
}
```

### Payroll Calculation Orchestrator

```typescript
// src/features/payroll/services/orchestrator.ts

export interface PayrollCalculationInput {
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  salaryComponents: SalaryComponent[];
  fiscalParts?: number;
  sectorCode?: string;
}

export interface PayrollResult {
  // Earnings
  salaryComponents: SalaryComponentResult[];
  totalBrut: number;
  brutImposable: number;
  salaireCategoriel: number;

  // Tax
  tax: TaxResult;

  // Social security
  socialSecurity: SocialSecurityResult;

  // Other taxes
  otherTaxes: OtherTaxResult[];

  // Totals
  totalEmployeeDeductions: number;
  totalEmployerCosts: number;
  netSalary: number;
}

export class PayrollOrchestrator {
  constructor(
    private ruleLoader: RuleLoader,
    private componentAggregator: ComponentAggregator,
    private taxCalculator: TaxCalculator,
    private socialCalculator: SocialCalculator
  ) {}

  async calculate(input: PayrollCalculationInput): Promise<PayrollResult> {
    // 1. Load country configuration
    const tenant = await this.getTenant(input.employeeId);
    const config = await this.ruleLoader.getCountryConfig(
      tenant.country_code,
      input.periodEnd
    );

    // 2. Aggregate salary components
    const componentResults = await this.componentAggregator.aggregate(
      input.salaryComponents,
      config.country.code
    );

    const totalBrut = componentResults.reduce((sum, c) => sum + c.amount, 0);
    const brutImposable = componentResults
      .filter(c => c.includeInBrutImposable)
      .reduce((sum, c) => sum + c.amount, 0);
    const salaireCategoriel = componentResults
      .filter(c => c.includeInSalaireCategoriel)
      .reduce((sum, c) => sum + c.amount, 0);

    // 3. Calculate social security
    const socialResult = this.socialCalculator.calculate({
      brutImposable,
      salaireCategoriel,
      sectorCode: input.sectorCode ?? tenant.sector_code,
    }, config.socialScheme);

    // 4. Calculate taxable income
    const taxableIncome = brutImposable - socialResult.totalEmployee;

    // 5. Calculate tax
    const taxResult = this.taxCalculator.calculate({
      taxableIncome,
      fiscalParts: input.fiscalParts ?? 1.0,
      countryCode: tenant.country_code,
    }, config.taxSystem);

    // 6. Calculate other taxes (FDFP, etc.)
    const otherTaxResults = this.calculateOtherTaxes(
      brutImposable,
      config.otherTaxes
    );

    // 7. Calculate totals
    const totalEmployeeDeductions =
      socialResult.totalEmployee + taxResult.netTax;

    const totalEmployerCosts =
      totalBrut +
      socialResult.totalEmployer +
      otherTaxResults.reduce((sum, t) => sum + t.amount, 0);

    const netSalary = this.roundAmount(
      totalBrut - totalEmployeeDeductions,
      config.country.code
    );

    return {
      salaryComponents: componentResults,
      totalBrut,
      brutImposable,
      salaireCategoriel,
      tax: taxResult,
      socialSecurity: socialResult,
      otherTaxes: otherTaxResults,
      totalEmployeeDeductions,
      totalEmployerCosts,
      netSalary,
    };
  }

  private roundAmount(amount: number, countryCode: string): number {
    // Côte d'Ivoire: round to nearest 10 FCFA
    if (countryCode === 'CI') {
      return Math.round(amount / 10) * 10;
    }

    // Default: round to 2 decimals
    return Math.round(amount * 100) / 100;
  }

  private calculateOtherTaxes(base: number, taxes: OtherTax[]): OtherTaxResult[] {
    return taxes.map(tax => ({
      code: tax.code,
      name: tax.name,
      rate: tax.tax_rate,
      base,
      amount: base * tax.tax_rate,
      paidBy: tax.paid_by,
    }));
  }
}
```

---

## Adding New Countries

### Step-by-Step Guide: Adding Senegal

#### Step 1: Add Country Record

```sql
-- Already exists from seed data
SELECT * FROM countries WHERE code = 'SN';
```

#### Step 2: Configure Tax System

```sql
-- Add IRPP tax system for Senegal
INSERT INTO tax_systems (
  country_code,
  name,
  display_name,
  calculation_method,
  supports_family_deductions,
  calculation_base,
  effective_from
) VALUES (
  'SN',
  'IRPP',
  '{"fr": "Impôt sur le Revenu des Personnes Physiques", "en": "Personal Income Tax"}',
  'progressive_annual',  -- Senegal uses annual calculation
  FALSE,                  -- Uses 30% deduction instead
  'brut_imposable',
  '2024-01-01'
);

-- Add tax brackets (example - verify actual Senegal rates)
INSERT INTO tax_brackets (tax_system_id, bracket_order, min_amount, max_amount, rate)
SELECT
  id as tax_system_id,
  bracket_order,
  min_amount,
  max_amount,
  rate
FROM (VALUES
  ((SELECT id FROM tax_systems WHERE country_code = 'SN'), 1, 0, 630000, 0),
  ((SELECT id FROM tax_systems WHERE country_code = 'SN'), 2, 630000, 1500000, 0.20),
  ((SELECT id FROM tax_systems WHERE country_code = 'SN'), 3, 1500000, 4000000, 0.30),
  ((SELECT id FROM tax_systems WHERE country_code = 'SN'), 4, 4000000, NULL, 0.40)
) AS brackets(tax_system_id, bracket_order, min_amount, max_amount, rate);
```

#### Step 3: Configure Social Security (CSS + IPRES + IPM)

```sql
-- Add CSS scheme
INSERT INTO social_security_schemes (country_code, agency_code, agency_name, effective_from)
VALUES (
  'SN',
  'CSS',
  '{"fr": "Caisse de Sécurité Sociale", "en": "Social Security Fund"}',
  '2024-01-01'
);

-- Add CSS contribution types
INSERT INTO contribution_types (scheme_id, code, name, employee_rate, employer_rate, calculation_base, ceiling_amount, ceiling_period)
VALUES
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'SN' AND agency_code = 'CSS'),
    'health',
    '{"fr": "Maladie", "en": "Health"}',
    NULL,
    0.06,
    'brut_imposable',
    63000,
    'monthly'
  );

-- Add IPRES scheme (separate pension system)
INSERT INTO social_security_schemes (country_code, agency_code, agency_name, effective_from)
VALUES (
  'SN',
  'IPRES',
  '{"fr": "Institution de Prévoyance Retraite du Sénégal", "en": "Retirement Fund"}',
  '2024-01-01'
);

-- Add IPRES contributions
INSERT INTO contribution_types (scheme_id, code, name, employee_rate, employer_rate, calculation_base)
VALUES
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'SN' AND agency_code = 'IPRES'),
    'retirement_general',
    '{"fr": "Retraite générale", "en": "General Retirement"}',
    0.056,
    0.084,
    'brut_imposable'
  ),
  (
    (SELECT id FROM social_security_schemes WHERE country_code = 'SN' AND agency_code = 'IPRES'),
    'retirement_executive',
    '{"fr": "Retraite complémentaire cadres", "en": "Executive Retirement"}',
    0.03,
    0.03,
    'brut_imposable'
  );
```

#### Step 4: Update Tenant

```sql
-- Set tenant to Senegal
UPDATE tenants
SET
  country_code = 'SN',
  sector_code = 'services'
WHERE id = '<tenant-id>';
```

#### Step 5: Create Senegal-Specific Strategy (if needed)

```typescript
// src/features/payroll/strategies/tax/senegal-irpp.ts

export class SenegalIRPPStrategy implements TaxCalculationStrategy {
  calculate(input: TaxInput): TaxResult {
    // Senegal uses 30% standard deduction
    const deductedIncome = input.taxableIncome * 0.70;

    // Then apply progressive brackets to deducted income
    // ... (similar to ProgressiveMonthlyTaxStrategy)
  }
}
```

#### Step 6: Register Strategy

```typescript
// src/features/payroll/services/tax-calculator.ts

export class TaxCalculator {
  private strategies: Map<string, TaxCalculationStrategy> = new Map();

  constructor() {
    this.strategies.set('progressive_monthly', new ProgressiveMonthlyTaxStrategy());
    this.strategies.set('progressive_annual', new ProgressiveAnnualTaxStrategy());
    this.strategies.set('senegal_irpp', new SenegalIRPPStrategy());
  }

  calculate(input: TaxInput, taxSystem: TaxSystem): TaxResult {
    let strategyKey = taxSystem.calculation_method;

    // Country-specific override
    if (taxSystem.country_code === 'SN') {
      strategyKey = 'senegal_irpp';
    }

    const strategy = this.strategies.get(strategyKey);
    if (!strategy) {
      throw new Error(`Tax strategy not found: ${strategyKey}`);
    }

    return strategy.calculate(input, taxSystem.brackets, taxSystem.familyDeductions);
  }
}
```

#### Step 7: Test

```typescript
// tests/payroll/senegal.test.ts

describe('Senegal IRPP Calculation', () => {
  it('should calculate tax with 30% deduction', async () => {
    const result = await payrollOrchestrator.calculate({
      employeeId: 'sn-employee-1',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      salaryComponents: [
        { code: '11', amount: 500000 },
      ],
    });

    // Verify Senegal-specific calculations
    expect(result.tax.name).toBe('IRPP');
    // ... more assertions
  });
});
```

**That's it!** Senegal is now supported. No code changes required beyond strategy registration.

---

## Migration Strategy

### Phase 1: Add Database Schema (Week 1)

1. Create migration for new tables
2. Seed with Côte d'Ivoire data
3. Deploy schema changes
4. No functionality changes yet

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit push
```

### Phase 2: Implement Rule Loader (Week 2)

1. Create RuleLoader service
2. Update calculation services to use RuleLoader
3. Maintain backward compatibility
4. Add feature flag for new system

```typescript
// Feature flag approach
const USE_RULE_ENGINE = process.env.FEATURE_PAYROLL_RULE_ENGINE === 'true';

if (USE_RULE_ENGINE) {
  const config = await ruleLoader.getCountryConfig('CI', periodEnd);
  // Use new system
} else {
  // Use old hardcoded system
}
```

### Phase 3: Migrate Calculations (Week 3-4)

1. Tax calculation → use database brackets
2. Social security → use database schemes
3. Add FDFP taxes (missing)
4. Fix family deductions
5. Update tests

### Phase 4: Validate & Test (Week 5)

1. Compare old vs new calculations
2. Ensure identical results for Côte d'Ivoire
3. Test edge cases
4. Performance testing

### Phase 5: Deploy & Monitor (Week 6)

1. Enable feature flag for pilot tenants
2. Monitor for discrepancies
3. Gradually roll out to all tenants
4. Remove old code

### Phase 6: Add Second Country (Week 7+)

1. Configure Senegal (or Burkina Faso)
2. Create tenant in Senegal
3. Test end-to-end
4. Document process

---

## Code Examples

### Example 1: Complete Payroll Calculation (Côte d'Ivoire)

```typescript
import { PayrollOrchestrator } from '@/features/payroll/services/orchestrator';

const orchestrator = new PayrollOrchestrator(
  new RuleLoader(),
  new ComponentAggregator(),
  new TaxCalculator(),
  new SocialSecurityCalculator()
);

const result = await orchestrator.calculate({
  employeeId: 'emp-001',
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-01-31'),
  salaryComponents: [
    { code: '11', amount: 75000 },    // Salaire catégoriel
    { code: '21', amount: 15000 },    // Prime d'ancienneté
    { code: '22', amount: 25000 },    // Prime de transport
  ],
  fiscalParts: 2.0,  // Married with 1 child
  sectorCode: 'services',
});

console.log({
  totalBrut: result.totalBrut,                    // 115,000
  brutImposable: result.brutImposable,            // 90,000 (excludes transport)
  salaireCategoriel: result.salaireCategoriel,    // 75,000

  cnpsPension: result.socialSecurity.contributions.find(c => c.code === 'pension'),
  // { employeeAmount: 5,670, employerAmount: 6,930 }

  familyBenefits: result.socialSecurity.contributions.find(c => c.code === 'family_benefits'),
  // { employeeAmount: 0, employerAmount: 3,750 }

  tax: result.tax.netTax,                         // ~2,400 (with family deduction)
  fdfpTaxes: result.otherTaxes,                   // TAP + TFPC

  netSalary: result.netSalary,                    // ~106,930 (rounded to 10)
  totalEmployerCost: result.totalEmployerCosts,   // ~126,000
});
```

### Example 2: Querying Tax Brackets

```typescript
import { RuleLoader } from '@/features/payroll/services/rule-loader';

const loader = new RuleLoader();

// Get tax system for Côte d'Ivoire on January 31, 2025
const taxSystem = await loader.getTaxSystem('CI', new Date('2025-01-31'));

console.log(taxSystem.brackets);
// [
//   { bracket_order: 1, min_amount: 0, max_amount: 75000, rate: 0 },
//   { bracket_order: 2, min_amount: 75000, max_amount: 240000, rate: 0.16 },
//   { bracket_order: 3, min_amount: 240000, max_amount: 800000, rate: 0.21 },
//   ...
// ]
```

### Example 3: Admin Updating Tax Rates

```typescript
// tRPC admin procedure
payroll.admin.updateTaxBracket
  .input(z.object({
    countryCode: z.string(),
    effectiveFrom: z.date(),
    brackets: z.array(z.object({
      bracketOrder: z.number(),
      minAmount: z.number(),
      maxAmount: z.number().nullable(),
      rate: z.number().min(0).max(1),
    })),
  }))
  .mutation(async ({ input, ctx }) => {
    // Require super admin
    if (!ctx.user.isSuperAdmin) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    // End current tax system
    await db.update(tax_systems)
      .set({ effective_to: input.effectiveFrom })
      .where(
        and(
          eq(tax_systems.country_code, input.countryCode),
          isNull(tax_systems.effective_to)
        )
      );

    // Create new tax system
    const newSystem = await db.insert(tax_systems).values({
      country_code: input.countryCode,
      name: 'ITS',  // Get from current system
      // ... copy other fields
      effective_from: input.effectiveFrom,
      effective_to: null,
    }).returning();

    // Create new brackets
    await db.insert(tax_brackets).values(
      input.brackets.map(b => ({
        tax_system_id: newSystem[0].id,
        bracket_order: b.bracketOrder,
        min_amount: b.minAmount,
        max_amount: b.maxAmount,
        rate: b.rate,
      }))
    );

    // Audit log
    await logChange({
      userId: ctx.user.id,
      action: 'update_tax_brackets',
      entityType: 'tax_system',
      entityId: newSystem[0].id,
      changes: input.brackets,
    });

    return newSystem[0];
  });
```

---

## Summary

This architecture provides:

1. **Flexibility:** Add countries via configuration, not code
2. **Correctness:** Use official tax brackets and rates from database
3. **Maintainability:** Centralized rule management
4. **Extensibility:** Strategy pattern for country-specific logic
5. **Temporal Accuracy:** Historical rates preserved with effective dates
6. **Auditability:** All changes logged
7. **Testability:** Easy to test with different configurations

### Key Benefits

- **Add Senegal in 1 hour** (just database config)
- **Update tax rates** without deploying code
- **Historical accuracy** for past payroll periods
- **Sector variations** handled elegantly
- **Multi-currency** support built-in

### Implementation Effort

| Phase | Effort | Status |
|-------|--------|--------|
| Database schema | 2 days | Not started |
| Rule loader | 2 days | Not started |
| Migration to new system | 5 days | Not started |
| Testing & validation | 3 days | Not started |
| Add 2nd country | 1 day | Not started |
| **Total** | **~2 weeks** | |

---

**Next Steps:**

1. Review architecture with team
2. Create database migration
3. Implement RuleLoader
4. Migrate tax calculations
5. Add FDFP taxes
6. Test thoroughly
7. Deploy to staging
8. Add Senegal as pilot

---

**Document Version:** 1.0
**Last Updated:** October 2025
**Author:** Architecture Team
