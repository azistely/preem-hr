# Multi-Country UX Patterns - Documentation Update

## Overview

Updated HCI design principles and project instructions to include comprehensive UX patterns for multi-country payroll system supporting Côte d'Ivoire, Senegal, Burkina Faso, and other West African countries.

## What Changed

### 1. HCI Design Principles Enhanced ✅

**File:** `docs/HCI-DESIGN-PRINCIPLES.md`

**New Section Added:** "Multi-Country UX Patterns" with 5 comprehensive patterns and implementation checklist.

### 2. Project Instructions Updated ✅

**File:** `.claude/CLAUDE.md`

**Updates:**
- Added multi-country design requirements
- Enhanced implementation checklist with multi-country items
- Added common mistakes for multi-country features
- Referenced multi-country architecture docs

## Five Multi-Country UX Patterns

### Pattern 6: Country-Aware Smart Defaults
**Principle:** Detect country from tenant, auto-configure everything

**Key Rules:**
- Country code flows from tenant → all calculations
- No repeated country selection
- All labels, rules, rates auto-configured by country

**Example:**
```tsx
// Country detected from tenant.countryCode
<PayrollCalculator countryCode={tenant.countryCode}>
  {/* All components auto-configured */}
</PayrollCalculator>
```

### Pattern 7: Country-Specific Labels (No Jargon)
**Principle:** Use local terminology users recognize

**Key Rules:**
- CI: CNPS (not "social security"), ITS (not "tax")
- SN: IPRES (not "social security"), IRPP (not "tax")
- Always include full name with acronym

**Example:**
```tsx
const labels = {
  CI: { tax: 'ITS (Impôt sur les Traitements et Salaires)' },
  SN: { tax: 'IRPP (Impôt sur le Revenu)' }
};
```

### Pattern 8: Family Situation (Fiscal Parts)
**Principle:** Load from database, show friendly labels

**Key Rules:**
- Load family deduction rules from `family_deduction_rules` table
- Display as "Marié + 2 enfants (3.0)" not "3.0"
- Database-driven for each country

**Example:**
```tsx
const familyDeductions = useFamilyDeductions(countryCode);
// Shows: "Célibataire (1.0)", "Marié (2.0)", etc.
```

### Pattern 9: Sector-Specific Rates (Hidden Complexity)
**Principle:** Auto-detect from employee, hide in advanced view

**Key Rules:**
- Auto-detect sector from employee.sector field
- Apply sector overrides automatically (construction 5% vs services 2%)
- Only show in detailed breakdown if user expands

**Example:**
```tsx
<Collapsible>
  <CollapsibleTrigger>Voir le calcul détaillé</CollapsibleTrigger>
  <CollapsibleContent>
    <InfoLine>
      <span>Taux AT/MP</span>
      <span>{workAccidentRate}%</span>
    </InfoLine>
  </CollapsibleContent>
</Collapsible>
```

### Pattern 10: Multi-Country Payroll Comparison (Advanced)
**Principle:** Visual comparison for super admin/decision-making

**Key Rules:**
- Visual cards with flags (not raw tables)
- Show key metrics (tax rates, SMIG, contribution rates)
- Only for super admin or multi-country orgs

**Example:**
```tsx
<CountryComparison>
  <ComparisonCard country="CI">
    <Flag>🇨🇮</Flag>
    <Metrics>
      <Metric label="Taux max ITS" value="32%" />
      <Metric label="SMIG mensuel" value="75,000 FCFA" />
    </Metrics>
  </ComparisonCard>
</CountryComparison>
```

## Implementation Checklist

**When implementing multi-country features:**

- [ ] Country detected from tenant context (tenant.countryCode)
- [ ] Labels use country-specific terminology (CNPS vs IPRES)
- [ ] Smart defaults load from database by country
- [ ] Family deductions show friendly descriptions, not numbers
- [ ] Sector rates auto-detected from employee data
- [ ] Regulatory complexity hidden in advanced/expert view
- [ ] Error messages reference country-specific rules
- [ ] Help text explains country-specific concepts

## Architecture Integration

### Database-Driven Configuration

All country rules loaded from database:
- **tax_systems** - Tax brackets, rates (ITS for CI, IRPP for SN)
- **social_security_schemes** - CNPS (CI), IPRES (SN), etc.
- **family_deduction_rules** - Fiscal parts by country
- **sector_contribution_overrides** - Work accident rates by sector

### Key Services

1. **RuleLoader** (`features/payroll-config/services/rule-loader.ts`)
   - Loads country config from database
   - In-memory caching (1-hour TTL)

2. **calculatePayrollV2** (`features/payroll/services/payroll-calculation-v2.ts`)
   - Accepts `countryCode` parameter
   - Database-driven calculations
   - Supports CI, SN (more countries via database seeding)

3. **tRPC Endpoints**
   - `payroll.getFamilyDeductions` - Load family rules by country
   - `payroll.calculateV2` - Multi-country calculation

