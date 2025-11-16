/**
 * Backfill Script: Convert Dependent Coverage Certificates to Document Records
 *
 * This script finds all employee_dependents with coverage_certificate_url
 * and creates corresponding records in uploaded_documents table.
 *
 * Run with: npx tsx scripts/backfill-dependent-documents.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { db } from '@/lib/db';
import { employeeDependents, uploadedDocuments } from '@/drizzle/schema';
import { isNotNull, eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

// Supabase config from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillDependentDocuments() {
  console.log('[Backfill] Starting dependent document backfill...\n');

  // Find all dependents with coverage certificate URLs
  const dependentsWithDocs = await db
    .select()
    .from(employeeDependents)
    .where(isNotNull(employeeDependents.coverageCertificateUrl));

  console.log(`Found ${dependentsWithDocs.length} dependents with coverage certificates\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const dependent of dependentsWithDocs) {
    try {
      // Check if document record already exists
      const existing = await db
        .select()
        .from(uploadedDocuments)
        .where(eq(uploadedDocuments.fileUrl, dependent.coverageCertificateUrl!))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Skipping: Document already exists for ${dependent.firstName} ${dependent.lastName}`);
        skipped++;
        continue;
      }

      // Extract file path from URL
      const url = new URL(dependent.coverageCertificateUrl!);
      const pathMatch = url.pathname.match(/\/documents\/(.+)$/);

      if (!pathMatch) {
        console.log(`❌ Failed: Could not parse URL for ${dependent.firstName} ${dependent.lastName}`);
        failed++;
        continue;
      }

      const filePath = pathMatch[1];

      // Get file metadata from storage
      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .list(filePath.substring(0, filePath.lastIndexOf('/')), {
          search: filePath.substring(filePath.lastIndexOf('/') + 1),
        });

      if (fileError || !fileData || fileData.length === 0) {
        console.log(`❌ Failed: File not found in storage for ${dependent.firstName} ${dependent.lastName}`);
        console.log(`   URL: ${dependent.coverageCertificateUrl}`);
        failed++;
        continue;
      }

      const file = fileData[0];
      const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

      // Create permanent document record
      await db.insert(uploadedDocuments).values({
        tenantId: dependent.tenantId,
        employeeId: dependent.employeeId!,
        documentCategory: 'medical',
        documentSubcategory: 'coverage_certificate',
        fileName: fileName,
        fileUrl: dependent.coverageCertificateUrl!,
        fileSize: file.metadata?.size || 0,
        mimeType: file.metadata?.mimetype || 'application/octet-stream',
        uploadedBy: dependent.createdBy!,
        approvalStatus: 'approved',
        metadata: {
          dependentName: `${dependent.firstName} ${dependent.lastName}`,
          backfilled: true,
          backfilledAt: new Date().toISOString(),
          documentDescription: `Attestation de couverture - ${dependent.firstName} ${dependent.lastName}`,
        },
        tags: ['dependent', 'coverage', 'backfilled'],
      });

      console.log(`✅ Created: Document record for ${dependent.firstName} ${dependent.lastName}`);
      console.log(`   File: ${fileName}`);
      console.log(`   Employee ID: ${dependent.employeeId}\n`);
      created++;
    } catch (error) {
      console.error(`❌ Error processing ${dependent.firstName} ${dependent.lastName}:`, error);
      failed++;
    }
  }

  console.log('\n=================================');
  console.log('Backfill Complete');
  console.log('=================================');
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${dependentsWithDocs.length}`);
}

// Run the backfill
backfillDependentDocuments()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
