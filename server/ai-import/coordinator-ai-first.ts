/**
 * AI-First Import Coordinator
 *
 * SIMPLIFIED ARCHITECTURE:
 * 1. Parse Excel files (raw data)
 * 2. Load existing employees (simple list)
 * 3. ONE AI CALL - Sonnet 4 does everything:
 *    - Classifies data types
 *    - Matches duplicates
 *    - Links entities to employees
 *    - Groups by employee
 * 4. Returns employee-centric JSON
 * 5. UI shows preview
 * 6. Import to database
 *
 * NO complex code parsing - AI decides everything!
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { parseExcel } from './tools/parse-excel';
import { loadExistingEmployees } from './tools/load-existing-employees';
import { IMPORTABLE_ENTITIES } from './entity-definitions';
import type { ImportContext, ProgressUpdate } from './types';

// ============================================================================
// Output Schema - Employee-Centric Structure
// ============================================================================

// Specific schemas for each entity type based on entity-definitions.ts

const payslipDataSchema = z.object({
  period: z.string().describe('Period in YYYY-MM format (e.g., "2024-01")'),
  grossSalary: z.number().describe('Gross salary amount'),
  netSalary: z.number().describe('Net salary amount'),
  cnpsEmployee: z.number().optional().describe('CNPS employee contribution'),
  cnpsEmployer: z.number().optional().describe('CNPS employer contribution'),
  tax: z.number().optional().describe('Tax amount (ITS/IRPP)'),
});

const contractDataSchema = z.object({
  contractType: z.enum(['CDI', 'CDD', 'Stage', 'Essai', 'Apprentissage']).describe('Contract type'),
  startDate: z.string().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date for CDD contracts'),
  position: z.string().optional().describe('Job position/title'),
  baseSalary: z.number().optional().describe('Base salary amount'),
});

const timeEntryDataSchema = z.object({
  date: z.string().describe('Specific date in YYYY-MM-DD format'),
  hoursWorked: z.number().describe('Hours worked'),
  overtimeHours: z.number().optional().describe('Overtime hours'),
  type: z.enum(['Normal', 'Overtime', 'Weekend', 'Holiday']).optional().describe('Work type'),
});

const leaveDataSchema = z.object({
  leaveType: z.enum(['Annuel', 'Maladie', 'Maternité', 'Paternité', 'Sans solde', 'Formation']).describe('Leave type'),
  startDate: z.string().describe('Leave start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('Leave end date'),
  days: z.number().optional().describe('Number of days'),
  status: z.enum(['Pending', 'Approved', 'Rejected', 'En attente', 'Approuvé', 'Rejeté']).optional().describe('Leave status'),
});

const benefitDataSchema = z.object({
  benefitType: z.enum(['Logement', 'Transport', 'Téléphone', 'Voiture', 'Prime', 'Housing', 'Car']).describe('Benefit type'),
  amount: z.number().describe('Benefit amount'),
  frequency: z.enum(['monthly', 'yearly', 'one-time', 'mensuel', 'annuel']).optional().describe('Payment frequency'),
});

const documentDataSchema = z.object({
  documentType: z.enum(['ID', 'Passport', 'Contract', 'Diploma', 'CNI', 'Passeport', 'Diplôme']).describe('Document type'),
  reference: z.string().optional().describe('Document reference number'),
  issueDate: z.string().optional().describe('Issue date in YYYY-MM-DD format'),
});

const payrollLineItemDataSchema = z.object({
  period: z.string().describe('Period in YYYY-MM format'),
  componentType: z.enum(['earnings', 'deduction', 'tax', 'contribution']).describe('Component type'),
  description: z.string().describe('Component description (e.g., "Salaire de base", "CNPS employé")'),
  amount: z.number().describe('Component amount'),
});

const dependentDataSchema = z.object({
  firstName: z.string().describe('Dependent first name'),
  lastName: z.string().describe('Dependent last name'),
  relationship: z.enum(['spouse', 'child', 'conjoint', 'enfant', 'épouse', 'mari']).describe('Relationship to employee'),
  birthDate: z.string().optional().describe('Birth date in YYYY-MM-DD format'),
});

const terminationDataSchema = z.object({
  terminationDate: z.string().describe('Termination date in YYYY-MM-DD format'),
  reason: z.enum(['Resignation', 'Termination', 'Retirement', 'Démission', 'Licenciement', 'Retraite']).describe('Termination reason'),
  type: z.enum(['voluntary', 'involuntary', 'volontaire', 'involontaire']).optional().describe('Termination type'),
});

const overtimeEntryDataSchema = z.object({
  date: z.string().describe('Overtime date in YYYY-MM-DD format'),
  overtimeHours: z.number().describe('Number of overtime hours worked'),
  rate: z.number().optional().describe('Overtime rate multiplier (e.g., 1.5 for weekday, 2.0 for Sunday)'),
});

// Company/Reference Data Schemas (not employee-linked)
const payrollRunDataSchema = z.object({
  period: z.string().describe('Period in YYYY-MM format'),
  status: z.enum(['completed', 'draft', 'approved', 'paid']).describe('Payroll run status'),
  totalAmount: z.number().optional().describe('Total payroll amount for this period'),
});

const positionDataSchema = z.object({
  title: z.string().describe('Job position title (e.g., "Développeur Senior", "Comptable")'),
  code: z.string().optional().describe('Position code/reference'),
  department: z.string().optional().describe('Department name'),
});

const departmentDataSchema = z.object({
  name: z.string().describe('Department name (e.g., "Ressources Humaines", "Informatique")'),
  code: z.string().optional().describe('Department code/reference'),
});

const salaryComponentDataSchema = z.object({
  name: z.string().describe('Component name (e.g., "Prime de transport", "Indemnité logement")'),
  code: z.string().describe('Component code/reference'),
  componentType: z.enum(['earning', 'deduction', 'benefit', 'tax']).describe('Component type'),
  amount: z.number().optional().describe('Fixed amount if applicable'),
});

const tenantDataSchema = z.object({
  name: z.string().describe('Company name / Raison sociale'),
  countryCode: z.enum(['CI', 'SN', 'BF', 'ML', 'TG', 'BJ', 'NE']).describe('Country code (CI = Côte d\'Ivoire, SN = Sénégal, etc.)'),
  currency: z.enum(['XOF', 'XAF', 'USD', 'EUR']).optional().describe('Currency code (default: XOF)'),
  timezone: z.string().optional().describe('IANA timezone (e.g., "Africa/Abidjan")'),
  taxId: z.string().optional().describe('Tax ID number (NIF)'),
  businessRegistration: z.string().optional().describe('Business registration number (RCCM)'),
  industry: z.string().optional().describe('Industry / Secteur d\'activité'),
  sectorCode: z.string().describe('Sector code for payroll calculations (required)'),
  cgeciSectorCode: z.string().optional().describe('CGECI sector code (Côte d\'Ivoire only)'),
  workAccidentRate: z.number().optional().describe('Work accident insurance rate (e.g., 0.02 for 2%)'),
  defaultDailyTransportRate: z.number().optional().describe('Default daily transport allowance'),
});

// Generic entity with source tracking (for entity types not explicitly defined above)
const entityWithSourceSchema = z.object({
  data: z.record(z.any()).describe('The entity data'),
  sourceFile: z.string().describe('File name where this entity was found'),
  sourceSheet: z.string().describe('Sheet name where this entity was found'),
});

// Typed entity schemas for major entity types
const payslipWithSourceSchema = z.object({
  data: payslipDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const contractWithSourceSchema = z.object({
  data: contractDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const timeEntryWithSourceSchema = z.object({
  data: timeEntryDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const leaveWithSourceSchema = z.object({
  data: leaveDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const benefitWithSourceSchema = z.object({
  data: benefitDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const documentWithSourceSchema = z.object({
  data: documentDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const payrollLineItemWithSourceSchema = z.object({
  data: payrollLineItemDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const dependentWithSourceSchema = z.object({
  data: dependentDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const terminationWithSourceSchema = z.object({
  data: terminationDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const overtimeEntryWithSourceSchema = z.object({
  data: overtimeEntryDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const payrollRunWithSourceSchema = z.object({
  data: payrollRunDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const positionWithSourceSchema = z.object({
  data: positionDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const departmentWithSourceSchema = z.object({
  data: departmentDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const salaryComponentWithSourceSchema = z.object({
  data: salaryComponentDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const tenantWithSourceSchema = z.object({
  data: tenantDataSchema,
  sourceFile: z.string(),
  sourceSheet: z.string(),
});

const employeeWithEntitiesSchema = z.object({
  // Employee identity
  employeeId: z.string().uuid().optional().describe('ID if existing employee, undefined if new'),
  isNew: z.boolean().describe('true if new employee, false if existing (update)'),

  // Basic employee info
  employeeNumber: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().optional(),
  cnpsNumber: z.string().optional(),

  // Source tracking for employee data
  sourceFile: z.string().describe('File name where employee data was found'),
  sourceSheet: z.string().describe('Sheet name where employee data was found'),

  // Related entities (grouped by type) with source tracking
  relatedEntities: z.object({
    payslips: z.array(payslipWithSourceSchema).optional().describe('Payslip records for this employee'),
    contracts: z.array(contractWithSourceSchema).optional().describe('Contract records for this employee'),
    timeEntries: z.array(timeEntryWithSourceSchema).optional().describe('Time entry records for this employee'),
    leaves: z.array(leaveWithSourceSchema).optional().describe('Leave records for this employee'),
    benefits: z.array(benefitWithSourceSchema).optional().describe('Benefit records for this employee'),
    documents: z.array(documentWithSourceSchema).optional().describe('Document records for this employee'),
    payrollLineItems: z.array(payrollLineItemWithSourceSchema).optional().describe('Payroll line item records for this employee'),
    dependents: z.array(dependentWithSourceSchema).optional().describe('Dependent records for this employee'),
    terminations: z.array(terminationWithSourceSchema).optional().describe('Termination records for this employee (usually 0 or 1)'),
    overtimeEntries: z.array(overtimeEntryWithSourceSchema).optional().describe('Overtime entry records for this employee'),
  }).describe('All entities related to this employee'),

  // Match info
  matchConfidence: z.number().min(0).max(100).describe('Confidence that existing employee match is correct (0-100)'),
  matchReason: z.string().describe('Why this employee was matched or created'),
});

const aiImportResultSchema = z.object({
  employees: z.array(employeeWithEntitiesSchema).describe('All employees with their related entities'),

  // Tenant Configuration Data (not employee-linked)
  tenantData: z.object({
    tenant: tenantWithSourceSchema.optional().describe('Company/organization information'),
    salaryComponents: z.array(salaryComponentWithSourceSchema).optional().describe('Tenant salary component definitions (primes, indemnités, déductions personnalisées)'),
  }).optional().describe('Tenant-level configuration data'),

  rejected: z.object({
    payslips: z.array(z.object({
      data: payslipDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string().describe('Why this was rejected (e.g., "Employé non trouvé")'),
    })).optional(),
    contracts: z.array(z.object({
      data: contractDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    timeEntries: z.array(z.object({
      data: timeEntryDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    leaves: z.array(z.object({
      data: leaveDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    benefits: z.array(z.object({
      data: benefitDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    documents: z.array(z.object({
      data: documentDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    payrollLineItems: z.array(z.object({
      data: payrollLineItemDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    dependents: z.array(z.object({
      data: dependentDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    terminations: z.array(z.object({
      data: terminationDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    overtimeEntries: z.array(z.object({
      data: overtimeEntryDataSchema,
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
  }).describe('Entities that could not be linked to any employee'),

  summary: z.object({
    totalEmployees: z.number(),
    newEmployees: z.number(),
    existingEmployees: z.number(),
    totalEntities: z.number(),
    rejectedEntities: z.number(),
    tenantEntities: z.number().optional().describe('Number of tenant-level configuration entities'),
  }),
});

export type AIImportResult = z.infer<typeof aiImportResultSchema>;

// ============================================================================
// Main Coordinator
// ============================================================================

export interface AIFirstImportParams {
  filePaths: Array<{
    path: string;
    name: string;
    uploadedAt: Date;
    selectedSheets?: string[]; // If provided, only these sheets are analyzed
  }>;
  context: ImportContext;
}

export interface AIFirstImportResult {
  aiResult: AIImportResult;
  processingTimeMs: number;
}

export async function analyzeWithAI(params: AIFirstImportParams): Promise<AIFirstImportResult> {
  const { filePaths, context } = params;
  const { tenantId, countryCode = 'CI', onProgress } = context;

  const startTime = Date.now();

  // Step 1: Parse all Excel files
  onProgress?.({
    phase: 'parse',
    percent: 10,
    message: `Lecture de ${filePaths.length} fichier(s)...`,
    timestamp: new Date(),
  });

  const allSheetsData: Array<{
    fileName: string;
    sheetName: string;
    columns: string[];
    data: Record<string, any>[];
  }> = [];

  for (const file of filePaths) {
    const parseResult = await parseExcel({
      filePath: file.path,
      includeEmptyRows: false,
    });

    for (const sheet of parseResult.sheets) {
      // Filter: only include this sheet if no selection OR sheet is in selection
      if (file.selectedSheets && file.selectedSheets.length > 0) {
        if (!file.selectedSheets.includes(sheet.name)) {
          continue; // Skip this sheet - not selected by user
        }
      }

      allSheetsData.push({
        fileName: file.name,
        sheetName: sheet.name,
        columns: sheet.columns,
        data: sheet.allData,
      });
    }
  }

  onProgress?.({
    phase: 'parse',
    percent: 30,
    message: `${allSheetsData.length} feuille(s) analysée(s)`,
    timestamp: new Date(),
  });

  // Step 2: Load existing employees
  onProgress?.({
    phase: 'classify',
    percent: 40,
    message: 'Chargement des employés existants...',
    timestamp: new Date(),
  });

  const existingEmployees = await loadExistingEmployees({ tenantId });

  onProgress?.({
    phase: 'classify',
    percent: 50,
    message: `${existingEmployees.length} employé(s) existant(s) chargé(s)`,
    timestamp: new Date(),
  });

  // Step 3: ONE AI CALL - Let Sonnet 4 do everything!
  onProgress?.({
    phase: 'build_graph',
    percent: 60,
    message: 'Analyse intelligente par IA (Sonnet 4)...',
    timestamp: new Date(),
  });

  const aiPrompt = buildAIPrompt({
    sheetsData: allSheetsData,
    existingEmployees,
    countryCode,
  });

  // Log the prompt for debugging
  console.log('\n' + '='.repeat(80));
  console.log('AI IMPORT - PROMPT SENT TO SONNET 4');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Country: ${countryCode}`);
  console.log(`Files: ${filePaths.length}`);
  console.log(`Sheets: ${allSheetsData.length}`);
  console.log(`Existing Employees: ${existingEmployees.length}`);
  console.log(`Prompt Length: ${aiPrompt.length} characters`);
  console.log('='.repeat(80));
  console.log(aiPrompt);
  console.log('='.repeat(80) + '\n');

  const { object: aiResult } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: aiImportResultSchema,
    prompt: aiPrompt,
  });

  // Log the AI response for debugging
  console.log('\n' + '='.repeat(80));
  console.log('AI IMPORT - RESPONSE FROM SONNET 4');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Total Employees: ${aiResult.summary.totalEmployees}`);
  console.log(`New Employees: ${aiResult.summary.newEmployees}`);
  console.log(`Existing Employees: ${aiResult.summary.existingEmployees}`);
  console.log(`Total Entities: ${aiResult.summary.totalEntities}`);
  console.log(`Rejected Entities: ${aiResult.summary.rejectedEntities}`);
  console.log('='.repeat(80));
  console.log(JSON.stringify(aiResult, null, 2));
  console.log('='.repeat(80) + '\n');

  onProgress?.({
    phase: 'validate',
    percent: 90,
    message: `✓ ${aiResult.summary.totalEmployees} employé(s) identifié(s)`,
    details: {
      new: aiResult.summary.newEmployees,
      existing: aiResult.summary.existingEmployees,
      rejected: aiResult.summary.rejectedEntities,
    },
    timestamp: new Date(),
  });

  const processingTimeMs = Date.now() - startTime;

  return {
    aiResult,
    processingTimeMs,
  };
}

// ============================================================================
// AI Prompt Builder - Entity Definitions Formatter
// ============================================================================

/**
 * Format entity definitions for AI prompt
 * This gives Sonnet 4 complete information about all importable entities
 */
