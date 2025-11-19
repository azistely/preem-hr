/**
 * CNPS Attestation Generator Service
 *
 * Generates PDF attestations for CNPS (Caisse Nationale de Prévoyance Sociale) contributions
 * Convention Collective Article 40 - Must be issued within 15 days
 *
 * Integrated with uploadedDocuments system for:
 * - Document versioning
 * - Electronic signature via Dropbox Sign
 * - Audit trail
 * - Advanced document management
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { CNPSAttestationPDF } from '../templates/cnps-attestation';
import { db } from '@/db';
import {
  employees,
  employeeTerminations,
  tenants,
  payrollLineItems,
  payrollRuns,
  uploadedDocuments,
} from '@/drizzle/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { sendTerminationNotification } from './termination-notifications.service';

// Lazy-load Supabase client to avoid initialization errors when env vars are missing
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface GenerateCNPSAttestationInput {
  terminationId: string;
  tenantId: string;
  issuedBy: string; // Name of the person issuing the attestation
  uploadedByUserId: string; // User ID generating the document
  versionNotes?: string; // Notes for this version (if regenerating)
}

/**
 * Generate CNPS attestation PDF and upload to Supabase Storage
 */
export async function generateCNPSAttestation(input: GenerateCNPSAttestationInput) {
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
      employeeNumber: employees.employeeNumber,
      cnpsNumber: employees.cnpsNumber,
      hireDate: employees.hireDate,
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
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Extract company info from tenant settings
  const tenantSettings = tenant.settings as any;
  const companyInfo = tenantSettings?.company || {};
  const legalInfo = tenantSettings?.legal || {};

  // 4. Fetch all payroll line items for employee during employment period
  const contributions = await db
    .select({
      period: payrollRuns.periodStart,
      baseSalary: payrollLineItems.baseSalary,
      cnpsEmployee: payrollLineItems.cnpsEmployee,
      cnpsEmployer: payrollLineItems.cnpsEmployer,
    })
    .from(payrollLineItems)
    .innerJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollLineItems.employeeId, termination.employeeId),
        eq(payrollLineItems.tenantId, input.tenantId),
        gte(payrollRuns.periodStart, employee.hireDate),
        lte(payrollRuns.periodStart, termination.terminationDate),
        eq(payrollRuns.status, 'paid') // Only include paid payrolls
      )
    )
    .orderBy(desc(payrollRuns.periodStart));

  // Note: It's valid to have zero contributions if employee was terminated before any payroll was run
  // The attestation should still be generated, showing zero contributions

  // 5. Calculate totals
  let totalEmployeeContribution = 0;
  let totalEmployerContribution = 0;

  const contributionsData = contributions.map((c) => {
    const empContrib = parseFloat(c.cnpsEmployee || '0');
    const empyContrib = parseFloat(c.cnpsEmployer || '0');
    const total = empContrib + empyContrib;

    totalEmployeeContribution += empContrib;
    totalEmployerContribution += empyContrib;

    // Format period as YYYY-MM
    const periodDate = new Date(c.period);
    const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;

    return {
      period,
      employeeContribution: empContrib,
      employerContribution: empyContrib,
      totalContribution: total,
      baseSalary: parseFloat(c.baseSalary),
    };
  });

  const grandTotal = totalEmployeeContribution + totalEmployerContribution;

  // 6. Prepare PDF data
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
    companyName: companyInfo?.legalName || tenant.name,
    companyAddress: companyInfo?.address || '',
    companyCity: '', // TODO: Extract city from address if needed
    companyCountry: countryNames[tenant.countryCode] || tenant.countryCode,
    companyCNPSNumber: legalInfo?.socialSecurityNumber || 'Non renseigné',
    employeeFirstName: employee.firstName,
    employeeLastName: employee.lastName,
    employeeCNPSNumber: employee.cnpsNumber || 'Non renseigné',
    employeeMatricule: employee.employeeNumber,
    hireDate: employee.hireDate,
    terminationDate: termination.terminationDate,
    contributions: contributionsData,
    totalEmployeeContribution,
    totalEmployerContribution,
    grandTotal,
    issueDate: new Date().toISOString().split('T')[0],
    issuedBy: input.issuedBy,
  };

  // 7. Generate PDF
  const pdfBuffer = await renderToBuffer(
    CNPSAttestationPDF({ data: pdfData })
  );

  // 8. Check if document already exists (for versioning)
  const existingDocumentId = termination.cnpsAttestationDocumentId;
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

  // 9. Upload to Supabase Storage
  const fileName = `cnps-attestations/${input.tenantId}/${termination.employeeId}_v${versionNumber}_${Date.now()}.pdf`;
  const supabase = getSupabaseClient();

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload CNPS attestation: ${uploadError.message}`);
  }

  // 10. Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // 11. Create record in uploadedDocuments
  const [uploadedDocument] = await db
    .insert(uploadedDocuments)
    .values({
      tenantId: input.tenantId,
      employeeId: termination.employeeId,
      documentCategory: 'cnps_attestation',
      documentSubcategory: null,
      fileName: `Attestation_CNPS_${employee.lastName}_${employee.firstName}_v${versionNumber}.pdf`,
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
        employmentPeriod: {
          hireDate: employee.hireDate,
          terminationDate: termination.terminationDate,
        },
        contributions: {
          count: contributions.length,
          totalEmployeeContribution,
          totalEmployerContribution,
          grandTotal,
        },
        issuedBy: input.issuedBy,
        issueDate: new Date().toISOString().split('T')[0],
      },
    })
    .returning();

  // 12. Update termination record with document ID and URL (dual system for backward compatibility)
  await db
    .update(employeeTerminations)
    .set({
      cnpsAttestationDocumentId: uploadedDocument.id,
      cnpsAttestationUrl: publicUrl, // Keep for backward compatibility
      cnpsAttestationGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    );

  // 13. Send email notification
  try {
    await sendTerminationNotification({
      terminationId: input.terminationId,
      tenantId: input.tenantId,
      documentType: 'cnps_attestation',
    });
  } catch (error) {
    // Log error but don't fail the generation
    console.error('[CNPS Attestation] Failed to send email notification:', error);
  }

  return {
    documentId: uploadedDocument.id,
    url: publicUrl,
    fileName: uploadedDocument.fileName,
    versionNumber,
    generatedAt: new Date().toISOString(),
    isNewVersion: versionNumber > 1,
    contributionsCount: contributions.length,
    totalAmount: grandTotal,
  };
}
