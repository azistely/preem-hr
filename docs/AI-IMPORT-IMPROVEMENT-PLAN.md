# AI Import Coordinator - Improvement Plan

**Created:** 2025-11-15
**Status:** Planning Phase
**Based on:** Migration best practices & entity decision framework

## Executive Summary

The current AI-first coordinator (`coordinator-ai-first.ts`) uses a **single-pass approach** where Claude Sonnet 4 does everything in one call:
- Parse Excel → Classify → Match → Link → Group

This plan proposes a **multi-phase architecture** that provides better:
- Context and decision-making guidance to the AI
- Edge case handling (totals, duplicates, contractors, mixed data)
- Data quality validation and conflict resolution
- User transparency and control

---

## Current Architecture Analysis

### ✅ Strengths

1. **Simplicity** - One AI call, minimal code complexity
2. **Employee-centric output** - Data grouped by employee (good UX)
3. **Source tracking** - Each entity tracks sourceFile + sourceSheet
4. **Structured output** - Strong Zod schemas ensure type safety
5. **Good entity coverage** - 15 entity types defined

### ❌ Weaknesses

1. **No entity decision framework** - AI must infer what is/isn't an entity
2. **No edge case detection** - Totals, subtotals, duplicates not explicitly handled
3. **Limited context** - AI doesn't know company rules, data quality thresholds, conflict resolution policy
4. **No pre-validation** - Issues only discovered after expensive AI call
5. **No multi-source reconciliation** - When same data appears in 2 files, no clear winner
6. **One-shot processing** - Can't iterate or refine based on user feedback

---

## Proposed Multi-Phase Architecture

### Phase 1: Pre-Migration Analysis (NEW)
**Goal:** Give AI context about the data BEFORE entity creation

```typescript
interface PreAnalysisResult {
  // File inventory
  files: Array<{
    fileName: string;
    sheets: Array<{
      sheetName: string;
      purpose: 'master' | 'transactional' | 'summary' | 'unknown';
      likelyEntityType: string | null;
      confidence: number;
      rowCount: number;
      hasTotals: boolean;
      hasSubtotals: boolean;
      duplicatePattern: 'none' | 'monthly' | 'per-component' | 'historical';
    }>;
  }>;

  // Detected issues
  dataQualityIssues: Array<{
    file: string;
    sheet: string;
    issue: 'missing-employee-id' | 'duplicate-employees' | 'mixed-detail-summary' | 'invalid-dates';
    severity: 'blocking' | 'warning' | 'info';
    affectedRows: number;
  }>;

  // Entity decision matrix (what AI thinks each sheet contains)
  entityClassification: Array<{
    file: string;
    sheet: string;
    entityType: string;
    isEntity: boolean;
    reason: string;
    confidence: number;
  }>;
}
```

**Implementation:**
- Small AI call with lightweight prompt (fast, cheap)
- Uses decision tree from migration best practices
- Flags edge cases for user review before full import
- User can confirm/override classifications

### Phase 2: Employee Matching & Deduplication (ENHANCED)
**Goal:** Resolve employee identity BEFORE linking entities

**Current approach:** AI does matching inline while processing entities
**Proposed:** Dedicated matching phase with clear rules

```typescript
interface EmployeeMatchingRules {
  // Priority for matching (from migration best practices)
  matchPriority: ['employeeNumber', 'cnpsNumber', 'email', 'fullName'];

  // Fuzzy matching rules
  nameNormalization: {
    ignoreAccents: boolean;
    ignoreCase: boolean;
    ignoreHyphens: boolean;
    allowReversedOrder: boolean; // "KOUASSI Jean" = "Jean KOUASSI"
  };

  // Conflict resolution
  conflictResolution: {
    multipleMatches: 'manual-review' | 'highest-confidence' | 'most-recent';
    noMatches: 'create-new' | 'reject' | 'manual-review';
  };

  // De-duplication rules
  duplicateDetection: {
    withinFile: boolean;
    acrossFiles: boolean;
    considerEmployeeIdChange: boolean; // Re-hires
  };
}
```

