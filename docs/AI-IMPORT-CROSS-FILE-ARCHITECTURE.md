# AI Import System - Cross-File Entity Building Architecture

> **Version:** 2.0
> **Date:** 2025-01-14
> **Status:** In Development
> **Author:** Claude Code + User Feedback

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture (v1.0) - Limitations](#current-architecture-v10---limitations)
3. [Proposed Architecture (v2.0) - Cross-File Entity Building](#proposed-architecture-v20---cross-file-entity-building)
4. [Core Principle: High-Quality LLM Input](#core-principle-high-quality-llm-input)
5. [Data Flow & Processing Phases](#data-flow--processing-phases)
6. [UX Design for Long-Running Operations](#ux-design-for-long-running-operations)
7. [Entity Matching & Conflict Resolution](#entity-matching--conflict-resolution)
8. [Implementation Plan](#implementation-plan)
9. [Success Metrics](#success-metrics)
10. [Appendix: Technical Specifications](#appendix-technical-specifications)

---

## Executive Summary

### The Problem

**Current System (v1.0):**
- ✅ AI classifies Excel sheets and imports data
- ❌ Each sheet processed **independently** (no cross-file merging)
- ❌ User uploads "Employees.xlsx" + "Salaries.xlsx" → 2 separate imports
- ❌ No conflict resolution when same employee appears in multiple files
- ❌ Poor UX for large files (500 employees, 3 years payroll) - just a spinner

**Real-World Scenario:**
```
User uploads 3 files:
1. Liste_Personnel.xlsx (500 employees, basic info)
2. Salaires_2024.xlsx (500 salary records)
3. Contrats.xlsx (500 contract details)

Current behavior:
→ 500 employees created (no salary data)
→ 500 salary records fail (no employeeId FK)
→ User must import sequentially, manually

Desired behavior:
→ 500 COMPLETE employees with salary + contract data
→ All merged intelligently
→ Clear progress: "Building employee 234/500..."
```

### The Solution (v2.0)

**Cross-File Entity Building:**
1. **Parse ALL files** before any import
2. **Match records** across files by key (employeeNumber, email, CNPS)
3. **Resolve conflicts** intelligently (AI explains reasoning)
4. **Build complete entities** (merge salary + contract into employee)
5. **Show WYSIWYG preview** (exactly what will be imported)
6. **Import once** with all data

**Key Innovations:**
- 🧠 **LLM thinks like human** (high-quality context = intelligent output)
- 🔗 **Cross-file merging** (1 employee from 3 files)
- ⚡ **Streaming progress** (real-time updates for 5-minute operations)
- 🎯 **Entity-focused UX** (not file-focused)

---

## Current Architecture (v1.0) - Limitations

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ PHASE 1: Analyze (Per Sheet)                                 │
│ Excel File → Parse → Classify Each Sheet → Generate Summary  │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│ PHASE 2: Clean (Per Sheet, INDEPENDENT)                      │
│ Sheet 1 → Clean → Validate → Import                          │
│ Sheet 2 → Clean → Validate → Import                          │
│ Sheet 3 → Clean → Validate → Import                          │
└──────────────────────────────────────────────────────────────┘
```

### Critical Limitations

#### 1. No Cross-File Entity Merging
**Problem:**
```typescript
// File 1: Employees.xlsx
{ employeeNumber: "EMP001", name: "KOUASSI Jean", email: "j.kouassi@corp.ci" }

// File 2: Salaries.xlsx
{ employeeNumber: "EMP001", baseSalary: 500000, allowances: 75000 }

// Current Result:
→ Employee created WITHOUT salary data
→ Salary import FAILS (missing employeeId FK)

// Desired Result:
→ 1 COMPLETE employee with all data
```

#### 2. No Conflict Resolution
**Problem:**
```typescript
// File 1: Personnel_2023.xlsx
{ employeeNumber: "EMP001", baseSalary: 450000 }

// File 2: Salaires_2024.xlsx
{ employeeNumber: "EMP001", baseSalary: 500000 }

// Current Result:
→ Both imported (duplicate employee)
→ OR last one wins (data loss)
→ User has no idea which is correct

// Desired Result:
→ AI detects conflict
→ AI reasons: "File 2 is 2024, more recent"
→ Uses 500,000 with explanation
→ User can override if needed
```

#### 3. Poor UX for Large Files

**Problem: Analyzing 500 employees takes 2-3 minutes**
```
Current UI:
┌─────────────────────────────────┐
│ 🔄 Analyse en cours...          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                  │
│ (Just a spinner, no feedback)   │
└─────────────────────────────────┘

User experience:
→ "Is it working?"
→ "Should I refresh?"
→ Abandons after 1 minute
```

**Desired UI:**
```
┌─────────────────────────────────────────────────┐
│ 📊 Analyse intelligente en cours                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                  │
│ ✅ Fichier lu: 3 feuilles, 1,500 lignes         │
│ ⏳ Classification: Feuille 2/3 (67%)            │
│    └─ "Liste Personnel" = Employés (95% sûr)   │
│    └─ "Salaires 2024" = Paie historique...     │
│                                                  │
│ Temps estimé: environ 1 minute restante         │
│                                                  │
│ 💡 Conseil: Laissez l'onglet ouvert, l'IA      │
│    analyse vos données intelligemment.          │
└─────────────────────────────────────────────────┘
```

---

## Proposed Architecture (v2.0) - Cross-File Entity Building

### New Data Flow

```
┌────────────────────────────────────────────────────────────────┐
│ PHASE 1: Multi-File Analysis                                   │
│ Upload ALL Files → Parse ALL → Classify ALL → Build Graph      │
│                                                                  │
│ Progress:                                                        │
│ ✅ Fichier 1/3 analysé (Liste_Personnel.xlsx)                  │
│ ⏳ Fichier 2/3 en cours (Salaires_2024.xlsx)                   │
│ ⏸️  Fichier 3/3 en attente (Contrats.xlsx)                     │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│ PHASE 2: Entity Graph Building (NEW!)                          │
│ AI analyzes ALL sheets and builds entity relationships         │
│                                                                  │
│ Output:                                                          │
│ {                                                                │
│   entities: {                                                    │
│     employees: {                                                 │
│       sources: [                                                 │
│         "Liste_Personnel.xlsx/Sheet1",                          │
│         "Salaires_2024.xlsx/Sheet1",                            │
│         "Contrats.xlsx/Sheet1"                                  │
│       ],                                                         │
│       matchingKeys: ["employeeNumber", "email"],                │
│       recordCount: 500,                                          │
│       dependencies: ["employee_salaries"]                       │
│     }                                                            │
│   },                                                             │
│   crossReferences: [                                             │
│     { from: "Salaires", to: "Employees", via: "employeeNumber" }│
│   ]                                                              │
│ }                                                                │
│                                                                  │
│ Progress:                                                        │
│ ⏳ Construction du graphe d'entités...                          │
│    └─ 500 employés détectés                                     │
│    └─ 3 sources de données identifiées                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│ PHASE 3: Entity Matching & Merging (NEW!)                      │
│ Group records from different files that refer to same person   │
│                                                                  │
│ Process:                                                         │
│ 1. Match by employeeNumber (primary key)                       │
│ 2. Match by email (secondary key)                              │
│ 3. Fuzzy match by name + hireDate (fallback)                   │
│                                                                  │
│ Progress:                                                        │
│ ⏳ Association des enregistrements...                           │
│    └─ Employé 234/500 traité                                    │
│    └─ 12 conflits détectés                                      │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│ PHASE 4: Conflict Detection & Resolution (NEW!)                │
│ AI analyzes conflicts and resolves intelligently               │
│                                                                  │
│ Example Conflict:                                                │
│ Employee EMP001:                                                 │
│   File 1: baseSalary = 450,000                                  │
│   File 2: baseSalary = 500,000                                  │
│                                                                  │
│ AI Analysis:                                                     │
│ "Fichier 2 (Salaires_2024.xlsx) est plus récent et spécialisé  │
│ pour les données de paie. Contient aussi des primes absentes   │
│ du Fichier 1. Recommandation: Utiliser 500,000 FCFA."          │
│                                                                  │
│ Progress:                                                        │
│ ⏳ Résolution des conflits...                                   │
│    └─ 12 conflits détectés                                      │
│    └─ 10 résolus automatiquement (83%)                          │
│    └─ 2 nécessitent votre confirmation                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│ PHASE 5: Complete Entity Building                              │
│ Build final, complete entities ready for database insertion    │
│                                                                  │
│ Output (WYSIWYG):                                                │
│ {                                                                │
│   employees: [                                                   │
│     {                                                            │
│       // Merged from 3 files!                                   │
│       employeeNumber: "EMP001",                                 │
│       firstName: "KOUASSI",                                     │
│       email: "j.kouassi@corp.ci",                               │
│       baseSalary: 500000, // From Salaires_2024.xlsx           │
│       contractType: "CDI", // From Contrats.xlsx               │
│                                                                  │
│       // Provenance tracking                                    │
│       _sources: {                                                │
│         employeeNumber: "Liste_Personnel.xlsx",                 │
│         baseSalary: "Salaires_2024.xlsx",                       │
│         contractType: "Contrats.xlsx"                           │
│       },                                                         │
│                                                                  │
│       // Conflict history                                       │
│       _conflicts: [                                              │
│         {                                                        │
│           field: "baseSalary",                                  │
│           resolved: true,                                       │
│           aiReasoning: "Fichier plus récent...",                │
│           sources: [...]                                        │
│         }                                                        │
│       ]                                                          │
│     }                                                            │
│   ]                                                              │
│ }                                                                │
│                                                                  │
│ Progress:                                                        │
│ ⏳ Construction des entités complètes...                        │
│    └─ 500 employés assemblés                                    │
│    └─ Toutes les données fusionnées                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│ PHASE 6: User Preview & Confirmation                           │
│ Show entity-based preview (NOT file-based!)                    │
│                                                                  │
│ UI (Low Digital Literacy Design):                               │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ 📊 Aperçu de l'import                                     │  │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  │
│ │                                                            │  │
│ │ ✅ 500 employés complets prêts à importer                 │  │
│ │    └─ 500 avec salaires (100%)                            │  │
│ │    └─ 500 avec contrats (100%)                            │  │
│ │    └─ 120 avec personnes à charge (24%)                   │  │
│ │                                                            │  │
│ │ ⚠️ 2 conflits nécessitent votre attention                 │  │
│ │                                                            │  │
│ │ Aperçu (3 premiers employés):                             │  │
│ │ [Entity cards with categorized fields...]                 │  │
│ │                                                            │  │
│ │ [Voir tous les 500 employés]                              │  │
│ │ [Lancer l'import]                                         │  │
│ └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│ PHASE 7: Atomic Import                                         │
│ Insert complete entities in correct dependency order           │
│                                                                  │
│ Process:                                                         │
│ 1. Insert employees (500 records)                              │
│ 2. Insert employee_salaries (500 records, FK to employees)     │
│ 3. Insert employee_dependents (120 records, FK to employees)   │
│                                                                  │
│ Progress:                                                        │
│ ⏳ Import en cours...                                           │
│    └─ Employé 234/500 importé                                   │
│    └─ Temps restant: environ 30 secondes                        │
│                                                                  │
│ Features:                                                        │
│ - Batched inserts (100 records/batch)                          │
│ - Rollback on error (all-or-nothing per batch)                 │
│ - Real-time progress updates                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Core Principle: High-Quality LLM Input

### The Golden Rule

> **"Un LLM dépend énormément de la qualité de son input. Nous devons lui donner un contexte de très haute qualité pour qu'il pense et produise exactement ce dont nous avons besoin."**

### What This Means in Practice

#### ❌ Bad Prompt (Low-Quality Input)
```typescript
const prompt = `Analyze this data: ${JSON.stringify(data)}`;
```

**Problems:**
- No context about database schema
- No business rules
- No examples
- No reasoning framework
- LLM has to guess everything

#### ✅ Good Prompt (High-Quality Input)
```typescript
const prompt = `Tu es un expert RH senior en Côte d'Ivoire avec 15 ans d'expérience.

**Contexte complet:**
- Entreprise: ${tenantName}
- Pays: Côte d'Ivoire
- Réglementation: Code du Travail ivoirien, CNPS, ITS
- SMIG: 75,000 FCFA/mois (excepté stagiaires)
- Base de données: PostgreSQL
- Schéma exact: ${databaseSchema}

**Règles métier critiques:**
1. Employé régulier (CDI/CDD): salaire >= SMIG (75,000 FCFA)
2. Stagiaire: salaire peut être < SMIG (légal)
3. CNPS: 10 chiffres obligatoires
4. Email: unique par tenant
5. employeeNumber: unique par tenant

**Ta mission:**
Analyser ces fichiers Excel et construire des enregistrements d'employés COMPLETS.

**Réfléchis étape par étape comme un humain:**

1. **Identifie les personnes uniques**
   - Regarde employeeNumber (clé principale)
   - Si absent, utilise email
   - Si absent, utilise nom + prénom + date embauche
   - Détecte les doublons (même personne dans plusieurs fichiers)

2. **Groupe les données par personne**
   - Fichier 1 peut avoir nom + email
   - Fichier 2 peut avoir salaire
   - Fichier 3 peut avoir contrat
   → Fusionne tout en 1 seul employé

3. **Résous les conflits intelligemment**
   - Si salaire différent dans 2 fichiers:
     * Fichier spécialisé (Salaires.xlsx) > Fichier général
     * Fichier récent (2024) > Fichier ancien (2023)
     * Données complètes > Données partielles
   - Explique TON raisonnement en français

4. **Vérifie la cohérence**
   - Stagiaire avec salaire 50,000 FCFA = OK (< SMIG autorisé)
   - Cadre avec salaire 3M FCFA = OK (très expérimenté)
   - Employé avec salaire 30,000 FCFA = ERREUR (< SMIG)

**Données à analyser:**
${JSON.stringify({
  files: fileMetadata,
  sheets: classifiedSheets,
  sampleRecords: sampleData
}, null, 2)}

**Exemples de bons résultats:**
${JSON.stringify(examples, null, 2)}

**Format de sortie attendu (Zod schema):**
${zodSchemaDescription}

**IMPORTANT:**
- Raisonne à voix haute dans le champ "reasoning"
- Explique POURQUOI tu as choisi chaque valeur
- Indique la source de chaque champ (quel fichier)
- Signale tous les conflits détectés
- Sois honnête sur ta confiance (0-100%)

Maintenant, analyse et construis les entités.`;
```

**Benefits:**
- ✅ Complete business context
- ✅ Clear reasoning framework (step-by-step)
- ✅ Real-world examples and edge cases
- ✅ Structured output with validation
- ✅ Explainability (AI must explain decisions)

### Application Across All Tools

Every AI tool in the system follows this principle:

| Tool | High-Quality Input Elements |
|------|----------------------------|
| `classify-sheet.ts` | Schema context, country rules, FR prompts, step-by-step reasoning |
| `build-entity-graph.ts` | All classified sheets, DB schemas, dependency rules |
| `detect-conflicts.ts` | Field definitions, severity scoring, business rules |
| `resolve-conflicts.ts` | File metadata, timestamps, AI reasoning framework |
| `build-entities.ts` | Complete merged data, provenance tracking, validation schemas |

---

## UX Design for Long-Running Operations

### The Challenge

**Real-World Scenario:**
- 500 employees + 3 years payroll history = ~18,000 rows
- AI processing: 5-8 minutes on average
- Current UX: Just a spinner (user abandons after 1 minute)

### Design Principles for Low Digital Literacy

#### 1. **Continuous Feedback** (Never Silent)
```
❌ Don't show:
   "Loading..." (static spinner)

✅ Show:
   "Analyse de l'employé 234/500 (47%)"
   "Temps restant: environ 2 minutes"
```

#### 2. **Reassurance** (Explain What's Happening)
```
❌ Don't show:
   [Blank progress bar]

✅ Show:
   "L'IA analyse intelligemment vos données"
   "Cela peut prendre 2-3 minutes pour 500 employés"
   "Laissez l'onglet ouvert, ne pas actualiser"
```

#### 3. **Progressive Disclosure** (Show Results as Available)
```
❌ Don't show:
   Nothing until 100% complete

✅ Show:
   ✅ Feuille 1 analysée: 200 employés détectés
   ⏳ Feuille 2 en cours: Salaires 2024 (78%)
   ⏸️  Feuille 3 en attente: Contrats
```

#### 4. **Error Recovery** (What If It Fails?)
```
❌ Don't show:
   "Error 500" (user has no idea what to do)

✅ Show:
   "❌ Problème détecté: Fichier Salaires.xlsx"
   "Raison: 3 employés n'ont pas de matricule"
   "Solution: Ajoutez la colonne Matricule ou contactez le support"
   [Télécharger le rapport d'erreur]
```

### Proposed UX: Streaming Progress UI

#### Phase 1: Upload (Instant)
```
┌────────────────────────────────────────────────────┐
│ 📤 Upload de fichiers                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                     │
│ ✅ Liste_Personnel.xlsx (2.3 MB)                   │
│ ✅ Salaires_2024.xlsx (1.8 MB)                     │
│ ✅ Contrats.xlsx (890 KB)                          │
│                                                     │
│ [Analyser ces fichiers]                            │
└────────────────────────────────────────────────────┘
```

#### Phase 2: Analysis (2-3 minutes for 500 employees)
```
┌──────────────────────────────────────────────────────────────┐
│ 🧠 Analyse intelligente en cours                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ Étape 1/5: Lecture des fichiers                             │
│ ████████████████████████████████████████ 100%               │
│ ✅ 3 fichiers lus, 1,500 lignes au total                    │
│                                                               │
│ Étape 2/5: Classification des données                       │
│ ██████████████████████░░░░░░░░░░░░░░░░░ 67%                │
│ ⏳ Feuille 2/3: "Salaires 2024" en cours...                 │
│    └─ Type détecté: Paie historique (92% de confiance)     │
│                                                               │
│ Étapes suivantes:                                            │
│ ⏸️  Construction du graphe d'entités                         │
│ ⏸️  Détection et résolution des conflits                    │
│ ⏸️  Génération de l'aperçu                                  │
│                                                               │
│ ⏱️  Temps écoulé: 45 secondes                                │
│ 📊 Temps restant: environ 1 minute 30                        │
│                                                               │
│ 💡 L'IA analyse vos données intelligemment.                  │
│    Laissez l'onglet ouvert, cela peut prendre 2-3 minutes.  │
└──────────────────────────────────────────────────────────────┘
```

#### Phase 3: Entity Building (1-2 minutes)
```
┌──────────────────────────────────────────────────────────────┐
│ 🔨 Construction des entités                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ Étape 3/5: Association des enregistrements                  │
│ ████████████████████████████████████░░░ 89%                 │
│ ⏳ Employé 445/500 traité                                    │
│                                                               │
│ Détails:                                                      │
│ ✅ 445 employés assemblés                                    │
│ ✅ 445 salaires fusionnés                                    │
│ ✅ 445 contrats fusionnés                                    │
│ ⚠️  12 conflits détectés                                     │
│                                                               │
│ ⏱️  Temps restant: environ 30 secondes                       │
└──────────────────────────────────────────────────────────────┘
```

#### Phase 4: Conflict Resolution (30 seconds)
```
┌──────────────────────────────────────────────────────────────┐
│ ⚖️  Résolution des conflits                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ Étape 4/5: Analyse des conflits par l'IA                    │
│ ████████████████████████████████████████ 100%               │
│                                                               │
│ Résultats:                                                    │
│ ✅ 10 conflits résolus automatiquement (83%)                 │
│ ⚠️  2 conflits nécessitent votre confirmation:              │
│    └─ KOUASSI Jean - Salaire de base                        │
│    └─ YAO Marie - Date d'embauche                           │
│                                                               │
│ [Voir les détails des conflits]                             │
└──────────────────────────────────────────────────────────────┘
```

#### Phase 5: Preview Ready
```
┌──────────────────────────────────────────────────────────────┐
│ ✅ Analyse terminée - Prêt à importer                        │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                               │
│ 📊 Résumé:                                                    │
│ • 500 employés complets détectés                             │
│ • 500 avec salaires (100%)                                   │
│ • 500 avec contrats (100%)                                   │
│ • 120 avec personnes à charge (24%)                          │
│                                                               │
│ ⚠️  2 conflits à résoudre avant l'import                     │
│                                                               │
│ ⏱️  Durée totale: 2 minutes 34 secondes                      │
│                                                               │
│ [Voir l'aperçu des 500 employés]                            │
└──────────────────────────────────────────────────────────────┘
```

### Streaming Implementation

**Technical Approach: Server-Sent Events (SSE)**

```typescript
// Backend: coordinator.ts
export async function analyzeImportFile(params: {
  filePath: string;
  onProgress?: (update: ProgressUpdate) => void; // Streaming callback
}): Promise<ImportAnalysisResult> {

  // Step 1: Parse
  onProgress?.({
    phase: 'parse',
    percent: 10,
    message: 'Lecture des fichiers...',
    details: { filesRead: 1, totalFiles: 3 }
  });

  // Step 2: Classify (stream per sheet)
  for (let i = 0; i < sheets.length; i++) {
    onProgress?.({
      phase: 'classify',
      percent: 20 + (i / sheets.length) * 30,
      message: `Classification feuille ${i+1}/${sheets.length}...`,
      details: {
        sheetName: sheets[i].name,
        dataType: classification?.dataType,
        confidence: classification?.confidence
      }
    });
  }

  // Step 3: Build entity graph
  onProgress?.({
    phase: 'build_graph',
    percent: 60,
    message: 'Construction du graphe d\'entités...',
    details: { entitiesDetected: 500 }
  });

  // Step 4: Match records (stream per batch)
  for (let batch = 0; batch < totalBatches; batch++) {
    onProgress?.({
      phase: 'match_records',
      percent: 60 + (batch / totalBatches) * 20,
      message: `Association employé ${batch * 100}/500...`,
      details: { processed: batch * 100, total: 500 }
    });
  }

  // Step 5: Resolve conflicts
  onProgress?.({
    phase: 'resolve_conflicts',
    percent: 90,
    message: 'Résolution des conflits...',
    details: {
      conflictsDetected: 12,
      conflictsResolved: 10,
      needsUserInput: 2
    }
  });

  return result;
}

// Frontend: tRPC with SSE
export const analyzeFile = publicProcedure
  .input(z.object({ filePath: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const stream = new ReadableStream({
      async start(controller) {
        await analyzeImportFile({
          filePath: input.filePath,
          onProgress: (update) => {
            // Send SSE to client
            controller.enqueue(`data: ${JSON.stringify(update)}\n\n`);
          }
        });
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    });
  });
```

---

## Entity Matching & Conflict Resolution

### Matching Strategy

#### 1. Primary Key: employeeNumber
```typescript
// 95% of cases
if (record1.employeeNumber === record2.employeeNumber) {
  return { matched: true, confidence: 100, key: 'employeeNumber' };
}
```

#### 2. Secondary Key: Email
```typescript
// If no employeeNumber
if (record1.email && record2.email &&
    record1.email.toLowerCase() === record2.email.toLowerCase()) {
  return { matched: true, confidence: 90, key: 'email' };
}
```

#### 3. Tertiary Key: CNPS Number
```typescript
// For Ivorian employees
if (record1.cnpsNumber && record2.cnpsNumber &&
    record1.cnpsNumber === record2.cnpsNumber) {
  return { matched: true, confidence: 95, key: 'cnpsNumber' };
}
```

#### 4. Fuzzy Match: Name + HireDate
```typescript
// Last resort (AI-powered)
const similarity = calculateSimilarity({
  name1: `${record1.firstName} ${record1.lastName}`,
  name2: `${record2.firstName} ${record2.lastName}`,
  date1: record1.hireDate,
  date2: record2.hireDate
});

if (similarity > 0.85) {
  return { matched: true, confidence: similarity * 100, key: 'fuzzy_match' };
}
```

### Conflict Resolution AI Prompt

```typescript
const conflictResolutionPrompt = `Tu es un expert RH avec 15 ans d'expérience.

**Contexte:**
- Entreprise: ${tenantName}
- Pays: ${countryCode}
- Date actuelle: ${new Date().toLocaleDateString('fr-FR')}

**Conflit détecté:**
Employé: ${employee.name} (${employee.employeeNumber})
Champ: ${conflict.field}

Sources:
1. ${conflict.source1.file} (uploadé le ${conflict.source1.uploadDate})
   Valeur: ${conflict.source1.value}

2. ${conflict.source2.file} (uploadé le ${conflict.source2.uploadDate})
   Valeur: ${conflict.source2.value}

**Métadonnées des fichiers:**
${JSON.stringify(fileMetadata, null, 2)}

**Contexte de l'employé:**
${JSON.stringify(employeeContext, null, 2)}

**Réfléchis étape par étape:**

1. **Quelle source est la plus fiable?**
   Indices:
   - Nom du fichier (spécialisé vs général)
   - Date d'upload (récent vs ancien)
   - Complétude des données (fichier A a 20 champs, B en a 5)
   - Cohérence avec autres champs

2. **Le conflit est-il critique?**
   Champs critiques: salaire, CNPS, dates légales, type contrat
   Champs mineurs: téléphone, adresse, format de nom

3. **Y a-t-il un pattern évident?**
   Exemple: Si TOUS les salaires Fichier A > Fichier B
   → Probablement A = 2024, B = 2023

4. **Cohérence métier?**
   - Stagiaire: salaire 50K = normal (< SMIG autorisé)
   - Cadre: salaire 3M = cohérent si senior
   - Employé régulier: salaire 30K = ERREUR (< SMIG)

**Retourne (JSON strict):**
{
  "chosenSource": "Salaires_2024.xlsx",
  "chosenValue": 500000,
  "confidence": 95,
  "severity": "critical",
  "reasoning": "Fichier 'Salaires_2024.xlsx' est plus récent (uploadé aujourd'hui vs il y a 2 mois) et spécialisé pour les données de paie. De plus, il contient des composantes de salaire détaillées (primes) absentes du fichier 'Liste_Personnel.xlsx', suggérant des données plus complètes et à jour. Le montant de 500,000 FCFA est cohérent avec un cadre moyen en Côte d'Ivoire.",
  "requiresUserConfirmation": false
}

IMPORTANT:
- Si confidence < 80% OU severity = "critical", set requiresUserConfirmation = true
- Explique TON raisonnement en détail (minimum 2-3 phrases)
- Sois honnête sur la confiance (ne force pas 100% si incertain)
`;
```

---

## Implementation Plan

### Phase 1: Foundation (Day 1-2)
- [ ] Create `docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md` ✅
- [ ] Design streaming progress types and interfaces
- [ ] Implement SSE infrastructure in tRPC
- [ ] Create progress tracking UI component

### Phase 2: Entity Graph Building (Day 3-4)
- [ ] Create `server/ai-import/tools/build-entity-graph.ts`
- [ ] Implement entity matching logic
- [ ] Add unit tests for matching (employeeNumber, email, fuzzy)
- [ ] Integrate with coordinator

### Phase 3: Conflict Resolution (Day 5-6)
- [ ] Create `server/ai-import/tools/detect-conflicts.ts`
- [ ] Create `server/ai-import/tools/resolve-conflicts.ts`
- [ ] Implement AI conflict resolution with high-quality prompts
- [ ] Add conflict UI components

### Phase 4: Entity Building (Day 7-8)
- [ ] Create `server/ai-import/tools/build-entities.ts`
- [ ] Replace `clean-data.ts` with new entity builder
- [ ] Add provenance tracking (`_sources` field)
- [ ] Implement categorized field grouping

### Phase 5: UI Refactor (Day 9-10)
- [ ] Update analysis UI with streaming progress
- [ ] Create entity-based preview (not file-based)
- [ ] Implement categorized field view
- [ ] Add conflict resolution UI

### Phase 6: Testing & Polish (Day 11-12)
- [ ] Test with 500-employee file
- [ ] Test with 3-year payroll history
- [ ] Test conflict resolution scenarios
- [ ] Performance optimization

---

## Success Metrics

### Technical Metrics
- [ ] Entity matching accuracy: >95% (with employeeNumber)
- [ ] Conflict resolution accuracy: >85% (users accept AI recommendation)
- [ ] Processing speed: <5 seconds per 100 employees
- [ ] Zero data loss during merging

### UX Metrics
- [ ] User completion rate: >90% (don't abandon during analysis)
- [ ] Time to import 500 employees: <3 minutes total
- [ ] Conflict resolution time: <30 seconds per conflict
- [ ] User satisfaction: "I understand what's happening" >80%

### Business Metrics
- [ ] Support tickets reduced by 50% (fewer "import failed" issues)
- [ ] Multi-file imports: 10x faster than manual sequential import
- [ ] Data quality: 95%+ fields populated (vs 60% with single-file import)

---

## Appendix: Technical Specifications

### TypeScript Interfaces

```typescript
// Entity Graph
export interface EntityGraph {
  entities: {
    [entityType: string]: {
      sources: SheetReference[];
      matchingKeys: string[];
      recordCount: number;
      dependencies: string[];
    };
  };
  crossReferences: Array<{
    from: string;
    to: string;
    via: string; // Matching key
  }>;
}

// Conflict Detection
export interface Conflict {
  entityId: string; // Temporary ID during analysis
  field: string;
  sources: Array<{
    file: string;
    sheet: string;
    value: any;
    uploadedAt: Date;
  }>;
  severity: 'critical' | 'medium' | 'low';
}

// Conflict Resolution
export interface ConflictResolution {
  conflictId: string;
  chosenSource: string;
  chosenValue: any;
  confidence: number; // 0-100
  reasoning: string; // French explanation
  requiresUserConfirmation: boolean;
}

// Complete Entity
export interface CompleteEntity {
  // Actual database fields
  [field: string]: any;

  // Metadata (not inserted to DB)
  _sources: Record<string, string>; // field → source file
  _conflicts: ConflictResolution[];
  _completeness: number; // 0-100% (how many fields populated)
  _category: Record<string, string[]>; // Categorized fields for UI
}

// Streaming Progress
export interface ProgressUpdate {
  phase: 'parse' | 'classify' | 'build_graph' | 'match_records' | 'resolve_conflicts' | 'build_entities';
  percent: number; // 0-100
  message: string; // French, user-friendly
  details?: any; // Phase-specific details
  estimatedTimeRemaining?: number; // Seconds
}
```

### File Structure

```
server/ai-import/
├── tools/
│   ├── parse-excel.ts              [Existing]
│   ├── classify-sheet.ts           [Existing]
│   ├── build-entity-graph.ts       [NEW] Phase 2
│   ├── match-records.ts            [NEW] Phase 3
│   ├── detect-conflicts.ts         [NEW] Phase 4
│   ├── resolve-conflicts.ts        [NEW] Phase 4
│   ├── build-entities.ts           [NEW] Phase 5
│   ├── validate-data.ts            [Existing, modify]
│   └── generate-summary.ts         [DEPRECATE - merged into build-entities]
│
├── coordinator.ts                  [MODIFY - add new phases]
├── importers/
│   └── [Existing importers]        [MODIFY - handle complete entities]
└── data-type-registry.ts           [Existing]

app/(shared)/import/ai/
└── page.tsx                        [MAJOR REFACTOR - entity-based UI]
```

---

## References

- **Design Docs:** `/docs/HCI-DESIGN-PRINCIPLES.md`
- **Multi-Country:** `/docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md`
- **TypeScript Best Practices:** `/docs/TYPESCRIPT-BEST-PRACTICES.md`
- **Original Import Design:** `/docs/AI-IMPORT-SYSTEM-DESIGN.md`

---

**End of Document**
