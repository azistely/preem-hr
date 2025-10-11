# Pre-Deployment Checklist for Preem HR

> **Run these checks before pushing to production to catch build errors early**

## 🚀 Quick Pre-Push Check

Run this command before every `git push`:

```bash
npm run build:test
```

This will:
1. ✅ Check TypeScript errors (`tsc --noEmit`)
2. ✅ Run Next.js production build (`next build`)

---

## 🔍 Comprehensive Pre-Deployment Workflow

### 1️⃣ **Type Check** (Required)
Catch TypeScript errors before they break the build:

```bash
npm run type-check
```

**What it checks:**
- Type errors in all `.ts` and `.tsx` files
- Interface/type compatibility issues
- Missing imports or incorrect type assertions

**Fix issues before proceeding!**

---

### 2️⃣ **Local Build** (Required)
Test the production build locally:

```bash
npm run build
```

**What it checks:**
- Next.js compilation errors
- Route conflicts
- Bundle size issues
- Missing dependencies

**Expected output:** Should complete without errors and show bundle sizes.

---

### 3️⃣ **Lint Check** (Recommended)
Ensure code quality standards:

```bash
npm run lint
```

**Auto-fix issues:**
```bash
npm run lint:fix
```

---

### 4️⃣ **Test Production Build Locally** (Optional but Recommended)
Run the built application to verify functionality:

```bash
npm run build && npm run start
```

Then visit: `http://localhost:3000`

**Manual checks:**
- [ ] Login works
- [ ] Dashboard loads
- [ ] Employee list renders
- [ ] Payroll calculations work
- [ ] No console errors

---

## 🎯 Vercel-Specific Testing (Advanced)

### Install Vercel CLI (One-time setup)

```bash
npm install -g vercel
```

### Link Project to Vercel (One-time setup)

```bash
vercel link
```

This will ask you to select your team and project.

### Pull Environment Variables

```bash
npm run vercel:pull
# or
vercel env pull
```

This creates `.env.local` with your Vercel development environment variables.

### Test with Vercel Build System

```bash
npm run build:vercel
# or
vercel build
```

**What this does:**
- Replicates Vercel's exact build process
- Uses Build Output API (`.vercel/output` folder)
- Tests with correct environment variables

**Inspect build output:**
```bash
ls -la .vercel/output
```

### Run Vercel Dev Environment

```bash
npm run vercel:dev
# or
vercel dev
```

**What this does:**
- Runs local server with Vercel Functions
- Tests Middleware locally
- Tests Edge Functions
- Uses Vercel environment variables

---

## 📋 Pre-Commit Hooks (Automatic)

The project has Husky configured to run checks automatically on commit:

**Current hooks:**
- Type check on staged files
- Lint staged files

**Location:** `.husky/pre-commit`

---

## 🐛 Common Build Errors & Fixes

### ❌ TypeScript Errors

**Error:**
```
Type error: Property 'xyz' does not exist on type 'ABC'
```

**Fix:**
```bash
npm run type-check
# Fix the reported errors in your IDE
```

---

### ❌ Missing Environment Variables

**Error:**
```
Error: DATABASE_URL environment variable is required
```

**Fix:**
```bash
# Pull from Vercel
vercel env pull

# Or create .env.local manually with required variables
```

---

### ❌ Build Memory Issues

**Error:**
```
FATAL ERROR: Reached heap limit Allocation failed
```

**Fix:**
Add to `package.json`:
```json
{
  "scripts": {
    "build": "NODE_OPTIONS='--max_old_space_size=4096' next build"
  }
}
```

---

### ❌ Module Resolution Errors

**Error:**
```
Module not found: Can't resolve '@/lib/xyz'
```

**Fix:**
1. Check `tsconfig.json` paths are correct
2. Verify the file exists
3. Check import path casing (case-sensitive in production)

---

## ✅ Deployment Checklist

Before deploying to production, verify:

- [ ] All TypeScript errors fixed (`npm run type-check`)
- [ ] Build completes successfully (`npm run build`)
- [ ] No lint errors (`npm run lint`)
- [ ] Tests pass (if applicable)
- [ ] Environment variables configured in Vercel dashboard
- [ ] Database migrations applied (if needed)
- [ ] `.env.local` has all required variables for local testing

---

## 🔄 Recommended Git Workflow

### Before Committing

```bash
# 1. Type check
npm run type-check

# 2. If errors, fix them and run again
# 3. Stage your changes
git add .

# 4. Commit (hooks will run automatically)
git commit -m "fix: your changes"
```

### Before Pushing

```bash
# Run full build test
npm run build:test

# If successful, push
git push
```

---

## 🛠️ Troubleshooting Commands

### Clear Next.js cache
```bash
rm -rf .next
npm run build
```

### Clear Vercel cache
```bash
rm -rf .vercel
vercel build
```

### Reset node_modules
```bash
rm -rf node_modules package-lock.json
npm install
```

### Check specific file for TypeScript errors
```bash
npx tsc --noEmit path/to/file.tsx
```

---

## 📚 Quick Reference

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run type-check` | Check TypeScript | Before commit/push |
| `npm run build` | Production build | Before push |
| `npm run build:test` | Type check + build | Before push (comprehensive) |
| `npm run lint` | Check code quality | Before commit |
| `npm run vercel:pull` | Get env variables | First time / when env changes |
| `npm run build:vercel` | Vercel-style build | Debugging Vercel issues |
| `npm run vercel:dev` | Test locally with Vercel | Testing serverless functions |

---

## 🎓 Best Practices

1. **Always run `npm run build:test` before pushing**
2. **Keep `.env.local` synced with Vercel** (`vercel env pull`)
3. **Test production build locally** before deploying
4. **Check Vercel build logs** if deployment fails
5. **Use `vercel build` to debug** Vercel-specific issues

---

## 🆘 Need Help?

- Check Vercel build logs: https://vercel.com/dashboard
- Review this checklist: `PRE-DEPLOY-CHECKLIST.md`
- Run local diagnostics: `npm run build:test`
