# Onboarding V2 - Implementation Status

**Date:** October 12, 2025
**Status:** CORE INFRASTRUCTURE COMPLETE - Frontend Pages Remaining

---

## ✅ Completed (Phase 1-2: Backend & Infrastructure)

### 1. Database Schema Updates
**File:** `/drizzle/schema.ts`
- ✅ Added `maritalStatus` field (varchar, 20)
- ✅ Added `dependentChildren` field (integer, default 0)
- ✅ Added `fiscalParts` field (numeric 3,1, default 1.0)
- ✅ Added `hasFamily` field (boolean, default false)
- ✅ Added validation constraint for marital status

**Migration File:** `/supabase/migrations/20251012_add_employee_family_status_fields.sql`
- ✅ ALTER TABLE statements for all new fields
- ✅ Default value updates for existing employees
- ✅ Comments explaining fiscal parts calculation
- ✅ Check constraint for valid marital status values

### 2. Backend Services
**File:** `/features/onboarding/services/onboarding-v2.service.ts` (NEW - 434 lines)
- ✅ `setCompanyInfoV2()` - Company info with sector field
- ✅ `createFirstEmployeeV2()` - **CRITICAL**: With family status, fiscal parts calculation, and immediate payslip preview
- ✅ `createFirstPayrollRun()` - Stores frequency, creates draft run
- ✅ `completeOnboardingV2()` - Marks onboarding complete
- ✅ All TypeScript types defined
- ✅ Proper error handling with ValidationError and NotFoundError
- ✅ Transaction-safe employee creation
- ✅ Integration with `calculatePayrollV2()` for payslip preview

### 3. tRPC API Endpoints
**File:** `/server/routers/onboarding.ts` (Updated)
- ✅ Imported V2 service functions
- ✅ `setCompanyInfoV2` endpoint with sector validation
- ✅ `createFirstEmployeeV2` endpoint with family status fields
- ✅ `createFirstPayrollRun` endpoint with frequency
- ✅ `completeOnboardingV2` endpoint
- ✅ All endpoints with proper Zod validation
- ✅ Error handling with TRPCError

### 4. Reusable Components (Created)
**Directory:** `/features/onboarding/components/`

- ✅ `onboarding-question.tsx` - Layout wrapper with progress bar (56 lines)
- ✅ `form-field.tsx` - Reusable form field with validation (73 lines)
- ✅ `country-selector.tsx` - Country selection cards (113 lines)
- ✅ `company-info-form.tsx` - Company info form with sector dropdown (83 lines)

---

## 🚧 Remaining Work (Phase 3: Frontend Pages)

### Components Still Needed

1. **`employee-form-v2.tsx`** (CRITICAL - ~250 lines)
   - Form with ALL fields: firstName, lastName, email, phone, positionTitle, baseSalary, hireDate
   - **CRITICAL**: Family status section (maritalStatus, dependentChildren)
   - Allowances section (collapsible): transportAllowance, housingAllowance, mealAllowance
   - Fiscal parts preview calculation
   - React Hook Form + Zod validation

2. **`payslip-preview-card.tsx`** (SUCCESS MOMENT - ~150 lines)
   - Display employee name with checkmark
   - Gross salary breakdown
   - CNPS, CMU, ITS deductions
   - **NET SALARY** (large, green, prominent)
   - Collapsible detailed breakdown
   - Action buttons: "C'est correct, continuer" and "Modifier"

3. **`frequency-selector.tsx`** (~80 lines)
   - Monthly frequency card
   - Bi-weekly frequency card
   - Examples for each frequency

4. **`success-celebration.tsx`** (~50 lines)
   - Confetti animation
   - Success icon/illustration
   - Checklist of completed items

5. **`progressive-feature-cards.tsx`** (~80 lines)
   - Optional feature upsell cards
   - Grid layout with icons
   - Links to feature setup pages

### Pages Still Needed

**Directory:** `/app/onboarding/`

1. **`q1/page.tsx`** - Country + Company Info (~150 lines)
   - Step 1: Country Selector (with optimistic UI)
   - Step 2: Company Info Form (appears after country selected)
   - tRPC mutations: `selectCountry`, `setCompanyInfoV2`
   - Navigation to Q2 on success

2. **`q2/page.tsx`** - First Employee + Payslip Preview (~200 lines)
   - Employee Form V2 with family status
   - tRPC mutation: `createFirstEmployeeV2`
   - **CRITICAL**: Show PayslipPreviewCard immediately after creation
   - Confetti on success
   - Navigation to Q3

3. **`q3/page.tsx`** - Payroll Frequency (~100 lines)
   - Frequency Selector
   - tRPC mutation: `createFirstPayrollRun`
   - Navigation to success page

4. **`success/page.tsx`** - Success Screen (~250 lines)
   - Success Celebration component
   - Summary cards (employee count, total net salary, frequency)
   - Checklist of completed items
   - Primary CTA: "Voir le bulletin de paie"
   - Secondary CTA: "Aller au tableau de bord"
   - Progressive feature cards
   - tRPC mutation: `completeOnboardingV2` (on mount)

---

## 📋 Implementation Checklist

### ✅ Completed
- [x] Database schema changes
- [x] Database migration file
- [x] Backend service functions (onboarding-v2.service.ts)
- [x] tRPC router endpoints (V2)
- [x] Reusable layout components (onboarding-question, form-field)
- [x] Country selector component
- [x] Company info form component

