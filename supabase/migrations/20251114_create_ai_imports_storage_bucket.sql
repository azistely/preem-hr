/**
 * Create Supabase Storage Bucket for AI-Powered Import Files
 *
 * This bucket will store:
 * - Excel files (.xlsx, .xls) uploaded by users for AI import
 * - Temporary storage during import analysis and processing
 * - Files are automatically scoped by tenantId/userId for security
 *
 * Security:
 * - Private bucket (files not publicly accessible)
 * - RLS policies enforce tenant isolation
 * - Files stored with path: {tenantId}/{userId}/{timestamp}-{filename}
 */

-- Create storage bucket for AI imports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-imports',
  'ai-imports',
  false, -- Private bucket (requires authentication)
  52428800, -- 50MB max file size (for large Excel files)
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- .xlsx
    'application/vnd.ms-excel'  -- .xls
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload files to their own tenant directory
CREATE POLICY "Users can upload to their tenant directory"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-imports'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'app_metadata')::jsonb ->> 'tenant_id'
);

-- RLS Policy: Users can read files from their own tenant directory
CREATE POLICY "Users can read from their tenant directory"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-imports'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'app_metadata')::jsonb ->> 'tenant_id'
);

-- RLS Policy: Users can delete files from their own tenant directory
CREATE POLICY "Users can delete from their tenant directory"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-imports'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'app_metadata')::jsonb ->> 'tenant_id'
);

-- RLS Policy: Service role has full access (for server-side operations)
CREATE POLICY "Service role has full access to ai-imports"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'ai-imports')
WITH CHECK (bucket_id = 'ai-imports');
