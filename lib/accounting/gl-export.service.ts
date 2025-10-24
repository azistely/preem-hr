/**
 * GL Export Service
 * Handles export of payroll data to General Ledger formats
 * Supports: SYSCOHADA CSV, Sage TXT, Ciel IIF, Excel
 */

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  glExports,
  glJournalEntries,
  payrollAccountMappings,
  accountingAccounts,
  tenantComponentCodes,
  payrollRuns,
  payrollLineItems,
} from '@/lib/db/schema';
import { format } from 'date-fns';

export type ExportFormat = 'SYSCOHADA_CSV' | 'SAGE_TXT' | 'CIEL_IIF' | 'EXCEL';

export interface GLExportResult {
  exportId: string;
  format: ExportFormat;
  fileContent: string;
  fileName: string;
  totalDebit: number;
  totalCredit: number;
  entryCount: number;
  balanced: boolean;
}

export interface GLEntry {
  entryDate: Date;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
  reference: string;
  department: string | null;
  costCenter: string | null;
  employeeId: string | null;
}

export interface AccountMapping {
  componentType: string;
  debitAccountCode: string;
  creditAccountCode: string;
}

export interface ComponentCodeOverride {
  componentType: string;
  customCode: string;
  customDescription: string;
}

/**
 * Export payroll run to GL journal entries
 */
export async function exportPayrollToGL(
  payrollRunId: string,
  format: ExportFormat,
  tenantId: string,
  userId: string
): Promise<GLExportResult> {
  // 1. Load payroll run with line items
  const [payrollRun] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, payrollRunId));

  if (!payrollRun) {
    throw new Error('Payroll run not found');
  }

  const lineItems = await db
    .select()
    .from(payrollLineItems)
    .where(eq(payrollLineItems.payrollRunId, payrollRunId));

  if (lineItems.length === 0) {
    throw new Error('No payroll line items found');
  }

  // 2. Load account mappings for tenant
  const mappings = await getAccountMappings(tenantId);

  // 3. Load component code customizations
  const customCodes = await getCustomComponentCodes(tenantId);

  // 4. Generate GL entries
  const entries = generateGLEntries(payrollRun, lineItems, mappings, customCodes);

  // 5. Validate balanced entries
  const validation = validateGLEntries(entries);
  if (!validation.balanced) {
    throw new Error(`GL entries not balanced: ${validation.error}`);
  }

  // 6. Create export record
  const [exportRecord] = await db
    .insert(glExports)
    .values({
      payrollRunId,
      tenantId,
      exportFormat: format,
      periodStart: payrollRun.periodStart,
      periodEnd: payrollRun.periodEnd,
      totalDebit: validation.totalDebit.toString(),
      totalCredit: validation.totalCredit.toString(),
      entryCount: entries.length,
      exportedBy: userId,
      status: 'generated',
    })
    .returning();

  // 7. Insert journal entries
  await db.insert(glJournalEntries).values(
    entries.map((entry, idx) => ({
      exportId: exportRecord.id,
      entryDate: entry.entryDate.toISOString().split('T')[0],
      accountCode: entry.accountCode,
      accountName: entry.accountName,
      debitAmount: entry.debitAmount.toString(),
      creditAmount: entry.creditAmount.toString(),
      department: entry.department,
      costCenter: entry.costCenter,
      description: entry.description,
      reference: entry.reference,
      employeeId: entry.employeeId,
      lineNumber: idx + 1,
    }))
  );

  // 8. Format export file
  const fileContent = formatExport(entries, format, payrollRun);
  const fileName = generateFileName(exportRecord.id, format);

  // 9. Update export record with file name
  await db
    .update(glExports)
    .set({ fileName })
    .where(eq(glExports.id, exportRecord.id));

  return {
    exportId: exportRecord.id,
    format,
    fileContent,
    fileName,
    totalDebit: validation.totalDebit,
    totalCredit: validation.totalCredit,
    entryCount: entries.length,
    balanced: validation.balanced,
  };
}

