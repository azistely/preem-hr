# CGECI Architecture Analysis & UX Design

**Generated:** October 23, 2025
**Purpose:** Analyze current CGECI implementation and design simple UX for non-experts

---

## Current Database Architecture

### ✅ Tables with CGECI Support:

#### 1. **Tenants Table**
```sql
- country_code (text, default 'CI')
- industry (text) - Free text like "Vente de vêtements"
- sector_code (varchar) - ⚠️ EXISTS IN DB but NOT in Drizzle schema!
```

#### 2. **Employees Table** (Drizzle Schema)
```typescript
- coefficient (integer, default 100) - Professional coefficient
- categoryCode (varchar) - CGECI category like 'EMP_1', '1A', 'M2'
- sectorCodeCgeci (varchar) - ⚠️ CGECI sector (should be company-level!)
- sector (varchar) - Generic sector (services, industry, agriculture)
- conventionCode (varchar) - Convention collective code
```

#### 3. **Employee Category Coefficients Table** (CGECI Data)
```sql
18 CGECI sectors × 7-27 categories each = ~300 rows
- sector_code: 'BANQUES', 'BTP', 'COMMERCE', 'IND_MECANIQUE', etc.
- category: 'EMP_1', 'EMP_2', '1A', '2B', 'M1', 'M2', etc.
- label_fr: "Employé 1ère classe", "Technicien M2", "Cadre"
- min_coefficient / max_coefficient
- actual_minimum_wage (auto-calculated)
```

#### 4. **Sector Configurations Table** (Work Accident Rates)
```sql
6 generic sectors for work accident rates:
- SERVICES (2%)
- AGRICULTURE (2.5%)
- INDUSTRY (3%)
- TRANSPORT (3.5%)
- CONSTRUCTION (5%)
- MINING (5%)
```

---

## Architecture Problems

### 🔴 Problem 1: Dual Sector Systems
**Current State:**
- Generic sectors (6) for work accident rates
- CGECI sectors (18) for minimum wages
- No clear mapping between them

**Impact:** User confusion - which sector do I select?

### 🔴 Problem 2: CGECI Sector at Wrong Level
**Current State:**
- `employees.sectorCodeCgeci` - Stored per employee ❌
- `tenants.sector_code` - Exists in DB but not in Drizzle schema

**Reality:**
- CGECI sector is **company-level** (a bank is always BANQUES)
- Employees inherit categories from company's CGECI sector

**Impact:**
- One company could have employees in different CGECI sectors (impossible!)
- Payroll calculations become inconsistent

### 🔴 Problem 3: Category Selection Complexity
**Current State:**
- Employee form shows generic categories (A1, A2, B1, C, D, E, F)
- These don't match CGECI categories (EMP_1, EMP_2, 1A, 2B, M1, M2)

**Reality:**
- BANQUES has: EMP_1, EMP_2, 1ERE, 2EME, 3EME, etc. (16 categories)
- BTP has: 1, 2, 3, 4, 5, 6, 7A, 7B, M2, M3, etc. (21 categories)
- COMMERCE has: 1A, 1B, 2, 3, 4, 5, 6, 7A, 7B, etc. (18 categories)

**Impact:** User enters wrong category → Incorrect minimum wage

---

## Recommended Architecture

### ✅ **Company Level (Tenant)**

```typescript
tenants {
  // Add to Drizzle schema (already exists in DB)
  cgeciSectorCode: varchar('cgeci_sector_code') // 'BANQUES', 'BTP', 'COMMERCE'

  // Auto-derived (no user input needed)
  genericSector: varchar('generic_sector') // Maps CGECI → Generic for accident rate
}
```

**Mapping Logic:**
```typescript
const cgeciToGeneric = {
  'BANQUES': 'SERVICES',
  'ASSURANCES': 'SERVICES',
  'COMMERCE': 'SERVICES',
  'IND_HOTEL': 'SERVICES',
  'BTP': 'CONSTRUCTION',
  'IND_MECANIQUE': 'INDUSTRY',
  'IND_TEXTILE': 'INDUSTRY',
  'IND_BOIS': 'INDUSTRY',
  'AUX_TRANSPORT': 'TRANSPORT',
  'PETROLE_DISTRIB': 'TRANSPORT',
  'NETTOYAGE': 'SERVICES',
  'SECURITE': 'SERVICES',
  // etc.
};
```

### ✅ **Employee Level**

```typescript
employees {
  // Keep (inherits from tenant, not stored per employee)
  categoryCode: varchar // 'EMP_1', '1A', 'M2' - Selects from company's CGECI sector
  coefficient: integer // Auto-filled from category, or manually increased

  // Remove (redundant, use tenant.cgeciSectorCode)
  sectorCodeCgeci: varchar ❌ DELETE
  sector: varchar ❌ DELETE or keep for legacy
}
```

