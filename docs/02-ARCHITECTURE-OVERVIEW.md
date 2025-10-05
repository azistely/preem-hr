# 🏗️ Architecture Overview

## ⚠️ SOURCE OF TRUTH - System Design

This document defines the **actual** architecture. Do not suggest alternatives without explicit approval.

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile & Web Clients                     │
│         (React Native / Next.js App Router)                  │
└────────────────┬────────────────────────────────────────────┘
                 │ tRPC over HTTP/WebSocket
┌────────────────▼────────────────────────────────────────────┐
│                   Application Layer (Node.js)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Feature Modules (Bounded Contexts)                  │   │
│  │  ┌──────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐  │   │
│  │  │Payroll│ │Employees│ │Time Track│ │ Workflows  │  │   │
│  │  └───┬───┘ └────┬────┘ └────┬─────┘ └─────┬──────┘  │   │
│  │      │          │           │             │          │   │
│  │   ┌──▼──────────▼───────────▼─────────────▼───┐     │   │
│  │   │         Event Bus (Inngest)               │     │   │
│  │   └───────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│            Data Layer (Supabase / PostgreSQL)                │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Tenant Data     │  │  Event Store │  │  Audit Logs  │  │
│  │  (RLS Enabled)   │  │  (Immutable) │  │  (Append-Only)│ │
│  └──────────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack (VERIFIED - Updated January 2025)

| Layer | Technology | Version | Why This Choice |
|-------|-----------|---------|-----------------|
| **Backend** | Node.js | 20 LTS | Mature ecosystem, event-driven |
| **Language** | TypeScript | 5.3+ | Type safety, developer productivity |
| **API** | tRPC | 11.x | End-to-end type safety, improved middleware |
| **Database** | PostgreSQL | 15+ | JSONB, effective dating, strong ACID |
| **ORM** | Drizzle ORM | Latest | Type-safe queries, lightweight, zero overhead |
| **BaaS** | Supabase | Latest | RLS, real-time, auth, storage, policies |
| **Events** | Inngest | Latest | Durable workflows, step functions, retries |
| **Frontend** | Next.js | 15+ (App Router) | React 19, improved RSC, server actions |
| **UI Framework** | React | 19 | use hook, improved Server Components |
| **Mobile** | React Native | Latest (Expo) | Cross-platform, shared codebase |
| **UI** | Tailwind CSS | 3.x | Utility-first, mobile-friendly |
| **UI Components** | shadcn/ui | Latest | Radix UI + Tailwind, accessible |
| **State** | Zustand | 4.x | Simple, persist middleware, devtools |
| **Forms** | React Hook Form + Zod | Latest | Performance, validation, type safety |
| **i18n** | next-intl | 3.x | App Router support, French primary |
| **Testing** | Vitest + Playwright | Latest | Fast, browser mode, modern |

**Do NOT suggest:**
- ❌ Express (use tRPC routers)
- ❌ Redux (use Zustand)
- ❌ Axios (use fetch with apiClient wrapper)
- ❌ Moment.js (use date-fns)
- ❌ GraphQL (use tRPC)
- ❌ REST (use tRPC for type safety)
- ❌ Material-UI, Ant Design, Chakra UI (use shadcn/ui for consistency)

---

## 2. Architectural Patterns

### 2.1 Multi-Tenancy Architecture

**Pattern:** Shared database with tenant isolation via Row-Level Security (RLS)

```sql
-- Every tenant-scoped table structure
CREATE TABLE {table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- ... domain fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- RLS Policy (automatic filtering)
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON {table_name}
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  );
```

**Tenant Hierarchy:**
```
Tenant (Company)
  ├── Locations (branches, offices)
  ├── Departments
  ├── Cost Centers
  └── Legal Entities (for multi-company groups)
```

**Benefits:**
- ✅ Strong isolation (enforced at DB level)
- ✅ Shared infrastructure (cost-efficient)
- ✅ Easy backup/restore per tenant
- ✅ Super admin can manage all tenants

### 2.2 Effective Dating Pattern

**Why:** Track changes over time without losing history (critical for payroll, compliance, audits).

