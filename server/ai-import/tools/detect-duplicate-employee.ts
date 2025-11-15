/**
 * Detect Duplicate Employee - AI-Powered with High-Quality Prompts
 *
 * CRITICAL PRINCIPLE:
 * "Un LLM depend enormement de la qualité de son input"
 *
 * This tool uses Claude Sonnet 4 with COMPREHENSIVE CONTEXT to detect
 * if an employee from Excel already exists in the database.
 *
 * What makes this AI prompt HIGH QUALITY:
 * ✓ Complete existing employees context (formatted for AI)
 * ✓ Candidate employee data with all fields
 * ✓ Country-specific business rules (SMIG, CNPS format)
 * ✓ West African naming patterns (KOUASSI vs Kouassi, diacritics)
 * ✓ Detailed examples of edge cases
 * ✓ Structured output with reasoning in French
 * ✓ Confidence scoring guidelines
 *
 * @see docs/AI-IMPORT-DUPLICATE-DETECTION.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ImportContext, RecordMatch } from '../types';
import { formatExistingEmployeesForAI, indexExistingEmployees } from './load-existing-employees';

/**
 * Detect if candidate employee is a duplicate of existing employee
 *
 * This uses a MULTI-STRATEGY approach with AI as the final arbiter:
 *
 * 1. **Exact matches** (100% confidence, no AI needed):
 *    - employeeNumber match
 *    - email match (case-insensitive)
 *    - CNPS number match
 *
 * 2. **Fuzzy matches** (80-95% confidence, AI-powered):
 *    - Name variations: "KOUASSI Jean" vs "Jean Kouassi"
 *    - Spelling differences: "Mohamed" vs "Mohammed"
 *    - Missing diacritics: "Abdoulaye" vs "Abdoulayé"
 *    - Partial matches: "J. Kouassi" vs "Jean Kouassi"
 *
 * 3. **No match** (new employee):
 *    - No similarity found
 *
 * @param candidateEmployee - Employee data from Excel file
 * @param existingEmployees - All existing employees in database
 * @param countryCode - Country for business rules (CI, SN, etc.)
 * @returns Duplicate detection result or undefined (if new employee)
 */
export async function detectDuplicateEmployee(params: {
  candidateEmployee: Record<string, any>;
  existingEmployees: NonNullable<ImportContext['existingEmployees']>;
  countryCode: string;
}): Promise<RecordMatch['duplicate'] | undefined> {
  const { candidateEmployee, existingEmployees, countryCode } = params;

  // Fast path: Check exact matches first (no AI needed)
  const exactMatch = findExactMatch(candidateEmployee, existingEmployees);
  if (exactMatch) {
    return exactMatch;
  }

  // AI path: Check fuzzy matches (comprehensive prompt)
  const fuzzyMatch = await findFuzzyMatch({
    candidateEmployee,
    existingEmployees,
    countryCode,
  });

  return fuzzyMatch;
}

/**
 * Find exact match using indexed lookups (O(1))
 *
 * No AI needed - these are 100% confidence matches
 */
function findExactMatch(
  candidateEmployee: Record<string, any>,
  existingEmployees: NonNullable<ImportContext['existingEmployees']>
): RecordMatch['duplicate'] | undefined {
  const index = indexExistingEmployees(existingEmployees);

  // Strategy 1: employeeNumber (100% confidence)
  if (candidateEmployee.employeeNumber) {
    const match = index.get(`num:${candidateEmployee.employeeNumber}`);
    if (match) {
      return {
        existingEmployeeId: match.id,
        existingEmployeeNumber: match.employeeNumber ?? undefined,
        existingEmployeeName: `${match.firstName} ${match.lastName}`,
        matchMethod: 'employeeNumber',
        matchConfidence: 100,
        recommendedAction: 'update',
        reasoning: `Le numéro d'employé ${match.employeeNumber} existe déjà pour ${match.firstName} ${match.lastName}. Mise à jour recommandée.`,
      };
    }
  }

  // Strategy 2: email (95% confidence)
  if (candidateEmployee.email) {
    const match = index.get(`email:${candidateEmployee.email.toLowerCase()}`);
    if (match) {
      return {
        existingEmployeeId: match.id,
        existingEmployeeNumber: match.employeeNumber ?? undefined,
        existingEmployeeName: `${match.firstName} ${match.lastName}`,
        matchMethod: 'email',
        matchConfidence: 95,
        recommendedAction: 'update',
        reasoning: `L'email ${match.email} existe déjà pour ${match.firstName} ${match.lastName}. Très probablement la même personne.`,
      };
    }
  }

  // Strategy 3: CNPS number (90% confidence)
  if (candidateEmployee.cnpsNumber) {
    const match = index.get(`cnps:${candidateEmployee.cnpsNumber}`);
    if (match) {
      return {
        existingEmployeeId: match.id,
        existingEmployeeNumber: match.employeeNumber ?? undefined,
        existingEmployeeName: `${match.firstName} ${match.lastName}`,
        matchMethod: 'cnpsNumber',
        matchConfidence: 90,
        recommendedAction: 'update',
        reasoning: `Le numéro CNPS ${match.cnpsNumber} existe déjà pour ${match.firstName} ${match.lastName}. Mise à jour recommandée.`,
      };
    }
  }

  return undefined; // No exact match found
}

