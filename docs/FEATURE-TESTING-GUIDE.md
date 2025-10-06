# Feature Testing Guide

**Last Updated:** 2025-10-06
**Dev Server:** http://localhost:3000

---

## 🎯 Quick Navigation

| Feature | URL | Status |
|---------|-----|--------|
| **Dashboard** | `/` | ✅ |
| **Employees** | `/employees` | ✅ |
| **Hire Employee** | `/employees/new` | ✅ |
| **Employee Details** | `/employees/[id]` | ✅ |
| **Positions** | `/positions` | ✅ |
| **Create Position** | `/positions/new` | ✅ |
| **Org Chart** | `/positions/org-chart` | ✅ |
| **Salaries** | `/salaries` | ✅ |
| **Salary Bands** | `/salaries/bands` | ✅ |
| **Bulk Adjustment** | `/salaries/bulk-adjustment` | ✅ |
| **Salary Components** | `/settings/salary-components` | ✅ |
| **Payroll Calculator** | `/payroll/calculator` | ✅ |
| **Payroll Runs** | `/payroll/runs` | ✅ |
| **New Payroll Run** | `/payroll/runs/new` | ✅ |

---

## 📋 Feature Testing Workflows

### 1. Employee Management

#### 1.1 Hire a New Employee
**URL:** http://localhost:3000/employees/new

**Steps:**
1. Click "Embaucher un employé" from dashboard or employees page
2. **Step 1 - Personal Info:**
   - First Name: `Jean`
   - Last Name: `Kouassi`
   - Email: (optional - leave blank to test optional email)
   - Phone: `+225 01 23 45 67 89`
3. **Step 2 - Employment:**
   - Hire Date: Select today's date
   - Position: Select from dropdown (create one first if needed)
4. **Step 3 - Salary:**
   - Base Salary: `300000` (minimum 75,000 FCFA)
   - Housing Allowance: `50000` (optional)
   - Transport Allowance: `25000` (optional)
   - Meal Allowance: `15000` (optional)
   - Click "Ajouter une indemnité" to add custom allowances from templates
5. **Step 4 - Banking:**
   - Bank Name: `Bank of Africa`
   - Account Number: `CI12345678901234567890`
   - Tax Dependents: `2`
6. **Step 5 - Confirmation:**
   - Review all details
   - Click "Confirmer l'embauche"

**Expected Result:**
- Employee created successfully
- Redirected to employee details page
- Salary components auto-injected (base, allowances, seniority if applicable, family allowance if dependents > 0)

#### 1.2 View Employees List
**URL:** http://localhost:3000/employees

**Features to Test:**
- Search by name
- Filter by status (active/inactive)
- Filter by position
- Filter by department
- Sort by columns
- Pagination
- Click employee to view details

#### 1.3 View Employee Details
**URL:** http://localhost:3000/employees/[id]

**Features to Test:**
- Personal information tab
- Employment history
- Salary information
- Payroll history
- Edit employee button
- Terminate employee button

---

### 2. Position Management

#### 2.1 Create a Position
**URL:** http://localhost:3000/positions/new

**Steps:**
1. Position Title: `Développeur Full Stack`
2. Department: `Technologie`
3. Description: (optional)
4. Reports To: Select manager position (optional)
5. Click "Créer le poste"

**Expected Result:**
- Position created
- Available in hire wizard dropdown

#### 2.2 View Positions List
**URL:** http://localhost:3000/positions

**Features to Test:**
- View all positions
- Department grouping
- Hierarchy visualization
- Edit position
- Delete position (soft delete)

#### 2.3 View Organization Chart
**URL:** http://localhost:3000/positions/org-chart

**Features to Test:**
- Visual hierarchy tree
- Click to expand/collapse departments
- Click position to view details
- Visual indication of vacant positions

---

### 3. Salary Management

#### 3.1 View Salaries Dashboard
**URL:** http://localhost:3000/salaries

**Features to Test:**
- Total payroll overview
- Salary distribution by position
- Salary trends chart
- Upcoming reviews

#### 3.2 Salary Bands (Grilles Salariales)
**URL:** http://localhost:3000/salaries/bands

**What to Test:**
1. **View Existing Bands:**
   - See all salary bands by position/level
   - Min/Mid/Max ranges
   - Currency (FCFA)

2. **Create Salary Band:**
   - Click "Créer une grille"
   - Position: `Développeur Junior`
   - Level: `Junior`
   - Min: `200000`
   - Mid: `300000`
   - Max: `400000`
   - Click "Créer"

3. **Edit Salary Band:**
   - Click edit on existing band
   - Update ranges
   - Save changes

4. **Use Cases:**
   - Define salary ranges for positions
   - Ensure new hires fall within band
   - Track salary progression within band
   - Identify employees outside band (audit)

**Expected Result:**
- Bands displayed in table format
- Visual indicators for min/mid/max
- Validation: min < mid < max
- Used in hire wizard for salary guidance

