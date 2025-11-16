/**
 * Final Payslip Generator Service
 *
 * Generates PDF payslip for terminated employees with terminal payments
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { FinalPayslipPDF } from '../templates/final-payslip';
import { db } from '@/db';
import {
  employees,
  employeeTerminations,
  tenants,
  assignments,
  positions,
} from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import {
  calculateTerminalPayroll,
  type TerminalPayrollInput,
} from '@/features/payroll/services/terminal-payroll.service';
import { sendTerminationNotification } from './termination-notifications.service';

// Lazy-load Supabase client to avoid initialization errors when env vars are missing
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface GenerateFinalPayslipInput {
  terminationId: string;
  tenantId: string;
  payDate: string; // ISO date string
}

/**
 * Generate final payslip PDF and upload to Supabase Storage
 */
export async function generateFinalPayslip(input: GenerateFinalPayslipInput) {
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

  // 4. Fetch current position (effectiveTo IS NULL = current assignment)
  const [currentAssignment] = await db
    .select({
      positionTitle: positions.title,
    })
    .from(assignments)
    .innerJoin(positions, eq(assignments.positionId, positions.id))
    .where(
      and(
        eq(assignments.employeeId, termination.employeeId),
        eq(assignments.tenantId, input.tenantId)
      )
    )
    .orderBy(assignments.effectiveFrom)
    .limit(1);

  const positionTitle = currentAssignment?.positionTitle || 'Non renseigné';

  // 5. Calculate terminal payroll
  const payrollResult = await calculateTerminalPayroll({
    terminationId: input.terminationId,
    tenantId: input.tenantId,
    payDate: new Date(input.payDate),
  } as TerminalPayrollInput);

  // 6. Prepare PDF data
  const terminationDate = new Date(termination.terminationDate);
  const periodStart = new Date(terminationDate.getFullYear(), terminationDate.getMonth(), 1);

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
    // Company info
    companyName: companyInfo?.legalName || tenant.name,
    companyAddress: companyInfo?.address || '',
    companyCity: '', // TODO: Extract city from address if needed
    companyCountry: countryNames[tenant.countryCode] || tenant.countryCode,
    companyCNPSNumber: legalInfo?.socialSecurityNumber || undefined,

    // Employee info
    employeeFirstName: employee.firstName,
    employeeLastName: employee.lastName,
    employeeNumber: employee.employeeNumber,
    employeeCNPSNumber: employee.cnpsNumber || undefined,
    positionTitle,

    // Pay period
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: termination.terminationDate,
    payDate: input.payDate,
    daysWorked: payrollResult.daysWorked,
    daysInPeriod: payrollResult.daysInPeriod,

    // Earnings
    baseSalary: payrollResult.baseSalary,
    proratedBaseSalary: payrollResult.proratedBaseSalary,
    allowances: payrollResult.allowances,
    overtimePay: payrollResult.overtimePay,
    bonuses: payrollResult.bonuses,
    earningsDetails: payrollResult.earningsDetails,

    // Terminal payments
    severancePayTaxFree: payrollResult.terminalPayments.severancePayTaxFree,
    severancePayTaxable: payrollResult.terminalPayments.severancePayTaxable,
    vacationPayout: payrollResult.terminalPayments.vacationPayout,
    noticePeriodPayment: payrollResult.terminalPayments.noticePeriodPayment,

    // Deductions
    cnpsEmployee: payrollResult.cnpsEmployee,
    cmuEmployee: payrollResult.cmuEmployee,
    its: payrollResult.its,
    deductionsDetails: payrollResult.deductionsDetails,

    // Totals
    grossSalary: payrollResult.grossSalary,
    totalDeductions: payrollResult.totalDeductions,
    netSalary: payrollResult.netSalary,

    // Employer contributions
    cnpsEmployer: payrollResult.cnpsEmployer,
    cmuEmployer: payrollResult.cmuEmployer,
    totalEmployerCost: payrollResult.employerCost,

    // Document metadata
    issueDate: new Date().toISOString().split('T')[0],
    isFinalPayslip: true,
  };

  // 7. Generate PDF
  const pdfBuffer = await renderToBuffer(
    FinalPayslipPDF({ data: pdfData })
  );

  // 8. Upload to Supabase Storage
  const fileName = `final-payslips/${input.tenantId}/${termination.employeeId}_${Date.now()}.pdf`;
  const supabase = getSupabaseClient();

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload final payslip: ${uploadError.message}`);
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
      finalPayslipUrl: publicUrl,
      finalPayslipGeneratedAt: new Date().toISOString(),
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
      documentType: 'final_payslip',
    });
  } catch (error) {
    // Log error but don't fail the generation
    console.error('[Final Payslip] Failed to send email notification:', error);
  }

  return {
    url: publicUrl,
    fileName,
    generatedAt: new Date().toISOString(),
    netAmount: payrollResult.netSalary,
    terminalPaymentsTotal: payrollResult.terminalPayments.totalTerminalPayments,
  };
}