```typescript
// Interface for effective-dated entities
interface EffectiveDated {
  effectiveFrom: Date;
  effectiveTo: Date | null; // null = current/active
}

// Example: Salary changes
interface EmployeeSalary extends EffectiveDated {
  id: string;
  employeeId: string;
  baseSalary: number;
  currency: string;
  effectiveFrom: Date; // Salary starts on this date
  effectiveTo: Date | null; // null = still current
}

// Get current salary (active as of today)
function getCurrentSalary(employeeId: string, asOfDate: Date = new Date()) {
  return db.query.employee_salaries.findFirst({
    where: and(
      eq(employee_salaries.employee_id, employeeId),
      lte(employee_salaries.effective_from, asOfDate),
      or(
        isNull(employee_salaries.effective_to),
        gt(employee_salaries.effective_to, asOfDate)
      )
    ),
  });
}

// Creating a salary change (NEVER update existing rows)
async function changeSalary(
  employeeId: string,
  newSalary: number,
  effectiveFrom: Date
) {
  return await db.transaction(async (tx) => {
    // 1. Close current salary record
    await tx.update(employee_salaries)
      .set({ effective_to: effectiveFrom })
      .where(and(
        eq(employee_salaries.employee_id, employeeId),
        isNull(employee_salaries.effective_to)
      ));

    // 2. Insert new salary record
    await tx.insert(employee_salaries).values({
      employee_id: employeeId,
      base_salary: newSalary,
      effective_from: effectiveFrom,
      effective_to: null, // Active
    });
  });
}
```

**Which Entities Need Effective Dating:**
- ✅ Salaries, bonuses, allowances
- ✅ Positions, assignments
- ✅ Organization structure (departments, cost centers)
- ✅ Tax rates, contribution rates (per country)
- ✅ Work schedules, time-off policies
- ❌ Transactions (payroll runs, time entries) - already immutable
- ❌ Events, audit logs - append-only

### 2.3 Event-Driven Architecture (CQRS)

**Pattern:** Commands modify state, events notify other modules.

```typescript
// Command (write operation)
export async function hireEmployee(cmd: HireEmployeeCommand) {
  const employee = await db.transaction(async (tx) => {
    // 1. Validate business rules
    validateEmployeeData(cmd);

    // 2. Write to database
    const emp = await tx.insert(employees).values({
      tenant_id: cmd.tenantId,
      first_name: cmd.firstName,
      last_name: cmd.lastName,
      hire_date: cmd.hireDate,
      status: 'active',
    }).returning();

    // 3. Create position assignment
    await tx.insert(assignments).values({
      employee_id: emp[0].id,
      position_id: cmd.positionId,
      effective_from: cmd.hireDate,
    });

    return emp[0];
  });

  // 4. Publish event (async, non-blocking)
  await eventBus.publish('employee.hired', {
    employeeId: employee.id,
    tenantId: employee.tenant_id,
    hireDate: employee.hire_date,
    positionId: cmd.positionId,
  });

  return employee;
}

// Event handlers (in other modules)
eventBus.on('employee.hired', async (event) => {
  // Trigger onboarding workflow
  await workflowEngine.start('employee-onboarding', {
    employeeId: event.employeeId,
  });

  // Send welcome email
  await emailService.sendWelcomeEmail(event.employeeId);

  // Provision IT accounts (if enabled)
  await itProvisioningService.createAccounts(event.employeeId);
});
```

**Event Naming Convention:**
```
{entity}.{action}[.status]

Examples:
- employee.hired
- employee.terminated
- payroll.run.started
- payroll.run.completed
- payroll.run.failed
- timeoff.request.submitted
- timeoff.request.approved
- timeoff.request.rejected
```

**Event Schema (Zod validation):**
```typescript
export const employeeHiredEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal('employee.hired'),
  timestamp: z.date(),
  tenantId: z.string().uuid(),
  data: z.object({
    employeeId: z.string().uuid(),
    hireDate: z.date(),
    positionId: z.string().uuid(),
  }),
  metadata: z.object({
    userId: z.string().uuid(),
    ipAddress: z.string().optional(),
  }),
});
```

