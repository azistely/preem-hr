/**
 * CMU Export Service
 * Handles export of CMU 1% contributions for CNPS declaration
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { cmuExportConfig, payrollLineItems, payrollRuns } from '@/lib/db/schema';
import { format } from 'date-fns';

export interface CMUExportResult {
  fileContent: string;
  fileName: string;
  totalAmount: number;
  employeeCount: number;
}

export interface CMUData {
  employeeNumber: string;
  employeeName: string;
  grossSalary: number;
  cmuAmount: number;
  dependents: number;
}

/**
 * Generate CMU 1% export for CNPS declaration
 */
export async function exportCMU(payrollRunId: string, tenantId: string): Promise<CMUExportResult> {
  // 1. Load CMU config
  const [config] = await db.select().from(cmuExportConfig).where(eq(cmuExportConfig.tenantId, tenantId));

  if (!config) {
    throw new Error('Configuration CMU non trouvée. Veuillez configurer dans les Paramètres.');
  }

  // 2. Load payroll run
  const [payrollRun] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, payrollRunId));

  if (!payrollRun) {
    throw new Error('Paie non trouvée');
  }

  // 3. Load payroll line items
  const lineItems = await db.select().from(payrollLineItems).where(eq(payrollLineItems.payrollRunId, payrollRunId));

  if (lineItems.length === 0) {
    throw new Error('Aucune ligne de paie trouvée');
  }

  // 4. Calculate CMU 1% for each employee
  const cmuData: CMUData[] = lineItems.map((item) => {
    const grossSalary = parseFloat(item.grossSalary);
    const cmuRate = parseFloat(config.cmuRate || '1.0');
    const cmuAmount = (grossSalary * cmuRate) / 100; // Default 1%

    return {
      employeeNumber: item.employeeNumber || '',
      employeeName: item.employeeName || '',
      grossSalary,
      cmuAmount,
      dependents: config.includeDependents ? 0 : 0, // Would need to load from employee record
    };
  });

  // 5. Generate CSV
  const csv = generateCMUCSV(cmuData, config, payrollRun);

  // 6. Calculate totals
  const totalAmount = cmuData.reduce((sum, d) => sum + d.cmuAmount, 0);

  // 7. Generate filename
  const fileName = generateCMUFileName(payrollRun);

  return {
    fileContent: csv,
    fileName,
    totalAmount,
    employeeCount: cmuData.length,
  };
}

/**
 * Generate CMU CSV file
 */
function generateCMUCSV(data: CMUData[], config: any, payrollRun: any): string {
  // Header with employer information
  let csv = `DECLARATION CMU - ${config.cmuEmployerNumber || 'N/A'}\n`;
  csv += `Période: ${format(new Date(payrollRun.periodStart), 'dd/MM/yyyy')} - ${format(new Date(payrollRun.periodEnd), 'dd/MM/yyyy')}\n`;
  csv += `Date de génération: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
  csv += '\n';

  // Column headers
  csv += 'Matricule,Nom et Prénoms,Salaire Brut,CMU (1%),Ayants Droit\n';

  // Data rows
  for (const d of data) {
    csv += `${d.employeeNumber},"${d.employeeName}",${d.grossSalary.toFixed(2)},${d.cmuAmount.toFixed(2)},${d.dependents}\n`;
  }

  // Totals
  csv += '\n';
  const totalGross = data.reduce((sum, d) => sum + d.grossSalary, 0);
  const totalCMU = data.reduce((sum, d) => sum + d.cmuAmount, 0);
  csv += `TOTAL,${data.length} employés,${totalGross.toFixed(2)},${totalCMU.toFixed(2)},\n`;

  return csv;
}

/**
 * Generate CMU filename
 */
function generateCMUFileName(payrollRun: any): string {
  const period = format(new Date(payrollRun.periodStart), 'yyyy-MM');
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  return `cmu_${period}_${timestamp}.csv`;
}

/**
 * Get or create CMU config for tenant
 */
export async function getOrCreateCMUConfig(tenantId: string) {
  const [config] = await db.select().from(cmuExportConfig).where(eq(cmuExportConfig.tenantId, tenantId));

  if (config) {
    return config;
  }

  // Create default config
  const [newConfig] = await db
    .insert(cmuExportConfig)
    .values({
      tenantId,
      cmuRate: '1.0',
      includeDependents: true,
      exportFormat: 'CSV',
    })
    .returning();

  return newConfig;
}

/**
 * Update CMU config
 */
export async function updateCMUConfig(
  tenantId: string,
  data: {
    cmuEmployerNumber?: string;
    cmuRate?: number;
    includeDependents?: boolean;
  }
) {
  const [existing] = await db.select().from(cmuExportConfig).where(eq(cmuExportConfig.tenantId, tenantId));

  if (existing) {
    const [updated] = await db
      .update(cmuExportConfig)
      .set({
        cmuEmployerNumber: data.cmuEmployerNumber,
        cmuRate: data.cmuRate?.toString(),
        includeDependents: data.includeDependents,
        updatedAt: new Date(),
      })
      .where(eq(cmuExportConfig.tenantId, tenantId))
      .returning();

    return updated;
  } else {
    const [created] = await db
      .insert(cmuExportConfig)
      .values({
        tenantId,
        cmuEmployerNumber: data.cmuEmployerNumber,
        cmuRate: data.cmuRate?.toString() || '1.0',
        includeDependents: data.includeDependents ?? true,
        exportFormat: 'CSV',
      })
      .returning();

    return created;
  }
}
