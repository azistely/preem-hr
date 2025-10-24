/**
 * Bulletin de Paie Service
 *
 * Generates PDF pay slips using React-PDF
 * Supports single generation, bulk generation, and corrections
 */

import 'server-only';
import { db } from '@/lib/db';
import {
  payrollLineItems,
  generatedDocuments,
  bulkGenerationJobs,
  documentTemplates,
  payrollRuns
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

// Types
interface PayrollLineItemDetails {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeName: string | null;
  employeeNumber: string | null;
  positionTitle: string | null;
  baseSalary: string;
  grossSalary: string;
  netSalary: string;
  period: string;
  allowances: any;
  earningsDetails: any;
  deductionsDetails: any;
  taxDeductions: any;
  employeeContributions: any;
  employerContributions: any;
  totalDeductions: string;
  cnpsEmployee: string | null;
  cmuEmployee: string | null;
  its: string | null;
  cnpsEmployer: string | null;
  cmuEmployer: string | null;
  daysWorked: string;
  overtimeHours: any;
  overtimePay: string | null;
  bonuses: string | null;
}

interface DocumentTemplate {
  id: string;
  templateData: any;
}

export class BulletinDePaieService {
  /**
   * Generate bulletin for single employee
   */
  async generateSingleBulletin(
    payrollLineItemId: string,
    tenantId: string,
    userId: string
  ): Promise<{ documentId: string; fileUrl: string }> {
    // 1. Load payroll line item with all details
    const lineItem = await this.getPayrollLineItemWithDetails(payrollLineItemId);

    if (!lineItem) {
      throw new Error('Payroll line item not found');
    }

    // 2. Load tenant template (or use default)
    const template = await this.getTemplate(tenantId, 'bulletin_de_paie');

    // 3. Generate PDF using React-PDF
    const pdfBuffer = await this.generateBulletinPDF(lineItem, template);

    // 4. Upload to storage
    const period = this.extractPeriod(lineItem);
    const filename = `bulletin_${lineItem.employeeNumber}_${period}.pdf`;
    const fileUrl = await this.uploadToStorage(pdfBuffer, filename, tenantId);

    // 5. Create document record
    const [doc] = await db.insert(generatedDocuments).values({
      tenantId,
      employeeId: lineItem.employeeId,
      documentType: 'bulletin_de_paie',
      period,
      fileUrl,
      fileSize: pdfBuffer.length,
      versionNumber: 1,
      generatedBy: userId,
      metadata: {
        payrollLineItemId: lineItem.id,
        employeeNumber: lineItem.employeeNumber,
        employeeName: lineItem.employeeName,
      },
    }).returning();

    return {
      documentId: doc.id,
      fileUrl,
    };
  }

  /**
   * Generate bulletins for entire payroll run (BULK)
   */
  async generateBulkBulletins(
    payrollRunId: string,
    tenantId: string,
    userId: string
  ): Promise<{ jobId: string; totalDocuments: number }> {
    // 1. Get all line items for payroll run
    const lineItems = await db
      .select()
      .from(payrollLineItems)
      .where(eq(payrollLineItems.payrollRunId, payrollRunId));

    // 2. Create bulk generation job
    const [job] = await db.insert(bulkGenerationJobs).values({
      tenantId,
      payrollRunId,
      documentType: 'bulletin_de_paie',
      totalDocuments: lineItems.length,
      jobStatus: 'pending',
      createdBy: userId,
    }).returning();

    // 3. Process async (in real implementation, use queue/Inngest)
    // For now, process synchronously
    setImmediate(() => {
      this.processBulkGeneration(job.id, lineItems, userId).catch(error => {
        console.error('Bulk generation failed:', error);
      });
    });

    return {
      jobId: job.id,
      totalDocuments: lineItems.length,
    };
  }

  /**
   * Process bulk generation (background job)
   */
  private async processBulkGeneration(
    jobId: string,
    lineItems: any[],
    userId: string
  ): Promise<void> {
    // Update job status to processing
    await db.update(bulkGenerationJobs)
      .set({ jobStatus: 'processing', startedAt: new Date() })
      .where(eq(bulkGenerationJobs.id, jobId));

    const errors: any[] = [];
    let generated = 0;

    for (const lineItem of lineItems) {
      try {
        await this.generateSingleBulletin(lineItem.id, lineItem.tenantId, userId);
        generated++;

        // Update progress every 10 documents
        if (generated % 10 === 0) {
          await db.update(bulkGenerationJobs)
            .set({ generatedDocuments: generated })
            .where(eq(bulkGenerationJobs.id, jobId));
        }
      } catch (error) {
        errors.push({
          lineItemId: lineItem.id,
          employeeNumber: lineItem.employeeNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Mark job complete
    await db.update(bulkGenerationJobs)
      .set({
        jobStatus: errors.length > 0 ? 'completed_with_errors' : 'completed',
        generatedDocuments: generated,
        failedDocuments: errors.length,
        errorLog: errors,
        completedAt: new Date(),
      })
      .where(eq(bulkGenerationJobs.id, jobId));
  }

  /**
   * Generate corrected bulletin (creates new version)
   */
  async generateCorrectedBulletin(
    originalDocumentId: string,
    correctedLineItemId: string,
    tenantId: string,
    userId: string
  ): Promise<{ documentId: string; versionNumber: number }> {
    // 1. Get original document
    const [original] = await db
      .select()
      .from(generatedDocuments)
      .where(eq(generatedDocuments.id, originalDocumentId));

    if (!original) {
      throw new Error('Original document not found');
    }

    // 2. Generate new bulletin
    const result = await this.generateSingleBulletin(correctedLineItemId, tenantId, userId);

    // 3. Update document record to link to original
    const newVersion = (original.versionNumber || 1) + 1;
    await db.update(generatedDocuments)
      .set({
        versionNumber: newVersion,
        replacesDocumentId: originalDocumentId,
        documentSubtype: 'payslip_correction',
      })
      .where(eq(generatedDocuments.id, result.documentId));

    return {
      documentId: result.documentId,
      versionNumber: newVersion,
    };
  }

  /**
   * Get payroll line item with all details
   */
  private async getPayrollLineItemWithDetails(
    lineItemId: string
  ): Promise<PayrollLineItemDetails | null> {
    // Join payroll line items with payroll runs to get the period
    const [result] = await db
      .select({
        id: payrollLineItems.id,
        tenantId: payrollLineItems.tenantId,
        payrollRunId: payrollLineItems.payrollRunId,
        employeeId: payrollLineItems.employeeId,
        employeeName: payrollLineItems.employeeName,
        employeeNumber: payrollLineItems.employeeNumber,
        positionTitle: payrollLineItems.positionTitle,
        baseSalary: payrollLineItems.baseSalary,
        grossSalary: payrollLineItems.grossSalary,
        netSalary: payrollLineItems.netSalary,
        allowances: payrollLineItems.allowances,
        earningsDetails: payrollLineItems.earningsDetails,
        deductionsDetails: payrollLineItems.deductionsDetails,
        taxDeductions: payrollLineItems.taxDeductions,
        employeeContributions: payrollLineItems.employeeContributions,
        employerContributions: payrollLineItems.employerContributions,
        totalDeductions: payrollLineItems.totalDeductions,
        cnpsEmployee: payrollLineItems.cnpsEmployee,
        cmuEmployee: payrollLineItems.cmuEmployee,
        its: payrollLineItems.its,
        cnpsEmployer: payrollLineItems.cnpsEmployer,
        cmuEmployer: payrollLineItems.cmuEmployer,
        daysWorked: payrollLineItems.daysWorked,
        overtimeHours: payrollLineItems.overtimeHours,
        overtimePay: payrollLineItems.overtimePay,
        bonuses: payrollLineItems.bonuses,
        // Get period from payroll run
        periodStart: payrollRuns.periodStart,
        periodEnd: payrollRuns.periodEnd,
      })
      .from(payrollLineItems)
      .leftJoin(payrollRuns, eq(payrollLineItems.payrollRunId, payrollRuns.id))
      .where(eq(payrollLineItems.id, lineItemId))
      .limit(1);

    if (!result) return null;

    // Format period as "YYYY-MM" from the period dates
    const period = result.periodStart
      ? format(new Date(result.periodStart), 'yyyy-MM')
      : 'unknown';

    // Return with period field added
    return {
      id: result.id,
      tenantId: result.tenantId,
      employeeId: result.employeeId,
      employeeName: result.employeeName,
      employeeNumber: result.employeeNumber,
      positionTitle: result.positionTitle,
      baseSalary: result.baseSalary,
      grossSalary: result.grossSalary,
      netSalary: result.netSalary,
      period,
      allowances: result.allowances,
      earningsDetails: result.earningsDetails,
      deductionsDetails: result.deductionsDetails,
      taxDeductions: result.taxDeductions,
      employeeContributions: result.employeeContributions,
      employerContributions: result.employerContributions,
      totalDeductions: result.totalDeductions,
      cnpsEmployee: result.cnpsEmployee,
      cmuEmployee: result.cmuEmployee,
      its: result.its,
      cnpsEmployer: result.cnpsEmployer,
      cmuEmployer: result.cmuEmployer,
      daysWorked: result.daysWorked,
      overtimeHours: result.overtimeHours,
      overtimePay: result.overtimePay,
      bonuses: result.bonuses,
    };
  }

  /**
   * Get template for tenant (GAP-DOC-002: Now uses payslipTemplates)
   */
  private async getTemplate(
    tenantId: string,
    templateType: string
  ): Promise<DocumentTemplate | null> {
    // For payslip templates, use new payslipTemplates table
    if (templateType === 'bulletin_de_paie') {
      const { payslipTemplates } = await import('@/lib/db/schema');
      const [template] = await db
        .select()
        .from(payslipTemplates)
        .where(
          and(
            eq(payslipTemplates.tenantId, tenantId),
            eq(payslipTemplates.isDefault, true)
          )
        );

      if (template) {
        // Convert payslip template to legacy format
        return {
          id: template.id,
          templateData: {
            ...template,
            layoutType: template.layoutType,
            logoUrl: template.logoUrl,
            headerText: template.headerText,
            footerText: template.footerText,
            primaryColor: template.primaryColor,
            fontFamily: template.fontFamily,
            showEmployerContributions: template.showEmployerContributions,
            showYearToDate: template.showYearToDate,
            showLeaveBalance: template.showLeaveBalance,
            customFields: template.customFields,
          },
        };
      }
    }

    // Fallback to legacy document templates
    const [template] = await db
      .select()
      .from(documentTemplates)
      .where(
        and(
          eq(documentTemplates.tenantId, tenantId),
          eq(documentTemplates.templateType, templateType),
          eq(documentTemplates.isDefault, true)
        )
      );

    return template as DocumentTemplate | null;
  }

  /**
   * Generate PDF buffer using React-PDF
   * Note: Actual PDF generation would use @react-pdf/renderer
   * This is a placeholder for the structure
   */
  private async generateBulletinPDF(
    lineItem: PayrollLineItemDetails,
    template: DocumentTemplate | null
  ): Promise<Buffer> {
    // In a real implementation, this would use React-PDF to generate the PDF
    // For now, return a placeholder

    // Example structure:
    // import { renderToBuffer } from '@react-pdf/renderer';
    // import { BulletinDePaiePDF } from './pdf-templates/bulletin-de-paie';
    //
    // const pdfBuffer = await renderToBuffer(
    //   <BulletinDePaiePDF lineItem={lineItem} template={template} />
    // );
    //
    // return pdfBuffer;

    // Placeholder: Create a simple text-based "PDF" (in production, use React-PDF)
    const content = this.generatePlaceholderPDF(lineItem, template);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate placeholder PDF content (for testing)
   * GAP-DOC-002: Now uses template customization
   */
  private generatePlaceholderPDF(lineItem: PayrollLineItemDetails, template?: any): string {
    const headerText = template?.templateData?.headerText || 'BULLETIN DE PAIE';
    const footerText = template?.templateData?.footerText || '';
    const showEmployerContributions = template?.templateData?.showEmployerContributions ?? true;

    let content = `
${headerText}
${'='.repeat(headerText.length)}

Employé: ${lineItem.employeeName}
Matricule: ${lineItem.employeeNumber}
Poste: ${lineItem.positionTitle}
Période: ${this.extractPeriod(lineItem)}

SALAIRE
-------
Salaire de Base: ${lineItem.baseSalary} FCFA
Salaire Brut: ${lineItem.grossSalary} FCFA

COTISATIONS
-----------
CNPS Employé: ${lineItem.cnpsEmployee || '0'} FCFA
CMU Employé: ${lineItem.cmuEmployee || '0'} FCFA
ITS: ${lineItem.its || '0'} FCFA

Total Déductions: ${lineItem.totalDeductions} FCFA

SALAIRE NET: ${lineItem.netSalary} FCFA
===========================================
`;

    if (showEmployerContributions) {
      content += `
COTISATIONS PATRONALES (à titre indicatif)
------------------------------------------
CNPS Employeur: ${lineItem.cnpsEmployer || '0'} FCFA
CMU Employeur: ${lineItem.cmuEmployer || '0'} FCFA
`;
    }

    if (footerText) {
      content += `\n${footerText}\n`;
    }

    return content;
  }

  /**
   * Upload PDF to Supabase storage
   */
  private async uploadToStorage(
    pdfBuffer: Buffer,
    filename: string,
    tenantId: string
  ): Promise<string> {
    const supabase = await createClient();

    // Upload to Supabase storage
    const path = `${tenantId}/bulletins/${filename}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(path);

    return publicUrl;
  }

  /**
   * Extract period from line item (YYYY-MM format)
   */
  private extractPeriod(lineItem: PayrollLineItemDetails): string {
    // If there's a period field in metadata, use it
    // Otherwise, use current date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

// Export singleton instance
export const bulletinService = new BulletinDePaieService();
