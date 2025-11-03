# Employee Import System: Error Message Quality & HCI Adherence Analysis

**Date:** November 2, 2025  
**System:** Preem HR Employee Import (Excel/CSV)  
**Scope:** Error messages in validation, field validators, and UI display

---

## EXECUTIVE SUMMARY

The employee import system has **MODERATE adherence to HCI principles** with **several critical UX issues** that violate low digital literacy guidelines:

### Overall Score: 6/10

| Category | Score | Status |
|----------|-------|--------|
| Language (French) | 10/10 | ✅ All French |
| Clarity & Jargon | 5/10 | ⚠️ Some technical language |
| Error Prevention | 4/10 | ❌ Weak prevention, strong handling |
| Actionability | 6/10 | ⚠️ Some guidance, mostly symptom-focused |
| User Context | 7/10 | ⚠️ Shows row/field, but overwhelming volume |
| Emotional Tone | 8/10 | ✅ Friendly, accessible language |

---

## DETAILED FINDINGS

### 1. FIELD VALIDATORS - ERROR MESSAGES

**File:** `/lib/employee-import/field-mappings.ts`

#### Analyzed Validators (13 total)

| Field | Error Message | Rating | Assessment | Issues |
|-------|---------------|--------|-----------|--------|
| **Matricule** | "Matricule requis" | ✅ GOOD | Clear & concise | None |
| **Matricule** | "Matricule doit avoir entre 2 et 20 caractères" | ✅ GOOD | Specific boundaries | Helpful |
| **Matricule** | "Matricule: uniquement lettres, chiffres, tirets" | ⚠️ NEEDS WORK | Too technical | Says "what" not "why" |
| **Email** | "Email invalide" | ❌ BAD | Generic, not French context | No format example |
| **Email** | "Format email invalide (ex: nom@domaine.com)" | ✅ GOOD | Shows example | Actionable |
| **Contact** | "Contact requis" | ✅ GOOD | Clear | None |
| **Contact** | "Contact doit avoir entre 8 et 15 chiffres" | ✅ GOOD | Specific boundaries | Helpful |
| **Contact** | "Contact: uniquement chiffres et + (ex: +225 07 12 34 56 78)" | ✅ EXCELLENT | Shows format example | Very helpful for user |
| **Date de naissance** | "Format de date invalide (utilisez JJ/MM/AAAA)" | ✅ GOOD | Shows correct format | Clear instruction |
| **Date de naissance** | "Âge doit être entre 16 et 100 ans" | ✅ EXCELLENT | Business context | Makes sense |
| **Date d'embauche** | "Format de date invalide (utilisez JJ/MM/AAAA)" | ✅ GOOD | Clear format guidance | Standard |
| **Date d'embauche** | "Date d'embauche ne peut pas être dans le futur" | ✅ GOOD | Clear logic | Prevents absurd data |
| **Date d'embauche** | "Date d'embauche trop ancienne" | ⚠️ WEAK | "Trop ancienne" is vague | Doesn't explain cutoff |
| **N° CNPS** | "N° CNPS requis" | ✅ GOOD | Clear | None |
| **N° CNPS** | "N° CNPS doit contenir entre 7 et 10 chiffres" | ✅ GOOD | Specific bounds | Helpful |
| **N° CMU** | "N° CMU incomplet" | ⚠️ WEAK | "Incomplet" is vague | How many digits needed? |
| **RIB** | "Format RIB invalide (ex: CI93 CI000 01234...)" | ✅ GOOD | Shows format | Clear example |
| **Nombre d'enfants** | "Nombre d'enfants requis (0 si aucun)" | ✅ EXCELLENT | Clear instruction | Shows how to handle 0 |
| **Nombre d'enfants** | "Nombre d'enfants doit être entre 0 et 20" | ✅ GOOD | Specific bounds | Logical limit |
| **Salaire Catégoriel** | "Salaire requis" | ✅ GOOD | Clear | None |
| **Salaire Catégoriel** | "Salaire doit être un nombre positif" | ✅ GOOD | Clear business logic | None |
| **Salaire Catégoriel** | "Salaire semble trop faible (minimum SMIG: 75,000 FCFA)" | ✅ EXCELLENT | **Country-specific context** | References legal minimum |
| **Salaire Catégoriel** | "Salaire semble trop élevé" | ❌ BAD | **No context on limit** | What's "too high"? |
| **Indemnité de transport** | "Indemnité de transport doit être un nombre positif" | ✅ GOOD | Clear | None |
| **Indemnité de transport** | "Indemnité de transport doit être ≥ 20,000 FCFA (minimum légal)" | ✅ EXCELLENT | Legal reference included | Empowers user |
| **Indemnité de transport** | "Indemnité de transport semble trop élevée (max raisonnable: 100,000 FCFA)" | ✅ GOOD | Shows bounds | Reasonable |
| **Fréquence de paiement** | "Fréquence de paiement requise" | ✅ GOOD | Clear | None |
| **Fréquence de paiement** | "Fréquence invalide. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY" | ⚠️ WEAK | **English values in French text** | Confusing for low literacy |
| **Nature du contrat** | "Nature du contrat requise" | ✅ GOOD | Clear | None |
| **Nature du contrat** | "Type de contrat invalide. Utilisez: CDI, CDD, CDDTI, INTERIM, ou STAGE" | ⚠️ WEAK | **Mixed English/French** | "INTERIM" not localized |

