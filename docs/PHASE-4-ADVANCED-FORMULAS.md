# Phase 4: Advanced Formula Builder

**Status:** 📋 **Planned - Not Yet Implemented**

---

## Problem Statement

Current formula system supports simple formulas only:
- ✅ Fixed amount: `1500`
- ✅ Percentage: `baseSalary × 0.2`
- ✅ Auto-calculated: Special cases (seniority, family allowance)

Many real-world components need **composite formulas**:
- ❌ `baseSalary × 0.2 + 1500` - Percentage + fixed
- ❌ `min(baseSalary × 0.3, 100000)` - Capped percentage
- ❌ `baseSalary + (yearsOfService × 5000)` - Salary + progression
- ❌ `if(category === 'A', baseSalary × 0.25, baseSalary × 0.15)` - Conditional

---

## Solution: Expression-Based Formula Engine

### 1. Update Calculation Rule Schema

**Current:**
```typescript
type CalculationRule =
  | { type: 'fixed'; baseAmount: number }
  | { type: 'percentage'; rate: number }
  | { type: 'auto-calculated'; rate: number; cap: number };
```

**Proposed:**
```typescript
type CalculationRule =
  | { type: 'fixed'; baseAmount: number }
  | { type: 'percentage'; rate: number }
  | { type: 'auto-calculated'; rate: number; cap: number }
  | { type: 'expression'; expression: string }; // NEW
```

### 2. Expression Syntax

Use safe, limited JavaScript-like expressions:

**Variables Available:**
- `baseSalary` - Employee's base salary
- `yearsOfService` - Years since hire date
- `age` - Employee age
- `category` - Employee category (A, B, C, etc.)
- `dependents` - Number of dependents

**Operators Allowed:**
- Arithmetic: `+`, `-`, `*`, `/`
- Comparison: `>`, `<`, `>=`, `<=`, `===`, `!==`
- Logical: `&&`, `||`, `!`
- Functions: `min()`, `max()`, `round()`, `ceil()`, `floor()`

**Examples:**

| Use Case | Expression |
|----------|-----------|
| 20% + 1,500 | `baseSalary * 0.2 + 1500` |
| Capped at 100k | `min(baseSalary * 0.3, 100000)` |
| Category-based | `category === 'A' ? baseSalary * 0.25 : baseSalary * 0.15` |
| Progressive | `baseSalary + (yearsOfService * 5000)` |

### 3. Formula Builder UI - Expression Mode

**New Tab in Formula Builder:**

```
┌─────────────────────────────────────────────────────────┐
│ Type de formule                                         │
│                                                         │
│ ○ Montant fixe                                         │
│ ○ Pourcentage du salaire de base                      │
│ ○ Auto-calculé (ancienneté, allocations familiales)   │
│ ● Expression personnalisée  [NOUVEAU]                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Expression de calcul                                    │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ baseSalary * 0.2 + 1500                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Variables disponibles:                                  │
│ • baseSalary - Salaire de base                         │
│ • yearsOfService - Années d'ancienneté                 │
│ • age - Âge de l'employé                              │
│ • category - Catégorie (A, B, C...)                   │
│ • dependents - Nombre de personnes à charge           │
│                                                         │
│ Fonctions disponibles:                                  │
│ • min(a, b) - Minimum de deux valeurs                 │
│ • max(a, b) - Maximum de deux valeurs                 │
│ • round(x) - Arrondi à l'entier le plus proche       │
│                                                         │
│ Exemples:                                              │
│ • baseSalary * 0.2 + 1500                             │
│ • min(baseSalary * 0.3, 100000)                       │
│ • category === 'A' ? 50000 : 25000                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Aperçu du résultat                                      │
│                                                         │
│ Salaire de base: 300,000 FCFA                          │
│ Résultat: 61,500 FCFA ✓                               │
│                                                         │
│ (300,000 × 0.2 + 1,500 = 61,500)                      │
└─────────────────────────────────────────────────────────┘
```

### 4. Expression Validator

**Security & Safety:**

```typescript
// lib/salary-components/expression-validator.ts

export function validateExpression(expression: string): ValidationResult {
  const errors: string[] = [];

  // 1. Parse expression (use mathjs or similar)
  let ast;
  try {
    ast = parse(expression);
  } catch (e) {
    return { valid: false, errors: ['Expression invalide'] };
  }

  // 2. Check for disallowed operations
  const disallowed = ['eval', 'Function', 'require', 'import'];
  for (const keyword of disallowed) {
    if (expression.includes(keyword)) {
      errors.push(`Mot-clé interdit: ${keyword}`);
    }
  }

  // 3. Validate variables
  const allowedVars = ['baseSalary', 'yearsOfService', 'age', 'category', 'dependents'];
  const usedVars = extractVariables(ast);
  for (const v of usedVars) {
    if (!allowedVars.includes(v)) {
      errors.push(`Variable inconnue: ${v}`);
    }
  }

  // 4. Validate functions
  const allowedFunctions = ['min', 'max', 'round', 'ceil', 'floor'];
  const usedFunctions = extractFunctions(ast);
  for (const f of usedFunctions) {
    if (!allowedFunctions.includes(f)) {
      errors.push(`Fonction non autorisée: ${f}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### 5. Expression Evaluator

**Safe Evaluation:**

