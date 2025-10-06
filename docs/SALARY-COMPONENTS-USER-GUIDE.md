# Salary Components User Guide

**Last Updated:** 2025-10-06
**Audience:** HR Managers, Admins, Super Admins

---

## 👥 User Roles & Capabilities

### 1. **HR Manager** (Day-to-Day User)
- Hires employees
- Sees auto-calculated components "just work"
- **Never** sees formulas or metadata
- **Never** needs to understand tax treatment

### 2. **Tenant Admin** (Company Admin)
- One-click add from template library
- Create custom components (rarely)
- Configure tax treatment via friendly forms
- **Never** writes formulas manually

### 3. **Super Admin** (Anthropic/Preem)
- Seeds standard components per country
- Creates template library
- Defines calculation rules in metadata
- Updates formulas when regulations change

---

## 🎬 User Flows by Role

### HR Manager: Hiring an Employee

**Goal:** Hire an employee with standard salary components

**Steps:**
1. Go to `/employees/new`
2. Fill personal info (name, email optional, phone)
3. Fill employment info (hire date, position)
4. **Step 3 - Salary:**
   - Enter base salary: `300,000 FCFA`
   - (Optional) Enter housing: `50,000 FCFA`
   - (Optional) Enter transport: `25,000 FCFA`
   - (Optional) Enter meal: `15,000 FCFA`
   - Click **"Ajouter une indemnité"** to add more
5. **Step 4 - Banking:**
   - Enter tax dependents: `2`
6. Confirm

**What Happens Behind the Scenes:**

```typescript
// System auto-injects components:
const components = [
  { code: '11', name: 'Salaire de base', amount: 300000 },
  { code: '22', name: 'Prime de transport', amount: 25000 },
  { code: '23', name: 'Indemnité de logement', amount: 50000 },
  { code: '24', name: 'Indemnité de repas', amount: 15000 },

  // AUTO-CALCULATED (invisible to user):
  // Code 21: Seniority - NOT injected (employee has 0 years)
  // Code 41: Family allowance - INJECTED (2 dependents)
  { code: '41', name: 'Allocations familiales', amount: 8400 }, // 2 × 4,200
];
```

**User Experience:**
- ✅ User enters 4 simple numbers
- ✅ System calculates family allowance automatically
- ✅ No mention of formulas or tax bases
- ✅ Total gross shown immediately

**When Seniority Kicks In:**

After 1 year, during payroll:

```typescript
// Payroll system recalculates:
const seniorityCalc = calculateSeniorityBonus({
  baseSalary: 300000,
  hireDate: '2024-10-06',
  currentDate: '2025-10-06',
});
// Result: { yearsOfService: 1, rate: 0.02, amount: 6000 }

// System auto-adds seniority component
components.push({
  code: '21',
  name: "Prime d'ancienneté",
  amount: 6000, // 2% of 300,000
});
```

**User sees in payslip:**
```
Salaire de base:            300,000 FCFA
Prime de transport:          25,000 FCFA
Indemnité de logement:       50,000 FCFA
Indemnité de repas:          15,000 FCFA
Prime d'ancienneté:           6,000 FCFA  ← NEW (after 1 year)
Allocations familiales:       8,400 FCFA
─────────────────────────────────────────
Salaire brut total:         404,400 FCFA
```

---

### HR Manager: Adding Custom Allowance (from Template)

**Goal:** Add a phone allowance for a new hire

**Steps:**
1. In hire wizard, Step 3 (Salary)
2. Click **"Ajouter une indemnité"**
3. Dialog shows popular templates:
   - 📱 **Prime de téléphone** - 10,000 FCFA
   - 🎯 **Prime de performance** - 25,000 FCFA
   - 👔 **Prime de responsabilité** - 50,000 FCFA
4. Click "Prime de téléphone"
5. Component added to list with suggested amount (10,000)
6. User can edit amount if needed
7. Continue with hire

