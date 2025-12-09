-- Migration: Create document_requests table
-- Purpose: Enable employees to request administrative documents from HR
-- Document Types: attestation_travail, attestation_emploi, attestation_salaire,
--                 declaration_fiscale, attestation_cnps, domiciliation_bancaire, copie_contrat

-- Create document_requests table
CREATE TABLE IF NOT EXISTS document_requests (
  -- Primary & Relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  -- Request Details
  document_type TEXT NOT NULL,
  request_notes TEXT,

  -- Manager Proxy Pattern
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_on_behalf_of BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- HR Review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Generated Document Link
  generated_document_id UUID REFERENCES uploaded_documents(id),
  document_ready_at TIMESTAMPTZ,

  -- Employee Snapshot (for audit trail)
  employee_name VARCHAR(255),
  employee_number VARCHAR(50),

  -- Audit Trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_requests_tenant_status
  ON document_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_document_requests_employee
  ON document_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_document_requests_requested_by
  ON document_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_document_requests_created_at
  ON document_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant Isolation
CREATE POLICY tenant_isolation ON document_requests
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );

-- Grant permissions
GRANT ALL ON document_requests TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE document_requests IS 'Administrative document requests from employees to HR';
COMMENT ON COLUMN document_requests.document_type IS 'Type of document requested: attestation_travail, attestation_emploi, attestation_salaire, declaration_fiscale, attestation_cnps, domiciliation_bancaire, copie_contrat';
COMMENT ON COLUMN document_requests.status IS 'Request status: pending, processing, ready, rejected, cancelled';
COMMENT ON COLUMN document_requests.requested_on_behalf_of IS 'True if manager submitted request on behalf of employee';
COMMENT ON COLUMN document_requests.generated_document_id IS 'Link to uploaded_documents when document is ready';