```typescript
// lib/salary-components/expression-evaluator.ts

import { create, all } from 'mathjs';

// Create restricted math.js instance
const math = create(all);

export function evaluateExpression(
  expression: string,
  context: {
    baseSalary: number;
    yearsOfService?: number;
    age?: number;
    category?: string;
    dependents?: number;
  }
): number {
  // Validate first
  const validation = validateExpression(expression);
  if (!validation.valid) {
    throw new Error(`Invalid expression: ${validation.errors.join(', ')}`);
  }

  try {
    // Evaluate with restricted scope
    const result = math.evaluate(expression, {
      baseSalary: context.baseSalary,
      yearsOfService: context.yearsOfService ?? 0,
      age: context.age ?? 0,
      category: context.category ?? '',
      dependents: context.dependents ?? 0,
      // Allowed functions
      min: Math.min,
      max: Math.max,
      round: Math.round,
      ceil: Math.ceil,
      floor: Math.floor,
    });

    // Ensure numeric result
    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error('Expression must return a number');
    }

    return Math.round(result); // Always round to nearest FCFA
  } catch (error) {
    throw new Error(`Evaluation failed: ${error.message}`);
  }
}
```

### 6. Update Component Calculator

**Support expression formulas:**

```typescript
// lib/salary-components/component-calculator.ts

export async function calculateComponentAmount(
  component: SalaryComponent,
  employee: Employee
): Promise<number> {
  const formula = await loadFormulaMetadata({
    componentCode: component.code,
    tenantId: employee.tenantId,
    countryCode: employee.countryCode,
  });

  const rule = formula.metadata.calculationRule;

  if (!rule) return 0;

  switch (rule.type) {
    case 'fixed':
      return rule.baseAmount;

    case 'percentage':
      return employee.baseSalary * rule.rate;

    case 'auto-calculated':
      // Existing logic for seniority, family allowance
      return calculateAutoCalculated(rule, employee);

    case 'expression': // NEW
      return evaluateExpression(rule.expression, {
        baseSalary: employee.baseSalary,
        yearsOfService: calculateYearsOfService(employee.hireDate),
        age: calculateAge(employee.birthDate),
        category: employee.category,
        dependents: employee.dependents,
      });

    default:
      return 0;
  }
}
```

---

## Implementation Plan

### Step 1: Backend (Database & Services)
- [ ] Update `ComponentMetadata` type to include `expression` formula type
- [ ] Create `expression-validator.ts` service
- [ ] Create `expression-evaluator.ts` service (use mathjs)
- [ ] Update `component-calculator.ts` to support expressions
- [ ] Add tests for expression evaluation

### Step 2: UI (Formula Builder)
- [ ] Add "Expression personnalisée" tab to Formula Builder
- [ ] Create expression input with syntax highlighting (Monaco Editor?)
- [ ] Add real-time validation with error messages
- [ ] Add variable/function documentation tooltip
- [ ] Add example expressions for common use cases
- [ ] Live preview with sample calculation

### Step 3: Documentation
- [ ] Add expression syntax guide to help docs
- [ ] Create video tutorial for expression builder
- [ ] Add common formula templates (copy-paste ready)

### Step 4: Testing
- [ ] Unit tests for validator (all edge cases)
- [ ] Unit tests for evaluator (safe execution)
- [ ] Integration tests with payroll calculation
- [ ] Security audit (prevent code injection)

---

## Example Use Cases

### Transport Allowance (Tiered by Category)

**Expression:**
```javascript
category === 'A' ? 50000 :
category === 'B' ? 35000 :
category === 'C' ? 25000 : 15000
```

### Housing Allowance (20% + 1,500)

**Expression:**
```javascript
baseSalary * 0.2 + 1500
```

### Experience Bonus (Capped)

**Expression:**
```javascript
min(yearsOfService * 10000, 150000)
```

### Progressive Transport (Based on Salary)

**Expression:**
```javascript
baseSalary < 100000 ? 15000 :
baseSalary < 200000 ? 25000 :
baseSalary < 300000 ? 35000 : 50000
```

---

## Security Considerations

**Threats:**
1. Code injection (eval, Function constructor)
2. Infinite loops
3. Access to system resources
4. Performance degradation (complex expressions)

**Mitigations:**
1. ✅ Use mathjs with restricted scope (no eval)
2. ✅ Whitelist allowed variables and functions
3. ✅ Validate AST before evaluation
4. ✅ Set timeout for evaluation (prevent infinite loops)
5. ✅ Sandbox execution (no access to process, fs, etc.)
6. ✅ Rate limiting on formula saves

---

## Migration Path

**Existing components continue to work:**
- Fixed, percentage, and auto-calculated formulas unchanged
- Expression type is **additive**, not breaking change

**Gradual adoption:**
- Phase 4 is optional enhancement
- Users can mix old and new formula types
- Super admin can enable/disable expression builder per tenant

---

## Success Criteria

- [ ] Users can create composite formulas via UI
- [ ] All expressions validate before saving
- [ ] No security vulnerabilities (penetration tested)
- [ ] Expression evaluation < 10ms per component
- [ ] 90% of custom component requests use expressions (vs. support tickets)

---

## Timeline

- **Week 1-2:** Backend (validator, evaluator, tests)
- **Week 3-4:** UI (formula builder expression mode)
- **Week 5:** Testing, security audit
- **Week 6:** Documentation, rollout

**Total:** ~6 weeks for complete Phase 4 implementation
