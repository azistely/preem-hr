# 🔌 API Contracts & Event Schemas

## ⚠️ SOURCE OF TRUTH - API Definitions

**NEVER** guess endpoint paths or request/response shapes. **ALWAYS** reference this document.

---

## 1. tRPC Router Structure

### 1.1 Root App Router

```typescript
// src/server/api/root.ts
import { router } from './trpc';
import { authRouter } from '@/features/auth/api/auth.router';
import { employeesRouter } from '@/features/employees/api/employees.router';
import { positionsRouter } from '@/features/positions/api/positions.router';
import { payrollRouter } from '@/features/payroll/api/payroll.router';
import { timeTrackingRouter } from '@/features/time-tracking/api/time-tracking.router';
import { timeOffRouter } from '@/features/time-off/api/time-off.router';
import { workflowsRouter } from '@/features/workflows/api/workflows.router';
import { superAdminRouter } from '@/features/super-admin/api/super-admin.router';

export const appRouter = router({
  auth: authRouter,
  employees: employeesRouter,
  positions: positionsRouter,
  payroll: payrollRouter,
  timeTracking: timeTrackingRouter,
  timeOff: timeOffRouter,
  workflows: workflowsRouter,
  superAdmin: superAdminRouter,
});

export type AppRouter = typeof appRouter;
```

---

## 2. Employee Management API

### 2.1 Employees Router

```typescript
// src/features/employees/api/employees.router.ts

export const employeesRouter = router({
  // ========================================
  // Queries (Read)
  // ========================================

  /**
   * List employees with filtering and pagination
   * @access Protected (tenant-scoped)
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['active', 'terminated', 'suspended']).optional(),
      search: z.string().optional(), // Search by name or employee_number
      positionId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(), // For pagination
    }))
    .query(async ({ input, ctx }) => {
      // Returns: { employees: Employee[], nextCursor?: string }
    }),

  /**
   * Get single employee by ID
   * @access Protected (tenant-scoped)
   */
  getById: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      // Returns: Employee with salaryHistory, assignmentHistory, customFields
    }),

  /**
   * Get employee salary history
   * @access Protected (tenant-scoped)
   */
  getSalaryHistory: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      asOfDate: z.date().optional(), // Get history as of specific date
    }))
    .query(async ({ input, ctx }) => {
      // Returns: EmployeeSalary[]
    }),

  /**
   * Get employee assignment history
   * @access Protected (tenant-scoped)
   */
  getAssignmentHistory: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: Assignment[] with position details
    }),

  // ========================================
  // Mutations (Write)
  // ========================================

  /**
   * Create employee (hire)
   * @access Protected (tenant-scoped)
   * @emits employee.hired
   */
  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1, 'Prénom requis'),
      lastName: z.string().min(1, 'Nom requis'),
      preferredName: z.string().optional(),
      email: z.string().email('Email invalide'),
      phone: z.string().optional(),
      dateOfBirth: z.date().optional(),
      gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),

      // PII (will be encrypted)
      nationalId: z.string().optional(),
      bankAccount: z.string().optional(),

      // Employment
      hireDate: z.date(),
      positionId: z.string().uuid('Poste requis'),

      // Salary
      baseSalary: z.number().min(75000, 'Salaire >= SMIG (75000 FCFA)'),
      housingAllowance: z.number().min(0).default(0),
      transportAllowance: z.number().min(0).default(0),
      mealAllowance: z.number().min(0).default(0),

      // Tax
      taxDependents: z.number().min(0).default(0),

      // Custom
      customFields: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: Employee
    }),

  /**
   * Update employee
   * @access Protected (tenant-scoped)
   * @emits employee.updated
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      preferredName: z.string().nullable().optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      dateOfBirth: z.date().nullable().optional(),
      gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),

      // PII
      nationalId: z.string().nullable().optional(),
      bankAccount: z.string().nullable().optional(),

      // Tax
      taxDependents: z.number().min(0).optional(),

      // Custom
      customFields: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: Employee
    }),

  /**
   * Change employee salary (effective-dated)
   * @access Protected (tenant-scoped)
   * @emits employee.salary_changed
   */
  changeSalary: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      newBaseSalary: z.number().min(75000),
      housingAllowance: z.number().min(0).optional(),
      transportAllowance: z.number().min(0).optional(),
      mealAllowance: z.number().min(0).optional(),
      effectiveFrom: z.date(),
      changeReason: z.enum(['hire', 'promotion', 'adjustment', 'cost_of_living', 'demotion']),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: EmployeeSalary
    }),

  /**
   * Transfer employee to new position
   * @access Protected (tenant-scoped)
   * @emits employee.transferred
   */
  transfer: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      newPositionId: z.string().uuid(),
      effectiveFrom: z.date(),
      transferReason: z.enum(['promotion', 'transfer', 'demotion', 'reorganization']),
      changeSalary: z.boolean().default(false),
      newBaseSalary: z.number().min(75000).optional(), // If changeSalary = true
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: { assignment: Assignment, salary?: EmployeeSalary }
    }),

  /**
   * Terminate employee
   * @access Protected (tenant-scoped)
   * @emits employee.terminated
   */
  terminate: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      terminationDate: z.date(),
      terminationReason: z.enum([
        'resignation',
        'termination',
        'retirement',
        'contract_end',
        'death',
        'other'
      ]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: Employee with final pay calculation
    }),

  /**
   * Suspend employee
   * @access Protected (tenant-scoped)
   * @emits employee.suspended
   */
  suspend: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      suspensionStart: z.date(),
      suspensionEnd: z.date().optional(), // null = indefinite
      reason: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: Employee
    }),

  /**
   * Reactivate employee
   * @access Protected (tenant-scoped)
   * @emits employee.reactivated
   */
  reactivate: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      effectiveDate: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: Employee
    }),
});
```