### Phase 3: Entity Classification & Linking (CURRENT, ENHANCED)
**Goal:** Link entities to employees with explicit edge case handling

**Enhancements to current prompt:**

1. **Entity Decision Matrix** (from best practices)
```markdown
For each row/block of data, apply this decision tree:

1. Is there a module for it in Preem HR? (check IMPORTABLE_ENTITIES list)
   → YES: Candidate entity

2. Can this occur many times (over time or per employee)?
   → YES: Likely entity or child entity

3. Does it have its own code/ID in Excel?
   → YES: Likely entity or code list

4. Is it just describing another thing (name, date, amount)?
   → YES: Attribute, not entity

5. Is it a total/difference/formula-only?
   → YES: Derived value, NOT entity

6. Is it Excel formatting (section titles, blank rows)?
   → YES: IGNORE

If still unsure → Treat as attribute, flag for manual review
```

2. **Edge Case Rules** (explicit handling)
```markdown
EDGE CASE DETECTION:

1. TOTALS & SUBTOTALS:
   - Row with "TOTAL", "SOUS-TOTAL", "Grand Total" in any column → SKIP
   - Row with empty employee ID but filled department/service → Summary row → SKIP
   - Row where numeric values are sum of previous rows → SKIP

2. DUPLICATE EMPLOYEES (same person, multiple rows):
   - One row per month → ONE employee entity, MULTIPLE payslip entities
   - One row per contract change → ONE employee, MULTIPLE contract entities
   - One row per earning type → ONE employee, MULTIPLE payroll line items

3. CONTRACTORS/INTERNS/TRAINEES:
   - Check column "Type employé", "Statut", "Catégorie"
   - If value is "Stagiaire", "Consultant", "Prestataire":
     → Create employee entity with employmentType field set accordingly
     → Flag in summary as "non-standard worker type"

4. DEPENDENTS:
   - If row has "Relationship" or "Lien de parenté" column → Dependent entity
   - If one cell contains multiple dependents (comma-separated) → SPLIT into multiple entities

5. MIXED DETAIL & SUMMARY:
   - If sheet has both employee rows AND department totals:
     → Use "employeeId/Matricule column is filled" as filter
     → Only process rows with valid employee ID

6. FREE-TEXT NOTES:
   - Column with long text like "CDD 6 mois puis CDI..." → Store as comment/notes
   - Do NOT try to extract structured entities from notes

7. HISTORICAL SNAPSHOTS vs TRANSACTIONAL:
   - If NO period/month column → Current snapshot → Employee attributes
   - If HAS period/month column → Transactional → Separate entities per period

8. DOCUMENT REFERENCES:
   - Column "Contract signed (Yes/No)" → Employee attribute
   - Column "Contract file path" → Document entity (if Preem supports employee_documents)
```

### Phase 4: Validation & Reconciliation (NEW)
**Goal:** Verify data quality before presenting to user

```typescript
interface ValidationResult {
  // Orphan detection
  orphans: {
    payslips: number;
    contracts: number;
    // ... other entity types
  };

  // Missing critical data
  missingCriticalFields: Array<{
    employeeId: string;
    employeeName: string;
    field: string;
    severity: 'blocking' | 'warning';
  }>;

  // Reconciliation checks
  reconciliation: {
    employeeCountMatch: boolean; // Excel count vs AI result
    totalSalaryMatch: boolean; // Excel totals vs sum of imported salaries
    knownDiscrepancies: Array<{
      check: string;
      expected: number;
      actual: number;
      difference: number;
      explanation: string;
    }>;
  };

  // Confidence scores
  overallConfidence: number; // 0-100
  lowConfidenceEntities: Array<{
    entityType: string;
    reason: string;
    count: number;
  }>;
}
```

---

## Detailed Improvements by Component

### 1. Enhanced AI Prompt Structure

**Current:** 1193 lines, monolithic prompt
**Proposed:** Modular prompt with sections