---

#### Top Issues in Field Validators

**ISSUE #1: English values in French-speaking contexts (CRITICAL)**
```
❌ "Fréquence invalide. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY"
✅ Better: "Fréquence invalide. Utilisez: MENSUEL, HEBDOMADAIRE, QUINZAINE, ou JOURNALIER"

❌ "Type de contrat invalide. Utilisez: CDI, CDD, CDDTI, INTERIM, ou STAGE"
✅ Better: "Type de contrat invalide. Utilisez: CDI, CDD, CDDTI, INTÉRIM, ou STAGE"
```
**Impact:** User with low digital literacy sees English abbreviations and may not know what to do.

**ISSUE #2: Vague limits without context**
```
❌ "Date d'embauche trop ancienne"
✅ Better: "Date d'embauche ne peut pas être avant 1950"

❌ "Salaire semble trop élevé"
✅ Better: "Salaire semble anormalement élevé (> 50 millions FCFA). Vérifiez?"

❌ "N° CMU incomplet"
✅ Better: "N° CMU doit contenir au moins 5 chiffres"
```

**ISSUE #3: Format examples missing for critical fields**
```
❌ "Email invalide"
✅ Better: "Email invalide (ex: nom@domaine.com)"

❌ "Matricule: uniquement lettres, chiffres, tirets"
✅ Better: "Matricule: lettres, chiffres, tirets (ex: E001, DUPONT-01)"
```

---

### 2. PARSER-LEVEL ERRORS

**File:** `/lib/employee-import/parser.ts`

| Error Message | Location | Rating | Assessment |
|---------------|----------|--------|-----------|
| "Fichier vide" | Line 83 | ✅ GOOD | Clear to all users |
| "Champ requis manquant: {sageField}" | Line 289 | ✅ GOOD | Shows which field |
| "Impossible de décoder le fichier CSV. Vérifiez l'encodage." | Line 147 | ⚠️ WEAK | "Encodage" is too technical |
| "Impossible de lire le fichier CSV" | Line 177 | ❌ BAD | Too generic; no context |
| "Format de fichier non supporté: {ext}. Utilisez .xlsx ou .csv" | Line 57 | ✅ GOOD | Shows acceptable formats |
| "Matricule en double: {num} (déjà utilisé ligne {row})" | Line 352 | ✅ EXCELLENT | Shows duplicate & location |

---

#### Parser Issue: Encoding Error

```tsx
❌ "Impossible de décoder le fichier CSV. Vérifiez l'encodage."
```

**Problem:** Average user doesn't know what "encodage" means. SAGE files often export in ISO-8859-1.

```tsx
✅ Better: "Le fichier CSV n'est pas reconnu. Assurez-vous que:
  • Le fichier vient de SAGE/Excel
  • Le fichier est bien un .csv
  • Réessayez en convertissant en UTF-8 (Outils → Options dans Excel)"
```

---

### 3. ROUTER-LEVEL ERRORS (tRPC)

**File:** `/server/routers/employee-import.ts`

