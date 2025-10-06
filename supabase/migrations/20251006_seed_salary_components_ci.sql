-- Seed Migration: Standard Salary Components for Côte d'Ivoire
-- Date: 2025-10-06
-- Purpose: Populate standard components, templates, and sector configs for CI

-- 1. Insert Standard Components for Côte d'Ivoire (codes from official sources)
INSERT INTO salary_component_definitions (country_code, code, name, category, component_type, is_taxable, is_subject_to_social_security, calculation_method, display_order, is_common, metadata)
VALUES
  -- Code 11: Salaire de base (Base salary)
  ('CI', '11', '{"fr": "Salaire de base", "en": "Base salary"}', 'allowance', 'base', true, true, 'fixed', 1, true, '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": true
    },
    "isRequired": true
  }'),

  -- Code 21: Prime d'ancienneté (Seniority bonus - auto-calculated)
  ('CI', '21', '{"fr": "Prime d''ancienneté", "en": "Seniority bonus"}', 'bonus', 'seniority', true, true, 'formula', 2, true, '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "autoCalculated": true,
    "formula": "yearsOfService * 0.02 * baseSalary",
    "maxRate": 0.25,
    "description": "2% per year, max 25% after 12.5 years"
  }'),

  -- Code 22: Prime de transport (Transport allowance - tax-exempt up to 30,000)
  ('CI', '22', '{"fr": "Prime de transport", "en": "Transport allowance"}', 'allowance', 'transport', false, false, 'fixed', 3, true, '{
    "taxTreatment": {
      "isTaxable": false,
      "exemptionCap": 30000,
      "description": "Tax-exempt up to 30,000 FCFA/month"
    }
  }'),

  -- Code 23: Avantage en nature - Logement (Housing allowance)
  ('CI', '23', '{"fr": "Indemnité de logement", "en": "Housing allowance"}', 'allowance', 'housing', true, true, 'fixed', 4, true, '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    }
  }'),

  -- Code 24: Avantage en nature - Autres (Meal and other benefits)
  ('CI', '24', '{"fr": "Indemnité de repas", "en": "Meal allowance"}', 'allowance', 'meal', true, true, 'fixed', 5, true, '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    }
  }')

ON CONFLICT (country_code, code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 2. Insert Component Templates (Popular custom components)
INSERT INTO salary_component_templates (country_code, code, name, description, category, metadata, suggested_amount, is_popular, display_order)
VALUES
  -- Phone allowance
  ('CI', 'PHONE', '{"fr": "Prime de téléphone", "en": "Phone allowance"}',
   'Indemnité pour frais de téléphone professionnel',
   'allowance',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   10000, true, 1),

  -- Performance bonus
  ('CI', 'PERFORMANCE', '{"fr": "Prime de performance", "en": "Performance bonus"}',
   'Prime basée sur la performance individuelle',
   'bonus',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   25000, true, 2),

  -- Responsibility allowance
  ('CI', 'RESPONSIBILITY', '{"fr": "Prime de responsabilité", "en": "Responsibility allowance"}',
   'Prime pour postes de responsabilité',
   'allowance',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   50000, true, 3),

  -- Travel expenses
  ('CI', 'TRAVEL', '{"fr": "Frais de déplacement", "en": "Travel expenses"}',
   'Indemnité pour déplacements professionnels',
   'allowance',
   '{
     "taxTreatment": {
       "isTaxable": false,
       "exemptionCap": 50000
     }
   }',
   20000, true, 4),

  -- Overtime bonus
  ('CI', 'OVERTIME_BONUS', '{"fr": "Prime heures supplémentaires", "en": "Overtime bonus"}',
   'Majoration pour heures supplémentaires',
   'bonus',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   15000, true, 5),

  -- Night shift premium
  ('CI', 'NIGHT_SHIFT', '{"fr": "Prime de nuit", "en": "Night shift premium"}',
   'Prime pour travail de nuit',
   'bonus',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   12000, false, 6),

  -- End of year bonus
  ('CI', 'YEAR_END', '{"fr": "Prime de fin d''année", "en": "Year-end bonus"}',
   'Prime de gratification annuelle',
   'bonus',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   100000, true, 7),

  -- Hazard pay
  ('CI', 'HAZARD_PAY', '{"fr": "Prime de risque", "en": "Hazard pay"}',
   'Indemnité pour conditions de travail dangereuses',
   'allowance',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   30000, false, 8),

  -- Retention bonus
  ('CI', 'RETENTION', '{"fr": "Prime de fidélité", "en": "Retention bonus"}',
   'Prime pour encourager la rétention des employés',
   'bonus',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   40000, false, 9),

  -- Internet allowance
  ('CI', 'INTERNET', '{"fr": "Forfait internet", "en": "Internet allowance"}',
   'Indemnité pour abonnement internet',
   'allowance',
   '{
     "taxTreatment": {
       "isTaxable": true,
       "includeInBrutImposable": true,
       "includeInSalaireCategoriel": false
     }
   }',
   8000, true, 10)

ON CONFLICT (country_code, code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  suggested_amount = EXCLUDED.suggested_amount,
  updated_at = NOW();

-- 3. Insert Sector Configurations for Côte d'Ivoire
INSERT INTO sector_configurations (country_code, sector_code, name, work_accident_rate, default_components, smart_defaults)
VALUES
  -- Services/Commerce sector
  ('CI', 'SERVICES', '{"fr": "Services/Commerce", "en": "Services/Commerce"}',
   0.0200,  -- 2% work accident rate
   '{
     "commonComponents": ["11", "22", "23"],
     "excludedComponents": ["24"]
   }',
   '{
     "baseSalary": 150000,
     "housingAllowance": 30000,
     "transportAllowance": 25000
   }'),

  -- Construction/BTP sector
  ('CI', 'CONSTRUCTION', '{"fr": "BTP/Construction", "en": "Construction"}',
   0.0500,  -- 5% work accident rate (higher risk)
   '{
     "commonComponents": ["11", "22", "23", "HAZARD_PAY"],
     "excludedComponents": []
   }',
   '{
     "baseSalary": 200000,
     "housingAllowance": 40000,
     "transportAllowance": 30000,
     "hazardPay": 30000
   }'),

  -- Agriculture sector
  ('CI', 'AGRICULTURE', '{"fr": "Agriculture", "en": "Agriculture"}',
   0.0250,  -- 2.5% work accident rate
   '{
     "commonComponents": ["11", "22"],
     "excludedComponents": ["23", "24"]
   }',
   '{
     "baseSalary": 120000,
     "transportAllowance": 20000
   }'),

  -- Industry sector
  ('CI', 'INDUSTRY', '{"fr": "Industrie", "en": "Industry"}',
   0.0300,  -- 3% work accident rate
   '{
     "commonComponents": ["11", "22", "23", "24"],
     "excludedComponents": []
   }',
   '{
     "baseSalary": 180000,
     "housingAllowance": 35000,
     "transportAllowance": 25000,
     "mealAllowance": 15000
   }')

ON CONFLICT (country_code, sector_code) DO UPDATE SET
  work_accident_rate = EXCLUDED.work_accident_rate,
  default_components = EXCLUDED.default_components,
  smart_defaults = EXCLUDED.smart_defaults,
  updated_at = NOW();