/**
 * Find fuzzy match using AI with HIGH-QUALITY PROMPT
 *
 * This is where "un LLM depend enormement de la qualité de son input" matters!
 */
async function findFuzzyMatch(params: {
  candidateEmployee: Record<string, any>;
  existingEmployees: NonNullable<ImportContext['existingEmployees']>;
  countryCode: string;
}): Promise<RecordMatch['duplicate'] | undefined> {
  const { candidateEmployee, existingEmployees, countryCode } = params;

  // Skip fuzzy matching if no name provided
  if (!candidateEmployee.firstName && !candidateEmployee.lastName) {
    return undefined;
  }

  // Format existing employees for AI (CRITICAL RESOURCE)
  const existingEmployeesContext = formatExistingEmployeesForAI(existingEmployees, {
    maxEmployees: 50, // Limit to prevent token overflow
    includeDetails: true,
  });

  // Define output schema
  const duplicateDetectionSchema = z.object({
    isDuplicate: z.boolean().describe('true if candidate matches an existing employee, false if NEW employee'),

    matchedEmployeeId: z.string().optional().describe('ID of matched existing employee (if isDuplicate=true)'),

    matchedEmployeeNumber: z.string().optional().describe('Employee number of matched employee (for display)'),

    matchedEmployeeName: z.string().optional().describe('Full name of matched employee (for display)'),

    matchConfidence: z
      .number()
      .min(0)
      .max(100)
      .describe('Confidence that this is the same person (0-100). Use 90%+ if very sure, 70-89% if likely, <70% if uncertain'),

    reasoning: z
      .string()
      .describe('Detailed explanation in French of WHY you think this is/is not a duplicate. Mention specific similarities or differences.'),

    recommendedAction: z
      .enum(['update', 'skip', 'ask_user'])
      .describe('update = auto-update existing employee, skip = ignore duplicate, ask_user = needs manual confirmation'),
  });

  // HIGH-QUALITY AI PROMPT (COMPREHENSIVE CONTEXT)
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: duplicateDetectionSchema,
    prompt: `Tu es un expert RH qui doit détecter si un employé provenant d'un fichier Excel existe déjà dans la base de données.

**CONTEXTE CRITIQUE:**
🌍 Pays: ${countryCode === 'CI' ? 'Côte d\'Ivoire' : countryCode === 'SN' ? 'Sénégal' : countryCode}
📊 Employés existants: ${existingEmployees.length} dans la base de données

---

**EMPLOYÉS EXISTANTS DANS LA BASE DE DONNÉES:**

${existingEmployeesContext}

---

**EMPLOYÉ CANDIDAT (provenant du fichier Excel):**

${JSON.stringify(
  {
    Prénom: candidateEmployee.firstName || 'N/A',
    Nom: candidateEmployee.lastName || 'N/A',
    'Numéro d\'employé': candidateEmployee.employeeNumber || 'N/A',
    Email: candidateEmployee.email || 'N/A',
    'Numéro CNPS': candidateEmployee.cnpsNumber || 'N/A',
    Téléphone: candidateEmployee.phoneNumber || 'N/A',
    Position: candidateEmployee.position || 'N/A',
    Département: candidateEmployee.department || 'N/A',
    'Date d\'embauche': candidateEmployee.hireDate || 'N/A',
  },
  null,
  2
)}

---

**TA MISSION:**

Détermine si cet employé candidat est un DOUBLON d'un employé existant.

**ÉTAPE 1: Analyse des correspondances possibles**

Recherche des employés existants qui pourraient être la même personne en considérant:

1. **Variations de noms (très courant en Afrique de l'Ouest):**
   - "KOUASSI Jean" = "Jean KOUASSI" (ordre inversé)
   - "KOUASSI" = "Kouassi" (casse différente)
   - "Abdoulaye" = "Abdoulayé" (diacritiques manquants)
   - "Mohamed" = "Mohammed" = "Mouhamed" (variantes d'orthographe)
   - "N'Guessan" = "Nguessan" (apostrophes)
   - "Traoré" = "Traore" (accents)

2. **Noms partiels ou abréviations:**
   - "J. Kouassi" pourrait être "Jean Kouassi"
   - "M. Traoré" pourrait être "Marie Traoré" ou "Mohamed Traoré"

3. **Identifiants secondaires:**
   - Même email → Probablement la même personne (95%)
   - Même CNPS → Très probablement la même personne (90%)
   - Même téléphone → Probablement la même personne (85%)

4. **Contexte métier:**
   - Même position + même département → Plus probable
   - Date d'embauche similaire → Plus probable

**ÉTAPE 2: Calcul de la confiance**

- **90-100%**: Correspondance très forte (nom presque identique + email/CNPS match)
- **75-89%**: Correspondance probable (nom similaire + indices concordants)
- **60-74%**: Correspondance possible mais incertaine
- **< 60%**: Probablement pas la même personne

**ÉTAPE 3: Recommandation d'action**

- **update**: Confiance ≥ 90% → Mettre à jour l'employé existant automatiquement
- **ask_user**: Confiance 70-89% → Demander confirmation à l'utilisateur
- **skip**: Confiance < 70% OU nouvelles informations incompatibles

**ÉTAPE 4: Raisonnement détaillé**

Explique en français:
1. Quels employés existants tu as considérés
2. Pourquoi tu penses que c'est/n'est pas un doublon
3. Quels indices concordent ou ne concordent pas
4. Pourquoi tu recommandes cette action

---

**EXEMPLES DE RAISONNEMENT:**

**Exemple 1: Doublon évident (confiance 100%)**
Candidat: "Jean KOUASSI", email: jean.kouassi@company.ci
Existant: "Jean Kouassi", email: jean.kouassi@company.ci

Raisonnement:
"C'est clairement la même personne:
✓ Nom identique (juste une différence de casse)
✓ Email identique
✓ Très probablement une mise à jour de données
Recommandation: update (confiance 100%)"

**Exemple 2: Doublon probable (confiance 85%)**
Candidat: "KOUASSI Jean", CNPS: 1234567890
Existant: "Jean KOUASSI", CNPS: 1234567890

Raisonnement:
"Très probablement la même personne:
✓ Même nom (ordre inversé, courant en Afrique)
✓ Même numéro CNPS (identifiant unique)
⚠️  Pas d'email pour confirmer
Recommandation: ask_user (confiance 85%)"

**Exemple 3: Doublon incertain (confiance 65%)**
Candidat: "Mohamed TRAORÉ", position: "Développeur"
Existant: "Mouhamed Traore", position: "Développeur"

Raisonnement:
"Peut-être la même personne:
? Nom similaire (variante d'orthographe courante)
? Même position
✗ Pas d'identifiant commun (email, CNPS)
⚠️  "Mohamed" et "Mouhamed" sont des variantes fréquentes mais pourrait être deux personnes différentes
Recommandation: ask_user (confiance 65%)"

**Exemple 4: PAS un doublon (confiance 95%)**
Candidat: "Jean KOUASSI", email: jean.k@company.ci
Existant: "Jean KOUASSI", email: jeankouassi@company.ci

Raisonnement:
"Probablement PAS la même personne malgré le nom identique:
✓ Même nom (mais "Kouassi" est un nom très courant en Côte d'Ivoire)
✗ Emails complètement différents (jean.k@ vs jeankouassi@)
✗ Pas d'autres identifiants en commun
→ Probablement deux personnes différentes avec le même nom
Recommandation: NON doublon (confiance 95% que c'est une nouvelle personne)"

---

**RÈGLES SPÉCIFIQUES PAR PAYS:**

🇨🇮 **Côte d'Ivoire:**
- Noms très courants: Kouassi, N'Guessan, Yao, Koffi, Aya, Adjoua
- CNPS: 10 chiffres exactement
- Format email typique: prenom.nom@company.ci

🇸🇳 **Sénégal:**
- Noms très courants: Diop, Ndiaye, Sow, Fall, Sy, Diallo
- IPRES: 13 chiffres
- Format email typique: prenom.nom@company.sn

**ATTENTION:** Si deux personnes ont le même nom courant mais des identifiants différents (email, CNPS) → Ce sont probablement deux personnes différentes!

---

**MAINTENANT, ANALYSE CET EMPLOYÉ CANDIDAT:**

Pense étape par étape:
1. Cherche des employés existants similaires
2. Compare les noms, identifiants, contexte
3. Calcule ta confiance
4. Explique ton raisonnement
5. Recommande une action`,
  });

  // If no duplicate found
  if (!object.isDuplicate) {
    return undefined;
  }

  // Find the matched employee to get full details
  const matchedEmployee = existingEmployees.find((e) => e.id === object.matchedEmployeeId);

  if (!matchedEmployee) {
    // AI returned invalid ID - treat as no match
    console.warn('[AI-IMPORT] AI returned invalid employee ID:', object.matchedEmployeeId);
    return undefined;
  }

  return {
    existingEmployeeId: matchedEmployee.id,
    existingEmployeeNumber: matchedEmployee.employeeNumber ?? undefined,
    existingEmployeeName: object.matchedEmployeeName || `${matchedEmployee.firstName} ${matchedEmployee.lastName}`,
    matchMethod: 'fuzzyName',
    matchConfidence: object.matchConfidence,
    recommendedAction: object.recommendedAction,
    reasoning: object.reasoning,
  };
}
