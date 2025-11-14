/**
 * Match Records Tool - Cross-Source Entity Matching
 *
 * This tool matches records from different sources that refer to the same entity.
 * Uses multiple matching strategies with fallback:
 * 1. Primary key matching (employeeNumber)
 * 2. Secondary key matching (email, cnpsNumber)
 * 3. AI-powered fuzzy matching (name + date heuristics)
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type {
  RecordMatch,
  MatchingStrategy,
  MatchResult,
  EntityTypeNode,
} from '../types';

export interface SourceRecord {
  fileName: string;
  sheetName: string;
  dataType: string;
  data: Record<string, any>;
  parsedAt: Date;
}

/**
 * Match records from multiple sources that belong to the same entity
 *
 * This function:
 * 1. Tries deterministic matching (employeeNumber, email, CNPS)
 * 2. Falls back to AI fuzzy matching for unmatched records
 * 3. Groups records that refer to the same entity
 */
export async function matchRecords(params: {
  entityType: EntityTypeNode;
  sourceRecords: SourceRecord[];
  countryCode?: string;
}): Promise<RecordMatch[]> {
  const { entityType, sourceRecords, countryCode = 'CI' } = params;

  // If only one source, no matching needed - each record is a unique entity
  if (entityType.sources.length === 1) {
    return sourceRecords.map((record) => ({
      entityId: uuidv4(),
      sourceRecords: [record],
      matchStrategy: 'employeeNumber' as MatchingStrategy,
      matchConfidence: 100,
    }));
  }

  // Group records by source for easier processing
  const recordsBySource = new Map<string, SourceRecord[]>();
  for (const record of sourceRecords) {
    const key = `${record.fileName}::${record.sheetName}`;
    if (!recordsBySource.has(key)) {
      recordsBySource.set(key, []);
    }
    recordsBySource.get(key)!.push(record);
  }

  const matches: RecordMatch[] = [];
  const unmatchedRecords = new Set(sourceRecords);

  // Strategy 1: Primary key matching (employeeNumber)
  if (entityType.matchingKeys.includes('employeeNumber')) {
    const primaryKeyMatches = matchByPrimaryKey(
      sourceRecords,
      'employeeNumber',
      unmatchedRecords
    );
    matches.push(...primaryKeyMatches);
  }

  // Strategy 2: Secondary key matching (email)
  if (entityType.matchingKeys.includes('email')) {
    const emailMatches = matchBySecondaryKey(
      Array.from(unmatchedRecords),
      'email',
      unmatchedRecords
    );
    matches.push(...emailMatches);
  }

  // Strategy 3: Tertiary key matching (cnpsNumber)
  if (entityType.matchingKeys.includes('cnpsNumber')) {
    const cnpsMatches = matchBySecondaryKey(
      Array.from(unmatchedRecords),
      'cnpsNumber',
      unmatchedRecords
    );
    matches.push(...cnpsMatches);
  }

  // Strategy 4: AI fuzzy matching for remaining records
  if (unmatchedRecords.size > 0) {
    const fuzzyMatches = await matchByAIFuzzy({
      entityType,
      records: Array.from(unmatchedRecords),
      countryCode,
    });
    matches.push(...fuzzyMatches);
  }

  return matches;
}

/**
 * Match records by primary key (exact match)
 */
function matchByPrimaryKey(
  records: SourceRecord[],
  keyField: string,
  unmatchedRecords: Set<SourceRecord>
): RecordMatch[] {
  const matches: RecordMatch[] = [];
  const keyToRecords = new Map<string, SourceRecord[]>();

  // Group records by primary key
  for (const record of records) {
    const keyValue = String(record.data[keyField] || '').trim().toUpperCase();
    if (!keyValue) continue;

    if (!keyToRecords.has(keyValue)) {
      keyToRecords.set(keyValue, []);
    }
    keyToRecords.get(keyValue)!.push(record);
  }

  // Create matches for each group
  for (const [key, groupRecords] of keyToRecords) {
    if (groupRecords.length > 0) {
      matches.push({
        entityId: uuidv4(),
        sourceRecords: groupRecords,
        matchStrategy: keyField as MatchingStrategy,
        matchConfidence: 100, // Exact match = 100% confidence
      });

      // Remove from unmatched
      groupRecords.forEach((r) => unmatchedRecords.delete(r));
    }
  }

  return matches;
}