**What Happens:**
```typescript
// Component added to otherAllowances array
{
  name: 'Prime de téléphone',
  amount: 10000,
  taxable: true, // From template metadata
}

// On submit, system creates component instance:
{
  code: 'CUSTOM_001', // or uses template code
  name: 'Prime de téléphone',
  amount: 10000,
  metadata: {
    // Metadata from template (tax treatment, etc.)
    taxTreatment: { isTaxable: true, ... },
  },
  sourceType: 'template',
  sourceId: 'PHONE_TEMPLATE_ID',
}
```

**User Experience:**
- ✅ Browse friendly list of common allowances
- ✅ See suggested amounts
- ✅ One-click add
- ✅ No knowledge of tax treatment required

---

### Tenant Admin: Adding Template to Company Library

**Goal:** Make "Prime de téléphone" available for all future hires

**Steps:**
1. Go to `/settings/salary-components`
2. Click **"Template Library"** tab
3. Browse templates:
   - Prime de téléphone (10,000 FCFA)
   - Prime de performance (25,000 FCFA)
   - etc.
4. Click **"Add to Company"** on "Prime de téléphone"
5. (Optional) Customize name or default amount
6. Confirm

**What Happens:**
```typescript
// System creates custom component from template
const customComponent = {
  id: 'uuid',
  tenantId: 'your-tenant-id',
  code: 'CUSTOM_001',
  name: 'Prime de téléphone',
  templateCode: 'PHONE',
  metadata: {
    // Metadata copied from template
    taxTreatment: {
      isTaxable: true,
      includeInBrutImposable: true,
      includeInSalaireCategoriel: false,
      exemptionCap: 10000, // Phone allowance often exempt up to amount
    },
    socialSecurityTreatment: {
      includeInCnpsBase: false,
    },
  },
  isActive: true,
};
```

**User Experience:**
- ✅ One-click add from curated library
- ✅ Pre-configured tax treatment (from template)
- ✅ Now appears in hire wizard for all employees
- ✅ No manual formula entry

---

### Tenant Admin: Creating Custom Component (Rare)

**Goal:** Create "Prime de risque minier" for mining company

**Steps:**
1. Go to `/settings/salary-components/new`
2. **Basic Info:**
   - Name: `Prime de risque minier`
   - Description: `Prime pour travail en zone minière`
   - Category: `Bonus`
3. **Tax Treatment (CI):**
   - ☑ **Imposable** (taxable)
   - ☑ **Include in Brut Imposable**
   - ☑ **Include in Salaire Catégoriel** (auto-checks Brut Imposable)
   - Exemption Cap: (leave empty)
4. **Social Security:**
   - ☑ **Include in CNPS base**
5. Click "Créer le composant"

**What Happens:**
```typescript
// Form inputs converted to metadata
const metadata = buildCIMetadata({
  isTaxable: true,
  includeInBrutImposable: true,
  includeInSalaireCategoriel: true,
  exemptionCap: undefined,
  includeInCnpsBase: true,
});

// Result:
{
  taxTreatment: {
    isTaxable: true,
    includeInBrutImposable: true,
    includeInSalaireCategoriel: true,
  },
  socialSecurityTreatment: {
    includeInCnpsBase: true,
  },
}

// Component created:
{
  id: 'uuid',
  tenantId: 'your-tenant-id',
  code: 'CUSTOM_002',
  name: 'Prime de risque minier',
  metadata: metadata, // As above
  isActive: true,
}
```

**User Experience:**
- ✅ Friendly checkboxes (no JSON editing)
- ✅ Auto-validation (Salaire Catégoriel requires Brut Imposable)
- ✅ System auto-generates unique code
- ✅ Available in hire wizard immediately

**Validation Example:**
If user tries to check "Salaire Catégoriel" but NOT "Brut Imposable":
```
⚠ Le Salaire Catégoriel doit être dans le Brut Imposable
```
System auto-checks "Brut Imposable" when user checks "Salaire Catégoriel".

---

### Super Admin: Seeding Standard Components

**Goal:** Add standard components for a new country (e.g., Senegal)

**Steps:**
1. Create migration file: `20251006_add_senegal_components.sql`
2. Insert standard components:

