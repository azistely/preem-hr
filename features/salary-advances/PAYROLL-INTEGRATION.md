# Salary Advance Payroll Integration

## Overview

The salary advance system is **fully integrated** with the payroll processing engine. Advances are automatically disbursed and repayments are automatically deducted during payroll runs.

## How It Works

### 1. **Disbursement** (Approved → Active)

When a payroll run is processed:

```typescript
// For each employee being paid:
1. Check for approved advances
2. If found, call disburseAdvance()
3. This automatically:
   - Changes status: approved → disbursed → active
   - Generates repayment schedule
   - Creates installment records
   - Adds advance amount to employee's net salary
```

**Example:**
- Employee has approved advance of 60,000 FCFA
- Payroll runs on December 31
- Advance is disbursed (added to net salary)
- Repayment schedule created: Jan, Feb, Mar (20,000 FCFA each)

### 2. **Monthly Repayment** (Active → Completed)

Each month during payroll:

```typescript
// For each employee being paid:
1. Check for pending repayment installments due this month
2. For each installment, call processRepayment()
3. This automatically:
   - Marks installment as PAID
   - Deducts amount from employee's net salary
   - Updates advance totals (totalRepaid, remainingBalance)
   - If all installments paid → status changes to COMPLETED
```

**Example:**
- Employee being paid for January 2026
- Has pending installment of 20,000 FCFA
- Deduction is automatically applied
- Net salary reduced by 20,000 FCFA
- Progress: 20,000 / 60,000 (33% repaid)

## Integration Points

### Payroll Run Calculation (`run-calculation.ts`)

**Line 540-551**: Process advances for each employee

```typescript
// Process salary advances (disbursements and repayments)
const payrollMonth = getPayrollMonth(new Date(run.periodStart), new Date(run.periodEnd));
const advanceResult = await processEmployeeAdvances(
  employee.id,
  run.tenantId,
  run.id,
  payrollMonth
);

// Calculate final net salary after advances
// Net salary = Calculated net + Disbursements - Repayments
const finalNetSalary = calculation.netSalary + advanceResult.netEffect;
```

**Line 594-601**: Store advance details in line item

```typescript
otherDeductions: {
  salaryAdvances: {
    disbursements: advanceResult.disbursementAmount,
    repayments: advanceResult.repaymentAmount,
    repaymentDetails: advanceResult.repaymentDetails,
    disbursedAdvanceIds: advanceResult.disbursedAdvanceIds,
  },
},
```

**Line 609-610**: Update net salary and total deductions

```typescript
totalDeductions: String(calculation.totalDeductions + advanceResult.repaymentAmount),
netSalary: String(finalNetSalary),
```

### Single Employee Recalculation (`recalculateSingleEmployee`)

**Line 993-1003**: Same advance processing for recalculations

```typescript
// Process salary advances (disbursements and repayments)
const payrollMonth = getPayrollMonth(new Date(run.periodStart), new Date(run.periodEnd));
const advanceResult = await processEmployeeAdvances(
  employee.id,
  run.tenantId,
  run.id,
  payrollMonth
);

// Calculate final net salary after advances
const finalNetSalary = calculation.netSalary + advanceResult.netEffect;
```

## Data Flow

```
┌──────────────────┐
│ Payroll Run      │
│ Created          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ For Each         │
│ Employee         │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ calculatePayrollV2()                     │
│ → Returns base net salary                │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ processEmployeeAdvances()                │
│ → Disburse approved advances             │
│ → Process pending repayments             │
│ → Returns: {                             │
│     disbursementAmount: number           │
│     repaymentAmount: number              │
│     netEffect: number (+ or -)           │
│   }                                      │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Calculate Final Net Salary               │
│ finalNet = baseNet + netEffect           │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Save Payroll Line Item                   │
│ - netSalary: finalNetSalary              │
│ - totalDeductions: base + repayments     │
│ - otherDeductions.salaryAdvances: {...}  │
└──────────────────────────────────────────┘
```

## Example Scenarios

### Scenario 1: Disbursement Only

**Setup:**
- Employee: Jean Kouassi
- Approved advance: 60,000 FCFA (3 months)
- Base net salary: 150,000 FCFA

**Payroll Run (December 2025):**
```
Base Net Salary:         150,000 FCFA
+ Disbursement:          +60,000 FCFA
- Repayments:                  0 FCFA
─────────────────────────────────────
Final Net Salary:        210,000 FCFA
```

**Result:**
- Advance status: approved → disbursed → active
- Repayment schedule created: Jan, Feb, Mar 2026
- Employee receives 210,000 FCFA

### Scenario 2: Repayment Only

**Setup:**
- Employee: Jean Kouassi
- Active advance: 60,000 FCFA (20,000 remaining)
- Base net salary: 150,000 FCFA
- Due installment: 20,000 FCFA

**Payroll Run (March 2026):**
```
Base Net Salary:         150,000 FCFA
+ Disbursements:               0 FCFA
- Repayment:            -20,000 FCFA
─────────────────────────────────────
Final Net Salary:        130,000 FCFA
```

