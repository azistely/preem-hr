# Option B Architecture: Template References with Overrides

**Status:** ✅ In Progress (Core infrastructure complete)
**Date:** 2025-10-07

---

## 🎯 Architecture Overview

### Single Source of Truth Principle

```
┌─────────────────────────────────────────────────┐
│   salary_component_templates                     │
│   (Law - Managed by Super Admin)                │
│                                                  │
│   - Tax treatment (Code Général des Impôts)     │
│   - CNPS rules (Décret CNPS)                    │
│   - Legal formulas (Convention Collective)       │
│   - compliance_level (locked/configurable/free) │
│   - customizable_fields (what can be modified)  │
└─────────────────────────────────────────────────┘
                      ↓ Reference
┌─────────────────────────────────────────────────┐
│   tenant_salary_component_activations            │
│   (Tenant Choice - Customizations Only)          │
│                                                  │
│   - template_code (FK to template)               │
│   - overrides JSONB (ONLY customizable fields)  │
│     Example: {"calculationRule": {"rate": 0.25}}│
│   - custom_name (optional display name)          │
│   - is_active, display_order                     │
└─────────────────────────────────────────────────┘
                      ↓ Runtime Merge
┌─────────────────────────────────────────────────┐
│   Merged Component (In-Memory)                   │
│                                                  │
│   Base: Template metadata (law)                  │
│   + Overrides: Activation customizations         │
│   = Ready for payroll calculation                │
└─────────────────────────────────────────────────┘
```

---

## 📋 Implementation Status

### ✅ Completed

1. **Database Schema** (`tenantSalaryComponentActivations` table)
   - Columns: `tenant_id`, `template_code`, `overrides`, `custom_name`, `is_active`
   - Foreign key to `salary_component_templates` (ON DELETE RESTRICT)
   - RLS policy for tenant isolation
   - Migration complete with data backfill from `custom_salary_components`

2. **Template Merger Service** (`lib/salary-components/template-merger.ts`)
   - `mergeTemplateWithOverrides()` - Deep merge template + overrides
   - `mergeTemplatesWithActivations()` - Batch merge for multiple components
   - `validateOverrides()` - Ensure overrides only contain customizable fields
   - `deepMerge()` utility for nested object merging

3. **tRPC Router Updates**
   - `getCustomComponents` - Now fetches activations + templates, returns merged components
   - Migration imports and type updates

### 🚧 In Progress

4. **`addFromTemplate` Migration**
   - Change: Create activation instead of copying to custom_salary_components
   - Validation: Ensure overrides only contain customizable fields

5. **`updateCustomComponent` Migration**
   - Change: Update activation.overrides instead of custom_salary_components.metadata
   - Validation: Check compliance rules before saving

### ⏳ Pending

6. **UI Adaptation**
   - Update `/settings/salary-components/page.tsx` to use new activation system
   - Update edit page to only show customizable fields
   - Rename "Mes composants" → "Composants actifs"

7. **Payroll Calculation Integration**
   - Ensure `calculatePayrollV2()` works with merged components
   - Test end-to-end payroll with new architecture

8. **Migration Script**
   - Data migration from `custom_salary_components` ✅ (done in SQL migration)
   - Code cleanup: Remove old custom_salary_components usage

9. **Testing**
   - Unit tests for template merger
   - Integration tests for tRPC endpoints
   - Playwright E2E tests

---

## 🔑 Key Benefits

### 1. **Law Changes are Instant**
```sql
-- Update housing allowance tax treatment for all tenants
UPDATE salary_component_templates
SET metadata = jsonb_set(
  metadata,
  '{taxTreatment,includeInBrutImposable}',
  'true'::jsonb
)
WHERE code = 'TPT_HOUSING_CI';

-- ✅ All tenants get the update immediately at next payroll run
-- No need to update 1000s of custom_salary_components rows
```

### 2. **Prevents Compliance Drift**
- Template defines law → Cannot drift over time
- Activations only store deltas → Easy to audit
- Overrides are validated → Cannot modify forbidden fields

### 3. **Simplified Data Model**
- Before: `custom_salary_components` had duplicate tax treatment data
- After: `tenant_salary_component_activations` only stores `{"rate": 0.25}`
- Smaller database, faster backups, easier to understand

### 4. **Audit Trail**
```sql
-- See what each tenant customized
SELECT
  tenant_id,
  template_code,
  overrides,
  custom_name
FROM tenant_salary_component_activations
WHERE template_code = 'TPT_HOUSING_CI';

-- Result:
-- tenant_id | template_code | overrides | custom_name
-- uuid-123  | TPT_HOUSING_CI | {"calculationRule":{"rate":0.25}} | NULL
-- uuid-456  | TPT_HOUSING_CI | {"calculationRule":{"rate":0.30}} | "Logement Abidjan"
```