```sql
-- Code 11: Base Salary (every country has this)
INSERT INTO salary_component_definitions (
  country_code,
  code,
  name,
  category,
  component_type,
  metadata,
  is_common,
  display_order
) VALUES (
  'SN',
  '11',
  '{"fr": "Salaire de base"}',
  'base',
  'fixed',
  '{
    "taxTreatment": {
      "includedInGross": true,
      "subjectToStandardDeduction": true
    },
    "socialSecurityTreatment": {
      "includeInIpres": true,
      "includeInIpm": true
    }
  }',
  true,
  1
);

-- Code 21: Seniority (with formula)
INSERT INTO salary_component_definitions (
  country_code,
  code,
  name,
  category,
  component_type,
  metadata,
  is_common,
  display_order
) VALUES (
  'SN',
  '21',
  '{"fr": "Prime d''ancienneté"}',
  'bonus',
  'calculated',
  '{
    "taxTreatment": {
      "includedInGross": true,
      "subjectToStandardDeduction": true
    },
    "socialSecurityTreatment": {
      "includeInIpres": true
    },
    "calculationRule": {
      "type": "auto-calculated",
      "rate": 0.02,
      "cap": 0.25
    }
  }',
  true,
  2
);
```

3. Create template library:

```sql
INSERT INTO salary_component_templates (
  country_code,
  code,
  name,
  description,
  category,
  metadata,
  suggested_amount,
  is_popular,
  display_order
) VALUES (
  'SN',
  'PHONE',
  '{"fr": "Prime de téléphone"}',
  'Indemnité forfaitaire pour frais de téléphone professionnel',
  'allowance',
  '{
    "taxTreatment": {
      "includedInGross": true,
      "subjectToStandardDeduction": true
    },
    "socialSecurityTreatment": {
      "includeInIpres": false
    }
  }',
  10000,
  true,
  1
);
```

**User Impact:**
- ✅ Senegal tenants see SN-specific components
- ✅ Tax calculations use SN rules (standard deduction)
- ✅ Templates pre-configured for SN tax treatment
- ✅ No code changes needed for new country

---

## 📋 Real-World Scenarios

### Scenario 1: New Hire (0 years, 2 dependents)

**HR Manager Actions:**
1. Enter base: 300,000
2. Enter dependents: 2
3. Hire

**System Auto-Injects:**
- Base: 300,000 ✅
- Seniority: NOT injected (0 years) ❌
- Family: 8,400 (2 × 4,200) ✅

**Total Gross:** 308,400 FCFA

---

### Scenario 2: Employee After 5 Years

**Payroll Runs Automatically:**

```typescript
// Month 1 (hire): Gross = 300,000 (no seniority)
// Month 12 (1 year): Gross = 306,000 (300k + 6k seniority)
// Month 24 (2 years): Gross = 312,000 (300k + 12k seniority)
// Month 60 (5 years): Gross = 330,000 (300k + 30k seniority)
```

**HR Manager sees:**
- Payslip automatically includes seniority
- Amount increases each year
- No manual updates needed

---

### Scenario 3: Employee Has 3rd Child

**HR Manager Actions:**
1. Go to employee profile
2. Update tax dependents: 2 → 3
3. Save

**System Recalculates:**
```typescript
// Old: 2 × 4,200 = 8,400
// New: 3 × 4,200 = 12,600
// Difference: +4,200 FCFA per month
```

**Next Payroll:**
- Family allowance: 12,600 (was 8,400)
- Gross increases by 4,200

---

### Scenario 4: Company Adds Phone Allowance Policy

**Tenant Admin Actions:**
1. Go to Settings → Salary Components
2. Template Library tab
3. Click "Add" on "Prime de téléphone"
4. Confirm

**HR Manager Next Hire:**
1. Hire wizard, Step 3
2. Click "Ajouter une indemnité"
3. **Now sees**: Prime de téléphone (10,000) ← NEW
4. One-click add
5. Phone allowance included in hire

**Existing Employees:**
- Admin can bulk-add via salary adjustment
- Or add individually when updating salary

---

## 🎯 Key Design Principles

### 1. **Progressive Disclosure**

**HR Manager View:**
- Simple: 4 number fields
- Optional: "Add allowance" button
- Hidden: Formulas, tax bases, metadata

**Admin View:**
- Medium: Checkboxes for tax treatment
- Simple: Pre-built templates
- Hidden: JSON metadata, calculation logic