### 🚧 In Progress / Remaining
- [ ] Employee form V2 component (WITH FAMILY STATUS)
- [ ] Payslip preview card component
- [ ] Frequency selector component
- [ ] Success celebration component
- [ ] Progressive feature cards component
- [ ] Q1 page (Country + Company)
- [ ] Q2 page (Employee + Payslip)
- [ ] Q3 page (Frequency)
- [ ] Success page

### ⏰ Future Enhancements
- [ ] Optimistic UI refinements (loading states, error rollback)
- [ ] Unit tests for service functions
- [ ] Integration tests for complete flow
- [ ] E2E tests with Playwright
- [ ] User testing with 5 non-technical users
- [ ] Performance optimization
- [ ] Analytics tracking
- [ ] A/B testing infrastructure

---

## 🎯 Critical Success Factors

### 1. Family Status Collection (PAYROLL CORRECTNESS)
**Status:** ✅ Backend infrastructure complete, frontend form pending

The employee form MUST collect:
- Marital status (single/married/divorced/widowed)
- Number of dependent children (0-10)

Backend calculates:
- `fiscalParts` = 1.0 + (married ? 1.0 : 0) + (min(children, 4) * 0.5)
- `hasFamily` = (maritalStatus === 'married' || dependentChildren > 0)

### 2. Immediate Payslip Preview (SUCCESS MOMENT)
**Status:** ✅ Backend complete (returns payslipPreview), frontend card pending

After creating employee in Q2:
- Backend calls `calculatePayrollV2()` with fiscalParts
- Returns complete payroll calculation
- Frontend must display prominently with **NET SALARY** in large green text

### 3. Company Sector Collection
**Status:** ✅ Complete

Company info form includes sector dropdown:
- SERVICES (2% AT), COMMERCE (2% AT), TRANSPORT (3% AT), INDUSTRIE (4% AT), CONSTRUCTION (5% AT)
- Stored in `tenant.sectorCode` for payroll calculations

---

## 📝 Next Steps

### Immediate (This Session)
1. Create `employee-form-v2.tsx` with family status fields
2. Create `payslip-preview-card.tsx` for success moment
3. Create `frequency-selector.tsx` and `success-celebration.tsx`
4. Create all 4 page files (q1, q2, q3, success)

### Short-term (This Week)
1. Test complete flow locally
2. Run database migration on development
3. Verify payroll correctness with different family statuses
4. Add loading/error states
5. Test on mobile viewport

### Medium-term (Next Week)
1. User acceptance testing
2. Performance optimization
3. Analytics integration
4. Deploy to staging
5. Gradual rollout with feature flag

---

## 🔗 Key File References

### Backend
- Schema: `/drizzle/schema.ts` (lines 316-320: family status fields)
- Migration: `/supabase/migrations/20251012_add_employee_family_status_fields.sql`
- Service: `/features/onboarding/services/onboarding-v2.service.ts`
- Router: `/server/routers/onboarding.ts` (lines 464-585: V2 endpoints)
- Payroll: `/features/payroll/services/payroll-calculation-v2.ts` (line 64: calculatePayrollV2)

### Frontend (Existing)
- Layout: `/features/onboarding/components/onboarding-question.tsx`
- Form Field: `/features/onboarding/components/form-field.tsx`
- Country Selector: `/features/onboarding/components/country-selector.tsx`
- Company Form: `/features/onboarding/components/company-info-form.tsx`

### Frontend (To Create)
- Employee Form V2: `/features/onboarding/components/employee-form-v2.tsx` (PENDING)
- Payslip Preview: `/features/onboarding/components/payslip-preview-card.tsx` (PENDING)
- Frequency Selector: `/features/onboarding/components/frequency-selector.tsx` (PENDING)
- Success Components: `/features/onboarding/components/success-celebration.tsx` + `progressive-feature-cards.tsx` (PENDING)
- Pages: `/app/onboarding/q1/page.tsx`, `q2/page.tsx`, `q3/page.tsx`, `success/page.tsx` (ALL PENDING)

### Documentation
- Implementation Guide: `/docs/ONBOARDING-IMPLEMENTATION-GUIDE.md`
- Payroll Correctness: `/docs/ONBOARDING-PAYROLL-CORRECTNESS-AUDIT.md`
- HCI Principles: `/docs/HCI-DESIGN-PRINCIPLES.md`

---

## ⚠️ Important Notes

1. **Backward Compatibility:** All old onboarding endpoints are still functional. V2 endpoints are additive.

2. **Migration Safety:** The database migration sets default values for existing employees (single, 0 children, 1.0 fiscal parts).

3. **Testing Required:** Before deploying, MUST verify:
   - Fiscal parts calculation is correct
   - Tax deduction reflects family status
   - CMU employer contribution applies to employees with family
   - Sector-specific work accident rates are used

4. **Performance:** The `createFirstEmployeeV2` function runs in a transaction and returns payslip preview - ensure this completes in < 2 seconds.

5. **Mobile-First:** All components use min-h-[48px] touch targets and responsive design.

---

**Status Summary:** Core infrastructure (database, backend services, tRPC endpoints, base components) is complete. Frontend pages and remaining components need to be implemented to complete the task-first onboarding flow.
