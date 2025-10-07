/**
 * Create Supabase Storage Bucket for Employee Documents
 *
 * This bucket will store:
 * - Work certificates (Certificat de Travail)
 * - CNPS attestations
 * - Final payslips
 * - Other termination documents
 *
 * NOTE: Storage bucket policies must be configured via Supabase Dashboard
 * Storage > Settings > Policies
 *
 * Required policies:
 * 1. Public read access (bucket_id = 'documents')
 * 2. Service role full access for server-side uploads
 */

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true, -- Public bucket (documents can be accessed via public URL)
  10485760, -- 10MB max file size
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;
