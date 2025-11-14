/**
 * Resolve Conflicts Tool - AI-Powered Conflict Resolution
 *
 * This tool uses AI to intelligently resolve data conflicts by analyzing:
 * - File recency (newer files are usually more accurate)
 * - Data completeness (more complete records preferred)
 * - Business rules (e.g., salary must be >= SMIG)
 * - Historical patterns (which source has been more reliable)
 * - Country-specific regulations
 *
 * The AI provides:
 * - Recommended value
 * - Confidence score (0-100)
 * - Detailed reasoning in French
 * - Whether user confirmation is required
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type {
  FieldConflict,
  ConflictResolution,
  ConflictSeverity,
} from '../types';

/**
 * Country-specific business rules
 */
const COUNTRY_RULES = {
  CI: {
    name: 'Côte d\'Ivoire',
    smig: 75000, // FCFA per month
    taxAuthority: 'ITS',
    socialSecurity: 'CNPS',
    cnpsDigits: 10,
  },
  SN: {
    name: 'Sénégal',
    smig: 60000, // FCFA per month
    taxAuthority: 'IRPP',
    socialSecurity: 'IPRES',
    cnpsDigits: 13,
  },
};

/**
 * Resolve a single conflict using AI
 *
 * This uses comprehensive context to make intelligent decisions:
 * - All conflicting values with sources
 * - File metadata (upload dates, quality scores)
 * - Business rules for this field
 * - Country-specific regulations
 */
