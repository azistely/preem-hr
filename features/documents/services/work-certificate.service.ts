/**
 * Work Certificate Generator Service
 *
 * Generates PDF work certificates (Certificat de Travail) for terminated employees
 * Convention Collective Article 40 - Must be issued within 48 hours
 *
 * Integrated with uploadedDocuments system for:
 * - Document versioning
 * - Electronic signature via Dropbox Sign
 * - Audit trail
 * - Advanced document management
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { WorkCertificatePDF } from '../templates/work-certificate';
import { db } from '@/db';
import { employees, assignments, positions, tenants, employeeTerminations, uploadedDocuments } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { sendTerminationNotification } from './termination-notifications.service';

// Lazy-load Supabase client to avoid initialization errors when env vars are missing
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface GenerateWorkCertificateInput {
  terminationId: string;
  tenantId: string;
  issuedBy: string; // Name of the person issuing the certificate
  uploadedByUserId: string; // User ID generating the document
  versionNotes?: string; // Notes for this version (if regenerating)
}

/**
 * Generate work certificate PDF and upload to Supabase Storage
 */
export async function generateWorkCertificate(input: GenerateWorkCertificateInput) {
  console.log('[Work Certificate] Starting generation with input:', input);

  // 1. Fetch termination record
  const [termination] = await db
    .select()
    .from(employeeTerminations)
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!termination) {
    throw new Error('Termination not found');
  }

  // 2. Fetch employee details
  const [employee] = await db
    .select({
      firstName: employees.firstName,
      lastName: employees.lastName,
      dateOfBirth: employees.dateOfBirth,
      hireDate: employees.hireDate,
      coefficient: employees.coefficient,
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, termination.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new Error('Employee not found');
  }

  // 3. Fetch tenant/company info
  const [tenant] = await db
    .select({
      name: tenants.name,
      countryCode: tenants.countryCode,
    })
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // 4. Fetch all positions held during employment
  const employeeAssignments = await db
    .select({
      positionTitle: positions.title,
      startDate: assignments.effectiveFrom,
      endDate: assignments.effectiveTo,
    })
    .from(assignments)
    .innerJoin(positions, eq(assignments.positionId, positions.id))
    .where(
      and(
        eq(assignments.employeeId, termination.employeeId),
        eq(assignments.tenantId, input.tenantId)
      )
    )
    .orderBy(assignments.effectiveFrom);

  // 5. Prepare PDF data
  console.log('[Work Certificate] Employee assignments:', employeeAssignments);
  console.log('[Work Certificate] Employee data:', employee);
  console.log('[Work Certificate] Tenant data:', tenant);
  console.log('[Work Certificate] Termination data:', termination);

  // Map country code to full country name
  const countryNames: Record<string, string> = {
    'CI': 'Côte d\'Ivoire',
    'SN': 'Sénégal',
    'BF': 'Burkina Faso',
    'ML': 'Mali',
    'TG': 'Togo',
    'BJ': 'Bénin',
  };

  const pdfData = {
    companyName: tenant.name,
    companyAddress: '', // Address not stored in tenant table
    companyCity: '', // City not stored in tenant table
    companyCountry: countryNames[tenant.countryCode] || tenant.countryCode,
    employeeFirstName: employee.firstName,
    employeeLastName: employee.lastName,
    employeeDateOfBirth: employee.dateOfBirth || '',
    hireDate: employee.hireDate,
    terminationDate: termination.terminationDate,
    terminationReason: termination.terminationReason,
    positions: employeeAssignments.map(a => ({
      title: a.positionTitle,
      category: 'N/A', // Category not tracked per position
      coefficient: employee.coefficient,
      startDate: a.startDate,
      endDate: a.endDate || null,
    })),
    issueDate: new Date().toISOString().split('T')[0],
    issuedBy: input.issuedBy,
  };

  // 6. Generate PDF
  console.log('[Work Certificate] PDF Data:', JSON.stringify(pdfData, null, 2));
  const pdfBuffer = await renderToBuffer(
    WorkCertificatePDF({ data: pdfData })
  );

  // 7. Check if document already exists (for versioning)
  const existingDocumentId = termination.workCertificateDocumentId;
  let parentDocumentId = null;
  let versionNumber = 1;

  if (existingDocumentId) {
    // Regenerating - create new version
    const [existingDoc] = await db
      .select()
      .from(uploadedDocuments)
      .where(eq(uploadedDocuments.id, existingDocumentId))
      .limit(1);

    if (existingDoc) {
      parentDocumentId = existingDoc.parentDocumentId || existingDoc.id;
      versionNumber = existingDoc.versionNumber + 1;

      // Mark old version as superseded
      await db
        .update(uploadedDocuments)
        .set({
          isLatestVersion: false,
          supersededAt: new Date().toISOString(),
          supersededById: input.uploadedByUserId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(uploadedDocuments.id, existingDocumentId));
    }
  }

  // 8. Upload to Supabase Storage
  const fileName = `work-certificates/${input.tenantId}/${termination.employeeId}_v${versionNumber}_${Date.now()}.pdf`;
  const supabase = getSupabaseClient();

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload work certificate: ${uploadError.message}`);
  }

  // 9. Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // 10. Create record in uploadedDocuments
  const [uploadedDocument] = await db
    .insert(uploadedDocuments)
    .values({
      tenantId: input.tenantId,
      employeeId: termination.employeeId,
      documentCategory: 'work_certificate',
      documentSubcategory: null,
      fileName: `Certificat_Travail_${employee.lastName}_${employee.firstName}_v${versionNumber}.pdf`,
      fileUrl: publicUrl,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      uploadedBy: input.uploadedByUserId,
      versionNumber: versionNumber,
      parentDocumentId: parentDocumentId,
      isLatestVersion: true,
      versionNotes: input.versionNotes || (versionNumber > 1 ? 'Nouvelle version générée' : 'Version initiale'),
      approvalStatus: 'approved', // Auto-approved (generated by system)
      approvedBy: input.uploadedByUserId,
      approvedAt: new Date().toISOString(),
      metadata: {
        terminationId: input.terminationId,
        terminationDate: termination.terminationDate,
        terminationReason: termination.terminationReason,
        issuedBy: input.issuedBy,
        issueDate: new Date().toISOString().split('T')[0],
      },
    })
    .returning();

  // 11. Update termination record with document ID and URL (dual system for backward compatibility)
  await db
    .update(employeeTerminations)
    .set({
      workCertificateDocumentId: uploadedDocument.id,
      workCertificateUrl: publicUrl, // Keep for backward compatibility
      workCertificateGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    );

  // 12. Send email notification
  try {
    await sendTerminationNotification({
      terminationId: input.terminationId,
      tenantId: input.tenantId,
      documentType: 'work_certificate',
    });
  } catch (error) {
    // Log error but don't fail the generation
    console.error('[Work Certificate] Failed to send email notification:', error);
  }

  return {
    documentId: uploadedDocument.id,
    url: publicUrl,
    fileName: uploadedDocument.fileName,
    versionNumber,
    generatedAt: new Date().toISOString(),
    isNewVersion: versionNumber > 1,
  };
}

/**
 * Download work certificate as buffer (for email attachments)
 */
export async function getWorkCertificateBuffer(terminationId: string, tenantId: string) {
  // Similar to generateWorkCertificate but returns buffer instead of uploading
  // Implementation can reuse the data fetching logic
  // This is useful for email attachments

  // TODO: Implement when email notification system is ready
  throw new Error('Not implemented yet');
}