---

## Simple UX Flow (No HR Expertise Needed)

### **Q1: Company Setup - CGECI Sector Selection**

#### Option A: Visual Cards (Recommended) ⭐
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
  <SectorCard
    icon={Building2}
    title="Banque ou Assurance"
    description="Établissements financiers"
    code="BANQUES,ASSURANCES"
  />
  <SectorCard
    icon={ShoppingBag}
    title="Commerce"
    description="Magasin, distribution, négoce"
    code="COMMERCE"
  />
  <SectorCard
    icon={Hammer}
    title="Construction (BTP)"
    description="Bâtiment, travaux publics"
    code="BTP"
  />
  <SectorCard
    icon={Factory}
    title="Industrie"
    description="Fabrication, production"
    code="IND_MECANIQUE,IND_TEXTILE,IND_BOIS"
  />
  <SectorCard
    icon={Hotel}
    title="Hôtel / Tourisme"
    description="Hébergement, restauration"
    code="IND_HOTEL,IND_TOURISME"
  />
  <SectorCard
    icon={Truck}
    title="Transport"
    description="Logistique, livraison"
    code="AUX_TRANSPORT"
  />
  <SectorCard
    icon={Briefcase}
    title="Services"
    description="Nettoyage, sécurité, autres"
    code="NETTOYAGE,SECURITE"
  />
  <SectorCard
    icon={Search}
    title="Autre secteur"
    description="Voir tous les secteurs"
    onClick={() => setShowAllSectors(true)}
  />
</div>
```

**Flow:**
1. User clicks card (e.g., "Banque")
2. If card has multiple CGECI sectors, show sub-selection
3. Store `tenant.cgeciSectorCode` = 'BANQUES'
4. Auto-map to `genericSector` = 'SERVICES' for accident rate

#### Option B: Searchable Combobox (Fallback)
```tsx
<Combobox>
  <Input placeholder="Tapez votre secteur (ex: banque, commerce, construction)..." />
  <ComboboxOptions>
    <ComboboxOption value="BANQUES">🏦 Banques</ComboboxOption>
    <ComboboxOption value="ASSURANCES">🛡️ Assurances</ComboboxOption>
    <ComboboxOption value="COMMERCE">🏪 Commerce, Distribution</ComboboxOption>
    <ComboboxOption value="BTP">🏗️ Bâtiment, Travaux Publics (BTP)</ComboboxOption>
    {/* ... all 18 sectors */}
  </ComboboxOptions>
</Combobox>
```

---

### **Q2: Employee Setup - Category Selection**

#### Auto-Load Categories Based on Company Sector

**Backend Logic:**
```typescript
// Get company's CGECI sector
const companySector = tenant.cgeciSectorCode; // e.g., 'BANQUES'

// Load available categories for this sector
const availableCategories = await db
  .select({
    category: employeeCategoryCoefficients.category,
    labelFr: employeeCategoryCoefficients.labelFr,
    coefficient: employeeCategoryCoefficients.minCoefficient,
    minWage: employeeCategoryCoefficients.actualMinimumWage,
  })
  .from(employeeCategoryCoefficients)
  .where(
    and(
      eq(employeeCategoryCoefficients.countryCode, 'CI'),
      eq(employeeCategoryCoefficients.sectorCode, companySector)
    )
  )
  .orderBy(employeeCategoryCoefficients.minCoefficient);
```

**Frontend Dropdown:**
```tsx
<FormField
  label="Catégorie professionnelle"
  type="select"
  required
  helperText="Détermine le salaire minimum légal"
>
  {availableCategories.map(cat => (
    <option
      key={cat.category}
      value={cat.category}
    >
      {cat.labelFr} (Coef. {cat.coefficient} - {formatMoney(cat.minWage)} FCFA min.)
    </option>
  ))}
