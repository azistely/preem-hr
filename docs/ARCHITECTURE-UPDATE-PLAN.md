# PREEM HR - Architecture Update Implementation Plan

**Document Version:** 1.0
**Date:** January 2025
**Status:** Review & Approval Required

---

## Executive Summary

This document outlines the implementation plan for updating the PREEM HR architecture to align with the latest best practices for all technologies in the stack. The plan prioritizes backward compatibility and incremental migration while addressing critical technical debt.

## 1. Issues Identified & Severity

### CRITICAL (Immediate Action Required)

#### 1.1 Next.js Version Upgrade (14 → 15)
- **Current State:** Documentation references Next.js 14+
- **Target State:** Next.js 15.1.8
- **Impact:** Missing React 19 support, improved Server Components, enhanced caching
- **Risk:** Medium - Breaking changes in data fetching patterns
- **Effort:** 5-8 hours

#### 1.2 tRPC Version Upgrade (10.x → 11.x)
- **Current State:** tRPC 10.x patterns in documentation
- **Target State:** tRPC 11.x
- **Impact:** Breaking changes in router creation, context handling, middleware
- **Risk:** High - API changes affect all endpoints
- **Effort:** 12-16 hours

#### 1.3 React Upgrade (18.x → 19)
- **Current State:** React 18.x
- **Target State:** React 19
- **Impact:** New `use` hook, improved Server Components, better streaming
- **Risk:** Low - Mostly additive changes
- **Effort:** 4-6 hours

### IMPORTANT (High Priority)

#### 2.1 Drizzle ORM Best Practices
- **Current State:** Basic Drizzle setup
- **Target State:** Latest PostgreSQL patterns (sequences, policies, improved migrations)
- **Impact:** Better type safety, improved schema management
- **Risk:** Low - Additive improvements
- **Effort:** 6-8 hours

#### 2.2 Next.js Data Fetching Patterns
- **Current State:** Basic `fetch` usage
- **Target State:** React `cache`, `server-only` package, `unstable_cache`
- **Impact:** Better performance, proper caching strategies
- **Risk:** Low - Gradual migration possible
- **Effort:** 8-10 hours

#### 2.3 Zustand Middleware Integration
- **Current State:** Basic Zustand stores
- **Target State:** Persist middleware, devtools integration
- **Impact:** Better DX, state persistence
- **Risk:** Very Low - Non-breaking addition
- **Effort:** 3-4 hours

#### 2.4 Supabase RLS & Policies
- **Current State:** Basic RLS setup
- **Target State:** Latest policy syntax, enhanced security patterns
- **Impact:** Improved security, better policy management
- **Risk:** Medium - Incorrect policies could break access
- **Effort:** 6-8 hours

### NICE-TO-HAVE (Enhancement)

#### 3.1 Inngest Latest Features
- **Current State:** Basic Inngest integration
- **Target State:** Workflow-kit, improved error handling
- **Impact:** Better workflow management
- **Risk:** Very Low
- **Effort:** 4-6 hours

#### 3.2 Vitest Browser Mode
- **Current State:** Standard Vitest setup
- **Target State:** Browser mode for component testing
- **Impact:** Better component test coverage
- **Risk:** None
- **Effort:** 2-3 hours

#### 3.3 shadcn/ui Component Library
- **Current State:** Not explicitly documented
- **Target State:** Official shadcn/ui integration documented
- **Impact:** Consistent UI components
- **Risk:** None - Already using Tailwind
- **Effort:** 2-3 hours (documentation only)

---

## 2. Implementation Strategy

### Phase 1: Foundation Updates (Week 1)
**Priority:** CRITICAL
**Estimated Time:** 25-35 hours

#### Step 1.1: Update Dependencies
```bash
# Update core dependencies
pnpm update next@latest react@latest react-dom@latest
pnpm update @trpc/server@latest @trpc/client@latest @trpc/react-query@latest @trpc/next@latest
pnpm update drizzle-orm@latest drizzle-kit@latest
pnpm add server-only
```

#### Step 1.2: Update tRPC Configuration (CRITICAL)

**Files to Update:**
- `/src/server/api/trpc.ts` (new location)
- `/src/server/api/context.ts` (new location)
- `/src/server/api/root.ts` (new location)
- `/src/trpc/server.ts` (new server-side caller)
- `/src/trpc/react.tsx` (new client-side hooks)

**Changes Required:**