**Super Admin View:**
- Full: SQL migrations, JSON metadata
- Control: Formula definitions, calculation rules

### 2. **Smart Defaults**

Everything auto-configured:
- ✅ Standard components pre-seeded
- ✅ Templates pre-configured
- ✅ Tax treatment defined
- ✅ Formulas embedded

HR Manager never configures:
- Tax bases (CI: 3 bases)
- Social security inclusion
- Exemption caps
- Calculation rules

### 3. **Auto-Calculation Transparency**

User sees results, not process:
- ✅ "Allocations familiales: 8,400 FCFA"
- ❌ NOT: "Formula: 2 × 4,200 = 8,400"

User trusts system:
- ✅ Seniority appears after 1 year
- ✅ Family allowance updates with dependents
- ✅ No manual recalculation needed

### 4. **One-Click Workflows**

Template Library:
- ✅ Browse → Click → Added
- ❌ NOT: Create → Configure → Test → Activate

Hire Wizard:
- ✅ Enter base → See total
- ❌ NOT: Enter base → Add components → Calculate total

---

## 🧪 Testing Each Role

### Test as HR Manager

1. **Hire with auto-components:**
   - Base: 300,000, Dependents: 2
   - Verify family allowance: 8,400 ✅

2. **Add template allowance:**
   - Click "Ajouter une indemnité"
   - Select "Prime de téléphone"
   - Verify added to list ✅

3. **Run payroll after 1 year:**
   - Wait 1 year (or mock date)
   - Run payroll
   - Verify seniority: 6,000 ✅

### Test as Tenant Admin

1. **Add from template:**
   - Go to Template Library
   - Add "Prime de téléphone"
   - Verify appears in hire wizard ✅

2. **Create custom component:**
   - Go to "Create Component"
   - Fill form (checkboxes)
   - Verify auto-validation works ✅
   - Verify appears in hire wizard ✅

3. **Edit custom component:**
   - Go to Custom Components tab
   - Click edit
   - Change tax treatment
   - Verify saves correctly ✅

### Test as Super Admin

1. **Seed new country:**
   - Create migration
   - Insert standard components
   - Insert templates
   - Verify components available ✅

2. **Update formula:**
   - Edit metadata JSON
   - Update calculation rule
   - Test in payroll calculator ✅

---

## 📚 Related Guides

- **Formulas Deep Dive:** `/docs/SALARY-COMPONENT-FORMULAS.md`
- **Testing Guide:** `/docs/FEATURE-TESTING-GUIDE.md`
- **Implementation Summary:** `/docs/SALARY-COMPONENTS-IMPLEMENTATION-SUMMARY.md`

---

## ❓ FAQ by Role

### HR Manager

**Q: Why did seniority bonus appear on my employee's payslip?**
A: The system automatically adds seniority after 1 year of service (2% per year of base salary).

**Q: How do I add a phone allowance?**
A: In the hire wizard, click "Ajouter une indemnité" and select "Prime de téléphone" from the list.

**Q: Can I remove auto-calculated components?**
A: Not directly. Contact your admin to disable seniority or family allowance calculations.

### Tenant Admin

**Q: How do I make a custom component available to all employees?**
A: Create it in Settings → Salary Components. It will appear in the hire wizard automatically.

**Q: What's the difference between templates and custom components?**
A: Templates are pre-built by Preem (phone, performance, etc.). Custom components are yours (mining bonus, hazard pay, etc.).

**Q: Can I change the seniority formula (2% per year)?**
A: No, that's controlled by super admin. Contact Preem support to request changes.

### Super Admin

**Q: How do I add a new country?**
A: Create a migration with standard components, templates, and sector configs. Update metadata builders if tax rules differ significantly.

**Q: How do I change a formula for all tenants?**
A: Update the standard component metadata in the database. Changes apply to new calculations only (historical payslips unchanged).

**Q: Can I create formula types beyond percentage/auto-calculated?**
A: Yes, extend the metadata schema and implement calculators in `component-calculator.ts`.

---

**Bottom Line:** Most users (HR Managers) never see formulas. Admins see friendly checkboxes. Super admins control the magic behind the scenes.
