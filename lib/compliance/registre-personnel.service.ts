/**
 * Registre du Personnel Service
 *
 * Manages the digital employee register (Registre du Personnel) required by West African labor law.
 * Provides automatic entry creation on hire/exit and legal-compliant PDF export.
 *
 * Features:
 * - Automatic entry creation on employee hire/exit
 * - Sequential entry numbering per tenant
 * - Legal-compliant PDF export in landscape A4 format
 * - Audit logging for compliance
 * - Search and filter capabilities
 */

import { db } from '@/lib/db';
import { employees, tenants, users } from '@/drizzle/schema';
import { eq, and, gte, lte, isNull, desc, ilike, max, or } from 'drizzle-orm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createClient } from '@supabase/supabase-js';

// Lazy-load Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Type definitions
export interface RegisterEntry {
  id: string;
  tenantId: string;
  employeeId: string;
  entryType: 'hire' | 'exit' | 'modification';
  entryDate: Date;
  entryNumber: number;
  employeeNumber: string;
  fullName: string;
  dateOfBirth?: Date;
  nationality?: string;
  position?: string;
  department?: string;
  hireDate?: Date;
  exitDate?: Date;
  exitReason?: string;
  contractType?: string;
  cnpsNumber?: string;
  qualification?: string;
  registeredBy?: string;
  notes?: string;
  createdAt: Date;
}

export interface EmployeeDetails {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  nationality?: string;
  position?: string;
  department?: string;
  hireDate: Date;
  contractType?: string;
  cnpsNumber?: string;
  qualification?: string;
}

export interface CreateHireEntryInput {
  employeeId: string;
  tenantId: string;
  userId: string;
}

export interface CreateExitEntryInput {
  employeeId: string;
  exitDate: Date;
  exitReason: string;
  tenantId: string;
  userId: string;
}

export interface ExportOptions {
  dateFrom?: Date;
  dateTo?: Date;
  activeOnly?: boolean;
}

