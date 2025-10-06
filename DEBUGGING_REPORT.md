# RuleLoader Debugging Report
**Date**: 2025-10-05
**Issue**: `ruleLoader.getCountryConfig('CI')` failing for all countries

## Summary
✅ **Database has all required data**
❌ **Drizzle ORM schema has broken relations causing runtime errors**

## Root Cause
Drizzle's relational query builder (`db.query.*`) cannot initialize due to:
1. Missing `usersInAuth` table referenced in relations
2. Invalid self-referencing foreign key in `users` table
3. PostGIS system views in schema exports
4. Schema/relations mismatch preventing query execution

## Database Verification (All Pass ✅)
```sql
-- All checks return data:
Country Check: PASS (1 record)
Tax System Check: PASS (1 record)
Tax Brackets Check: PASS (6 records)
Family Deductions Check: PASS (9 records)
Social Security Scheme Check: PASS (1 record)
Contribution Types Check: PASS (4 records)
Other Taxes Check: PASS (2 records)
```

## Fixes Applied
1. ✅ Removed `usersInAuth` from relations.ts
2. ✅ Commented out invalid self-referencing FK in users table
3. ✅ Removed PostGIS views from schema exports
4. ⚠️ **Still failing** - Drizzle query builder has deeper initialization issues

## Immediate Solution
**Replace Drizzle relational queries with raw SQL queries** in RuleLoader

See: `/Users/admin/Sites/preem-hr/features/payroll/services/rule-loader-fixed.ts`

## Long-term Solution
Regenerate Drizzle schema from scratch:
```bash
# Delete current schema files
rm drizzle/schema.ts drizzle/relations.ts

# Regenerate from database
npx drizzle-kit introspect

# Manually remove PostGIS views and invalid FKs
```

## Test Command
```bash
npx tsx test-rule-loader.ts
```
