-- Document Versioning System
-- Epic: Document Management - Version Control
-- Created: 2025-11-12
--
-- This migration adds version tracking to documents:
-- - Track multiple versions of the same document
-- - Version history with notes
-- - Rollback capability
-- - Comparison between versions
--
-- Use cases:
-- - Contract amendments (v1 → v2 → v3)
-- - Policy updates with change tracking
-- - Audit trail for compliance
-- - Rollback to previous versions

-- =====================================================
-- Step 1: Add Versioning Columns to uploaded_documents
-- =====================================================

-- Add versioning columns
ALTER TABLE uploaded_documents
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES uploaded_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_latest_version boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS version_notes text,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz, -- When this version was replaced
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid REFERENCES uploaded_documents(id) ON DELETE SET NULL;

-- Add constraint: version_number must be positive
ALTER TABLE uploaded_documents
  ADD CONSTRAINT check_version_number_positive
  CHECK (version_number > 0);

-- Add indexes for efficient version queries
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_parent
  ON uploaded_documents(parent_document_id)
  WHERE parent_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_latest_version
  ON uploaded_documents(is_latest_version)
  WHERE is_latest_version = true;

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_version_chain
  ON uploaded_documents(parent_document_id, version_number)
  WHERE parent_document_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN uploaded_documents.version_number IS 'Version number (1, 2, 3, etc.). Always starts at 1 for new documents.';
COMMENT ON COLUMN uploaded_documents.parent_document_id IS 'Links to the first version of this document. NULL for v1 documents.';
COMMENT ON COLUMN uploaded_documents.is_latest_version IS 'TRUE only for the most recent version. Used to filter version history.';
COMMENT ON COLUMN uploaded_documents.version_notes IS 'User-provided notes explaining what changed in this version (optional).';
COMMENT ON COLUMN uploaded_documents.superseded_at IS 'Timestamp when this version was replaced by a newer version.';
COMMENT ON COLUMN uploaded_documents.superseded_by_id IS 'ID of the document version that replaced this one.';

-- =====================================================
-- Step 2: Create Version History View
-- =====================================================

-- Purpose: Easy querying of complete version chains
-- Shows all versions of a document family in chronological order

CREATE OR REPLACE VIEW document_version_history AS
SELECT
  d.id,
  d.tenant_id,
  d.employee_id,
  d.document_category,
  d.file_name,
  d.file_url,
  d.file_size,
  d.mime_type,
  d.version_number,
  d.parent_document_id,
  COALESCE(d.parent_document_id, d.id) as version_root_id, -- ID of v1 document
  d.is_latest_version,
  d.version_notes,
  d.approval_status,
  d.uploaded_by,
  d.uploaded_at,
  d.superseded_at,
  d.superseded_by_id,
  d.signature_status,
  d.signed_at,
  -- Calculate total versions in family
  COUNT(*) OVER (PARTITION BY COALESCE(d.parent_document_id, d.id)) as total_versions,
  -- Get latest version number in family
  MAX(d.version_number) OVER (PARTITION BY COALESCE(d.parent_document_id, d.id)) as latest_version_number
FROM uploaded_documents d
ORDER BY COALESCE(d.parent_document_id, d.id), d.version_number;

COMMENT ON VIEW document_version_history IS 'Complete version history for all documents with calculated fields';

-- =====================================================
-- Step 3: Helper Functions
-- =====================================================

