import * as XLSX from 'xlsx';
import { db } from '@/db';
import { timeOffRequests, employees, timeOffPolicies } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export async function exportLeavePlan(
  periodId: string | null,
  tenantId: string,
  filters?: {
    departmentId?: string;
    status?: string;
  }
) {
  const workbook = XLSX.utils.book_new();

  // 1. Récupérer données avec jointures manuelles
  const allRequests = await db
    .select({
      request: timeOffRequests,
      employee: employees,
      policy: timeOffPolicies,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
    .where(
      and(
        periodId ? eq(timeOffRequests.planningPeriodId, periodId) : undefined,
        eq(timeOffRequests.tenantId, tenantId),
        filters?.status ? eq(timeOffRequests.status, filters.status) : undefined
      )
    );

  // No department filtering since employees don't have direct department relation
  const filteredRequests = allRequests;

  // 2. Feuille Résumé
  const totalRequests = filteredRequests.length;
  const totalDays = filteredRequests.reduce((sum, r) => sum + Number(r.request.totalDays), 0);
  const byStatus = {
    planned: filteredRequests.filter((r) => r.request.status === 'planned').length,
    pending: filteredRequests.filter((r) => r.request.status === 'pending').length,
    approved: filteredRequests.filter((r) => r.request.status === 'approved').length,
  };

  const summaryData = [
    ['RÉSUMÉ - PLANIFICATION DES CONGÉS'],
    [''],
    ['Statistiques globales'],
    ['Total demandes', totalRequests],
    ['Total jours', totalDays],
    [''],
    ['Par statut'],
    ['Planifié', byStatus.planned],
    ['En attente', byStatus.pending],
    ['Approuvé', byStatus.approved],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

  // 3. Feuille Détaillé
  const detailData: (string | number)[][] = [
    [
      'Matricule',
      'Nom',
      'Prénom',
      'Date Début',
      'Date Fin',
      'Jours',
      'Type',
      'Statut',
      'Notes Passation',
    ],
  ];

  for (const item of filteredRequests) {
    detailData.push([
      item.employee.employeeNumber,
      item.employee.lastName,
      item.employee.firstName,
      format(new Date(item.request.startDate), 'dd/MM/yyyy'),
      format(new Date(item.request.endDate), 'dd/MM/yyyy'),
      Number(item.request.totalDays),
      item.policy.name,
      translateStatus(item.request.status),
      item.request.handoverNotes || '',
    ]);
  }

  const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
  detailSheet['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 18 },
    { wch: 12 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Détaillé');

  // 4. Générer buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const base64 = buffer.toString('base64');
  const filename = `export-conges-${format(new Date(), 'yyyyMMdd-HHmmss')}.xlsx`;

  return { base64, filename };
}

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    planned: 'Planifié',
    pending: 'En attente',
    approved: 'Approuvé',
    rejected: 'Rejeté',
    cancelled: 'Annulé',
  };
  return translations[status] || status;
}
