# Payroll Review UI - User Guide

> **How to see and use all the new calculated payroll review features**

## 🎯 Where to Find the Features

Navigate to: **`/payroll/runs/[id]`** (any payroll run with status **"Calculé"**)

## 📊 What You Should See (In Order)

### 1. **Révision des Calculs** Section
**Location**: Right after the action buttons (Approuver/Recalculer), before the line items table

This section contains:

#### a) **Comparison Toggle** (Top Right)
```
┌─────────────────────────────────────────┐
│ Révision des Calculs                    │
│              [Affichage Normal] [📊 Comparer] │
└─────────────────────────────────────────┘
```

**What it does**:
- Click "Comparer" to load previous month's payroll data
- Shows month-over-month variance
- Disabled if no previous payroll exists

#### b) **Enhanced Summary Card**
```
┌─────────────────────────────────────────┐
│ Statut de Révision                      │
├─────────────────────────────────────────┤
│ Total Employés: 17                       │
│ ✅ Vérifiés: 11                         │
│ ⚠️ À vérifier: 3                        │
│ ❌ Non vérifiés: 2                      │
│ 🤖 Auto-vérifiés: 1                     │
│                                          │
│ Total Net: 2,450,000 FCFA               │
│ vs Mois Dernier: +125,000 (+5.4%)      │
└─────────────────────────────────────────┘
```

**What it shows**:
- Verification breakdown by status
- Total net vs previous month
- Variance percentage with trend arrow

#### c) **Validation Alert Card** (If issues detected)
```
┌─────────────────────────────────────────┐
│ 🚨 Alertes de Validation          [−]   │
├─────────────────────────────────────────┤
│ ⚠️ 3 employés nécessitent attention     │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ⚠️ Marie Diallo                     │ │
│ │    Heures sup non calculées         │ │
│ │    Attendu: 6,480 FCFA              │ │
│ │    Calculé: 0 FCFA                  │ │
│ │    [Voir détails] [Recalculer]      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Issue Types Detected**:
- 🔴 **Error**: Missing overtime, critical calculation issues
- ⚠️ **Warning**: Unusual variance >30%, deduction anomalies
- ℹ️ **Info**: Prorata calculations, large bonuses

#### d) **Quick Approval Banner**
```
┌─────────────────────────────────────────┐
│ 📊 Statut de Révision                   │
├─────────────────────────────────────────┤
│ ✅ Vérifiés: 11 employés                │
│ ⚠️ À vérifier: 3 (voir alertes)         │
│ ❌ Non vérifiés: 3                      │
│                                          │
│ [Marquer tout comme vérifié]            │
│ [Approuver les 11 vérifiés]             │
└─────────────────────────────────────────┘
```

**Actions**:
- "Marquer tout comme vérifié" - Bulk verify all employees
- "Approuver les X vérifiés" - Partial approval (only verified)

---

## 👤 Employee Row Features

### 2. **Verification Status Badges** (In Line Items Table)

Each employee row shows a status badge **before the name**:

```
┌─────────────────────────────────────────┐
│ ✅ Marie Diallo         98,069 FCFA     │  ← Verified
│ ⚠️ Koné Ibrahim         95,000 FCFA     │  ← Has alert
│ ❌ Yao Kouadio          75,000 FCFA     │  ← Not verified
│ 🤖 Diallo Aminata      150,000 FCFA     │  ← Auto-verified
└─────────────────────────────────────────┘
```

**Badge Meanings**:
- ✅ **Green CheckCircle** - Manually verified by HR manager
- ⚠️ **Orange AlertTriangle** - Has validation issues (flagged)
- ❌ **Gray XCircle** - Not yet reviewed
- 🤖 **Blue Bot** - Auto-verified (no issues + variance <5%)

**How to verify an employee**:
1. Click on the employee row to expand
2. Review details
3. Click "Marquer comme vérifié" button (appears in ValidationAlertCard)

---

### 3. **Overtime Breakdown** (In Expanded Row)

**Location**: When you expand an employee row, look for "Temps de Travail et Congés" card

```
┌─────────────────────────────────────────┐
│ Temps de Travail et Congés              │
├─────────────────────────────────────────┤
│ ⏰ Jours travaillés        22 jours     │
│ ✈️ Jours d'absence         0 jours      │
│                                          │
│ ⏱️ Heures Totales          52.0 heures  │
│ ├─ Heures normales        40.0h         │
│ ├─ Heures sup 15%          6.0h         │
│ └─ Heures sup 50%          6.0h         │
│                                          │
│ 💰 Calcul Heures Supplémentaires        │
│ ┌─────────────────────────────────────┐ │
│ │ H41-46 (15%): 6h × 480 × 1.15      │ │
│ │               = 3,312 FCFA         │ │
│ │ H47-52 (50%): 6h × 480 × 1.50      │ │
│ │               = 4,320 FCFA         │ │
│ │ ────────────────────────────────   │ │
│ │ Total HS:     7,632 FCFA           │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ [Voir heures par jour]                   │
└─────────────────────────────────────────┘
```

**What it shows**:
- Total hours with normal/overtime split
- Overtime rates (15%, 50%)
- Calculation formula breakdown
- Daily breakdown (collapsible)

**If you don't see this**:
- Check if the employee has time entries for the payroll period
- Component loads data from `getOvertimeBreakdown` tRPC endpoint

---

### 4. **Individual Recalculate Button** (In Expanded Row)

**Location**: In the action buttons row, next to "Modifier le Salaire"

```
┌─────────────────────────────────────────┐
│ [Modifier le Salaire] [Recalculer Cet Employé] │
└─────────────────────────────────────────┘
```

**How to use**:
1. Expand an employee row
2. Click "Recalculer Cet Employé"
3. System recalculates only that employee
4. Shows toast: "✅ Recalculé - 98,069 FCFA → 106,701 FCFA"
5. Table updates automatically

**When it appears**:
- Only for status = "Calculé" or "En traitement"
- Shows loading spinner while processing

---

## 🔍 Verification Status Tracking

### How Verification Status Works:

1. **Initial State** (After calculation):
   - All employees = "Non vérifié" (❌)
   - System auto-detects validation issues
   - Employees with issues = "Alerte" (⚠️)

2. **Auto-Verification**:
   - If no issues detected
   - AND variance vs previous month <5%
   - Status = "Auto-vérifié" (🤖)

3. **Manual Verification**:
   - HR manager clicks "Marquer comme vérifié"
   - Or reviews employee and validation clears
   - Status = "Vérifié" (✅)

4. **Tracking Progress**:
   - Check "Enhanced Summary Card" for counts
   - Check "Quick Approval Banner" for approval readiness
   - Each employee row shows badge

### Where Verification Data is Stored:

**Database Table**: `payroll_verification_status`

```sql
SELECT
  employee_id,
  status,
  verified_by,
  verified_at