1. **Create new tRPC structure:**

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

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
      db: ctx.db,
    },
  });
});
```

2. **Update context with React cache:**

```typescript
// src/server/api/context.ts
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import { cache } from 'react';
import 'server-only';

export const createTRPCContext = cache(async (opts?: CreateNextContextOptions) => {
  // Context creation logic
  return {
    user: /* ... */,
    db,
  };
});
```

3. **Create server caller:**

```typescript
// src/trpc/server.ts
import 'server-only';
import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { createCallerFactory, createTRPCRouter } from '@/server/api/trpc';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/context';

export const createCaller = createCallerFactory(appRouter);

export const api = createCaller(await createTRPCContext());

export const { HydrateClient, api: helpers } = createHydrationHelpers(appRouter);
```

4. **Create React hooks:**

```typescript
// src/trpc/react.tsx
'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/server/api/root';

export const api = createTRPCReact<AppRouter>();

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/trpc`,
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}
```

**Migration Checklist:**
- [ ] Update all `router()` calls to `createTRPCRouter()`
- [ ] Update all imports from `@/shared/api/trpc` to `@/server/api/trpc`
- [ ] Update context function name to `createTRPCContext`
- [ ] Add `cache` wrapper to context
- [ ] Update all routers to use new import paths
- [ ] Test all API endpoints
- [ ] Update API tests

#### Step 1.3: Update Next.js Data Fetching Patterns

**Files to Update:**
- All Server Components using `fetch`
- Data fetching utilities

**Changes Required:**

1. **Use React cache for deduplication:**

```typescript
// lib/data/employees.ts
import { cache } from 'react';
import 'server-only';

export const getEmployee = cache(async (id: string) => {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, id),
  });
  return employee;
});

export const preload = (id: string) => {
  void getEmployee(id);
};
```

2. **Use in Server Components:**

```tsx
// app/employees/[id]/page.tsx
import { getEmployee, preload } from '@/lib/data/employees';

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Preload for parallel fetching
  preload(id);

  // Fetch data
  const employee = await getEmployee(id);

  return <div>{employee.name}</div>;
}
```

**Migration Checklist:**
- [ ] Identify all data fetching functions
- [ ] Wrap with React `cache`
- [ ] Add `'server-only'` directive
- [ ] Create preload functions where beneficial
- [ ] Update Server Components to use new patterns
- [ ] Test data deduplication

#### Step 1.4: Upgrade to React 19

**Files to Update:**
- `package.json`
- Any components using new features

**Changes Required:**

1. **Install React 19:**
```bash
pnpm add react@latest react-dom@latest
```

2. **Use the `use` hook for promises:**

```tsx
'use client';
import { use } from 'react';

export function Posts({ postsPromise }: { postsPromise: Promise<Post[]> }) {
  const posts = use(postsPromise);

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

3. **Update Server Component to pass promise:**

```tsx
export default function Page() {
  const postsPromise = getPosts();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Posts postsPromise={postsPromise} />
    </Suspense>
  );
}
```

**Migration Checklist:**
- [ ] Update React dependencies
- [ ] Test existing components
- [ ] Identify places to use `use` hook
- [ ] Update streaming patterns
- [ ] Run full test suite

---

### Phase 2: ORM & Database Updates (Week 2)
**Priority:** IMPORTANT
**Estimated Time:** 12-16 hours

#### Step 2.1: Drizzle ORM Best Practices

**Files to Update:**
- `/src/server/db/schema.ts`
- Migration files

**Changes Required:**

1. **Add PostgreSQL sequences:**

```typescript
import { pgSequence, pgTable, serial } from 'drizzle-orm/pg-core';

export const employeeSequence = pgSequence('employee_id_seq', {
  startWith: 1000,
  increment: 1,
  cache: 20,
});

export const employees = pgTable('employees', {
  id: serial('id').default(employeeSequence).primaryKey(),
  // ... other fields
});
```

2. **Add RLS policies:**

```typescript
import { pgPolicy, pgRole } from 'drizzle-orm/pg-core';

export const tenantUser = pgRole('tenant_user');

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenant_id: uuid('tenant_id').notNull(),
  // ... other fields
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`tenant_id = current_setting('app.current_tenant_id')::uuid`,
  }),
]);
```

3. **Improve migration workflow:**

```bash
# Generate migration
pnpm drizzle-kit generate

# Review migration SQL
cat drizzle/0001_*.sql

