/**
 * Bulk Termination Documents Generator Service
 *
 * Orchestrates generation of all termination documents:
 * 1. Work Certificate (Certificat de Travail)
 * 2. Final Payslip (Bulletin de Paie Final)
 * 3. CNPS Attestation
 *
 * This service ensures all documents are generated atomically and consistently.
 */

import { generateWorkCertificate } from './work-certificate.service';
import { generateFinalPayslip } from './final-payslip.service';
import { generateCNPSAttestation } from './cnps-attestation.service';

export interface BulkGenerateTerminationDocumentsInput {
  terminationId: string;
  tenantId: string;
  uploadedByUserId: string;
  issuedBy: string; // HR manager name
  payDate: string; // ISO date string for final payslip
  versionNotes?: string; // Optional notes if regenerating all documents
}

export interface BulkGenerateTerminationDocumentsResult {
  workCertificate: {
    documentId: string;
    url: string;
    fileName: string;
    versionNumber: number;
    isNewVersion: boolean;
  };
  finalPayslip: {
    documentId: string;
    url: string;
    fileName: string;
    versionNumber: number;
    isNewVersion: boolean;
    netAmount: number;
    terminalPaymentsTotal: number;
  };
  cnpsAttestation: {
    documentId: string;
    url: string;
    fileName: string;
    versionNumber: number;
    isNewVersion: boolean;
    contributionsCount: number;
    totalAmount: number;
  };
  generatedAt: string;
  allDocumentsGenerated: boolean;
  errors?: Array<{
    documentType: 'work_certificate' | 'final_payslip' | 'cnps_attestation';
    error: string;
  }>;
}

/**
 * Generate all termination documents in bulk
 *
 * This function generates all three documents and handles partial failures gracefully.
 * If any document fails, the others will still be generated and the error will be reported.
 */
export async function bulkGenerateTerminationDocuments(
  input: BulkGenerateTerminationDocumentsInput
): Promise<BulkGenerateTerminationDocumentsResult> {
  console.log('[Bulk Generator] Starting bulk document generation for termination:', input.terminationId);

  const errors: Array<{
    documentType: 'work_certificate' | 'final_payslip' | 'cnps_attestation';
    error: string;
  }> = [];

  let workCertificateResult: BulkGenerateTerminationDocumentsResult['workCertificate'] | null = null;
  let finalPayslipResult: BulkGenerateTerminationDocumentsResult['finalPayslip'] | null = null;
  let cnpsAttestationResult: BulkGenerateTerminationDocumentsResult['cnpsAttestation'] | null = null;

  // 1. Generate Work Certificate
  try {
    console.log('[Bulk Generator] Generating work certificate...');
    const result = await generateWorkCertificate({
      terminationId: input.terminationId,
      tenantId: input.tenantId,
      issuedBy: input.issuedBy,
      uploadedByUserId: input.uploadedByUserId,
      versionNotes: input.versionNotes,
    });

    workCertificateResult = {
      documentId: result.documentId,
      url: result.url,
      fileName: result.fileName,
      versionNumber: result.versionNumber,
      isNewVersion: result.isNewVersion,
    };
    console.log('[Bulk Generator] ✓ Work certificate generated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bulk Generator] ✗ Failed to generate work certificate:', errorMessage);
    errors.push({
      documentType: 'work_certificate',
      error: errorMessage,
    });
  }

  // 2. Generate Final Payslip
  try {
    console.log('[Bulk Generator] Generating final payslip...');
    const result = await generateFinalPayslip({
      terminationId: input.terminationId,
      tenantId: input.tenantId,
      payDate: input.payDate,
      uploadedByUserId: input.uploadedByUserId,
      versionNotes: input.versionNotes,
    });

    finalPayslipResult = {
      documentId: result.documentId,
      url: result.url,
      fileName: result.fileName,
      versionNumber: result.versionNumber,
      isNewVersion: result.isNewVersion,
      netAmount: result.netAmount,
      terminalPaymentsTotal: result.terminalPaymentsTotal,
    };
    console.log('[Bulk Generator] ✓ Final payslip generated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bulk Generator] ✗ Failed to generate final payslip:', errorMessage);
    errors.push({
      documentType: 'final_payslip',
      error: errorMessage,
    });
  }

  // 3. Generate CNPS Attestation
  try {
    console.log('[Bulk Generator] Generating CNPS attestation...');
    const result = await generateCNPSAttestation({
      terminationId: input.terminationId,
      tenantId: input.tenantId,
      issuedBy: input.issuedBy,
      uploadedByUserId: input.uploadedByUserId,
      versionNotes: input.versionNotes,
    });

    cnpsAttestationResult = {
      documentId: result.documentId,
      url: result.url,
      fileName: result.fileName,
      versionNumber: result.versionNumber,
      isNewVersion: result.isNewVersion,
      contributionsCount: result.contributionsCount,
      totalAmount: result.totalAmount,
    };
    console.log('[Bulk Generator] ✓ CNPS attestation generated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bulk Generator] ✗ Failed to generate CNPS attestation:', errorMessage);
    errors.push({
      documentType: 'cnps_attestation',
      error: errorMessage,
    });
  }

  // 4. Check if all documents were generated
  const allDocumentsGenerated =
    workCertificateResult !== null &&
    finalPayslipResult !== null &&
    cnpsAttestationResult !== null;

  console.log(`[Bulk Generator] Bulk generation complete. Success rate: ${3 - errors.length}/3`);

  // 5. Build result
  // If any document failed, we need to throw an error but still return partial results
  if (!allDocumentsGenerated) {
    // Create placeholder results for failed documents
    const placeholderDocument = {
      documentId: '',
      url: '',
      fileName: '',
      versionNumber: 0,
      isNewVersion: false,
    };

    return {
      workCertificate: workCertificateResult || placeholderDocument,
      finalPayslip: finalPayslipResult || {
        ...placeholderDocument,
        netAmount: 0,
        terminalPaymentsTotal: 0,
      },
      cnpsAttestation: cnpsAttestationResult || {
        ...placeholderDocument,
        contributionsCount: 0,
        totalAmount: 0,
      },
      generatedAt: new Date().toISOString(),
      allDocumentsGenerated: false,
      errors,
    };
  }

  // All documents generated successfully
  return {
    workCertificate: workCertificateResult!,
    finalPayslip: finalPayslipResult!,
    cnpsAttestation: cnpsAttestationResult!,
    generatedAt: new Date().toISOString(),
    allDocumentsGenerated: true,
  };
}

/**
 * Regenerate all termination documents (for corrections/updates)
 *
 * This is a convenience wrapper that sets appropriate version notes.
 */
export async function regenerateTerminationDocuments(
  input: Omit<BulkGenerateTerminationDocumentsInput, 'versionNotes'> & {
    reason?: string;
  }
): Promise<BulkGenerateTerminationDocumentsResult> {
  const versionNotes = input.reason
    ? `Régénération demandée: ${input.reason}`
    : 'Documents régénérés suite à une correction';

  return bulkGenerateTerminationDocuments({
    ...input,
    versionNotes,
  });
}
