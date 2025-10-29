-- Migration: Add identity document type field
-- Date: 2025-10-29
-- Purpose: Support different identity document types (CNI, Passport, etc.)

-- Add identity_document_type column
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS identity_document_type VARCHAR(20);

COMMENT ON COLUMN employees.identity_document_type IS 'Type of identity document: cni, passport, residence_permit, etc.';

-- Set default value for existing records (assume CNI for existing national_id values)
UPDATE employees
SET identity_document_type = 'cni'
WHERE national_id IS NOT NULL AND identity_document_type IS NULL;