# Apply migration
pnpm drizzle-kit push
```

**Migration Checklist:**
- [ ] Review current schema
- [ ] Add sequences where appropriate
- [ ] Add policies for RLS
- [ ] Test migration generation
- [ ] Apply migrations to development
- [ ] Update schema documentation

#### Step 2.2: Supabase RLS Enhancement

**Files to Update:**
- Supabase migration files
- Database schema

**Changes Required:**

1. **Update RLS policies:**

```sql
-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Modern policy syntax
CREATE POLICY "tenant_isolation_policy" ON employees
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
```

2. **Add helper functions:**

```sql
-- Helper function for current tenant
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$;

-- Use in policies
CREATE POLICY "simpler_tenant_isolation" ON employees
  FOR ALL
  USING (tenant_id = current_tenant_id());
```

**Migration Checklist:**
- [ ] Review existing RLS policies
- [ ] Update to latest syntax
- [ ] Add helper functions
- [ ] Test policies with different user roles
- [ ] Document policy patterns

---

### Phase 3: State Management & UI (Week 3)
**Priority:** IMPORTANT
**Estimated Time:** 8-12 hours

#### Step 3.1: Zustand Middleware Integration

**Files to Update:**
- All Zustand store files

**Changes Required:**

1. **Add persist middleware:**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

export const useEmployeeStore = create<EmployeeStore>()(
  devtools(
    persist(
      (set, get) => ({
        selectedEmployeeId: null,
        selectEmployee: (id) => set({ selectedEmployeeId: id }),
        clearSelection: () => set({ selectedEmployeeId: null }),
      }),
      {
        name: 'employee-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          selectedEmployeeId: state.selectedEmployeeId,
        }),
      }
    ),
    {
      name: 'EmployeeStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
```

**Migration Checklist:**
- [ ] Update all stores with middleware
- [ ] Configure persistence where needed
- [ ] Add devtools in development
- [ ] Test state persistence
- [ ] Document store patterns

#### Step 3.2: shadcn/ui Documentation

**Files to Create/Update:**
- `/docs/UI-COMPONENTS.md`
- Component examples

**Changes Required:**

1. **Document shadcn/ui usage:**

```markdown
## shadcn/ui Components

We use shadcn/ui for all UI components. Installation:

\`\`\`bash
pnpm dlx shadcn-ui@latest add button
\`\`\`

Components are installed in `/src/components/ui/` and can be customized.
```

**Migration Checklist:**
- [ ] Create UI components documentation
- [ ] List installed components
- [ ] Add usage examples
- [ ] Document customization patterns

---

### Phase 4: Testing & DevX (Week 4)
**Priority:** NICE-TO-HAVE
**Estimated Time:** 6-10 hours

#### Step 4.1: Vitest Browser Mode

**Files to Create/Update:**
- `/vitest.config.ts`
- Component test files

**Changes Required:**

1. **Configure browser mode:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
});
```

2. **Write browser tests:**

```typescript
// components/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button } from '../Button';

test('Button renders correctly', async () => {
  render(<Button>Click me</Button>);

  const button = screen.getByRole('button', { name: /click me/i });
  expect(button).toBeInTheDocument();
});
```

**Migration Checklist:**
- [ ] Install browser mode dependencies
- [ ] Configure Vitest
- [ ] Write example browser tests
- [ ] Run tests in CI
- [ ] Document testing patterns

#### Step 4.2: Inngest Workflow Updates

**Files to Update:**
- Inngest function definitions
- Workflow files

**Changes Required:**

1. **Use latest Inngest patterns:**

```typescript
import { inngest } from '@/lib/inngest/client';

