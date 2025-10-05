# tRPC SSR Hydration Usage Guide

This document explains how to use tRPC v11 Server-Side Rendering (SSR) with React Query hydration in Next.js App Router.

## Overview

Our tRPC setup supports two main patterns:

1. **SSR with Hydration** - Prefetch data on server, hydrate to client
2. **Direct Server Calls** - Fetch data only on server (no client hydration)

## Pattern 1: SSR with Hydration (Recommended for Client Components)

Use this when you want to:
- Prefetch data on the server for faster initial load
- Make the same data available to client components
- Avoid waterfall requests

### Example: Server Component with Hydration

```tsx
// app/payroll/runs/[id]/page.tsx
import { trpc, HydrateClient } from '@/trpc/server';
import { PayrollRunDetails } from './payroll-run-details';

export default async function PayrollRunPage({
  params
}: {
  params: { id: string }
}) {
  // Prefetch on server (doesn't wait for completion)
  void trpc.payroll.getRunById.prefetch({ runId: params.id });

  return (
    <HydrateClient>
      <PayrollRunDetails runId={params.id} />
    </HydrateClient>
  );
}
```

### Client Component Consuming Hydrated Data

```tsx
// app/payroll/runs/[id]/payroll-run-details.tsx
'use client';

import { api } from '@/trpc/react';

export function PayrollRunDetails({ runId }: { runId: string }) {
  // This will use the prefetched data from server
  const { data, isLoading } = api.payroll.getRunById.useQuery({ runId });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      {/* ... */}
    </div>
  );
}
```

## Pattern 2: Direct Server Calls (Server-Only Data)

Use this when you:
- Only need data on the server
- Don't need to pass data to client components
- Want to avoid client bundle size

### Example: Server-Only Data Fetching

```tsx
// app/dashboard/page.tsx
import { trpc } from '@/trpc/server';

export default async function DashboardPage() {
  // Direct call - data stays on server
  const stats = await trpc.payroll.getStats();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total Runs: {stats.totalRuns}</p>
      <p>Total Employees: {stats.totalEmployees}</p>
    </div>
  );
}
```

## Pattern 3: Prefetch with Suspense

For better loading UX with React Suspense:

```tsx
// app/employees/page.tsx
import { trpc, HydrateClient } from '@/trpc/server';
import { Suspense } from 'react';
import { EmployeeList } from './employee-list';

export default async function EmployeesPage() {
  void trpc.employees.getAll.prefetch({ tenantId: 'tenant_123' });

  return (
    <HydrateClient>
      <Suspense fallback={<div>Loading employees...</div>}>
        <EmployeeList tenantId="tenant_123" />
      </Suspense>
    </HydrateClient>
  );
}
```

## Key Concepts

### HydrateClient Component

- Wraps client components that will consume prefetched data
- Automatically transfers React Query cache from server to client
- Should wrap the minimum necessary components (not the entire app)

### Prefetch vs Direct Call

```tsx
// Prefetch - fires request, doesn't wait for result
void trpc.post.byId.prefetch({ id: '1' });

// Direct call - awaits result
const post = await trpc.post.byId({ id: '1' });
```

### Query Client Caching

The `getQueryClient` helper is cached per-request:

```typescript
// trpc/server.ts
export const getQueryClient = cache(createQueryClient);
```

This ensures:
- Same query client instance throughout the request
- No duplicate queries during SSR
- Proper deduplication with React `cache`

## Best Practices

### ✅ DO

- Use `HydrateClient` only where needed
- Prefetch data that client components will use
- Use direct calls for server-only data
- Combine with Suspense for better UX

### ❌ DON'T

- Don't wrap the entire app in `HydrateClient`
- Don't prefetch data that's only used on server
- Don't forget `void` when prefetching (fire-and-forget)
- Don't mix prefetch and direct calls for the same query

## Migration from Old Pattern

### Before (Old Pattern)

```typescript
// ❌ Old pattern - no hydration
export const serverClient = appRouter.createCaller({});
export const api = serverClient;
```

### After (New Pattern)

```typescript
// ✅ New pattern - with hydration
export const { trpc, HydrateClient } = createHydrationHelpers<typeof appRouter>(
  caller,
  getQueryClient,
);
export const api = trpc; // backward compatibility
```

## References

- [tRPC v11 React Query/RSC](https://trpc.io/docs/client/react/server-components)
- [Next.js App Router Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [React Query Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)
