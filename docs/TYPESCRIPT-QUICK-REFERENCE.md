# TypeScript Quick Reference Card

> 🚨 **Keep this open while coding!** Common pitfalls and quick fixes.

## ⚡ Before You Code

```bash
# 1. Check the schema FIRST
cat drizzle/schema.ts | grep -A 20 "export const yourTable"

# 2. Run type-check in watch mode
npx tsc --noEmit --watch

# 3. Before commit
npm run type-check
```

## 🔥 Most Common Errors & Quick Fixes

### 1. "Property 'X' does not exist on type 'Y'"

```typescript
// ❌ DON'T guess what fields exist
const name = employee.fullName; // Error!

// ✅ DO check schema first
// drizzle/schema.ts shows: firstName, lastName (NOT fullName)
const name = `${employee.firstName} ${employee.lastName}`;
```

### 2. Drizzle Relations Type Error

```typescript
// ❌ DON'T use with: relations (causes type errors)
const data = await db.query.assignments.findMany({
  with: { position: true }, // TypeScript error
});

// ✅ DO use manual joins
const data = await db
  .select({
    id: assignments.id,
    positionId: assignments.positionId,
    position: positions, // Join the whole table
  })
  .from(assignments)
  .leftJoin(positions, eq(assignments.positionId, positions.id));
```

### 3. "Object is possibly 'undefined'"

```typescript
// ❌ DON'T access without checking
const formatted = amount.toFixed(2); // Crashes if undefined

// ✅ DO use nullish coalescing or optional chaining
const formatted = (amount ?? 0).toFixed(2);
const formatted = amount?.toFixed(2) ?? '0.00';
```

### 4. Date Type Mismatch

```typescript
// ❌ DON'T pass strings when Date expected
mutation.mutate({ hireDate: "2025-01-01" }); // Type error

// ✅ DO normalize to Date
mutation.mutate({
  hireDate: data.hireDate instanceof Date
    ? data.hireDate
    : new Date(data.hireDate)
});

// ✅ BEST: Use Zod coercion
const schema = z.object({
  hireDate: z.coerce.date(), // Auto-converts strings
});
```

### 5. "Type 'X' is not assignable to type 'Y'"

```typescript
// ❌ DON'T use 'as any' to bypass
const result = await mutation.mutateAsync(data as any);

// ✅ DO fix the type properly
type EmployeeInput = z.infer<typeof employeeSchema>;
const data: EmployeeInput = { /* ... */ };
const result = await mutation.mutateAsync(data);
```

## 📋 Checklist Before Every Commit

```bash
✅ npm run type-check     # MUST pass
✅ npm run lint           # MUST pass
✅ No 'as any' in code    # Use proper types
✅ No '// @ts-ignore'     # Fix the root cause
```

## 🎯 Quick Type Recipes

### Get type from schema
```typescript
import { employees } from '@/drizzle/schema';

type Employee = typeof employees.$inferSelect;
type NewEmployee = typeof employees.$inferInsert;
```

### Get tRPC return type
```typescript
type Employees = Awaited<
  ReturnType<typeof api.employees.list.useQuery>
>['data'];
```

### Handle optional in component
```typescript
interface Props {
  salary?: number;
  name?: string;
}

function Component({ salary, name }: Props) {
  // ✅ Always provide fallback
  return (
    <div>
      <p>{name ?? 'Unknown'}</p>
      <p>{salary?.toFixed(2) ?? '0.00'}</p>
    </div>
  );
}
```

### Type form with Zod
```typescript
const formSchema = z.object({
  firstName: z.string().min(1),
  salary: z.number().min(75000),
});

type FormData = z.infer<typeof formSchema>;

function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: FormData) => {
    // data is fully typed!
  };
}
```

## 🚨 NEVER Do These

```typescript
// ❌ NEVER bypass types
const x = y as any;
// @ts-ignore
const z = broken();

// ❌ NEVER assume optional exists
employee.middleName.toUpperCase(); // Crash!

// ❌ NEVER use 'with' relations in tRPC
with: { position: true } // Type error

// ❌ NEVER commit without type-check
git commit -m "fix" // Missing: npm run type-check
```

## ✅ ALWAYS Do These

```typescript
// ✅ ALWAYS check schema first
// Look at drizzle/schema.ts

// ✅ ALWAYS handle undefined
value ?? defaultValue
value?.property

// ✅ ALWAYS use manual joins
.select({ ... })
.leftJoin(...)

// ✅ ALWAYS run type-check
npm run type-check
```

## 🔍 Debugging Commands

```bash
# See what type this is
npx tsc --noEmit --pretty

# Check specific file
npx tsc --noEmit path/to/file.ts

# See actual error location
npx tsc --noEmit 2>&1 | less
```

## 💡 Pro Tips

1. **Hover in VS Code** - Shows inferred type
2. **Cmd+Click** - Jump to type definition
3. **Use Error Lens extension** - See errors inline
4. **Let TypeScript infer** - Don't over-annotate

---

**When in doubt:** Check `docs/TYPESCRIPT-BEST-PRACTICES.md` for full guide.