/**
 * Match records by secondary key (email, CNPS number)
 */
function matchBySecondaryKey(
  records: SourceRecord[],
  keyField: string,
  unmatchedRecords: Set<SourceRecord>
): RecordMatch[] {
  const matches: RecordMatch[] = [];
  const keyToRecords = new Map<string, SourceRecord[]>();

  // Group records by secondary key
  for (const record of records) {
    const keyValue = String(record.data[keyField] || '').trim().toLowerCase();
    if (!keyValue) continue;

    if (!keyToRecords.has(keyValue)) {
      keyToRecords.set(keyValue, []);
    }
    keyToRecords.get(keyValue)!.push(record);
  }

  // Create matches for each group
  for (const [key, groupRecords] of keyToRecords) {
    if (groupRecords.length > 0) {
      matches.push({
        entityId: uuidv4(),
        sourceRecords: groupRecords,
        matchStrategy: keyField as MatchingStrategy,
        matchConfidence: 95, // Secondary key = 95% confidence
      });

      // Remove from unmatched
      groupRecords.forEach((r) => unmatchedRecords.delete(r));
    }
  }

  return matches;
}

/**
 * AI-powered fuzzy matching for records without clear identifiers
 *
 * Uses AI to intelligently match records based on name similarity,
 * date proximity, and other heuristics
 */
async function matchByAIFuzzy(params: {
  entityType: EntityTypeNode;
  records: SourceRecord[];
  countryCode: string;
}): Promise<RecordMatch[]> {
  const { entityType, records, countryCode } = params;

  // If too few records, just create individual entities
  if (records.length <= 1) {
    return records.map((record) => ({
      entityId: uuidv4(),
      sourceRecords: [record],
      matchStrategy: 'manual' as MatchingStrategy,
      matchConfidence: 50, // Low confidence when no matching possible
    }));
  }

  // Define fuzzy matching schema
  const fuzzyMatchSchema = z.object({
    matches: z.array(
      z.object({
        recordIndices: z
          .array(z.number())
          .describe('Indices of records that refer to the same entity'),

        confidence: z
          .number()
          .min(0)
          .max(100)
          .describe('Confidence in this match (0-100)'),

        reasoning: z
          .string()
          .describe('Why these records were matched together in French'),
      })
    ),
  });

  // Use AI to fuzzy match
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: fuzzyMatchSchema,
    prompt: `Tu es un expert RH qui doit déterminer quels enregistrements provenant de différentes sources se réfèrent à la **même personne/entité**.

**Contexte:**
🏷️  Type d'entité: ${entityType.displayName} (${entityType.entityType})
📊 ${records.length} enregistrement(s) sans identifiant clair
🌍 Pays: ${countryCode === 'CI' ? '🇨🇮 Côte d\'Ivoire' : countryCode === 'SN' ? '🇸🇳 Sénégal' : countryCode}

---

**Enregistrements à analyser:**
${JSON.stringify(
  records.map((r, idx) => ({
    index: idx,
    file: r.fileName,
    sheet: r.sheetName,
    data: r.data,
  })),
  null,
  2
)}

---

**Ta mission:**

Identifie les groupes d'enregistrements qui se réfèrent à la **même entité** (même personne, même contrat, même salaire).

**Stratégies de matching intelligent:**

**Pour des employés:**
1. **Nom exact** (firstName + lastName) → Très probablement la même personne
2. **Nom similaire** (KOUASSI Jean ≈ KOUASSI JEAN ≈ Jean KOUASSI) → Probablement la même personne
3. **Nom + Date similaire** (même nom + date embauche proche) → Très probablement la même personne
4. **Variantes orthographiques** (KOUASSI ≈ KOUASI, Jean ≈ Jeanne si contexte suggère typo)

**Pour des salaires/contrats:**
1. **Nom + Période** → Si nom correspond et période identique/proche, c'est la même entité
2. **Montants similaires** → Peut aider à confirmer (même salaire = probablement même personne)

**Pour des congés/avantages:**
1. **Nom + Type** → Même nom + même type de congé/avantage = même entité

---

**Règles de prudence:**

⚠️ **NE PAS matcher si:**
- Noms très différents (KOUASSI vs TRAORE) → Personnes différentes
- Même nom mais dates très éloignées (embauche 2010 vs 2023) → Peut-être homonymes
- Doute sur l'identité → Mieux vaut créer 2 entités séparées que fusionner par erreur

✅ **Matcher si:**
- Nom identique/très similaire + autres indices concordants
- Confiance ≥ 70%

---

**Format de sortie:**

Retourne des groupes d'indices de records qui correspondent à la même entité.

**Exemple:**
Si les records 0, 2, 5 se réfèrent à "KOUASSI Jean" et les records 1, 4 à "TRAORE Marie":
\`\`\`json
{
  "matches": [
    {
      "recordIndices": [0, 2, 5],
      "confidence": 85,
      "reasoning": "Même nom 'KOUASSI Jean' dans 3 sources avec dates d'embauche similaires (2020-01-15)"
    },
    {
      "recordIndices": [1, 4],
      "confidence": 80,
      "reasoning": "Même nom 'TRAORE Marie' et même email partiel 'marie.traore@...'"
    },
    {
      "recordIndices": [3],
      "confidence": 50,
      "reasoning": "Record isolé sans correspondance claire - créer entité séparée"
    }
  ]
}
\`\`\`

---

**Conseils:**

1. **Sois conservateur** - En cas de doute, ne matche PAS
2. **Utilise tous les indices** - Nom, date, email partiel, numéro de téléphone, montant, etc.
3. **Explique ton raisonnement** - Pourquoi as-tu matché ces records?
4. **Assigne une confiance réaliste** - 90%+ pour quasi-certain, 70-89% pour probable, <70% pour incertain

Analyse maintenant ces enregistrements et retourne les groupes de matching!`,
  });

  // Convert AI matches to RecordMatch objects
  const matchResults: RecordMatch[] = [];

  for (const match of object.matches) {
    const matchedRecords = match.recordIndices.map((idx) => records[idx]);

    matchResults.push({
      entityId: uuidv4(),
      sourceRecords: matchedRecords,
      matchStrategy: 'fuzzy_match',
      matchConfidence: match.confidence,
    });
  }

  return matchResults;
}