FROM payroll_verification_status
WHERE payroll_run_id = '[your-run-id]';
```

**Via tRPC**:
```typescript
const { data: statuses } = api.payrollReview.getVerificationStatus.useQuery({
  runId: '[your-run-id]'
});
```

---

## 🐛 Troubleshooting: "I don't see the features"

### Check 1: Payroll Status
**The features ONLY appear when status = "Calculé" or "En traitement"**

```typescript
// In page.tsx line ~714:
{(status === 'calculated' || status === 'processing') && (
  <CalculatedReviewEnhancements ... />
)}
```

If status is "Brouillon", you see the draft review UI instead.

### Check 2: Browser Console Errors
Open DevTools (F12) → Console → Look for errors like:
- tRPC errors (red)
- Network errors (failed API calls)
- Component errors

### Check 3: Data Loading
Check if queries are enabled:

```typescript
// Should be enabled when run exists and status is calculated
const { data: verificationStatuses } = api.payrollReview.getVerificationStatus.useQuery(
  { runId },
  { enabled: !!run && (run.status === 'calculated' || run.status === 'processing') }
);
```

### Check 4: Previous Payroll Data
**Comparison features require a previous payroll run**

If you don't have a previous run:
- "Comparer" button will be disabled
- No variance data in Enhanced Summary Card
- Validation issues won't include comparison warnings

### Check 5: Time Entries Data
**Overtime breakdown requires time entries**

If employee has no time entries:
- Component shows: "Aucune donnée de pointage disponible"
- Only shows days worked/absent

---

## 📱 Mobile View Differences

On mobile (< 768px):
- Buttons stack vertically
- Cards take full width
- Overtime breakdown is more compact
- Daily breakdown scrolls in smaller container

---

## 🧪 Testing Checklist

### Test All Features:

1. **Navigate to calculated payroll**:
   ```
   http://localhost:3001/payroll/runs/[existing-calculated-run-id]
   ```

2. **Check "Révision des Calculs" appears** (after action buttons)

3. **Verify Enhanced Summary Card shows**:
   - Total employees count
   - Verification breakdown
   - Previous month comparison (if exists)

4. **Check Validation Alerts**:
   - Should show if issues detected
   - Click "Voir détails" → scrolls to employee
   - Click "Recalculer" → recalculates employee

5. **Check Quick Approval Banner**:
   - Shows verification counts
   - "Marquer tout comme vérifié" button works
   - "Approuver les X vérifiés" appears

6. **Expand an employee row**:
   - See verification badge (✅⚠️❌🤖)
   - See "Recalculer Cet Employé" button
   - See overtime breakdown with calculations
   - Click "Voir heures par jour" → shows daily detail

7. **Test Comparison Mode**:
   - Click "Comparer" button
   - (Future: table view switches to comparison)

---

## 🔧 Manual Testing SQL

### Check verification status data:
```sql
SELECT
  pvs.employee_id,
  pvs.status,
  e.first_name || ' ' || e.last_name as name,
  pvs.verified_at,
  pvs.notes
FROM payroll_verification_status pvs
JOIN employees e ON e.id = pvs.employee_id
WHERE pvs.payroll_run_id = '[your-run-id]'
ORDER BY pvs.status;
```

### Check validation issues:
```sql
SELECT
  pvi.employee_id,
  e.first_name || ' ' || e.last_name as name,
  pvi.issue_type,
  pvi.category,
  pvi.title,
  pvi.description,
  pvi.expected_amount,
  pvi.actual_amount
FROM payroll_validation_issues pvi
JOIN employees e ON e.id = pvi.employee_id
WHERE pvi.payroll_run_id = '[your-run-id]'
  AND pvi.resolved = false
ORDER BY pvi.issue_type;
```

---

## 📞 Support

If features are still not visible:

1. **Check Next.js logs**: `npm run dev` output in terminal
2. **Check database**: Verify tables exist and have data
3. **Check tRPC router**: Ensure `payrollReview` router is exported in `_app.ts`
4. **Check imports**: Ensure components are imported correctly
5. **Clear cache**: `rm -rf .next && npm run dev`

---

**Last Updated**: 2025-11-03
**Status**: All features implemented and ready for testing