export async function resolveConflict(params: {
  conflict: FieldConflict;
  entityType: string;
  countryCode?: string;
  fileQualityScores?: Record<string, number>;
}): Promise<ConflictResolution> {
  const { conflict, entityType, countryCode = 'CI', fileQualityScores = {} } = params;

  const countryRules = COUNTRY_RULES[countryCode as keyof typeof COUNTRY_RULES] || COUNTRY_RULES.CI;

  // Define resolution schema
  const resolutionSchema = z.object({
    chosenSourceFile: z
      .string()
      .describe('File name of the source that should be used'),

    chosenSourceSheet: z
      .string()
      .describe('Sheet name of the source that should be used'),

    chosenValue: z
      .any()
      .describe('The value that should be used (from the chosen source)'),

    confidence: z
      .number()
      .min(0)
      .max(100)
      .describe('Confidence in this resolution (0-100). Use 90%+ if very sure, 70-89% if likely, <70% if uncertain'),

    reasoning: z
      .string()
      .describe('Detailed explanation in French of why this source/value was chosen. Mention specific factors like file recency, data quality, business rules, etc.'),

    requiresUserConfirmation: z
      .boolean()
      .describe('true if this conflict needs manual review by user (critical fields with low confidence), false if AI resolution is sufficient'),
  });

  // Use AI to resolve conflict
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: resolutionSchema,
    prompt: `Tu es un expert RH qui doit résoudre un conflit de données. Plusieurs sources ont des valeurs différentes pour le même champ.

**Contexte:**
🏷️  Type d'entité: ${entityType}
🔴 Gravité: ${conflict.severity === 'critical' ? '🔴 CRITIQUE' : conflict.severity === 'medium' ? '🟡 MOYENNE' : '🟢 FAIBLE'}
📝 Champ: \`${conflict.field}\`
🌍 Pays: ${countryRules.name}

---

**Valeurs en conflit:**
${JSON.stringify(
  conflict.sources.map((s) => ({
    fichier: s.fileName,
    feuille: s.sheetName,
    valeur: s.value,
    uploadedAt: s.uploadedAt,
    qualityScore: fileQualityScores[s.fileName],
  })),
  null,
  2
)}

---

**Règles métier (${countryRules.name}):**
- SMIG: ${countryRules.smig.toLocaleString()} FCFA/mois
- Impôt: ${countryRules.taxAuthority}
- Sécurité sociale: ${countryRules.socialSecurity}
- Numéro ${countryRules.socialSecurity}: ${countryRules.cnpsDigits} chiffres

---

**Ta mission:**

Choisis quelle source est la plus fiable et explique pourquoi.

**ÉTAPE 1: Analyse des sources**

Pour chaque source, évalue:

1. **Récence du fichier** ⏰
   - Plus récent = généralement plus fiable
   - Si uploadedAt diffère de plusieurs mois → Prendre le plus récent

2. **Qualité des données** 📊
   - Score de qualité (si disponible): Plus haut = meilleur
   - Complétude: Source avec le plus de champs remplis

3. **Conformité aux règles métier** ✅
   - Si c'est un salaire → Doit être ≥ SMIG (${countryRules.smig})
   - Si c'est un numéro ${countryRules.socialSecurity} → Doit avoir ${countryRules.cnpsDigits} chiffres
   - Si c'est une date → Doit être cohérente (pas de date future, pas de date de naissance > 100 ans)

4. **Cohérence sémantique** 🧠
   - Si un nom est en MAJUSCULES et l'autre en minuscules → Prendre minuscules (plus lisible)
   - Si un email est complet vs partiel → Prendre complet
   - Si un numéro a des espaces/tirets vs pas → Normaliser

---

**ÉTAPE 2: Décision**

Choisis la source selon ces priorités:

**Priorité 1: Conformité aux règles métier**
- Si une valeur viole les règles (salaire < SMIG, numéro invalide) → REJETER cette source

**Priorité 2: Récence**
- Si une source est beaucoup plus récente (> 6 mois) → Préférer la plus récente

**Priorité 3: Qualité**
- Si qualityScore disponible → Préférer score plus élevé
- Sinon, préférer la source avec le plus de champs remplis

**Priorité 4: Complétude**
- Préférer la valeur la plus complète/détaillée

---

**ÉTAPE 3: Confiance et confirmation**

Calcule ta confiance (0-100%):

- **90-100%**: Très sûr (règle métier claire OU fichier beaucoup plus récent)
- **75-89%**: Plutôt sûr (fichier plus récent + qualité OK)
- **60-74%**: Moyennement sûr (légères différences de récence/qualité)
- **< 60%**: Peu sûr (sources équivalentes, choix arbitraire)

Demande confirmation utilisateur si:
- Confiance < 70% ET gravité = critique
- Confiance < 50% (quelle que soit la gravité)
- Violation potentielle de règles métier

---

**ÉTAPE 4: Raisonnement**

Explique en français:
1. Quelles sources tu as analysées
2. Quel critère a été décisif (récence, qualité, règle métier)
3. Pourquoi tu as éliminé les autres sources
4. Pourquoi tu demandes/ne demandes pas confirmation

---

**Exemples de raisonnement:**

**Exemple 1: Conflit de salaire (critique)**
\`\`\`
Fichier A (2023-01-15): 65,000 FCFA
Fichier B (2024-06-20): 85,000 FCFA
\`\`\`

Raisonnement:
"J'ai choisi Fichier B (85,000 FCFA) car:
1. ✅ Conforme au SMIG de Côte d'Ivoire (75,000 FCFA)
2. ⏰ Beaucoup plus récent (1.5 ans plus récent)
3. ❌ Fichier A viole le SMIG (65,000 < 75,000)

Confiance: 100% - Pas besoin de confirmation (règle métier claire)"

**Exemple 2: Conflit de téléphone (faible)**
\`\`\`
Fichier A (2024-01-10): 0701020304
Fichier B (2024-01-15): 0701020305
\`\`\`

Raisonnement:
"J'ai choisi Fichier B (0701020305) car:
1. ⏰ Légèrement plus récent (5 jours)
2. 📊 Qualité similaire
3. ⚠️  Impossible de déterminer lequel est correct sans contexte

Confiance: 60% - Recommande confirmation (champ peu critique mais confiance basse)"

**Exemple 3: Conflit de nom (critique)**
\`\`\`
Fichier A (2024-01-01): KOUASSI JEAN
Fichier B (2024-01-01): Kouassi Jean
\`\`\`

Raisonnement:
"J'ai choisi Fichier B (Kouassi Jean) car:
1. 📝 Format plus lisible (casse normale vs MAJUSCULES)
2. ⏰ Même date (pas de différence de récence)
3. ✅ Les deux valeurs sont sémantiquement identiques

Confiance: 95% - Pas besoin de confirmation (simple différence de casse)"

---

**Contexte additionnel:**

**Champs critiques** (toujours demander confirmation si confiance < 80%):
- employeeNumber, firstName, lastName, hireDate, cnpsNumber, email, dateOfBirth

**Champs importants** (demander confirmation si confiance < 70%):
- baseSalary, position, department, contractType, bankAccountNumber

**Champs optionnels** (acceptable de résoudre automatiquement si confiance ≥ 50%):
- phone, address, city, postalCode

---

**Règles spécifiques par pays:**

🇨🇮 **Côte d'Ivoire:**
- Salaires en FCFA (pas de centimes)
- CNPS: 10 chiffres exactement
- ITS calculé sur tranches (0%, 1.5%, 5%, 10%, 15%, 20%, 25%, 30%, 35%)
- SMIG: 75,000 FCFA/mois (60,000 avant 2024)

🇸🇳 **Sénégal:**
- Salaires en FCFA
- IPRES: 13 chiffres
- IRPP progressif
- SMIG: 60,000 FCFA/mois

---

**Maintenant, résous ce conflit!**

Pense étape par étape:
1. Analyse chaque source
2. Applique les priorités de décision
3. Calcule ta confiance
4. Explique ton raisonnement
5. Décide si confirmation nécessaire`,
  });

  // Map AI response to ConflictResolution
  const chosenSource = conflict.sources.find(
    (s) => s.fileName === object.chosenSourceFile && s.sheetName === object.chosenSourceSheet
  );

  if (!chosenSource) {
    throw new Error(
      `AI chose invalid source: ${object.chosenSourceFile} / ${object.chosenSourceSheet}`
    );
  }

  return {
    chosenSource: `${chosenSource.fileName}::${chosenSource.sheetName}`,
    chosenValue: object.chosenValue,
    confidence: object.confidence,
    reasoning: object.reasoning,
    requiresUserConfirmation: object.requiresUserConfirmation,
    resolvedAt: new Date(),
    resolvedBy: 'ai',
  };
}

