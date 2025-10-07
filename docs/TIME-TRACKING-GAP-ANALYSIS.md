# Time Tracking & Time-Off Gap Analysis

**Date:** 2025-10-07
**Status:** 🔴 **CRITICAL GAPS IDENTIFIED**

---

## Terminology Clarification

### Time-Off vs Leave Management

**They are THE SAME THING** - just different terminology:

| Term | Usage | Examples |
|------|-------|----------|
| **Time-Off** | American English, tech industry | "Request time-off", "Time-off balance" |
| **Leave Management** | British English, HR industry | "Leave request", "Leave balance" |
| **Congés** | French (our UI) | "Demande de congé", "Solde de congés" |

**In Preem HR:**
- Database/code: `time_off_*` tables (following American convention)
- UI: "Congés" (French)
- Documentation: Both terms used interchangeably

**No difference in functionality** - it's purely linguistic preference.

---

## Current Implementation Status

### ✅ What's Working (Track 1 Complete)

**Time Tracking:**
- ✅ Clock in/out with GPS validation
- ✅ Geofence configuration and validation
- ✅ Basic overtime detection (hours 41-46, 46+, weekend)
- ✅ Time entry history and approval workflow
- ✅ tRPC API (10 endpoints)
- ✅ Mobile-first UI

**Time-Off (Leave Management):**
- ✅ Request time-off with balance validation
- ✅ Time-off policies from templates
- ✅ Leave balance tracking (available, used, pending)
- ✅ Convention Collective compliance (3-tier system)
- ✅ tRPC API (10 endpoints)
- ✅ Mobile-first UI

**Payroll Integration:**
- ✅ `getTimeTrackingDataForPayroll()` service
- ✅ Overtime breakdown export to payroll
- ✅ Documented integration pattern

---

## 🔴 CRITICAL GAPS (P0 - Must Fix)

### GAP 1: Overtime Compliance - Incomplete Rules

**Issue:** Current implementation only has 2 overtime types (41-46h, weekend). Convention Collective requires 6 types.

**Current State:**
```sql
-- overtime_rules table (existing)
INSERT INTO overtime_rules (country_code, period_type, rate_multiplier) VALUES
('CI', 'hours_41_to_46', 1.15),
('CI', 'weekend', 1.75);
```

**Required (Article 23):**
```sql
INSERT INTO overtime_rules (country_code, period_type, rate_multiplier) VALUES
('CI', 'hours_41_to_46', 1.15),  -- ✅ EXISTS
('CI', 'hours_above_46', 1.50),  -- ❌ MISSING
('CI', 'saturday', 1.50),         -- ❌ MISSING (different from Sunday)
('CI', 'sunday', 1.75),           -- ✅ EXISTS (labeled 'weekend')
('CI', 'holiday', 2.00),          -- ❌ MISSING
('CI', 'night_work', 1.75);       -- ❌ MISSING (21h-6h)
```

**Impact:**
- ⚠️ **LEGAL RISK:** Employees working Saturday (1.50×) paid same as Sunday (1.75×)
- ⚠️ **UNDERPAYMENT:** Night workers not getting +75% premium
- ⚠️ **HOLIDAY VIOLATIONS:** Holiday work should be 2.00× (currently not tracked)

**Fix Required:**
1. Add missing overtime types to `overtime_rules` table
2. Update `overtime.service.ts` to classify:
   - Saturday vs Sunday (different rates)
   - Night work (21h-6h)
   - Public holidays (requires holidays table)
3. Update time entry classification logic

**Effort:** 1-2 days
**Priority:** P0 - Must fix before production

---

### GAP 2: Public Holidays Not Tracked

**Issue:** No `public_holidays` table or holiday tracking. Required for:
- Holiday overtime (2.00× multiplier)
- Time-off calculation (exclude holidays from leave days)
- Payroll (holiday pay requirements)

**Required:**
```sql
CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(2) NOT NULL REFERENCES countries(code),
  holiday_date DATE NOT NULL,
  name JSONB NOT NULL, -- {"fr": "Jour de l'An", "en": "New Year's Day"}
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country_code, holiday_date)
);

-- Seed CI holidays (2025)
INSERT INTO public_holidays (country_code, holiday_date, name, is_recurring) VALUES
('CI', '2025-01-01', '{"fr": "Jour de l\'An"}', TRUE),
('CI', '2025-04-18', '{"fr": "Vendredi Saint"}', FALSE),
('CI', '2025-04-21', '{"fr": "Lundi de Pâques"}', FALSE),
('CI', '2025-05-01', '{"fr": "Fête du Travail"}', TRUE),
('CI', '2025-05-29', '{"fr": "Ascension"}', FALSE),
('CI', '2025-08-07', '{"fr": "Fête de l\'Indépendance"}', TRUE),
('CI', '2025-08-15', '{"fr": "Assomption"}', TRUE),
('CI', '2025-11-01', '{"fr": "Toussaint"}', TRUE),
('CI', '2025-11-15', '{"fr": "Journée Nationale de la Paix"}', TRUE),
('CI', '2025-12-25', '{"fr": "Noël"}', TRUE);
```

