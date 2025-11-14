/**
 * Generate User-Friendly Import Summary
 *
 * Uses AI to create a human-readable summary in French showing:
 * - What entities will be created (X employés, Y contrats, etc.)
 * - Sample records (1-2 examples per entity type)
 * - File/sheet references
 * - All in French, concise, actionable
 *
 * Design Philosophy:
 * - Think like a human reviewing Excel files
 * - Show WHAT will be created, not technical details
 * - Include examples so users can verify correctness
 * - Keep it short and scannable
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ParsedSheet } from './parse-excel';
import type { ClassificationResult } from './classify-sheet';

// ============================================================================
// Types
// ============================================================================

export interface EntitySummary {
  /** Entity type name in French (e.g., "Employés", "Contrats de travail") */
  entityName: string;

  /** Number of records that will be created */
  count: number;

  /** Source sheet name */
  sheetName: string;

  /** Sample records (1-2 examples with key fields) */
  examples: Array<{
    /** Human-readable description (e.g., "KOUASSI Jean - EMP001") */
    description: string;
    /** Key fields to show (e.g., { "Matricule": "EMP001", "Nom": "KOUASSI" }) */
    keyFields: Record<string, string | number>;
  }>;
}

export interface ImportSummary {
  /** Overall summary in French (e.g., "Ce fichier va créer 50 employés et 12 contrats") */
  overallSummary: string;

  /** List of entities that will be created */
  entities: EntitySummary[];

  /** Any warnings or things to note */
  warnings: string[];

  /** Estimated total time (in French, e.g., "environ 2 minutes") */
  estimatedTime: string;
}

// ============================================================================
// AI-Powered Summary Generation
// ============================================================================

/**
 * Generate a user-friendly import summary using AI
 *
 * This function analyzes classified sheets and sample data to create
 * a concise, human-readable summary in French that users can understand.
 */
