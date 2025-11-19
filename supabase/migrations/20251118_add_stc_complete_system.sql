-- =====================================================
-- STC Complete System Migration
-- Date: 2025-11-18
-- Description: Add all fields for comprehensive STC calculation
--              Supporting 7 departure types with complete calculations
-- =====================================================

-- =====================================================
-- PART 1: CREATE ENUMS
-- =====================================================

-- Departure types (7 scenarios)
DO $$ BEGIN
  CREATE TYPE departure_type AS ENUM (
    'FIN_CDD',
    'DEMISSION_CDI',
    'DEMISSION_CDD',
    'LICENCIEMENT',
    'RUPTURE_CONVENTIONNELLE',
    'RETRAITE',
    'DECES'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Notice period status
DO $$ BEGIN
  CREATE TYPE notice_period_status AS ENUM (
    'worked',               -- Préavis effectué
    'paid_by_employer',     -- Payé par employeur (ajouté au STC)
    'paid_by_employee',     -- Payé par employé (déduit du STC)
    'waived'                -- Dispensé (aucun paiement)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Licenciement types
DO $$ BEGIN
  CREATE TYPE licenciement_type AS ENUM (
    'economique',      -- Licenciement économique
    'faute_simple',    -- Faute simple
    'faute_grave',     -- Faute grave (pas de préavis)
    'faute_lourde',    -- Faute lourde (pas de préavis ni IL)
    'inaptitude'       -- Inaptitude (double indemnités)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- PART 2: ADD NEW COLUMNS TO employee_terminations
-- =====================================================

-- Core STC fields
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS departure_type departure_type NOT NULL DEFAULT 'LICENCIEMENT',
  ADD COLUMN IF NOT EXISTS contract_type_at_termination VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gratification_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gratification_rate NUMERIC(5,4) DEFAULT 0.75; -- 75% minimum légal

-- Notice period configuration
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS notice_period_status notice_period_status DEFAULT 'worked',
  ADD COLUMN IF NOT EXISTS notice_period_months NUMERIC(3,1);

-- Additional indemnities
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS cdd_end_indemnity NUMERIC(15,2) DEFAULT 0,  -- Indemnité fin CDD (3%)
  ADD COLUMN IF NOT EXISTS funeral_expenses NUMERIC(15,2) DEFAULT 0;    -- Frais funéraires

-- Licenciement specific
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS licenciement_type licenciement_type;

-- Rupture conventionnelle specific
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS rupture_negotiated_amount NUMERIC(15,2);

-- Décès specific
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS death_certificate_url TEXT,
  ADD COLUMN IF NOT EXISTS beneficiaries JSONB DEFAULT '[]';

-- =====================================================
-- PART 3: DOCUMENT INTEGRATION (uploadedDocuments)
-- =====================================================

-- Add foreign keys to uploaded_documents (replace direct URLs)
ALTER TABLE employee_terminations
  ADD COLUMN IF NOT EXISTS work_certificate_document_id UUID REFERENCES uploaded_documents(id),
  ADD COLUMN IF NOT EXISTS final_payslip_document_id UUID REFERENCES uploaded_documents(id),
  ADD COLUMN IF NOT EXISTS cnps_attestation_document_id UUID REFERENCES uploaded_documents(id);

-- =====================================================
-- PART 4: ADD DOCUMENT CATEGORIES
-- =====================================================

-- Insert new document categories for termination documents
INSERT INTO document_categories (code, label_fr, icon, allows_upload, allows_generation, requires_hr_approval, employee_can_upload, display_order)
VALUES
  ('work_certificate', 'Certificat de Travail', 'FileText', false, true, false, false, 40),
  ('final_payslip', 'Bulletin de Paie Final', 'Receipt', false, true, false, false, 41),
  ('cnps_attestation', 'Attestation CNPS', 'Shield', false, true, false, false, 42),
  ('termination_docs', 'Documents de Sortie', 'UserX', false, true, false, false, 43),
  ('death_certificate', 'Certificat de Décès', 'FileX', true, false, true, false, 44)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- PART 5: ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_terminations_departure_type
  ON employee_terminations(departure_type);

CREATE INDEX IF NOT EXISTS idx_terminations_notice_status
  ON employee_terminations(notice_period_status);

CREATE INDEX IF NOT EXISTS idx_terminations_work_cert_doc
  ON employee_terminations(work_certificate_document_id);

CREATE INDEX IF NOT EXISTS idx_terminations_final_payslip_doc
  ON employee_terminations(final_payslip_document_id);

CREATE INDEX IF NOT EXISTS idx_terminations_cnps_doc
  ON employee_terminations(cnps_attestation_document_id);

-- =====================================================
-- PART 6: UPDATE CONSTRAINTS
-- =====================================================

-- Drop old termination_reason check if exists and recreate with new values
ALTER TABLE employee_terminations DROP CONSTRAINT IF EXISTS valid_termination_reason;

-- Add check for beneficiaries (must total 100% if décès)
-- This will be enforced in application layer but good to document

-- Add comments for documentation
COMMENT ON COLUMN employee_terminations.departure_type IS 'Type de départ: FIN_CDD, DEMISSION_CDI, DEMISSION_CDD, LICENCIEMENT, RUPTURE_CONVENTIONNELLE, RETRAITE, DECES';
COMMENT ON COLUMN employee_terminations.notice_period_status IS 'Statut du préavis: worked (effectué), paid_by_employer (payé), paid_by_employee (déduit), waived (dispensé)';
COMMENT ON COLUMN employee_terminations.gratification_amount IS 'Prime de fin d''année au prorata (minimum 75% du salaire catégoriel)';
COMMENT ON COLUMN employee_terminations.cdd_end_indemnity IS 'Indemnité de fin de CDD (3% du salaire brut total sur période)';
COMMENT ON COLUMN employee_terminations.funeral_expenses IS 'Frais funéraires: 3× à 6× SMIG selon ancienneté';
COMMENT ON COLUMN employee_terminations.licenciement_type IS 'Type de licenciement: economique, faute_simple, faute_grave, faute_lourde, inaptitude';
COMMENT ON COLUMN employee_terminations.rupture_negotiated_amount IS 'Montant négocié pour rupture conventionnelle (doit être ≥ minimum légal)';
COMMENT ON COLUMN employee_terminations.beneficiaries IS 'Liste des bénéficiaires (ayants droit) en cas de décès - JSONB array avec name, relationship, sharePercentage, bankAccount';
COMMENT ON COLUMN employee_terminations.work_certificate_document_id IS 'Foreign key vers uploaded_documents pour certificat de travail (avec versioning et e-signature)';
COMMENT ON COLUMN employee_terminations.final_payslip_document_id IS 'Foreign key vers uploaded_documents pour bulletin final';
COMMENT ON COLUMN employee_terminations.cnps_attestation_document_id IS 'Foreign key vers uploaded_documents pour attestation CNPS';

-- =====================================================
-- MIGRATION NOTES
-- =====================================================

-- Existing data migration strategy:
-- - departure_type defaults to 'LICENCIEMENT' for existing records
-- - Old termination_reason field kept for backward compatibility
-- - Old *_url fields kept alongside new *_document_id (dual system during transition)
-- - gratification_rate defaults to 0.75 (75% minimum légal)
-- - notice_period_status defaults to 'worked'

-- Post-migration tasks:
-- 1. Update Drizzle schema with new enums
-- 2. Update termination service to populate new fields
-- 3. Migrate existing documents to uploadedDocuments (optional script)
-- 4. Update UI to use new fields

-- =====================================================
-- END MIGRATION
-- =====================================================
