# TypeScript Best Practices for Preem HR

> Guidelines for writing type-safe, maintainable TypeScript code to avoid common errors

## Core Principles

1. **Let TypeScript infer types** - Don't fight the type system
2. **Use the schema as source of truth** - Types should flow from database schema
3. **Avoid `any`** - Use `unknown` or proper types
4. **Test type safety** - Run `npm run type-check` before committing

## Common Issues and Solutions

### Issue 1: Drizzle ORM Relations Type Errors

**Problem:** Using `db.query.table.findMany({ with: { relation: true } })` can cause TypeScript errors if relations aren't properly inferred.

**❌ Bad:**
```typescript
const history = await db.query.assignments.findMany({
  with: {
    position: true, // TypeScript error: property 'position' doesn't exist
  },
});
```

**✅ Good - Use manual joins:**
```typescript
const history = await db
  .select({
    // Explicitly select all fields you need
    id: assignments.id,
    employeeId: assignments.employeeId,
    positionId: assignments.positionId,
    // Include the related table
    position: positions,
  })
  .from(assignments)
  .leftJoin(positions, eq(assignments.positionId, positions.id))
  .where(eq(assignments.employeeId, employeeId));
```

**Why this is better:**
- Explicit about what fields you're selecting
- TypeScript knows exactly what shape the data will be
- No reliance on type inference that might break
- Easier to debug - you see exactly what SQL is being generated

### Issue 2: Date Handling

**Problem:** Database returns date strings, TypeScript expects Date objects.

**❌ Bad:**
```typescript
const result = await createEmployee({
  hireDate: data.hireDate, // Might be string or Date
});
```

**✅ Good - Always normalize:**
```typescript
const result = await createEmployee({
  hireDate: data.hireDate instanceof Date
    ? data.hireDate
    : new Date(data.hireDate),
});
```

**Even better - Use Zod transformation:**
```typescript
const schema = z.object({
  hireDate: z.coerce.date(), // Auto-converts strings to Date
});
```

### Issue 3: Missing Required Fields

**Problem:** Accessing fields that don't exist in the schema.

**❌ Bad:**
```typescript
// Assumes updatedAt exists
return {
  ...employee,
  updatedAt: employee.updatedAt, // Error if field doesn't exist
};
```

**✅ Good - Check schema first:**
```typescript
// Before writing code, check drizzle/schema.ts:
// export const employees = pgTable("employees", {
//   id: uuid()...
//   createdAt: timestamp()...
//   // NO updatedAt field!
// });

return {
  ...employee,
  createdAt: employee.createdAt, // Use only fields that exist
};
```

**Best - Use TypeScript to enforce:**
```typescript
// Let TypeScript tell you what fields exist
const employee: typeof employees.$inferSelect = await getEmployee();
// Now TypeScript autocomplete shows only real fields
```

### Issue 4: Optional vs Required Fields

**Problem:** Treating optional fields as required.

**❌ Bad:**
```typescript
function formatCurrency(amount: number) {
  return amount.toFixed(2); // Crashes if amount is undefined
}

// Usage:
formatCurrency(payslip.cmuEmployee); // cmuEmployee is optional!
```

**✅ Good - Handle undefined:**
```typescript
function formatCurrency(amount: number | undefined): string {
  return (amount ?? 0).toFixed(2);
}

// Or use optional chaining:
const formatted = payslip.cmuEmployee?.toFixed(2) ?? '0.00';
```

### Issue 5: Type Assertions (`as any`)

**Problem:** Using `as any` to bypass type errors.

**❌ Bad:**
```typescript
const result = await mutation.mutateAsync(data as any);
// Hides type errors, will fail at runtime
```

**✅ Good - Fix the types:**
```typescript
// Define proper types
type EmployeeInput = {
  firstName: string;
  lastName: string;
  hireDate: Date;
};

const data: EmployeeInput = {
  firstName: 'John',
  lastName: 'Doe',
  hireDate: new Date(),
};

const result = await mutation.mutateAsync(data);
// TypeScript verifies this at compile time
```

## tRPC-Specific Best Practices

### 1. Always define input schemas with Zod

**❌ Bad:**
```typescript
myProcedure.mutation(async ({ input }) => {
  // input is 'any', no validation
  const result = await doSomething(input);
});
```

**✅ Good:**
```typescript
myProcedure
  .input(z.object({
    employeeId: z.string().uuid(),
    salary: z.number().min(75000),
  }))
  .mutation(async ({ input }) => {
    // input is typed and validated
    const result = await doSomething(input);
  });
```

### 2. Use proper error types

**❌ Bad:**
```typescript
} catch (error) {
  throw new Error(error.message); // error is 'unknown'
}
```

**✅ Good:**
```typescript
} catch (error: unknown) {
  const message = error instanceof Error
    ? error.message
    : 'Une erreur inconnue est survenue';

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message,
  });
}
```

### 3. Return consistent shapes

**❌ Bad:**
```typescript
if (success) {
  return { employee, payslip }; // Different shape
} else {
  return { error: 'Failed' }; // from success case
}
```

