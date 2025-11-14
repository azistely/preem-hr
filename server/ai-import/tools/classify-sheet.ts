/**
 * Classify Sheet Tool - AI-Powered Data Type Detection
 *
 * Uses AI to determine what type of HR data an Excel sheet contains.
 * NO hardcoded patterns - pure semantic understanding.
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { getSchemaContext } from '../data-type-registry';

export interface ClassificationResult {
  dataType: string;
  dataTypeName: string;
  targetTable: string;
  confidence: number;
  reasoning: string;
  requiredFieldsPresent: string[];
  optionalFieldsPresent: string[];
  missingRequiredFields: string[];
  fieldMappings: Record<string, string>;
}

/**
 * Classify an Excel sheet to determine what type of HR data it contains
 *
 * This tool uses AI to:
 * - Analyze sheet name, column headers, and sample data
 * - Determine which database table this data belongs to
 * - Map Excel columns to database fields
 * - Calculate confidence score
 * - Identify missing required fields
 */
export async function classifySheet(params: {
  sheetName: string;
  columns: string[];
  sampleData: Record<string, any>[];
  countryCode?: string;
}): Promise<ClassificationResult> {
  const { sheetName, columns, sampleData, countryCode = 'CI' } = params;

  // Get schema context for AI
  const schemaContext = getSchemaContext();

  // Define the output schema
  const classificationSchema = z.object({
    dataType: z
      .string()
      .describe('The ID of the data type from the registry (e.g., employee_master, payroll_history)'),

    dataTypeName: z
      .string()
      .describe('Human-readable name of the data type in French'),

    targetTable: z
      .string()
      .describe('Target database table name'),

    confidence: z
      .number()
      .min(0)
      .max(100)
      .describe('Confidence score 0-100%. Use 90%+ for certain, 70-89% for likely, <70% for uncertain'),

    reasoning: z
      .string()
      .describe('Detailed explanation of why you classified this as this data type. Mention specific column names and data patterns you observed.'),

    requiredFieldsPresent: z
      .array(z.string())
      .describe('List of required database fields that have matching Excel columns'),

    optionalFieldsPresent: z
      .array(z.string())
      .describe('List of optional database fields that have matching Excel columns'),

    missingRequiredFields: z
      .array(z.string())
      .describe('List of required database fields that are missing from Excel data'),

    fieldMappings: z
      .record(z.string(), z.string())
      .describe('Map of Excel column names to database field names. Example: {"Matricule": "employeeNumber", "Nom": "lastName"}'),
  });

  // Use AI to classify the sheet
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: classificationSchema,
    prompt: `Tu es un expert RH qui analyse des fichiers Excel complexes, souvent en désordre ou mal structurés. Ton rôle est de déterminer ce que contient ce fichier, comme un humain le ferait.

**Fichier à analyser:**
📄 Feuille: "${sheetName}"
📊 ${columns.length} colonnes: ${JSON.stringify(columns)}
📝 Aperçu (3 premières lignes):
${JSON.stringify(sampleData.slice(0, 3), null, 2)}

🌍 Pays: ${countryCode === 'CI' ? '🇨🇮 Côte d\'Ivoire' : countryCode === 'SN' ? '🇸🇳 Sénégal' : countryCode}

---

**Comment analyser (pense comme un humain):**

**ÉTAPE 1: Premier coup d'œil - Qu'est-ce que c'est?**
Regarde le nom de la feuille "${sheetName}":
- Est-ce que ça ressemble à une liste d'employés? (Employés, Personnel, Staff, Liste...)
- Ou à de la paie? (Paie, Salaires, Bulletin, SAGE, CIEL...)
- Ou à des congés? (Congés, Absences, CP, Leave...)
- Ou à des contrats/adhésions? (Contrats, Assurances, CMU, Mutuelle...)

**ÉTAPE 2: Regarde les colonnes - Qu'est-ce qu'on voit?**
Scanne les noms de colonnes ${JSON.stringify(columns)}:

🔍 Cherche des indices forts:
- **Matricule/Code/ID** → Probablement des employés
- **Nom + Prénom** → Très probablement des personnes (employés ou dépendants)
- **Salaire Brut/Net, CNPS, ITS/IRPP** → C'est de la PAIE
- **Date embauche/Date début** → Employés ou contrats
- **Période (YYYY-MM), Mois/Année** → Historique (paie, CNPS, etc.)
- **Type congé, Solde, Jours** → Congés
- **Régime, Adhésion, Cotisation** → Avantages sociaux

⚠️ **Pièges courants dans les fichiers désordonnés:**
- Les colonnes peuvent avoir des noms bizarres ou abrégés
- Il peut y avoir des colonnes vides ou inutiles
- Les noms peuvent être en majuscules, minuscules, ou mélangés
- Il peut y avoir des espaces/caractères spéciaux

**ÉTAPE 3: Examine les données - Qu'est-ce qui est dedans?**
Regarde les valeurs dans ${JSON.stringify(sampleData.slice(0, 3))}:

📌 Identifie les patterns:
- **Codes/Matricules** (EMP001, MAT123, etc.) → Employés
- **Montants** (500000, 75000, etc.) → Salaires ou primes
- **Dates** (2023-12-01, 15/01/2020) → Événements (embauche, période paie)
- **Nombres < 100** → Probablement jours (congés, ancienneté)
- **Grands nombres** (> 50000) → Probablement salaires en FCFA

**ÉTAPE 4: Fais le matching intelligent**
Compare avec les schémas disponibles:
${JSON.stringify(schemaContext, null, 2)}

🎯 **Stratégie de mapping:**
1. Trouve le schéma qui correspond le mieux au contenu global
2. Map les colonnes même si les noms ne sont pas exactement pareils
3. Accepte des variantes: "Matricule" = "Code" = "N°" = "ID Employé"
4. Si une colonne est floue, devine intelligemment basé sur le contexte

**ÉTAPE 5: Calcule ta confiance (sois honnête)**
- **95-100%**: Très sûr (tous les champs requis + noms clairs)
- **85-94%**: Plutôt sûr (champs requis présents, quelques ambiguïtés)
- **70-84%**: Moyennement sûr (champs importants manquants OU noms ambigus)
- **50-69%**: Pas très sûr (beaucoup de doutes)
- **< 50%**: Impossible à déterminer

🚨 **Ne force PAS un match si tu n'es pas sûr!** Mieux vaut une faible confiance qu'un mauvais choix.

**ÉTAPE 6: Explique ton raisonnement**
Écris en français pourquoi tu as choisi ce type:
- Mentionne les colonnes clés qui t'ont aidé
- Explique les doutes si tu en as
- Note les champs manquants importants

---

**Contexte pays (important!):**

🇨🇮 **Côte d'Ivoire:**
- CNPS = Caisse Nationale de Prévoyance Sociale
- ITS = Impôt sur Traitement et Salaire
- SMIG = 75,000 FCFA/mois
- Colonnes typiques paie: Brut, CNPS (salarié + employeur), ITS, Net

🇸🇳 **Sénégal:**
- IPRES = Institution de Prévoyance Retraite du Sénégal
- IRPP = Impôt sur le Revenu des Personnes Physiques
- SMIG = 209.10 FCFA/heure
- CSS = Caisse de Sécurité Sociale

---

**Exemples de patterns typiques:**

✅ **Employés:**
Colonnes: Matricule, Nom, Prénom, Email, Date embauche, CNPS N°, Téléphone
→ Table: \`employees\`, confidence: 95%+

✅ **Paie historique:**
Colonnes: Matricule, Période (2023-12), Brut, CNPS Salarié, ITS, Net
→ Table: \`historical_payroll_data\`, confidence: 90%+

✅ **Congés:**
Colonnes: Matricule, Nom, Type Congé, Solde Jours, Date Début
→ Table: \`time_off_balances\` ou \`time_off_requests\`, confidence: 85%+

---

**Maintenant, analyse ce fichier!** Pense étape par étape, sois intelligent, et sois honnête sur ta confiance.`,
  });

  return object as ClassificationResult;
}