export async function generateImportSummary(params: {
  fileName: string;
  sheets: Array<{
    sheetData: ParsedSheet;
    classification: ClassificationResult;
  }>;
  countryCode?: string;
}): Promise<ImportSummary> {
  const { fileName, sheets, countryCode = 'CI' } = params;

  // Define the output schema
  const summarySchema = z.object({
    overallSummary: z
      .string()
      .describe(
        'Une phrase en français qui résume ce que le fichier va créer. Exemple: "Ce fichier va créer 50 employés et 12 contrats de travail." Soyez concis et direct.'
      ),

    entities: z
      .array(
        z.object({
          entityName: z
            .string()
            .describe(
              'Nom de l\'entité en français (pluriel). Exemples: "Employés", "Contrats de travail", "Enregistrements de paie". Utilisez des termes que les utilisateurs comprennent, pas des termes techniques.'
            ),

          count: z
            .number()
            .describe('Nombre d\'enregistrements qui seront créés'),

          sheetName: z
            .string()
            .describe('Nom de la feuille Excel source'),

          examples: z
            .array(
              z.object({
                description: z
                  .string()
                  .describe(
                    'Description lisible d\'un exemple (e.g., "KOUASSI Jean - Matricule EMP001" ou "Paie Décembre 2023 - 500,000 FCFA net")'
                  ),

                keyFields: z
                  .record(z.union([z.string(), z.number()]))
                  .describe(
                    'Champs clés à afficher. Maximum 3-4 champs. Exemples: {"Matricule": "EMP001", "Nom": "KOUASSI", "Prénom": "Jean"} ou {"Période": "2023-12", "Net": 500000}'
                  ),
              })
            )
            .min(1)
            .max(2)
            .describe(
              '1-2 exemples d\'enregistrements. Choisissez des exemples représentatifs et complets (pas de lignes vides ou incomplètes).'
            ),
        })
      )
      .describe('Liste des entités qui seront créées'),

    warnings: z
      .array(z.string())
      .describe(
        'Avertissements en français si quelque chose semble anormal. Exemples: "3 employés n\'ont pas de numéro CNPS" ou "Certains salaires semblent très bas". Soyez concis. Si tout semble normal, retournez un tableau vide [].'
      ),

    estimatedTime: z
      .string()
      .describe(
        'Temps estimé d\'import en français. Exemples: "moins d\'une minute", "environ 2 minutes", "environ 5 minutes". Basez-vous sur le nombre total d\'enregistrements: <100 = "moins d\'une minute", 100-500 = "environ 2 minutes", >500 = "environ 5 minutes".'
      ),
  });

  // Prepare context for AI
  const sheetsContext = sheets.map((sheet) => ({
    sheetName: sheet.sheetData.name,
    rowCount: sheet.sheetData.rowCount,
    dataType: sheet.classification.dataTypeName,
    dataTypeId: sheet.classification.dataType,
    confidence: sheet.classification.confidence,
    columns: sheet.sheetData.columns,
    sampleData: sheet.sheetData.sampleData.slice(0, 3), // First 3 rows
  }));

  // Use AI to generate summary
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: summarySchema,
    prompt: `Tu es un assistant qui aide les utilisateurs à comprendre ce qu'un import de données Excel va créer dans leur système RH.

**Contexte:**
- Fichier: "${fileName}"
- Pays: ${countryCode === 'CI' ? 'Côte d\'Ivoire' : countryCode === 'SN' ? 'Sénégal' : 'Autre'}
- L'utilisateur a uploadé un fichier Excel et l'IA a analysé son contenu
- Maintenant, l'utilisateur a besoin de savoir CE QUI VA ÊTRE CRÉÉ

**Ton rôle:**
Tu dois analyser les feuilles Excel classifiées et créer un résumé SIMPLE et CLAIR en français qui dit:
1. Combien d'enregistrements de chaque type seront créés (X employés, Y contrats, etc.)
2. Des exemples concrets pour que l'utilisateur puisse vérifier que c'est correct
3. Des avertissements si quelque chose semble anormal

**Feuilles analysées:**
${JSON.stringify(sheetsContext, null, 2)}

**Instructions CRITIQUES:**

1. **Pense comme un humain qui regarde ces fichiers Excel**
   - Si tu vois une feuille avec des noms/prénoms/matricules → ce sont des employés
   - Si tu vois des montants de salaire + dates → c'est de la paie
   - Si tu vois des types de congés + soldes → ce sont des congés

2. **Sois TRÈS concret dans les exemples**
   - Choisis des lignes COMPLÈTES (pas de données manquantes)
   - Montre les champs que l'utilisateur reconnaîtra (Nom, Prénom, Matricule pour employés)
   - Pour la paie, montre Période + Montant Net
   - Pour les congés, montre Type + Solde

3. **Utilise un langage simple**
   - Dis "50 employés" pas "50 enregistrements de type employee_master"
   - Dis "12 contrats de travail" pas "12 employment_contracts"
   - Dis "600 bulletins de paie" pas "600 payroll history records"

4. **Sois bref**
   - Résumé global: 1 phrase max
   - Exemples: montre seulement 3-4 champs clés
   - Avertissements: 1 ligne par problème

5. **Détecte les problèmes**
   - Employés sans CNPS → avertissement
   - Salaires < 50,000 FCFA → avertissement (probablement anormal)
   - Dates de paie dans le futur → avertissement
   - Mais si tout semble normal, ne crée PAS d'avertissement bidon

**Exemple de bon résumé:**

{
  "overallSummary": "Ce fichier va créer 50 employés et 12 contrats de travail.",
  "entities": [
    {
      "entityName": "Employés",
      "count": 50,
      "sheetName": "Liste Personnel",
      "examples": [
        {
          "description": "KOUASSI Jean - Matricule EMP001",
          "keyFields": {
            "Matricule": "EMP001",
            "Nom": "KOUASSI",
            "Prénom": "Jean",
            "Email": "j.kouassi@company.ci"
          }
        },
        {
          "description": "YAO Marie - Matricule EMP002",
          "keyFields": {
            "Matricule": "EMP002",
            "Nom": "YAO",
            "Prénom": "Marie",
            "Email": "m.yao@company.ci"
          }
        }
      ]
    },
    {
      "entityName": "Contrats de travail",
      "count": 12,
      "sheetName": "Contrats",
      "examples": [
        {
          "description": "CDI - KOUASSI Jean - Début 15/01/2020",
          "keyFields": {
            "Matricule": "EMP001",
            "Type": "CDI",
            "Date début": "2020-01-15"
          }
        }
      ]
    }
  ],
  "warnings": ["5 employés n'ont pas de numéro CNPS"],
  "estimatedTime": "moins d'une minute"
}

Maintenant, génère le résumé pour le fichier analysé ci-dessus.`,
  });

  return object as ImportSummary;
}