| Error Message | Line | Rating | Assessment | Issues |
|---------------|------|--------|-----------|--------|
| "Format de fichier invalide. Utilisez .xlsx ou .csv" | 207 | ✅ GOOD | Clear formats | Helpful |
| "Fichier trop volumineux (max 10 MB)" | 219 | ✅ GOOD | Shows limit | Actionable |
| "Erreur lors du téléchargement du fichier" | 238, 253 | ❌ BAD | Generic fallback | No context |
| "Accès non autorisé à ce fichier" | 272 | ⚠️ WEAK | Security-focused, not user-focused | User won't understand |
| "Fichier introuvable" | 284 | ✅ GOOD | Clear to user | May suggest retry |
| "{errors.length} erreur(s) trouvée(s). Corrigez les erreurs ou utilisez 'Importer uniquement les lignes valides'" | 442 | ✅ GOOD | Actionable path forward | Shows option |
| "Aucune ligne valide à importer" | 449 | ✅ GOOD | Clear outcome | User understands |
| "Erreur lors de la validation du fichier" | 354 | ❌ BAD | Generic catchall | No context |
| "Erreur lors de l'importation des employés" | 862 | ❌ BAD | Generic catchall | No context |

---

#### Router Issues

**ISSUE #1: Generic fallback errors**
```tsx
❌ Line 238, 354, 862: Generic catch-all errors
"Erreur lors du téléchargement du fichier"
"Erreur lors de la validation du fichier"
"Erreur lors de l'importation des employés"
```

**Problem:** These are vague. User doesn't know if it's their file or the server.

```tsx
✅ Better: 
// In try-catch, provide specific context:
if (error.message.includes('ENOENT')) {
  throw "Fichier supprimé. Téléchargez à nouveau."
}
if (error.message.includes('timeout')) {
  throw "Opération trop lente. Fichier trop volumineux?"
}
```

**ISSUE #2: Security error message leaks intent**
```tsx
❌ Line 272, 381: "Accès non autorisé à ce fichier"
```

**Problem:** Low-literacy user doesn't understand. This is a security check, but it sounds like their fault.

```tsx
✅ Better: "Le fichier a expiré. Téléchargez à nouveau."
// Or silently handle and show generic message
```

---

### 4. UI ERROR DISPLAY

**File:** `/app/onboarding/q2/components/paths/self-service-import.tsx`

#### How Errors Are Shown

**Lines 429-448: Error Section**
```tsx
{validationResult.errors.length > 0 && (
  <div className="space-y-2">
    <h3 className="font-semibold text-red-900">
      Erreurs ({validationResult.errors.length})
    </h3>
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {validationResult.errors.slice(0, 10).map((error, i) => (
        <div key={i} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
          <span className="font-medium">Ligne {error.row}:</span>{' '}
          {error.field && <span className="text-red-700">[{error.field}]</span>}{' '}
          {error.message}
        </div>
      ))}
      {validationResult.errors.length > 10 && (
        <div className="text-sm text-muted-foreground text-center py-2">
          +{validationResult.errors.length - 10} autres erreurs...
        </div>
      )}
    </div>
  </div>
)}
```

#### UI Issues

| Issue | Severity | Assessment |
|-------|----------|-----------|
| Shows only first 10 errors | 🔴 HIGH | User can't see all 50 errors; gives false sense of completion |
| "Autres erreurs..." truncation | 🔴 HIGH | User doesn't know how many more; frustrating |
| Small text (text-sm) | 🔴 HIGH | Violates HCI principle: errors must be prominent |
| Red-on-red coloring | 🟡 MEDIUM | Accessibility issue; hard for colorblind users |
| No scrollable error list | 🟡 MEDIUM | max-h-48 truncates; users miss errors |
| Field name in brackets | 🟡 MEDIUM | Confusing for non-technical users |

---

#### UI Error Display Example

Current display:
```
Erreurs (45)
[✗] Ligne 2: [Contact] Contact doit avoir entre 8 et 15 chiffres
[✗] Ligne 5: [Salaire Catégoriel] Salaire semble trop faible...
[✗] Ligne 8: [Date d'embauche] Format de date invalide...
...
+42 autres erreurs...
```

**Problems for low-literacy user:**
1. Can't see most errors (only 10 of 45)
2. Doesn't know if row 2 is first or last to fix
3. Sees "+42 autres" but can't access them
4. No guidance on where to start fixing

---

### 5. TOAST NOTIFICATIONS

**File:** `/app/onboarding/q2/components/paths/self-service-import.tsx`