**Result:**
- Advance status: active → completed
- Total repaid: 60,000 FCFA (100%)
- Employee receives 130,000 FCFA

### Scenario 3: Disbursement + Repayment (Same Month)

**Setup:**
- Employee has:
  - Approved new advance: 40,000 FCFA
  - Active old advance: 20,000 FCFA due this month
- Base net salary: 150,000 FCFA

**Payroll Run:**
```
Base Net Salary:         150,000 FCFA
+ New Disbursement:      +40,000 FCFA
- Old Repayment:         -20,000 FCFA
─────────────────────────────────────
Final Net Salary:        170,000 FCFA

Net Effect: +20,000 FCFA
```

## Payroll Line Item Structure

The salary advance details are stored in the `otherDeductions` JSONB field:

```typescript
otherDeductions: {
  salaryAdvances: {
    // Advances disbursed this payroll
    disbursements: 60000,
    disbursedAdvanceIds: ["abc-123-def"],

    // Repayments deducted this payroll
    repayments: 20000,
    repaymentDetails: [
      {
        advanceId: "xyz-789-uvw",
        installmentNumber: 2,
        amount: 20000
      }
    ]
  }
}
```

## Status Transitions

```
REQUEST → APPROVED → DISBURSED → ACTIVE → COMPLETED
          ↓
        REJECTED

          ↓
       CANCELLED
```

**Status Definitions:**
- `pending`: Awaiting HR approval
- `approved`: HR approved, waiting for disbursement
- `disbursed`: Money paid to employee (same payroll)
- `active`: Being repaid monthly
- `completed`: Fully repaid
- `rejected`: HR rejected request
- `cancelled`: Cancelled by employee/HR

## Database Updates

### During Disbursement:

1. **salary_advances table:**
   - `status`: approved → disbursed
   - `disbursementDate`: Set to current date
   - `disbursementPayrollRunId`: Set to current payroll run
   - `firstDeductionMonth`: Set (e.g., "2026-01")

2. **salary_advance_repayments table:**
   - Create N installment records (N = repayment months)
   - Each with `status: PENDING`, `dueMonth`, `plannedAmount`

### During Repayment:

1. **salary_advance_repayments table:**
   - Update installment: `status`: PENDING → PAID
   - Set `actualAmount`, `paidDate`, `payrollRunId`

2. **salary_advances table:**
   - Increment `totalRepaid`
   - Decrement `remainingBalance`
   - If all paid: `status`: active → completed, set `completedDate`

## Error Handling

The integration handles errors gracefully:

```typescript
try {
  await processRepayment(...);
} catch (error) {
  console.error(`[ADVANCE ERROR] Failed to process repayment:`, error);
  // Continue with payroll (don't block other employees)
}
```

**Recovery:**
- If a repayment fails, the installment stays `PENDING`
- It will be retried in the next payroll run
- Admin can manually mark as paid if needed

## Testing the Integration

### 1. Create and Approve an Advance

```sql
-- Check advance is approved
SELECT status, approved_amount FROM salary_advances WHERE id = '...';
```

### 2. Run Payroll

```typescript
await createPayrollRun({
  tenantId,
  countryCode: 'CI',
  periodStart: new Date('2025-12-01'),
  periodEnd: new Date('2025-12-31'),
  paymentDate: new Date('2025-12-31'),
  createdBy: userId,
});
```

### 3. Verify Disbursement

```sql
-- Check status changed and repayments created
SELECT status, disbursement_date FROM salary_advances WHERE id = '...';
SELECT * FROM salary_advance_repayments WHERE salary_advance_id = '...';

-- Check payroll line item
SELECT
  net_salary,
  total_deductions,
  other_deductions->'salaryAdvances' as advances
FROM payroll_line_items
WHERE employee_id = '...' AND payroll_run_id = '...';
```

### 4. Verify Monthly Repayment

```sql
-- Check installment marked as paid
SELECT status, paid_date FROM salary_advance_repayments
WHERE salary_advance_id = '...' AND installment_number = 1;

-- Check advance totals updated
SELECT total_repaid, remaining_balance FROM salary_advances WHERE id = '...';
```

## Performance Considerations

- **Batch Processing**: All advances are processed within the payroll transaction
- **Indexing**: Database indexes on `employeeId`, `status`, `dueMonth`
- **Limits**: Maximum 100 advances per query (pagination if needed)
- **Caching**: Policy and validation results are cached per payroll run

## Future Enhancements

Potential improvements:

1. **Partial Repayments**: Allow skipping a month if employee on leave
2. **Early Repayment**: Allow employee to pay off advance early
3. **Bulk Disbursement**: Admin UI to disburse multiple approved advances
4. **Repayment Adjustments**: Adjust installment amounts if salary changes
5. **Advance Transfers**: Transfer advance to new employer if employee changes companies

---

**Implementation Date**: January 2025
**Integration Points**:
- `features/payroll/services/run-calculation.ts` (lines 540-610, 993-1022)
- `features/payroll/services/salary-advance-integration.ts`