**Impact:**
- ❌ Cannot detect holiday work (2.00× multiplier)
- ❌ Time-off requests don't exclude holidays (e.g., request 5 days but only 3 are workdays)
- ❌ Payroll doesn't know when to apply holiday bonuses

**Fix Required:**
1. Create `public_holidays` table and migration
2. Seed CI/SN/BF holidays for 2025-2030
3. Update `calculateBusinessDays()` in time-off service
4. Update overtime classification to check holiday dates
5. Add holiday management UI (admin can add/remove holidays)

**Effort:** 2-3 days
**Priority:** P0 - Required for accurate time-off and overtime

---

### GAP 3: Time-Off Accrual Not Automated

**Issue:** Balances created manually. No monthly accrual job.

**Current State:**
- Balances exist in database (24 annual, 15 sick)
- But no automation to accrue 2.0 days/month

**Required (Article 28):**
- **Accrual:** 2.0 days per month worked
- **Run monthly:** 1st of each month
- **Pro-rate:** Mid-month hires get proportional accrual
- **Age-based:** Under 21 = 2.5 days/month
- **Seniority:** 15/20/25 years = +2/+4/+6 days bonus

**Fix Required:**
1. Create cron job (Supabase Edge Function or pg_cron)
2. Implement `accrueMonthlyLeave()` service:
   ```typescript
   async function accrueMonthlyLeave() {
     // For each active employee
     const employees = await db.query.employees.findMany({
       where: eq(employees.status, 'active'),
     });

     for (const emp of employees) {
       // Calculate accrual rate
       const age = calculateAge(emp.date_of_birth);
       const seniority = calculateSeniority(emp.hire_date);

       let monthlyRate = 2.0; // Standard CI rate
       if (age < 21) monthlyRate = 2.5; // Article 28

       let bonusDays = 0;
       if (seniority >= 25) bonusDays = 6;
       else if (seniority >= 20) bonusDays = 4;
       else if (seniority >= 15) bonusDays = 2;

       const totalAnnual = (monthlyRate * 12) + bonusDays;
       const monthlyAccrual = totalAnnual / 12;

       // Update balance
       await db.update(time_off_balances)
         .set({ balance: sql`balance + ${monthlyAccrual}` })
         .where(and(
           eq(time_off_balances.employee_id, emp.id),
           eq(time_off_balances.policy_id, annualLeavePolicy.id)
         ));
     }
   }
   ```
3. Schedule job (pg_cron):
   ```sql
   SELECT cron.schedule(
     'monthly-leave-accrual',
     '0 0 1 * *', -- 1st of every month at midnight
     $$SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/accrue-leave',
       headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}
     )$$
   );
   ```

**Effort:** 2-3 days
**Priority:** P0 - Critical for compliance

---

### GAP 4: Overtime Limits Not Enforced

**Issue:** No validation for maximum weekly overtime (Article 23: max 15h/week).

**Current State:**
- Overtime detected and classified
- But no validation preventing > 15h/week