---

## 3. Payroll API

### 3.1 Payroll Router

```typescript
// src/features/payroll/api/payroll.router.ts

export const payrollRouter = router({
  // ========================================
  // Queries
  // ========================================

  /**
   * List payroll runs
   * @access Protected (tenant-scoped)
   */
  listRuns: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'calculating', 'calculated', 'approved', 'paid', 'failed']).optional(),
      year: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: { runs: PayrollRun[], nextCursor?: string }
    }),

  /**
   * Get payroll run by ID
   * @access Protected (tenant-scoped)
   */
  getRunById: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      // Returns: PayrollRun with lineItems
    }),

  /**
   * Get employee pay stub
   * @access Protected (employee can access own)
   */
  getPayStub: protectedProcedure
    .input(z.object({
      payrollRunId: z.string().uuid(),
      employeeId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: PayrollLineItem with detailed breakdown
    }),

  /**
   * Calculate gross salary preview
   * @access Protected
   */
  calculateGross: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      periodStart: z.date(),
      periodEnd: z.date(),
      includeOvertime: z.boolean().default(true),
      includeBonuses: z.boolean().default(true),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: GrossSalaryCalculation
    }),

  /**
   * Calculate payroll (Multi-Country V2)
   * @access Protected
   * @description Database-driven calculation supporting multiple countries
   */
  calculateV2: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      countryCode: z.string().length(2), // 'CI', 'SN', etc.
      periodStart: z.date(),
      periodEnd: z.date(),
      baseSalary: z.number().min(0),
      housingAllowance: z.number().min(0).optional(),
      transportAllowance: z.number().min(0).optional(),
      mealAllowance: z.number().min(0).optional(),
      fiscalParts: z.number().min(1.0).max(5.0).default(1.0), // Family deductions
      sectorCode: z.string().optional(), // 'services', 'construction', etc.
    }))
    .query(async ({ input, ctx }) => {
      // Returns: PayrollCalculationResult
    }),

  /**
   * Get family deductions for a country
   * @access Protected
   * @description Returns fiscal parts and deduction amounts for a country
   */
  getFamilyDeductions: protectedProcedure
    .input(z.object({
      countryCode: z.string().length(2),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: FamilyDeduction[]
    }),

  // ========================================
  // Mutations
  // ========================================

  /**
   * Create payroll run
   * @access Protected (HR manager)
   */
  createRun: protectedProcedure
    .input(z.object({
      periodStart: z.date(),
      periodEnd: z.date(),
      paymentDate: z.date(),
      name: z.string().optional(), // Defaults to "Paie {Month} {Year}"
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: PayrollRun (status: draft)
    }),

  /**
   * Calculate payroll run
   * @access Protected (HR manager)
   * @emits payroll.run.calculated
   */
  calculateRun: protectedProcedure
    .input(z.object({
      runId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: { runId, employeeCount, totalGross, totalNet }
    }),

  /**
   * Approve payroll run
   * @access Protected (Admin only)
   * @emits payroll.run.approved
   */
  approveRun: protectedProcedure
    .input(z.object({
      runId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: PayrollRun (status: approved)
    }),

  /**
   * Mark payroll as paid
   * @access Protected (Admin only)
   * @emits payroll.run.paid
   */
  markAsPaid: protectedProcedure
    .input(z.object({
      runId: z.string().uuid(),
      paymentReference: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: PayrollRun (status: paid)
    }),

  /**
   * Delete/cancel payroll run
   * @access Protected (Admin only, only if draft)
   */
  deleteRun: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      // Returns: { success: true }
    }),
});
```

