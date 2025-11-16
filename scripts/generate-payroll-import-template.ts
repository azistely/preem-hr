/**
 * Generate Excel template for historical payroll import
 * Run with: npx tsx scripts/generate-payroll-import-template.ts
 */

import * as XLSX from 'xlsx';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Column definitions with French headers
 */
const columns = [
  // Run-level fields
  { key: 'numero_paie', header: 'Numéro de Paie*', width: 15, example: 'PAY-2024-01' },
  { key: 'periode_debut', header: 'Période Début*', width: 12, example: '2024-01-01' },
  { key: 'periode_fin', header: 'Période Fin*', width: 12, example: '2024-01-31' },
  { key: 'date_paiement', header: 'Date de Paiement*', width: 15, example: '2024-02-05' },
  { key: 'frequence_paiement', header: 'Fréquence*', width: 12, example: 'MONTHLY' },
  { key: 'nom_paie', header: 'Nom de la Paie', width: 20, example: 'Paie Janvier 2024' },
  { key: 'description_paie', header: 'Description', width: 30, example: 'Importation historique' },
  { key: 'code_pays', header: 'Code Pays*', width: 10, example: 'CI' },
  { key: 'sequence_cloture', header: 'Séquence Clôture', width: 15, example: '' },

  // Employee identification
  { key: 'matricule', header: 'Matricule*', width: 15, example: 'EMP001' },
  { key: 'nom_employe', header: 'Nom Employé', width: 25, example: 'KOUASSI Jean' },
  { key: 'numero_employe', header: 'Numéro Employé', width: 15, example: 'EMP001' },
  { key: 'titre_poste', header: 'Titre du Poste', width: 20, example: 'Développeur' },

  // Salary & allowances
  { key: 'salaire_base', header: 'Salaire de Base*', width: 15, example: '250000' },
  { key: 'logement', header: 'Logement', width: 12, example: '50000' },
  { key: 'transport', header: 'Transport', width: 12, example: '25000' },
  { key: 'repas', header: 'Repas', width: 12, example: '0' },
  { key: 'autres_allocations', header: 'Autres Allocations', width: 15, example: '0' },

  // Time tracking
  { key: 'jours_travailles', header: 'Jours Travaillés*', width: 15, example: '22' },
  { key: 'jours_absents', header: 'Jours Absents', width: 12, example: '0' },
  { key: 'heures_travaillees', header: 'Heures Travaillées', width: 15, example: '176' },
  { key: 'heures_supp_25', header: 'Heures Supp 25%', width: 15, example: '0' },
  { key: 'heures_supp_50', header: 'Heures Supp 50%', width: 15, example: '0' },
  { key: 'heures_supp_75', header: 'Heures Supp 75%', width: 15, example: '0' },
  { key: 'heures_supp_100', header: 'Heures Supp 100%', width: 16, example: '0' },
  { key: 'paiement_heures_supp', header: 'Paiement Heures Supp', width: 18, example: '0' },
  { key: 'primes', header: 'Primes', width: 12, example: '0' },

  // Earnings
  { key: 'salaire_brut', header: 'Salaire Brut*', width: 15, example: '325000' },
  { key: 'brut_imposable', header: 'Brut Imposable', width: 15, example: '325000' },

  // Employee deductions
  { key: 'cnps_employe', header: 'CNPS Employé*', width: 15, example: '26325' },
  { key: 'cmu_employe', header: 'CMU Employé', width: 12, example: '3250' },
  { key: 'its', header: 'ITS*', width: 12, example: '15000' },
  { key: 'autres_deductions', header: 'Autres Déductions', width: 18, example: '{}' },
  { key: 'total_deductions', header: 'Total Déductions*', width: 16, example: '44575' },
  { key: 'net_a_payer', header: 'Net à Payer*', width: 15, example: '280425' },

  // Employer contributions
  { key: 'cnps_employeur', header: 'CNPS Employeur*', width: 16, example: '58237.5' },
  { key: 'cmu_employeur', header: 'CMU Employeur', width: 15, example: '9750' },
  { key: 'autres_impots_employeur', header: 'Autres Impôts Employeur', width: 22, example: '0' },
  { key: 'cout_total_employeur', header: 'Coût Total Employeur*', width: 20, example: '392987.5' },

  // Payment details
  { key: 'methode_paiement', header: 'Méthode de Paiement', width: 18, example: 'bank_transfer' },
  { key: 'compte_bancaire', header: 'Compte Bancaire', width: 20, example: '' },
  { key: 'reference_paiement', header: 'Référence Paiement', width: 18, example: '' },
  { key: 'notes', header: 'Notes', width: 30, example: '' },
];

/**
 * Example rows for template
 */
