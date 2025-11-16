/**
 * Update Documents Storage Bucket MIME Types and RLS Policies
 *
 * Fix: The original bucket only allowed PDF files, but the upload
 * service supports PDF, JPEG, PNG, and DOCX.
 *
 * Additionally, the bucket had no RLS policies, causing uploads to fail.
 *
 * This migration:
 * 1. Updates allowed_mime_types to match supported file types
 * 2. Increases file size limit from 10MB to 25MB
 * 3. Creates RLS policies to allow authenticated users to upload/manage files
 */

-- Update the documents bucket to allow all supported MIME types
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[],
  file_size_limit = 26214400 -- 25MB (increased from 10MB to match upload service)
WHERE id = 'documents';

-- Create RLS policies for documents storage bucket

-- 1. Allow authenticated users to upload files to documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 2. Allow authenticated users to read files from documents bucket
CREATE POLICY "Authenticated users can read documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- 3. Allow public read access (since bucket is public)
CREATE POLICY "Public can read documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');

-- 4. Allow authenticated users to update their uploaded files
CREATE POLICY "Authenticated users can update documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 5. Allow authenticated users to delete their uploaded files
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