function formatEntityDefinitionsForAI(): string {
  const entityDescriptions = Object.entries(IMPORTABLE_ENTITIES)
    .map(([entityType, def], index) => {
      const num = index + 1;

      // Format recognition patterns
      const sheetNames = def.recognition.sheetNames.join(', ');
      const requiredFields = def.recognition.required;
      const pattern = def.recognition.pattern;
      const typical = def.recognition.typical.join(', ');

      // Format employee linking
      const employeeLinkInfo = def.employeeLink
        ? `**Lien employé:** ${def.employeeLink.description}\n   Priorité: ${def.employeeLink.priority.join(' → ')}`
        : '**Lien employé:** Aucun (entité de référence)';

      // Format key fields
      const fields = Object.entries(def.fields)
        .map(([fieldName, fieldDef]) => {
          const req = fieldDef.required ? ' [REQUIS]' : '';
          const variations = fieldDef.variations?.join(', ') || fieldName;
          const values = fieldDef.values ? `\n      Valeurs: ${fieldDef.values.join(', ')}` : '';
          const formats = (fieldDef as any).formats ? `\n      Formats: ${(fieldDef as any).formats.join(', ')}` : '';
          const note = (fieldDef as any).note ? `\n      Note: ${(fieldDef as any).note}` : '';

          return `   - **${fieldName}** (${fieldDef.type})${req}\n      Variations: ${variations}${values}${formats}${note}`;
        })
        .join('\n\n');

      return `**${num}. ${entityType.toUpperCase()}**
Table: \`${def.table}\`
Description: ${def.description}

**Reconnaissance:**
   - Noms de feuilles: ${sheetNames}
   - Champs requis: ${requiredFields}
   - Granularité: ${pattern}
   - Colonnes typiques: ${typical}

${employeeLinkInfo}

**Champs:**

${fields}`;
    })
    .join('\n\n---\n\n');

  return `**ENTITÉS IMPORTABLES (15 TYPES):**

${entityDescriptions}`;
}