---

## 4. Time Tracking API

### 4.1 Time Tracking Router

```typescript
// src/features/time-tracking/api/time-tracking.router.ts

export const timeTrackingRouter = router({
  // ========================================
  // Queries
  // ========================================

  /**
   * Get time entries for employee
   * @access Protected (employee can access own)
   */
  getEntries: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      startDate: z.date(),
      endDate: z.date(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: TimeEntry[]
    }),

  /**
   * Get current open entry (clocked in, not yet out)
   * @access Protected
   */
  getCurrentEntry: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: TimeEntry | null
    }),

  /**
   * Get overtime summary for period
   * @access Protected
   */
  getOvertimeSummary: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      periodStart: z.date(),
      periodEnd: z.date(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: { regularHours, overtimeHours, breakdown }
    }),

  // ========================================
  // Mutations
  // ========================================

  /**
   * Clock in
   * @access Protected (mobile)
   * @emits time.clocked_in
   */
  clockIn: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }),
      photoUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeEntry
    }),

  /**
   * Clock out
   * @access Protected (mobile)
   * @emits time.clocked_out
   */
  clockOut: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
      photoUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeEntry with calculated hours
    }),

  /**
   * Approve time entry
   * @access Protected (manager)
   * @emits time.approved
   */
  approve: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeEntry
    }),

  /**
   * Reject time entry
   * @access Protected (manager)
   * @emits time.rejected
   */
  reject: protectedProcedure
    .input(z.object({
      entryId: z.string().uuid(),
      reason: z.string().min(1, 'Raison requise'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeEntry
    }),
});
```

---

## 5. Time-Off API

### 5.1 Time-Off Router

```typescript
// src/features/time-off/api/time-off.router.ts

export const timeOffRouter = router({
  // ========================================
  // Policies
  // ========================================

  /**
   * List time-off policies
   * @access Protected
   */
  listPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      // Returns: TimeOffPolicy[]
    }),

  /**
   * Create time-off policy
   * @access Protected (HR admin)
   */
  createPolicy: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      policyType: z.enum(['annual_leave', 'sick_leave', 'maternity', 'paternity', 'unpaid']),
      accrualMethod: z.enum(['fixed', 'accrued_monthly', 'accrued_hourly']),
      accrualRate: z.number().min(0),
      maxBalance: z.number().min(0).optional(),
      requiresApproval: z.boolean().default(true),
      advanceNoticeDays: z.number().min(0).default(0),
      minDaysPerRequest: z.number().min(0).default(0.5),
      maxDaysPerRequest: z.number().min(0).optional(),
      isPaid: z.boolean().default(true),
      blackoutPeriods: z.array(z.object({
        start: z.date(),
        end: z.date(),
        reason: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeOffPolicy
    }),

  // ========================================
  // Balances
  // ========================================

  /**
   * Get employee time-off balances
   * @access Protected (employee can access own)
   */
  getBalances: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: TimeOffBalance[] (one per policy)
    }),

  // ========================================
  // Requests
  // ========================================

  /**
   * Request time off
   * @access Protected
   * @emits timeoff.requested
   */
  request: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid(),
      policyId: z.string().uuid(),
      startDate: z.date(),
      endDate: z.date(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeOffRequest
    }),

  /**
   * Get time-off requests
   * @access Protected
   */
  getRequests: protectedProcedure
    .input(z.object({
      employeeId: z.string().uuid().optional(),
      status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      // Returns: TimeOffRequest[]
    }),

  /**
   * Approve time-off request
   * @access Protected (manager)
   * @emits timeoff.approved
   */
  approve: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeOffRequest
    }),

  /**
   * Reject time-off request
   * @access Protected (manager)
   * @emits timeoff.rejected
   */
  reject: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      reviewNotes: z.string().min(1, 'Raison requise'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeOffRequest
    }),

  /**
   * Cancel time-off request
   * @access Protected (employee or manager)
   * @emits timeoff.cancelled
   */
  cancel: protectedProcedure
    .input(z.string().uuid())
    .mutation(async ({ input, ctx }) => {
      // Returns: TimeOffRequest
    }),
});
```

