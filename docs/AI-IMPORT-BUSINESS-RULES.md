# AI Import - Business Rules

**Purpose:** Domain-specific rules for correctly classifying HR/payroll data in West African context

**Last updated:** 2025-11-15

---

## Overview

These business rules help the AI coordinator correctly classify compensation and HR data elements according to West African payroll practices (primarily Côte d'Ivoire and Senegal).

**Location in code:** `server/ai-import/coordinator-ai-first.ts:654-681`

---

## Active Business Rules

### Rule 1: ALL Primes, Bonus, and Gratifications are Salary Components

**Context:** In West African payroll, ALL monetary bonuses, primes, and gratifications are part of gross salary, subject to social security contributions and income tax.

**Classification:**
- ❌ **NOT** `employee_benefits` entities
- ❌ **NOT** `payroll_line_items` entities
- ✅ **ALL** are part of `employee_salaries.grossSalary` (payslip)

**What counts as salary (include in grossSalary):**

| Type | Examples | Include in grossSalary |
|------|----------|----------------------|
| **Salaire de base** | Base salary, Salaire mensuel | ✅ YES |
| **Prime de transport** | Prime transport, Indemnité transport | ✅ YES |
| **Prime d'ancienneté** | Seniority bonus | ✅ YES |
| **Prime de responsabilité** | Responsibility allowance | ✅ YES |
| **Prime de rendement** | Performance bonus | ✅ YES |
| **13ème mois** | 13th month salary | ✅ YES |
| **Bonus annuel** | Annual bonus | ✅ YES |
| **Gratification** | Gratuity, rewards | ✅ YES |
| **Prime exceptionnelle** | Exceptional/one-time bonus | ✅ YES |

**Correct handling:**

| Data format | Correct entity type | Example |
|-------------|---------------------|---------|
| Payslip with multiple salary components | **Sum ALL into `grossSalary`** | Base 450k + Transport 50k + Ancienneté 75k = `grossSalary: 575,000` |

**Important:** `payroll_line_items` is ONLY for detailed payroll history, NOT for current payslips or salary input.

**Variations to recognize (ALL go into grossSalary):**
- Prime de transport, Indemnité transport, Transport
- Prime d'ancienneté, Prime ancienneté
- Prime de responsabilité, Prime fonction
- Prime de rendement, Prime performance, Bonus performance
- 13ème mois, Treizième mois
- Bonus, Bonus annuel
- Gratification, Prime exceptionnelle
- Toute autre prime ou bonus

**Reasoning:**
ALL monetary primes/bonuses are:
- Part of gross salary calculation (salaire brut)
- Subject to CNPS/IPRES contributions
- Subject to income tax (ITS/IRPP)
- Paid in cash as part of monthly/annual compensation

**Example Excel:**
```
| Matricule | Nom          | Salaire Base | Prime Transport | Prime Ancienneté | 13ème mois | Brut Total |
|-----------|--------------|--------------|-----------------|------------------|------------|------------|
| EMP001    | Jean Kouassi | 450,000      | 50,000          | 75,000           | 500,000    | 1,075,000  |
```

**Correct AI output:**
```json
{
  "employees": [{
    "relatedEntities": {
      "payslips": [{
        "data": {
          "period": "2024-01",
          "grossSalary": 1075000,  // ✅ Base (450k) + Transport (50k) + Ancienneté (75k) + 13ème (500k)
          "netSalary": 850000
        },
        "sourceFile": "paie_janvier.xlsx",
        "sourceSheet": "Bulletins"
      }]
      // ✅ NO payrollLineItems for payslip input
      // ✅ NO employee_benefits for monetary primes/bonuses
      // payrollLineItems is ONLY for detailed payroll history
      // employee_benefits is ONLY for benefits in kind (logement, voiture)
    }
  }]
}
```

---

### Rule 2: Benefits in Kind (Avantages en Nature) ONLY

**Context:** In West African payroll, ONLY non-monetary benefits (benefits in kind) are classified as `employee_benefits`. Monetary primes/bonuses are NOT benefits.

**Classification:**
- ❌ **NOT** monetary primes/bonuses (those go in `grossSalary`)
- ✅ **ONLY** non-monetary benefits in kind (avantages en nature)

**What counts as benefits (employee_benefits):**

| Type | Examples | benefitType | Reasoning |
|------|----------|-------------|-----------|
| **Logement** | Company housing, Housing allowance | "Logement" or "Housing" | Benefit in kind |
| **Voiture** | Company car, Vehicle allowance | "Voiture" or "Car" | Benefit in kind |
| **Téléphone** | Company phone, Phone allowance | "Téléphone" | Benefit in kind |

**Decision tree:**

```
Is it money (cash, prime, bonus, gratification)?
├─ YES → Rule 1 (include in employee_salaries.grossSalary)
└─ NO ↓

Is it a benefit in kind (logement, voiture, téléphone)?
└─ YES → employee_benefits
          - Use appropriate benefitType
```

**Variations to recognize as benefits (NOT salary):**
- Logement: "Logement de fonction", "Housing allowance", "Allocation logement"
- Voiture: "Voiture de fonction", "Company car", "Vehicle allowance"
- Téléphone: "Téléphone de fonction", "Company phone"

**Reasoning:**
Benefits in kind are:
- Non-monetary advantages provided by employer
- Distinct from cash compensation
- May have different tax treatment (avantages en nature)
- NOT part of gross salary calculation

**Example Excel:**
```
| Matricule | Nom          | Logement | Voiture de fonction | Téléphone |
|-----------|--------------|----------|---------------------|-----------|
| EMP001    | Jean Kouassi | Oui      | Oui                 | Oui       |
```

**Correct AI output:**
```json
{
  "employees": [{
    "relatedEntities": {
      "benefits": [
        {
          "data": {
            "benefitType": "Logement",
            "amount": 0,  // Or specific value if provided
            "frequency": "monthly"
          },
          "sourceFile": "avantages.xlsx",
          "sourceSheet": "Benefits"
        },
        {
          "data": {
            "benefitType": "Voiture",
            "amount": 0,
            "frequency": "monthly"
          },
          "sourceFile": "avantages.xlsx",
          "sourceSheet": "Benefits"
        },
        {
          "data": {
            "benefitType": "Téléphone",
            "amount": 0,
            "frequency": "monthly"
          },
          "sourceFile": "avantages.xlsx",
          "sourceSheet": "Benefits"
        }
      ]
      // ✅ Benefits in kind ONLY (logement, voiture, téléphone)
      // ✅ NO monetary primes (those go in grossSalary)
    }
  }]
}
```

---

## Quick Reference

| Pay Component | Type | Entity Type | Field/Value |
|---------------|------|-------------|-------------|
| **Salaire de base** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Prime transport** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Prime ancienneté** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Prime responsabilité** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Prime rendement** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **13ème mois** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Bonus annuel** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Gratification** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Prime exceptionnelle** | Salary | `employee_salaries` (payslip) | Include in `grossSalary` ✅ |
| **Logement** | Benefit in kind | `employee_benefits` | `benefitType: "Logement"` ✅ |
| **Voiture de fonction** | Benefit in kind | `employee_benefits` | `benefitType: "Voiture"` ✅ |
| **Téléphone** | Benefit in kind | `employee_benefits` | `benefitType: "Téléphone"` ✅ |

**Key Rules:**
- 💰 **ALL monetary primes/bonuses** → `employee_salaries.grossSalary`
- 🏠 **Benefits in kind ONLY** (logement, voiture, téléphone) → `employee_benefits`
- 📊 **`payroll_line_items`** → ONLY for detailed payroll history, NOT for payslip input

---

## Adding New Business Rules

When adding a new rule:

1. **Identify the ambiguity**
   - What data is being misclassified?
   - What is the correct classification?
   - Why is it commonly confused?

2. **Document the rule**
   - Add to this file (section above)
   - Include variations, examples, reasoning
   - Add to quick reference table

3. **Update AI prompt**
   - Edit `server/ai-import/coordinator-ai-first.ts:650-675`
   - Add rule in **RÈGLES MÉTIER IMPORTANTES** section
   - Follow existing format

4. **Test the rule**
   - Create test Excel with edge case
   - Verify AI classifies correctly
   - Update tests if needed

**Template for new rules:**

```markdown
### Rule N: [Rule Name]

**Context:** [Why this rule exists, business context]

**Classification:**
- ❌ **NOT** [wrong entity type]
- ✅ **IS** [correct entity type]

**Variations to recognize:**
- "Variation 1"
- "Variation 2"

**Reasoning:** [Why this classification is correct]

**Example Excel:** [Sample data]

**Correct AI output:** [Expected JSON]
```

---

## Common Misclassifications (Pre-Rule)

Before these rules were added, common mistakes included:

| Data | Common Mistake | Correct | Rule |
|------|----------------|---------|------|
| Prime transport 50,000 FCFA | Created `employee_benefits` entity | Include in `employee_salaries.grossSalary` | Rule 1 |
| Prime transport 50,000 FCFA | Created `payroll_line_items` entity | Include in `employee_salaries.grossSalary` | Rule 1 |
| Prime ancienneté | Added to `grossSalary` directly | Separate `employee_benefits` entity | Rule 2 |
| Any salary component | Created `payroll_line_items` for payslip | Use `employee_salaries` (payslip entity) | Rule 1 |

---

## Testing

### Test Cases for Business Rules

**Test 1: Transport allowance in payslip**
```
Input: Payslip with "Salaire: 450,000" + "Transport: 50,000"
Expected: grossSalary = 500,000 (combined)
```

**Test 2: Transport in payslip**
```
Input: Payslip with separate "Prime transport" column
Expected: Included in employee_salaries.grossSalary
NOT: employee_benefits
NOT: payroll_line_items
```

**Test 3: Mixed primes**
```
Input: Payslip with "Prime transport", "Prime ancienneté", "Prime responsabilité"
Expected:
- Transport → Include in employee_salaries.grossSalary
- Ancienneté → employee_benefits
- Responsabilité → employee_benefits
NOT: payroll_line_items for any of these
```

**Test 4: One-time bonus**
```
Input: "Prime exceptionnelle Noël"
Expected: employee_benefits (benefitType: "Prime", frequency: "one-time")
NOT: payroll_line_items
```

---

## Integration with Validation

Post-import validation should check:

1. **No transport benefits:** Verify no `employee_benefits` with `benefitType` containing "transport"
2. **Salary components:** All transport amounts in `payroll_line_items` or included in `grossSalary`
3. **Recurring benefits:** Primes (except transport) in `employee_benefits`

**Example validation check:**

```typescript
// Validation: Transport should NOT be in benefits
const transportBenefits = aiResult.employees.flatMap(emp =>
  emp.relatedEntities.benefits?.filter(b =>
    b.data.benefitType.toLowerCase().includes('transport')
  ) || []
);

if (transportBenefits.length > 0) {
  warnings.push({
    type: 'business-rule-violation',
    severity: 'warning',
    message: `${transportBenefits.length} transport allowances incorrectly classified as benefits (should be salary component)`,
  });
}
```

---

## Country-Specific Notes

### Côte d'Ivoire
- Transport allowance is taxable and subject to CNPS
- Common variations: "Indemnité de transport", "Prime de déplacement"
- Typically 10-15% of base salary

### Sénégal
- Similar treatment to CI
- Subject to IPRES contributions
- Variations: "Allocation transport"

---

**Related docs:**
- `AI-IMPORT-IMPROVEMENT-PLAN.md` - Overall improvement strategy
- `ENTITY-DECISION-MATRIX.md` - General entity classification rules
- `coordinator-ai-first.ts:650-675` - Prompt implementation