| Toast Message | Line | Rating | Assessment |
|---------------|------|--------|-----------|
| "✅ Validation réussie" | 116 | ✅ GOOD | Celebratory tone |
| "{validRows} lignes valides trouvées" | 117 | ✅ GOOD | Shows progress |
| "⚠️ Erreurs détectées" | 121 | ✅ GOOD | Clear status |
| "{errors.length} erreur(s) trouvée(s)" | 122 | ⚠️ WEAK | "trouvée(s)" is awkward plural |
| "❌ Erreur de validation" | 129 | ⚠️ WEAK | Too generic |
| "Impossible de valider le fichier" | 130 | ⚠️ WEAK | No context on why |
| "❌ Erreur" | 140 | ❌ BAD | Minimal description |
| "Fichier non trouvé. Veuillez réessayer." | 141 | ✅ GOOD | Actionable |
| "🎉 Import réussi!" | 159 | ✅ GOOD | Celebratory |
| "{importedCount} employés importés" | 160 | ✅ GOOD | Shows outcome |
| "❌ Erreur d'import" | 165 | ❌ BAD | Too generic |
| "Impossible d'importer les employés" | 166 | ❌ BAD | No context |

---

## HCI PRINCIPLES ASSESSMENT

### 1. Zero Learning Curve ⚠️ (4/10)

**How well can a non-technical user understand errors without training?**

✅ Good Examples:
- "Salaire semble trop faible (minimum SMIG: 75,000 FCFA)" - references known legal value
- "Nombre d'enfants requis (0 si aucun)" - shows how to handle zero
- "Contact: uniquement chiffres et + (ex: +225 07 12 34 56 78)" - shows real example

❌ Poor Examples:
- "Indemnité de transport doit être un nombre positif" - user might not know what "positif" means
- "Fréquence invalide. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY" - English values confuse
- "N° CMU incomplet" - doesn't explain "incomplet"

**Verdict:** Mixed. Simple messages work, but some contain technical French or missing context.

---

### 2. Error Prevention (Not Just Handling) ❌ (3/10)

**Are errors prevented, or just reported after the fact?**

Current approach: **Handle errors after upload**
- User fills 50-row spreadsheet
- Uploads
- Gets 15 errors back
- Must correct and re-upload

HCI principle says: **Prevent errors before they happen**

Missing preventions:
- No format validation in template instructions (errors appear as surprises)
- No live preview/validation during download (user fills blindly)
- No sample data showing correct formats
- No field-by-field format hints in template

**Verdict:** Error prevention is weak. System focuses on error handling (finding them) not error prevention (stopping them).

---

### 3. Immediate Feedback ⚠️ (7/10)

**Do users see instant confirmation of actions?**

✅ Good:
- Toast notifications appear immediately
- Loading spinner shows during validation/import
- Validation results show within seconds

❌ Poor:
- Error list shows only 10 of 50 errors (incomplete feedback)
- No indication of which rows are fixable vs unfixable
- No summary of "easiest errors to fix first"

**Verdict:** Feedback is immediate but incomplete.

---

### 4. Cognitive Load Minimization ⚠️ (4/10)

**Is information presented in digestible chunks?**

Current display:
```
Erreurs (45)
[✗] Ligne 2: [Contact] Contact doit avoir entre 8 et 15 chiffres
[✗] Ligne 3: [Salaire] Salaire semble trop faible (minimum SMIG: 75,000 FCFA)
[✗] Ligne 3: [Date d'embauche] Format de date invalide (utilisez JJ/MM/AAAA)
[✗] Ligne 4: [Email] Format email invalide (ex: nom@domaine.com)
[✗] Ligne 5: [Matricule] Matricule en double: E001 (déjà utilisé ligne 2)
+40 autres erreurs...
```

Problems:
1. **5+ errors per screen** - Too much at once (cognitive overload)
2. **No grouping** - Errors not organized by row or field
3. **No priority** - Doesn't show "fix rows 2-5 first, then scroll"
4. **No success examples** - Doesn't show what correct looks like

**Better approach for low-literacy:**
```
Étape 1/3: Corriger les erreurs faciles

❌ Ligne 2 - Contact (téléphone)
   Vous avez écrit: "221234567"
   Problème: Manque 2 chiffres
   Correction: Ajouter les 2 chiffres manquants
   Exemple: "+225 07 12 34 56 78"

✅ Ligne 3 - Salaire (OK)
✅ Ligne 4 - Email (OK)
```

**Verdict:** Cognitive load is too high. User sees 45 errors at once without clear prioritization.

---

### 5. Task-Oriented Design ⚠️ (6/10)

**Is the system designed around user goals?**

Current wording:
- "Validation" - technical term
- "Erreurs détectées" - focuses on problems
- "Lignes invalides" - system-focused

Better wording:
- "Vérification de vos données" - task-oriented
- "Problèmes trouvés" - more relatable
- "Employés non importables" - focuses on outcome

**Verdict:** Partially task-oriented. Some messages are good ("Import réussi"), others are technical.