---

## 6. Event Schemas

### 6.1 Employee Events

```typescript
// src/features/employees/events/employee.events.ts

export const employeeHiredEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('employee.hired'),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  data: z.object({
    employeeId: z.string().uuid(),
    employeeNumber: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    hireDate: z.date(),
    positionId: z.string().uuid(),
    baseSalary: z.number(),
  }),
  metadata: z.object({
    userId: z.string().uuid(),
    ipAddress: z.string().optional(),
  }),
});

export const employeeTerminatedEventSchema = z.object({
  eventType: z.literal('employee.terminated'),
  data: z.object({
    employeeId: z.string().uuid(),
    terminationDate: z.date(),
    reason: z.string(),
    finalPay: z.number().optional(),
  }),
  // ... rest similar to hired
});

export const employeeSalaryChangedEventSchema = z.object({
  eventType: z.literal('employee.salary_changed'),
  data: z.object({
    employeeId: z.string().uuid(),
    oldSalary: z.number(),
    newSalary: z.number(),
    effectiveFrom: z.date(),
    changeReason: z.string(),
  }),
});

export const employeeTransferredEventSchema = z.object({
  eventType: z.literal('employee.transferred'),
  data: z.object({
    employeeId: z.string().uuid(),
    fromPositionId: z.string().uuid(),
    toPositionId: z.string().uuid(),
    effectiveFrom: z.date(),
    transferReason: z.string(),
  }),
});
```

### 6.2 Payroll Events

```typescript
// src/features/payroll/events/payroll.events.ts

export const payrollRunCalculatedEventSchema = z.object({
  eventType: z.literal('payroll.run.calculated'),
  data: z.object({
    runId: z.string().uuid(),
    periodStart: z.date(),
    periodEnd: z.date(),
    employeeCount: z.number(),
    totalGross: z.number(),
    totalNet: z.number(),
    totalEmployerCost: z.number(),
  }),
});

export const payrollRunApprovedEventSchema = z.object({
  eventType: z.literal('payroll.run.approved'),
  data: z.object({
    runId: z.string().uuid(),
    approvedBy: z.string().uuid(),
    approvedAt: z.date(),
  }),
});

export const payrollRunPaidEventSchema = z.object({
  eventType: z.literal('payroll.run.paid'),
  data: z.object({
    runId: z.string().uuid(),
    paymentDate: z.date(),
    paymentReference: z.string().optional(),
    totalPaid: z.number(),
  }),
});
```

### 6.3 Time-Off Events

```typescript
// src/features/time-off/events/timeoff.events.ts

export const timeoffRequestedEventSchema = z.object({
  eventType: z.literal('timeoff.requested'),
  data: z.object({
    requestId: z.string().uuid(),
    employeeId: z.string().uuid(),
    policyId: z.string().uuid(),
    startDate: z.date(),
    endDate: z.date(),
    totalDays: z.number(),
  }),
});

export const timeoffApprovedEventSchema = z.object({
  eventType: z.literal('timeoff.approved'),
  data: z.object({
    requestId: z.string().uuid(),
    employeeId: z.string().uuid(),
    approvedBy: z.string().uuid(),
    startDate: z.date(),
    endDate: z.date(),
    totalDays: z.number(),
  }),
});

export const timeoffRejectedEventSchema = z.object({
  eventType: z.literal('timeoff.rejected'),
  data: z.object({
    requestId: z.string().uuid(),
    employeeId: z.string().uuid(),
    rejectedBy: z.string().uuid(),
    reason: z.string(),
  }),
});
```

---

## 7. Frontend Client Usage

### 7.1 React Query Hooks