**Event Storage (for replay, debugging):**
```sql
CREATE TABLE event_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  aggregate_id UUID, -- Entity this event relates to
  data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Immutable: no updates allowed
  CHECK (false) NO INHERIT -- Prevent updates via trigger
);

CREATE INDEX idx_event_store_type_tenant
  ON event_store(event_type, tenant_id, created_at DESC);
```

### 2.4 Bounded Contexts (Domain-Driven Design)

**Core Modules:**

```
src/features/
├── payroll/                 # Payroll calculation engine
│   ├── api/                 # tRPC routers
│   ├── services/            # Business logic
│   │   ├── calculation.ts   # Gross → Net calculation
│   │   ├── tax.ts           # ITS calculation
│   │   └── contributions.ts # CNPS/CMU calculation
│   ├── events/              # Event definitions + handlers
│   ├── schemas/             # Zod validation
│   └── types.ts             # TypeScript types
│
├── employees/               # Employee management
│   ├── api/
│   ├── services/
│   │   ├── employee.ts      # CRUD operations
│   │   ├── assignment.ts    # Position assignments
│   │   └── lifecycle.ts     # Hire, terminate, rehire
│   └── events/
│
├── positions/               # Position management (separate from people)
│   ├── api/
│   ├── services/
│   │   ├── position.ts      # Job definitions
│   │   └── hierarchy.ts     # Org structure
│   └── types.ts
│
├── time-tracking/           # Attendance, shifts, overtime
│   ├── api/
│   ├── services/
│   │   ├── clock.ts         # Clock in/out
│   │   ├── geofence.ts      # Location validation
│   │   └── overtime.ts      # Overtime calculation
│   └── events/
│
├── time-off/                # Leaves, absences, holidays
│   ├── api/
│   ├── services/
│   │   ├── policy.ts        # Time-off policies
│   │   ├── accrual.ts       # Balance calculation
│   │   └── approval.ts      # Approval workflow
│   └── events/
│
├── workflows/               # Workflow automation engine
│   ├── api/
│   ├── services/
│   │   ├── builder.ts       # Visual workflow builder
│   │   ├── executor.ts      # Workflow execution
│   │   └── triggers.ts      # Event-based triggers
│   └── types.ts
│
├── auth/                    # Authentication & authorization
│   ├── api/
│   ├── services/
│   │   ├── session.ts
│   │   └── permissions.ts   # RBAC
│   └── middleware.ts
│
├── super-admin/             # Super admin (cross-tenant)
│   ├── api/
│   ├── services/
│   │   ├── countries.ts     # Country rules config
│   │   ├── tax-rates.ts     # Tax/contribution rates
│   │   └── tenants.ts       # Tenant management
│   └── types.ts
│
└── shared/                  # Shared utilities
    ├── db/                  # Drizzle ORM client
    ├── events/              # Event bus
    ├── validation/          # Common Zod schemas
    └── utils/               # Helpers
```

**Module Communication Rules:**

| From → To | Allowed | Method |
|-----------|---------|--------|
| `payroll` → `employees` | ❌ Direct import | ✅ Read via query, listen to events |
| `employees` → `payroll` | ❌ Direct import | ✅ Emit event: `employee.hired` |
| `time-tracking` → `payroll` | ❌ Direct import | ✅ Event: `overtime.recorded` |
| `workflows` → Any module | ✅ Orchestration | ✅ Call APIs, emit commands |
| Any module → `shared` | ✅ Direct import | ✅ Utilities, types, DB client |

**Example Violation:**
```typescript
// ❌ WRONG: Direct cross-module import
import { calculatePayroll } from '@/features/payroll/services/calculation';

export async function approveTimeOff(requestId: string) {
  await updateTimeOffRequest(requestId, 'approved');
  await calculatePayroll(); // VIOLATION!
}
```

```typescript
// ✅ CORRECT: Event-driven communication
import { eventBus } from '@/shared/events';

export async function approveTimeOff(requestId: string) {
  const request = await updateTimeOffRequest(requestId, 'approved');

  // Let payroll module listen to this event
  await eventBus.publish('timeoff.approved', {
    requestId: request.id,
    employeeId: request.employee_id,
    startDate: request.start_date,
    endDate: request.end_date,
  });
}

// In payroll module
eventBus.on('timeoff.approved', async (event) => {
  // Adjust payroll calculation if needed
  await markTimeOffInPayrollPeriod(event.employeeId, event.startDate, event.endDate);
});
```

