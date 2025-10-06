# Salary Component Formulas Guide

**Last Updated:** 2025-10-06

---

## 🧮 Overview

The salary component system supports **three types of components**:

1. **Fixed Amount** - User enters a specific amount (e.g., 25,000 FCFA for transport)
2. **Percentage** - Calculated as % of base salary (planned, not yet implemented in UI)
3. **Auto-Calculated** - System calculates based on formulas (e.g., seniority, family allowance)

---

## 📐 How Formulas Work

### Formula Storage (Metadata)

Formulas are stored in the component's **metadata** field as JSON. Example:

```json
{
  "taxTreatment": {
    "isTaxable": true,
    "includeInBrutImposable": true,
    "includeInSalaireCategoriel": true
  },
  "socialSecurityTreatment": {
    "includeInCnpsBase": true
  },
  "calculationRule": {
    "type": "auto-calculated",
    "rate": 0.02,
    "cap": 0.25
  }
}
```

### Calculation Rule Structure

```typescript
calculationRule?: {
  type: 'fixed' | 'percentage' | 'auto-calculated';
  baseAmount?: number;    // For fixed amounts
  rate?: number;          // For percentage/seniority (e.g., 0.02 = 2%)
  cap?: number;           // Maximum rate (e.g., 0.25 = 25%)
}
```

---

## 🎯 Auto-Calculated Components

### 1. Seniority Bonus (Prime d'ancienneté)

**Code:** 21
**Formula:** `baseSalary × (yearsOfService × 2%) [capped at 25%]`

**Implementation:**
```typescript
// File: lib/salary-components/component-calculator.ts

export function calculateSeniorityBonus(input: {
  baseSalary: number;
  hireDate: Date;
  currentDate?: Date;
  metadata?: CIComponentMetadata;
}): {
  yearsOfService: number;
  rate: number;
  amount: number;
  isCapped: boolean;
} {
  const ratePerYear = metadata?.calculationRule?.rate ?? 0.02; // 2% per year
  const maxRate = metadata?.calculationRule?.cap ?? 0.25;      // Max 25%

  const yearsOfService = Math.floor(
    (currentDate - hireDate) / millisecondsPerYear
  );

  const calculatedRate = yearsOfService * ratePerYear;
  const rate = Math.min(calculatedRate, maxRate);
  const amount = Math.round(baseSalary * rate);

  return { yearsOfService, rate, amount, isCapped: calculatedRate > maxRate };
}
```

**Example:**
- Base Salary: 300,000 FCFA
- Hire Date: 2018-01-01
- Current Date: 2025-10-06
- Years of Service: 7 years
- Rate: 7 × 2% = 14%
- **Amount: 300,000 × 0.14 = 42,000 FCFA**

**Auto-Injection Rules:**
- Only injected if employee has **>= 1 year** of service
- Recalculated on each payroll run (uses current date)
- Amount updates automatically as years increase

---

### 2. Family Allowance (Allocations familiales)

**Code:** 41
**Formula:** `4,200 FCFA × numberOfDependents [max 6 dependents]`

**Implementation:**
```typescript
export function calculateFamilyAllowance(input: {
  numberOfDependents: number;
  countryCode: string;
  baseSalary?: number;
}): number {
  const ratePerDependent = 4200; // CI standard
  const maxDependents = 6;

  const allowedDependents = Math.min(numberOfDependents, maxDependents);
  return allowedDependents * ratePerDependent;
}
```

**Example:**
- Tax Dependents: 3
- Rate per Dependent: 4,200 FCFA
- **Amount: 3 × 4,200 = 12,600 FCFA**

**Auto-Injection Rules:**
- Only injected if `taxDependents > 0`
- Recalculated when employee updates dependent count
- Fixed rate (no base salary dependency)

---

## 🔄 When Formulas Are Calculated

### During Employee Hire

