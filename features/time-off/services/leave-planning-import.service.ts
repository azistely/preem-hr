import * as XLSX from 'xlsx';
import { db } from '@/db';
import { employees, timeOffRequests, timeOffPolicies, timeOffBalances, tenants } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { parse, isValid, eachDayOfInterval, isWeekend } from 'date-fns';
import { z } from 'zod';
import { calculateReturnDate } from '@/features/time-tracking/services/holiday.service';

// Schéma validation
const LeaveRowSchema = z.object({
  'Matricule': z.string().min(1, 'Matricule requis'),
  'Date Début': z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format date: JJ/MM/AAAA'),
  'Date Fin': z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format date: JJ/MM/AAAA'),
  'Type Congé': z.string().optional().default('Congés annuels'),
  'Notes de Passation': z.string().optional(),
});

export interface ImportResult {
  success: number;
  errors: ImportError[];
  conflicts: ImportConflict[];
  totalProcessed: number;
}

export interface ImportError {
  row: number;
  employeeNumber: string;
  error: string;
  details?: string;
}

export interface ImportConflict {
  row: number;
  employeeNumber: string;
  employeeName: string;
  conflictType: 'overlap' | 'low_balance' | 'coverage_risk';
  message: string;
}

export async function importLeavePlan(
  fileBase64: string,
  periodId: string,
  tenantId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    errors: [],
    conflicts: [],
    totalProcessed: 0,
  };

  // Get tenant to determine country for return date calculation
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const countryCode = tenant?.countryCode || 'CI';

  try {
    // 1. Parser Excel
    const buffer = Buffer.from(fileBase64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets['Plan de Congés'];

    if (!worksheet) {
      throw new Error('Feuille "Plan de Congés" introuvable');
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false });
    result.totalProcessed = rows.length;

    // 2. Valider et créer requests
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, string>;
      const rowNumber = i + 2; // +2 car ligne 1 = header, index starts at 0

      // Skip empty rows
      if (!row['Matricule'] || row['Matricule'].trim() === '') {
        continue;
      }

      try {
        // Validation schéma
        const parsed = LeaveRowSchema.parse(row);

        // Valider employé existe
        const employee = await db.query.employees.findFirst({
          where: and(
            eq(employees.employeeNumber, parsed['Matricule']),
            eq(employees.tenantId, tenantId)
          ),
        });

        if (!employee) {
          result.errors.push({
            row: rowNumber,
            employeeNumber: parsed['Matricule'],
            error: 'Employé introuvable',
          });
          continue;
        }

        // Parser dates
        const startDate = parse(parsed['Date Début'], 'dd/MM/yyyy', new Date());
        const endDate = parse(parsed['Date Fin'], 'dd/MM/yyyy', new Date());

        if (!isValid(startDate) || !isValid(endDate)) {
          result.errors.push({
            row: rowNumber,
            employeeNumber: parsed['Matricule'],
            error: 'Dates invalides',
          });
          continue;
        }

        if (endDate < startDate) {
          result.errors.push({
            row: rowNumber,
            employeeNumber: parsed['Matricule'],
            error: 'Date de fin avant date de début',
          });
          continue;
        }

        // Calculer jours ouvrés
        const businessDays = calculateBusinessDays(startDate, endDate);

        // Trouver policy
        const policyType = mapTypeCongeToEnum(parsed['Type Congé'] || 'Congés annuels');
        const policy = await db.query.timeOffPolicies.findFirst({
          where: and(
            eq(timeOffPolicies.tenantId, tenantId),
            eq(timeOffPolicies.policyType, policyType)
          ),
        });

        if (!policy) {
          result.errors.push({
            row: rowNumber,
            employeeNumber: parsed['Matricule'],
            error: `Type de congé "${parsed['Type Congé']}" introuvable`,
          });
          continue;
        }

        // Vérifier solde
        const balance = await db.query.timeOffBalances.findFirst({
          where: and(
            eq(timeOffBalances.employeeId, employee.id),
            eq(timeOffBalances.policyId, policy.id)
          ),
        });

        if (balance && Number(balance.balance) < businessDays) {
          result.conflicts.push({
            row: rowNumber,
            employeeNumber: parsed['Matricule'],
            employeeName: `${employee.firstName} ${employee.lastName}`,
            conflictType: 'low_balance',
            message: `Solde insuffisant (disponible: ${balance.balance} jours, demandé: ${businessDays} jours)`,
          });
          // Continue quand même (peut être override manuellement)
        }

        // Vérifier chevauchements
        const overlaps = await db.query.timeOffRequests.findMany({
          where: and(
            eq(timeOffRequests.employeeId, employee.id),
            eq(timeOffRequests.status, 'approved')
          ),
        });

        const hasOverlap = overlaps.some((req) => {
          const reqStart = new Date(req.startDate);
          const reqEnd = new Date(req.endDate);
          return (startDate <= reqEnd && endDate >= reqStart);
        });

        if (hasOverlap) {
          result.conflicts.push({
            row: rowNumber,
            employeeNumber: parsed['Matricule'],
            employeeName: `${employee.firstName} ${employee.lastName}`,
            conflictType: 'overlap',
            message: `Chevauchement avec un congé existant`,
          });
          continue; // Ne pas créer si overlap
        }

        // Calculate return date (first business day after leave)
        const returnDate = await calculateReturnDate(endDate, countryCode);

        // Créer request avec status 'planned'
        await db.insert(timeOffRequests).values({
          tenantId,
          employeeId: employee.id,
          policyId: policy.id,
          startDate: startDate.toISOString().split('T')[0], // Format YYYY-MM-DD
          endDate: endDate.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          totalDays: businessDays.toString(),
          status: 'planned',
          planningPeriodId: periodId,
          handoverNotes: parsed['Notes de Passation'] || null,
          submittedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        result.success++;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          employeeNumber: row['Matricule'] || 'N/A',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Erreur import: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

// Utilitaires
function calculateBusinessDays(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end });
  return days.filter(day => !isWeekend(day)).length; // TODO: exclure jours fériés
}

function mapTypeCongeToEnum(type: string): string {
  const mapping: Record<string, string> = {
    'Congés annuels': 'annual_leave',
    'Congés maladie': 'sick_leave',
    'Congés maternité': 'maternity',
    'Congés paternité': 'paternity',
    'Congés sans solde': 'unpaid',
  };
  return mapping[type] || 'annual_leave';
}