---

## 3. Data Access Patterns

### 3.1 ORM: Drizzle ORM

**Why Drizzle:**
- ✅ Type-safe SQL queries
- ✅ Lightweight (no heavy runtime)
- ✅ Great for PostgreSQL advanced features
- ✅ Zero-cost abstractions

```typescript
// Schema definition (src/shared/db/schema.ts)
import { pgTable, uuid, text, timestamp, numeric } from 'drizzle-orm/pg-core';

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email').notNull(),
  hire_date: timestamp('hire_date').notNull(),
  status: text('status').notNull().$type<'active' | 'terminated' | 'suspended'>(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

// Query (type-safe)
const activeEmployees = await db.query.employees.findMany({
  where: and(
    eq(employees.tenant_id, tenantId),
    eq(employees.status, 'active')
  ),
  with: {
    currentSalary: true, // Relation
  },
});
```

### 3.2 Database Client Setup

```typescript
// src/shared/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

export const sql = postgres(connectionString, { max: 10 });
export const db = drizzle(sql, { schema });
```

### 3.3 Migration Strategy

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate:pg

# Apply migrations
pnpm drizzle-kit push:pg

# Rollback (manual)
psql -d preem_hr -f drizzle/0002_down.sql
```

**Migration File Structure:**
```
drizzle/
├── 0001_create_tenants.sql
├── 0002_create_employees.sql
├── 0003_create_payroll.sql
└── meta/
    └── _journal.json
```

---

## 4. API Design (tRPC 11.x)

### 4.1 tRPC Router Structure (Updated for v11)

```typescript
// src/features/employees/api/employees.router.ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';

export const employeesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['active', 'terminated']).optional(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const employees = await db.query.employees.findMany({
        where: and(
          eq(employees.tenant_id, ctx.user.tenantId),
          input.status ? eq(employees.status, input.status) : undefined
        ),
        limit: input.limit + 1,
        cursor: input.cursor,
      });

      // Cursor-based pagination
      let nextCursor: string | undefined;
      if (employees.length > input.limit) {
        const nextItem = employees.pop();
        nextCursor = nextItem!.id;
      }

      return { employees, nextCursor };
    }),

  getById: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ input, ctx }) => {
      const employee = await db.query.employees.findFirst({
        where: and(
          eq(employees.id, input),
          eq(employees.tenant_id, ctx.user.tenantId) // Tenant isolation
        ),
        with: {
          currentSalary: true,
          currentPosition: true,
        },
      });

      if (!employee) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Employé non trouvé' });
      }

      return employee;
    }),

  create: protectedProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ input, ctx }) => {
      return await hireEmployee({
        ...input,
        tenantId: ctx.user.tenantId,
        createdBy: ctx.user.id,
      });
    }),
});
```

### 4.2 Context (Authentication) - Updated for tRPC 11

```typescript
// src/server/api/context.ts
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { cache } from 'react';
import 'server-only';

export const createTRPCContext = cache(async (opts?: CreateNextContextOptions) => {
  const { req, res } = opts || {};

  // Get user from Supabase JWT (when available)
  if (!req) {
    return {
      user: null,
      db,
    };
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      db,
    };
  }

  // Extract tenant from JWT claims
  const tenantId = user.app_metadata.tenant_id;

  return {
    user: {
      id: user.id,
      email: user.email!,
      tenantId,
      role: user.app_metadata.role,
    },
    db,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
```

### 4.3 Procedures (with auth) - Updated for tRPC 11

```typescript
// src/server/api/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

// Protected procedure (requires authentication)
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Non authentifié' });
  }
  return next({
    ctx: {
      // Infers the `user` as non-nullable
      user: ctx.user,
      db: ctx.db,
    },
  });
});

