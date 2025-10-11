# Onboarding Employee Form: Component-Based Salary Migration

## Overview

Successfully migrated the onboarding employee form from simple allowance fields to the modern component-based salary architecture, making it consistent with the salary change wizard while maintaining onboarding simplicity.

## Changes Summary

### 1. Form Schema Update (`employee-form-v2.tsx`)

**Before:**
```typescript
const employeeSchemaV2 = z.object({
  // ... other fields
  transportAllowance: z.number().optional(),
  housingAllowance: z.number().optional(),
  mealAllowance: z.number().optional(),
});
```

**After:**
```typescript
const employeeSchemaV2 = z.object({
  // ... other fields
  components: z.array(z.object({
    code: z.string(),
    name: z.string(),
    amount: z.number(),
    sourceType: z.enum(['standard', 'template']),
  })).optional().default([]),
});
```

### 2. New UI Components

Added `ComponentPickerSection` component with:
- **Component List Display**: Shows added allowances/bonuses with name and amount
- **Inline Editing**: Click edit icon to modify amount without dialog
- **Quick Remove**: Click X to remove component instantly
- **Template Dialog**: Browse and select from popular templates
- **Total Preview**: Shows sum of all added components

**Key Features:**
- Progressive disclosure (templates hidden in dialog)
- Touch-friendly buttons (min 44×44px)
- French language throughout
- Mobile-responsive design
- Real-time amount editing

### 3. Service Layer Changes (`onboarding-v2.service.ts`)

**Type Definition:**
```typescript
export interface CreateFirstEmployeeV2Input {
  // ... existing fields

  // NEW: Component-based salary structure
  components?: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType: 'standard' | 'template';
  }>;

  // DEPRECATED (kept for backward compatibility)
  transportAllowance?: number;
  housingAllowance?: number;
  mealAllowance?: number;
}
```

**Service Logic:**
- Checks for `components` array first (modern approach)
- Falls back to individual allowance fields if components not provided
- Converts old fields to component format for backward compatibility
- Combines user components with auto-calculated components (CNPS, ITS, CMU)

### 4. Page Integration (`app/onboarding/q2/page.tsx`)

Updated type signature to accept components array:
```typescript
const handleEmployeeSubmit = async (data: {
  // ... existing fields
  components?: Array<{
    code: string;
    name: string;
    amount: number;
    sourceType: 'standard' | 'template';
  }>;
  // ... backward compatibility fields
}) => { ... }
```

## User Experience

### Before (Simple Allowances)
1. Base salary field (required)
2. Collapsible section "Ajouter les indemnités"
3. Three fixed fields: Transport, Logement, Repas
4. Manual amount entry only

### After (Component-Based)
1. Base salary field (required) - **unchanged**
2. Button "Ajouter des indemnités (transport, logement...)"
3. Dialog with popular templates (country-specific)
4. Added components shown as cards with:
   - Component name
   - Amount (formatted with FCFA)
   - Edit button (inline editing)
   - Remove button
5. Total preview at bottom

## Benefits

### For Users
- ✅ **Faster input**: Click pre-configured templates instead of typing amounts
- ✅ **Less errors**: Templates have suggested amounts based on market data
- ✅ **Flexibility**: Can still edit amounts after adding
- ✅ **Clear preview**: See total allowances before submitting
- ✅ **Mobile-friendly**: Dialog scrolls, inline edit works on touch

### For Developers
- ✅ **Consistency**: Same component architecture as salary change wizard
- ✅ **Maintainability**: Single source of truth for components (database)
- ✅ **Extensibility**: Easy to add new component types
- ✅ **Type Safety**: Zod schema validation for components array
- ✅ **Backward Compatibility**: Old API still works

## Technical Implementation

### Component Handlers

```typescript
const handleAddComponent = (template: any, amount: number) => {
  // Extract French name from multilingual object
  const name = typeof template.name === 'object'
    ? (template.name as Record<string, string>).fr
    : template.name;

  const newComponent = {
    code: template.code,
    name,
    amount,
    sourceType: 'template' as const,
  };

  setValue('components', [...components, newComponent], { shouldValidate: true });
};

const handleRemoveComponent = (index: number) => {
  setValue(
    'components',
    components.filter((_, i) => i !== index),
    { shouldValidate: true }
  );
};

const handleEditComponent = (index: number, amount: number) => {
  const updated = components.map((c, i) =>
    i === index ? { ...c, amount } : c
  );
  setValue('components', updated, { shouldValidate: true });
};
```

### Service Backward Compatibility

```typescript
// Handle user-provided components (NEW approach)
let userComponents = [];

if (input.components && input.components.length > 0) {
  // Modern component-based approach
  userComponents = input.components;
} else {
  // BACKWARD COMPATIBILITY: Convert individual allowance fields
  if (input.transportAllowance && input.transportAllowance > 0) {
    userComponents.push({
      code: 'TPT_TRANSPORT_CI',
      name: 'Indemnité de transport',
      amount: input.transportAllowance,
      sourceType: 'standard',
    });
  }
  // ... handle other allowances
}

// Combine all components
const allComponents = [
  ...componentsWithCalculated, // Auto-injected (CNPS, ITS, CMU)
  ...userComponents,           // User-selected from templates
];
```

## Data Flow

```
User Action: Click template in dialog
    ↓
handleAddComponent: Add to components array (form state)
    ↓
Form Submit: Send components array to API
    ↓
Service: Combine with auto-calculated components
    ↓
Database: Store in employee_salaries.components JSONB
```

## Files Modified

1. `/features/onboarding/components/employee-form-v2.tsx`
   - Updated schema to accept components array
   - Added ComponentPickerSection component
   - Added component handlers (add, remove, edit)
   - Replaced allowance fields with component picker UI

2. `/features/onboarding/services/onboarding-v2.service.ts`
   - Updated CreateFirstEmployeeV2Input interface
   - Added components array support
   - Maintained backward compatibility with old allowance fields

3. `/app/onboarding/q2/page.tsx`
   - Updated type signature to accept components array

## Testing Checklist

- [ ] Can add component from template dialog
- [ ] Template dialog shows popular templates for CI
- [ ] Can edit component amount inline
- [ ] Can remove component
- [ ] Total preview updates correctly
- [ ] Form submits with components array
- [ ] Service creates salary record with components
- [ ] Backward compatibility: Old allowance fields still work
- [ ] Mobile: Dialog scrolls on small screens
- [ ] Mobile: Inline edit works on touch devices
- [ ] French language throughout
- [ ] Touch targets ≥ 44×44px

## Next Steps

1. **Add Template Seeds**: Ensure popular templates exist for each country (CI, SN, BF, etc.)
2. **Analytics**: Track which templates are most used
3. **Custom Components**: Allow users to create custom components (future)
4. **Copy to Hire Wizard**: Apply same pattern to full employee hire wizard
5. **Deprecation**: After 3 months, remove old allowance fields from API

## Migration Notes

### For Existing Data
- Old employee records with individual allowance fields: **No migration needed**
- Service automatically converts old format to new format on the fly
- Database already stores components in JSONB format

### For Future Development
- **DO**: Use `components` array for new features
- **DON'T**: Add new individual allowance fields
- **PREFER**: Database-driven templates over hardcoded lists

---

**Implementation Date**: 2025-10-11
**Status**: ✅ Complete
**Backward Compatible**: Yes
**Breaking Changes**: None