/**
 * Generate GL entries from payroll line items
 */
function generateGLEntries(
  payrollRun: any,
  lineItems: any[],
  mappings: AccountMapping[],
  customCodes: ComponentCodeOverride[]
): GLEntry[] {
  const entries: GLEntry[] = [];
  const entryDate = payrollRun.payDate ? new Date(payrollRun.payDate) : new Date(payrollRun.periodEnd);

  // Group by account code to consolidate entries
  const accountTotals = new Map<string, number>();

  for (const lineItem of lineItems) {
    // 1. DEBIT: Salary expenses (6611)
    const grossSalary = parseFloat(lineItem.grossSalary);
    addToAccountTotal(accountTotals, '6611', grossSalary);

    // 2. DEBIT: Bonuses (6612)
    const bonuses = parseFloat(lineItem.bonuses || 0);
    if (bonuses > 0) {
      addToAccountTotal(accountTotals, '6612', bonuses);
    }

    // 3. DEBIT: CNPS employer contribution (6641)
    const cnpsEmployer = parseFloat(lineItem.cnpsEmployer || 0);
    if (cnpsEmployer > 0) {
      addToAccountTotal(accountTotals, '6641', cnpsEmployer);
    }

    // 4. CREDIT: Personnel - salaries payable (4211)
    const netSalary = parseFloat(lineItem.netSalary);
    addToAccountTotal(accountTotals, '4211', -netSalary);

    // 5. CREDIT: CNPS liability (4311)
    const cnpsEmployee = parseFloat(lineItem.cnpsEmployee || 0);
    const cnpsTotal = cnpsEmployee + cnpsEmployer;
    if (cnpsTotal > 0) {
      addToAccountTotal(accountTotals, '4311', -cnpsTotal);
    }

    // 6. CREDIT: ITS withheld (4471)
    const itsAmount = parseFloat(lineItem.its || 0);
    if (itsAmount > 0) {
      addToAccountTotal(accountTotals, '4471', -itsAmount);
    }
  }

  // Convert consolidated totals to GL entries
  const accountEntries = Array.from(accountTotals.entries());
  for (const [accountCode, amount] of accountEntries) {
    const accountName = getAccountName(accountCode);

    entries.push({
      entryDate,
      accountCode,
      accountName,
      debitAmount: amount > 0 ? amount : 0,
      creditAmount: amount < 0 ? Math.abs(amount) : 0,
      description: `Paie ${format(new Date(payrollRun.periodStart), 'MMMM yyyy')}`,
      reference: payrollRun.runNumber,
      department: null,
      costCenter: null,
      employeeId: null,
    });
  }

  return entries;
}

/**
 * Helper to accumulate account totals
 */
function addToAccountTotal(accountTotals: Map<string, number>, accountCode: string, amount: number) {
  const current = accountTotals.get(accountCode) || 0;
  accountTotals.set(accountCode, current + amount);
}

/**
 * Get account name from code (SYSCOHADA)
 */
function getAccountName(accountCode: string): string {
  const accounts: Record<string, string> = {
    '6611': 'Appointements et salaires',
    '6612': 'Primes et gratifications',
    '6613': 'Congés payés',
    '6614': 'Indemnités',
    '6641': 'Charges sociales (CNPS)',
    '4211': 'Personnel - Rémunérations dues',
    '4311': 'CNPS',
    '4471': 'ITS retenu à la source',
  };
  return accounts[accountCode] || accountCode;
}

/**
 * Format export file based on format type
 */
