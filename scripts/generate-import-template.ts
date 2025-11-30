/**
 * Generate Employee Import Template
 * Creates Excel file with all 45 personnel fields + example data
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Column definitions with French headers and format hints
const COLUMNS = [
  // Section 1: Informations personnelles (9 fields)
  { header: 'Matricule*', hint: 'Ex: EMP001', example1: 'EMP001', example2: 'EMP002', example3: 'EMP003' },
  { header: 'Prénom*', hint: 'Ex: Jean', example1: 'Jean', example2: 'Aminata', example3: 'Laurent' },
  { header: 'Nom*', hint: 'Ex: Kouassi', example1: 'Kouassi', example2: 'Diabaté', example3: 'Martin' },
  { header: 'Genre*', hint: 'Homme/Femme/Autre', example1: 'Homme', example2: 'Femme', example3: 'Homme' },
  { header: 'Date de naissance*', hint: 'JJ/MM/AAAA', example1: '15/03/1985', example2: '22/07/1990', example3: '10/11/1978' },
  { header: 'Lieu de naissance', hint: 'Ex: Abidjan, Côte d\'Ivoire', example1: 'Abidjan, Côte d\'Ivoire', example2: 'Bamako, Mali', example3: 'Paris, France' },
  { header: 'Nationalité', hint: 'Ex: Ivoirienne', example1: 'Ivoirienne', example2: 'Malienne', example3: 'Française' },
  { header: 'Contact*', hint: 'Ex: +225 01 23 45 67 89', example1: '+225 07 12 34 56 78', example2: '+225 05 98 76 54 32', example3: '+225 01 23 45 67 89' },
  { header: 'Email', hint: 'Ex: jean.kouassi@example.com', example1: 'jean.kouassi@example.com', example2: 'aminata.diabate@example.com', example3: 'laurent.martin@example.com' },

  // Section 2: Documents d'identité (2 fields)
  { header: 'N° CNI/Passeport', hint: 'Ex: CI123456789', example1: 'CI123456789', example2: 'ML987654321', example3: 'FR456789123' },
  { header: 'Domicile', hint: 'Ex: Cocody, Abidjan', example1: 'Cocody, Abidjan', example2: 'Yopougon, Abidjan', example3: 'Plateau, Abidjan' },

  // Section 3: Registre du personnel (6 fields)
  { header: 'Zone Nationalité*', hint: 'LOCAL/CEDEAO/HORS_CEDEAO', example1: 'LOCAL', example2: 'CEDEAO', example3: 'HORS_CEDEAO' },
  { header: 'Type de salarié*', hint: 'LOCAL/EXPAT/DETACHE/STAGIAIRE', example1: 'LOCAL', example2: 'LOCAL', example3: 'EXPAT' },
  { header: 'Nom du père', hint: '', example1: 'Kouassi Yao', example2: 'Diabaté Moussa', example3: 'Martin Pierre' },
  { header: 'Nom de la mère', hint: '', example1: 'Kouassi Akissi', example2: 'Diabaté Fatoumata', example3: 'Martin Marie' },
  { header: 'Personne en cas d\'urgence', hint: 'Nom complet et lien', example1: 'Kouassi Aya (Épouse)', example2: 'Diabaté Ibrahim (Frère)', example3: 'Martin Sophie (Épouse)' },
  { header: 'Contact urgence', hint: 'Ex: +225 XX XX XX XX XX', example1: '+225 07 11 22 33 44', example2: '+225 05 55 66 77 88', example3: '+225 01 99 88 77 66' },

  // Section 4: Situation familiale (3 fields)
  { header: 'Situation Familiale*', hint: 'Célibataire/Marié(e)/Divorcé(e)/Veuf(ve)', example1: 'Marié', example2: 'Célibataire', example3: 'Marié' },
  { header: 'Nombre d\'enfants à charge*', hint: 'Ex: 2', example1: '3', example2: '0', example3: '2' },
  { header: 'Nbr Part', hint: 'Auto-calculé si vide', example1: '4.5', example2: '1', example3: '3.5' },

  // Section 5: Emploi (9 fields - added payment frequency and contract end date)
  { header: 'Date d\'embauche*', hint: 'JJ/MM/AAAA', example1: '01/01/2020', example2: '15/06/2023', example3: '01/09/2019' },
  { header: 'Nature du contrat*', hint: 'CDI/CDD/CDDTI/INTERIM/STAGE', example1: 'CDI', example2: 'CDD', example3: 'CDI' },
  { header: 'Date de fin de contrat**', hint: 'JJ/MM/AAAA - Requis pour CDD/CDDTI', example1: '', example2: '31/12/2024', example3: '' },
  { header: 'Fréquence de paiement*', hint: 'Mensuelle/Hebdomadaire/Bimensuelle/Journalière', example1: 'Mensuelle', example2: 'Mensuelle', example3: 'Mensuelle' },
  { header: 'Fonction*', hint: 'Ex: Responsable RH', example1: 'Directeur Général', example2: 'Assistante Administrative', example3: 'Directeur Financier' },
  { header: 'Métier', hint: 'Ex: Ressources Humaines', example1: 'Direction Générale', example2: 'Administration', example3: 'Finance et Comptabilité' },
  { header: 'Type Emploi', hint: 'Temps plein/Temps partiel/Occasionnel', example1: 'Temps plein', example2: 'Temps plein', example3: 'Temps plein' },
  { header: 'Date de sortie', hint: 'JJ/MM/AAAA - si applicable', example1: '', example2: '', example3: '' },
  { header: 'Nature de sortie', hint: 'Démission/Licenciement/Fin CDD/Retraite', example1: '', example2: '', example3: '' },

  // Section 6: Classification (7 fields)
  { header: 'Catégorie*', hint: 'Ex: C, M1, 1A, 2B - voir barème CGECI', example1: 'C', example2: '2A', example3: 'C' },
  { header: 'Qualification', hint: 'Ex: Cadre supérieur, Agent de maîtrise', example1: 'Cadre supérieur', example2: 'Employé qualifié', example3: 'Cadre supérieur' },
  { header: 'Salaire Catégoriel*', hint: 'Ex: 150000 - REQUIS pour la paie', example1: '500000', example2: '120000', example3: '600000' },
  { header: 'Sursalaire', hint: 'Ex: 50000 (0 si aucun) - Optionnel', example1: '200000', example2: '30000', example3: '300000' },
  { header: 'Régime horaire**', hint: 'Ex: 40 (heures/semaine) - Requis pour CDDTI', example1: '40', example2: '40', example3: '40' },
  { header: 'Indemnité de transport*', hint: 'Ex: 35000 - Minimum: Abidjan 30k, Bouaké 24k, Autres 20k', example1: '30000', example2: '30000', example3: '40000' },
  { header: 'Regime salaire', hint: 'Mensuel/Journalier/Horaire', example1: 'Mensuel', example2: 'Mensuel', example3: 'Mensuel' },

  // Section 7: Structure organisationnelle (7 fields)
  { header: 'Etablissement', hint: 'Ex: Siège social', example1: 'Siège social', example2: 'Siège social', example3: 'Siège social' },
  { header: 'Direction', hint: 'Ex: Direction Générale', example1: 'Direction Générale', example2: 'Direction Administrative', example3: 'Direction Financière' },
  { header: 'Département', hint: 'Ex: Ressources Humaines', example1: '', example2: 'Administration', example3: 'Comptabilité' },
  { header: 'Service', hint: 'Ex: Paie et Administration', example1: '', example2: 'Secrétariat', example3: 'Contrôle de gestion' },
  { header: 'Section', hint: 'Ex: Section Paie', example1: '', example2: '', example3: '' },
  { header: 'Site de travail*', hint: 'Ex: Abidjan Plateau', example1: 'Abidjan Plateau', example2: 'Abidjan Marcory', example3: 'Abidjan Plateau' },
  { header: 'Manager', hint: 'Matricule du manager, Ex: EMP000', example1: '', example2: 'EMP001', example3: 'EMP001' },

  // Section 8: Protection sociale (4 fields)
  { header: 'N° CNPS', hint: 'Ex: 1234567 - Optionnel', example1: '1234567', example2: '2345678', example3: '3456789' },
  { header: 'N° CMU', hint: 'Ex: CMU123456 - Requis si Couverture = CMU', example1: 'CMU123456', example2: 'CMU234567', example3: 'CMU345678' },
  { header: 'Couverture Maladie', hint: 'Aucune/CMU/Assurance privée/[Nom assureur]', example1: 'NSIA Assurances', example2: 'CMU', example3: 'Assurance privée' },
  { header: 'Date début couverture', hint: 'JJ/MM/AAAA - Défaut: date d\'embauche', example1: '01/01/2020', example2: '15/06/2023', example3: '01/09/2019' },

  // Section 9: Informations bancaires (2 fields)
  { header: 'Banque', hint: 'Ex: SGBCI, Ecobank, NSIA', example1: 'SGBCI', example2: 'Ecobank', example3: 'NSIA' },
  { header: 'RIB', hint: 'Ex: CI93 CI000 01234 56789 01234 567 89', example1: 'CI93 CI000 01234 56789 01234 567 89', example2: 'CI93 EC001 98765 43210 98765 432 10', example3: 'CI93 NS002 11111 22222 33333 444 55' },

  // Section 10: Congés (1 field)
  { header: 'Solde congés initial', hint: 'Ex: 2.5 - jours acquis à l\'embauche', example1: '0', example2: '0', example3: '5' },
];

// Minimal columns - includes required (*) and conditionally required (**)
// * = always required
// ** = conditionally required (based on contract type)
const MINIMAL_COLUMNS = COLUMNS.filter(col => col.header.includes('*'));

// Instructions sheet content
const INSTRUCTIONS = {
  title: 'Instructions d\'import des employés',
  sections: [
    {
      title: '📋 Champs obligatoires (marqués avec *)',
      items: [
        'Matricule - Identifiant unique de l\'employé',
        'Prénom et Nom',
        'Contact - Numéro de téléphone',
        'Situation Familiale - Pour les déductions fiscales',
        'Nombre d\'enfants à charge - Pour les déductions fiscales',
        'Date d\'embauche',
        'Nature du contrat - CDI, CDD, CDDTI, INTERIM, ou STAGE',
        'Fréquence de paiement - Mensuelle, Hebdomadaire, Bimensuelle, ou Journalière',
        'Fonction - Poste occupé',
        'Catégorie - Code CGECI (C, M1, 1A, 2B, etc.)',
        'Salaire Catégoriel - Salaire de base REQUIS pour la paie',
        'Indemnité de transport - Minimum 20k (autres), 24k (Bouaké), 30k (Abidjan)',
      ],
    },
    {
      title: '📋 Champs conditionnels (marqués avec **)',
      items: [
        'Date de fin de contrat** - REQUIS pour les contrats CDD et CDDTI',
        'Régime horaire** - REQUIS pour les contrats CDDTI (tâche définie)',
      ],
    },
    {
      title: '📝 Champs optionnels',
      items: [
        'N° CNPS - Numéro de sécurité sociale (peut être ajouté plus tard)',
        'Sursalaire - Prime salariale (0 si aucun)',
      ],
    },
    {
      title: '✅ Champs recommandés',
      items: [
        'N° CMU - Requis si l\'employé a une couverture CMU',
        'Couverture Maladie - Type d\'assurance santé (CMU, assurance privée, ou nom de l\'assureur)',
        'Date début couverture - Date d\'effet de l\'assurance (sinon date d\'embauche)',
        'Zone Nationalité - Pour les statistiques (LOCAL/CEDEAO/HORS_CEDEAO)',
        'Lieu de naissance - Requis pour certains documents officiels',
        'Noms des parents - Requis pour le registre du personnel',
        'Contact urgence - Important en cas d\'accident',
        'Banque et RIB - Pour les virements de salaire',
      ],
    },
    {
      title: '📅 Format des dates',
      items: [
        'Utilisez le format JJ/MM/AAAA',
        'Exemples: 01/01/2020, 15/06/2023, 31/12/2024',
        'Assurez-vous que la cellule est au format "Texte" ou "Date"',
      ],
    },
    {
      title: '🔢 Catégories professionnelles',
      items: [
        'C = Cadre (coefficient ≥ 1000)',
        'M1 = Maîtrise niveau 1 (coefficient 700-999)',
        'M2 = Maîtrise niveau 2 (coefficient 500-699)',
        '1A, 1B, 2A, 2B, etc. = Employés et ouvriers',
        'Voir le barème CGECI 2023 pour plus de détails',
      ],
    },
    {
      title: '⚠️ Erreurs courantes à éviter',
      items: [
        'Matricules en double - Chaque employé doit avoir un matricule unique',
        'Dates invalides - Vérifiez le format JJ/MM/AAAA',
        'Manager inexistant - Le matricule du manager doit exister dans la liste',
        'N° CNPS invalide - Doit contenir 7 à 10 chiffres',
        'Email invalide - Doit contenir @ et un domaine',
        'RIB invalide - Format: CI93 suivi de 26-30 caractères',
      ],
    },
    {
      title: '💡 Conseils',
      items: [
        'Commencez par les 3 exemples fournis pour comprendre le format',
        'Remplissez d\'abord les champs obligatoires (*)',
        'Ajoutez les champs recommandés pour une meilleure conformité',
        'Laissez les cellules vides si vous n\'avez pas l\'information',
        'Vous pourrez toujours compléter les informations plus tard',
        'Indemnité de transport: minimums légaux 20k (autres villes), 24k (Bouaké), 30k (Abidjan). Vous pouvez saisir un montant supérieur.',
      ],
    },
    {
      title: '🆘 Besoin d\'aide?',
      items: [
        'Si vous rencontrez des difficultés, choisissez l\'assistance WhatsApp',
        'Notre équipe vous aidera à préparer et importer vos données',
        'Service gratuit pendant votre période d\'essai',
        'Contact: +225 07 08 78 68 28',
      ],
    },
  ],
};

function generateMinimalTemplate() {
  console.log('🚀 Génération du modèle MINIMAL (18 champs obligatoires)...');

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Employee data with minimal columns only
  const headers = MINIMAL_COLUMNS.map(col => col.header);
  const hints = MINIMAL_COLUMNS.map(col => col.hint);
  const example1 = MINIMAL_COLUMNS.map(col => col.example1);
  const example2 = MINIMAL_COLUMNS.map(col => col.example2);
  const example3 = MINIMAL_COLUMNS.map(col => col.example3);

  const employeeData = [
    headers,
    hints,
    example1,
    example2,
    example3,
  ];

  const employeeSheet = XLSX.utils.aoa_to_sheet(employeeData);

  // Set column widths
  employeeSheet['!cols'] = MINIMAL_COLUMNS.map(() => ({ wch: 20 }));

  // Add to workbook
  XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employés');

  // Sheet 2: Instructions (minimal version)
  const instructionsData: any[][] = [
    ['Instructions - Modèle Minimal (18 champs obligatoires)'],
    [''],
    ['Ce modèle contient uniquement les 18 champs OBLIGATOIRES pour démarrer rapidement.'],
    ['Vous pourrez compléter les informations manquantes plus tard dans l\'application.'],
    [''],
  ];

  INSTRUCTIONS.sections.forEach(section => {
    instructionsData.push([section.title]);
    section.items.forEach(item => {
      instructionsData.push([`  • ${item}`]);
    });
    instructionsData.push(['']);
  });

  instructionsData.push(['💡 Besoin de plus de champs?']);
  instructionsData.push(['  • Téléchargez le "Modèle Complet" (46 champs) pour un registre du personnel exhaustif']);
  instructionsData.push(['  • Vous pouvez toujours compléter les informations manquantes dans l\'application']);

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 100 }];

  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Write file
  const outputDir = path.join(process.cwd(), 'public', 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'employee-import-template-minimal.xlsx');
  XLSX.writeFile(workbook, outputPath);

  console.log(`✅ Modèle minimal créé: ${outputPath}`);
  console.log(`📊 ${MINIMAL_COLUMNS.length} champs obligatoires`);
  console.log(`👥 3 exemples d'employés fournis`);
}

function generateCompleteTemplate() {
  console.log('🚀 Génération du modèle COMPLET (46 champs)...');

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Employee data
  const headers = COLUMNS.map(col => col.header);
  const hints = COLUMNS.map(col => col.hint);
  const example1 = COLUMNS.map(col => col.example1);
  const example2 = COLUMNS.map(col => col.example2);
  const example3 = COLUMNS.map(col => col.example3);

  const employeeData = [
    headers,
    hints,
    example1,
    example2,
    example3,
  ];

  const employeeSheet = XLSX.utils.aoa_to_sheet(employeeData);

  // Set column widths
  employeeSheet['!cols'] = COLUMNS.map(() => ({ wch: 20 }));

  // Add to workbook
  XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employés');

  // Sheet 2: Instructions (complete version)
  const instructionsData: any[][] = [
    ['Instructions - Modèle Complet (46 champs pour registre du personnel)'],
    [''],
    ['Ce modèle contient TOUS les champs pour un registre du personnel exhaustif.'],
    ['Les champs marqués avec * sont OBLIGATOIRES.'],
    [''],
  ];

  INSTRUCTIONS.sections.forEach(section => {
    instructionsData.push([section.title]);
    section.items.forEach(item => {
      instructionsData.push([`  • ${item}`]);
    });
    instructionsData.push(['']);
  });

  instructionsData.push(['💡 Trop de champs?']);
  instructionsData.push(['  • Téléchargez le "Modèle Minimal" (18 champs obligatoires) pour démarrer rapidement']);
  instructionsData.push(['  • Laissez les cellules vides si vous n\'avez pas encore l\'information']);

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 100 }];

  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Write file
  const outputDir = path.join(process.cwd(), 'public', 'templates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'employee-import-template-complete.xlsx');
  XLSX.writeFile(workbook, outputPath);

  console.log(`✅ Modèle complet créé: ${outputPath}`);
  console.log(`📊 ${COLUMNS.length} champs configurés`);
  console.log(`👥 3 exemples d'employés fournis`);
  console.log(`📖 ${INSTRUCTIONS.sections.length} sections d'instructions`);
}

function generateBothTemplates() {
  console.log('📝 Génération des deux modèles d\'import...\n');
  generateMinimalTemplate();
  console.log('');
  generateCompleteTemplate();
  console.log('\n✅ Les deux modèles ont été générés avec succès!');
}

// Run if executed directly
if (require.main === module) {
  generateBothTemplates();
}

export { generateMinimalTemplate, generateCompleteTemplate, generateBothTemplates, COLUMNS, MINIMAL_COLUMNS, INSTRUCTIONS };
