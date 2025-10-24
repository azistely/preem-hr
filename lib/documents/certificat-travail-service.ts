/**
 * Certificat de Travail Service
 *
 * Generates work certificates (certificat de travail) for terminated employees
 * Required by law in most West African countries when employment ends
 */

import 'server-only';
import { db } from '@/lib/db';
import { employees, generatedDocuments, documentTemplates, assignments, positions } from '@/lib/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { differenceInDays, differenceInMonths, differenceInYears, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ServiceDuration {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  formatted: string; // "2 ans, 3 mois et 15 jours"
}

interface LastSalary {
  baseSalary: string;
  grossSalary: string;
  period: string;
}

interface EmployeeWithHistory {
  id: string;
  tenantId: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: Date;
  positionTitle: string | null;
}

export class CertificatDeTravailService {
  /**
   * Generate work certificate (Certificat de Travail)
   */
  async generateCertificat(
    employeeId: string,
    terminationDate: Date,
    reason: string,
    tenantId: string,
    userId: string
  ): Promise<{ documentId: string; fileUrl: string }> {
    // 1. Load employee details
    const employee = await this.getEmployeeWithHistory(employeeId);

    if (!employee) {
      throw new Error('Employee not found');
    }

    // 2. Calculate service duration
    const serviceDuration = this.calculateServiceDuration(
      employee.hireDate,
      terminationDate
    );

    // 3. Load last salary
    const lastSalary = await this.getLastSalary(employeeId);

    // 4. Generate PDF
    const pdfBuffer = await this.generateCertificatPDF({
      employee,
      terminationDate,
      serviceDuration,
      lastSalary,
      reason,
    });

    // 5. Upload to storage
    const filename = `certificat_travail_${employee.employeeNumber}_${format(terminationDate, 'yyyy-MM-dd')}.pdf`;
    const fileUrl = await this.uploadToStorage(pdfBuffer, filename, tenantId);

    // 6. Create document record
    const [doc] = await db.insert(generatedDocuments).values({
      tenantId,
      employeeId,
      documentType: 'certificat_de_travail',
      documentSubtype: this.getDocumentSubtype(reason),
      fileUrl,
      fileSize: pdfBuffer.length,
      generatedBy: userId,
      metadata: {
        terminationDate: terminationDate.toISOString(),
        reason,
        serviceDuration,
        lastSalary,
      },
    }).returning();

    return {
      documentId: doc.id,
      fileUrl,
    };
  }

  /**
   * Get employee with employment history
   */
  private async getEmployeeWithHistory(
    employeeId: string
  ): Promise<EmployeeWithHistory | null> {
    // Get employee with their current/latest assignment and position
    const [result] = await db
      .select({
        id: employees.id,
        tenantId: employees.tenantId,
        employeeNumber: employees.employeeNumber,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        hireDate: employees.hireDate,
        positionTitle: positions.title,
      })
      .from(employees)
      .leftJoin(
        assignments,
        and(
          eq(assignments.employeeId, employees.id),
          isNull(assignments.effectiveTo) // Current assignment
        )
      )
      .leftJoin(positions, eq(positions.id, assignments.positionId))
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!result) return null;

    // Convert hireDate from string to Date
    return {
      ...result,
      hireDate: new Date(result.hireDate),
    };
  }

  /**
   * Calculate service duration
   */
  private calculateServiceDuration(
    hireDate: Date,
    terminationDate: Date
  ): ServiceDuration {
    const totalDays = differenceInDays(terminationDate, hireDate);
    const years = differenceInYears(terminationDate, hireDate);
    const remainingAfterYears = new Date(terminationDate);
    remainingAfterYears.setFullYear(remainingAfterYears.getFullYear() - years);

    const months = differenceInMonths(remainingAfterYears, hireDate);
    const remainingAfterMonths = new Date(remainingAfterYears);
    remainingAfterMonths.setMonth(remainingAfterMonths.getMonth() - months);

    const days = differenceInDays(remainingAfterMonths, hireDate);

    // Format as "2 ans, 3 mois et 15 jours"
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} mois`);
    if (days > 0) parts.push(`${days} jour${days > 1 ? 's' : ''}`);

    const formatted = parts.length > 1
      ? parts.slice(0, -1).join(', ') + ' et ' + parts[parts.length - 1]
      : parts[0] || '0 jour';

    return {
      years,
      months,
      days,
      totalDays,
      formatted,
    };
  }

  /**
   * Get last salary for employee
   */
  private async getLastSalary(employeeId: string): Promise<LastSalary | null> {
    // Query the most recent payroll line item
    const query = `
      SELECT
        base_salary,
        gross_salary,
        period
      FROM payroll_line_items
      WHERE employee_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc('execute_sql', {
        query,
        params: [employeeId],
      });

      if (error || !data || data.length === 0) {
        return null;
      }

      return {
        baseSalary: data[0].base_salary,
        grossSalary: data[0].gross_salary,
        period: data[0].period,
      };
    } catch (error) {
      console.error('Error fetching last salary:', error);
      return null;
    }
  }

  /**
   * Get document subtype based on termination reason
   */
  private getDocumentSubtype(reason: string): string {
    const subtypeMap: Record<string, string> = {
      resignation: 'work_certificate_resignation',
      termination: 'work_certificate_termination',
      retirement: 'work_certificate_retirement',
      end_of_contract: 'work_certificate_end_contract',
    };

    return subtypeMap[reason] || 'work_certificate_other';
  }

  /**
   * Generate PDF buffer
   */
  private async generateCertificatPDF(data: {
    employee: EmployeeWithHistory;
    terminationDate: Date;
    serviceDuration: ServiceDuration;
    lastSalary: LastSalary | null;
    reason: string;
  }): Promise<Buffer> {
    // In production, use React-PDF to generate a proper PDF
    // For now, generate placeholder content

    const content = this.generatePlaceholderPDF(data);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate placeholder PDF content
   */
  private generatePlaceholderPDF(data: {
    employee: EmployeeWithHistory;
    terminationDate: Date;
    serviceDuration: ServiceDuration;
    lastSalary: LastSalary | null;
    reason: string;
  }): string {
    const { employee, terminationDate, serviceDuration, lastSalary, reason } = data;

    const reasonLabels: Record<string, string> = {
      resignation: 'démission',
      termination: 'licenciement',
      retirement: 'retraite',
      end_of_contract: 'fin de contrat',
    };

    return `
CERTIFICAT DE TRAVAIL
=====================

Je soussigné(e), représentant légal de [NOM DE L'ENTREPRISE],
certifie que :

Monsieur/Madame ${employee.firstName} ${employee.lastName}
Matricule: ${employee.employeeNumber}

a été employé(e) dans notre établissement du ${format(employee.hireDate, 'dd MMMM yyyy', { locale: fr })}
au ${format(terminationDate, 'dd MMMM yyyy', { locale: fr })}.

Durée de service: ${serviceDuration.formatted}

Poste occupé: ${employee.positionTitle}

${lastSalary ? `Dernier salaire brut: ${lastSalary.grossSalary} FCFA` : ''}

Motif de départ: ${reasonLabels[reason] || reason}

Le présent certificat est délivré pour servir et valoir ce que de droit.

Fait à [VILLE], le ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}

[SIGNATURE ET CACHET]
`;
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

    const path = `${tenantId}/certificats/${filename}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload document: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(path);

    return publicUrl;
  }
}

// Export singleton instance
export const certificatService = new CertificatDeTravailService();