## Example Error Messages

**Country-Specific (Good):**
```
"Le salaire est inférieur au SMIG de Côte d'Ivoire (75,000 FCFA)"
"Le salaire est inférieur au SMIG du Sénégal (52,500 FCFA)"
```

**Generic (Bad):**
```
"Minimum wage validation failed"
```

## Frontend Implementation Examples

### Payroll Calculator with Multi-Country
**File:** `app/payroll/calculator/page.tsx`

Already implements:
- ✅ Country selector (CI, SN, BF coming soon)
- ✅ Country-specific labels (CNPS/ITS for CI, CSS/IRPP for SN)
- ✅ Database-driven family deductions
- ✅ Auto-configured calculations via `calculateV2`

### Payroll Run Details
**Pattern to follow:**
```tsx
// Detect country from payroll run
const countryCode = run.countryCode;

// Load country-specific labels
const labels = getSocialSecurityLabels(countryCode);

// Render with country-specific terminology
<DeductionLine>
  <span>{labels.employeeRetirement}</span>
  <Amount>{cnpsEmployee} FCFA</Amount>
</DeductionLine>
```

## Testing Multi-Country Features

### Unit Tests
```typescript
// Test both countries
describe('Multi-Country Payroll', () => {
  it('should use CNPS labels for Côte d\'Ivoire', () => {
    const labels = getLabels('CI');
    expect(labels.socialSecurity).toBe('CNPS (Retraite)');
  });

  it('should use IPRES labels for Senegal', () => {
    const labels = getLabels('SN');
    expect(labels.socialSecurity).toBe('IPRES (Retraite)');
  });
});
```

### Integration Tests
**File:** `features/payroll/services/__tests__/payroll-calculation-v2.test.ts`

Already tests:
- ✅ CI calculations with ITS tax
- ✅ SN calculations with IRPP tax
- ✅ Family deductions by country
- ✅ Sector overrides

## Common Mistakes to Avoid

1. ❌ **Hardcoding country rules in UI**
   ```tsx
   // Bad
   <span>CNPS: {value}</span>
   ```
   ✅ **Use country-specific labels**
   ```tsx
   // Good
   <span>{labels[countryCode].socialSecurity}: {value}</span>
   ```

2. ❌ **Asking user to select country repeatedly**
   ```tsx
   // Bad - on every screen
   <CountrySelect />
   ```
   ✅ **Use tenant context**
   ```tsx
   // Good - once at tenant setup
   const { countryCode } = useTenant();
   ```

3. ❌ **Showing technical IDs/codes**
   ```tsx
   // Bad
   <option value="1.0">1.0</option>
   ```
   ✅ **Show friendly descriptions**
   ```tsx
   // Good
   <option value="1.0">Célibataire (1.0)</option>
   ```

4. ❌ **Generic error messages**
   ```tsx
   // Bad
   throw new Error('Invalid salary');
   ```
   ✅ **Country-specific context**
   ```tsx
   // Good
   throw new Error(`Le salaire est inférieur au SMIG de ${countryName} (${smig} FCFA)`);
   ```

## Next Steps

### For New Features

When implementing any feature that touches payroll:

1. **Read updated HCI docs first** - Multi-country patterns are now included
2. **Check tenant.countryCode** - Use for auto-configuration
3. **Load from database** - Use RuleLoader/tRPC endpoints
4. **Test multiple countries** - At least CI and SN
5. **Use country-specific labels** - Never generic terms

### For Existing Features

Audit and update existing UI:

1. **Employee Management** - Add sector field (for work accident rates)
2. **Payroll Runs** - Ensure country-specific labels displayed
3. **Payslips** - Use country-specific terminology
4. **Reports** - Show country context in headers
5. **Exports** - Include country-specific regulatory references

## Documentation References

**Primary Documents:**
1. `docs/HCI-DESIGN-PRINCIPLES.md` - Complete UX patterns (now includes multi-country)
2. `docs/MULTI-COUNTRY-MIGRATION-SUMMARY.md` - Architecture overview
3. `docs/05-EPIC-PAYROLL.md` - Multi-country payroll epic
4. `.claude/CLAUDE.md` - Project instructions (now includes multi-country checklist)

**Implementation Examples:**
- `app/payroll/calculator/page.tsx` - Multi-country calculator
- `features/payroll/services/payroll-calculation-v2.ts` - Database-driven calculations
- `features/payroll-config/services/rule-loader.ts` - Config loading

## Conclusion

All HCI and project documentation now includes comprehensive multi-country UX patterns. These patterns ensure:

✅ **Country complexity is invisible** - Users only see their country's terminology
✅ **No repeated selections** - Country flows from tenant context
✅ **Database-driven** - Easy to add new countries (just seed database)
✅ **User-friendly** - Friendly labels, not technical jargon
✅ **Maintainable** - Clear patterns for all developers to follow

Future multi-country features should reference these patterns to maintain consistency and usability across the system.
