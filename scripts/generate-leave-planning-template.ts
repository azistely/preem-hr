import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function generateLeavePlanningTemplate(tenantName: string, periodName: string) {
  const workbook = XLSX.utils.book_new();

  // Feuille 1: Instructions
  const instructionsData = [
    ['TEMPLATE DE PLANIFICATION DES CONGÉS ANNUELS'],
    [''],
    [`Entreprise: ${tenantName}`],
    [`Période: ${periodName}`],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Remplissez la feuille "Plan de Congés" avec les informations de chaque employé'],
    ['2. Le Matricule doit correspondre à un employé existant dans le système'],
    ['3. Les dates doivent être au format JJ/MM/AAAA (ex: 15/01/2026)'],
    ['4. Le système calculera automatiquement le nombre de jours ouvrés'],
    ['5. Les Notes de Passation sont optionnelles mais recommandées'],
    [''],
    ['COLONNES OBLIGATOIRES:'],
    ['• Matricule'],
    ['• Date Début'],
    ['• Date Fin'],
    [''],
    ['COLONNES OPTIONNELLES:'],
    ['• Nom Prénom (pour référence visuelle, sera ignoré lors de l\'import)'],
    ['• Notes de Passation'],
    [''],
    ['TYPES DE CONGÉS ACCEPTÉS:'],
    ['• Congés annuels'],
    ['• Congés maladie'],
    ['• Congés maternité'],
    ['• Congés paternité'],
    ['• Congés sans solde'],
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Feuille 2: Plan de Congés (avec exemples)
  const planData = [
    [
      'Matricule',
      'Nom Prénom',
      'Date Début',
      'Date Fin',
      'Jours',
      'Type Congé',
      'Notes de Passation',
    ],
    [
      'EMP001',
      'Dupont Jean',
      '15/01/2026',
      '29/01/2026',
      '=NETWORKDAYS(C2,D2)',
      'Congés annuels',
      'Dossiers clients remis à Marie Martin. Codes accès dans le coffre.',
    ],
    [
      'EMP002',
      'Martin Marie',
      '05/02/2026',
      '19/02/2026',
      '=NETWORKDAYS(C3,D3)',
      'Congés annuels',
      'Réunion hebdo assurée par Jean Dupont. Contacts urgents dans CRM.',
    ],
    ['', '', '', '', '', '', ''], // Ligne vide pour ajouts
  ];

  const planSheet = XLSX.utils.aoa_to_sheet(planData);

  // Largeurs colonnes
  planSheet['!cols'] = [
    { wch: 12 }, // Matricule
    { wch: 20 }, // Nom Prénom
    { wch: 12 }, // Date Début
    { wch: 12 }, // Date Fin
    { wch: 8 },  // Jours
    { wch: 18 }, // Type Congé
    { wch: 50 }, // Notes Passation
  ];

  XLSX.utils.book_append_sheet(workbook, planSheet, 'Plan de Congés');

  // Feuille 3: Jours fériés (pour NETWORKDAYS)
  const holidaysData = [
    ['Jours fériés 2026 - Côte d\'Ivoire'],
    ['01/01/2026', 'Nouvel An'],
    ['07/04/2026', 'Lundi de Pâques'],
    ['01/05/2026', 'Fête du Travail'],
    ['15/05/2026', 'Ascension'],
    ['26/05/2026', 'Lundi de Pentecôte'],
    ['07/08/2026', 'Fête Nationale'],
    ['15/08/2026', 'Assomption'],
    ['01/11/2026', 'Toussaint'],
    ['15/11/2026', 'Jour de la Paix'],
    ['07/12/2026', 'Fête de la Commémoration'],
    ['25/12/2026', 'Noël'],
  ];

  const holidaysSheet = XLSX.utils.aoa_to_sheet(holidaysData);
  XLSX.utils.book_append_sheet(workbook, holidaysSheet, 'Jours fériés');

  return workbook;
}

// Fonction utilitaire pour télécharger
export function downloadTemplate(tenantName: string, periodName: string) {
  const wb = generateLeavePlanningTemplate(tenantName, periodName);
  const filename = `template-conges-${periodName.replace(/\s/g, '-')}-${format(new Date(), 'yyyyMMdd')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