---

### 6. Graceful Degradation ⚠️ (6/10)

**Does it work on slow networks, old devices?**

✅ Good:
- Error messages are plain text (no heavy libraries)
- File upload shows progress
- Supports CSV and XLSX (multiple formats)

⚠️ Concerns:
- Max file size is 10MB (fine)
- Validation might timeout on slow 3G (no timeout handling)
- max-h-48 overflow might not work well on 5" phones

**Verdict:** Reasonably robust, but no explicit slow-network handling.

---

## MULTI-COUNTRY UX ASSESSMENT

**Expected per HCI Principles:** Error messages should reference country-specific rules.

✅ Examples that work:
```
"Salaire semble trop faible (minimum SMIG: 75,000 FCFA)"
"Indemnité de transport doit être ≥ 20,000 FCFA (minimum légal)"
```

⚠️ Examples that miss the mark:
```
"N° CNPS doit contenir entre 7 et 10 chiffres"
// Should say: "N° CNPS de Côte d'Ivoire (7-10 chiffres)"

"Contact: uniquement chiffres et + (ex: +225 07 12 34 56 78)"
// Good! Shows +225 prefix specific to CI
```

**Verdict:** Partially multi-country aware. Some messages hardcode CI context, but others are generic.

---

## COMPREHENSIVE ERROR MESSAGES INVENTORY

### All Error Messages by Category

#### Critical (Stop Import)
1. "Matricule requis" ✅ Good
2. "Matricule doit avoir entre 2 et 20 caractères" ✅ Good
3. "Matricule: uniquement lettres, chiffres, tirets" ⚠️ Needs example
4. "Matricule en double: {num} (déjà utilisé ligne {row})" ✅ Excellent
5. "Contact requis" ✅ Good
6. "Contact doit avoir entre 8 et 15 chiffres" ✅ Good
7. "Contact: uniquement chiffres et + (ex: +225 07 12 34 56 78)" ✅ Excellent
8. "Date d'embauche requise" ✅ Good
9. "Date d'embauche ne peut pas être dans le futur" ✅ Good
10. "Date d'embauche trop ancienne" ⚠️ Vague limit
11. "Format de date invalide (utilisez JJ/MM/AAAA)" ✅ Good
12. "N° CNPS requis" ✅ Good
13. "N° CNPS doit contenir entre 7 et 10 chiffres" ✅ Good
14. "Salaire Catégoriel requis" ✅ Good
15. "Salaire doit être un nombre positif" ⚠️ Vague term
16. "Salaire semble trop faible (minimum SMIG: 75,000 FCFA)" ✅ Excellent
17. "Salaire semble trop élevé" ❌ No limit stated
18. "Indemnité de transport requise" ✅ Good
19. "Indemnité de transport doit être un nombre positif" ⚠️ Vague
20. "Indemnité de transport doit être ≥ 20,000 FCFA (minimum légal)" ✅ Excellent
21. "Indemnité de transport semble trop élevée (max raisonnable: 100,000 FCFA)" ✅ Good
22. "Fréquence de paiement requise" ✅ Good
23. "Fréquence invalide. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY" ❌ English values
24. "Nature du contrat requise" ✅ Good
25. "Type de contrat invalide. Utilisez: CDI, CDD, CDDTI, INTERIM, ou STAGE" ⚠️ Mix of French/English

#### Non-Critical (Warnings)
26. "Champ recommandé manquant: {field}" ✅ Good
27. "N° CMU incomplet" ⚠️ Vague
28. "Format email invalide (ex: nom@domaine.com)" ✅ Good
29. "Âge doit être entre 16 et 100 ans" ✅ Excellent
30. "Nombre d'enfants requis (0 si aucun)" ✅ Excellent
31. "Nombre d'enfants doit être entre 0 et 20" ✅ Good
32. "Format RIB invalide (ex: CI93 CI000 01234...)" ✅ Good

#### Upload/File Level
33. "Fichier vide" ✅ Good
34. "Format de fichier invalide. Utilisez .xlsx ou .csv" ✅ Good
35. "Fichier trop volumineux (max 10 MB)" ✅ Good
36. "Format de fichier non supporté: {ext}. Utilisez .xlsx ou .csv" ✅ Good
37. "Impossible de décoder le fichier CSV. Vérifiez l'encodage." ⚠️ Too technical
38. "Impossible de lire le fichier CSV" ❌ Generic
39. "Erreur lors du téléchargement du fichier" ❌ Generic catch-all
40. "Accès non autorisé à ce fichier" ⚠️ Security-focused