#### 3.3 Bulk Salary Adjustment
**URL:** http://localhost:3000/salaries/bulk-adjustment

**Steps:**
1. Select adjustment type:
   - Percentage increase
   - Fixed amount increase
2. Select employees (filter by department/position)
3. Enter adjustment value
4. Preview changes
5. Apply adjustment
6. Confirm

**Expected Result:**
- Multiple salaries updated at once
- Salary history recorded
- Effective date set

---

### 4. Salary Components (Multi-Country System)

#### 4.1 View Salary Components
**URL:** http://localhost:3000/settings/salary-components

**Features to Test:**

**Tab 1 - Custom Components:**
- View tenant-specific custom components
- Edit custom component
- Delete custom component (soft delete)
- See component metadata (tax treatment, CNPS)

**Tab 2 - Template Library:**
- Browse popular templates (Phone, Performance, Responsibility, etc.)
- See suggested amounts
- One-click add to tenant (creates custom component)
- See component descriptions

**Tab 3 - Standard Components:**
- View super-admin seeded components (codes 11-41)
- See CI-specific components:
  - Code 11: Salaire de base
  - Code 21: Prime d'ancienneté
  - Code 22: Prime de transport
  - Code 23: Indemnité de logement
  - Code 24: Indemnité de repas
  - Code 41: Allocations familiales
- Read-only (cannot edit standard components)

#### 4.2 Create Custom Salary Component
**URL:** http://localhost:3000/settings/salary-components/new

**Steps:**
1. **Basic Info:**
   - Name: `Prime de risque minier`
   - Description: `Prime pour travail en zone minière`
   - Category: `Bonus`

2. **Tax Treatment (CI-specific):**
   - ☑ Imposable (taxable)
   - ☑ Include in Brut Imposable
   - ☐ Include in Salaire Catégoriel
   - Exemption Cap: (leave empty or enter amount)

3. **Social Security:**
   - ☑ Include in CNPS base

4. Click "Créer le composant"

**Expected Result:**
- Custom component created with auto-generated code (CUSTOM_001, CUSTOM_002, etc.)
- Metadata auto-built from form inputs
- Available in hire wizard "Ajouter une indemnité" dialog
- Appears in "Custom Components" tab

**Validation Rules:**
- Salaire Catégoriel requires Brut Imposable (auto-checked)
- Exemption cap must be positive number

---

### 5. Payroll

#### 5.1 Payroll Calculator (Single Employee)
**URL:** http://localhost:3000/payroll/calculator

**Steps:**
1. Select employee from dropdown
2. Select month/year
3. View calculation breakdown:
   - Gross salary (all components)
   - CNPS employee deduction
   - Taxable income (Brut Imposable)
   - ITS calculation (progressive brackets)
   - Net salary
4. Export payslip (PDF)
5. See detailed line items

**Expected Result:**
- Accurate multi-country calculations
- All salary components included
- Tax brackets applied correctly
- Family deductions considered
- CNPS calculated on correct base

#### 5.2 View Payroll Runs
**URL:** http://localhost:3000/payroll/runs

**Features to Test:**
- View all past payroll runs
- Filter by month/year
- Filter by status (draft/approved/paid)
- Click to view run details
- See total amounts
- Export reports

#### 5.3 Create New Payroll Run
**URL:** http://localhost:3000/payroll/runs/new

**Steps:**
1. **Step 1 - Period:**
   - Select month: `October`
   - Select year: `2025`

2. **Step 2 - Employees:**
   - Auto-loads all active employees
   - Review employee list
   - Exclude any employees if needed

3. **Step 3 - Calculate:**
   - System calculates all payrolls
   - Review calculations
   - See errors/warnings
   - Edit individual payroll if needed

4. **Step 4 - Review:**
   - See total gross
   - See total net
   - See total employer contributions
   - Preview payslips

5. **Step 5 - Approve:**
   - Mark as approved
   - Generate all payslips
   - Export to accounting software

**Expected Result:**
- Batch payroll for all employees
- All components included
- Accurate calculations per employee
- Bulk export capability
- Payslips generated

#### 5.4 View Payroll Run Details
**URL:** http://localhost:3000/payroll/runs/[id]

**Features to Test:**
- View all payslips in run
- Download individual payslips
- Download bulk export
- See run summary
- Edit payroll (if draft)
- Approve run
- Mark as paid

---

## 🧪 Multi-Country Features to Test

### Country-Specific Calculations

**Côte d'Ivoire (CI):**
- Minimum wage: 75,000 FCFA
- CNPS: 6.3% employee, 16.5% employer
- ITS brackets: 1.5%, 10%, 15%, 20%, 25%, 30%, 35%, 60%
- Family deductions: Loaded from database
- Transport allowance: Exempt up to 30,000 FCFA
- Salaire Catégoriel: Subset of Brut Imposable

