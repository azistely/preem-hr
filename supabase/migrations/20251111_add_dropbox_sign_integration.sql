-- Dropbox Sign (HelloSign) Integration
-- Epic: Document Management - E-Signature
-- Created: 2025-11-11
--
-- This migration adds e-signature capabilities using Dropbox Sign API
-- Reference: docs/DOCUMENT-SIGNING-SOLUTIONS-ANALYSIS.md
--
-- Changes:
-- 1. Add signature tracking columns to uploaded_documents
-- 2. Create signature_events table for audit trail
-- 3. Add indexes and RLS policies

-- =====================================================
-- Step 1: Add Signature Columns to uploaded_documents
-- =====================================================

-- Add columns to track signature requests and status
ALTER TABLE uploaded_documents
  ADD COLUMN IF NOT EXISTS signature_request_id varchar(255), -- Dropbox Sign signature request ID
  ADD COLUMN IF NOT EXISTS signature_provider varchar(50) DEFAULT 'dropbox_sign', -- Provider name for future flexibility
  ADD COLUMN IF NOT EXISTS signature_status varchar(50), -- NULL (no signature), 'pending', 'partially_signed', 'signed', 'declined', 'cancelled'
  ADD COLUMN IF NOT EXISTS signature_url text, -- Embedded signing URL
  ADD COLUMN IF NOT EXISTS signed_at timestamptz, -- When all parties signed
  ADD COLUMN IF NOT EXISTS signature_metadata jsonb DEFAULT '{}'; -- Store signer details, template info, etc.

-- Add constraint for valid signature statuses
ALTER TABLE uploaded_documents
  ADD CONSTRAINT check_signature_status
  CHECK (signature_status IS NULL OR signature_status IN ('pending', 'partially_signed', 'signed', 'declined', 'cancelled'));

-- Add index for finding documents by signature request ID
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_signature_request
  ON uploaded_documents(signature_request_id)
  WHERE signature_request_id IS NOT NULL;

-- Add index for pending signatures
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_signature_pending
  ON uploaded_documents(signature_status)
  WHERE signature_status IN ('pending', 'partially_signed');

-- Add index for completed signatures
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_signed_at
  ON uploaded_documents(signed_at DESC)
  WHERE signed_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN uploaded_documents.signature_request_id IS 'Dropbox Sign signature request ID (starts with "...")';
COMMENT ON COLUMN uploaded_documents.signature_provider IS 'E-signature provider: dropbox_sign (future: documenso, docuseal)';
COMMENT ON COLUMN uploaded_documents.signature_status IS 'Signature workflow state: pending, partially_signed, signed, declined, cancelled';
COMMENT ON COLUMN uploaded_documents.signature_url IS 'Embedded signing URL for iframe or redirect';
COMMENT ON COLUMN uploaded_documents.signed_at IS 'Timestamp when all required parties completed signing';
COMMENT ON COLUMN uploaded_documents.signature_metadata IS 'JSON with signer names, emails, IP addresses, timestamps per signer';

-- =====================================================
-- Step 2: Create signature_events Table
-- =====================================================

-- Purpose: Audit trail of all signature-related events
-- Use case: Track who viewed, signed, or declined documents
-- Compliance: Required for legal validity of e-signatures