-- Function: Get version chain for a document
CREATE OR REPLACE FUNCTION get_version_chain(doc_id uuid)
RETURNS TABLE (
  id uuid,
  version_number integer,
  file_name text,
  file_size integer,
  version_notes text,
  uploaded_at timestamptz,
  uploaded_by uuid,
  is_latest_version boolean,
  approval_status text,
  signature_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  root_id uuid;
BEGIN
  -- Find the root document (v1)
  SELECT COALESCE(parent_document_id, doc_id)
  INTO root_id
  FROM uploaded_documents
  WHERE uploaded_documents.id = doc_id;

  -- Return all versions in the chain
  RETURN QUERY
  SELECT
    d.id,
    d.version_number,
    d.file_name,
    d.file_size,
    d.version_notes,
    d.uploaded_at,
    d.uploaded_by,
    d.is_latest_version,
    d.approval_status,
    d.signature_status
  FROM uploaded_documents d
  WHERE d.id = root_id
     OR d.parent_document_id = root_id
  ORDER BY d.version_number ASC;
END;
$$;

COMMENT ON FUNCTION get_version_chain IS 'Returns all versions of a document in chronological order';

-- Function: Get version statistics
CREATE OR REPLACE FUNCTION get_version_stats(doc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  root_id uuid;
BEGIN
  -- Find the root document
  SELECT COALESCE(parent_document_id, doc_id)
  INTO root_id
  FROM uploaded_documents
  WHERE uploaded_documents.id = doc_id;

  -- Calculate statistics
  SELECT jsonb_build_object(
    'total_versions', COUNT(*),
    'latest_version', MAX(version_number),
    'first_uploaded', MIN(uploaded_at),
    'last_updated', MAX(uploaded_at),
    'total_size_bytes', SUM(file_size),
    'signed_versions', COUNT(*) FILTER (WHERE signature_status = 'signed'),
    'approved_versions', COUNT(*) FILTER (WHERE approval_status = 'approved')
  )
  INTO result
  FROM uploaded_documents
  WHERE id = root_id OR parent_document_id = root_id;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_version_stats IS 'Returns version statistics for a document family';

-- =====================================================
-- Step 4: Trigger - Maintain Version Integrity
-- =====================================================

-- Trigger function: Ensure only one latest version per document family
CREATE OR REPLACE FUNCTION maintain_latest_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  root_id uuid;
BEGIN
  -- Only run on INSERT or UPDATE of is_latest_version
  IF (TG_OP = 'INSERT' AND NEW.is_latest_version = true) OR
     (TG_OP = 'UPDATE' AND NEW.is_latest_version = true AND OLD.is_latest_version = false) THEN

    -- Find root document
    root_id := COALESCE(NEW.parent_document_id, NEW.id);

    -- Set all other versions to NOT latest
    UPDATE uploaded_documents
    SET is_latest_version = false
    WHERE (id = root_id OR parent_document_id = root_id)
      AND id != NEW.id
      AND is_latest_version = true;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_maintain_latest_version ON uploaded_documents;
CREATE TRIGGER trigger_maintain_latest_version
  AFTER INSERT OR UPDATE OF is_latest_version ON uploaded_documents
  FOR EACH ROW
  EXECUTE FUNCTION maintain_latest_version();

COMMENT ON FUNCTION maintain_latest_version IS 'Ensures only one version is marked as latest in a document family';

-- =====================================================
-- Step 5: Update Existing Documents
-- =====================================================

-- Set all existing documents as version 1 and latest
-- (They have no parent_document_id, so they're standalone v1 documents)
UPDATE uploaded_documents
SET
  version_number = 1,
  is_latest_version = true,
  parent_document_id = NULL
WHERE version_number IS NULL OR is_latest_version IS NULL;

-- =====================================================
-- Step 6: RLS Policy Updates
-- =====================================================

-- No changes needed to existing RLS policies
-- Versioned documents inherit tenant_id from parent, so existing policies work

-- Optional: Add policy to prevent deletion of v1 documents with children
-- (Can be enforced in application logic instead)

-- =====================================================
-- Step 7: Create Version Changelog Table (Optional)
-- =====================================================

-- Track what changed between versions (optional enhancement)
CREATE TABLE IF NOT EXISTS document_version_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  previous_version_id uuid REFERENCES uploaded_documents(id) ON DELETE SET NULL,
  change_summary text NOT NULL, -- User-provided summary
  changed_fields jsonb, -- Which fields changed (file_size, approval_status, etc.)
  changed_by uuid REFERENCES users(id),
  changed_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_version_changelog_document
  ON document_version_changelog(document_id);

CREATE INDEX IF NOT EXISTS idx_version_changelog_tenant
  ON document_version_changelog(tenant_id);

-- Enable RLS
ALTER TABLE document_version_changelog ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation
CREATE POLICY "version_changelog_tenant_isolation" ON document_version_changelog
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE document_version_changelog IS 'Optional audit trail of changes between document versions';

-- =====================================================
-- Step 8: Verification Queries
-- =====================================================

-- Verify columns added
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'uploaded_documents' AND column_name LIKE 'version%';

-- Verify indexes
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'uploaded_documents' AND indexname LIKE '%version%';

-- Test version chain function
-- SELECT * FROM get_version_chain('00000000-0000-0000-0000-000000000000'::uuid);

-- Test version stats function
-- SELECT get_version_stats('00000000-0000-0000-0000-000000000000'::uuid);

-- View version history
-- SELECT * FROM document_version_history WHERE tenant_id = 'tenant-uuid' LIMIT 10;

-- =====================================================
-- Rollback (if needed)
-- =====================================================
-- DROP TRIGGER IF EXISTS trigger_maintain_latest_version ON uploaded_documents;
-- DROP FUNCTION IF EXISTS maintain_latest_version();
-- DROP FUNCTION IF EXISTS get_version_stats(uuid);
-- DROP FUNCTION IF EXISTS get_version_chain(uuid);
-- DROP VIEW IF EXISTS document_version_history;
-- DROP TABLE IF EXISTS document_version_changelog CASCADE;
-- ALTER TABLE uploaded_documents
--   DROP COLUMN IF EXISTS version_number,
--   DROP COLUMN IF EXISTS parent_document_id,
--   DROP COLUMN IF EXISTS is_latest_version,
--   DROP COLUMN IF EXISTS version_notes,
--   DROP COLUMN IF EXISTS superseded_at,
--   DROP COLUMN IF EXISTS superseded_by_id;