```typescript
// File: features/employees/services/employee.service.ts

const components: SalaryComponentInstance[] = [
  // Base salary (user input)
  {
    code: '11',
    name: 'Salaire de base',
    amount: baseSalary,
    sourceType: 'standard',
  },

  // Auto-calculated components
  ...autoInjectCalculatedComponents({
    baseSalary,
    hireDate,
    numberOfDependents: taxDependents,
    countryCode: 'CI',
  }),
];
```

### During Payroll Run

```typescript
// File: lib/salary-components/component-reader.ts

export function getEmployeeSalaryComponents(
  salaryData: EmployeeSalary
): SalaryComponentInstance[] {
  // If using new component system
  if (salaryData.components?.length > 0) {
    return readFromComponents(salaryData.components);
  }

  // Fallback to old format
  return readFromOldFormat(salaryData);
}

// Recalculate auto-calculated components
for (const component of components) {
  if (component.metadata?.calculationRule?.type === 'auto-calculated') {
    if (component.code === '21') {
      // Recalculate seniority with current date
      const calc = calculateSeniorityBonus({
        baseSalary: getBaseComponent(components).amount,
        hireDate: employee.hireDate,
      });
      component.amount = calc.amount;
    }
  }
}
```

---

## 🛠️ Adding Custom Formula Components

### Step 1: Define Formula in Metadata

When creating a custom component, you can add a formula:

```typescript
// Example: Overtime pay (1.5× hourly rate)
const metadata: CIComponentMetadata = {
  taxTreatment: {
    isTaxable: true,
    includeInBrutImposable: true,
    includeInSalaireCategoriel: true,
  },
  socialSecurityTreatment: {
    includeInCnpsBase: true,
  },
  calculationRule: {
    type: 'percentage',
    rate: 1.5,        // 150% of base
    baseAmount: 0,    // Will be hourly rate × hours
  },
};
```

### Step 2: Implement Calculator Function

```typescript
// File: lib/salary-components/component-calculator.ts

export function calculateOvertimePay(input: {
  baseSalary: number;
  hoursWorked: number;
  metadata?: CIComponentMetadata;
}): number {
  const { baseSalary, hoursWorked, metadata } = input;

  // Standard work hours per month
  const standardHours = 173.33; // 40h/week × 52 weeks / 12 months

  // Calculate hourly rate
  const hourlyRate = baseSalary / standardHours;

  // Overtime multiplier from metadata
  const multiplier = metadata?.calculationRule?.rate ?? 1.5;

  // Calculate overtime pay
  return Math.round(hourlyRate * multiplier * hoursWorked);
}
```

### Step 3: Register in Auto-Injection

```typescript
// Add to autoInjectCalculatedComponents() function

if (enableOvertime && overtimeHours > 0) {
  components.push({
    code: 'CUSTOM_OVERTIME',
    name: 'Heures supplémentaires',
    amount: calculateOvertimePay({
      baseSalary,
      hoursWorked: overtimeHours,
      metadata: overtimeMetadata,
    }),
    sourceType: 'custom',
  });
}
```

---

## 📊 Formula Types Reference

### Fixed Amount
```typescript
{
  calculationRule: {
    type: 'fixed',
    baseAmount: 25000  // Always 25,000 FCFA
  }
}
```

**Use Cases:**
- Transport allowance (fixed amount)
- Phone allowance
- Meal vouchers

---

### Percentage
```typescript
{
  calculationRule: {
    type: 'percentage',
    rate: 0.10  // 10% of base salary
  }
}
```

**Use Cases:**
- Housing allowance (% of base)
- Performance bonus (% of base)
- Commission (% of sales)

---

### Auto-Calculated
```typescript
{
  calculationRule: {
    type: 'auto-calculated',
    rate: 0.02,    // Rate per unit (e.g., per year)
    cap: 0.25      // Maximum cap
  }
}
```

**Use Cases:**
- Seniority bonus (2% per year, max 25%)
- Family allowance (per dependent)
- Overtime (1.5× hourly rate)

