/**
 * CNPS Attestation Generator Service
 *
 * Generates PDF attestations for CNPS (Caisse Nationale de Prévoyance Sociale) contributions
 * Convention Collective Article 40 - Must be issued within 15 days
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

  if (contributions.length === 0) {
    throw new Error('No CNPS contributions found for this employee');
  }

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

  // 8. Upload to Supabase Storage
  const fileName = `cnps-attestations/${input.tenantId}/${termination.employeeId}_${Date.now()}.pdf`;
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

  // 9. Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // 10. Update termination record with document URL
  await db
    .update(employeeTerminations)
    .set({
      cnpsAttestationUrl: publicUrl,
      cnpsAttestationGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(employeeTerminations.id, input.terminationId),
        eq(employeeTerminations.tenantId, input.tenantId)
      )
    );

  // 11. Send email notification
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
    url: publicUrl,
    fileName,
    generatedAt: new Date().toISOString(),
    contributionsCount: contributions.length,
    totalAmount: grandTotal,
  };
}
