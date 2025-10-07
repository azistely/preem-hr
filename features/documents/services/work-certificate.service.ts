/**
 * Work Certificate Generator Service
 *
 * Generates PDF work certificates (Certificat de Travail) for terminated employees
 * Convention Collective Article 40 - Must be issued within 48 hours
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { WorkCertificatePDF } from '../templates/work-certificate';
import { db } from '@/db';
import { employees, assignments, positions, tenants, employeeTerminations } from '@/drizzle/schema';
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

  // 7. Upload to Supabase Storage
  const fileName = `work-certificates/${input.tenantId}/${termination.employeeId}_${Date.now()}.pdf`;
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

  // 8. Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // 9. Update termination record with document URL
  await db
    .update(employeeTerminations)
    .set({
      workCertificateUrl: publicUrl,
      workCertificateGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    );

  // 10. Send email notification
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
    url: publicUrl,
    fileName,
    generatedAt: new Date().toISOString(),
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
