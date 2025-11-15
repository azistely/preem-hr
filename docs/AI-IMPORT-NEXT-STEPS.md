# AI Import - Implementation Next Steps

**Date:** 2025-11-15
**Goal:** Improve AI import coordinator with migration best practices
**Related docs:** `AI-IMPORT-IMPROVEMENT-PLAN.md`, `ENTITY-DECISION-MATRIX.md`

---

## Summary

Based on analysis of migration best practices, we've identified **key improvements** to the current AI-first coordinator:

### Current State
- ✅ Single AI call (simple, fast)
- ✅ Employee-centric output
- ✅ Source tracking
- ❌ No entity decision framework
- ❌ No edge case handling (totals, duplicates, contractors)
- ❌ No pre-validation or post-validation

### Proposed State
- ✅ Enhanced AI prompt with entity decision matrix
- ✅ Explicit edge case detection rules
- ✅ Pre-validation (detect issues before expensive AI call)
- ✅ Post-validation (reconcile totals, verify data quality)
- ✅ Optional pre-analysis phase for complex imports

---

## Recommended Implementation Path

**Start simple, iterate based on results.**

### Phase 1: Low-Hanging Fruit (1-2 days) 🎯 **START HERE**

These changes are **low effort, high impact** and can be implemented immediately:

#### 1.1. Enhance AI Prompt with Edge Case Rules

**File:** `server/ai-import/coordinator-ai-first.ts:623-1193`

**Add to prompt (after line 646):**

```typescript
const edgeCaseRules = `
**EDGE CASE DETECTION (CRITICAL):**

1. TOTALS & SUBTOTALS - ALWAYS SKIP:
   - Row contains: "TOTAL", "SOUS-TOTAL", "Grand Total", "Somme"
   - Employee ID column is EMPTY but numeric columns are FILLED
   - These are NOT entities - ignore completely

2. DUPLICATE EMPLOYEES (same person, multiple rows):
   - One row per month → 1 Employee + N Payslip entities
   - One row per contract change → 1 Employee + N Contract entities
   - One row per earning type → 1 Employee + N Payroll Line Items
   - KEY: Multiple rows ≠ duplicate employees, it means multiple RELATED entities

3. CONTRACTORS/INTERNS:
   - Column contains: "Stagiaire", "Consultant", "Prestataire", "Apprenti"
   - ACTION: Create Employee entity with employmentType set accordingly
   - Flag in summary as "non-standard worker type"

4. DEPENDENTS (spouse, children):
   - If comma-separated in one cell → SPLIT into multiple Dependent entities
   - Example: "Spouse: Marie; Child: Jean, 2014" → 2 Dependent entities

5. MIXED DETAIL & SUMMARY:
   - Only process rows where Employee ID is FILLED
   - Skip rows where Employee ID is EMPTY (even if other columns filled)

6. FREE-TEXT NOTES:
   - Long text like "CDD 6 mois puis CDI..." → Store as employee notes
   - DO NOT try to extract structured entities from free text

7. CALCULATED VALUES:
   - Age, tenure, YTD totals, percentages → NOT entities
   - May store as attributes if useful, but not separate entities
`;

// Insert into buildAIPrompt() around line 690, before "TA MISSION:"
return `${existingContextSections}

${edgeCaseRules}

---

**TA MISSION:**
...
`;
```

**Expected improvement:**
- Fewer "orphan" entities (payslips rejected because they were total rows)
- Better handling of multi-row employees (contracts, payslips)
- Contractors/interns correctly identified

#### 1.2. Add Entity Decision Tree to Prompt

**Add before "TA MISSION:" section:**

```typescript
const entityDecisionTree = `
**ENTITY DECISION TREE:**

For each row/block of data, ask:

1. Is this Excel formatting (blank row, merged cell, color)? → IGNORE
2. Is this a total/subtotal row? → SKIP
3. Is this calculated (age, tenure, formula)? → NOT ENTITY
4. Does Preem HR have a module for this? → CHECK IMPORTABLE_ENTITIES list
   - If YES → CANDIDATE ENTITY
