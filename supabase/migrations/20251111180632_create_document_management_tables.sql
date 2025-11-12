-- Document Management System Tables
-- Epic: Document Management
-- Created: 2025-11-11
--
-- This migration creates:
-- 1. uploaded_documents - Stores all user-uploaded documents
-- 2. document_categories - Reference data for document types
--
-- Related docs:
-- - docs/IMPLEMENTATION-GUIDE-DOCUMENT-MANAGEMENT.md
-- - docs/DOCUMENT-MANAGEMENT-INNGEST-INTEGRATION.md

-- =====================================================
-- Table 1: uploaded_documents
-- =====================================================
-- Purpose: Store all user-uploaded documents (contracts, IDs, medical certs, etc.)
-- Features:
-- - File metadata (name, URL, size, MIME type)
-- - Approval workflow (pending/approved/rejected)
-- - Expiry tracking for time-sensitive documents
-- - Soft delete (is_archived)
-- - Multi-tenant with RLS

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,

  -- Document classification
  document_category text NOT NULL, -- contract, id_card, diploma, medical, performance, policy, other
  document_subcategory text, -- CDI, CDD, passport, performance_review, etc.

  -- File information
  file_name text NOT NULL,
  file_url text NOT NULL, -- Supabase Storage URL
  file_size integer NOT NULL, -- Bytes
  mime_type text NOT NULL, -- application/pdf, image/jpeg, etc.

  -- Upload metadata
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz DEFAULT now(),

  -- Optional fields
  expiry_date date, -- For IDs, contracts with end dates
  tags text[], -- Flexible categorization
  metadata jsonb DEFAULT '{}', -- Extensible field for custom data

  -- Approval workflow
  approval_status text DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejection_reason text,

  -- Soft delete
  is_archived boolean DEFAULT false,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_tenant ON uploaded_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_employee ON uploaded_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_category ON uploaded_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_approval ON uploaded_documents(approval_status) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_expiry ON uploaded_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_uploaded_by ON uploaded_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_created_at ON uploaded_documents(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE uploaded_documents IS 'Stores all user-uploaded documents with approval workflow and expiry tracking';
COMMENT ON COLUMN uploaded_documents.document_category IS 'Main category: contract, id_card, diploma, medical, performance, policy, other';
COMMENT ON COLUMN uploaded_documents.approval_status IS 'Workflow state: pending (awaiting HR approval), approved, rejected';
COMMENT ON COLUMN uploaded_documents.expiry_date IS 'For time-sensitive documents (IDs, fixed-term contracts). Triggers expiry alerts.';
COMMENT ON COLUMN uploaded_documents.metadata IS 'Extensible JSON field for custom data (contract terms, ID number, etc.)';

-- =====================================================
-- Table 2: document_categories
-- =====================================================
-- Purpose: Reference table for document category metadata (labels, icons, permissions)
-- Features:
-- - French labels for UI
-- - Lucide icon names
-- - Permission flags (who can upload/generate)
-- - Display ordering

CREATE TABLE IF NOT EXISTS document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL, -- contract, id_card, diploma, etc.
  label_fr text NOT NULL, -- "Contrat de travail"
  icon text NOT NULL, -- Lucide icon name: "FileText"
  allows_upload boolean DEFAULT true,
  allows_generation boolean DEFAULT false,
  requires_hr_approval boolean DEFAULT false,
  employee_can_upload boolean DEFAULT false,
  display_order integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed data for document categories
INSERT INTO document_categories (code, label_fr, icon, allows_upload, allows_generation, requires_hr_approval, employee_can_upload, display_order) VALUES
  ('contract', 'Contrat de travail', 'FileText', true, true, false, false, 1),
  ('bulletin', 'Bulletin de paie', 'Receipt', false, true, false, false, 2),
  ('certificate', 'Certificat', 'Award', false, true, false, false, 3),
  ('id_card', 'Pièce d''identité', 'CreditCard', true, false, false, true, 4),
  ('diploma', 'Diplôme', 'GraduationCap', true, false, false, true, 5),
  ('medical', 'Certificat médical', 'Stethoscope', true, false, true, true, 6),
  ('performance', 'Évaluation', 'TrendingUp', true, false, false, false, 7),
  ('policy', 'Politique d''entreprise', 'Shield', true, true, false, false, 8),
  ('other', 'Autre document', 'File', true, false, false, true, 9)
ON CONFLICT (code) DO NOTHING;

-- Comments
COMMENT ON TABLE document_categories IS 'Reference data for document types with labels, icons, and permissions';
COMMENT ON COLUMN document_categories.requires_hr_approval IS 'If true, employee uploads go to pending status for HR approval';
COMMENT ON COLUMN document_categories.employee_can_upload IS 'If true, employees can upload this document type via self-service';

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;

-- Policy 1: Tenant isolation (all users see only their tenant's documents)
CREATE POLICY "uploaded_documents_tenant_isolation" ON uploaded_documents
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy 2: Employees can view their own documents
CREATE POLICY "uploaded_documents_employee_view_own" ON uploaded_documents
  FOR SELECT
  USING (
    employee_id = (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- Policy 3: HR/Admin can manage all documents in their tenant
CREATE POLICY "uploaded_documents_hr_manage" ON uploaded_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
      AND role IN ('HR_MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- Policy 4: Employees can insert their own documents (if allowed by category)
CREATE POLICY "uploaded_documents_employee_insert_own" ON uploaded_documents
  FOR INSERT
  WITH CHECK (
    employee_id = (
      SELECT id FROM employees
      WHERE user_id = auth.uid()
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    AND document_category IN (
      SELECT code FROM document_categories
      WHERE employee_can_upload = true
    )
  );

-- =====================================================
-- Triggers
-- =====================================================

-- Updated_at trigger for uploaded_documents
CREATE TRIGGER set_uploaded_documents_updated_at
  BEFORE UPDATE ON uploaded_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Optional: Extend existing generated_documents table
-- =====================================================
-- Add tags and archive fields for consistency with uploaded_documents

ALTER TABLE generated_documents
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Index for archived documents
CREATE INDEX IF NOT EXISTS idx_generated_documents_archived ON generated_documents(is_archived) WHERE is_archived = false;

COMMENT ON COLUMN generated_documents.tags IS 'Flexible tagging for document organization (same as uploaded_documents)';
COMMENT ON COLUMN generated_documents.is_archived IS 'Soft delete flag (same pattern as uploaded_documents)';

-- =====================================================
-- Verification Queries (run after migration)
-- =====================================================

-- Verify tables created
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('uploaded_documents', 'document_categories');

-- Verify indexes created
-- SELECT indexname FROM pg_indexes WHERE tablename = 'uploaded_documents';

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'uploaded_documents';

-- Verify seed data
-- SELECT code, label_fr, employee_can_upload FROM document_categories ORDER BY display_order;

-- =====================================================
-- Rollback (if needed)
-- =====================================================
-- DROP TABLE IF EXISTS uploaded_documents CASCADE;
-- DROP TABLE IF EXISTS document_categories CASCADE;
-- ALTER TABLE generated_documents DROP COLUMN IF EXISTS tags;
-- ALTER TABLE generated_documents DROP COLUMN IF EXISTS is_archived;