**✅ Good:**
```typescript
// Define return type
type CreateEmployeeResult = {
  success: boolean;
  employee?: Employee;
  payslip?: Payslip;
  error?: string;
};

// Use it consistently
if (success) {
  return { success: true, employee, payslip };
} else {
  return { success: false, error: 'Failed' };
}
```

## React/Next.js Best Practices

### 1. Type component props properly

**❌ Bad:**
```typescript
export function EmployeeCard({ employee }: any) {
  return <div>{employee.firstName}</div>;
}
```

**✅ Good:**
```typescript
interface EmployeeCardProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  return <div>{employee.firstName}</div>;
}
```

**Best - Derive from schema:**
```typescript
import { employees } from '@/drizzle/schema';

type Employee = typeof employees.$inferSelect;

interface EmployeeCardProps {
  employee: Employee;
}
```

### 2. Handle loading and error states

**❌ Bad:**
```typescript
const { data } = api.employees.get.useQuery({ id });
return <div>{data.firstName}</div>; // Crashes if data is undefined
```

**✅ Good:**
```typescript
const { data, isLoading, error } = api.employees.get.useQuery({ id });

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
if (!data) return <NotFound />;

return <div>{data.firstName}</div>;
```

### 3. Type form data properly

**❌ Bad:**
```typescript
const onSubmit = (data: any) => {
  mutation.mutate(data);
};
```

**✅ Good:**
```typescript
// Define form schema with Zod
const formSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  salary: z.number().min(75000),
});

type FormData = z.infer<typeof formSchema>;

const onSubmit = (data: FormData) => {
  mutation.mutate(data); // Type-safe
};
```

## Type-Checking Workflow

### Before Every Commit

```bash
# 1. Run type checker
npm run type-check

# 2. If errors, fix them (don't use 'as any')

# 3. Run linter
npm run lint

# 4. Commit
git commit -m "your message"
```

### During Development

```bash
# Run type checker in watch mode
npx tsc --noEmit --watch

# In another terminal, run dev server
npm run dev
```

## Common TypeScript Errors and Fixes

### Error: "Property doesn't exist on type"

```typescript
// Error: Property 'position' does not exist on type 'Assignment'

// Fix: Check what properties actually exist
type Assignment = typeof assignments.$inferSelect;
// Then only use properties that are in the schema
```

### Error: "Type 'string' is not assignable to type 'Date'"

```typescript
// Error when passing date string to function expecting Date

// Fix: Convert strings to Date
const date = new Date(dateString);

// Or update function to accept both
function processDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  // ...
}
```

### Error: "Object is possibly 'undefined'"

```typescript
// Error: Cannot read property 'firstName' of undefined

// Fix: Check for undefined
if (employee) {
  console.log(employee.firstName);
}

// Or use optional chaining
console.log(employee?.firstName);

// Or provide default
console.log(employee?.firstName ?? 'Unknown');
```

### Error: "Argument of type 'X' is not assignable to parameter of type 'Y'"

```typescript
// Error: Type mismatch in function call

// Fix: Check function signature and ensure types match
// Don't use 'as any' to bypass - fix the actual types

// Example:
const input = {
  employeeId: '123',
  salary: 100000,
};

// If function expects { employeeId: string; salary: number }
// Make sure input matches exactly
```

## IDE Setup for Better TypeScript

### VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Recommended Extensions

- ESLint
- Prettier
- Error Lens (shows errors inline)
- Pretty TypeScript Errors

## Debugging Type Errors

### Technique 1: Hover to See Type

```typescript
// Hover over 'result' to see what TypeScript thinks it is
const result = await mutation.mutateAsync(data);
//    ^^^^^
```

### Technique 2: Explicit Type Annotation

```typescript
// Add explicit type to see where mismatch is
const data: EmployeeInput = {
  firstName: 'John',
  // TypeScript will error on missing fields
};
```

### Technique 3: Use Type Helpers

```typescript
// See what type this is
type WhatIsThis = typeof employees.$inferSelect;

// See what a function returns
type ReturnType = Awaited<ReturnType<typeof getEmployee>>;
```

## Summary

**Key Rules:**
1. ✅ Use manual joins instead of Drizzle relations when types are unclear
2. ✅ Always check schema before accessing fields
3. ✅ Handle optional fields explicitly (use `??`, `?.`)
4. ✅ Define Zod schemas for all inputs
5. ✅ Run `npm run type-check` before committing
6. ✅ Never use `as any` - fix the root cause
7. ✅ Let TypeScript infer from schema (`$inferSelect`)
8. ✅ Use explicit types for function parameters

**Remember:** TypeScript errors are caught at compile time. Runtime errors happen in production. Invest time in types to save debugging time later.

---

**For Claude Code:** When writing TypeScript:
1. Check `drizzle/schema.ts` for available fields before writing queries
2. Use manual `.select()` + `.leftJoin()` instead of `with:` relations
3. Always handle optional fields with `??` or `?.`
4. Run `npx tsc --noEmit` after making changes
5. Don't use `as any` - ask the user if types are unclear
