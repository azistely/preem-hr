# Entity Decision Matrix for AI Import

**Purpose:** Clear rules for determining what is an entity vs attribute vs derived value vs noise

**Target Audience:** AI coordinator, developers, data migration specialists

---

## Quick Decision Tree

For any "thing" found in Excel data, ask these questions **in order**:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Is this Excel formatting/structure?                     │
│    (Blank rows, merged cells, colors, section headers)     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ❌ IGNORE (not data)
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Is this a total/subtotal/aggregation?                   │
│    (Row with "TOTAL", "SOUS-TOTAL", formulas only)         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ❌ IGNORE (not entity)
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Is this a calculated/derived value?                     │
│    (Age, tenure, YTD totals, percentages, differences)     │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ❌ NOT ENTITY (may store as attribute if useful)
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Does Preem HR have a module/table for this?             │
│    (Check IMPORTABLE_ENTITIES list)                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ✅ CANDIDATE ENTITY
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Can multiple instances exist per employee or over time? │
│    (Many contracts, many payslips, many leaves)            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ✅ LIKELY ENTITY (child entity)
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Does it have its own identifier or code?                │
│    (Department code, job code, benefit plan code)          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ✅ LIKELY ENTITY (or reference data)
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Is it reused across many employees?                     │
│    (Same department, same job, same benefit plan)          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─ YES → ✅ ENTITY (or code list)
                   │
                   └─ NO ↓
