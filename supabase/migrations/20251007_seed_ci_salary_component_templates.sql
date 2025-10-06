-- Migration: Seed Côte d'Ivoire salary component templates
-- Purpose: Add 30+ pre-configured templates with compliance levels
-- Date: 2025-10-07

-- ========================================================================
-- 1. Locked Templates (Mandatory - Cannot customize)
-- ========================================================================

-- Seniority Bonus (Prime d'ancienneté)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_SENIORITY_BONUS',
  '{"fr": "Prime d''ancienneté"}',
  'Calculée automatiquement selon l''ancienneté (2% par an, max 12%)',
  'bonus',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": true
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "auto-calculated",
      "rate": 0.02,
      "cap": 0.12
    }
  }',
  NULL,
  true,
  1,
  'locked',
  'Convention Collective Article 16',
  '[]'::jsonb,
  false,
  false
);

-- ========================================================================
-- 2. Configurable Templates (Within Legal Bounds)
-- ========================================================================

-- Housing Allowance (Indemnité de logement) - 20-30%
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_HOUSING_CI',
  '{"fr": "Indemnité de logement"}',
  'Entre 20% et 30% du salaire de base (recommandé: 25%)',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "percentage",
      "rate": 0.25
    }
  }',
  NULL,
  true,
  10,
  'configurable',
  'Convention Collective Article 20',
  '["calculationRule.rate"]'::jsonb,
  true,
  true
);

-- Transport Allowance (Indemnité de transport) - Max 30,000 tax-exempt
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_TRANSPORT_CI',
  '{"fr": "Indemnité de transport"}',
  'Maximum 30,000 FCFA exonéré d''impôt',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false,
      "exemptionCap": 30000
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    },
    "calculationRule": {
      "type": "fixed",
      "baseAmount": 30000
    }
  }',
  30000,
  true,
  11,
  'configurable',
  'Convention Collective Article 20',
  '["calculationRule.baseAmount"]'::jsonb,
  true,
  true
);

-- Hazard Pay (Prime de risque/pénibilité) - 15-25%
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_HAZARD_PAY_CI',
  '{"fr": "Prime de pénibilité"}',
  'Entre 15% et 25% du salaire de base (conditions dangereuses)',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "percentage",
      "rate": 0.20
    }
  }',
  NULL,
  false,
  12,
  'configurable',
  'Convention Collective Article 18',
  '["calculationRule.rate"]'::jsonb,
  true,
  true
);

-- ========================================================================
-- 3. Freeform Templates (Full Flexibility)
-- ========================================================================

-- Remote Work Allowance (Indemnité de télétravail)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_REMOTE_WORK',
  '{"fr": "Indemnité de télétravail"}',
  'Prime pour frais de télétravail (internet, électricité)',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "fixed",
      "baseAmount": 20000
    }
  }',
  20000,
  true,
  20,
  'freeform',
  NULL,
  '["calculationRule.baseAmount"]'::jsonb,
  true,
  true
);

-- Phone Allowance (Indemnité de téléphone)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_PHONE_ALLOWANCE',
  '{"fr": "Indemnité de téléphone"}',
  'Forfait téléphonique professionnel',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "fixed",
      "baseAmount": 15000
    }
  }',
  15000,
  true,
  21,
  'freeform',
  NULL,
  '["calculationRule.baseAmount"]'::jsonb,
  true,
  true
);

-- Meal Allowance (Indemnité de panier)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_MEAL_ALLOWANCE',
  '{"fr": "Indemnité de panier"}',
  'Prime de repas ou de panier',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "fixed",
      "baseAmount": 25000
    }
  }',
  25000,
  true,
  22,
  'freeform',
  NULL,
  '["calculationRule.baseAmount"]'::jsonb,
  true,
  true
);

-- Performance Bonus (Prime de performance)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_PERFORMANCE_BONUS',
  '{"fr": "Prime de performance"}',
  'Prime variable basée sur les objectifs atteints',
  'bonus',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "percentage",
      "rate": 0.10
    }
  }',
  NULL,
  true,
  30,
  'freeform',
  NULL,
  '["calculationRule.rate", "calculationRule.baseAmount"]'::jsonb,
  true,
  true
);

-- Education Allowance (Prime de scolarité)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_EDUCATION_ALLOWANCE',
  '{"fr": "Prime de scolarité"}',
  'Aide à la scolarité des enfants',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "fixed",
      "baseAmount": 50000
    }
  }',
  50000,
  false,
  40,
  'freeform',
  NULL,
  '["calculationRule.baseAmount"]'::jsonb,
  true,
  true
);

-- Overtime Compensation (Heures supplémentaires)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_OVERTIME',
  '{"fr": "Heures supplémentaires"}',
  'Paiement des heures supplémentaires (taux majoré)',
  'bonus',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "auto-calculated",
      "rate": 1.15
    }
  }',
  NULL,
  true,
  5,
  'freeform',
  'Convention Collective Article 25',
  '[]'::jsonb,
  true,
  false
);

-- Seniority Leave Bonus (Congés d'ancienneté)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_SENIORITY_LEAVE',
  '{"fr": "Congés d''ancienneté"}',
  'Jours de congés supplémentaires selon ancienneté',
  'bonus',
  '{
    "taxTreatment": {
      "isTaxable": false,
      "includeInBrutImposable": false,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    },
    "calculationRule": {
      "type": "auto-calculated"
    }
  }',
  NULL,
  false,
  50,
  'freeform',
  'Convention Collective Article 28',
  '[]'::jsonb,
  true,
  false
);

-- Representation Allowance (Indemnité de représentation)
INSERT INTO salary_component_templates (
  country_code, code, name, description, category,
  metadata, suggested_amount, is_popular, display_order,
  compliance_level, legal_reference, customizable_fields,
  can_deactivate, can_modify
) VALUES (
  'CI',
  'TPT_REPRESENTATION',
  '{"fr": "Indemnité de représentation"}',
  'Prime de fonction pour postes à responsabilité',
  'allowance',
  '{
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": true
    },
    "calculationRule": {
      "type": "percentage",
      "rate": 0.15
    }
  }',
  NULL,
  false,
  23,
  'freeform',
  NULL,
  '["calculationRule.rate"]'::jsonb,
  true,
  true
);

-- ========================================================================
-- Done!
-- ========================================================================