function formatExport(entries: GLEntry[], format: ExportFormat, payrollRun: any): string {
  switch (format) {
    case 'SYSCOHADA_CSV':
      return formatSYSCOHADACSV(entries);
    case 'SAGE_TXT':
      return formatSageTXT(entries);
    case 'CIEL_IIF':
      return formatCielIIF(entries);
    case 'EXCEL':
      return formatSYSCOHADACSV(entries); // For now, use CSV format
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Format entries as SYSCOHADA CSV
 */
function formatSYSCOHADACSV(entries: GLEntry[]): string {
  const header = 'Date,Code Compte,Libellé Compte,Débit,Crédit,Libellé Écriture,Référence\n';
  const rows = entries
    .map((e) => {
      const date = format(e.entryDate, 'dd/MM/yyyy');
      return `${date},${e.accountCode},"${e.accountName}",${e.debitAmount.toFixed(2)},${e.creditAmount.toFixed(2)},"${e.description}",${e.reference}`;
    })
    .join('\n');

  return header + rows;
}

/**
 * Format entries as Sage TXT (format specifique Sage)
 */
function formatSageTXT(entries: GLEntry[]): string {
  // Sage format: JJMMAA|CODE|LIBELLE|DEBIT|CREDIT|REF
  return entries
    .map((e) => {
      const date = format(e.entryDate, 'ddMMyy');
      const debit = e.debitAmount.toFixed(2).padStart(15, ' ');
      const credit = e.creditAmount.toFixed(2).padStart(15, ' ');
      return `${date}|${e.accountCode}|${e.accountName.substring(0, 30)}|${debit}|${credit}|${e.reference}`;
    })
    .join('\n');
}

/**
 * Format entries as Ciel IIF (Intuit Interchange Format)
 */
function formatCielIIF(entries: GLEntry[]): string {
  let iif = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n';
  iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tDOCNUM\tMEMO\n';
  iif += '!ENDTRNS\n';

  let trnsId = 1;
  for (const entry of entries) {
    const date = format(entry.entryDate, 'MM/dd/yyyy');
    const amount = entry.debitAmount > 0 ? entry.debitAmount : -entry.creditAmount;

    iif += `TRNS\t${trnsId}\tGENERAL JOURNAL\t${date}\t${entry.accountCode}\t\t\t${amount.toFixed(2)}\t${entry.reference}\t${entry.description}\n`;
    iif += `SPL\t${trnsId}\tGENERAL JOURNAL\t${date}\t${entry.accountCode}\t\t\t${amount.toFixed(2)}\t${entry.reference}\t${entry.description}\n`;
    iif += 'ENDTRNS\n';
    trnsId++;
  }

  return iif;
}

/**
 * Generate file name based on export ID and format
 */
function generateFileName(exportId: string, exportFormat: ExportFormat): string {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const extension = exportFormat === 'SYSCOHADA_CSV' || exportFormat === 'EXCEL' ? 'csv' : exportFormat === 'SAGE_TXT' ? 'txt' : 'iif';
  return `gl_export_${timestamp}.${extension}`;
}

/**
 * Validate GL entries are balanced
 */
function validateGLEntries(entries: GLEntry[]): {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  error?: string;
} {
  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const balanced = Math.abs(totalDebit - totalCredit) < 0.01; // Allow 1 centime rounding

  return {
    balanced,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    error: balanced ? undefined : `Débit (${totalDebit.toFixed(2)}) ≠ Crédit (${totalCredit.toFixed(2)})`,
  };
}

/**
 * Get account mappings for tenant
 */
async function getAccountMappings(tenantId: string): Promise<AccountMapping[]> {
  const mappings = await db
    .select()
    .from(payrollAccountMappings)
    .where(and(eq(payrollAccountMappings.tenantId, tenantId), eq(payrollAccountMappings.isActive, true)));

  return mappings.map((m) => ({
    componentType: m.componentType,
    debitAccountCode: '', // Would need to join with accountingAccounts
    creditAccountCode: '', // Would need to join with accountingAccounts
  }));
}

/**
 * Get custom component codes for tenant
 */
async function getCustomComponentCodes(tenantId: string): Promise<ComponentCodeOverride[]> {
  const codes = await db
    .select()
    .from(tenantComponentCodes)
    .where(eq(tenantComponentCodes.tenantId, tenantId));

  return codes.map((c) => ({
    componentType: c.componentType || '',
    customCode: c.customCode,
    customDescription: c.customDescription || '',
  }));
}