</FormField>
```

**Example for BANQUES:**
```
<option value="EMP_2">Employé 2ème classe (Coef. 97 - 72,859 FCFA min.)</option>
<option value="EMP_1">Employé 1ère classe (Coef. 100 - 75,000 FCFA min.)</option>
<option value="EMP_3">Employé 3ème classe (Coef. 106 - 79,355 FCFA min.)</option>
<option value="1ERE">1ère classe (Coef. 178 - 133,600 FCFA min.)</option>
<option value="2EME">2ème classe (Coef. 179 - 133,985 FCFA min.)</option>
{/* ... 11 more categories */}
```

**Example for BTP:**
```
<option value="SMIG">Employé SMIG (Coef. 100 - 75,000 FCFA min.)</option>
<option value="1">Employé 1ère catégorie (Coef. 100 - 75,000 FCFA min.)</option>
<option value="2">Employé 2ème catégorie (Coef. 111 - 83,250 FCFA min.)</option>
<option value="M2">Technicien M2 (Coef. 198 - 148,500 FCFA min.)</option>
{/* ... 17 more categories */}
```

---

## Implementation Steps

### Phase 1: Database Schema Fix ⚠️

1. **Add `cgeciSectorCode` to Drizzle tenants schema:**
```typescript
// lib/db/schema/tenants.ts
export const tenants = pgTable('tenants', {
  // ... existing fields ...

  // CGECI Sector (company-level)
  cgeciSectorCode: varchar('cgeci_sector_code', { length: 50 }),

  // Generic sector (auto-derived for accident rates)
  genericSectorCode: varchar('generic_sector_code', { length: 50 }),
});
```

2. **Remove redundant fields from employees:**
```typescript
// lib/db/schema/employees.ts
export const employees = pgTable('employees', {
  // ... existing fields ...

  // Keep these:
  categoryCode: varchar('category_code', { length: 10 }), // ✅
  coefficient: integer('coefficient').notNull().default(100), // ✅

  // Deprecate/remove these:
  // sectorCodeCgeci: varchar('sector_code_cgeci'), // ❌ Use tenant.cgeciSectorCode
  // sector: varchar('sector'), // ❌ Use tenant.genericSectorCode
});
```

### Phase 2: Q1 UX Implementation

1. Create `SectorSelectionCard` component with icons
2. Group 18 CGECI sectors into 7-8 user-friendly categories
3. Add search/filter for "Autre secteur" modal
4. Save to `tenant.cgeciSectorCode`
5. Auto-map to `tenant.genericSectorCode`

### Phase 3: Q2 Category Dropdown

1. Load categories based on `tenant.cgeciSectorCode`
2. Show human-readable labels with minimum wage
3. Auto-set coefficient when category selected
4. Allow manual coefficient increase (but not below minimum)

### Phase 4: Payroll Calculation Update

1. Update `calculatePayrollV2()` to use:
   - `tenant.cgeciSectorCode` for minimum wage lookup
   - `employee.categoryCode` for precise category
   - `tenant.genericSectorCode` for accident rate
2. Validate salary ≥ minimum wage for category

---

## User Journey Examples

### Example 1: Banque

**Q1:**
- User clicks: "🏦 Banque ou Assurance"
- System stores: `tenant.cgeciSectorCode = 'BANQUES'`
- System auto-sets: `tenant.genericSectorCode = 'SERVICES'` (2% accident rate)

**Q2:**
- Employee form loads 16 BANQUES categories
- User selects: "Employé 1ère classe (75,000 FCFA min.)"
- System stores: `employee.categoryCode = 'EMP_1'`, `employee.coefficient = 100`

**Payroll:**
- Validates salary ≥ 75,000 FCFA
- Applies 2% work accident rate (from SERVICES)

### Example 2: Construction (BTP)

**Q1:**
- User clicks: "🏗️ Construction (BTP)"
- System stores: `tenant.cgeciSectorCode = 'BTP'`
- System auto-sets: `tenant.genericSectorCode = 'CONSTRUCTION'` (5% accident rate)

**Q2:**
- Employee form loads 21 BTP categories
- User selects: "Technicien M2 (148,500 FCFA min.)"
- System stores: `employee.categoryCode = 'M2'`, `employee.coefficient = 198`

**Payroll:**
- Validates salary ≥ 148,500 FCFA
- Applies 5% work accident rate (from CONSTRUCTION)

---

## Benefits of This Architecture

### ✅ For Users (No HR Expertise Needed)
1. **Visual sector selection** - Icons + descriptions, not technical codes
2. **Automatic category lists** - Only show categories for your company's sector
3. **Clear minimum wages** - See exact legal minimum next to each category
4. **Validation** - System prevents salary below minimum

### ✅ For Developers
1. **Single source of truth** - CGECI sector at company level
2. **Consistent payroll** - All employees use same sector rules
3. **Easy to extend** - Add Senegal/Burkina CGECI data later
4. **Type-safe** - Drizzle schema matches database

### ✅ For Compliance
1. **Accurate minimum wages** - Uses official CGECI Barème 2023
2. **Correct accident rates** - Auto-mapped from CGECI sector
3. **Audit trail** - Company sector + employee category stored
4. **Legal defense** - "We use official CGECI categories"

---

## Next Steps

1. **Update Drizzle schema** - Add `cgeciSectorCode` to tenants
2. **Create sector mapping** - CGECI → Generic for accident rates
3. **Design Q1 sector cards** - 7-8 visual categories
4. **Implement Q2 category dropdown** - Dynamic based on company sector
5. **Test with real companies** - Validate UX with non-experts

---

**Document Version:** 1.0
**Last Updated:** October 23, 2025
**Status:** Ready for implementation
