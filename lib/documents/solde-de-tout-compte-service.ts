/**
 * Solde de Tout Compte Service
 *
 * Generates final settlement documents for terminated employees
 * Calculates: unpaid salary, unused vacation days, severance pay, notice pay
 */

import 'server-only';
import { db } from '@/lib/db';
import { employees, generatedDocuments, payrollLineItems, assignments, positions } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, isNull } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { differenceInDays, differenceInMonths, differenceInYears, getDaysInMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EmployeeWithSalary {
  id: string;
  tenantId: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: Date;
  positionTitle: string | null;
  baseSalary: string;
}

interface SettlementComponent {
  label: string;
  amount: number;
  description?: string;
}

interface FinalSettlementCalculation {
  employee: EmployeeWithSalary;
  components: SettlementComponent[];
  totalAmount: number;
  terminationDate: Date;
  reason: string;
}

interface VacationDaysCalculation {
  days: number;
  amount: number;
  calculation: string;
}

export class SoldeDeToutCompteService {
  /**
   * Calculate and generate final settlement (Solde de Tout Compte)
   */
  async generateSoldeDeToutCompte(
    employeeId: string,
    terminationDate: Date,
    reason: 'resignation' | 'termination' | 'retirement' | 'end_of_contract',
    tenantId: string,
    userId: string
  ): Promise<{ documentId: string; fileUrl: string; totalAmount: number }> {
    // 1. Calculate all components
    const calculations = await this.calculateFinalSettlement(
      employeeId,
      terminationDate,
      reason
    );

    // 2. Generate PDF
    const pdfBuffer = await this.generateSoldePDF(calculations);

    // 3. Upload to storage
    const filename = `solde_tout_compte_${calculations.employee.employeeNumber}_${format(terminationDate, 'yyyy-MM-dd')}.pdf`;
    const fileUrl = await this.uploadToStorage(pdfBuffer, filename, tenantId);

    // 4. Create document record
    const [doc] = await db.insert(generatedDocuments).values({
      tenantId,
      employeeId,
      documentType: 'solde_de_tout_compte',
      fileUrl,
      fileSize: pdfBuffer.length,
      generatedBy: userId,
      metadata: {
        terminationDate: terminationDate.toISOString(),
        reason,
        totalAmount: calculations.totalAmount,
        components: calculations.components,
      },
    }).returning();

    return {
      documentId: doc.id,
      fileUrl,
      totalAmount: calculations.totalAmount,
    };
  }

  /**
   * Calculate final settlement components
   */
  private async calculateFinalSettlement(
    employeeId: string,
    terminationDate: Date,
    reason: string
  ): Promise<FinalSettlementCalculation> {
    const employee = await this.getEmployeeWithSalary(employeeId);

    if (!employee) {
      throw new Error('Employee not found');
    }

    const components: SettlementComponent[] = [];

    // 1. Unpaid salary (prorata for last month)
    const unpaidSalary = this.calculateUnpaidSalary(employee, terminationDate);
    if (unpaidSalary > 0) {
      const daysInMonth = getDaysInMonth(terminationDate);
      const dayOfMonth = terminationDate.getDate();
      components.push({
        label: 'Salaire du mois en cours (prorata)',
        amount: unpaidSalary,
        description: `${dayOfMonth} jours sur ${daysInMonth}`,
      });
    }

    // 2. Unused vacation days
    const vacationDays = await this.calculateUnusedVacationDays(employeeId, terminationDate);
    if (vacationDays.days > 0) {
      components.push({
        label: `Congés non pris (${vacationDays.days} jours)`,
        amount: vacationDays.amount,
        description: vacationDays.calculation,
      });
    }

    // 3. Severance pay (if termination without cause)
    if (reason === 'termination') {
      const severancePay = await this.calculateSeverancePay(employee, terminationDate);
      if (severancePay > 0) {
        components.push({
          label: 'Indemnité de licenciement',
          amount: severancePay,
          description: 'Selon Code du Travail',
        });
      }
    }

    // 4. Notice pay (if termination without notice period)
    const noticePay = this.calculateNoticePay(employee, reason);
    if (noticePay > 0) {
      components.push({
        label: 'Indemnité de préavis',
        amount: noticePay,
        description: 'Préavis non effectué',
      });
    }

    const totalAmount = components.reduce((sum, c) => sum + c.amount, 0);

    return {
      employee,
      components,
      totalAmount,
      terminationDate,
      reason,
    };
  }

  /**
   * Get employee with current salary
   */
  private async getEmployeeWithSalary(
    employeeId: string
  ): Promise<EmployeeWithSalary | null> {
    // Get employee with their current assignment, position, and latest salary from payroll
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

    // Get the most recent salary from payroll line items
    const [latestPayroll] = await db
      .select({
        baseSalary: payrollLineItems.baseSalary,
      })
      .from(payrollLineItems)
      .where(eq(payrollLineItems.employeeId, employeeId))
      .orderBy(desc(payrollLineItems.createdAt))
      .limit(1);

    // Convert hireDate from string to Date and add baseSalary
    return {
      ...result,
      hireDate: new Date(result.hireDate),
      baseSalary: latestPayroll?.baseSalary ?? '0',
    };
  }

  /**
   * Calculate unpaid salary for current month (prorata)
   */
  private calculateUnpaidSalary(
    employee: EmployeeWithSalary,
    terminationDate: Date
  ): number {
    const baseSalary = parseFloat(employee.baseSalary);
    const daysInMonth = getDaysInMonth(terminationDate);
    const dayOfMonth = terminationDate.getDate();

    // Prorata calculation: (base salary / days in month) * days worked
    return Math.round((baseSalary / daysInMonth) * dayOfMonth);
  }

  /**
   * Calculate unused vacation days
   * West African countries typically provide 2.5 days per month (30 days/year)
   */
  private async calculateUnusedVacationDays(
    employeeId: string,
    terminationDate: Date
  ): Promise<VacationDaysCalculation> {
    // In a real implementation, query time_off_balances table
    // For now, use simplified calculation

    // Accrual rate: 2.5 days per month (30 days per year)
    const accrualRatePerMonth = 2.5;

    // Get months worked this year
    const yearStart = new Date(terminationDate.getFullYear(), 0, 1);
    const monthsWorked = differenceInMonths(terminationDate, yearStart) + 1;

    // Accrued days this year
    const accruedDays = monthsWorked * accrualRatePerMonth;

    // Get days already taken (query from time_off_requests)
    // For placeholder, assume 5 days taken
    const daysTaken = 5;

    const unusedDays = Math.max(0, Math.floor(accruedDays - daysTaken));

    // Calculate amount (daily rate = monthly salary / 22 working days)
    const employee = await this.getEmployeeWithSalary(employeeId);
    const dailyRate = employee ? parseFloat(employee.baseSalary) / 22 : 0;
    const amount = Math.round(unusedDays * dailyRate);

    return {
      days: unusedDays,
      amount,
      calculation: `${accruedDays.toFixed(1)} jours acquis - ${daysTaken} jours pris`,
    };
  }

  /**
   * Calculate severance pay (indemnité de licenciement)
   * Based on years of service and monthly salary
   * CI Law: 30% of average salary per year of service for first 5 years,
   *         40% for years 6-10, 50% for years 11+
   */
  private async calculateSeverancePay(
    employee: EmployeeWithSalary,
    terminationDate: Date
  ): Promise<number> {
    const yearsOfService = differenceInYears(terminationDate, employee.hireDate);
    const baseSalary = parseFloat(employee.baseSalary);

    let severancePay = 0;

    // First 5 years: 30% per year
    const years1to5 = Math.min(yearsOfService, 5);
    severancePay += years1to5 * baseSalary * 0.30;

    // Years 6-10: 40% per year
    if (yearsOfService > 5) {
      const years6to10 = Math.min(yearsOfService - 5, 5);
      severancePay += years6to10 * baseSalary * 0.40;
    }

    // Years 11+: 50% per year
    if (yearsOfService > 10) {
      const years11plus = yearsOfService - 10;
      severancePay += years11plus * baseSalary * 0.50;
    }

    return Math.round(severancePay);
  }

  /**
   * Calculate notice pay (indemnité de préavis)
   * Typically 1-3 months salary depending on position and tenure
   */
  private calculateNoticePay(
    employee: EmployeeWithSalary,
    reason: string
  ): number {
    // Notice pay not applicable for resignation or end of contract
    if (reason === 'resignation' || reason === 'end_of_contract') {
      return 0;
    }

    const baseSalary = parseFloat(employee.baseSalary);
    const yearsOfService = differenceInYears(new Date(), employee.hireDate);

    // Simplified calculation:
    // < 1 year: 1 month
    // 1-5 years: 2 months
    // > 5 years: 3 months
    let noticeMonths = 1;
    if (yearsOfService >= 5) {
      noticeMonths = 3;
    } else if (yearsOfService >= 1) {
      noticeMonths = 2;
    }

    return Math.round(baseSalary * noticeMonths);
  }

  /**
   * Generate PDF buffer
   */
  private async generateSoldePDF(
    calculations: FinalSettlementCalculation
  ): Promise<Buffer> {
    const content = this.generatePlaceholderPDF(calculations);
    return Buffer.from(content, 'utf-8');
  }

  /**
   * Generate placeholder PDF content
   */
  private generatePlaceholderPDF(
    calculations: FinalSettlementCalculation
  ): string {
    const { employee, components, totalAmount, terminationDate, reason } = calculations;

    const reasonLabels: Record<string, string> = {
      resignation: 'Démission',
      termination: 'Licenciement',
      retirement: 'Retraite',
      end_of_contract: 'Fin de contrat',
    };

    let componentsText = components.map(c =>
      `${c.label.padEnd(40)} ${c.amount.toLocaleString('fr-FR')} FCFA\n` +
      (c.description ? `  (${c.description})\n` : '')
    ).join('');

    return `
SOLDE DE TOUT COMPTE
====================

Employé: ${employee.firstName} ${employee.lastName}
Matricule: ${employee.employeeNumber}
Poste: ${employee.positionTitle}
Date de départ: ${format(terminationDate, 'dd MMMM yyyy', { locale: fr })}
Motif: ${reasonLabels[reason] || reason}

DÉTAIL DES SOMMES DUES
======================

${componentsText}

────────────────────────────────────────────────────
TOTAL À PAYER: ${totalAmount.toLocaleString('fr-FR')} FCFA
════════════════════════════════════════════════════

Le salarié reconnaît avoir reçu la somme totale ci-dessus
et ne rien avoir de plus à réclamer à l'entreprise au titre
de l'exécution et de la rupture de son contrat de travail.

Fait à [VILLE], le ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}

L'Employeur                    Le Salarié
[SIGNATURE]                    [SIGNATURE]
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

    const path = `${tenantId}/soldes/${filename}`;

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
export const soldeService = new SoldeDeToutCompteService();