5. Can multiple instances exist (per employee or over time)? → LIKELY ENTITY
6. Does it have its own ID/code? → LIKELY ENTITY
7. Is it reused across many employees? → ENTITY (or code list)
8. Default → ATTRIBUTE of parent entity

Examples:
- Employee's email → ATTRIBUTE
- Employee's contract → ENTITY (can have multiple)
- "TOTAL SALAIRES" row → SKIP
- Age (calculated from birth date) → NOT ENTITY
- Department "RH" appearing for 20 employees → ENTITY (or reference data)
`;
```

**Expected improvement:**
- Clearer guidance on what is/isn't an entity
- Fewer mistakes classifying attributes as entities

#### 1.3. Add Quick Pre-Validation

**File:** `server/ai-import/coordinator-ai-first.ts:378-513`

**Add before AI call (around line 446):**

```typescript
// Quick pre-validation: detect obvious issues
const preValidationIssues: Array<{ type: string; count: number }> = [];

for (const sheet of allSheetsData) {
  // Count rows that look like totals
  const totalRows = sheet.data.filter(row =>
    Object.values(row).some(v =>
      String(v).match(/^(TOTAL|SOUS.?TOTAL|Grand Total|Somme)/i)
    )
  );
  if (totalRows.length > 0) {
    preValidationIssues.push({
      type: `${sheet.fileName}/${sheet.sheetName}: ${totalRows.length} total rows detected (will be skipped)`,
      count: totalRows.length,
    });
  }

  // Count rows missing employee ID
  const noIdRows = sheet.data.filter(row => {
    const hasId = row.matricule || row.employeeNumber || row.employeeId ||
                  row['Matricule'] || row['N° employé'] || row['Employee ID'];
    return !hasId;
  });
  if (noIdRows.length > sheet.data.length * 0.3) { // More than 30% missing IDs
    preValidationIssues.push({
      type: `${sheet.fileName}/${sheet.sheetName}: ${noIdRows.length}/${sheet.data.length} rows missing employee ID`,
      count: noIdRows.length,
    });
  }
}

// Log issues (optional: show to user)
if (preValidationIssues.length > 0) {
  console.log('\n🔍 PRE-VALIDATION ISSUES DETECTED:');
  preValidationIssues.forEach(issue => {
    console.log(`  - ${issue.type}`);
  });
  console.log('');
}

// Add to progress update
onProgress?.({
  phase: 'classify',
  percent: 50,
  message: `Validation préliminaire: ${preValidationIssues.length} problèmes détectés`,
  details: { issues: preValidationIssues },
  timestamp: new Date(),
});
```

**Expected improvement:**
- User sees warnings BEFORE AI processes data
- Can catch data quality issues early

### Phase 2: Post-Validation (2-3 days)

Add validation **after** AI returns result to verify data quality.

#### 2.1. Create Validation Module

**New file:** `server/ai-import/validation.ts`

