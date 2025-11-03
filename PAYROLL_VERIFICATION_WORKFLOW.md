# Payroll Verification Workflow - Complete Guide

> **How verification tracking works in the calculated payroll review interface**

---

## 🎯 What is Verification?

**Verification** is the process where an HR manager reviews each employee's calculated payroll amounts to ensure everything is correct before approving payment.

Think of it as a **quality control checklist** where you mark each employee as "checked and correct" or flag issues that need attention.

---

## 📊 Verification States

Every employee in a calculated payroll run has one of **4 verification states**:

### 1. ❌ **Unverified** (Initial State)
- **What it means**: Not yet reviewed by HR manager
- **Badge color**: Gray X icon
- **When it appears**: Immediately after payroll calculation completes
- **Action needed**: HR manager needs to review this employee

### 2. ✅ **Verified** (Manually Checked)
- **What it means**: HR manager reviewed and confirmed amounts are correct
- **Badge color**: Green checkmark
- **When it appears**: After HR manager clicks "Marquer comme vérifié"
- **Action needed**: None - ready for approval

### 3. ⚠️ **Flagged** (Has Issues)
- **What it means**: System detected potential calculation errors
- **Badge color**: Orange warning triangle
- **When it appears**: When validation rules detect issues (missing OT, unusual variance, etc.)
- **Action needed**: HR manager must review and fix or confirm

### 4. 🤖 **Auto-Verified** (System Approved)
- **What it means**: System automatically verified (no issues + variance <5%)
- **Badge color**: Blue robot icon
- **When it appears**: After validation runs with no issues and low variance
- **Action needed**: None - ready for approval (but can manually review)

---

## 🔄 Complete Verification Workflow

### **Step 1: Payroll Calculated** ⏱️

When you finish calculating a payroll run:

```
Status: calculated
All employees: ❌ unverified
```

The system automatically:
1. Runs validation checks on all employees
2. Compares to previous month (if exists)
3. Flags any potential issues

### **Step 2: Automatic Validation** 🤖

The system checks for:

#### ✅ **Auto-Verification (Green Light)**
If an employee passes ALL checks:
- No missing overtime
- Variance vs last month <5%
- All deductions correct
- No unusual patterns

**Result**: Status automatically changes to 🤖 **auto_ok**

#### ⚠️ **Issue Detection (Yellow Light)**
If system finds potential problems:
- Missing overtime calculation
- Salary variance >30%
- Deduction anomalies
- Large unexpected bonuses

**Result**: Status changes to ⚠️ **flagged** + alert appears in Validation Alert Card

#### ❌ **Needs Review (Gray)**
Everything else stays as ❌ **unverified** until HR manager reviews

### **Step 3: HR Manager Review** 👤

The HR manager navigates to: `/payroll/runs/[id]`

They see:

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Statut de Révision                                   │
├─────────────────────────────────────────────────────────┤
│ ✅ Vérifiés: 5 employés                                 │
│ ⚠️ À vérifier: 2 employés (voir alertes)               │
│ 🤖 Auto-vérifiés: 8 employés                           │
│ ❌ Non vérifiés: 3 employés                            │
│                                                         │
│ Progression: 13/18 prêt pour approbation                │
└─────────────────────────────────────────────────────────┘
```

### **Step 4: Review Flagged Employees** ⚠️

If there are flagged employees, review alerts:

```
┌─────────────────────────────────────────────────────────┐
│ 🚨 Alertes de Validation                         [−]    │
├─────────────────────────────────────────────────────────┤
│ ⚠️ 2 employés nécessitent attention                     │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ⚠️ Marie Diallo - Heures sup non calculées         │ │
│ │    Attendu: 52h → 12h sup (7,632 FCFA)             │ │
│ │    Calculé: 52h → 0h sup (0 FCFA)                  │ │
│ │    [Voir détails] [Recalculer]                     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**HR Manager Actions:**
1. Click "Voir détails" → Scrolls to employee row, expands it
2. Review the overtime breakdown
3. Options:
   - **If correct**: Click "Marquer comme vérifié" → ⚠️ becomes ✅
   - **If wrong**: Click "Recalculer" → System recalculates → Check again
   - **If need to fix data**: Click "Modifier le Salaire" → Update → Recalculate

### **Step 5: Review Unverified Employees** ❌

For employees not auto-verified:

1. Click on employee row to expand
2. Review all details:
   - Salary breakdown
   - Overtime hours
   - Deductions
   - Employer costs
3. If correct, verification happens **automatically** by expanding the row
   - OR click "Marquer comme vérifié" explicitly

### **Step 6: Bulk Verification** 📦

For remaining employees that look good:

```
┌─────────────────────────────────────────────────────────┐
│ [Marquer tout comme vérifié]                            │
└─────────────────────────────────────────────────────────┘
```

Click this button to mark ALL unverified employees as ✅ **verified**

**⚠️ Warning**: Only use if you're confident all remaining employees are correct!

### **Step 7: Approve Payroll** ✅

Once enough employees are verified:

