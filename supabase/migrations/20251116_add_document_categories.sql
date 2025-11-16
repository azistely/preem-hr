-- Add new document categories for entity-specific documents
-- These categories allow HR modules to use the uploaded_documents table with versioning, signatures, and approval workflows
-- Note: 'contract' already exists from initial migration, so only adding new categories

INSERT INTO document_categories (code, label_fr, icon, allows_upload, allows_generation, requires_hr_approval, employee_can_upload, display_order)
VALUES
  ('benefit', 'Inscription avantage', 'Heart', true, false, false, false, 10),
  ('dependent', 'Document personne à charge', 'Users', true, false, false, false, 11),
  ('leave_justification', 'Justificatif de congé', 'Calendar', true, false, true, true, 12),
  ('company_document', 'Document d''entreprise', 'Building', true, false, false, false, 13)
ON CONFLICT (code) DO NOTHING;
