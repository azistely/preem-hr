# Guide: Sélection de Période pour la Paie

**Date:** 2025-10-25
**Status:** ✅ Implemented

---

## Vue d'ensemble

Le système de paie de Preem HR supporte maintenant **plusieurs fréquences de paiement** pour s'adapter aux différents types d'employés :

- **Mensuel** - Employés payés une fois par mois
- **Hebdomadaire** - Employés journaliers payés chaque semaine
- **Bi-hebdomadaire** - Employés journaliers payés toutes les 2 semaines
- **Quotidien** - Employés journaliers payés chaque jour

---

## Comment Sélectionner la Bonne Période

### 📅 **Employés Mensuels**

**Quand l'utiliser:** Pour les employés avec `rateType: 'MONTHLY'`

**Boutons rapides:**
- **Mois Actuel** → Paie du 1er au dernier jour du mois en cours
- **Mois Dernier** → Paie du 1er au dernier jour du mois précédent

**Exemple:**
```
Période: 1 octobre 2025 - 31 octobre 2025
Date de paiement: 5 novembre 2025
Employés inclus: Tous les employés mensuels actifs
```

---

### 📅 **Employés Journaliers - Paiement Hebdomadaire**

**Quand l'utiliser:** Pour les employés avec `rateType: 'DAILY'` payés chaque semaine

**Boutons rapides:**
- **Semaine Actuelle** → Du lundi au dimanche de la semaine en cours
- **Semaine Dernière** → Du lundi au dimanche de la semaine précédente

**Exemple:**
```
Période: 16 décembre 2025 (lundi) - 22 décembre 2025 (dimanche)
Date de paiement: 24 décembre 2025 (2 jours après)
Employés inclus: Employés journaliers ayant des heures saisies dans cette semaine
```

**Important:** Les employés journaliers seront payés selon leurs **heures réellement travaillées**:
- Travaillé 5 jours → Payé pour 5 jours
- Travaillé 3 jours → Payé pour 3 jours

---

### 📅 **Employés Journaliers - Paiement Bi-hebdomadaire**

**Quand l'utiliser:** Pour les employés avec `rateType: 'DAILY'` payés toutes les 2 semaines

**Boutons rapides:**
- **2 Dernières Semaines** → 14 jours (2 semaines complètes du lundi au dimanche)

**Exemple:**
```
Période: 2 décembre 2025 (lundi) - 15 décembre 2025 (dimanche)
Date de paiement: 17 décembre 2025 (2 jours après)
Employés inclus: Employés journaliers ayant des heures saisies dans ces 2 semaines
```

---

### 📅 **Employés Journaliers - Paiement Quotidien**

**Quand l'utiliser:** Pour payer les employés journaliers chaque jour

**Comment faire:**
1. Ne pas utiliser les boutons rapides
2. Sélectionner manuellement **la même date** pour début et fin
3. Exemple:
   ```
   Date de début: 20 décembre 2025
   Date de fin: 20 décembre 2025
   Date de paiement: 20 décembre 2025
   ```

---

## Flux de Travail (Wizard en 3 Étapes)

### Étape 1: Sélection de Période

