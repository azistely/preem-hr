/**
 * Contract Document Generation Service
 *
 * Generates PDF contract documents (CDI, CDD, CDDTI) with:
 * - Auto-populated employee/company data
 * - French legal clauses
 * - Electronic signature integration
 * - Document versioning via uploadedDocuments
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { CDIContractPDF } from './templates/cdi-contract';
import { CDDContractPDF } from './templates/cdd-contract';
import { CDDTIContractPDF } from './templates/cddti-contract';
import { generateContractPdf } from './html-to-pdf.service';
import { db } from '@/db';
import {
  employees,
  tenants,
  employmentContracts,
  positions,
  uploadedDocuments,
} from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

// Lazy-load Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface GenerateContractDocumentInput {
  contractId: string;
  tenantId: string;
  uploadedByUserId: string;
  companyRepresentative: string;
  companyRepresentativeTitle: string;
  versionNotes?: string;
}

/**
 * Generate contract PDF and upload to Supabase Storage
 */
export async function generateContractDocument(input: GenerateContractDocumentInput) {
  console.log('[Contract Document] Starting generation with input:', input);

  // 1. Fetch contract details
  console.log('[Contract Document] About to fetch contract...');
  const [contract] = await db
    .select()
    .from(employmentContracts)
    .where(
      and(
        eq(employmentContracts.id, input.contractId),
        eq(employmentContracts.tenantId, input.tenantId)
      )
    )
    .limit(1);

  console.log('[Contract Document] Contract fetched successfully');

  if (!contract) {
    throw new Error('Contract not found');
  }

  // 2. Fetch employee details
  console.log('[Contract Document] About to fetch employee...');
  const [employee] = await db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      dateOfBirth: employees.dateOfBirth,
      addressLine1: employees.addressLine1, // Fixed: use addressLine1 instead of address
      city: employees.city,
      nationalId: employees.nationalId,
      // Note: positionId is NOT on employees table - it's in employee_position_assignments
      // Note: baseSalary is in employeeSalaries table
      // Note: weeklyHours is in positions table
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, contract.employeeId),
        eq(employees.tenantId, input.tenantId)
      )
    )
    .limit(1);

  console.log('[Contract Document] Employee fetched successfully');

  if (!employee) {
    throw new Error('Employee not found');
  }

  // Validate employee has required fields
  if (!employee.firstName || !employee.lastName) {
    throw new Error('Employee first name and last name are required for document generation');
  }

  // 3. Position details
  // Note: positionId is in employee_position_assignments table, not employees table
  // For now, using default values
  // TODO: Fetch position via join with employee_position_assignments table
  let positionTitle = 'Non spécifié';
  let positionDescription = '';
  let department: string | undefined = undefined;

  // 4. Fetch tenant/company info
  const [tenant] = await db
    .select({
      name: tenants.name,
      countryCode: tenants.countryCode,
      businessRegistration: tenants.businessRegistration,
      taxId: tenants.taxId,
    })
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // Validate tenant has required fields
  if (!tenant.name) {
    throw new Error('Tenant name is required for document generation');
  }

  const countryNames: Record<string, string> = {
    CI: 'Côte d\'Ivoire',
    SN: 'Sénégal',
    BF: 'Burkina Faso',
    ML: 'Mali',
  };

  // Safe countryCode handling
  const safeCountryCode = tenant.countryCode || 'CI'; // Default to CI if null

  // 5. Prepare template data based on contract type
  if (!['CDI', 'CDD', 'CDDTI'].includes(contract.contractType)) {
    throw new Error(`Contract type "${contract.contractType}" is not supported for document generation. Supported types: CDI, CDD, CDDTI`);
  }

  // Base contract data (common to all types)
  const year = new Date().getFullYear();
  const contractData = {
    // Contract metadata
    contractNumber: contract.contractNumber || `${contract.contractType}-${year}-${contract.id.slice(0, 8)}`,
    contractDate: contract.signedDate || new Date().toISOString(),

    // Employer
    companyName: tenant.name,
    companyAddress: 'Adresse du siège social', // TODO: Add address field to tenants table
    companyCity: countryNames[safeCountryCode] || safeCountryCode, // Use country name as placeholder
    companyCountry: countryNames[safeCountryCode] || safeCountryCode,
    companyRegistrationNumber: tenant.businessRegistration || tenant.taxId || undefined,
    companyRepresentative: input.companyRepresentative,
    companyRepresentativeTitle: input.companyRepresentativeTitle,

    // Employee
    employeeFirstName: employee.firstName,
    employeeLastName: employee.lastName,
    employeeAddress: employee.addressLine1 || 'Adresse non renseignée', // Fixed: use addressLine1
    employeeCity: employee.city || 'Ville non renseignée',
    employeeDateOfBirth: employee.dateOfBirth || new Date().toISOString(),
    employeeNationalId: employee.nationalId || undefined,

    // Position
    positionTitle,
    positionDescription: positionDescription || `Exercer les fonctions de ${positionTitle} conformément aux directives de la Direction.`,
    department,
    workLocation: 'Siège social', // TODO: Add location field to tenants or positions table

    // Remuneration
    // Note: baseSalary should come from employeeSalaries table
    // For now, using 0 as fallback - TODO: fetch from employeeSalaries
    baseSalary: 0,
    salaryPeriod: 'mensuel' as const,
    currency: 'FCFA',
    benefits: undefined,

    // Working conditions
    // Note: weeklyHours should come from positions table
    // For now, using default 40 hours - TODO: fetch from positions
    weeklyHours: 40,
    workSchedule: 'Du lundi au vendredi, de 8h00 à 17h00',
    probationPeriod: 3, // Default 3 months for CDI
    noticePeriod: 30, // Default 30 days

    // Contract start
    startDate: contract.startDate || new Date().toISOString(),

    // CDD-specific fields
    ...(contract.contractType === 'CDD' && contract.endDate && {
      endDate: contract.endDate,
      cddReason: contract.cddReason || 'other',
      renewalCount: contract.renewalCount || 0,
    }),

    // CDDTI-specific fields
    ...(contract.contractType === 'CDDTI' && contract.endDate && {
      endDate: contract.endDate,
      cddtiTaskDescription: contract.cddtiTaskDescription || 'Mission temporaire',
    }),

    // Optional clauses
    collectiveAgreement: undefined,
    additionalClauses: contract.notes ? [contract.notes] : undefined,
  };

  // 6. Generate PDF based on contract type
  console.log('[Contract Document] Generating PDF for contract type:', contract.contractType);
  console.log('[Contract Document] Contract HTML content exists:', !!contract.contractHtmlContent);
  console.log('[Contract Document] Contract HTML content length:', contract.contractHtmlContent?.length || 0);

  let pdfBuffer: Buffer;

  // Check if contract has HTML content (new approach with Word-like editor)
  if (contract.contractHtmlContent && contract.contractHtmlContent.trim().length > 0) {
    console.log('[Contract Document] Using HTML template for PDF generation');

    try {
      // Validate required data before generating PDF
      if (!employee.firstName || !employee.lastName) {
        throw new Error('Employee name is required');
      }
      if (!tenant.name) {
        throw new Error('Company name is required');
      }
      if (!contract.contractType) {
        throw new Error('Contract type is required');
      }

      pdfBuffer = await generateContractPdf(contract.contractHtmlContent, {
        contractNumber: contractData.contractNumber,
        contractType: contract.contractType,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        companyName: tenant.name,
      });
    } catch (error) {
      console.error('[Contract Document] Error generating PDF from HTML:', error);
      console.error('[Contract Document] Contract data:', {
        contractNumber: contractData.contractNumber,
        contractType: contract.contractType,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        companyName: tenant.name,
      });
      throw new Error(`Failed to generate PDF from HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.log('[Contract Document] Using React-PDF template (fallback)');

    // Fallback to existing React-PDF template generation (backward compatibility)
    switch (contract.contractType) {
      case 'CDI':
        pdfBuffer = await renderToBuffer(
          CDIContractPDF({ data: contractData })
        );
        break;

      case 'CDD':
        pdfBuffer = await renderToBuffer(
          CDDContractPDF({ data: contractData as any }) // Type assertion needed for conditional fields
        );
        break;

      case 'CDDTI':
        pdfBuffer = await renderToBuffer(
          CDDTIContractPDF({ data: contractData as any }) // Type assertion needed for conditional fields
        );
        break;

      default:
        throw new Error(`Unsupported contract type: ${contract.contractType}`);
    }
  }

  // 7. Upload to Supabase Storage
  const supabase = getSupabaseClient();
  const fileName = `contract_${contract.id}_${Date.now()}.pdf`;
  const filePath = `${input.tenantId}/contracts/${fileName}`;

  console.log('[Contract Document] Uploading to Supabase Storage:', filePath);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[Contract Document] Upload error:', uploadError);
    throw new Error(`Failed to upload document: ${uploadError.message}`);
  }

  // 8. Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  const fileUrl = urlData.publicUrl;

  // 9. Create uploaded_documents record
  console.log('[Contract Document] Creating uploaded_documents record...');

  const [uploadedDoc] = await db
    .insert(uploadedDocuments)
    .values({
      tenantId: input.tenantId,
      employeeId: contract.employeeId,
      documentCategory: 'contracts', // Use documentCategory instead of documentType
      documentSubcategory: contract.contractType, // CDI, CDD, or CDDTI
      fileName: fileName,
      fileUrl: fileUrl,
      fileSize: pdfBuffer.length,
      mimeType: 'application/pdf',
      versionNumber: 1, // First version
      isLatestVersion: true,
      uploadedBy: input.uploadedByUserId,
      versionNotes: input.versionNotes || 'Contrat généré automatiquement',
      approvalStatus: 'approved', // Auto-approved (system generated)
      approvedBy: input.uploadedByUserId,
      approvedAt: new Date().toISOString(),
      metadata: {
        contractId: contract.id,
        contractType: contract.contractType,
        contractNumber: contractData.contractNumber,
        generatedBy: 'contract-document-service',
        generatedAt: new Date().toISOString(),
      },
    })
    .returning();

  // 10. Update contract with file URL
  await db
    .update(employmentContracts)
    .set({
      contractFileUrl: fileUrl,
    })
    .where(eq(employmentContracts.id, contract.id));

  console.log('[Contract Document] Document generated successfully:', uploadedDoc.id);

  return {
    success: true,
    documentId: uploadedDoc.id,
    fileUrl: fileUrl,
    fileName: fileName,
    message: 'Contrat généré avec succès',
  };
}

/**
 * Get template preview data for a contract
 */
export async function getContractPreviewData(contractId: string, tenantId: string) {
  const [contract] = await db
    .select()
    .from(employmentContracts)
    .where(
      and(
        eq(employmentContracts.id, contractId),
        eq(employmentContracts.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!contract) {
    throw new Error('Contract not found');
  }

  const [employee] = await db
    .select({
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, contract.employeeId),
        eq(employees.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!employee) {
    throw new Error('Employee not found');
  }

  const [tenant] = await db
    .select({
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return {
    contractType: contract.contractType,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    companyName: tenant.name,
    startDate: contract.startDate,
    endDate: contract.endDate,
    canGenerate: contract.contractType === 'CDI', // Only CDI supported for now
  };
}