CREATE TABLE IF NOT EXISTS signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to document
  document_id uuid NOT NULL REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Event details
  event_type varchar(50) NOT NULL, -- 'request_sent', 'viewed', 'signed', 'declined', 'cancelled', 'completed'
  event_timestamp timestamptz DEFAULT now(),

  -- Signer information
  signer_email varchar(255),
  signer_name varchar(255),
  signer_ip_address inet, -- IP address for audit trail
  signer_user_agent text, -- Browser/device info

  -- Provider data
  signature_provider varchar(50) DEFAULT 'dropbox_sign',
  provider_event_id varchar(255), -- Dropbox Sign event ID for deduplication

  -- Additional metadata
  metadata jsonb DEFAULT '{}', -- Full webhook payload or additional context

  -- Timestamps
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_signature_events_document ON signature_events(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_tenant ON signature_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signature_events_type ON signature_events(event_type);
CREATE INDEX IF NOT EXISTS idx_signature_events_timestamp ON signature_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signature_events_provider_event ON signature_events(provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signature_events_signer ON signature_events(signer_email);

-- Constraint for valid event types
ALTER TABLE signature_events
  ADD CONSTRAINT check_signature_event_type
  CHECK (event_type IN (
    'request_sent',
    'viewed',
    'signed',
    'declined',
    'cancelled',
    'completed',
    'reminder_sent',
    'expired'
  ));

-- Comments for documentation
COMMENT ON TABLE signature_events IS 'Audit trail of all e-signature events for legal compliance and tracking';
COMMENT ON COLUMN signature_events.event_type IS 'Type: request_sent, viewed, signed, declined, cancelled, completed, reminder_sent, expired';
COMMENT ON COLUMN signature_events.signer_ip_address IS 'IP address of signer (for legal audit trail)';
COMMENT ON COLUMN signature_events.provider_event_id IS 'Dropbox Sign event ID to prevent duplicate event processing';
COMMENT ON COLUMN signature_events.metadata IS 'Full webhook payload or additional context from e-signature provider';

-- =====================================================
-- Step 3: Row Level Security (RLS) for signature_events
-- =====================================================

ALTER TABLE signature_events ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenant isolation
CREATE POLICY "signature_events_tenant_isolation" ON signature_events
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy 2: HR/Admin can view all signature events
CREATE POLICY "signature_events_hr_view_all" ON signature_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND role IN ('HR_MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Policy 3: Employees can view events for their own documents
CREATE POLICY "signature_events_employee_view_own" ON signature_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM uploaded_documents ud
      JOIN users u ON ud.employee_id = u.employee_id
      WHERE ud.id = signature_events.document_id
      AND u.id = auth.uid()
      AND ud.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- Policy 4: Only system can insert events (via service role, not users)
-- Note: Regular users should not be able to insert signature events
-- Events are created by webhook handlers using service role

-- =====================================================
-- Step 4: Helper Function - Get Signature Status Summary
-- =====================================================

-- Function to get signature statistics for a document
CREATE OR REPLACE FUNCTION get_signature_summary(doc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'signature_request_id', ud.signature_request_id,
    'signature_status', ud.signature_status,
    'signed_at', ud.signed_at,
    'total_events', COUNT(se.id),
    'signers', jsonb_agg(DISTINCT jsonb_build_object(
      'name', se.signer_name,
      'email', se.signer_email,
      'signed', se.event_type = 'signed'
    )) FILTER (WHERE se.signer_email IS NOT NULL),
    'timeline', jsonb_agg(jsonb_build_object(
      'event_type', se.event_type,
      'timestamp', se.event_timestamp,
      'signer', se.signer_email
    ) ORDER BY se.event_timestamp DESC)
  )
  INTO result
  FROM uploaded_documents ud
  LEFT JOIN signature_events se ON se.document_id = ud.id
  WHERE ud.id = doc_id
  GROUP BY ud.id, ud.signature_request_id, ud.signature_status, ud.signed_at;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_signature_summary IS 'Returns complete signature status and timeline for a document';

-- =====================================================
-- Step 5: Verification Queries (run after migration)
-- =====================================================

-- Verify columns added to uploaded_documents
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'uploaded_documents' AND column_name LIKE 'signature%';

-- Verify signature_events table created
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'signature_events';

-- Verify indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('uploaded_documents', 'signature_events')
-- AND indexname LIKE '%signature%';

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'signature_events';

-- Test helper function
-- SELECT get_signature_summary('00000000-0000-0000-0000-000000000000'::uuid);

-- =====================================================
-- Rollback (if needed)
-- =====================================================
-- DROP FUNCTION IF EXISTS get_signature_summary(uuid);
-- DROP TABLE IF EXISTS signature_events CASCADE;
-- ALTER TABLE uploaded_documents
--   DROP COLUMN IF EXISTS signature_request_id,
--   DROP COLUMN IF EXISTS signature_provider,
--   DROP COLUMN IF EXISTS signature_status,
--   DROP COLUMN IF EXISTS signature_url,
--   DROP COLUMN IF EXISTS signed_at,
--   DROP COLUMN IF EXISTS signature_metadata;
