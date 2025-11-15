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
import type { ImportContext, ProgressUpdate } from './types';

// ============================================================================
// Output Schema - Employee-Centric Structure
// ============================================================================

// Entity with source tracking
const entityWithSourceSchema = z.object({
  data: z.record(z.any()).describe('The entity data (payslip, contract, etc.)'),
  sourceFile: z.string().describe('File name where this entity was found'),
  sourceSheet: z.string().describe('Sheet name where this entity was found'),
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
    payslips: z.array(entityWithSourceSchema).optional().describe('Payslip records for this employee'),
    contracts: z.array(entityWithSourceSchema).optional().describe('Contract records for this employee'),
    timeEntries: z.array(entityWithSourceSchema).optional().describe('Time entry records for this employee'),
    leaves: z.array(entityWithSourceSchema).optional().describe('Leave records for this employee'),
    benefits: z.array(entityWithSourceSchema).optional().describe('Benefit records for this employee'),
    documents: z.array(entityWithSourceSchema).optional().describe('Document records for this employee'),
  }).describe('All entities related to this employee'),

  // Match info
  matchConfidence: z.number().min(0).max(100).describe('Confidence that existing employee match is correct (0-100)'),
  matchReason: z.string().describe('Why this employee was matched or created'),
});

const aiImportResultSchema = z.object({
  employees: z.array(employeeWithEntitiesSchema).describe('All employees with their related entities'),

  rejected: z.object({
    payslips: z.array(z.object({
      data: z.record(z.any()),
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string().describe('Why this was rejected (e.g., "Employé non trouvé")'),
    })).optional(),
    contracts: z.array(z.object({
      data: z.record(z.any()),
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    timeEntries: z.array(z.object({
      data: z.record(z.any()),
      sourceFile: z.string(),
      sourceSheet: z.string(),
      reason: z.string(),
    })).optional(),
    leaves: z.array(z.object({
      data: z.record(z.any()),
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
  }),
});

export type AIImportResult = z.infer<typeof aiImportResultSchema>;

// ============================================================================
// Main Coordinator
// ============================================================================

export interface AIFirstImportParams {
  filePaths: Array<{ path: string; name: string; uploadedAt: Date }>;
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

  const { object: aiResult } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: aiImportResultSchema,
    prompt: buildAIPrompt({
      sheetsData: allSheetsData,
      existingEmployees,
      countryCode,
    }),
  });

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

  return `Tu es un expert RH qui doit analyser des fichiers Excel et les organiser par employé.

🌍 **CONTEXTE:**
Pays: ${countryCode === 'CI' ? 'Côte d\'Ivoire' : countryCode === 'SN' ? 'Sénégal' : countryCode}
Employés existants: ${existingEmployees.length}

---

**EMPLOYÉS EXISTANTS DANS LA BASE DE DONNÉES:**

${existingEmployeesText || 'Aucun employé existant'}

---

**DONNÉES EXCEL À ANALYSER:**

${excelDataText}

---

**TA MISSION:**

Analyse toutes ces données Excel et organise-les par employé. Pour chaque ligne de données:

1. **Identifie le type de données:**
   - Employé (informations personnelles, contact)
   - Bulletin de paie (salaire, période, montants)
   - Contrat (type CDI/CDD, dates, poste)
   - Pointage/Temps (heures travaillées, dates)
   - Congés (type, dates, durée)
   - Avantages (type, montant)

2. **Trouve l'employé correspondant:**
   - Compare avec les employés existants (par numéro, email, CNPS, nom)
   - Gère les variations de noms (KOUASSI Jean vs Jean KOUASSI, accents, etc.)
   - Si c'est un employé existant → utilise son ID
   - Si c'est un nouvel employé → marque isNew=true

3. **Groupe les entités par employé:**
   - Chaque employé reçoit toutes ses entités liées
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

🇨🇮 **Côte d'Ivoire:**
- Noms courants: Kouassi, N'Guessan, Yao, Koffi
- CNPS: 10 chiffres exactement
- SMIG: 75,000 FCFA/mois (pour validation salaire)

🇸🇳 **Sénégal:**
- Noms courants: Diop, Ndiaye, Sow, Fall, Sy
- IPRES: 13 chiffres
- SMIG: 60,000 FCFA/mois

**Variations de noms (très important):**
- "KOUASSI Jean" = "Jean KOUASSI" (ordre inversé)
- "Abdoulayé" = "Abdoulaye" (accents manquants)
- "Mohamed" = "Mohammed" = "Mouhamed" (variantes)

---

**FORMAT DE SORTIE:**

Retourne un JSON structuré avec:
- employees: tableau d'employés avec leurs entités liées
- rejected: entités qui n'ont pas pu être liées à un employé
- summary: statistiques globales

**EXEMPLE DE SORTIE:**

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
            "data": { "period": "2024-01", "grossSalary": 500000, "netSalary": 425000 },
            "sourceFile": "paie_janvier_2024.xlsx",
            "sourceSheet": "Bulletins"
          },
          {
            "data": { "period": "2024-02", "grossSalary": 500000, "netSalary": 425000 },
            "sourceFile": "paie_fevrier_2024.xlsx",
            "sourceSheet": "Paie"
          }
        ],
        "contracts": [
          {
            "data": { "type": "CDI", "startDate": "2020-01-15", "position": "Développeur" },
            "sourceFile": "contrats.xlsx",
            "sourceSheet": "CDI"
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
            "data": { "period": "2024-03", "grossSalary": 300000, "netSalary": 255000 },
            "sourceFile": "paie_mars_2024.xlsx",
            "sourceSheet": "Salaires"
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
        "data": { "employeeNumber": "EMP999", "period": "2024-01" },
        "sourceFile": "paie_janvier_2024.xlsx",
        "sourceSheet": "Bulletins",
        "reason": "Employé EMP999 non trouvé dans la base de données ni dans les fichiers"
      }
    ]
  },
  "summary": {
    "totalEmployees": 2,
    "newEmployees": 1,
    "existingEmployees": 1,
    "totalEntities": 4,
    "rejectedEntities": 1
  }
}
\`\`\`

---

**MAINTENANT, ANALYSE CES DONNÉES:**

Pense étape par étape:
1. Identifie tous les employés (nouveaux + existants)
2. Classe chaque ligne par type (payslip, contract, etc.)
3. Lie chaque entité à son employé
4. Rejette les orphelins (pas d'employé trouvé)
5. Construis le JSON final groupé par employé`;
}