```typescript
// Usage in components

// List employees
const { data, isLoading } = api.employees.list.useQuery({
  status: 'active',
  limit: 50,
});

// Get employee by ID
const { data: employee } = api.employees.getById.useQuery(employeeId);

// Create employee (mutation)
const createEmployee = api.employees.create.useMutation({
  onSuccess: (employee) => {
    toast.success(`Employé ${employee.first_name} ajouté`);
    router.push(`/employees/${employee.id}`);
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// Call mutation
createEmployee.mutate({
  firstName: 'Kouadio',
  lastName: 'Yao',
  email: 'kouadio@example.com',
  hireDate: new Date('2025-01-15'),
  positionId: selectedPosition.id,
  baseSalary: 300000,
});

// Optimistic updates
const changeSalary = api.employees.changeSalary.useMutation({
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await utils.employees.getById.cancel(variables.employeeId);

    // Snapshot previous value
    const previous = utils.employees.getById.getData(variables.employeeId);

    // Optimistically update
    utils.employees.getById.setData(variables.employeeId, (old) => ({
      ...old!,
      currentSalary: { base_salary: variables.newBaseSalary },
    }));

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    utils.employees.getById.setData(variables.employeeId, context.previous);
  },
  onSettled: (data, error, variables) => {
    // Always refetch after error or success
    utils.employees.getById.invalidate(variables.employeeId);
  },
});
```

---

## 8. Error Handling

### 8.1 Error Types

```typescript
// src/shared/errors/app-errors.ts

export class ValidationError extends TRPCError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'BAD_REQUEST',
      message,
      cause: details,
    });
  }
}

export class BusinessRuleError extends TRPCError {
  constructor(message: string, code: string) {
    super({
      code: 'PRECONDITION_FAILED',
      message,
      cause: { errorCode: code },
    });
  }
}

export class NotFoundError extends TRPCError {
  constructor(entity: string) {
    super({
      code: 'NOT_FOUND',
      message: `${entity} non trouvé`,
    });
  }
}

export class UnauthorizedError extends TRPCError {
  constructor(message = 'Non autorisé') {
    super({
      code: 'UNAUTHORIZED',
      message,
    });
  }
}
```

### 8.2 Error Handling Pattern

```typescript
// In router procedures
try {
  const result = await createEmployee(input);
  return result;
} catch (error) {
  if (error instanceof BusinessRuleError) {
    throw error; // Already formatted
  }

  // Log unexpected errors
  logger.error('Employee creation failed', {
    error: error.message,
    input,
  });

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Une erreur est survenue',
  });
}
```

---

## 9. Multi-Country Payroll API

### 9.1 Overview

The multi-country payroll system uses **database-driven configuration** instead of hardcoded values. All tax brackets, social security rates, and contribution rules are stored in the database and loaded dynamically based on country code and effective date.

### 9.2 Supported Countries

| Country | Code | Tax System | Social Security | Status |
|---------|------|------------|-----------------|--------|
| Côte d'Ivoire | `CI` | ITS (Impôt sur Traitements et Salaires) | CNPS + CMU | ✅ Active |
| Sénégal | `SN` | IRPP (Impôt sur le Revenu) | CSS (IPRESS + Retraite) | ✅ Active |
| Burkina Faso | `BF` | IUTS | CNSS | 🚧 Planned |

### 9.3 Country-Specific Calculation Details

#### 9.3.1 Côte d'Ivoire (CI)

**Tax System (ITS)**
- Progressive monthly tax with 5 brackets
- Family deductions supported (1.0 - 2.5 parts)
- Calculated on: Gross - Employee Contributions

**Social Security (CNPS + CMU)**
```typescript
// Employee Contributions
CNPS Retraite: 6.3% of gross (no ceiling)
CMU: 1,000 FCFA fixed (+ 4,500 if family)

// Employer Contributions
CNPS Retraite: 7.7% of gross
CNPS Prestations Familiales: 5.75% of 70,000 FCFA (salaire catégoriel)
CNPS Accidents du Travail: Varies by sector (2-5% of 70,000 FCFA)
CMU: 500 FCFA (+ 4,500 if family)

// Other Taxes
FDFP (training): 1.2% of gross (employer)
3FPT: 0.4% of gross (employer)
```