**Required:**
```typescript
// In overtime.service.ts
export async function validateOvertimeLimit(
  employeeId: string,
  weekStart: Date,
  additionalHours: number
) {
  const weekEnd = addDays(weekStart, 6);

  // Get existing overtime this week
  const entries = await db.query.time_entries.findMany({
    where: and(
      eq(time_entries.employee_id, employeeId),
      gte(time_entries.clock_in, weekStart),
      lte(time_entries.clock_in, weekEnd)
    ),
  });

  const totalOvertimeThisWeek = entries.reduce((sum, entry) => {
    const breakdown = entry.overtime_breakdown as OvertimeBreakdown;
    return sum +
      (breakdown?.hours_41_to_46 || 0) +
      (breakdown?.hours_above_46 || 0) +
      (breakdown?.weekend || 0);
  }, 0);

  const maxWeeklyOvertime = 15; // Article 23

  if (totalOvertimeThisWeek + additionalHours > maxWeeklyOvertime) {
    throw new Error(
      `Dépassement de la limite d'heures supplémentaires. ` +
      `Maximum: ${maxWeeklyOvertime}h/semaine. ` +
      `Déjà effectué: ${totalOvertimeThisWeek}h. ` +
      `Demandé: ${additionalHours}h.`
    );
  }
}
```

**Impact:**
- ⚠️ **LEGAL VIOLATION:** Companies can exceed legal overtime limits
- ⚠️ **LABOR INSPECTION RISK:** Fines for exceeding 15h/week

**Fix Required:**
1. Add validation in `clockOut()` service
2. Show warning in UI when approaching limit
3. Block clock out if would exceed limit (with override for emergencies)

**Effort:** 1 day
**Priority:** P1 - Important for compliance

---

## ⚠️ IMPORTANT GAPS (P1 - Should Fix Soon)

### GAP 5: Age-Based Accrual Not Implemented

**Issue:** Under-21 employees should get 2.5 days/month (30 days/year) vs standard 2.0 (24 days).

**Required (Article 28):**
> "Les travailleurs âgés de moins de 21 ans au 31 décembre de l'année de référence bénéficient de 2 jours et demi de congé par mois de service effectif."

**Fix Required:**
1. Add `date_of_birth` check in accrual logic
2. Calculate age at December 31 of reference year
3. Apply 2.5 vs 2.0 rate
4. Already in `time_off_policy_templates.metadata` - just needs service logic

**Effort:** 1 day
**Priority:** P1

---

### GAP 6: Seniority Bonus Not Implemented

**Issue:** Employees with 15/20/25 years service should get +2/+4/+6 bonus days.

**Required (Article 28):**
- 15 years: +2 days (26 total)
- 20 years: +4 days (28 total)
- 25 years: +6 days (30 total)

**Fix Required:**
1. Calculate seniority from `hire_date`
2. Add bonus days in accrual calculation
3. Show in UI: "24 jours standard + 2 jours ancienneté"

**Effort:** 1 day
**Priority:** P1

---

### GAP 7: Carryover Not Enforced

**Issue:** Employees can carry over unlimited days. Law requires max 6-month carryover.

**Required (Article 28):**
> "Les congés non pris doivent être pris dans les 6 mois suivant la période de référence, sinon ils sont perdus."

**Fix Required:**
1. Add `expires_at` to `time_off_balances`
2. Set `expires_at` = 6 months after period end
3. Run monthly job to expire old balances:
   ```sql
   UPDATE time_off_balances
   SET balance = balance - expired_amount,
       metadata = jsonb_set(metadata, '{expired}', to_jsonb(expired_amount))
   WHERE expires_at < NOW()
     AND balance > 0;
   ```
4. Notify employees 1 month before expiration

**Effort:** 2 days
**Priority:** P1

---

### GAP 8: Special Leave Types Not Implemented

**Issue:** Marriage, birth, death leave templates exist but not fully functional.

**Required (Article 28):**
- Marriage (employee): 4 days
- Marriage (child): 2 days
- Birth: 3 days
- Death (spouse/child): 5 days
- Death (parent): 3 days
- Death (sibling): 2 days
- Moving: 2 days

**Current State:**
- ✅ Templates seeded in database
- ❌ Not linked to employee balances
- ❌ No UI to request special leave
- ❌ No one-time accrual logic (should get 4 days on marriage, not monthly)

**Fix Required:**
1. Add `accrual_method` = 'one_time_event' to policy types
2. Create flow: employee triggers event → system grants days
3. Add to time-off request form: "Type d'événement spécial"
4. Auto-approve (no manager needed for these)

**Effort:** 2-3 days
**Priority:** P1

---

### GAP 9: Minimum Continuous Leave Not Enforced

**Issue:** No validation for 12-day minimum continuous leave per year (Article 28).

**Required:**
> "La durée du congé principal ne peut être inférieure à 12 jours ouvrables consécutifs."

**Fix Required:**
```typescript
// In time-off.service.ts
async function validateContinuousLeave(employeeId: string, year: number) {
  // Check if employee has taken >= 12 continuous days this year
  const requests = await db.query.time_off_requests.findMany({
    where: and(
      eq(time_off_requests.employee_id, employeeId),
      eq(time_off_requests.status, 'approved'),
      gte(time_off_requests.start_date, new Date(`${year}-01-01`)),
      lte(time_off_requests.end_date, new Date(`${year}-12-31`)),
      eq(time_off_requests.policy_id, annualLeavePolicyId)
    ),
  });

  const hasContinuous12Days = requests.some(r => r.total_days >= 12);

  if (!hasContinuous12Days && isEndOfYear(year)) {
    // Warn employee: must take 12 continuous days
    throw new Error(
      'Vous devez prendre au moins 12 jours consécutifs de congés cette année. ' +
      'Convention Collective Article 28.'
    );
  }
}
```

**Effort:** 1 day
**Priority:** P1

---

### GAP 10: Offline Sync Not Implemented

**Issue:** Documentation mentions offline queue, but not coded.

**Current State:**
- ✅ Clock in/out works
- ❌ No offline storage
- ❌ No sync queue
- ❌ Network failure = lost clock in

**Required (from EPIC-07):**
- Queue clock in/out when offline
- Sync when network returns
- Show "Sera synchronisé quand vous aurez du réseau"

**Fix Required:**
1. Use IndexedDB/AsyncStorage for offline queue
2. Store actions: `{ action: 'clockIn', params: {...}, timestamp }`
3. On reconnect: POST queued actions
4. Handle conflicts (e.g., clock in already exists)

**Effort:** 3-4 days
**Priority:** P1 (important for mobile workers with poor connectivity)

---

### GAP 11: Photo Verification Not Functional

**Issue:** ClockInButton mentions photo, but upload not implemented.

**Current State:**
- ✅ Photo capture mentioned in docs
- ❌ No photo upload service
- ❌ No Supabase storage bucket configured
- ❌ `clock_in_photo_url` always null

**Fix Required:**
1. Create Supabase storage bucket: `time-entry-photos`
2. Configure RLS: employees can upload own photos
3. Implement upload in `ClockInButton`:
   ```typescript
   const photoUrl = await supabase.storage
     .from('time-entry-photos')
     .upload(`${employeeId}/${Date.now()}.jpg`, photoBlob);
   ```
4. Pass `photoUrl` to `clockIn` mutation

**Effort:** 1-2 days
**Priority:** P2 (nice-to-have, not critical)

---

### GAP 12: Manager Approval UI Missing

**Issue:** Approval endpoints exist, but no manager page to use them.

**Current State:**
- ✅ `approveEntry`, `rejectEntry` tRPC endpoints
- ✅ `approve`, `reject` time-off endpoints
- ❌ No `/manager/approvals` page
- ❌ Managers can't actually approve anything

**Fix Required:**
1. Create `/manager/time-tracking` page:
   - List pending time entries for team
   - Approve/reject buttons
   - Show overtime breakdown
2. Create `/manager/time-off` page:
   - List pending time-off requests
   - Approve/reject with notes
   - Show team calendar
3. Add notifications when new request arrives

**Effort:** 3-4 days
**Priority:** P1 (critical for workflow)

---

## 📊 Gap Summary

### By Priority

| Priority | Count | Effort | Description |
|----------|-------|--------|-------------|
| **P0** | 4 gaps | 8-11 days | Must fix before production (legal compliance) |
| **P1** | 8 gaps | 16-21 days | Should fix soon (important features) |
| **P2** | 1 gap | 1-2 days | Nice-to-have (photo verification) |

### By Category

| Category | Gaps | Status |
|----------|------|--------|
| **Overtime Compliance** | 3 gaps | 🔴 Critical - incomplete rules |
| **Leave Accrual** | 3 gaps | 🔴 Critical - no automation |
| **Special Leave** | 2 gaps | 🟡 Important - templates exist, logic missing |
| **Monitoring & Limits** | 2 gaps | 🟡 Important - validation missing |
| **Mobile UX** | 2 gaps | 🟡 Important - offline, photos |
| **Manager Tools** | 1 gap | 🟡 Important - approval UI |

---

## Recommended Fixes Roadmap

### Week 1: P0 Compliance Fixes (8-11 days)
1. **Day 1-2:** Complete overtime rules (Saturday, night, holiday classification)
2. **Day 3-4:** Create public holidays table + seed CI holidays
3. **Day 5-7:** Implement monthly accrual automation (age + seniority)
4. **Day 8:** Add overtime limit validation (15h/week)

**Deliverable:** Fully compliant overtime + leave accrual

---

### Week 2: P1 Feature Completion (16-21 days)
1. **Day 1-2:** Carryover enforcement (6-month expiration)
2. **Day 3:** Minimum continuous leave validation (12 days)
3. **Day 4-6:** Special leave implementation (marriage, birth, death)
4. **Day 7-10:** Manager approval UI (time tracking + time-off)
5. **Day 11-14:** Offline sync queue
6. **Day 15-16:** Photo upload integration

**Deliverable:** Complete time tracking + leave management system

---

### Week 3: Multi-Country Expansion (Optional)
1. **Day 1-2:** Seed Senegal holidays + overtime rules
2. **Day 3-4:** Seed Burkina Faso rules
3. **Day 5:** Test multi-country switching
4. **Day 6-7:** Documentation updates

**Deliverable:** Multi-country ready

---

## Conclusion

**Current Status:** 65% complete (foundation solid, critical gaps remain)

**Time to Production:** 2-3 weeks for P0+P1 compliance

**Biggest Risks:**
1. 🔴 Incomplete overtime rules (legal violation)
2. 🔴 No leave accrual automation (employees won't get days)
3. 🔴 No holiday tracking (wrong overtime pay, wrong time-off calc)

**Recommendation:**
- **DO NOT GO TO PRODUCTION** until P0 gaps fixed
- Fix P0 gaps first (Week 1)
- Add P1 features incrementally (Week 2)
- Test thoroughly with real data (Week 3)

---

**Next Steps:** Prioritize P0 fixes and create implementation tasks?