#### Import Level
41. "Champ requis manquant: {sageField}" ✅ Good
42. "{errors.length} erreur(s) trouvée(s). Corrigez les erreurs ou utilisez 'Importer uniquement les lignes valides'" ✅ Good (actionable)
43. "Aucune ligne valide à importer" ✅ Good

#### Toast Notifications
44. "✅ Validation réussie" ✅ Good
45. "⚠️ Erreurs détectées" ✅ Good
46. "❌ Erreur de validation" ❌ Generic
47. "❌ Erreur d'import" ❌ Generic
48. "🎉 Import réussi!" ✅ Good
49. "{importedCount} employés importés" ✅ Good

---

## RECOMMENDATIONS (PRIORITY ORDER)

### 🔴 CRITICAL (Fix immediately)

#### 1. Fix English values in validation errors
**Priority:** CRITICAL  
**Impact:** Low-literacy users confused by English abbreviations

**Current:**
```tsx
"Fréquence invalide. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY"
"Type de contrat invalide. Utilisez: CDI, CDD, CDDTI, INTERIM, ou STAGE"
```

**Fix:**
```tsx
// In field-mappings.ts, add French examples to error messages
'Fréquence de paiement': (val: string) => {
  if (!val) {
    return { valid: false, message: 'Fréquence de paiement requise' };
  }
  const normalized = val.trim().toUpperCase();
  const validValues = ['MONTHLY', 'MENSUEL', 'WEEKLY', 'HEBDOMADAIRE', ...];
  if (!validValues.includes(normalized)) {
    return { 
      valid: false, 
      message: 'Fréquence invalide. Écrivez: MENSUEL, HEBDOMADAIRE, QUINZAINE, ou JOURNALIER' 
    };
  }
  return { valid: true };
}
```

#### 2. Fix error list truncation - show all errors
**Priority:** CRITICAL  
**Impact:** Users can't see 80% of errors; fixes feel incomplete

**Current (line 433-445):**
```tsx
<div className="space-y-1 max-h-48 overflow-y-auto">
  {validationResult.errors.slice(0, 10).map((error, i) => (...))}
  {validationResult.errors.length > 10 && (
    <div className="text-sm text-muted-foreground text-center py-2">
      +{validationResult.errors.length - 10} autres erreurs...
    </div>
  )}
</div>
```

**Problems:**
- Only shows 10 errors
- User doesn't know how to access remaining 40 errors
- Creates false sense that file is mostly valid

**Fix:**
```tsx
// Option 1: Show all errors (may be long but complete)
<div className="space-y-1 max-h-[400px] overflow-y-auto">
  {validationResult.errors.map((error, i) => (...))}
</div>

// Option 2: Group by row + show count
<div className="space-y-2 max-h-[400px] overflow-y-auto">
  {Object.entries(
    validationResult.errors.reduce((acc, e) => {
      if (!acc[e.row]) acc[e.row] = [];
      acc[e.row].push(e);
      return acc;
    }, {} as Record<number, typeof validationResult.errors>)
  ).map(([row, rowErrors]) => (
    <div key={row} className="p-2 bg-red-50 border border-red-200 rounded">
      <span className="font-medium">Ligne {row}:</span>
      <ul className="ml-4 mt-1">
        {rowErrors.map((e, i) => (
          <li key={i} className="text-sm">
            • {e.field}: {e.message}
          </li>
        ))}
      </ul>
    </div>
  ))}
</div>
```

#### 3. Add salary ceiling with context
**Priority:** CRITICAL  
**Impact:** Users see vague "trop élevé" error with no guidance

**Current (line 247-248):**
```tsx
if (num > 50000000) {
  return { valid: false, message: 'Salaire semble trop élevé' };
}
```

**Fix:**
```tsx
if (num > 50000000) {
  return { 
    valid: false, 
    message: 'Salaire semble anormalement élevé (> 50 millions FCFA). Vérifiez la valeur dans votre fichier Excel.' 
  };
}
```

#### 4. Add date range context
**Priority:** HIGH  
**Impact:** "Trop ancienne" is vague

**Current (line 189-190):**
```tsx
if (parsed < new Date('1950-01-01')) {
  return { valid: false, message: 'Date d\'embauche trop ancienne' };
}
```

**Fix:**
```tsx
if (parsed < new Date('1950-01-01')) {
  return { 
    valid: false, 
    message: 'Date d\'embauche doit être après 1950 (la date saisie est très ancienne)' 
  };
}
```