**Example:**
```typescript
const result = await api.payroll.calculateV2.useQuery({
  employeeId: 'emp-123',
  countryCode: 'CI',
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-01-31'),
  baseSalary: 400000,
  housingAllowance: 100000,
  fiscalParts: 2.0, // Married
  sectorCode: 'construction', // Higher work accident rate
});

// Returns:
{
  grossSalary: 500000,
  cnpsEmployee: 31500,  // 6.3% of 500k
  cmuEmployee: 1000,
  its: 115371,          // After family deduction
  netSalary: 352129,
  cnpsEmployer: 42000,  // 7.7% + 5.75% + 5% (construction)
  cmuEmployer: 5000,    // With family
  employerCost: 553500,
}
```

#### 9.3.2 Sénégal (SN)

**Tax System (IRPP)**
- Progressive monthly tax with 6 brackets
- Family deductions supported (1.0 - 2.5 parts)
- Calculated on: Gross - Employee Contributions

**Social Security (CSS)**
```typescript
// Employee Contributions
CSS Retraite: 5.6% of gross (ceiling: 360,000 FCFA)
IPRESS (health): 0%

// Employer Contributions
CSS Retraite: 8.4% of gross (ceiling: 360,000 FCFA)
CSS Prestations Familiales (PF): 7% of gross (no ceiling)
CSS Accidents du Travail (AT): 1% of gross (no ceiling)
IPRESS (health): 5% of gross (no ceiling)

// Other Taxes
CFCE (training): 3% of gross (employer)
```

**Salary Ceiling Example:**
```typescript
// For 500,000 FCFA gross salary:
const result = await api.payroll.calculateV2.useQuery({
  employeeId: 'emp-456',
  countryCode: 'SN',
  baseSalary: 500000,
  fiscalParts: 1.0,
});

// Social Security Calculation:
// Employee:
//   CSS Retraite: 5.6% of 360,000 (ceiling) = 20,160
//   IPRESS: 0
// Employer:
//   CSS Retraite: 8.4% of 360,000 (ceiling) = 30,240
//   PF: 7% of 500,000 (no ceiling) = 35,000
//   AT: 1% of 500,000 (no ceiling) = 5,000
//   IPRESS: 5% of 500,000 (no ceiling) = 25,000

// Returns:
{
  cnpsEmployee: 20160,  // Retirement only (capped)
  cmuEmployee: 0,       // No employee health contribution
  cnpsEmployer: 70240,  // Retraite + PF + AT
  cmuEmployer: 25000,   // IPRESS
  otherTaxesEmployer: 15000, // CFCE 3%
}
```

### 9.4 Pattern-Based Contribution Matching

The system uses **pattern-based code matching** to categorize contributions, making it country-agnostic:

```typescript
// Retirement/Pension → cnpsEmployee/cnpsEmployer
Matches: 'pension', 'retraite', 'retirement'
Examples: CI: 'pension', SN: 'RETRAITE'

// Health/Medical → cmuEmployee/cmuEmployer
Matches: 'health', 'medical', 'ipress', 'maladie'
Examples: CI: 'cmu', SN: 'IPRESS'

// Family/Accidents → cnpsEmployer (usually employer-only)
Matches: 'family', 'familial', 'pf', 'work_accident', 'accident', 'at'
Examples: CI: 'family_benefits', SN: 'PF', 'AT'
```

### 9.5 Adding a New Country

To add support for a new country:

1. **Add Country Record**
```sql
INSERT INTO countries (code, name, currency_code, region)
VALUES ('BF', '{"fr": "Burkina Faso"}', 'XOF', 'west_africa');
```

2. **Add Tax System**
```sql
INSERT INTO tax_systems (
  country_code, name, display_name,
  calculation_method, supports_family_deductions,
  effective_from
) VALUES (
  'BF', 'IUTS',
  '{"fr": "Impôt Unique sur Traitements et Salaires"}',
  'progressive_monthly', true,
  '2025-01-01'
);
```

3. **Add Tax Brackets**
```sql
INSERT INTO tax_brackets (tax_system_id, bracket_order, min_amount, max_amount, rate)
VALUES
  (tax_system_id, 1, 0, 30000, 0),
  (tax_system_id, 2, 30001, 50000, 0.128),
  -- ... more brackets
```