/**
 * Batch resolve multiple conflicts
 *
 * This is more efficient than resolving one by one and allows the AI
 * to consider patterns across conflicts
 */
export async function batchResolveConflicts(params: {
  conflicts: FieldConflict[];
  entityType: string;
  entityId: string;
  countryCode?: string;
  fileQualityScores?: Record<string, number>;
}): Promise<Map<string, ConflictResolution>> {
  const { conflicts, entityType, entityId, countryCode = 'CI', fileQualityScores = {} } = params;

  // Filter conflicts for this entity
  const entityConflicts = conflicts.filter((c) => c.entityId === entityId);

  if (entityConflicts.length === 0) {
    return new Map();
  }

  const resolutions = new Map<string, ConflictResolution>();

  // Resolve each conflict
  for (const conflict of entityConflicts) {
    try {
      const resolution = await resolveConflict({
        conflict,
        entityType,
        countryCode,
        fileQualityScores,
      });

      resolutions.set(conflict.conflictId, resolution);
    } catch (error) {
      console.error(`Failed to resolve conflict ${conflict.conflictId}:`, error);
      // Continue with other conflicts
    }
  }

  return resolutions;
}

/**
 * Apply resolutions to conflicts
 *
 * This mutates the conflict objects to mark them as resolved
 */
export function applyResolutions(
  conflicts: FieldConflict[],
  resolutions: Map<string, ConflictResolution>
): FieldConflict[] {
  return conflicts.map((conflict) => {
    const resolution = resolutions.get(conflict.conflictId);
    if (resolution) {
      return {
        ...conflict,
        resolved: true,
        resolution,
      };
    }
    return conflict;
  });
}

/**
 * Get conflicts requiring user confirmation
 */
export function getConflictsRequiringConfirmation(
  conflicts: FieldConflict[]
): FieldConflict[] {
  return conflicts.filter(
    (c) => c.resolution && c.resolution.requiresUserConfirmation
  );
}

/**
 * Auto-resolve low-risk conflicts
 *
 * This resolves conflicts that are:
 * - Low severity
 * - High AI confidence (≥ 80%)
 * - Not requiring user confirmation
 */
export async function autoResolveLowRiskConflicts(params: {
  conflicts: FieldConflict[];
  entityType: string;
  entityId: string;
  countryCode?: string;
  fileQualityScores?: Record<string, number>;
}): Promise<{
  autoResolved: FieldConflict[];
  requiresReview: FieldConflict[];
}> {
  const { conflicts, entityType, entityId, countryCode, fileQualityScores } = params;

  // Resolve all conflicts
  const resolutions = await batchResolveConflicts({
    conflicts,
    entityType,
    entityId,
    countryCode,
    fileQualityScores,
  });

  // Apply resolutions
  const resolvedConflicts = applyResolutions(conflicts, resolutions);

  // Separate auto-resolved vs requires review
  const autoResolved: FieldConflict[] = [];
  const requiresReview: FieldConflict[] = [];

  for (const conflict of resolvedConflicts) {
    if (!conflict.resolution) {
      requiresReview.push(conflict);
      continue;
    }

    const isLowRisk =
      conflict.severity === 'low' &&
      conflict.resolution.confidence >= 80 &&
      !conflict.resolution.requiresUserConfirmation;

    if (isLowRisk) {
      autoResolved.push(conflict);
    } else {
      requiresReview.push(conflict);
    }
  }

  return {
    autoResolved,
    requiresReview,
  };
}