```
┌─────────────────────────────────────────────────────────┐
│ [Approuver les 15 vérifiés]                             │
└─────────────────────────────────────────────────────────┘
```

**Two approval options:**

1. **Partial Approval**: Approve only verified employees (leaves flagged/unverified pending)
2. **Full Approval**: Fix all issues → Mark all as verified → Approve entire run

---

## 🗄️ How Verification Data is Stored

### Database Table: `payroll_verification_status`

Each verification creates/updates a record:

```sql
CREATE TABLE payroll_verification_status (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  payroll_run_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  status TEXT NOT NULL,  -- 'verified', 'flagged', 'unverified', 'auto_ok'
  verified_by UUID,       -- User who verified (NULL for auto_ok)
  verified_at TIMESTAMPTZ,
  notes TEXT,            -- Optional HR manager notes
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  UNIQUE(payroll_run_id, employee_id)
);
```

### Example Data

After HR manager reviews 3 employees:

```sql
SELECT
  e.first_name || ' ' || e.last_name as employee,
  pvs.status,
  pvs.verified_by,
  pvs.verified_at,
  pvs.notes
FROM payroll_verification_status pvs
JOIN employees e ON e.id = pvs.employee_id
WHERE pvs.payroll_run_id = '446fdf88-4469-4ceb-8128-56e9d157e39b';
```

Result:
```
employee         | status      | verified_by                          | verified_at         | notes
-----------------|-------------|--------------------------------------|---------------------|-------
Marie Diallo     | verified    | user-id-123                          | 2025-11-03 10:30:00 | NULL
Koné Ibrahim     | flagged     | NULL                                 | NULL                | NULL
Yao Kouadio      | auto_ok     | NULL                                 | 2025-11-03 09:15:00 | NULL
Diallo Aminata   | unverified  | NULL                                 | NULL                | NULL
```

---

## 🔍 How the UI Shows Verification Status

### In the Employee Table

Each row shows a badge **before the employee name**:

```tsx
// PayrollEmployeeRow component (line 111)
<TableCell>
  <div className="flex items-center gap-2">
    {getVerificationBadge()}  // Shows icon based on status
    <div>
      <div className="font-medium">{item.employeeName}</div>
      <div className="text-sm text-muted-foreground">
        {item.employeeNumber}
      </div>
    </div>
  </div>
</TableCell>
```

Badge logic:
```tsx
const getVerificationBadge = () => {
  if (!verificationStatus) return null;

  switch (verificationStatus) {
    case 'verified':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'flagged':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case 'unverified':
      return <XCircle className="h-4 w-4 text-gray-400" />;
    case 'auto_ok':
      return <Bot className="h-4 w-4 text-blue-600" />;
  }
};
```

### Data Flow

```
1. Page loads → Calls tRPC endpoint
   ↓
2. api.payrollReview.getVerificationStatus.useQuery({ runId })
   ↓
3. Backend queries database
   ↓
4. Returns array of { employeeId, status, verifiedBy, verifiedAt }
   ↓
5. Component finds status for each employee
   ↓
6. Renders appropriate badge icon
```

---

## 🎬 Real-World Example

### Scenario: HR Manager Reviews November Payroll (17 Employees)

**Initial State (Just Calculated):**
```
✅ Vérifiés: 0
⚠️ À vérifier: 2  (flagged by system)
🤖 Auto-vérifiés: 10  (no issues, low variance)
❌ Non vérifiés: 5
```

**Step 1: Review Flagged Employees**

```
⚠️ Marie Diallo - Missing overtime
   - Click "Recalculer" → Now shows 7,632 FCFA OT
   - System auto-changes to ✅ verified
```

```
⚠️ Koné Ibrahim - High variance (-36%)
   - Expand row → See 8 days absent
   - Looks correct → Click "Marquer comme vérifié"
   - Changes to ✅ verified
```

**Updated Status:**
```
✅ Vérifiés: 2  (just verified)
⚠️ À vérifier: 0  (all fixed!)
🤖 Auto-vérifiés: 10
❌ Non vérifiés: 5
```

**Step 2: Quick Review of Unverified**

Click on each of 5 unverified employees:
- Expand row
- Check amounts
- (Verification happens automatically on expand)

**Updated Status:**
```
✅ Vérifiés: 7  (2 + 5 just reviewed)
⚠️ À vérifier: 0
🤖 Auto-vérifiés: 10
❌ Non vérifiés: 0
```

**Step 3: Approve**

```
[Approuver les 17 vérifiés]
```

Click → Payroll status changes to "approved" ✅

---

## 🔧 Manual Testing

### Test Verification Workflow

1. **Navigate to calculated payroll:**
   ```
   http://localhost:3000/payroll/runs/[your-run-id]
   ```

2. **Check initial state:**
   - All employees should show ❌ gray X (unverified)
   - OR 🤖 blue robot (if auto-verified)
   - OR ⚠️ orange triangle (if flagged)

3. **Click on an employee row:**
   - Row expands showing details
   - (Optional) Click "Marquer comme vérifié"

