-- Add justification document fields to time_off_requests table
-- This allows employees to upload supporting documents (medical certificates, etc.)

ALTER TABLE time_off_requests
  ADD COLUMN IF NOT EXISTS justification_document_url TEXT,
  ADD COLUMN IF NOT EXISTS justification_document_uploaded_at TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN time_off_requests.justification_document_url IS
  'URL to uploaded justification document (medical certificate, birth certificate, etc.)';

COMMENT ON COLUMN time_off_requests.justification_document_uploaded_at IS
  'Timestamp when the justification document was uploaded';

-- Create index for querying leaves with documents
CREATE INDEX IF NOT EXISTS idx_time_off_requests_has_justification
  ON time_off_requests(justification_document_url)
  WHERE justification_document_url IS NOT NULL;