```typescript
function buildEnhancedAIPrompt(params: {
  // Existing
  sheetsData: SheetData[];
  existingEmployees: Employee[];
  countryCode: string;

  // NEW - Pre-analysis results
  preAnalysis?: PreAnalysisResult;

  // NEW - Company context
  companyContext?: {
    legalEntities: string[];
    departments: string[];
    contractTypes: string[];
    identifierPriority: ('employeeNumber' | 'cnpsNumber' | 'email')[];
  };

  // NEW - Migration policy
  migrationPolicy?: {
    scope: 'active-only' | 'active-and-terminated' | 'all';
    historyDepth: 'all' | 'last-3-years' | 'current-only';
    conflictResolution: 'first-file-wins' | 'manual-review' | 'most-recent';
    qualityThresholds: {
      minRequiredFields: string[];
      allowPartialData: boolean;
    };
  };
}) {
  return `
${buildSystemContext(params)}

${buildEntityDecisionMatrix()} // NEW - Decision tree

${buildEdgeCaseRules()} // NEW - Explicit edge case handling

${buildCompanyContext(params.companyContext)} // NEW - Company rules

${buildMigrationPolicy(params.migrationPolicy)} // NEW - Policy rules

${buildExcelData(params.sheetsData)}

${buildExistingEmployees(params.existingEmployees)}

${buildPreAnalysisResults(params.preAnalysis)} // NEW - Context from pre-analysis

${buildOutputInstructions()}
  `;
}
```

### 2. Source Authority & Conflict Resolution

**Problem:** When same employee data appears in 2 files, which wins?

**Solution:** Explicit priority system

```typescript
interface SourcePriority {
  // User-defined priority per data type
  employeeBasicInfo: {
    authoritative: string; // e.g., "employee_master.xlsx"
    fallback: string[];
  };

  salaryInfo: {
    authoritative: string; // e.g., "payroll_history.xlsx"
    fallback: string[];
  };

  contractInfo: {
    authoritative: string;
    fallback: string[];
  };

  // Conflict resolution rules
  onConflict: {
    strategy: 'authoritative-wins' | 'most-recent' | 'manual-review';
    logConflicts: boolean;
  };
}
```

**AI Prompt Addition:**
```markdown
**SOURCE PRIORITY & CONFLICT RESOLUTION:**

When the same employee appears in multiple files:

1. Basic employee info (name, ID, hire date):
   - PRIMARY SOURCE: "employee_master.xlsx"
   - Only use other files if employee not found in primary

2. Salary/payroll data:
   - PRIMARY SOURCE: "payroll_2024.xlsx"
   - Ignore salary columns in "employee_master.xlsx"

3. When data conflicts between sources:
   - Use value from PRIMARY source
   - Log conflict in processing notes
   - Example: If hire date is "2020-01-15" in master but "2020-02-01" in contracts
     → Use "2020-01-15" (master is authoritative)
     → Add note: "Conflict: hire date differs between master and contracts"
```

### 3. Data Quality Pre-Validation

**Before AI call, run fast checks:**