// Super admin procedure
export const superAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès refusé' });
  }
  return next({ ctx });
});
```

---

## 5. Frontend Architecture (Next.js)

### 5.1 Directory Structure (App Router)

```
src/app/
├── (marketing)/            # Marketing pages (no auth)
│   ├── page.tsx            # Homepage
│   ├── pricing/
│   └── layout.tsx
│
├── (auth)/                 # Auth pages
│   ├── login/
│   ├── register/
│   └── layout.tsx
│
├── (dashboard)/            # Protected dashboard
│   ├── layout.tsx          # Dashboard shell
│   ├── employees/
│   │   ├── page.tsx        # Employee list
│   │   ├── [id]/           # Employee detail
│   │   └── new/            # Add employee
│   ├── payroll/
│   │   ├── page.tsx
│   │   └── runs/[id]/
│   ├── time-tracking/
│   └── settings/
│
└── api/
    └── trpc/[trpc]/
        └── route.ts        # tRPC handler
```

### 5.2 Server Components vs Client Components (Next.js 15 + React 19)

```tsx
// app/(dashboard)/employees/page.tsx (Server Component by default)
import { api } from '@/trpc/server'; // Server-side tRPC caller
import { HydrateClient } from '@/trpc/server';

export default async function EmployeesPage() {
  // Fetch on server (no loading state needed)
  const employees = await api.employees.list({ status: 'active' });

  return (
    <HydrateClient>
      <div>
        <h1>Employés</h1>
        <EmployeeList initialData={employees} /> {/* Pass data down */}
      </div>
    </HydrateClient>
  );
}

// components/EmployeeList.tsx (Client Component for interactivity)
'use client';

import { api } from '@/trpc/react'; // Client-side tRPC React hooks

export function EmployeeList({ initialData }) {
  const [employees] = api.employees.list.useSuspenseQuery(
    { status: 'active' },
    {
      initialData,
      // React Query options
      staleTime: 60 * 1000, // Consider fresh for 1 minute
    }
  );

  return (
    <ul>
      {employees.employees.map(emp => (
        <EmployeeCard key={emp.id} employee={emp} />
      ))}
    </ul>
  );
}
```

### 5.3 State Management (Zustand 4.x with Persist & Devtools)

```typescript
// stores/useEmployeeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

interface EmployeeStore {
  selectedEmployeeId: string | null;
  selectEmployee: (id: string) => void;
  clearSelection: () => void;
}

export const useEmployeeStore = create<EmployeeStore>()(
  devtools(
    persist(
      (set) => ({
        selectedEmployeeId: null,
        selectEmployee: (id) => set({ selectedEmployeeId: id }),
        clearSelection: () => set({ selectedEmployeeId: null }),
      }),
      {
        name: 'employee-storage', // unique name for localStorage key
        storage: createJSONStorage(() => localStorage),
        // Optional: partial persistence
        partialize: (state) => ({ selectedEmployeeId: state.selectedEmployeeId }),
      }
    ),
    { name: 'EmployeeStore' } // Name for Redux DevTools
  )
);

// Usage in component (selector pattern for performance)
const selectedId = useEmployeeStore((state) => state.selectedEmployeeId);
const selectEmployee = useEmployeeStore((state) => state.selectEmployee);
```

---

## 6. Mobile Architecture (React Native)

### 6.1 Shared Codebase Strategy

```
src/
├── features/               # Shared business logic
│   └── payroll/
│       ├── api/            # tRPC client (works in RN)
│       ├── hooks/          # React hooks (platform-agnostic)
│       └── types.ts
│
├── app/                    # Next.js (Web)
│   └── (dashboard)/
│
└── mobile/                 # React Native (iOS/Android)
    ├── app/                # Expo Router
    │   ├── (tabs)/
    │   │   ├── index.tsx   # Home
    │   │   ├── employees.tsx
    │   │   └── payroll.tsx
    │   └── _layout.tsx
    │
    ├── components/         # Mobile-specific components
    │   ├── EmployeeCard.native.tsx
    │   └── Button.native.tsx
    │
    └── lib/
        └── trpc.ts         # Mobile tRPC client
```

### 6.2 Platform-Specific Components

```tsx
// components/Button.tsx (Web)
export function Button({ children, onPress, ...props }) {
  return (
    <button onClick={onPress} className="..." {...props}>
      {children}
    </button>
  );
}

// components/Button.native.tsx (Mobile)
import { TouchableOpacity, Text } from 'react-native';

export function Button({ children, onPress, ...props }) {
  return (
    <TouchableOpacity onPress={onPress} {...props}>
      <Text className="...">{children}</Text>
    </TouchableOpacity>
  );
}