export const onboardEmployee = inngest.createFunction(
  { id: 'onboard-employee' },
  { event: 'employee.hired' },
  async ({ event, step }) => {
    // Step 1: Create user account
    const user = await step.run('create-user-account', async () => {
      return await createUserAccount(event.data.employeeId);
    });

    // Step 2: Send welcome email (with retry)
    await step.run('send-welcome-email', async () => {
      return await sendWelcomeEmail(user.email);
    });

    // Step 3: Schedule orientation
    await step.run('schedule-orientation', async () => {
      return await scheduleOrientation(event.data.employeeId);
    });
  }
);
```

**Migration Checklist:**
- [ ] Review existing Inngest functions
- [ ] Update to step-based pattern
- [ ] Add error handling
- [ ] Test workflows
- [ ] Document workflow patterns

---

## 3. Testing Strategy

### 3.1 Pre-Migration Testing
- [ ] Run full test suite
- [ ] Document current test coverage
- [ ] Identify critical user flows
- [ ] Create migration test plan

### 3.2 During Migration Testing
- [ ] Test each component after update
- [ ] Run regression tests after each phase
- [ ] Monitor error logs
- [ ] Test with real data in staging

### 3.3 Post-Migration Testing
- [ ] Full integration test suite
- [ ] Performance testing
- [ ] Security audit
- [ ] User acceptance testing

---

## 4. Rollback Plan

### 4.1 Version Control Strategy
- Create feature branch: `feat/architecture-update-2025`
- Commit after each phase
- Tag before major changes
- Keep `main` branch stable

### 4.2 Rollback Procedures

**If tRPC update fails:**
1. Revert to tagged commit
2. Restore old import paths
3. Test endpoints

**If Next.js update fails:**
1. Downgrade Next.js: `pnpm add next@14`
2. Restore old data fetching patterns
3. Test rendering

**If database migrations fail:**
1. Run down migrations
2. Restore from backup
3. Review migration SQL

---

## 5. Success Criteria

### 5.1 Technical Metrics
- [ ] All dependencies on latest versions
- [ ] Zero breaking changes for existing features
- [ ] Improved TypeScript coverage (>95%)
- [ ] Test coverage maintained or improved (>80%)
- [ ] No regression in performance

### 5.2 Documentation Metrics
- [ ] All documentation updated
- [ ] New patterns documented with examples
- [ ] Architecture diagrams updated
- [ ] Team training completed

### 5.3 Performance Metrics
- [ ] Page load time maintained or improved
- [ ] API response time maintained or improved
- [ ] Build time not significantly increased
- [ ] Bundle size not significantly increased

---

## 6. Timeline & Resources

### 6.1 Estimated Timeline
- **Week 1:** Foundation Updates (Next.js, tRPC, React)
- **Week 2:** ORM & Database Updates
- **Week 3:** State Management & UI
- **Week 4:** Testing & DevX

**Total:** 4 weeks (51-73 hours of development time)

### 6.2 Required Resources
- **Developer:** 1 senior full-stack developer
- **Reviewer:** 1 tech lead for code review
- **QA:** 1 QA engineer for testing
- **DevOps:** Access for deployment updates

### 6.3 Risk Mitigation
- Work in feature branch
- Deploy to staging first
- Gradual rollout to production
- Monitor error logs closely
- Have rollback plan ready

---

## 7. Post-Implementation

### 7.1 Documentation Updates
- [ ] Update README files
- [ ] Update architecture diagrams
- [ ] Create migration guide for team
- [ ] Update onboarding documentation

### 7.2 Team Training
- [ ] tRPC 11 training session
- [ ] Next.js 15 features overview
- [ ] New patterns workshop
- [ ] Q&A session

### 7.3 Monitoring
- [ ] Set up error tracking
- [ ] Monitor performance metrics
- [ ] Track user feedback
- [ ] Review logs weekly for 1 month

---

## 8. Approval & Sign-off

### 8.1 Required Approvals
- [ ] Technical Lead
- [ ] Product Owner
- [ ] DevOps Team
- [ ] Security Team (for RLS changes)

### 8.2 Go/No-Go Criteria
- All critical issues must be resolved
- Test coverage must be maintained
- Performance benchmarks must be met
- Rollback plan must be tested

---

## Appendix A: File Changes Summary

### Files to Create
- `/src/server/api/trpc.ts`
- `/src/server/api/context.ts`
- `/src/server/api/root.ts`
- `/src/trpc/server.ts`
- `/src/trpc/react.tsx`
- `/docs/UI-COMPONENTS.md`

### Files to Update
- `/package.json`
- `/next.config.js`
- `/vitest.config.ts`
- All router files in `/src/features/*/api/`
- All Zustand store files
- Database schema files
- Supabase migration files
- Documentation files (already updated)

### Files to Delete (After Migration)
- Old tRPC setup files (if locations change)
- Deprecated helper functions
- Old migration patterns

---

## Appendix B: Breaking Changes Reference

### tRPC 10 → 11 Breaking Changes
1. `router()` → `createTRPCRouter()`
2. Context creation requires `cache` wrapper
3. Client creation API changed
4. New server/client split pattern

### Next.js 14 → 15 Breaking Changes
1. `params` and `searchParams` are now Promises
2. Caching behavior changes
3. Updated fetch caching defaults

### React 18 → 19 Breaking Changes
- Mostly additive
- `use` hook is new feature
- Server Components improvements

---

**End of Implementation Plan**

**Document Status:** Ready for Review
**Next Action:** Obtain approvals and begin Phase 1