---

## 🔍 Debugging Formulas

### Check Component Metadata

```sql
-- View custom component with formula
SELECT
  code,
  name,
  metadata->'calculationRule' as formula
FROM custom_salary_components
WHERE tenant_id = 'your-tenant-id'
  AND metadata->>'calculationRule' IS NOT NULL;
```

### Check Employee Components

```sql
-- View employee's components
SELECT
  e.first_name,
  e.last_name,
  s.components
FROM employees e
JOIN employee_salaries s ON e.id = s.employee_id
WHERE e.id = 'employee-id';
```

### Test Calculation

```typescript
// In browser console or test file
import { calculateSeniorityBonus } from '@/lib/salary-components/component-calculator';

const result = calculateSeniorityBonus({
  baseSalary: 300000,
  hireDate: new Date('2018-01-01'),
  currentDate: new Date('2025-10-06'),
});

console.log(result);
// {
//   yearsOfService: 7,
//   rate: 0.14,
//   amount: 42000,
//   isCapped: false
// }
```

---

## 🎓 Formula Best Practices

### 1. Store Rules in Metadata
❌ **Don't:** Hardcode formulas in calculator functions
```typescript
function calculateBonus(base: number) {
  return base * 0.10; // Hardcoded 10%
}
```

✅ **Do:** Read from metadata
```typescript
function calculateBonus(base: number, metadata: Metadata) {
  const rate = metadata.calculationRule?.rate ?? 0.10;
  return base * rate;
}
```

### 2. Use Caps for Safety
Always include a cap to prevent unrealistic amounts:
```typescript
const calculatedRate = yearsOfService * ratePerYear;
const rate = Math.min(calculatedRate, maxRate); // Cap at max
```

### 3. Round to Whole Numbers
FCFA doesn't use decimals:
```typescript
const amount = Math.round(baseSalary * rate);
```

### 4. Document Formula Logic
Add comments explaining the business rules:
```typescript
/**
 * Calculate seniority bonus (Prime d'ancienneté)
 *
 * Rules (CI):
 * - 2% of base salary per year of service
 * - Maximum 25% (12.5 years)
 * - Only for employees with >= 1 year service
 */
```

---

## 🚀 Future Enhancements

### Planned Formula Features

1. **UI for Formula Builder**
   - Visual formula editor
   - Dropdown for formula type
   - Rate and cap inputs
   - Preview calculation

2. **More Formula Types**
   - Tiered formulas (different rates by range)
   - Conditional formulas (if-then logic)
   - Multi-variable formulas (base + performance)

3. **Formula Validation**
   - Test formulas before saving
   - Dry-run mode
   - Preview with sample data

4. **Formula History**
   - Track formula changes
   - Version control
   - Effective dates for formula changes

---

## 📚 Related Documentation

- **Component Calculator:** `lib/salary-components/component-calculator.ts`
- **Component Types:** `features/employees/types/salary-components.ts`
- **Auto-Injection:** `features/employees/services/employee.service.ts`
- **Component Reader:** `lib/salary-components/component-reader.ts`

---

## ❓ FAQ

**Q: Can I change a formula after employees are hired?**
A: Yes, but it only affects future payroll calculations. Historical payslips remain unchanged.

**Q: How do I test a formula?**
A: Use the payroll calculator (`/payroll/calculator`) to test with a real employee.

**Q: Can formulas reference other components?**
A: Currently, formulas can reference base salary and employee data (hire date, dependents). Multi-component formulas are planned.

**Q: What happens if formula metadata is missing?**
A: The calculator falls back to default values (e.g., 2% for seniority, 4,200 for family allowance).

**Q: Can I create percentage-based custom components?**
A: The backend supports it, but the UI doesn't have a formula builder yet. You can edit the metadata directly in the database.

---

**Need Help?** Check the implementation in `lib/salary-components/component-calculator.ts` or refer to the type definitions in `features/employees/types/salary-components.ts`.