// ============================================================================
// AI Prompt Builder
// ============================================================================

function buildAIPrompt(params: {
  sheetsData: Array<{
    fileName: string;
    sheetName: string;
    columns: string[];
    data: Record<string, any>[];
  }>;
  existingEmployees: Awaited<ReturnType<typeof loadExistingEmployees>>;
  countryCode: string;
}): string {
  const { sheetsData, existingEmployees, countryCode } = params;

  // Format existing employees for AI
  const existingEmployeesText = existingEmployees
    .map((emp, idx) =>
      `${idx + 1}. ID: ${emp.id}
   Nom complet: ${emp.firstName} ${emp.lastName}
   Numéro: ${emp.employeeNumber || 'N/A'}
   Email: ${emp.email || 'N/A'}
   CNPS: ${emp.cnpsNumber || 'N/A'}
   Statut: ${emp.status}`)
    .join('\n\n');

  // Format Excel data for AI
  const excelDataText = sheetsData
    .map((sheet) =>
      `Fichier: ${sheet.fileName}
Feuille: ${sheet.sheetName}
Colonnes: ${sheet.columns.join(', ')}
Nombre de lignes: ${sheet.data.length}

Aperçu des données (premières lignes):
${JSON.stringify(sheet.data.slice(0, 5), null, 2)}`)
    .join('\n\n---\n\n');

  const entityDefinitions = formatEntityDefinitionsForAI();

  // Current date/time for AI context
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
  const currentYear = now.getFullYear();
  const currentMonthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return `Tu es un expert RH qui doit analyser des fichiers Excel et les organiser par employé.

🌍 **CONTEXTE:**
Date actuelle: ${currentDate} (${currentMonthName})
Mois actuel: ${currentMonth}
Année actuelle: ${currentYear}
Pays: ${countryCode === 'CI' ? 'Côte d\'Ivoire' : countryCode === 'SN' ? 'Sénégal' : countryCode}
Employés existants: ${existingEmployees.length}

---

**EMPLOYÉS EXISTANTS DANS LA BASE DE DONNÉES:**

${existingEmployeesText || 'Aucun employé existant'}

---

**DONNÉES EXCEL À ANALYSER:**

${excelDataText}

---

${entityDefinitions}

---

**RÈGLES MÉTIER IMPORTANTES:**

Ces règles définissent comment classifier certains éléments de paie dans le contexte RH d'Afrique de l'Ouest (notamment Côte d'Ivoire et Sénégal).

1. **Toutes les Primes, Bonus, et Gratifications sont des composantes du SALAIRE:**
   - ❌ N'EST PAS un "Benefit" (employee_benefits)
   - ❌ N'EST PAS un "Payroll Line Item" (payroll_line_items)
   - ✅ TOUTES sont des composantes du salaire (employee_salaries)
   - Classification correcte:
     - **TOUJOURS inclure dans le montant brut (grossSalary) du payslip**
     - Exemple: Salaire base 450,000 + Prime transport 50,000 + Prime ancienneté 75,000 → grossSalary: 575,000
   - Exemples de primes/bonus à inclure dans grossSalary:
     - Prime de transport, Indemnité transport
     - Prime d'ancienneté, Prime de responsabilité
     - Prime de rendement, Prime de performance
     - Bonus annuel, 13ème mois
     - Gratification, Prime exceptionnelle
   - Raison: Toutes ces primes font partie de la rémunération brute, soumises aux cotisations sociales et à l'impôt
   - Note: payroll_line_items est réservé aux historiques détaillés de paie, PAS aux bulletins courants

2. **Avantages en nature (UNIQUEMENT ceux-ci sont des Benefits):**
   - ✅ SONT des "Benefits" (employee_benefits)
   - Types d'avantages en nature:
     - Logement (Housing) → employee_benefits (benefitType: "Logement")
     - Voiture de fonction (Company car) → employee_benefits (benefitType: "Voiture")
     - Téléphone → employee_benefits (benefitType: "Téléphone")
   - Raison: Ce sont des avantages en nature, pas des éléments du salaire brut en espèces

**Règle de distinction rapide:**
- Primes/Bonus/Gratifications (argent) → TOUJOURS dans employee_salaries.grossSalary
- Avantages en nature (logement, voiture, téléphone) → employee_benefits
- payroll_line_items → UNIQUEMENT pour historiques détaillés de paie (pas pour bulletins courants)

---

**TA MISSION:**

Analyse toutes ces données Excel et organise-les par employé. Pour chaque ligne de données:

1. **Identifie le type de données:**
   Utilise les définitions d'entités ci-dessus pour identifier précisément le type de chaque feuille Excel.
   Consulte les "Noms de feuilles" et "Champs requis" pour chaque type d'entité.

   Types principaux:
   - Employé (informations personnelles, contact)
   - Bulletin de paie (salaire, période, montants)
   - Contrat (type CDI/CDD, dates, poste)
   - Pointage/Temps (heures travaillées, dates)
   - Congés (type, dates, durée)
   - Avantages (type, montant)
   - Et 9 autres types (voir définitions complètes ci-dessus)

2. **Trouve l'employé correspondant:**
   Pour chaque entité NON-EMPLOYÉ, utilise la stratégie "Lien employé" définie ci-dessus:
   - Consulte la priorité de matching (employeeNumber → email → cnpsNumber → fullName)
   - Essaie chaque méthode dans l'ordre jusqu'à trouver une correspondance
   - Utilise les "Variations" de colonnes pour trouver le bon champ
   - Gère les variations de noms (KOUASSI Jean vs Jean KOUASSI, accents, etc.)
   - Si c'est un employé existant → utilise son ID
   - Si c'est un nouvel employé (trouvé dans les fichiers Excel) → marque isNew=true

3. **Groupe les entités par employé:**
   - Chaque employé reçoit toutes ses entités liées
   - Utilise les types d'entités définis ci-dessus (employee_salaries, employee_contracts, etc.)
   - Exemple: Jean Kouassi → 3 payslips + 2 contracts + 5 time entries

4. **TRACE LA SOURCE (CRITIQUE):**
   - Pour CHAQUE employé: indique le fichier (sourceFile) et la feuille (sourceSheet) où tu as trouvé ses données
   - Pour CHAQUE entité: indique le fichier (sourceFile) et la feuille (sourceSheet) d'origine
   - Exemple: Si un employé vient de "employes.xlsx" feuille "Personnel" → sourceFile: "employes.xlsx", sourceSheet: "Personnel"
   - Exemple: Si un bulletin vient de "paie_janvier.xlsx" feuille "Bulletins" → sourceFile: "paie_janvier.xlsx", sourceSheet: "Bulletins"

5. **IMPORTANT - Rejette les orphelins:**
   - Si une entité (payslip, contract, etc.) ne peut pas être liée à un employé → REJETTE-LA
   - Mets-la dans la section "rejected" avec la raison ET les sources
   - Exemple: "Employé EMP999 non trouvé dans la base de données"

---

**RÈGLES SPÉCIFIQUES:**

📅 **Dates et périodes (utilise la date actuelle ci-dessus):**
- Conversion de périodes: "Janvier 2025" → "2025-01", "Jan 2025" → "2025-01"
- Formats acceptés: "YYYY-MM", "MM/YYYY", "Janvier 2024", "Jan 2024", "01/2024"
- Contexte temporel: La date actuelle est ${currentDate} (${currentMonthName})
- Les périodes futures sont valides (planification, projections)
- Les dates de naissance récentes sont valides (nouveaux-nés, dépendants)

**Variations de noms (très important pour matching):**
- Ordre inversé: "KOUASSI Jean" = "Jean KOUASSI" = "Jean-Pierre KOUASSI"
- Accents manquants: "Abdoulayé" = "Abdoulaye", "François" = "Francois"
- Variantes d'orthographe: "Mohamed" = "Mohammed" = "Mouhamed"
- Espaces: "Jean Pierre" = "Jean-Pierre" = "JeanPierre"
- Casse: "KOUASSI" = "Kouassi" = "kouassi"

---

**FORMAT DE SORTIE:**

Retourne un JSON structuré avec:
- employees: tableau d'employés avec leurs entités liées
- rejected: entités qui n'ont pas pu être liées à un employé
- summary: statistiques globales

**EXEMPLE DE SORTIE:**

IMPORTANT: Respecte EXACTEMENT la structure des données ci-dessous.
- Utilise UNIQUEMENT les champs listés pour chaque type d'entité
- Les types de données doivent être corrects: string, number
- Les dates au format "YYYY-MM-DD", périodes au format "YYYY-MM"
- Les enums doivent utiliser les valeurs exactes listées

**SCHÉMA PAYSLIP (employee_salaries):**
{
  period: string,          // REQUIS - Format "YYYY-MM" (ex: "2024-01")
  grossSalary: number,     // REQUIS - Salaire brut
  netSalary: number,       // REQUIS - Salaire net
  cnpsEmployee?: number,   // OPTIONNEL - Cotisation CNPS employé
  cnpsEmployer?: number,   // OPTIONNEL - Cotisation CNPS employeur
  tax?: number            // OPTIONNEL - Impôt (ITS/IRPP)
}

**SCHÉMA CONTRACT (employee_contracts):**
{
  contractType: "CDI" | "CDD" | "Stage" | "Essai" | "Apprentissage",  // REQUIS
  startDate: string,       // REQUIS - Format "YYYY-MM-DD"
  endDate?: string,        // OPTIONNEL - Format "YYYY-MM-DD" (requis pour CDD)
  position?: string,       // OPTIONNEL - Poste/titre
  baseSalary?: number     // OPTIONNEL - Salaire de base
}

**SCHÉMA TIME_ENTRY (time_entries):**
{
  date: string,           // REQUIS - Format "YYYY-MM-DD"
  hoursWorked: number,    // REQUIS - Heures travaillées
  overtimeHours?: number, // OPTIONNEL - Heures supplémentaires
  type?: "Normal" | "Overtime" | "Weekend" | "Holiday"
}

**SCHÉMA LEAVE (leaves):**
{
  leaveType: "Annuel" | "Maladie" | "Maternité" | "Paternité" | "Sans solde" | "Formation",  // REQUIS
  startDate: string,      // REQUIS - Format "YYYY-MM-DD"
  endDate?: string,       // OPTIONNEL - Format "YYYY-MM-DD"
  days?: number,         // OPTIONNEL - Nombre de jours
  status?: "Pending" | "Approved" | "Rejected" | "En attente" | "Approuvé" | "Rejeté"
}

**SCHÉMA BENEFIT (employee_benefits):**
{
  benefitType: "Logement" | "Transport" | "Téléphone" | "Voiture" | "Prime" | "Housing" | "Car",  // REQUIS
  amount: number,        // REQUIS - Montant de l'avantage
  frequency?: "monthly" | "yearly" | "one-time" | "mensuel" | "annuel"  // OPTIONNEL
}

**SCHÉMA DOCUMENT (employee_documents):**
{
  documentType: "ID" | "Passport" | "Contract" | "Diploma" | "CNI" | "Passeport" | "Diplôme",  // REQUIS
  reference?: string,    // OPTIONNEL - Numéro de référence
  issueDate?: string    // OPTIONNEL - Format "YYYY-MM-DD"
}

**SCHÉMA PAYROLL_LINE_ITEM (payroll_line_items):**
{
  period: string,         // REQUIS - Format "YYYY-MM"
  componentType: "earnings" | "deduction" | "tax" | "contribution",  // REQUIS
  description: string,    // REQUIS - Ex: "Salaire de base", "CNPS employé"
  amount: number         // REQUIS - Montant du composant
}

**SCHÉMA DEPENDENT (employee_dependents):**
{
  firstName: string,      // REQUIS - Prénom de l'ayant droit
  lastName: string,       // REQUIS - Nom de l'ayant droit
  relationship: "spouse" | "child" | "conjoint" | "enfant" | "épouse" | "mari",  // REQUIS
  birthDate?: string     // OPTIONNEL - Format "YYYY-MM-DD"
}

**SCHÉMA TERMINATION (employee_terminations):**
{
  terminationDate: string,  // REQUIS - Format "YYYY-MM-DD"
  reason: "Resignation" | "Termination" | "Retirement" | "Démission" | "Licenciement" | "Retraite",  // REQUIS
  type?: "voluntary" | "involuntary" | "volontaire" | "involontaire"  // OPTIONNEL
}

**SCHÉMA OVERTIME_ENTRY (overtime_entries):**
{
  date: string,           // REQUIS - Format "YYYY-MM-DD"
  overtimeHours: number,  // REQUIS - Nombre d'heures supplémentaires
  rate?: number          // OPTIONNEL - Taux multiplicateur (ex: 1.5 pour semaine, 2.0 pour dimanche)
}

📋 **DONNÉES TENANT (Configuration tenant - NON liées aux employés)**

**SCHÉMA TENANT (tenants) - Informations société:**
{
  name: string,                    // REQUIS - Nom de la société / Raison sociale
  countryCode: "CI" | "SN" | "BF" | "ML" | "TG" | "BJ" | "NE",  // REQUIS - Code pays
  currency?: "XOF" | "XAF" | "USD" | "EUR",    // OPTIONNEL - Devise (défaut: XOF)
  timezone?: string,               // OPTIONNEL - Fuseau horaire (ex: "Africa/Abidjan")
  taxId?: string,                  // OPTIONNEL - Numéro NIF
  businessRegistration?: string,   // OPTIONNEL - Numéro RCCM
  industry?: string,               // OPTIONNEL - Secteur d'activité
  sectorCode: string,              // REQUIS - Code secteur pour calculs paie (AT/MP)
  cgeciSectorCode?: string,        // OPTIONNEL - Code secteur CGECI (CI seulement)
  workAccidentRate?: number,       // OPTIONNEL - Taux AT/MP (ex: 0.02 pour 2%)
  defaultDailyTransportRate?: number  // OPTIONNEL - Indemnité transport journalière
}

**SCHÉMA TENANT_SALARY_COMPONENT (tenant_salary_components) - Rubriques de paie:**
{
  name: string,           // REQUIS - Nom de la rubrique (ex: "Prime de transport", "Indemnité logement")
  code: string,           // REQUIS - Code de référence (ex: "TRANSP", "LOG")
  componentType: "earning" | "deduction" | "benefit" | "tax",  // REQUIS
  amount?: number        // OPTIONNEL - Montant fixe si applicable
}

Ces données sont INDEPENDANTES des employés - elles définissent la configuration de l'entreprise.

**EXEMPLE JSON COMPLET:**

\`\`\`json
{
  "employees": [
    {
      "employeeId": "uuid-existant-123",
      "isNew": false,
      "employeeNumber": "EMP001",
      "firstName": "Jean",
      "lastName": "Kouassi",
      "email": "jean.kouassi@company.ci",
      "cnpsNumber": "1234567890",
      "sourceFile": "employes.xlsx",
      "sourceSheet": "Personnel",
      "relatedEntities": {
        "payslips": [
          {
            "data": {
              "period": "2024-01",
              "grossSalary": 500000,
              "netSalary": 425000,
              "cnpsEmployee": 18000,
              "cnpsEmployer": 37500,
              "tax": 45000
            },
            "sourceFile": "paie_janvier_2024.xlsx",
            "sourceSheet": "Bulletins"
          }
        ],
        "contracts": [
          {
            "data": {
              "contractType": "CDI",
              "startDate": "2020-01-15",
              "position": "Développeur Senior",
              "baseSalary": 500000
            },
            "sourceFile": "contrats.xlsx",
            "sourceSheet": "CDI"
          }
        ],
        "timeEntries": [
          {
            "data": {
              "date": "2024-01-15",
              "hoursWorked": 8,
              "overtimeHours": 2,
              "type": "Normal"
            },
            "sourceFile": "pointage_janvier.xlsx",
            "sourceSheet": "Heures"
          }
        ],
        "leaves": [
          {
            "data": {
              "leaveType": "Annuel",
              "startDate": "2024-02-10",
              "endDate": "2024-02-20",
              "days": 10,
              "status": "Approuvé"
            },
            "sourceFile": "conges_2024.xlsx",
            "sourceSheet": "Congés"
          }
        ],
        "benefits": [
          {
            "data": {
              "benefitType": "Logement",
              "amount": 100000,
              "frequency": "monthly"
            },
            "sourceFile": "avantages.xlsx",
            "sourceSheet": "Avantages"
          }
        ],
        "documents": [
          {
            "data": {
              "documentType": "CNI",
              "reference": "CI-123456789",
              "issueDate": "2020-05-10"
            },
            "sourceFile": "documents.xlsx",
            "sourceSheet": "Pièces"
          }
        ],
        "payrollLineItems": [
          {
            "data": {
              "period": "2024-01",
              "componentType": "earnings",
              "description": "Salaire de base",
              "amount": 500000
            },
            "sourceFile": "details_paie_janvier.xlsx",
            "sourceSheet": "Lignes paie"
          },
          {
            "data": {
              "period": "2024-01",
              "componentType": "deduction",
              "description": "CNPS employé",
              "amount": 18000
            },
            "sourceFile": "details_paie_janvier.xlsx",
            "sourceSheet": "Lignes paie"
          }
        ],
        "dependents": [
          {
            "data": {
              "firstName": "Aminata",
              "lastName": "Kouassi",
              "relationship": "spouse",
              "birthDate": "1985-06-15"
            },
            "sourceFile": "ayants_droit.xlsx",
            "sourceSheet": "Famille"
          },
          {
            "data": {
              "firstName": "Ibrahim",
              "lastName": "Kouassi",
              "relationship": "child",
              "birthDate": "2010-09-20"
            },
            "sourceFile": "ayants_droit.xlsx",
            "sourceSheet": "Famille"
          }
        ],
        "overtimeEntries": [
          {
            "data": {
              "date": "2024-01-20",
              "overtimeHours": 3,
              "rate": 1.5
            },
            "sourceFile": "heures_sup_janvier.xlsx",
            "sourceSheet": "Heures supplémentaires"
          }
        ]
      },
      "matchConfidence": 100,
      "matchReason": "Correspondance exacte par numéro d'employé et email"
    },
    {
      "isNew": true,
      "employeeNumber": "EMP045",
      "firstName": "Marie",
      "lastName": "Traoré",
      "email": "marie.traore@company.ci",
      "sourceFile": "nouveaux_employes.xlsx",
      "sourceSheet": "Mars 2024",
      "relatedEntities": {
        "payslips": [
          {
            "data": {
              "period": "2024-03",
              "grossSalary": 300000,
              "netSalary": 255000,
              "cnpsEmployee": 10800,
              "cnpsEmployer": 22500,
              "tax": 15000
            },
            "sourceFile": "paie_mars_2024.xlsx",
            "sourceSheet": "Salaires"
          }
        ],
        "contracts": [
          {
            "data": {
              "contractType": "CDD",
              "startDate": "2024-03-01",
              "endDate": "2024-12-31",
              "position": "Assistante RH",
              "baseSalary": 300000
            },
            "sourceFile": "nouveaux_employes.xlsx",
            "sourceSheet": "Mars 2024"
          }
        ]
      },
      "matchConfidence": 100,
      "matchReason": "Nouvel employé détecté - pas de correspondance dans la base"
    }
  ],
  "rejected": {
    "payslips": [
      {
        "data": {
          "period": "2024-01",
          "grossSalary": 450000,
          "netSalary": 380000,
          "cnpsEmployee": 16200,
          "tax": 38000
        },
        "sourceFile": "paie_janvier_2024.xlsx",
        "sourceSheet": "Bulletins",
        "reason": "Employé avec matricule EMP999 non trouvé dans la base de données ni dans les fichiers Excel"
      }
    ],
    "contracts": [
      {
        "data": {
          "contractType": "CDI",
          "startDate": "2023-06-01",
          "position": "Technicien",
          "baseSalary": 350000
        },
        "sourceFile": "contrats.xlsx",
        "sourceSheet": "CDI",
        "reason": "Employé 'Pierre DUBOIS' non trouvé - nom ne correspond à aucun employé existant"
      }
    ],
    "leaves": [
      {
        "data": {
          "leaveType": "Maladie",
          "startDate": "2024-01-20",
          "endDate": "2024-01-25",
          "days": 5,
          "status": "Approuvé"
        },
        "sourceFile": "conges_2024.xlsx",
        "sourceSheet": "Congés",
        "reason": "Email 'unknown@example.com' ne correspond à aucun employé"
      }
    ],
    "payrollLineItems": [
      {
        "data": {
          "period": "2024-01",
          "componentType": "earnings",
          "description": "Prime exceptionnelle",
          "amount": 150000
        },
        "sourceFile": "details_paie_janvier.xlsx",
        "sourceSheet": "Lignes paie",
        "reason": "Matricule EMP888 non trouvé - impossible de lier cette ligne de paie à un employé"
      }
    ],
    "dependents": [
      {
        "data": {
          "firstName": "Sophie",
          "lastName": "Unknown",
          "relationship": "child",
          "birthDate": "2015-03-10"
        },
        "sourceFile": "ayants_droit.xlsx",
        "sourceSheet": "Famille",
        "reason": "Aucun matricule ou nom d'employé fourni pour cet ayant droit"
      }
    ],
    "terminations": [
      {
        "data": {
          "terminationDate": "2023-12-31",
          "reason": "Démission",
          "type": "voluntary"
        },
        "sourceFile": "sorties_2023.xlsx",
        "sourceSheet": "Départs",
        "reason": "Employé 'Ahmed SAID' non trouvé - impossible de lier cette sortie à un employé"
      }
    ],
    "overtimeEntries": [
      {
        "data": {
          "date": "2024-01-15",
          "overtimeHours": 4,
          "rate": 1.5
        },
        "sourceFile": "heures_sup_janvier.xlsx",
        "sourceSheet": "Heures supplémentaires",
        "reason": "CNPS number '9999999999' ne correspond à aucun employé"
      }
    ]
  },
  "tenantData": {
    "tenant": {
      "data": {
        "name": "ABC Technologies SARL",
        "countryCode": "CI",
        "currency": "XOF",
        "timezone": "Africa/Abidjan",
        "taxId": "CI-20240001-A",
        "businessRegistration": "CI-ABJ-2024-B-12345",
        "industry": "Technologies de l'information",
        "sectorCode": "SERVICES",
        "cgeciSectorCode": "CGECI-INFO",
        "workAccidentRate": 0.02,
        "defaultDailyTransportRate": 1500
      },
      "sourceFile": "info_societe.xlsx",
      "sourceSheet": "Entreprise"
    },
    "salaryComponents": [
      {
        "data": {
          "name": "Prime de transport",
          "code": "TRANSP",
          "componentType": "earning",
          "amount": 25000
        },
        "sourceFile": "composantes_paie.xlsx",
        "sourceSheet": "Rubriques"
      },
      {
        "data": {
          "name": "Indemnité logement",
          "code": "LOG",
          "componentType": "earning",
          "amount": 50000
        },
        "sourceFile": "composantes_paie.xlsx",
        "sourceSheet": "Rubriques"
      },
      {
        "data": {
          "name": "Retenue syndicale",
          "code": "SYNDICAT",
          "componentType": "deduction"
        },
        "sourceFile": "composantes_paie.xlsx",
        "sourceSheet": "Rubriques"
      }
    ]
  },
  "summary": {
    "totalEmployees": 2,
    "newEmployees": 1,
    "existingEmployees": 1,
    "totalEntities": 13,
    "rejectedEntities": 7,
    "tenantEntities": 4
  }
}
\`\`\`

---

**MAINTENANT, ANALYSE CES DONNÉES:**

Pense étape par étape:
1. Identifie tous les employés (nouveaux + existants)
2. Classe chaque ligne par type (payslip, contract, tenant, tenant_salary_component, etc.)
3. Pour les données TENANT (tenant info, salary_components) → place dans tenantData
4. Pour les données EMPLOYÉ → lie chaque entité à son employé
5. Rejette les orphelins (pas d'employé trouvé pour données employé)
6. Construis le JSON final groupé par employé + tenantData séparé

**IMPORTANT pour TENANT:**
- Si tu trouves une feuille "Entreprise", "Company", "Info Société" avec nom de société, pays, secteur → c'est tenantData.tenant
- Typiquement UNE SEULE LIGNE avec toutes les infos de l'entreprise
- Requis: name + countryCode + sectorCode`;
}