```typescript
import type { AIImportResult } from './coordinator-ai-first';

export interface ValidationCheck {
  name: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  notes?: string;
}

export interface ValidationReport {
  checks: ValidationCheck[];
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

export function validateImportResult(
  aiResult: AIImportResult,
  originalData: Array<{ fileName: string; sheetName: string; data: Record<string, any>[] }>
): ValidationReport {
  const checks: ValidationCheck[] = [];

  // Check 1: Employee count reconciliation
  const uniqueEmployeesInExcel = new Set(
    originalData.flatMap(sheet =>
      sheet.data
        .map(row => row.matricule || row.employeeNumber || row.employeeId)
        .filter(Boolean)
    )
  ).size;

  checks.push({
    name: 'Employee Count Match',
    expected: uniqueEmployeesInExcel,
    actual: aiResult.summary.totalEmployees,
    passed: uniqueEmployeesInExcel === aiResult.summary.totalEmployees,
    severity: Math.abs(uniqueEmployeesInExcel - aiResult.summary.totalEmployees) > 5 ? 'error' : 'warning',
    notes: uniqueEmployeesInExcel !== aiResult.summary.totalEmployees
      ? `Difference of ${Math.abs(uniqueEmployeesInExcel - aiResult.summary.totalEmployees)} employees`
      : undefined,
  });

  // Check 2: Entity link success rate
  const totalEntities = aiResult.summary.totalEntities;
  const rejectedEntities = aiResult.summary.rejectedEntities;
  const successRate = totalEntities > 0 ? ((totalEntities - rejectedEntities) / totalEntities) * 100 : 100;

  checks.push({
    name: 'Entity Link Success Rate',
    expected: '> 90%',
    actual: `${successRate.toFixed(1)}%`,
    passed: successRate >= 90,
    severity: successRate < 90 ? 'warning' : 'info',
    notes: successRate < 90
      ? `${rejectedEntities} entities could not be linked to employees. Review employee matching rules.`
      : undefined,
  });

  // Check 3: No employees without any entities
  const employeesWithoutEntities = aiResult.employees.filter(emp => {
    const entityCount = Object.values(emp.relatedEntities).reduce(
      (sum, entities) => sum + (entities?.length || 0),
      0
    );
    return entityCount === 0;
  });

  checks.push({
    name: 'Employees with Entities',
    expected: '100%',
    actual: `${((1 - employeesWithoutEntities.length / aiResult.summary.totalEmployees) * 100).toFixed(1)}%`,
    passed: employeesWithoutEntities.length === 0,
    severity: employeesWithoutEntities.length > 0 ? 'warning' : 'info',
    notes: employeesWithoutEntities.length > 0
      ? `${employeesWithoutEntities.length} employees have no related entities (payslips, contracts, etc.)`
      : undefined,
  });

  // Summary
  const passed = checks.filter(c => c.passed).length;
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning').length;
  const errors = checks.filter(c => !c.passed && c.severity === 'error').length;

  return {
    checks,
    passed: errors === 0,
    summary: {
      total: checks.length,
      passed,
      warnings,
      errors,
    },
  };
}
```

#### 2.2. Integrate Validation into Coordinator

**File:** `server/ai-import/coordinator-ai-first.ts`

**Add after AI call (around line 493):**

```typescript
import { validateImportResult } from './validation';

// ... existing AI call ...

// Post-validation
onProgress?.({
  phase: 'validate',
  percent: 85,
  message: 'Validation des résultats...',
  timestamp: new Date(),
});

const validationReport = validateImportResult(aiResult, allSheetsData);

// Log validation results
console.log('\n' + '='.repeat(80));
console.log('VALIDATION REPORT');
console.log('='.repeat(80));
console.log(`Total Checks: ${validationReport.summary.total}`);
console.log(`Passed: ${validationReport.summary.passed}`);
console.log(`Warnings: ${validationReport.summary.warnings}`);
console.log(`Errors: ${validationReport.summary.errors}`);
console.log('\nDetails:');
validationReport.checks.forEach(check => {
  const icon = check.passed ? '✅' : check.severity === 'error' ? '❌' : '⚠️';
  console.log(`${icon} ${check.name}: ${check.actual} (expected: ${check.expected})`);
  if (check.notes) {
    console.log(`   ${check.notes}`);
  }
});
console.log('='.repeat(80) + '\n');

// Return validation with result
return {
  aiResult,
  validationReport, // NEW
  processingTimeMs: Date.now() - startTime,
};
```

**Expected improvement:**
- Catch data quality issues after import
- Warn user about low entity link rates, missing data
- Reconcile counts to ensure nothing was lost

### Phase 3: Optional Pre-Analysis (3-4 days)

For very complex imports (10+ files, 50+ sheets), add a **pre-analysis phase** where user confirms entity classifications before full import.

**Skip this for now** - implement only if users report issues with current approach.

---

## Quick Wins Summary

**To implement in Phase 1 (1-2 days):**