┌─────────────────────────────────────────────────────────────┐
│ DEFAULT: Treat as ATTRIBUTE of parent entity               │
│ Example: Employee's email, contract's base salary          │
└─────────────────────────────────────────────────────────────┘
```

---

## Classification Reference Table

| Category | Is Entity? | Action | Examples |
|----------|-----------|---------|----------|
| **Excel structure** | ❌ No | Ignore | Blank rows, merged cells, cell colors, borders |
| **Section headers** | ❌ No | Ignore | "DÉPARTEMENT RH", "SERVICE INFORMATIQUE" (when used as grouping header) |
| **Total rows** | ❌ No | Ignore | "TOTAL GÉNÉRAL", "SOUS-TOTAL PAR SERVICE", rows with SUM formulas |
| **Calculated values** | ❌ No | Skip or store as attribute | Age (from birth date), tenure (from hire date), YTD totals |
| **Preem HR entities** | ✅ Yes | Import as entity | Employee, Contract, Payslip, Leave, Benefit, Department, Job |
| **Child entities** | ✅ Yes | Import as related entity | Multiple contracts per employee, multiple payslips per employee |
| **Reference data** | ✅ Yes | Import as entity or code list | Department, Job, Benefit Plan, Location |
| **Attributes** | ❌ No | Store as field on parent entity | Employee's first name, email, phone; Contract's base salary |
| **Free text notes** | ⚠️ Maybe | Store as comment/notes field | Long text fields with mixed info; don't extract structured data unless explicitly requested |
| **Document references** | ✅ Yes (if supported) | Import as Document entity | File paths, document numbers, contract signed flag |

---

## Edge Case Rules

### 1. Totals & Subtotals

**Detection patterns:**
- Row contains text matching: `TOTAL|SOUS.?TOTAL|Grand Total|Somme|Sum`
- Employee ID column is empty but numeric columns are filled
- Numeric values are formulas (SUM, AVERAGE, etc.)
- Row appears after a group of detail rows

**Action:** ❌ **SKIP** - Do not create entities

**Example:**
```
| Employee ID | Name          | Salary   |
|-------------|---------------|----------|
| EMP001      | Jean Kouassi  | 500,000  |
| EMP002      | Marie Traoré  | 450,000  |
| TOTAL       |               | 950,000  | ← SKIP THIS ROW
```

### 2. Duplicate Employees (Same Person, Multiple Rows)

**Patterns & Actions:**

| Pattern | Example | Entity Structure |
|---------|---------|------------------|
| **One row per month** | Payroll history with 12 rows for same employee | ✅ 1 Employee + 12 Payslip entities |
| **One row per contract change** | Promotions, transfers, salary increases | ✅ 1 Employee + N Contract/Assignment entities |
| **One row per earning type** | Base salary row, bonus row, allowance row | ✅ 1 Employee + N Payroll Line Item entities |
| **One row per dependent** | Multiple children listed | ✅ 1 Employee + N Dependent entities |

**Key rule:** Multiple rows for same employee ≠ duplicate employees. It means multiple **related entities**.

### 3. Contractors, Interns, Trainees

**Detection:**
- Column "Type employé", "Statut", "Catégorie" contains: `Stagiaire|Consultant|Prestataire|Apprenti|CDD`
- CNPS number format differs (contractors may not have CNPS)

**Action:** ✅ **CREATE EMPLOYEE ENTITY** with `employmentType` field set accordingly

**Important:**
- Treat as employees for data structure purposes
- Flag in summary as "non-standard worker type"
- User can decide later if they want to filter/exclude

### 4. Dependents (Spouse, Children)

**Pattern 1: One row per dependent**
```
| Employee ID | Dependent Name | Relationship | Birth Date  |
|-------------|----------------|--------------|-------------|
| EMP001      | Aminata        | Spouse       | 1985-06-15  |
| EMP001      | Ibrahim        | Child        | 2010-09-20  |
```
**Action:** ✅ 1 Employee + 2 Dependent entities

**Pattern 2: Comma-separated in one cell**
```
| Employee ID | Dependents                                      |
|-------------|-------------------------------------------------|
| EMP001      | Spouse: Aminata, 1985; Child: Ibrahim, 2010    |
```
**Action:** ⚠️ **SPLIT** into 2 Dependent entities if Preem supports `employee_dependents` table

**Pattern 3: Just a count**
```
| Employee ID | Number of Children |
|-------------|--------------------|
| EMP001      | 2                  |
```
**Action:** ❌ Store as Employee attribute (for family deduction calculations)

### 5. Mixed Detail & Summary in Same Sheet

**Example:**
```
| Employee ID | Name          | Salary   | Department |
|-------------|---------------|----------|------------|
| EMP001      | Jean Kouassi  | 500,000  | IT         |
| EMP002      | Marie Traoré  | 450,000  | IT         |
|             |               |          |            | ← Blank separator
|             | IT Dept Total | 950,000  |            | ← Summary row
|             | HR Dept Total | 1,200,000|            |
|             | GRAND TOTAL   | 2,150,000|            |
```

**Detection rule:**
- Rows with **empty Employee ID** but **filled Department or summary label** → Summary rows

**Action:**
- ✅ Process rows with valid Employee ID
- ❌ Skip rows with empty Employee ID

### 6. Historical Snapshots vs Transactional Records

**Snapshot (one row per employee, current state only):**
```
| Employee ID | Name         | Current Salary | YTD Gross |
|-------------|--------------|----------------|-----------|
| EMP001      | Jean Kouassi | 500,000        | 5,000,000 |
```
**Action:** ✅ Employee entity with current attributes (salary, YTD stored as attributes)

**Transactional (multiple rows per employee, time-series):**
```
| Employee ID | Name         | Period  | Gross Salary |
|-------------|--------------|---------|--------------|
| EMP001      | Jean Kouassi | 2024-01 | 500,000      |
| EMP001      | Jean Kouassi | 2024-02 | 500,000      |
```
**Action:** ✅ 1 Employee + 2 Payslip entities (separate record per period)

**Detection:**
- If sheet has `Period`, `Month`, `Date`, `Year-Month` column → **Transactional**
- If no time dimension → **Snapshot**

### 7. Free-Text Notes & Comments

**Example:**
```
| Employee ID | Notes                                                                    |
|-------------|--------------------------------------------------------------------------|
| EMP001      | CDD 6 mois puis CDI au 01/01/2024; prime exceptionnelle mars; mutation Abidjan juin |
```

**Action:**
- ❌ **DO NOT** try to extract structured entities from free text (too error-prone)
- ✅ Store entire text in Employee's `notes` or `comments` field
- ⚠️ Flag for **manual review** if user wants to extract contracts/events

### 8. Document Management References

**Pattern 1: Yes/No flag**
```
| Employee ID | Contract Signed | ID Card Received |
|-------------|-----------------|------------------|
| EMP001      | Yes             | Yes              |
```
**Action:** ❌ Store as Employee boolean attributes (not Document entities)

**Pattern 2: File path or document number**
```
| Employee ID | Contract File Path                  | ID Number    |
|-------------|-------------------------------------|--------------|
| EMP001      | /docs/contracts/EMP001_CDI.pdf      | CI-123456789 |
```
**Action:**
- ✅ If Preem supports `employee_documents` → Create Document entity
- ❌ Otherwise → Store as Employee attributes

---

## Common HR Data Mapping

| Excel Data | Entity Type | Notes |
|------------|-------------|-------|
| Employee master list | `employees` | Core entity |
| Payroll history (monthly) | `employee_salaries` (payslips) | One entity per employee per period |
| Detailed pay components | `payroll_line_items` | Multiple per payslip (base, bonus, deductions) |
| Contracts | `employee_contracts` | One or more per employee (historical changes) |
| Time sheets | `time_entries` | One per employee per day/shift |
| Leave requests | `leaves` | One per leave period |
| Leave balances | `leave_balances` OR employee attribute | Depends on if Preem tracks history |
| Benefits enrollment | `employee_benefits` | Link employee to benefit plan |
| Dependents | `employee_dependents` | One per family member |
| Departments | `departments` | Reference data (reused across employees) |
| Jobs/Positions | `jobs` or `positions` | Reference data |
| Locations | `locations` or company attribute | Reference data |

---

## Validation Checklist

After applying decision matrix, verify:

- [ ] All rows with valid Employee ID have been processed
- [ ] Total/subtotal rows have been skipped
- [ ] Duplicate employee rows created multiple related entities (not duplicate employees)
- [ ] Free-text notes stored as comments (not parsed into entities)
- [ ] Calculated fields (age, tenure) not created as separate entities
- [ ] Reference data (departments, jobs) identified and imported as entities
- [ ] Document references handled appropriately (entity if supported, attribute otherwise)

---

## When in Doubt

**Default rule:** When classification is ambiguous:

1. **Treat as attribute** of the parent entity
2. **Flag for manual review** in processing notes
3. **Document the assumption** in decision log

**Example:**
```
Assumption: Column "Vehicle allowance" treated as employee attribute (not separate Benefit entity)
Reason: No benefit plan structure in Excel; single amount per employee
Review: User can create benefit plans manually later if needed
```

---

## Integration with AI Prompt

This decision matrix should be included in the AI prompt as:

```markdown
**ENTITY DECISION MATRIX:**

For each row/block of data, apply this decision tree:

1. Is it Excel formatting? → IGNORE
2. Is it a total/subtotal? → SKIP
3. Is it calculated/derived? → NOT ENTITY
4. Does Preem HR have a module for it? → ENTITY
5. Can multiple instances exist? → ENTITY
6. Does it have its own ID/code? → ENTITY
7. Is it reused across employees? → ENTITY
8. Default → ATTRIBUTE

Edge cases to handle explicitly:
- Totals: SKIP rows with "TOTAL" or empty employee ID + filled summary
- Duplicates: Same employee × N rows = 1 employee + N related entities
- Contractors: CREATE employee with employmentType flag
- Dependents: SPLIT comma-separated lists into multiple entities
- Mixed sheets: Only process rows with valid employee ID
- Snapshots vs Transactional: Check for period/date column
- Free text: Store as notes, don't parse
- Documents: Entity if Preem supports, otherwise attribute

When unsure → Treat as attribute, flag for review, document assumption
```

---

**Last updated:** 2025-11-15
**Related docs:** `AI-IMPORT-IMPROVEMENT-PLAN.md`, `server/ai-import/entity-definitions.ts`