const exampleRows = [
  {
    // Run-level
    numero_paie: 'PAY-2024-01',
    periode_debut: '2024-01-01',
    periode_fin: '2024-01-31',
    date_paiement: '2024-02-05',
    frequence_paiement: 'MONTHLY',
    nom_paie: 'Paie Janvier 2024',
    description_paie: 'Importation historique - Janvier 2024',
    code_pays: 'CI',
    sequence_cloture: '',

    // Employee 1
    matricule: 'EMP001',
    nom_employe: 'KOUASSI Jean',
    numero_employe: 'EMP001',
    titre_poste: 'Développeur Senior',
    salaire_base: 250000,
    logement: 50000,
    transport: 25000,
    repas: 0,
    autres_allocations: 0,
    jours_travailles: 22,
    jours_absents: 0,
    heures_travaillees: 176,
    heures_supp_25: 0,
    heures_supp_50: 0,
    heures_supp_75: 0,
    heures_supp_100: 0,
    paiement_heures_supp: 0,
    primes: 0,
    salaire_brut: 325000,
    brut_imposable: 325000,
    cnps_employe: 26325,
    cmu_employe: 3250,
    its: 15000,
    autres_deductions: '{}',
    total_deductions: 44575,
    net_a_payer: 280425,
    cnps_employeur: 58237.5,
    cmu_employeur: 9750,
    autres_impots_employeur: 0,
    cout_total_employeur: 392987.5,
    methode_paiement: 'bank_transfer',
    compte_bancaire: '',
    reference_paiement: '',
    notes: '',
  },
  {
    // Run-level (same run)
    numero_paie: 'PAY-2024-01',
    periode_debut: '2024-01-01',
    periode_fin: '2024-01-31',
    date_paiement: '2024-02-05',
    frequence_paiement: 'MONTHLY',
    nom_paie: 'Paie Janvier 2024',
    description_paie: 'Importation historique - Janvier 2024',
    code_pays: 'CI',
    sequence_cloture: '',

    // Employee 2
    matricule: 'EMP002',
    nom_employe: 'DIALLO Aminata',
    numero_employe: 'EMP002',
    titre_poste: 'Comptable',
    salaire_base: 180000,
    logement: 35000,
    transport: 20000,
    repas: 0,
    autres_allocations: 0,
    jours_travailles: 22,
    jours_absents: 0,
    heures_travaillees: 176,
    heures_supp_25: 0,
    heures_supp_50: 0,
    heures_supp_75: 0,
    heures_supp_100: 0,
    paiement_heures_supp: 0,
    primes: 0,
    salaire_brut: 235000,
    brut_imposable: 235000,
    cnps_employe: 19035,
    cmu_employe: 2350,
    its: 8000,
    autres_deductions: '{}',
    total_deductions: 29385,
    net_a_payer: 205615,
    cnps_employeur: 42105,
    cmu_employeur: 7050,
    autres_impots_employeur: 0,
    cout_total_employeur: 284155,
    methode_paiement: 'bank_transfer',
    compte_bancaire: '',
    reference_paiement: '',
    notes: '',
  },
];

/**
 * Generate the Excel template
 */
export function generatePayrollImportTemplate(): Buffer {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create data sheet with headers
  const headers = columns.map((col) => col.header);
  const data = [headers, ...exampleRows.map((row) => columns.map((col) => row[col.key as keyof typeof row] ?? ''))];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = columns.map((col) => ({ wch: col.width }));

  // Add instructions as comments on first row
  ws['A1'].c = [
    {
      a: 'System',
      t: `Instructions:
1. Les colonnes avec * sont OBLIGATOIRES
2. Remplissez une ligne par employé
3. Pour regrouper plusieurs employés dans une même paie, utilisez le même "Numéro de Paie"
4. Fréquence: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY
5. Code Pays: CI (Côte d'Ivoire), SN (Sénégal), BF (Burkina Faso), etc.
6. Méthode de Paiement: bank_transfer, cash, check, mobile_money
7. Dates au format: AAAA-MM-JJ (exemple: 2024-01-31)
8. Les montants sont en FCFA
9. Autres Déductions au format JSON: {"avance": 10000, "pret": 5000}`,
    },
  ];

  // Add sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Données de Paie');

  // Generate buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Save template to file (for testing)
 */
if (require.main === module) {
  const buffer = generatePayrollImportTemplate();
  const outputPath = join(process.cwd(), 'template_import_paie_historique.xlsx');
  writeFileSync(outputPath, buffer);
  console.log(`✅ Template généré: ${outputPath}`);
  console.log(`📊 ${columns.length} colonnes`);
  console.log(`📝 ${exampleRows.length} lignes d'exemple`);
}