---

### 🟡 HIGH PRIORITY (Fix within 1 sprint)

#### 5. Group errors by row in UI display
**Current behavior:** Linear list, hard to scan

**Fix:**
Show errors grouped by problematic row, with row number prominently:
```
Ligne 2 - Erreurs à corriger (2 problèmes)
  • Contact: doit avoir 8-15 chiffres
  • Email: format invalide

Ligne 3 - Erreurs à corriger (1 problème)
  • Salaire: semble trop faible
```

#### 6. Add CMU validation context
**Current (line 209-211):**
```tsx
'N° CMU': (val: any) => {
  if (!val) return { valid: true };
  const cleaned = String(val).replace(/[\s-]/g, '');
  if (cleaned.length > 0 && cleaned.length < 5) {
    return { valid: false, message: 'N° CMU incomplet' };
  }
```

**Fix:**
```tsx
if (cleaned.length > 0 && cleaned.length < 5) {
  return { 
    valid: false, 
    message: 'N° CMU doit avoir au moins 5 chiffres (vous en avez mis ' + cleaned.length + ')' 
  };
}
```

#### 7. Explain "format invalide" for RIB better
**Current (good):**
```tsx
"Format RIB invalide (ex: CI93 CI000 01234...)"
```

**Enhance:**
```tsx
"Format RIB invalide. Attendu: CI + 2 chiffres + 20-30 caractères (ex: CI93ABCD...)"
```

#### 8. Add encoding help for CSV errors
**Current (line 147):**
```tsx
throw new Error('Impossible de décoder le fichier CSV. Vérifiez l\'encodage.');
```

**Fix:**
```tsx
throw new Error(
  'Le fichier CSV n\'a pas pu être lu. Essayez:\n' +
  '1. Ouvrir dans Excel\n' +
  '2. Fichier > Enregistrer sous > Format CSV UTF-8'
);
```

---

### 🟢 MEDIUM PRIORITY (Fix within 2 sprints)

#### 9. Add sample data to template
**Current:** Template shows headers only

**Fix:** Add 2-3 complete example rows with correct formatting

#### 10. Add field hints in Excel template
**Current:** Column headers only

**Fix:** Add comment/note under each header showing:
- Format example
- Valid values
- Min/max
- Required vs optional

#### 11. Improve toast messages for errors
**Current:**
```tsx
toast({
  title: '❌ Erreur de validation',
  description: error.message || 'Impossible de valider le fichier',
  variant: 'destructive',
});
```

**Fix:**
```tsx
toast({
  title: '⚠️ Impossible de valider',
  description: 'Le fichier est vide ou mal formaté. Vérifiez:\n' + 
    '• Les données commencent à la ligne 2\n' +
    '• Les colonnes obligatoires sont remplies',
  variant: 'destructive',
  duration: 5000, // Keep longer for reading
});
```

#### 12. Add error filtering/sorting options
**Current:** All errors shown in one list

**Fix:** Add tabs:
- "Tous les erreurs" (default)
- "Par type" (group by field)
- "Par ligne" (group by row)

---

### 🔵 LOW PRIORITY (Nice to have)

#### 13. Add progress indicator
Show "You've fixed X of Y errors" as user corrects and re-uploads

#### 14. Add downloadable error report
Let user export errors as CSV for tracking

#### 15. Add live validation preview
Show validation errors as user types in Excel (if using API)

---

## SPECIFIC ERROR MESSAGE IMPROVEMENTS

### Change 1: Payment Frequency Error

```diff
  'Fréquence de paiement': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Fréquence de paiement requise' };
    }
    const normalized = val.trim().toUpperCase();
    const validValues = [
      'MONTHLY', 'MENSUEL',
      'WEEKLY', 'HEBDOMADAIRE', 'HEBDO',
      'BIWEEKLY', 'QUINZAINE', 'BIHEBDO',
      'DAILY', 'JOURNALIER',
    ];
    if (!validValues.includes(normalized)) {
-     return { valid: false, message: 'Fréquence invalide. Utilisez: MONTHLY, WEEKLY, BIWEEKLY, ou DAILY' };
+     return { valid: false, message: 'Fréquence invalide. Écrivez l\'une de ces valeurs: MENSUEL, HEBDOMADAIRE, QUINZAINE, ou JOURNALIER' };
    }
    return { valid: true };
  },
```

### Change 2: Contract Type Error