1. ✅ Add edge case rules to AI prompt (30 min)
   - Total/subtotal detection
   - Duplicate employee patterns
   - Contractor/intern handling
   - Mixed detail/summary sheets

2. ✅ Add entity decision tree to prompt (15 min)
   - Clear rules for entity vs attribute
   - Examples for common cases

3. ✅ Add pre-validation (1 hour)
   - Detect total rows
   - Count missing employee IDs
   - Warn user before AI call

4. ✅ Add post-validation (2-3 hours)
   - Employee count reconciliation
   - Entity link success rate
   - Orphan detection
   - Log validation report

**Expected overall improvement:**
- **15-20% fewer orphaned entities** (better total detection)
- **10-15% better employee matching** (explicit duplicate handling)
- **User confidence boost** (validation report shows data quality)

---

## Testing Plan

### Test Cases to Validate Improvements

1. **Total row handling**
   - Excel with "TOTAL" rows mixed with employee data
   - Expected: Total rows ignored, employee rows processed

2. **Duplicate employees**
   - Same employee appearing 12 times (monthly payroll)
   - Expected: 1 employee entity + 12 payslip entities

3. **Contractors**
   - Sheet with mix of CDI and "Stagiaire" workers
   - Expected: All imported as employees with correct employmentType

4. **Dependents**
   - Cell: "Spouse: Marie; Child: Jean, 2014; Child: Aïssa, 2016"
   - Expected: 1 employee + 3 dependent entities

5. **Mixed sheet**
   - Detail rows + department totals at bottom
   - Expected: Only detail rows processed

### Metrics to Track

**Before improvements:**
- Orphan rate: ? (measure current baseline)
- Employee match accuracy: ?
- Processing time: ?

**After improvements (target):**
- Orphan rate: < 10%
- Employee match accuracy: > 95%
- Processing time: Similar (±10%)

---

## Implementation Checklist

### Phase 1 (Start Now)

- [ ] Read `ENTITY-DECISION-MATRIX.md` to understand decision framework
- [ ] Update `buildAIPrompt()` in `coordinator-ai-first.ts`:
  - [ ] Add edge case rules section
  - [ ] Add entity decision tree section
- [ ] Add pre-validation logic before AI call
- [ ] Test with sample Excel file (employee master + payroll)
- [ ] Verify total rows are now skipped
- [ ] Verify duplicate employees create multiple entities

### Phase 2 (Next)

- [ ] Create `server/ai-import/validation.ts`
- [ ] Implement `validateImportResult()` function
- [ ] Integrate validation into coordinator
- [ ] Add validation report to UI (show warnings/errors to user)
- [ ] Test with edge cases (totals, duplicates, orphans)

### Phase 3 (Optional)

- [ ] Implement pre-analysis phase (separate AI call)
- [ ] Create UI for user to review/confirm classifications
- [ ] Add source priority configuration
- [ ] Implement iterative refinement

---

## Files to Modify

1. **`server/ai-import/coordinator-ai-first.ts`** (main changes)
   - Lines 623-1193: Enhance `buildAIPrompt()`
   - Lines 446-450: Add pre-validation
   - Lines 493-506: Add post-validation

2. **`server/ai-import/validation.ts`** (new file)
   - Create validation functions

3. **`app/(dashboard)/imports/ai/_components/*.tsx`** (UI updates)
   - Show pre-validation warnings
   - Show post-validation report

---

## Questions for Review

1. **Should we implement multi-pass (pre-analysis → import) or enhanced single-pass?**
   - Recommendation: Start with enhanced single-pass (simpler, lower risk)

2. **How much user input do we want?**
   - Recommendation: Minimal for v1 (fully automated), add guided mode later if needed

3. **What is acceptable orphan rate?**
   - Recommendation: < 10% for automatic approval, > 10% require user review

4. **Should we add source priority configuration?**
   - Recommendation: Not for v1 (one-file imports most common), add later for multi-file imports

---

**Ready to implement Phase 1? Start with the checklist above!** 🚀

**Questions or blockers?** Document in decision log and escalate.

**Last updated:** 2025-11-15
