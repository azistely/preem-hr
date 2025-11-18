/**
 * Leave Certificate Generation Service
 *
 * Generates official "Attestation de départ en congés annuels" PDFs
 * Required by law to be delivered 15 days before leave starts
 */

import React from 'react';
import { db } from '@/db';
import { timeOffRequests, employees, tenants, timeOffPolicies, uploadedDocuments } from '@/drizzle/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pdf } from '@react-pdf/renderer';
import { LeaveCertificatePDF } from '@/components/exports/leave-certificate-pdf';
import { createClient } from '@/lib/supabase/server';

export interface LeaveCertificateData {
  certificateNumber: string;
  issueDate: string;
  tenant: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    position: string;
    department: string;
  };
  leave: {
    startDate: string;
    endDate: string;
    returnDate: string;
    totalDays: number;
    type: string;
  };
  handoverNotes?: string;
}

/**
 * Generate certificate PDF for a time-off request and save to document management system
 */
export async function generateLeaveCertificate(
  requestId: string,
  tenantId: string,
  userId?: string
): Promise<Blob> {
  // Fetch request with manual joins
  const results = await db
    .select({
      request: timeOffRequests,
      employee: employees,
      policy: timeOffPolicies,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
    .where(
      and(
        eq(timeOffRequests.id, requestId),
        eq(timeOffRequests.tenantId, tenantId)
      )
    )
    .limit(1);

  if (results.length === 0) {
    throw new Error('Demande de congé introuvable');
  }

  const { request, employee, policy } = results[0];

  if (request.status !== 'approved') {
    throw new Error('Le congé doit être approuvé avant de générer l\'attestation');
  }

  // Fetch tenant info
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    throw new Error('Entreprise introuvable');
  }

  // Extract company info from tenant settings
  const tenantSettings = tenant.settings as any;
  const companyInfo = tenantSettings?.company || {};

  // Build department/service info from available fields
  const departmentParts = [
    employee.division,
    employee.service,
    employee.section,
  ].filter(Boolean);
  const department = departmentParts.length > 0
    ? departmentParts.join(' - ')
    : 'Service général';

  // Build company address from settings or use taxId/businessRegistration as fallback
  const companyAddress = companyInfo?.address ||
    (tenant.businessRegistration
      ? `Registre du Commerce: ${tenant.businessRegistration}`
      : 'Abidjan, Côte d\'Ivoire');

  // Build company contact info
  const companyPhone = companyInfo?.phone || employee.phone || '+225 XX XX XX XX';
  const companyEmail = companyInfo?.email || employee.email || 'contact@entreprise.com';

  // Prepare certificate data
  const certificateData: LeaveCertificateData = {
    certificateNumber: `CERT-${employee.employeeNumber}-${format(new Date(), 'yyyyMMdd')}`,
    issueDate: format(new Date(), 'dd MMMM yyyy', { locale: fr }),
    tenant: {
      name: companyInfo?.legalName || tenant.name,
      address: companyAddress,
      phone: companyPhone,
      email: companyEmail,
    },
    employee: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      employeeNumber: employee.employeeNumber,
      position: employee.jobTitle || employee.profession || 'Employé',
      department: department,
    },
    leave: {
      startDate: format(new Date(request.startDate), 'dd MMMM yyyy', { locale: fr }),
      endDate: format(new Date(request.endDate), 'dd MMMM yyyy', { locale: fr }),
      returnDate: format(new Date(request.returnDate), 'dd MMMM yyyy', { locale: fr }),
      totalDays: Number(request.totalDays),
      type: policy.name,
    },
    handoverNotes: request.handoverNotes || undefined,
  };

  // Generate PDF
  const doc = React.createElement(LeaveCertificatePDF, { data: certificateData });
  const blob = await pdf(doc as any).toBlob();

  // Upload to Supabase Storage
  const fileName = `attestation-conge-${employee.employeeNumber}-${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
  const storagePath = `${tenantId}/uploaded/leave_certificates/${employee.id}/${fileName}`;

  const supabase = await createClient();
  const fileBuffer = await blob.arrayBuffer();
  const fileSize = fileBuffer.byteLength;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[Leave Certificate] Storage upload error:', uploadError);
    throw new Error(`Échec du téléchargement du certificat: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(storagePath);
  const fileUrl = urlData.publicUrl;

  // Create database record in uploadedDocuments (advanced document management)
  // This gives access to e-signature, versioning, approval workflow, etc.
  try {
    const now = new Date().toISOString();
    await db.insert(uploadedDocuments).values({
      tenantId,
      employeeId: employee.id,
      documentCategory: 'leave_certificates',
      documentSubcategory: 'annual_leave_certificate',
      fileName,
      fileUrl,
      fileSize,
      mimeType: 'application/pdf',
      uploadedBy: userId || 'system',
      uploadedAt: now,
      approvalStatus: 'approved', // Auto-approved (system-generated)
      approvedBy: userId,
      approvedAt: now,
      tags: ['system_generated', 'leave_certificate', `request_${requestId}`],
      metadata: {
        generatedFrom: 'time_off_request',
        requestId,
        certificateNumber: certificateData.certificateNumber,
        leaveStartDate: request.startDate,
        leaveEndDate: request.endDate,
        totalDays: Number(request.totalDays),
        policyName: policy.name,
        employeeNumber: employee.employeeNumber,
      },
    });

    console.log('[Leave Certificate] Document saved to advanced document management:', fileName);
  } catch (dbError) {
    console.error('[Leave Certificate] Database record error:', dbError);
    // Roll back storage upload if DB insert fails
    await supabase.storage.from('documents').remove([storagePath]);
    throw new Error('Échec de l\'enregistrement du certificat dans la base de données');
  }

  // Mark certificate as generated on the time-off request
  await db.update(timeOffRequests)
    .set({ certificateGeneratedAt: new Date().toISOString() })
    .where(eq(timeOffRequests.id, requestId));

  return blob;
}

/**
 * Get all requests that need certificates generated (15 days before start)
 */
export async function getRequestsNeedingCertificates(
  tenantId: string
): Promise<Array<{ id: string; employeeName: string; startDate: string }>> {
  const today = new Date();
  const fifteenDaysFromNow = addDays(today, 15);
  const sixteenDaysFromNow = addDays(today, 16);

  const { isNull } = await import('drizzle-orm');

  const results = await db
    .select({
      request: timeOffRequests,
      employee: employees,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(
      and(
        eq(timeOffRequests.tenantId, tenantId),
        eq(timeOffRequests.status, 'approved'),
        gte(timeOffRequests.startDate, fifteenDaysFromNow.toISOString().split('T')[0]),
        lte(timeOffRequests.startDate, sixteenDaysFromNow.toISOString().split('T')[0]),
        // Only if certificate not already generated
        isNull(timeOffRequests.certificateGeneratedAt)
      )
    );

  return results.map(({ request, employee }) => ({
    id: request.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    startDate: request.startDate,
  }));
}

/**
 * Bulk generate certificates for all eligible requests
 */
export async function bulkGenerateCertificates(
  tenantId: string
): Promise<{ success: number; errors: Array<{ requestId: string; error: string }> }> {
  const requests = await getRequestsNeedingCertificates(tenantId);

  const result = {
    success: 0,
    errors: [] as Array<{ requestId: string; error: string }>,
  };

  for (const request of requests) {
    try {
      await generateLeaveCertificate(request.id, tenantId);
      result.success++;
    } catch (error) {
      result.errors.push({
        requestId: request.id,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    }
  }

  return result;
}