**Salary Component Metadata:**
- CI components have 3 tax bases (Brut Imposable, Salaire Catégoriel, CNPS)
- BF components have percentage exemptions (future)
- SN components have standard deduction (future)

---

## 📊 Data to Verify

### Database Tables

Use Supabase MCP or direct SQL to verify:

```sql
-- Check employees
SELECT * FROM employees ORDER BY created_at DESC LIMIT 10;

-- Check salary components on employee
SELECT
  e.first_name,
  e.last_name,
  s.components
FROM employees e
JOIN employee_salaries s ON e.id = s.employee_id
WHERE s.components IS NOT NULL;

-- Check custom salary components
SELECT * FROM custom_salary_components
WHERE tenant_id = 'your-tenant-id'
ORDER BY created_at DESC;

-- Check salary bands
SELECT * FROM salary_bands ORDER BY min_salary;

-- Check payroll runs
SELECT * FROM payroll_runs ORDER BY period_start DESC;

-- Check standard components
SELECT * FROM salary_component_definitions
WHERE country_code = 'CI'
ORDER BY display_order;

-- Check template library
SELECT * FROM salary_component_templates
WHERE country_code = 'CI' AND is_popular = true;
```

---

## 🐛 Known Issues to Test

1. **Email Optional:** Verify employees can be created without email
2. **Encryption:** Verify PII is encrypted (email, phone, national ID)
3. **Component Auto-Injection:** Verify seniority and family allowance auto-inject
4. **Tax Calculation:** Verify progressive brackets applied correctly
5. **CNPS Base:** Verify only correct components included in CNPS base

---

## 🔍 Edge Cases to Test

### Employee Management
- [ ] Hire employee with no email
- [ ] Hire employee with no phone
- [ ] Hire employee with 0 dependents
- [ ] Hire employee with base salary = minimum wage (75,000)
- [ ] Hire employee with > 10 dependents (should fail validation)

### Salary Components
- [ ] Create component with exemption cap
- [ ] Create component not taxable
- [ ] Create component not in CNPS base
- [ ] Add from template then customize
- [ ] Delete custom component (verify soft delete)

### Payroll
- [ ] Calculate payroll with no allowances
- [ ] Calculate payroll with all allowances
- [ ] Calculate payroll with custom components
- [ ] Calculate payroll for employee with 0 dependents
- [ ] Calculate payroll for employee with max dependents

### Salary Bands
- [ ] Create band with min = mid = max (should fail)
- [ ] Create band with min > max (should fail)
- [ ] Create overlapping bands for same position
- [ ] Hire employee outside band range (should warn)

---

## 📝 Test Checklist

### Phase 1: Basic CRUD
- [ ] Create employee (with email)
- [ ] Create employee (without email)
- [ ] View employee list
- [ ] View employee details
- [ ] Create position
- [ ] View positions
- [ ] View org chart

### Phase 2: Salary Components
- [ ] View standard components (Tab 3)
- [ ] View template library (Tab 2)
- [ ] Add from template (one-click)
- [ ] View custom components (Tab 1)
- [ ] Create custom component
- [ ] Edit custom component
- [ ] Delete custom component
- [ ] Use custom component in hire wizard

### Phase 3: Salary Management
- [ ] View salary bands
- [ ] Create salary band
- [ ] Edit salary band
- [ ] Bulk salary adjustment

### Phase 4: Payroll
- [ ] Use payroll calculator (single employee)
- [ ] Create payroll run (batch)
- [ ] Review calculations
- [ ] Approve payroll run
- [ ] Export payslips
- [ ] View payroll history

### Phase 5: Multi-Country
- [ ] Verify CI tax calculations
- [ ] Verify CNPS calculations
- [ ] Verify family deductions
- [ ] Verify component metadata
- [ ] Verify exemption caps

---

## 🚀 Quick Test Scenarios

### Scenario 1: Hire Employee with Components
1. Go to `/employees/new`
2. Fill personal info (no email)
3. Fill employment info
4. Base salary: 300,000
5. Click "Ajouter une indemnité" → Select "Prime de téléphone" (10,000)
6. Add 2 dependents
7. Complete wizard
8. **Verify:** Employee created with 4 components (base, phone, family allowance if dependents > 0)

### Scenario 2: Create Custom Component
1. Go to `/settings/salary-components/new`
2. Create "Prime de risque" (30,000)
3. Mark as taxable, in Brut Imposable, not in Salaire Catégoriel
4. Include in CNPS
5. **Verify:** Component available in hire wizard

### Scenario 3: Run Payroll
1. Ensure 3+ employees exist
2. Go to `/payroll/runs/new`
3. Select current month
4. Review employees
5. Calculate
6. **Verify:** All components included, taxes correct, CNPS correct

---

## 📞 Support

If features don't work as expected:
1. Check browser console for errors
2. Check dev server logs: `BashOutput 4e4842`
3. Verify environment variables in `.env.local`
4. Check Supabase database for data

---

**Happy Testing! 🎉**
