# 🏗️ Domain Models & Business Rules

## Document Overview

**Purpose:** Define business entities, validation rules, invariants, and domain logic for the Preem HR platform.

**Source of Truth:** This document defines the canonical business rules. All implementation must reference these models.

**Related Documents:**
- `03-DATABASE-SCHEMA.md` - Physical database implementation
- `01-CONSTRAINTS-AND-RULES.md` - Technical constraints
- `HCI-DESIGN-PRINCIPLES.md` - UX design principles

---

## Core Domain Concepts

### Multi-Tenancy

**Tenant** - The top-level isolation boundary
```typescript
type Tenant = {
  id: string;
  name: string;
  countryCode: string; // Primary country of operation
  status: 'active' | 'suspended' | 'trial';
  createdAt: Date;
  settings: TenantSettings;
}

type TenantSettings = {
  currency: string; // ISO 4217 (e.g., 'XOF', 'XAF')
  locale: string; // IETF language tag (e.g., 'fr-CI', 'fr-SN')
  timezone: string; // IANA timezone (e.g., 'Africa/Abidjan')
  fiscalYearStart: { month: number; day: number }; // e.g., { month: 1, day: 1 }
}
```

**Invariants:**
- ✅ Tenant ID must be UUID
- ✅ Country code must be valid ISO 3166-1 alpha-2
- ✅ Currency must match country (XOF for UEMOA countries)
- ✅ Fiscal year start must be valid date (month 1-12, day 1-31)

---

## Employee Domain

### Employee Entity

```typescript
type Employee = {
  id: string;
  tenantId: string;

  // Personal Information
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'Other';

  // Employment
  employeeNumber: string; // Unique within tenant
  hireDate: Date;
  terminationDate: Date | null;
  status: EmployeeStatus;

  // Location
  countryCode: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

type EmployeeStatus =
  | 'active'       // Currently employed
  | 'on_leave'     // Temporarily absent (long-term leave)
  | 'terminated'   // Employment ended
  | 'suspended';   // Disciplinary suspension
```

**Validation Rules:**
```typescript
const employeeValidation = {
  firstName: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[\p{L}\s'-]+$/u, // Unicode letters, spaces, hyphens, apostrophes
  },
  lastName: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[\p{L}\s'-]+$/u,
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    required: false,
  },
  phone: {
    pattern: /^\+?[0-9\s\-()]+$/, // International format
    minLength: 8,
    maxLength: 20,
    required: false,
  },
  employeeNumber: {
    minLength: 1,
    maxLength: 50,
    unique: true, // Within tenant
  },
  dateOfBirth: {
    minAge: 16, // Minimum working age (Côte d'Ivoire)
    maxAge: 100,
  },
  hireDate: {
    notFuture: true, // Cannot hire in the future
  },
  terminationDate: {
    afterHireDate: true,
    notFuture: true,
  },
};
```