```typescript
function preValidateExcelData(sheetsData: SheetData[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const sheet of sheetsData) {
    // Check 1: Detect total rows
    const totalRows = sheet.data.filter(row =>
      Object.values(row).some(v =>
        String(v).match(/^(TOTAL|SOUS.?TOTAL|Grand Total)/i)
      )
    );
    if (totalRows.length > 0) {
      issues.push({
        type: 'total-rows-detected',
        severity: 'info',
        file: sheet.fileName,
        sheet: sheet.sheetName,
        count: totalRows.length,
        action: 'Will be automatically skipped',
      });
    }

    // Check 2: Missing employee identifiers
    const noIdRows = sheet.data.filter(row =>
      !row.matricule && !row.employeeNumber && !row.employeeId
    );
    if (noIdRows.length > 10) { // More than 10% missing
      issues.push({
        type: 'missing-employee-ids',
        severity: 'warning',
        file: sheet.fileName,
        sheet: sheet.sheetName,
        count: noIdRows.length,
        action: 'These rows may be rejected or require manual review',
      });
    }

    // Check 3: Date format issues
    const dateColumns = sheet.columns.filter(c =>
      c.match(/date|période|period/i)
    );
    for (const col of dateColumns) {
      const invalidDates = sheet.data.filter(row => {
        const val = row[col];
        return val && !isValidDate(val);
      });
      if (invalidDates.length > 0) {
        issues.push({
          type: 'invalid-date-format',
          severity: 'warning',
          file: sheet.fileName,
          sheet: sheet.sheetName,
          column: col,
          count: invalidDates.length,
          sample: invalidDates.slice(0, 3).map(r => r[col]),
        });
      }
    }

    // Check 4: Duplicate employee rows (same ID, multiple times)
    const employeeIds = sheet.data
      .map(r => r.matricule || r.employeeNumber)
      .filter(Boolean);
    const duplicates = employeeIds.filter((id, idx) =>
      employeeIds.indexOf(id) !== idx
    );
    if (duplicates.length > 0) {
      issues.push({
        type: 'duplicate-employees-detected',
        severity: 'info',
        file: sheet.fileName,
        sheet: sheet.sheetName,
        count: duplicates.length,
        pattern: detectDuplicatePattern(sheet.data), // monthly, per-component, etc.
        action: 'Will attempt to create multiple related entities per employee',
      });
    }
  }

  return issues;
}
```

### 4. Post-Import Validation & Reconciliation

**After AI returns result, verify:**