```diff
  'Nature du contrat': (val: string) => {
    if (!val) {
      return { valid: false, message: 'Nature du contrat requise' };
    }
    const normalized = val.trim().toUpperCase();
    const validTypes = ['CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE', 'PERMANENT', 'FIXE', 'INTÉRIM', 'TEMPORAIRE', 'STAGIAIRE', 'TACHE', 'TÂCHE'];
    if (!validTypes.includes(normalized)) {
-     return { valid: false, message: 'Type de contrat invalide. Utilisez: CDI, CDD, CDDTI, INTERIM, ou STAGE' };
+     return { valid: false, message: 'Type de contrat invalide. Écrivez l\'un des types: CDI, CDD, CDDTI, INTÉRIM, ou STAGE' };
    }
    return { valid: true };
  },
```

### Change 3: Matricule Format Example

```diff
  'Matricule': (val: string) => {
    if (!val || typeof val !== 'string') {
      return { valid: false, message: 'Matricule requis' };
    }
    const cleaned = val.trim();
    if (cleaned.length < 2 || cleaned.length > 20) {
      return { valid: false, message: 'Matricule doit avoir entre 2 et 20 caractères' };
    }
    if (!/^[A-Z0-9-_]+$/i.test(cleaned)) {
-     return { valid: false, message: 'Matricule: uniquement lettres, chiffres, tirets' };
+     return { valid: false, message: 'Matricule invalide. Utilisez lettres, chiffres, tirets (ex: E001, DUPONT-01, 2024-EMP)' };
    }
    return { valid: true };
  },
```

---

## TESTING RECOMMENDATIONS

### Test with Target User (Low Digital Literacy)

1. **Scenario 1: Phone number format error**
   - Ask user: "What does this error mean?"
   - Error: "Contact doit avoir entre 8 et 15 chiffres"
   - Success: User can explain what number to use

2. **Scenario 2: Date format error**
   - Ask user: "Can you fix this error?"
   - Error: "Format de date invalide (utilisez JJ/MM/AAAA)"
   - Success: User corrects date without asking

3. **Scenario 3: 50-error file**
   - Ask user: "Can you see all errors?"
   - Current: Shows only 10
   - Success: User can access all 50

4. **Scenario 4: Salary error**
   - Ask user: "Why is this salary rejected?"
   - Current: "Salaire semble trop élevé"
   - Success: User knows the limit (50 millions)

---

## SUMMARY TABLE: BEFORE & AFTER

| Issue | Current | Improved | Effort |
|-------|---------|----------|--------|
| English values (MONTHLY vs MENSUEL) | ❌ English | ✅ French | 30 min |
| Salary ceiling explanation | ❌ "Trop élevé" | ✅ "> 50 millions FCFA" | 15 min |
| Date range too vague | ❌ "Trop ancienne" | ✅ "Après 1950" | 15 min |
| CMU length unclear | ❌ "Incomplet" | ✅ "5+ chiffres" | 15 min |
| Only 10/50 errors shown | ❌ Truncated | ✅ All visible | 2 hours |
| Errors not grouped | ❌ Linear list | ✅ By row | 2 hours |
| No encoding help | ❌ Generic error | ✅ Step-by-step | 1 hour |
| CSV format example poor | ⚠️ Minimal | ✅ Detailed | 30 min |

**Total Estimated Effort:** 8-10 hours

---

## CONCLUSION

### Overall HCI Adherence: **6/10**

**Strengths:**
- All messages in French
- Good examples for phone numbers, salaries, transport
- Country-specific legal references (SMIG, minimums)
- Clear required vs optional fields
- Friendly tone with emojis

**Weaknesses:**
- English abbreviations in French context (CRITICAL)
- Error list truncation hides 80% of errors (CRITICAL)
- No error prevention, only handling
- Vague limits without context
- Low cognitive load management (too many errors at once)
- Poor graceful degradation for encoding issues

**Alignment with HCI Principles:**
1. Zero Learning Curve: 4/10 - Some technical language remains
2. Task-Oriented Design: 6/10 - Partially aligned
3. Error Prevention: 3/10 - System finds errors, doesn't prevent them
4. Cognitive Load: 4/10 - Shows too many errors at once
5. Immediate Feedback: 7/10 - Good, but incomplete
6. Graceful Degradation: 6/10 - Reasonable, but no slow-network handling

**Next Steps:**
1. Fix critical errors (1-4 above) in next sprint
2. Redesign error display (group by row, show all)
3. Test with actual low-literacy users
4. Add encoding help text
5. Consider template sample data and hints