4. **Check database:**
   ```sql
   SELECT * FROM payroll_verification_status
   WHERE payroll_run_id = '[your-run-id]';
   ```
   - Should see new record with status = 'verified'

5. **Refresh page:**
   - Employee badge should now show ✅ green checkmark

6. **Check summary card:**
   - "Vérifiés: 1" should increment

### Test Bulk Verification

1. **Click "Marquer tout comme vérifié"**
2. **Check database:**
   ```sql
   SELECT status, COUNT(*)
   FROM payroll_verification_status
   WHERE payroll_run_id = '[your-run-id]'
   GROUP BY status;
   ```
   - All should be 'verified'

3. **Refresh page:**
   - All badges should be green ✅

---

## 🚨 Validation Rules (Auto-Flagging)

The system automatically flags employees for these issues:

### 1. **Missing Overtime** (Error 🔴)
```typescript
// If employee worked >40h/week but overtime_pay = 0
if (totalHours > 40 && overtimePay === 0) {
  flag({
    type: 'error',
    category: 'overtime',
    title: 'Heures supplémentaires non calculées',
    expected: calculatedOT,
    actual: 0
  });
}
```

### 2. **Unusual Variance** (Warning ⚠️)
```typescript
// If net salary differs from last month by >30%
if (Math.abs(variance) > 30) {
  flag({
    type: 'warning',
    category: 'comparison',
    title: 'Salaire inhabituel',
    description: `${variance}% vs mois dernier`
  });
}
```

### 3. **Prorata Calculation** (Info ℹ️)
```typescript
// New employee or mid-month termination
if (daysWorked < totalDaysInMonth) {
  flag({
    type: 'info',
    category: 'prorata',
    title: 'Première paie (prorata)',
    description: `Calculé sur ${daysWorked} jours`
  });
}
```

### 4. **Deduction Anomaly** (Warning ⚠️)
```typescript
// If CNPS/CMU seems incorrect
if (cnpsEmployee !== expectedCNPS) {
  flag({
    type: 'warning',
    category: 'deduction',
    title: 'Déduction CNPS inhabituelle',
    expected: expectedCNPS,
    actual: cnpsEmployee
  });
}
```

### 5. **Large Bonus** (Info ℹ️)
```typescript
// If bonuses > 2× base salary
if (totalBonuses > baseSalary * 2) {
  flag({
    type: 'info',
    category: 'bonus',
    title: 'Prime importante détectée',
    description: `${totalBonuses} FCFA (>2× salaire de base)`
  });
}
```

---

## 📱 Mobile Experience

On mobile devices (<768px):

1. **Summary shows at top:**
   ```
   ┌─────────────────────────────┐
   │ 📊 Révision: 13/18 prêt    │
   │ ⚠️ 2 alertes                │
   └─────────────────────────────┘
   ```

2. **Tap employee → Bottom sheet opens**
3. **Swipe up for full details**
4. **Tap "Marquer vérifié" button**
5. **Sheet closes, badge updates to ✅**

---

## 🎯 Best Practices

### For HR Managers:

1. **Review flagged items first** ⚠️
   - These are potential errors that need attention

2. **Trust auto-verified employees** 🤖
   - System already checked them
   - But you can still manually review if needed

3. **Expand and review unverified** ❌
   - Quick visual check of amounts
   - Automatic verification on expand

4. **Use bulk verification wisely** 📦
   - Only for employees you're confident about
   - Don't skip flagged items

5. **Add notes for unusual cases**
   - Click "Marquer vérifié" with notes
   - Helps with future audits

### For Developers:

1. **Check verification status in queries**
   ```typescript
   const verificationStatuses = await api.payrollReview.getVerificationStatus.useQuery({
     runId
   });
   ```

2. **Pass to employee rows**
   ```typescript
   <PayrollEmployeeRow
     verificationStatus={findStatus(item.employeeId)}
   />
   ```

3. **Handle loading states**
   ```typescript
   if (!verificationStatuses) {
     return <Skeleton />
   }
   ```

---

## 🔗 Related Files

- **Backend**: `/server/routers/payroll-review.ts` (lines 340-411)
- **Frontend**: `/features/payroll/components/payroll-employee-row.tsx` (lines 72-89)
- **Page Integration**: `/app/(shared)/payroll/runs/[id]/page.tsx`
- **Database Schema**: `/supabase/migrations/20251102_add_payroll_verification_tables.sql`

---

## ✅ Summary

**Verification is a 3-step process:**

1. **System Auto-Checks** → Flags issues, auto-verifies clean employees
2. **HR Manager Reviews** → Fixes flagged items, verifies remaining
3. **Approval** → Once verified, payroll can be approved for payment

**Verification states are stored in database** and shown via colored badges in the UI.

**The goal**: Catch calculation errors before payment is made!

---

**Last Updated**: 2025-11-03
**Status**: Production Ready
**Test URL**: `http://localhost:3000/payroll/runs/[id]` (status = calculated)