---

## 📊 Example: Housing Allowance

### Template (Law - Single Source of Truth)
```json
{
  "code": "TPT_HOUSING_CI",
  "name": {"fr": "Indemnité de logement"},
  "compliance_level": "configurable",
  "customizable_fields": ["calculationRule.rate"],
  "metadata": {
    "category": "allowance",
    "taxTreatment": {
      "isTaxable": true,
      "includeInBrutImposable": true,
      "includeInSalaireCategoriel": false
    },
    "socialSecurityTreatment": {
      "includeInCnpsBase": false
    },
    "calculationRule": {
      "type": "percentage",
      "rate": 0.25,  // Default 25%
      "baseComponent": "salaire_de_base"
    }
  }
}
```

### Tenant Activation (Choice - Customization)
```json
{
  "tenant_id": "uuid-123",
  "template_code": "TPT_HOUSING_CI",
  "overrides": {
    "calculationRule": {
      "rate": 0.28  // Tenant chose 28% instead of 25%
    }
  },
  "custom_name": null,  // Using template name
  "is_active": true
}
```

### Merged Component (Runtime)
```json
{
  "code": "TPT_HOUSING_CI",
  "name": "Indemnité de logement",
  "category": "allowance",
  "taxTreatment": {
    "isTaxable": true,  // ← From template (law)
    "includeInBrutImposable": true,  // ← From template (law)
    "includeInSalaireCategoriel": false  // ← From template (law)
  },
  "socialSecurityTreatment": {
    "includeInCnpsBase": false  // ← From template (law)
  },
  "calculationRule": {
    "type": "percentage",
    "rate": 0.28,  // ← From activation (customization)
    "baseComponent": "salaire_de_base"
  }
}
```

---

## 🚨 Critical Rules

### 1. **Never Allow Tax Treatment Customization**
```typescript
// ❌ FORBIDDEN - Will be rejected by validateOverrides()
const activation = {
  overrides: {
    taxTreatment: { isTaxable: false }  // ← ILLEGAL
  }
};

// ✅ ALLOWED - Only customizable fields
const activation = {
  overrides: {
    calculationRule: { rate: 0.28 }  // ← LEGAL (in customizableFields)
  }
};
```

### 2. **Overrides Must Be Validated**
```typescript
// Before saving activation
const validation = validateOverrides(
  overrides,
  template.customizableFields
);

if (!validation.valid) {
  throw new Error(validation.error);
}
```

### 3. **Always Merge at Runtime**
```typescript
// ❌ DON'T cache merged components in database
// ✅ DO merge on-the-fly when needed

const activations = await fetchActivations(tenantId);
const templates = await fetchTemplates(templateCodes);
const merged = mergeTemplatesWithActivations(templates, activations);
```

---

## 🔄 Migration Path

### Phase 1: Parallel Operation (Current)
- ✅ `tenant_salary_component_activations` table created
- ✅ Data migrated from `custom_salary_components`
- ✅ `getCustomComponents` uses new system
- 🚧 `addFromTemplate`, `updateCustomComponent` still use old system

### Phase 2: Full Migration
- Update all tRPC endpoints to use activations
- Update UI to only show customizable fields
- Update payroll calculation to expect merged components

### Phase 3: Cleanup
- Mark `custom_salary_components` as deprecated
- Remove unused code
- Update documentation

---

## 📝 Next Steps

1. **Complete tRPC Migration**
   - `addFromTemplate` → Create activation
   - `updateCustomComponent` → Update activation.overrides
   - Add compliance validation to both

2. **UI Updates**
   - Edit page: Only show customizable fields
   - List page: Show compliance badges
   - Add "This field is defined by law" hints for locked fields

3. **Testing**
   - Write unit tests for template-merger.ts
   - Test all compliance levels (locked, configurable, freeform)
   - E2E test with Playwright

4. **Documentation**
   - API documentation for new endpoints
   - Developer guide for adding new templates
   - User guide: "What can I customize?"

---

## 🎓 Key Learnings

### Why Option B is Better Long-Term

1. **Regulatory Compliance**: Law changes affect everyone instantly
2. **Data Integrity**: Single source of truth prevents drift
3. **Auditability**: Easy to see what each tenant customized
4. **Performance**: Smaller database (only deltas stored)
5. **Maintainability**: Clear separation: template = law, activation = choice

### Trade-offs Accepted

1. **Slightly More Complex Queries**: Join activations + templates
2. **Runtime Merge Overhead**: Acceptable (happens in-memory, fast)
3. **Migration Effort**: One-time cost for long-term benefits

---

**Author:** Claude Code
**Last Updated:** 2025-10-07