/**
 * Validate a match between two records
 *
 * This is a utility function that can be used to manually validate
 * or adjust AI-generated matches
 */
export async function validateMatch(params: {
  record1: SourceRecord;
  record2: SourceRecord;
  strategy: MatchingStrategy;
  countryCode?: string;
}): Promise<MatchResult> {
  const { record1, record2, strategy, countryCode = 'CI' } = params;

  // For deterministic strategies, confidence is 100%
  if (strategy === 'employeeNumber' || strategy === 'email' || strategy === 'cnpsNumber') {
    const key = strategy;
    const value1 = String(record1.data[key] || '').trim();
    const value2 = String(record2.data[key] || '').trim();

    if (value1 && value2 && value1.toLowerCase() === value2.toLowerCase()) {
      return {
        matched: true,
        strategy,
        confidence: 100,
        reasoning: `Correspondance exacte sur ${key}: "${value1}"`,
      };
    }

    return {
      matched: false,
      strategy,
      confidence: 0,
      reasoning: `Pas de correspondance sur ${key}`,
    };
  }

  // For fuzzy matching, use AI
  const matchSchema = z.object({
    matched: z.boolean(),
    confidence: z.number().min(0).max(100),
    reasoning: z.string(),
  });

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: matchSchema,
    prompt: `Détermine si ces deux enregistrements se réfèrent à la même entité.

**Enregistrement 1:**
Fichier: ${record1.fileName} / ${record1.sheetName}
${JSON.stringify(record1.data, null, 2)}

**Enregistrement 2:**
Fichier: ${record2.fileName} / ${record2.sheetName}
${JSON.stringify(record2.data, null, 2)}

Analyse et retourne:
- \`matched\`: true si même entité, false sinon
- \`confidence\`: 0-100 (ta confiance dans cette décision)
- \`reasoning\`: Explication en français (quels champs as-tu comparé? pourquoi as-tu décidé ça?)`,
  });

  return {
    matched: object.matched,
    strategy: 'fuzzy_match',
    confidence: object.confidence,
    reasoning: object.reasoning,
  };
}