```typescript
function postValidateImportResult(
  aiResult: AIImportResult,
  originalData: SheetData[]
): ReconciliationReport {

  const report: ReconciliationReport = {
    checks: [],
    passed: true,
  };

  // Check 1: Employee count reconciliation
  const totalEmployeesInExcel = countUniqueEmployees(originalData);
  const totalInResult = aiResult.summary.totalEmployees;
  report.checks.push({
    name: 'Employee Count',
    expected: totalEmployeesInExcel,
    actual: totalInResult,
    passed: totalEmployeesInExcel === totalInResult,
    notes: totalEmployeesInExcel !== totalInResult
      ? `Difference: ${totalInResult - totalEmployeesInExcel}. Check for duplicates or missing employees.`
      : undefined,
  });

  // Check 2: Salary totals (if payroll data)
  const excelSalaryTotal = sumAllSalaries(originalData);
  const resultSalaryTotal = aiResult.employees.reduce((sum, emp) =>
    sum + (emp.relatedEntities.payslips?.reduce((s, p) => s + p.data.grossSalary, 0) || 0),
    0
  );
  if (excelSalaryTotal > 0) {
    const diff = Math.abs(excelSalaryTotal - resultSalaryTotal);
    const tolerance = excelSalaryTotal * 0.01; // 1% tolerance
    report.checks.push({
      name: 'Total Gross Salary',
      expected: excelSalaryTotal,
      actual: resultSalaryTotal,
      passed: diff < tolerance,
      notes: diff >= tolerance
        ? `Significant difference: ${diff.toLocaleString()} FCFA. Verify payslip matching.`
        : undefined,
    });
  }

  // Check 3: Orphan rate
  const orphanRate = aiResult.summary.rejectedEntities / aiResult.summary.totalEntities;
  report.checks.push({
    name: 'Entity Link Success Rate',
    expected: '> 90%',
    actual: `${((1 - orphanRate) * 100).toFixed(1)}%`,
    passed: orphanRate < 0.1,
    notes: orphanRate >= 0.1
      ? `High orphan rate (${(orphanRate * 100).toFixed(1)}%). Review employee matching rules.`
      : undefined,
  });

  report.passed = report.checks.every(c => c.passed);

  return report;
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create entity decision matrix document
- [ ] Define edge case detection rules
- [ ] Create data quality pre-validation function
- [ ] Add validation result types

### Phase 2: Enhanced Prompt (Week 1-2)
- [ ] Refactor prompt into modular sections
- [ ] Add entity decision tree to prompt
- [ ] Add explicit edge case rules
- [ ] Add source priority instructions
- [ ] Add company context section

### Phase 3: Pre-Analysis (Week 2)
- [ ] Create lightweight pre-analysis AI call
- [ ] Implement sheet classification logic
- [ ] Add data quality issue detection
- [ ] Create user review UI for pre-analysis results

### Phase 4: Validation & Reconciliation (Week 3)
- [ ] Implement post-import validation
- [ ] Add reconciliation checks (counts, totals)
- [ ] Create validation report UI
- [ ] Add confidence scoring

### Phase 5: User Feedback Loop (Week 3-4)
- [ ] Allow user to override entity classifications
- [ ] Add source priority configuration UI
- [ ] Implement iterative refinement (re-run with user corrections)
- [ ] Add decision log export

### Phase 6: Testing & Refinement (Week 4)
- [ ] Test with real customer Excel files
- [ ] Measure accuracy vs current approach
- [ ] Optimize AI token usage
- [ ] Document known limitations

---

## Success Metrics

### Data Quality
- **Entity link success rate:** > 95% (currently unknown, likely 80-90%)
- **Employee matching accuracy:** > 98% (exact + fuzzy matches)
- **Edge case detection:** 100% of totals/subtotals correctly ignored

### User Experience
- **User review time:** < 5 minutes for pre-analysis confirmation
- **Import confidence:** > 90% (AI confidence score)
- **Manual corrections needed:** < 5% of entities

### Performance
- **Total import time:** < 3 minutes for 500 employees + 5,000 entities
- **Pre-analysis time:** < 30 seconds
- **Token cost:** < $2 per import (with pre-filtering and validation)

---

## Key Decisions Needed

### 1. Multi-Pass vs Enhanced Single-Pass?
**Option A (Multi-Pass):**
- Pre-analysis → User review → Full import → Validation
- Pros: More control, better edge case handling
- Cons: More complex, longer total time

**Option B (Enhanced Single-Pass):**
- Keep one AI call, but with much better prompt
- Pros: Simpler, faster
- Cons: Less user control, harder to debug

**Recommendation:** Start with **Option B** (enhanced prompt), add pre-analysis later if needed

### 2. How Much User Input?
**Spectrum:**
- **Fully automated:** AI decides everything, user only reviews final result
- **Guided:** User confirms pre-analysis, AI does import
- **Collaborative:** User provides context (source priority, company rules) upfront

**Recommendation:** **Guided** approach - User confirms sheet classifications in pre-analysis phase

### 3. Conflict Resolution Strategy?
**Options:**
- **Authoritative source:** User defines which file is "truth" per data type
- **Most recent:** Use latest data when conflicts occur
- **Manual review:** Flag all conflicts for user decision

**Recommendation:** **Authoritative source** with fallback to most recent

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize improvements** (what delivers most value first?)
3. **Start with enhanced prompt** (low effort, high impact)
4. **Test with real data** to measure current accuracy baseline
5. **Iterate based on results**

---

## Appendix: Entity Decision Matrix Reference

| Question | If YES | If NO | Examples |
|----------|--------|-------|----------|
| Does Preem HR have a module for this? | → Candidate entity | → Likely attribute | Employee, Contract, Payslip |
| Can multiple instances exist (per employee or over time)? | → Likely entity | → Likely attribute | Payslips (many per employee), First name (one per employee) |
| Does it have its own ID/code? | → Likely entity | → Likely attribute | Department code, Leave request ID |
| Is it just describing another entity? | → Attribute | → Could be entity | Employee's email (attribute), Employee's contract (entity) |
| Is it a calculation/formula? | → Derived, NOT entity | → Could be entity | Age (derived), Base salary (entity field) |
| Is it Excel formatting? | → IGNORE | → Process | "TOTAL" row, merged cells |

**Default rule:** When unsure → Treat as attribute, flag for review, document assumption
