/**
 * Migration: Create employee_dependents table
 *
 * Purpose: Track individual dependents with document verification
 * for accurate fiscal parts and CMU calculation in Côte d'Ivoire.
 *
 * Legal Context:
 * - Fiscal parts: Children under 21 automatic, over 21 need "certificat de fréquentation"
 * - CMU: 1,000 FCFA per verified person (employee + spouse + verified dependents)
 *
 * Related: GAP-FISCAL-001, GAP-CMU-001
 */

-- Create employee_dependents table
CREATE TABLE IF NOT EXISTS employee_dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Dependent information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  relationship VARCHAR(50) NOT NULL, -- 'child', 'spouse', 'other'

  -- Verification status
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  requires_document BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE if over 21

  -- Document tracking (for dependents over 21)
  document_type VARCHAR(100), -- 'certificat_frequentation', 'attestation_scolarite', 'carte_etudiant'
  document_number VARCHAR(100),
  document_issue_date DATE,
  document_expiry_date DATE,
  document_url TEXT, -- Link to uploaded document in storage
  document_notes TEXT,

  -- Eligibility flags
  eligible_for_fiscal_parts BOOLEAN NOT NULL DEFAULT TRUE,
  eligible_for_cmu BOOLEAN NOT NULL DEFAULT TRUE,

  -- Additional metadata
  notes TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'expired'

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes for performance
CREATE INDEX idx_employee_dependents_employee_id ON employee_dependents(employee_id);
CREATE INDEX idx_employee_dependents_tenant_id ON employee_dependents(tenant_id);
CREATE INDEX idx_employee_dependents_status ON employee_dependents(status);
CREATE INDEX idx_employee_dependents_document_expiry ON employee_dependents(document_expiry_date)
  WHERE document_expiry_date IS NOT NULL AND status = 'active';

-- RLS Policies
ALTER TABLE employee_dependents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see dependents in their tenant
CREATE POLICY tenant_isolation_select ON employee_dependents
  FOR SELECT
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Policy: Users can insert dependents in their tenant
CREATE POLICY tenant_isolation_insert ON employee_dependents
  FOR INSERT
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Policy: Users can update dependents in their tenant
CREATE POLICY tenant_isolation_update ON employee_dependents
  FOR UPDATE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Policy: Users can delete dependents in their tenant
CREATE POLICY tenant_isolation_delete ON employee_dependents
  FOR DELETE
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_dependents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employee_dependents_updated_at
  BEFORE UPDATE ON employee_dependents
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_dependents_updated_at();

-- Function to automatically calculate age and set requires_document flag
CREATE OR REPLACE FUNCTION check_dependent_age()
RETURNS TRIGGER AS $$
DECLARE
  dependent_age INTEGER;
BEGIN
  -- Calculate age
  dependent_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_of_birth));

  -- Set requires_document flag if over 21
  IF dependent_age >= 21 THEN
    NEW.requires_document := TRUE;

    -- If no valid document, mark as not verified
    IF NEW.document_type IS NULL OR NEW.document_number IS NULL THEN
      NEW.is_verified := FALSE;
    END IF;
  ELSE
    -- Under 21: automatic verification
    NEW.requires_document := FALSE;
    NEW.is_verified := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dependent_age_check
  BEFORE INSERT OR UPDATE ON employee_dependents
  FOR EACH ROW
  EXECUTE FUNCTION check_dependent_age();

-- Comment on table
COMMENT ON TABLE employee_dependents IS 'Individual dependent tracking for fiscal parts and CMU calculations. Enforces document verification for dependents over 21 years old (certificat de fréquentation).';

COMMENT ON COLUMN employee_dependents.requires_document IS 'TRUE if dependent is over 21 years old and requires certificat de fréquentation or similar proof';
COMMENT ON COLUMN employee_dependents.is_verified IS 'TRUE if dependent has valid documentation (auto TRUE for under 21, requires document check for over 21)';
COMMENT ON COLUMN employee_dependents.eligible_for_fiscal_parts IS 'Include this dependent in fiscal parts (parts fiscales) calculation';
COMMENT ON COLUMN employee_dependents.eligible_for_cmu IS 'Include this dependent in CMU (health insurance) contribution calculation';
