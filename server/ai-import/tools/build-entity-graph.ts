/**
 * Build Entity Graph Tool - AI-Powered Cross-File Relationship Analysis
 *
 * This tool analyzes classified sheets from multiple files and builds a complete
 * entity graph showing:
 * - Which sheets contribute to which database entities
 * - How to match records across files (matching keys)
 * - Dependencies between entities (import order)
 * - Cross-references between entity types
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ClassificationResult } from './classify-sheet';
import type { EntityGraph, EntityTypeNode, CrossReference } from '../types';
import { getSchemaContext } from '../data-type-registry';

export interface SheetClassification {
  fileName: string;
  sheetName: string;
  sheetIndex: number;
  rowCount: number;
  classification: ClassificationResult;
}

/**
 * Build entity graph from classified sheets across multiple files
 *
 * This uses AI to analyze all sheets holistically and determine:
 * - Entity groupings (which sheets contribute to same entity type)
 * - Matching strategies (how to join records across sheets)
 * - Import dependencies (which entities must be imported first)
 * - Cross-references (foreign key relationships)
 */
export async function buildEntityGraph(params: {
  sheets: SheetClassification[];
  countryCode?: string;
}): Promise<EntityGraph> {
  const { sheets, countryCode = 'CI' } = params;

  // Get database schema context for AI
  const schemaContext = getSchemaContext();

  // Define the output schema for entity graph
  const entityGraphSchema = z.object({
    entities: z.record(
      z.string(),
      z.object({
        entityType: z
          .string()
          .describe('Entity type ID (e.g., "employees", "employee_salaries")'),

        displayName: z
          .string()
          .describe('Human-readable name in French (e.g., "Employés", "Salaires historiques")'),

        targetTable: z
          .string()
          .describe('Target database table name'),

        sources: z
          .array(
            z.object({
              fileName: z.string(),
              sheetName: z.string(),
              sheetIndex: z.number(),
              rowCount: z.number(),
              dataType: z.string(),
              confidence: z.number(),
            })
          )
          .describe('Source sheets that contribute data to this entity'),

        matchingKeys: z
          .array(z.string())
          .describe('Fields used to match records across sources (e.g., ["employeeNumber", "email", "cnpsNumber"])'),

        estimatedCount: z
          .number()
          .describe('Estimated number of unique entities after merging sources'),

        dependencies: z
          .array(z.string())
          .describe('Entity types that must be imported first (e.g., employees before salaries)'),

        priority: z
          .number()
          .min(1)
          .max(10)
          .describe('Import priority (1 = highest, import first)'),
      })
    ),

    crossReferences: z
      .array(
        z.object({
          from: z.string().describe('Source entity type'),
          to: z.string().describe('Target entity type'),
          via: z.string().describe('Field name used for linking'),
          confidence: z.number().min(0).max(100),
        })
      )
      .describe('Relationships between entities (foreign keys)'),

    circularDependencies: z
      .array(z.array(z.string()))
      .describe('Detected circular dependencies (should be empty in valid graphs)'),
  });

  // Build comprehensive context for AI
  const totalFiles = new Set(sheets.map((s) => s.fileName)).size;
  const totalSheets = sheets.length;
  const dataTypes = Array.from(new Set(sheets.map((s) => s.classification.dataType)));

  // Use AI to build entity graph
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: entityGraphSchema,
    prompt: `Tu es un expert en architecture de données RH. Ta mission est d'analyser des feuilles Excel provenant de plusieurs fichiers et de construire un graphe d'entités montrant comment les données doivent être combinées.

**Contexte du projet:**
📂 ${totalFiles} fichier(s) Excel
📊 ${totalSheets} feuille(s) au total
🏷️  Types détectés: ${dataTypes.join(', ')}
🌍 Pays: ${countryCode === 'CI' ? '🇨🇮 Côte d\'Ivoire' : countryCode === 'SN' ? '🇸🇳 Sénégal' : countryCode}

---

**Schémas de base de données disponibles:**
${JSON.stringify(schemaContext, null, 2)}

---

**Feuilles classifiées à analyser:**
${JSON.stringify(
  sheets.map((s) => ({
    file: s.fileName,
    sheet: s.sheetName,
    rows: s.rowCount,
    type: s.classification.dataType,
    table: s.classification.targetTable,
    confidence: s.classification.confidence,
    requiredFields: s.classification.requiredFieldsPresent,
    optionalFields: s.classification.optionalFieldsPresent,
  })),
  null,
  2
)}

---

**Ta mission en 5 étapes:**

**ÉTAPE 1: Identifier les groupes d'entités**

Groupe les feuilles qui contribuent au **même type d'entité**. Par exemple:
- Si "Liste Employés.xlsx" et "Personnel 2024.xlsx" contiennent tous deux des employés
  → Ils vont dans le même groupe "employees"
- Si "Salaires Jan 2024" et "Paie 2023" contiennent des salaires historiques
  → Ils vont dans le groupe "employee_salaries"

🎯 **Règle clé:** Même si les fichiers ont des noms différents, s'ils décrivent la **même chose** (employés, salaires, congés), ils font partie du même groupe d'entités.

---

**ÉTAPE 2: Déterminer les clés de correspondance (matching keys)**

Pour chaque groupe d'entités, identifie les champs qui permettent de **relier les enregistrements entre les sources**.

**Exemples de clés de correspondance:**

Pour **employees:**
- **Clé primaire:** \`employeeNumber\` (matricule) - Si présent, c'est LA clé
- **Clé secondaire:** \`email\` - Unique et fiable
- **Clé tertiaire:** \`cnpsNumber\` (numéro sécurité sociale)
- **Fallback:** Fuzzy match sur \`firstName\` + \`lastName\` + \`hireDate\`

Pour **employee_salaries:**
- **Clé primaire:** \`employeeNumber\` + \`payPeriod\` (matricule + période)
- Si pas de matricule, utiliser fuzzy match sur nom

Pour **time_off_balances:**
- **Clé primaire:** \`employeeNumber\` + \`timeOffType\`

🚨 **Important:**
- Toujours privilégier les identifiants uniques (matricule, email, CNPS)
- Le fuzzy matching est un dernier recours
- Si aucune clé n'est disponible, note-le dans \`matchingKeys: []\`

---

**ÉTAPE 3: Estimer le nombre d'entités uniques**

Pour chaque groupe, devine combien d'entités **uniques** seront créées après fusion.

**Exemples:**
- Si "Employés.xlsx" a 50 lignes et "Salaires.xlsx" a 150 lignes (50 employés × 3 mois)
  → \`estimatedCount\` pour employees = 50
  → \`estimatedCount\` pour employee_salaries = 150

- Si deux fichiers ont tous deux 100 employés mais c'est la même liste
  → \`estimatedCount\` = 100 (pas 200)

**Stratégie:**
- Si les sources ont la même structure → Prendre le max
- Si les sources sont complémentaires → Additionner
- En cas de doute, prendre le max (mieux vaut sous-estimer que sur-estimer)

---

**ÉTAPE 4: Identifier les dépendances et priorités**

Certaines entités **dépendent** d'autres et doivent être importées **après**.

**Règles de dépendance (ordre d'import):**

1. **Priority 1 (importer en premier):**
   - \`employees\` - Base de tout, aucune dépendance

2. **Priority 2 (après les employés):**
   - \`employee_contracts\` - Dépend de employees
   - \`employee_bank_details\` - Dépend de employees
   - \`time_off_balances\` - Dépend de employees

3. **Priority 3 (après employés + contrats):**
   - \`employee_salaries\` - Dépend de employees (et possiblement contracts)
   - \`employee_benefits\` - Dépend de employees

4. **Priority 4 (après employés):**
   - \`employee_dependents\` - Dépend de employees

5. **Priority 5 (après employés + salaires):**
   - \`cnps_declarations\` - Dépend de employees et employee_salaries
   - \`tax_declarations\` - Dépend de employees et employee_salaries

**Exemples de dépendances:**
- \`employee_salaries\` dépend de \`employees\` (foreign key: employeeId)
- \`employee_dependents\` dépend de \`employees\` (foreign key: employeeId)
- \`cnps_declarations\` dépend de \`employees\` ET \`employee_salaries\`

---

**ÉTAPE 5: Détecter les références croisées**

Identifie les **liens** entre entités (foreign keys).

**Exemples:**
\`\`\`json
{
  "from": "employee_salaries",
  "to": "employees",
  "via": "employeeId",
  "confidence": 100
}
\`\`\`

\`\`\`json
{
  "from": "employee_dependents",
  "to": "employees",
  "via": "employeeId",
  "confidence": 100
}
\`\`\`

**Comment détecter:**
- Si une feuille contient des salaires → Elle référence employees via employeeNumber
- Si une feuille contient des dépendants → Elle référence employees via employeeNumber
- Si une feuille contient des déclarations CNPS → Elle référence employees + salaries

---

**Détection des dépendances circulaires:**

Vérifie qu'il n'y a **PAS** de cycles dans le graphe de dépendances.

❌ **Exemple de cycle (invalide):**
- employees dépend de contracts
- contracts dépend de salaries
- salaries dépend de employees
→ Cycle détecté!

✅ **Graphe valide (pas de cycle):**
- employees (priority 1)
- contracts dépend de employees (priority 2)
- salaries dépend de employees (priority 2)

Si tu détectes un cycle, ajoute-le dans \`circularDependencies\` pour investigation.

---

**Conseils pour une analyse de qualité:**

1. **Pense comme un DBA** - Comment structurerais-tu ces données dans une base?
2. **Cherche les doublons** - 2 fichiers "Employés" = 1 seul groupe d'entités
3. **Privilégie les clés uniques** - Matricule > Email > CNPS > Fuzzy match
4. **Respecte l'ordre d'import** - Toujours employees en premier
5. **Sois honnête sur les estimations** - En cas de doute, prends le max
6. **Détecte les relations** - Chaque entité non-employee référence probablement employees

---

**Exemples concrets:**

**Cas 1: Un seul fichier "Employés.xlsx" avec 1 feuille "Personnel"**
\`\`\`json
{
  "entities": {
    "employees": {
      "entityType": "employees",
      "displayName": "Employés",
      "targetTable": "employees",
      "sources": [
        {
          "fileName": "Employés.xlsx",
          "sheetName": "Personnel",
          "sheetIndex": 0,
          "rowCount": 50,
          "dataType": "employee_master",
          "confidence": 95
        }
      ],
      "matchingKeys": ["employeeNumber", "email"],
      "estimatedCount": 50,
      "dependencies": [],
      "priority": 1
    }
  },
  "crossReferences": [],
  "circularDependencies": []
}
\`\`\`

**Cas 2: Deux fichiers - "Employés.xlsx" (50 employés) + "Salaires 2024.xlsx" (150 lignes de paie)**
\`\`\`json
{
  "entities": {
    "employees": {
      "entityType": "employees",
      "displayName": "Employés",
      "targetTable": "employees",
      "sources": [
        {
          "fileName": "Employés.xlsx",
          "sheetName": "Personnel",
          "sheetIndex": 0,
          "rowCount": 50,
          "dataType": "employee_master",
          "confidence": 95
        }
      ],
      "matchingKeys": ["employeeNumber", "email"],
      "estimatedCount": 50,
      "dependencies": [],
      "priority": 1
    },
    "employee_salaries": {
      "entityType": "employee_salaries",
      "displayName": "Salaires historiques",
      "targetTable": "employee_salaries",
      "sources": [
        {
          "fileName": "Salaires 2024.xlsx",
          "sheetName": "Paie",
          "sheetIndex": 0,
          "rowCount": 150,
          "dataType": "payroll_history",
          "confidence": 92
        }
      ],
      "matchingKeys": ["employeeNumber", "payPeriod"],
      "estimatedCount": 150,
      "dependencies": ["employees"],
      "priority": 3
    }
  },
  "crossReferences": [
    {
      "from": "employee_salaries",
      "to": "employees",
      "via": "employeeId",
      "confidence": 100
    }
  ],
  "circularDependencies": []
}
\`\`\`

**Cas 3: Données fragmentées - 2 fichiers "Employés" partiels qui doivent fusionner**
\`\`\`json
{
  "entities": {
    "employees": {
      "entityType": "employees",
      "displayName": "Employés",
      "targetTable": "employees",
      "sources": [
        {
          "fileName": "Employés_Personnel.xlsx",
          "sheetName": "Liste",
          "sheetIndex": 0,
          "rowCount": 50,
          "dataType": "employee_master",
          "confidence": 90
        },
        {
          "fileName": "Employés_Contrats.xlsx",
          "sheetName": "Contracts",
          "sheetIndex": 0,
          "rowCount": 50,
          "dataType": "employee_contracts",
          "confidence": 88
        }
      ],
      "matchingKeys": ["employeeNumber", "email", "cnpsNumber"],
      "estimatedCount": 50,
      "dependencies": [],
      "priority": 1
    }
  },
  "crossReferences": [],
  "circularDependencies": []
}
\`\`\`

---

**Maintenant, analyse les feuilles fournies et construis le graphe d'entités!**

Pense étape par étape:
1. Quels sont les groupes d'entités?
2. Quelles sont les clés de correspondance?
3. Combien d'entités uniques?
4. Quelles sont les dépendances?
5. Quelles sont les références croisées?

Soit méthodique, précis, et honnête sur les incertitudes.`,
  });

  return object as EntityGraph;
}