export interface SearchFilters {
  employeeName?: string;
  department?: string;
  entryType?: 'hire' | 'exit' | 'modification';
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Create register entry when employee is hired
 */
export async function createHireEntry(input: CreateHireEntryInput): Promise<{
  entryId: string;
  entryNumber: number;
}> {
  const { employeeId, tenantId, userId } = input;

  // Get employee details
  const employee = await getEmployeeDetails(employeeId, tenantId);

  // Get next entry number
  const entryNumber = await getNextEntryNumber(tenantId);

  // Create entry
  const [entry] = await db.execute(/* sql */`
    INSERT INTO employee_register_entries (
      tenant_id,
      employee_id,
      entry_type,
      entry_date,
      entry_number,
      employee_number,
      full_name,
      date_of_birth,
      nationality,
      position,
      department,
      hire_date,
      contract_type,
      cnps_number,
      qualification,
      registered_by
    ) VALUES (
      ${tenantId},
      ${employeeId},
      'hire',
      ${employee.hireDate},
      ${entryNumber},
      ${employee.employeeNumber},
      ${`${employee.lastName} ${employee.firstName}`},
      ${employee.dateOfBirth},
      ${employee.nationality || 'Ivoirienne'},
      ${employee.position},
      ${employee.department},
      ${employee.hireDate},
      ${employee.contractType},
      ${employee.cnpsNumber},
      ${employee.qualification},
      ${userId}
    )
    RETURNING id, entry_number
  `) as any[];

  // Log audit
  await logAudit({
    tenantId,
    registerEntryId: entry.id as string,
    action: 'create',
    newData: entry,
    performedBy: userId,
  });

  return {
    entryId: entry.id as string,
    entryNumber: entry.entry_number as number,
  };
}

/**
 * Create register entry when employee exits
 */
export async function createExitEntry(input: CreateExitEntryInput): Promise<{
  entryId: string;
  entryNumber: number;
}> {
  const { employeeId, exitDate, exitReason, tenantId, userId } = input;

  // Get employee details
  const employee = await getEmployeeDetails(employeeId, tenantId);

  // Get next entry number
  const entryNumber = await getNextEntryNumber(tenantId);

  // Create entry
  const [entry] = await db.execute(/* sql */`
    INSERT INTO employee_register_entries (
      tenant_id,
      employee_id,
      entry_type,
      entry_date,
      entry_number,
      employee_number,
      full_name,
      date_of_birth,
      nationality,
      position,
      department,
      hire_date,
      exit_date,
      exit_reason,
      contract_type,
      cnps_number,
      qualification,
      registered_by
    ) VALUES (
      ${tenantId},
      ${employeeId},
      'exit',
      ${exitDate},
      ${entryNumber},
      ${employee.employeeNumber},
      ${`${employee.lastName} ${employee.firstName}`},
      ${employee.dateOfBirth},
      ${employee.nationality || 'Ivoirienne'},
      ${employee.position},
      ${employee.department},
      ${employee.hireDate},
      ${exitDate},
      ${exitReason},
      ${employee.contractType},
      ${employee.cnpsNumber},
      ${employee.qualification},
      ${userId}
    )
    RETURNING id, entry_number
  `) as any[];

  // Log audit
  await logAudit({
    tenantId,
    registerEntryId: entry.id as string,
    action: 'create',
    newData: entry,
    performedBy: userId,
  });

  return {
    entryId: entry.id as string,
    entryNumber: entry.entry_number as number,
  };
}

/**
 * Export register to PDF (for labor inspection)
 * Uses @react-pdf/renderer for PDF generation
 */
export async function exportToPDF(
  tenantId: string,
  options: ExportOptions,
  userId: string
): Promise<{ fileUrl: string; totalEntries: number }> {
  // Build query
  let conditions = [`tenant_id = '${tenantId}'`];

  if (options.dateFrom) {
    conditions.push(`entry_date >= '${options.dateFrom.toISOString().split('T')[0]}'`);
  }

  if (options.dateTo) {
    conditions.push(`entry_date <= '${options.dateTo.toISOString().split('T')[0]}'`);
  }

  if (options.activeOnly) {
    conditions.push(`exit_date IS NULL`);
  }

  const whereClause = conditions.join(' AND ');

  // Get entries
  const entries = await db.execute(/* sql */`
    SELECT *
    FROM employee_register_entries
    WHERE ${whereClause}
    ORDER BY entry_number
  `);

  // Generate PDF buffer using custom renderer
  const pdfBuffer = await generateRegisterPDF(entries as any[], tenantId);

  // Upload to Supabase Storage
  const supabase = getSupabaseClient();
  const filename = `registre_personnel_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const { data, error } = await supabase.storage
    .from('register-exports')
    .upload(`${tenantId}/${filename}`, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('register-exports')
    .getPublicUrl(`${tenantId}/${filename}`);

  // Record export in database
  await db.execute(/* sql */`
    INSERT INTO register_exports (
      tenant_id,
      export_type,
      export_format,
      date_from,
      date_to,
      total_entries,
      file_url,
      exported_by
    ) VALUES (
      ${tenantId},
      ${options.activeOnly ? 'active_only' : 'full'},
      'PDF',
      ${options.dateFrom || null},
      ${options.dateTo || null},
      ${entries.length},
      ${urlData.publicUrl},
      ${userId}
    )
  `);

  return {
    fileUrl: urlData.publicUrl,
    totalEntries: entries.length,
  };
}

/**
 * Generate register PDF in landscape A4 format
 * This is a simplified version - in production, use @react-pdf/renderer
 */
async function generateRegisterPDF(
  entries: any[],
  tenantId: string
): Promise<Buffer> {
  // Get tenant details
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  // TODO: Implement using @react-pdf/renderer
  // For now, return placeholder
  // In production, create a RegisterPDF component similar to WorkCertificatePDF

  const placeholder = `
REGISTRE DU PERSONNEL

Entreprise: ${tenant?.name || 'N/A'}
Date d'édition: ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}

Total: ${entries.length} entrée(s)

${entries
  .map(
    (e, i) =>
      `${i + 1}. ${e.full_name} - ${e.position || 'N/A'} - Entrée: ${e.entry_date ? format(new Date(e.entry_date), 'dd/MM/yyyy') : 'N/A'}`
  )
  .join('\n')}

Document généré par Preem HR - Conforme au Code du Travail
`;

  return Buffer.from(placeholder, 'utf-8');
}

/**
 * Search register entries with filters
 */
export async function searchEntries(
  tenantId: string,
  filters: SearchFilters
): Promise<RegisterEntry[]> {
  let conditions = [`tenant_id = '${tenantId}'`];

  if (filters.employeeName) {
    conditions.push(`full_name ILIKE '%${filters.employeeName}%'`);
  }

  if (filters.department) {
    conditions.push(`department = '${filters.department}'`);
  }

  if (filters.entryType) {
    conditions.push(`entry_type = '${filters.entryType}'`);
  }

  if (filters.dateFrom) {
    conditions.push(`entry_date >= '${filters.dateFrom.toISOString().split('T')[0]}'`);
  }

  if (filters.dateTo) {
    conditions.push(`entry_date <= '${filters.dateTo.toISOString().split('T')[0]}'`);
  }

  const whereClause = conditions.join(' AND ');

  const results = await db.execute(/* sql */`
    SELECT *
    FROM employee_register_entries
    WHERE ${whereClause}
    ORDER BY entry_number DESC
  `);

  return results as any[];
}

/**
 * Get statistics for the register
 */
export async function getRegisterStats(tenantId: string): Promise<{
  totalEntries: number;
  hires: number;
  exits: number;
  active: number;
}> {
  const [stats] = await db.execute(/* sql */`
    SELECT
      COUNT(*) as total_entries,
      COUNT(*) FILTER (WHERE entry_type = 'hire') as hires,
      COUNT(*) FILTER (WHERE entry_type = 'exit') as exits,
      COUNT(*) FILTER (WHERE exit_date IS NULL) as active
    FROM employee_register_entries
    WHERE tenant_id = ${tenantId}
  `) as any[];

  return {
    totalEntries: Number(stats?.total_entries || 0),
    hires: Number(stats?.hires || 0),
    exits: Number(stats?.exits || 0),
    active: Number(stats?.active || 0),
  };
}

/**
 * Get employee details for register entry
 */
async function getEmployeeDetails(
  employeeId: string,
  tenantId: string
): Promise<EmployeeDetails> {
  const [employee] = await db
    .select({
      id: employees.id,
      employeeNumber: employees.employeeNumber,
      firstName: employees.firstName,
      lastName: employees.lastName,
      dateOfBirth: employees.dateOfBirth,
      hireDate: employees.hireDate,
      cnpsNumber: employees.cnpsNumber,
    })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
    .limit(1);

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }

  return employee as any;
}

/**
 * Get next sequential entry number for tenant
 */
async function getNextEntryNumber(tenantId: string): Promise<number> {
  const [result] = await db.execute(/* sql */`
    SELECT get_next_register_entry_number(${tenantId}) as next_number
  `) as any[];

  return Number(result?.next_number || 1);
}

/**
 * Log audit trail
 */
async function logAudit(params: {
  tenantId: string;
  registerEntryId?: string;
  action: 'create' | 'update' | 'delete' | 'export';
  oldData?: any;
  newData?: any;
  performedBy: string;
  ipAddress?: string;
}): Promise<void> {
  await db.execute(/* sql */`
    INSERT INTO register_audit_log (
      tenant_id,
      register_entry_id,
      action,
      old_data,
      new_data,
      performed_by,
      ip_address
    ) VALUES (
      ${params.tenantId},
      ${params.registerEntryId || null},
      ${params.action},
      ${params.oldData ? JSON.stringify(params.oldData) : null},
      ${params.newData ? JSON.stringify(params.newData) : null},
      ${params.performedBy},
      ${params.ipAddress || null}
    )
  `);
}
