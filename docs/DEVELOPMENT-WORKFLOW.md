# Development Workflow

## 🚀 Getting Started

### Development Modes

#### Standard Development (Fast)
```bash
npm run dev
```
- Next.js dev server with Turbopack
- Hot module reloading
- **No type checking** (IDE only)
- Fast iteration for prototyping

#### Safe Development (Recommended)
```bash
npm run dev:safe
```
- Next.js dev server + TypeScript watch mode
- **Continuous type checking** in terminal
- Catches type errors immediately
- Best for production-ready code

### Type Checking

#### Manual Type Check
```bash
npm run type-check
```
- One-time type check across entire codebase
- Runs same validation as build

#### Watch Mode
```bash
npm run type-check:watch
```
- Continuous type checking
- Updates as you edit files
- Use in separate terminal window

### Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

## 🛡️ Pre-Commit Hooks

We use **Husky** + **lint-staged** to enforce code quality before commits.

### What Runs on Commit

1. **Type checking** - Full project type validation
2. **Linting** - ESLint with auto-fix

### Configuration

- `.husky/pre-commit` - Hook entry point
- `.lintstagedrc.js` - Staged file validation config

### Bypass Hook (Emergency Only)

```bash
git commit --no-verify -m "Emergency fix"
```

⚠️ **Warning**: Only use `--no-verify` for critical hotfixes. All bypassed commits should be fixed in next commit.

## 🏗️ Building

### Production Build

```bash
npm run build
```

This will:
1. Compile TypeScript (strict mode)
2. Run ESLint validation
3. Generate optimized Next.js build
4. **Fail** if any type/lint errors exist

### Build Output

```
✓ Compiled successfully in X.Xs
✓ Linting and checking validity of types
✓ Creating an optimized production build
```

## 📝 Type Safety Best Practices

### 1. Create Proper Type Definitions

Instead of using `as any`:

```typescript
// ❌ Bad - Loses all type safety
const stats = data as any;
stats.unknownProperty; // No error!

// ✅ Good - Define proper interface
interface WorkflowStats {
  executionCount: number;
  successRate: number;
  successCount: number;
  errorCount: number;
}
const stats = data as WorkflowStats;
stats.executionCount; // Type-safe!
```

### 2. Type Location Convention

```
/features/{feature}/types/{type}.ts
```

Examples:
- `/features/workflows/types/workflow-stats.ts`
- `/features/time-off/types/time-off.ts`
- `/features/time-tracking/types/overtime.ts`

### 3. Export Types for Reuse

```typescript
// In type definition file
export interface TimeOffPolicy {
  id: string;
  name: string;
  // ...
}

// In consuming file
import type { TimeOffPolicy } from '@/features/time-off/types/time-off';
```

## 🔧 Troubleshooting

### "Types not found" error

```bash
# Regenerate TypeScript project references
npm run type-check
```

### Pre-commit hook failing

```bash
# Check what's failing
npm run type-check
npm run lint

# Fix issues manually, then commit again
```

### Build succeeds but IDE shows errors

```bash
# Restart TypeScript server in VS Code
# Cmd+Shift+P → "TypeScript: Restart TS Server"
```

## 📚 Related Documentation

- **Type Definitions**: See `/features/{feature}/types/` directories
- **Project Constraints**: See `docs/01-CONSTRAINTS-AND-RULES.md`
- **HCI Principles**: See `docs/HCI-DESIGN-PRINCIPLES.md`

## 🎯 Quick Reference

| Command | Use Case |
|---------|----------|
| `npm run dev` | Fast prototyping |
| `npm run dev:safe` | **Production development** |
| `npm run type-check` | Manual validation |
| `npm run lint:fix` | Fix linting issues |
| `npm run build` | Production build test |
| `git commit` | Auto-validates before commit |

---

**Remember**: Type safety is not a burden—it's what allows us to ship features confidently without breaking existing functionality.