// Usage (auto-imports correct version)
import { Button } from '@/components/Button';
```

---

## 7. Deployment Architecture

### 7.1 Infrastructure

```
┌─────────────────────────────────────────────────┐
│                 Vercel (Hosting)                 │
│  ┌──────────────┐      ┌──────────────┐         │
│  │   Next.js    │      │   tRPC API   │         │
│  │  (Frontend)  │◄────►│  (Backend)   │         │
│  └──────────────┘      └───────┬──────┘         │
└─────────────────────────────────┼────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   Supabase (Database)      │
                    │  ┌──────────────────────┐  │
                    │  │  PostgreSQL + RLS    │  │
                    │  │  Auth + Storage      │  │
                    │  │  Realtime            │  │
                    │  └──────────────────────┘  │
                    └────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │   Inngest (Events)         │
                    │  ┌──────────────────────┐  │
                    │  │  Workflow Engine     │  │
                    │  │  Durable Functions   │  │
                    │  └──────────────────────┘  │
                    └────────────────────────────┘
```

### 7.2 Environment Strategy

| Environment | Purpose | Database | URL |
|-------------|---------|----------|-----|
| **Development** | Local dev | Local PostgreSQL | localhost:3000 |
| **Preview** | PR previews | Staging DB | pr-123.vercel.app |
| **Staging** | QA testing | Staging DB | staging.preem.app |
| **Production** | Live app | Production DB | app.preem.app |

---

## 8. Security Architecture

### 8.1 Authentication Flow

```
1. User submits email/password
2. Supabase Auth validates credentials
3. Returns JWT with claims:
   {
     sub: "user-id",
     email: "user@example.com",
     app_metadata: {
       tenant_id: "tenant-uuid",
       role: "admin" | "user" | "super_admin"
     }
   }
4. Frontend stores JWT in httpOnly cookie
5. All API requests include JWT in Authorization header
6. tRPC context extracts tenant_id from JWT
7. RLS policies auto-filter by tenant_id
```

### 8.2 Role-Based Access Control (RBAC)

```typescript
export const roles = {
  super_admin: {
    canAccessAllTenants: true,
    canManageCountryRules: true,
    canManageTenants: true,
  },
  tenant_admin: {
    canManageEmployees: true,
    canRunPayroll: true,
    canConfigureWorkflows: true,
    canManageUsers: true,
  },
  hr_manager: {
    canManageEmployees: true,
    canViewPayroll: true,
    canApproveTimeOff: true,
  },
  employee: {
    canViewOwnData: true,
    canRequestTimeOff: true,
    canClockInOut: true,
  },
} as const;

// Permission check
export function hasPermission(user: User, permission: keyof typeof roles[Role]) {
  return roles[user.role][permission] === true;
}
```

---

## 9. Monitoring & Observability

### 9.1 Logging Strategy

```typescript
// Use structured logging
import { logger } from '@/shared/logger';

logger.info('Payroll calculation started', {
  tenantId,
  payrollPeriod: '2025-01',
  employeeCount: 150,
});

logger.error('Payroll calculation failed', {
  tenantId,
  error: err.message,
  stack: err.stack,
});

// ❌ NEVER log PII
logger.info('User data', { nationalId: '...' }); // FORBIDDEN
```

### 9.2 Error Tracking

- **Sentry** for error tracking
- **Vercel Analytics** for performance
- **Custom metrics** for payroll accuracy (compare expected vs actual)

---

## 10. Next Steps

After understanding this architecture, read:

1. **03-DATABASE-SCHEMA.md** - Complete database design
2. **04-DOMAIN-MODELS.md** - Business entities and rules
3. **05-EPIC-PAYROLL.md** - Start implementing payroll

---

**Verification Checklist (Before Implementation):**

- [ ] Understood multi-tenancy with RLS?
- [ ] Understood effective dating pattern?
- [ ] Know when to use CQRS vs simple CRUD?
- [ ] Familiar with tRPC router structure?
- [ ] Know module boundaries (no direct cross-imports)?
- [ ] Understand event-driven communication?

If uncertain on any, re-read relevant section or ask for clarification.