**Business Invariants:**
- ✅ Termination date must be >= hire date
- ✅ Employee number must be unique within tenant
- ✅ Active employees must have no termination date
- ✅ Terminated employees must have termination date
- ✅ Age at hire must be >= 16 years (Côte d'Ivoire labor law)

---

### Employee Assignment (Position)

**Effective-dated relationship between employee and position**

```typescript
type EmployeeAssignment = {
  id: string;
  tenantId: string;
  employeeId: string;
  positionId: string;

  // Effective Dating
  effectiveFrom: Date;
  effectiveTo: Date | null; // null = current assignment

  // Contract Details
  contractType: ContractType;
  contractNumber: string;

  // Status
  status: 'active' | 'ended';

  createdAt: Date;
}

type ContractType =
  | 'CDI'  // Contrat à Durée Indéterminée (Permanent)
  | 'CDD'  // Contrat à Durée Déterminée (Fixed-term)
  | 'CTT'  // Contrat de Travail Temporaire (Temporary)
  | 'CDD_ESSAI'; // CDD with trial period
```

**Business Rules:**
- ✅ Only one active assignment per employee at any time
- ✅ New assignment must start when previous ends (no gaps)
- ✅ CDD contracts must have `effectiveTo` date (max 2 years CI law)
- ✅ CDI contracts have `effectiveTo = null` until termination
- ✅ Contract number must be unique within tenant

---

### Employee Salary

**Effective-dated salary history**

```typescript
type EmployeeSalary = {
  id: string;
  tenantId: string;
  employeeId: string;

  // Salary Details
  baseSalary: number; // Monthly gross salary
  currency: string;

  // Effective Dating
  effectiveFrom: Date;
  effectiveTo: Date | null; // null = current salary

  // Audit
  createdAt: Date;
  updatedBy: string;
}
```

**Validation Rules:**
```typescript
const salaryValidation = {
  baseSalary: {
    min: 75000, // SMIG Côte d'Ivoire (as of 2024)
    precision: 2,
    currency: 'XOF',
  },
  effectiveFrom: {
    notPast: false, // Can backdate salary changes
    notFuture: false, // Can schedule future increases
  },
};
```

**Business Invariants:**
- ✅ Base salary must be >= SMIG (country-specific minimum wage)
- ✅ Only one current salary per employee (`effectiveTo = null`)
- ✅ Salary changes must have audit trail (updatedBy)
- ✅ Currency must match employee's country

---

## Position Domain

### Position Entity

```typescript
type Position = {
  id: string;
  tenantId: string;

  // Position Details
  title: string; // e.g., "Développeur Senior"
  code: string; // Unique code within tenant
  department: Department;
  location: Location;

  // Classification
  category: EmployeeCategory;
  level: number; // 1-10 hierarchy level

  // Status
  status: 'active' | 'inactive';

  // Payroll
  workAccidentRate: number; // Sector-specific rate (e.g., 2%, 4%, 5%)

  createdAt: Date;
}

type EmployeeCategory =
  | 'CADRE'      // Management/Executive
  | 'EMPLOYE'    // Employee
  | 'OUVRIER';   // Worker

type Department = {
  id: string;
  name: string;
  code: string;
};

type Location = {
  id: string;
  name: string;
  address: string;
  city: string;
  countryCode: string;
};
```

**Business Rules:**
- ✅ Position code must be unique within tenant
- ✅ Work accident rate must be valid sector rate (2%, 4%, 5% for CI)
- ✅ Level must be 1-10
- ✅ Category determines CNPS contribution rules

---

## Time & Attendance Domain

### Leave Request

```typescript
type LeaveRequest = {
  id: string;
  tenantId: string;
  employeeId: string;

  // Leave Details
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number; // Calculated: working days between start and end

  // Approval
  status: LeaveStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;

  // Metadata
  requestedAt: Date;
  notes: string | null;
}

type LeaveType =
  | 'annual'        // Congé annuel (paid)
  | 'sick'          // Congé maladie
  | 'maternity'     // Congé maternité (14 weeks CI)
  | 'paternity'     // Congé paternité (10 days CI)
  | 'unpaid'        // Congé sans solde
  | 'compassionate' // Congé pour événement familial
  | 'other';

type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';
```

**Validation Rules:**
```typescript
const leaveValidation = {
  startDate: {
    notPast: true, // Cannot request leave in the past
  },
  endDate: {
    afterStartDate: true,
  },
  totalDays: {
    min: 0.5, // Half-day minimum
    max: 365, // 1 year maximum
  },
  annual: {
    maxPerYear: 26, // Côte d'Ivoire: 2.2 days per month = 26 days/year
  },
  maternity: {
    duration: 98, // 14 weeks = 98 days
  },
  paternity: {
    duration: 10, // 10 days CI law
  },
};
```

**Business Invariants:**
- ✅ End date must be >= start date
- ✅ Annual leave cannot exceed accrued balance
- ✅ Approved leave cannot overlap with existing approved leave
- ✅ Maternity leave must be exactly 14 weeks (CI law)
- ✅ Unpaid leave affects payroll calculation

---

## Payroll Domain

### Payroll Run

```typescript
type PayrollRun = {
  id: string;
  tenantId: string;

  // Period
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  name: string; // e.g., "Paie Janvier 2025"

  // Status
  status: PayrollStatus;

  // Totals
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalEmployerContributions: number;

  // Audit
  createdBy: string;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
}

type PayrollStatus =
  | 'draft'        // Being prepared
  | 'calculating'  // System processing
  | 'calculated'   // Ready for review
  | 'approved'     // Approved by HR
  | 'paid';        // Salaries disbursed
```

**Business Rules:**
- ✅ Period must be complete month (start = 1st, end = last day)
- ✅ Payment date must be >= period end
- ✅ Cannot approve payroll with status 'draft' or 'calculating'
- ✅ Cannot modify approved payroll (must create adjustment)
- ✅ One payroll run per tenant per period

---

### Payroll Line Item

```typescript
type PayrollLineItem = {
  id: string;
  payrollRunId: string;
  employeeId: string;

  // Salary
  baseSalary: number;
  overtimePay: number;
  bonuses: number;
  grossSalary: number; // Calculated

  // Deductions
  cnpsPension: number;
  cnpsOther: number;
  cmu: number; // Universal Health Coverage
  its: number; // Income Tax
  otherDeductions: number;
  totalDeductions: number; // Calculated

  // Net
  netSalary: number; // Calculated

  // Employer Contributions
  employerCNPS: number;
  employerCMU: number;
  totalEmployerContributions: number; // Calculated

  // Flags
  isPartialMonth: boolean; // Prorated (hire/termination)
  workingDays: number | null; // Only if isPartialMonth
  daysWorked: number | null; // Only if isPartialMonth

  // Metadata
  calculatedAt: Date;
  metadata: PayrollMetadata | null;
}

type PayrollMetadata = {
  salaryChange?: {
    date: Date;
    oldSalary: number;
    newSalary: number;
    daysAtOldSalary: number;
    daysAtNewSalary: number;
  };
  termination?: {
    date: Date;
    vacationPayout: number;
    exitBenefits: number;
  };
  unpaidLeave?: {
    days: number;
    deduction: number;
  };
};
```

**Calculation Formulas:**
```typescript
// Gross Salary
grossSalary = baseSalary + overtimePay + bonuses;

// Employee Deductions (Côte d'Ivoire)
cnpsPension = grossSalary * 0.08; // 8% employee contribution
cnpsOther = grossSalary * 0.015; // 1.5% employee contribution
cmu = grossSalary * 0.01; // 1% employee contribution

// Taxable Income
taxableIncome = grossSalary - cnpsPension - cnpsOther - cmu - familyDeduction;

// ITS (progressive tax)
its = calculateProgressiveTax(taxableIncome, itsBrackets);

// Total Deductions
totalDeductions = cnpsPension + cnpsOther + cmu + its + otherDeductions;

// Net Salary
netSalary = grossSalary - totalDeductions;

// Employer Contributions
employerCNPS = grossSalary * 0.1685; // 16.85% employer contribution
employerCMU = grossSalary * 0.02; // 2% employer contribution
totalEmployerContributions = employerCNPS + employerCMU;
```

**Business Invariants:**
- ✅ Net salary must be > 0
- ✅ Gross salary must be >= SMIG (unless prorated)
- ✅ All monetary values must have 2 decimal precision
- ✅ Prorated salaries must have `workingDays` and `daysWorked`
- ✅ Calculations must match country-specific formulas

---

## Country Configuration Domain

### Tax System

```typescript
type TaxSystem = {
  id: string;
  countryCode: string;

  // Tax Details
  name: string; // e.g., "ITS - Côte d'Ivoire"
  type: 'progressive' | 'flat';

  // Effective Dating
  effectiveFrom: Date;
  effectiveTo: Date | null;

  // Configuration
  hasFamilyDeduction: boolean;
  familyDeductionConfig: FamilyDeductionConfig | null;
}

type FamilyDeductionConfig = {
  baseAmount: number; // e.g., 25,000 XOF
  maxDependents: number; // e.g., 5
  dependentIncrement: number; // e.g., 2,500 XOF per dependent
};
```

### Tax Bracket

```typescript
type TaxBracket = {
  id: string;
  taxSystemId: string;

  // Bracket Range
  minIncome: number;
  maxIncome: number | null; // null = infinity

  // Tax Calculation
  rate: number; // Percentage (e.g., 15.5)
  fixedAmount: number; // Base tax amount

  // Display
  displayOrder: number;
}
```

**Example (Côte d'Ivoire ITS):**
```typescript
const itsBrackets = [
  { minIncome: 0, maxIncome: 50000, rate: 0, fixedAmount: 0 },
  { minIncome: 50001, maxIncome: 130000, rate: 10, fixedAmount: 0 },
  { minIncome: 130001, maxIncome: 200000, rate: 15, fixedAmount: 8000 },
  { minIncome: 200001, maxIncome: 300000, rate: 20, fixedAmount: 18500 },
  { minIncome: 300001, maxIncome: 500000, rate: 25, fixedAmount: 38500 },
  { minIncome: 500001, maxIncome: 1500000, rate: 35, fixedAmount: 88500 },
  { minIncome: 1500001, maxIncome: null, rate: 45, fixedAmount: 438500 },
];
```

---

## Validation & Error Handling

### Domain Errors

```typescript
class DomainError extends Error {
  constructor(
    public code: string,
    public message: string,
    public field?: string,
  ) {
    super(message);
  }
}

// Employee Domain Errors
class EmployeeValidationError extends DomainError {}
class SalaryBelowMinimumError extends DomainError {}
class InvalidContractTypeError extends DomainError {}

// Payroll Domain Errors
class PayrollPeriodConflictError extends DomainError {}
class PayrollCalculationError extends DomainError {}
class InsufficientLeaveBalanceError extends DomainError {}
```

### Validation Patterns

```typescript
// Zod schema example for Employee
export const employeeSchema = z.object({
  firstName: z.string().min(2).max(100).regex(/^[\p{L}\s'-]+$/u),
  lastName: z.string().min(2).max(100).regex(/^[\p{L}\s'-]+$/u),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[0-9\s\-()]+$/).min(8).max(20).optional(),
  dateOfBirth: z.date().refine(
    (date) => differenceInYears(new Date(), date) >= 16,
    { message: "L'employé doit avoir au moins 16 ans" }
  ),
  hireDate: z.date().refine(
    (date) => !isFuture(date),
    { message: "La date d'embauche ne peut pas être dans le futur" }
  ),
});

// Usage
const result = employeeSchema.safeParse(employeeData);
if (!result.success) {
  throw new EmployeeValidationError('VALIDATION_FAILED', result.error.message);
}
```

---

## Aggregate Roots & Bounded Contexts

### Bounded Context Map

```
┌─────────────────────────────────────────────────────┐
│                 EMPLOYEE MANAGEMENT                  │
│  Aggregates: Employee, Position, Assignment         │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              TIME & ATTENDANCE                       │
│  Aggregates: LeaveRequest, TimeEntry                │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                    PAYROLL                           │
│  Aggregates: PayrollRun, PayrollLineItem            │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              COUNTRY CONFIGURATION                   │
│  Aggregates: TaxSystem, SocialSecurityScheme        │
└─────────────────────────────────────────────────────┘
```

**Integration Points:**
- Employee Management → Time & Attendance (via events)
- Time & Attendance → Payroll (leave deductions)
- Country Configuration → Payroll (tax/CNPS calculation)
- Employee Management → Payroll (salary, position)

---

## Domain Events

### Employee Events

```typescript
type EmployeeHiredEvent = {
  type: 'employee.hired';
  employeeId: string;
  tenantId: string;
  employeeName: string;
  hireDate: Date;
  baseSalary: number;
  positionId: string;
};

type EmployeeTerminatedEvent = {
  type: 'employee.terminated';
  employeeId: string;
  tenantId: string;
  employeeName: string;
  terminationDate: Date;
  reason: 'resignation' | 'termination' | 'retirement' | 'other';
};

type SalaryChangedEvent = {
  type: 'salary.changed';
  employeeId: string;
  tenantId: string;
  employeeName: string;
  effectiveFrom: Date;
  oldSalary: number;
  newSalary: number;
};
```

### Payroll Events

```typescript
type PayrollRunCreatedEvent = {
  type: 'payroll_run.created';
  payrollRunId: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
};

type PayrollRunApprovedEvent = {
  type: 'payroll_run.approved';
  payrollRunId: string;
  tenantId: string;
  employeeCount: number;
  totalNet: number;
  approvedBy: string;
};
```

### Leave Events

```typescript
type LeaveApprovedEvent = {
  type: 'leave.approved';
  employeeId: string;
  tenantId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  totalDays: number;
};
```

---

## State Machines

### Employee Status State Machine

```
         ┌──────────┐
    ┌───▶│  ACTIVE  │────┐
    │    └──────────┘    │
    │         │           │
    │         │ take_long_leave
    │         ▼           │
    │    ┌──────────┐    │
    │    │ ON_LEAVE │────┘
    │    └──────────┘    return_from_leave
    │         │
    │         │ terminate
    │         ▼
    │    ┌─────────────┐
    └────│ TERMINATED  │
         └─────────────┘
              (final state)
```

**Allowed Transitions:**
- `ACTIVE → ON_LEAVE`: Long-term leave granted
- `ON_LEAVE → ACTIVE`: Return from leave
- `ACTIVE → TERMINATED`: Employment ended
- `ON_LEAVE → TERMINATED`: Employment ended during leave
- `TERMINATED → *`: No transitions allowed (final state)

### Payroll Run Status State Machine

```
┌───────┐    calculate    ┌─────────────┐
│ DRAFT │───────────────▶│ CALCULATING │
└───────┘                 └─────────────┘
                                │
                                │ complete
                                ▼
                          ┌────────────┐    approve    ┌──────────┐
                          │ CALCULATED │──────────────▶│ APPROVED │
                          └────────────┘                └──────────┘
                                │                             │
                                │ recalculate                 │ pay
                                ▼                             ▼
                          ┌───────┐                      ┌──────┐
                          │ DRAFT │                      │ PAID │
                          └───────┘                      └──────┘
                                                          (final)
```

---

## French Business Terms (Glossary)

| French Term | English | Context |
|-------------|---------|---------|
| Salaire brut | Gross salary | Before deductions |
| Salaire net | Net salary | After deductions |
| Salaire imposable | Taxable income | After CNPS/CMU deductions |
| CNPS | Social Security | Caisse Nationale de Prévoyance Sociale |
| CMU | Universal Health | Couverture Maladie Universelle |
| ITS | Income Tax | Impôt sur les Traitements et Salaires |
| SMIG | Minimum Wage | Salaire Minimum Interprofessionnel Garanti |
| CDI | Permanent Contract | Contrat à Durée Indéterminée |
| CDD | Fixed-term Contract | Contrat à Durée Déterminée |
| Congé annuel | Annual leave | Paid vacation |
| Congé maladie | Sick leave | Medical leave |
| Préavis | Notice period | Period before termination |
| Indemnité | Severance pay | Exit benefits |

---

**This document serves as the canonical reference for all business logic implementation.**