1. Cliquez sur un bouton rapide **OU** sélectionnez manuellement les dates
2. Vérifiez le pays (Côte d'Ivoire par défaut)
3. Ajustez la date de paiement si nécessaire
4. Cliquez "Continuer"

### Étape 2: Vérification des Employés ⚠️ **CRITIQUE**

Le système affiche:

**✅ Employés mensuels:**
- Nombre d'employés mensuels
- Status: "Prêts pour le calcul"

**⚠️ Employés journaliers:**
- Nombre d'employés journaliers
- **Avertissement si des heures sont manquantes**
- Liste des employés sans heures saisies

**Actions:**
- Si des heures manquent → Cliquez "Saisir les heures maintenant"
- Ajoutez les heures pour tous les employés concernés
- Le bouton "Continuer" sera activé uniquement quand **tous les employés journaliers ont leurs heures**

### Étape 3: Confirmation

1. Vérifiez le résumé de la paie
2. Cliquez "Créer et Calculer"
3. Vous serez redirigé vers la page de détails de la paie

---

## Exemples de Cas d'Usage

### Cas 1: Entreprise avec Employés Mensuels Uniquement

```
Action: Cliquer "Mois Actuel"
Période: 1-31 octobre 2025
Résultat: 30 employés mensuels → Tous payés pour le mois complet
```

### Cas 2: Entreprise avec Employés Mensuels + Journaliers (Paiement Hebdomadaire)

```
Action: Cliquer "Semaine Dernière"
Période: 9-15 décembre 2025 (lundi-dimanche)

Étape 2 montre:
- 25 employés mensuels → ❌ Ne seront PAS inclus (période trop courte)
- 10 employés journaliers → ✅ Payés selon heures de cette semaine
  - 5 ont leurs heures → ✅ OK
  - 5 n'ont pas d'heures → ⚠️ Avertissement

Action: Saisir les 5 heures manquantes
Résultat: 10 employés journaliers payés correctement
```

**⚠️ Note Importante:** Si vous créez une paie hebdomadaire/bi-hebdomadaire, **seuls les employés journaliers** avec des heures saisies seront payés. Les employés mensuels nécessitent une période d'au moins un mois complet.

### Cas 3: Entreprise avec Employés Mensuels + Journaliers (Paiement Mensuel pour Tous)

```
Action: Cliquer "Mois Actuel"
Période: 1-31 octobre 2025

Étape 2 montre:
- 25 employés mensuels → ✅ Payés pour octobre
- 10 employés journaliers → Payés selon leurs jours travaillés en octobre
  - Employé A: 22 jours → Payé 22 × salaire journalier
  - Employé B: 15 jours → Payé 15 × salaire journalier

Résultat: TOUS les employés payés dans la même paie
```

---

## Calcul des Salaires

### Employés Mensuels (`rateType: 'MONTHLY'`)

```typescript
Salaire brut = baseSalary + primes + indemnités
// Peu importe le nombre de jours dans le mois
```

### Employés Journaliers (`rateType: 'DAILY'`)

```typescript
Salaire brut = (baseSalary × joursEffectivementTravaillés) + primes proratisées

// Exemple:
// baseSalary = 10,000 FCFA/jour
// Travaillé 5 jours dans la semaine
// Salaire brut = 10,000 × 5 = 50,000 FCFA
```

**Le système compte automatiquement:**
- Les **jours uniques** (pas les heures totales)
- Seulement les entrées **approuvées**
- Dans la période sélectionnée

---

## Questions Fréquentes

### Q: Puis-je payer des employés mensuels et journaliers dans la même paie ?

**R:** Oui ! Sélectionnez une période mensuelle (ex: "Mois Actuel").
- Les employés mensuels seront payés pour le mois complet
- Les employés journaliers seront payés selon leurs jours travaillés dans ce mois

### Q: Que se passe-t-il si j'oublie de saisir les heures d'un employé journalier ?

**R:** L'Étape 2 du wizard affichera un **avertissement rouge** avec:
- Le nombre d'employés sans heures
- La liste des employés concernés
- Un bouton pour saisir les heures immédiatement

Vous **ne pourrez pas continuer** tant que les heures ne sont pas saisies.

### Q: Un employé journalier a travaillé 3 jours mais j'ai entré 6 entrées (matin + après-midi chaque jour). Comment sera-t-il payé ?

**R:** Le système compte les **jours uniques**, pas le nombre d'entrées:
- 6 entrées sur 3 jours différents = **3 jours**
- Salaire = `baseSalary × 3`

### Q: Puis-je créer une paie pour une période personnalisée (ex: 10-20 décembre) ?

**R:** Oui ! Ne cliquez pas sur les boutons rapides, sélectionnez manuellement:
```
Date de début: 10 décembre 2025
Date de fin: 20 décembre 2025
Date de paiement: 22 décembre 2025
```

### Q: Comment savoir si mes employés journaliers seront payés correctement ?

**R:** Étape 2 du wizard affiche clairement:
- ✅ "Tous ont leurs heures" → OK pour continuer
- ⚠️ "X sans heures saisies" → Saisir les heures avant de continuer

---

## Recommandations

### ✅ Bonnes Pratiques

1. **Saisir les heures AVANT de créer la paie**
   - Utilisez `/time-tracking` pour saisir les heures quotidiennes
   - Approuvez les heures avant de lancer la paie

2. **Utiliser les boutons rapides**
   - Plus rapide et évite les erreurs de dates
   - Calcule automatiquement la date de paiement

3. **Vérifier l'Étape 2 attentivement**
   - Ne jamais ignorer les avertissements
   - S'assurer que tous les employés ont leurs heures

### ❌ À Éviter

1. **Ne pas créer de paie hebdomadaire pour employés mensuels**
   - Les employés mensuels nécessitent une période d'au moins 1 mois

2. **Ne pas ignorer les avertissements à l'Étape 2**
   - Les employés sans heures seront payés **0 FCFA**
   - Cela causera des erreurs et des réclamations

3. **Ne pas saisir les heures après avoir créé la paie**
   - Les heures doivent être saisies AVANT
   - Si oubli → Supprimer la paie et recréer

---

## Support Technique

**Fichiers modifiés:**
- `features/payroll/services/run-calculation.ts` - Calcul des jours travaillés
- `server/routers/payroll.ts` - Endpoint de prévisualisation
- `app/(shared)/payroll/runs/new/page.tsx` - Interface wizard
- `app/(shared)/payroll/runs/new/components/employee-preview-step.tsx` - Validation

**Pour les développeurs:**
- Les employés journaliers sont identifiés par `employees.rateType = 'DAILY'`
- Le calcul utilise `calculatePayrollV2()` avec `daysWorkedThisMonth`
- Les jours sont comptés depuis `time_entries` avec `status = 'approved'`

---

**Généré par:** Claude Code
**Date:** 2025-10-25
**Version:** 1.0