4. **Add Social Security Scheme**
```sql
INSERT INTO social_security_schemes (
  country_code, agency_code, agency_name, effective_from
) VALUES (
  'BF', 'CNSS',
  '{"fr": "Caisse Nationale de Sécurité Sociale"}',
  '2025-01-01'
);
```

5. **Add Contribution Types**
```sql
INSERT INTO contribution_types (
  scheme_id, code, name,
  employee_rate, employer_rate,
  calculation_base, ceiling_amount
) VALUES (
  scheme_id, 'RETRAITE',
  '{"fr": "Cotisation Retraite"}',
  0.055, 0.085,
  'gross_salary', 500000
);
```

6. **Test with Calculator**
```typescript
const result = await api.payroll.calculateV2.useQuery({
  countryCode: 'BF',
  baseSalary: 300000,
  fiscalParts: 1.0,
  // ... rest
});
```

### 9.6 Frontend Integration

The frontend dynamically adapts based on selected country:

**Dynamic Labels**
```typescript
// app/payroll/calculator/page.tsx
const getSocialSecurityLabels = (countryCode: string) => {
  if (countryCode === 'SN') {
    return {
      employeeRetirement: 'CSS Retraite (5,6%)',
      employerRetirement: 'CSS Retraite (8,4%)',
      taxLabel: 'IRPP (Impôt)',
    };
  }
  // Default: Côte d'Ivoire
  return {
    employeeRetirement: 'CNPS Salarié (6,3%)',
    taxLabel: 'ITS (Impôt)',
  };
};
```

**Country Selector**
```typescript
<Select onValueChange={field.onChange}>
  <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
  <SelectItem value="SN">🇸🇳 Sénégal</SelectItem>
  <SelectItem value="BF" disabled>🇧🇫 Burkina Faso (Bientôt)</SelectItem>
</Select>
```

**Family Deductions (Dynamic)**
```typescript
const familyDeductions = api.payroll.getFamilyDeductions.useQuery({
  countryCode: form.watch('countryCode'),
});

// Renders options like:
// CI: "1.0 - Célibataire", "2.0 - Marié(e)", "2.5 - Marié(e) + 2 enfants"
// SN: "1.0 - Une part", "2.0 - Deux parts", etc.
```

### 9.7 Testing Multi-Country Calculations

Automated tests verify calculations for each country:

```typescript
describe('Multi-Country Tests', () => {
  it('should calculate Senegal payroll with correct CSS contributions', async () => {
    const result = await calculatePayrollV2({
      countryCode: 'SN',
      baseSalary: 360000,
      fiscalParts: 1.0,
      sectorCode: 'services',
    });

    // CSS Retirement (at ceiling)
    expect(result.cnpsEmployee).toBe(20160); // 5.6% of 360k
    expect(result.cnpsEmployer).toBe(59040); // Retraite + PF + AT

    // CSS IPRESS (no ceiling)
    expect(result.cmuEmployer).toBe(18000); // 5% of 360k
  });

  it('should show different contributions for CI vs SN', async () => {
    const ci = await calculatePayrollV2({ countryCode: 'CI', baseSalary: 400000 });
    const sn = await calculatePayrollV2({ countryCode: 'SN', baseSalary: 400000 });

    // Different employee rates
    expect(ci.cnpsEmployee).toBe(25200); // 6.3% CI
    expect(sn.cnpsEmployee).toBe(20160); // 5.6% SN (capped at 360k)
  });
});
```

### 9.8 Error Handling

**Unsupported Country**
```typescript
try {
  const result = await api.payroll.calculateV2.useQuery({
    countryCode: 'XX', // Invalid
    baseSalary: 300000,
  });
} catch (error) {
  // Error: "No payroll configuration found for country XX"
}
```

**Missing Configuration**
```typescript
// If tax system exists but contribution types missing:
// Error: "No social security scheme found for country BF on date 2025-01-01"
```

---

## Verification Checklist

Before implementing API endpoints:

- [ ] Router defined in this document?
- [ ] Input schema uses Zod validation?
- [ ] Output type defined?
- [ ] Procedure type correct (query vs mutation)?
- [ ] Access control specified (public/protected/superAdmin)?
- [ ] Event emission documented (if applicable)?
- [ ] French error messages?
- [ ] Tenant isolation enforced (RLS)?

---

**Next:** Read `11-TESTING-STRATEGY.md`
