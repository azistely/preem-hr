/**
 * Termination Notifications Service
 *
 * Sends email notifications when termination documents are generated
 */

import { db } from '@/db';
import {
  employees,
  employeeTerminations,
  tenants,
  users,
} from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/client';
import {
  generateEmployeeTerminationEmail,
  generateHRTerminationEmail,
} from '@/lib/email/templates/termination-documents';

interface SendTerminationNotificationInput {
  terminationId: string;
  tenantId: string;
  documentType: 'work_certificate' | 'cnps_attestation' | 'final_payslip' | 'all';
}

/**
 * Send notification to employee and HR when termination documents are ready
 */
export async function sendTerminationNotification(input: SendTerminationNotificationInput) {
  // 1. Fetch termination record with all documents
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

  // 2. Fetch employee details (including email)
  const [employee] = await db
    .select({
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, termination.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  if (!employee || !employee.email) {
    console.warn(`[Termination Notification] No email found for employee ${termination.employeeId}`);
    return {
      success: false,
      error: 'Employee email not found',
    };
  }

  // 3. Fetch tenant/company info
  const [tenant] = await db
    .select({
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // 4. Prepare document data based on what's available
  const documents: any = {};

  if (termination.workCertificateUrl) {
    documents.workCertificate = {
      url: termination.workCertificateUrl,
      generatedAt: termination.workCertificateGeneratedAt || new Date().toISOString(),
    };
  }

  if (termination.cnpsAttestationUrl) {
    documents.cnpsAttestation = {
      url: termination.cnpsAttestationUrl,
      generatedAt: termination.cnpsAttestationGeneratedAt || new Date().toISOString(),
    };
  }

  if (termination.finalPayslipUrl) {
    documents.finalPayslip = {
      url: termination.finalPayslipUrl,
      generatedAt: termination.finalPayslipGeneratedAt || new Date().toISOString(),
      netAmount: parseFloat(termination.severanceAmount || '0') + parseFloat(termination.vacationPayoutAmount || '0'),
    };
  }

  // Only send email if we have at least one document
  if (Object.keys(documents).length === 0) {
    console.warn(`[Termination Notification] No documents available for termination ${input.terminationId}`);
    return {
      success: false,
      error: 'No documents available to send',
    };
  }

  const emailData = {
    employeeFirstName: employee.firstName,
    employeeLastName: employee.lastName,
    companyName: tenant.name,
    terminationDate: termination.terminationDate,
    documents,
  };

  // 5. Send email to employee
  const employeeEmailHtml = generateEmployeeTerminationEmail(emailData);

  const employeeEmailResult = await sendEmail({
    to: employee.email,
    subject: `Documents de cessation de contrat - ${tenant.name}`,
    html: employeeEmailHtml,
  });

  // 6. Send email to HR (if configured)
  // TODO: Add HR email field to tenants table
  // let hrEmailResult = null;
  // const hrEmail = tenant.hrEmail || tenant.email;

  // if (hrEmail) {
  //   const hrEmailHtml = generateHRTerminationEmail({
  //     ...emailData,
  //     hrRecipient: 'Équipe RH',
  //   });

  //   hrEmailResult = await sendEmail({
  //     to: hrEmail,
  //     subject: `[RH] Documents de cessation générés - ${employee.firstName} ${employee.lastName}`,
  //     html: hrEmailHtml,
  //   });
  // }

  return {
    success: employeeEmailResult.success,
    employeeEmail: {
      sent: employeeEmailResult.success,
      to: employee.email,
    },
    // hrEmail: hrEmail ? {
    //   sent: hrEmailResult?.success || false,
    //   to: hrEmail,
    // } : null,
  };
}

/**
 * Send notification when all documents are ready (final notification)
 */
export async function sendCompleteTerminationNotification(input: Omit<SendTerminationNotificationInput, 'documentType'>) {
  return sendTerminationNotification({
    ...input,
    documentType: 'all',
  });
}
