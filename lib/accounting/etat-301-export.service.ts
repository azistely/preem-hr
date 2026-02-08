/**
 * ETAT 301 Export Service
 * Handles generation of monthly ITS (Impôt sur Traitement et Salaire) declaration
 *
 * Note: This service generates CSV format for now.
 * PDF generation can be added later using a client-side library or server-side PDF generator.
 */

import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { etat301Config, payrollRuns, payrollLineItems } from '@/lib/db/schema';
import { format } from 'date-fns';

export interface Etat301ExportResult {
  fileContent: string;
  fileName: string;
  totalITS: number;
  employeeCount: number;
}

export interface ITSData {
  employeeNumber: string;
  employeeName: string;
  grossSalary: number;
  taxableIncome: number;
  itsAmount: number;
}

/**
 * Generate monthly ITS declaration (ETAT 301)
 */
export async function generateEtat301(month: string, tenantId: string): Promise<Etat301ExportResult> {
  // month format: 'YYYY-MM'

  // 1. Load config
  const [config] = await db.select().from(etat301Config).where(eq(etat301Config.tenantId, tenantId));

  if (!config) {
    throw new Error('Configuration ETAT 301 non trouvée. Veuillez configurer dans les Paramètres.');
  }

  // 2. Get all payroll runs for the month
  const runs = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.tenantId, tenantId)));

  // Filter runs for the specified month
  const monthRuns = runs.filter((run) => {
    const runMonth = format(new Date(run.periodStart), 'yyyy-MM');
    return runMonth === month;
  });

  if (monthRuns.length === 0) {
    throw new Error(`Aucune paie trouvée pour la période ${month}`);
  }

  // 3. Aggregate ITS by employee
  const itsData = await aggregateITSByEmployee(monthRuns.map((r) => r.id));

  if (itsData.length === 0) {
    throw new Error(`Aucune donnée ITS trouvée pour la période ${month}`);
  }

  // 4. Generate export file (CSV for now, PDF later)
  const fileContent = generateEtat301CSV(itsData, config, month);

  // 5. Calculate totals
  const totalITS = itsData.reduce((sum, d) => sum + d.itsAmount, 0);

  // 6. Generate filename
  const fileName = `etat_301_${month}.csv`;

  return {
    fileContent,
    fileName,
    totalITS,
    employeeCount: itsData.length,
  };
}

/**
 * Aggregate ITS by employee across multiple payroll runs
 */
async function aggregateITSByEmployee(runIds: string[]): Promise<ITSData[]> {
  if (runIds.length === 0) {
    return [];
  }

  // Load all line items for the runs in a single query (narrow columns, avoids N+1)
  const allLineItems = await db
    .select({
      employeeId: payrollLineItems.employeeId,
      employeeNumber: payrollLineItems.employeeNumber,
      employeeName: payrollLineItems.employeeName,
      grossSalary: payrollLineItems.grossSalary,
      its: payrollLineItems.its,
    })
    .from(payrollLineItems)
    .where(inArray(payrollLineItems.payrollRunId, runIds));

  // Group by employee
  const employeeMap = new Map<string, ITSData>();

  for (const item of allLineItems) {
    const employeeId = item.employeeId;
    const existing = employeeMap.get(employeeId);

    const grossSalary = parseFloat(item.grossSalary);
    const itsAmount = parseFloat(item.its || '0');

    if (existing) {
      existing.grossSalary += grossSalary;
      existing.taxableIncome += grossSalary; // Simplified
      existing.itsAmount += itsAmount;
    } else {
      employeeMap.set(employeeId, {
        employeeNumber: item.employeeNumber || '',
        employeeName: item.employeeName || '',
        grossSalary,
        taxableIncome: grossSalary, // Simplified - would need to calculate properly
        itsAmount,
      });
    }
  }

  return Array.from(employeeMap.values());
}

/**
 * Generate ETAT 301 CSV
 */
function generateEtat301CSV(data: ITSData[], config: any, month: string): string {
  // Header
  let csv = 'RÉPUBLIQUE DE CÔTE D\'IVOIRE\n';
  csv += 'DIRECTION GÉNÉRALE DES IMPÔTS\n';
  csv += 'ÉTAT 301 - DÉCLARATION MENSUELLE ITS\n';
  csv += '\n';
  csv += `NIF: ${config.dgiTaxNumber || 'N/A'}\n`;
  csv += `Période: ${month}\n`;
  csv += `Date de génération: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
  csv += '\n';

  // Column headers
  csv += 'Matricule,Nom et Prénoms,Salaire Brut,Revenu Imposable,ITS Retenu\n';

  // Data rows
  for (const d of data) {
    csv += `${d.employeeNumber},"${d.employeeName}",${d.grossSalary.toFixed(2)},${d.taxableIncome.toFixed(2)},${d.itsAmount.toFixed(2)}\n`;
  }

  // Totals
  csv += '\n';
  const totalGross = data.reduce((sum, d) => sum + d.grossSalary, 0);
  const totalTaxable = data.reduce((sum, d) => sum + d.taxableIncome, 0);
  const totalITS = data.reduce((sum, d) => sum + d.itsAmount, 0);
  csv += `TOTAL,${data.length} employés,${totalGross.toFixed(2)},${totalTaxable.toFixed(2)},${totalITS.toFixed(2)}\n`;

  csv += '\n';
  csv += '---\n';
  csv += 'MONTANT TOTAL À VERSER À LA DGI\n';
  csv += `${totalITS.toFixed(2)} FCFA\n`;

  return csv;
}

/**
 * Get or create ETAT 301 config for tenant
 */
export async function getOrCreateEtat301Config(tenantId: string) {
  const [config] = await db.select().from(etat301Config).where(eq(etat301Config.tenantId, tenantId));

  if (config) {
    return config;
  }

  // Create default config
  const [newConfig] = await db
    .insert(etat301Config)
    .values({
      tenantId,
      exportFormat: 'PDF',
      includeAttachments: true,
    })
    .returning();

  return newConfig;
}

/**
 * Update ETAT 301 config
 */
export async function updateEtat301Config(
  tenantId: string,
  data: {
    dgiTaxNumber?: string;
    exportFormat?: string;
    includeAttachments?: boolean;
  }
) {
  const [existing] = await db.select().from(etat301Config).where(eq(etat301Config.tenantId, tenantId));

  if (existing) {
    const [updated] = await db
      .update(etat301Config)
      .set({
        dgiTaxNumber: data.dgiTaxNumber,
        exportFormat: data.exportFormat,
        includeAttachments: data.includeAttachments,
        updatedAt: new Date(),
      })
      .where(eq(etat301Config.tenantId, tenantId))
      .returning();

    return updated;
  } else {
    const [created] = await db
      .insert(etat301Config)
      .values({
        tenantId,
        dgiTaxNumber: data.dgiTaxNumber,
        exportFormat: data.exportFormat || 'PDF',
        includeAttachments: data.includeAttachments ?? true,
      })
      .returning();

    return created;
  }
}
