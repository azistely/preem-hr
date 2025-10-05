# ⏰ EPIC: Time Tracking & Attendance

## Epic Overview

**Goal:** Implement mobile-first time tracking with geofencing, photo verification, offline sync, and integration with payroll for overtime calculation.

**Priority:** P0 (Must-have for MVP - feeds into payroll)

**Source Documents:**
- `01-CONSTRAINTS-AND-RULES.md` - Mobile-first constraints, offline support
- `02-ARCHITECTURE-OVERVIEW.md` - Event-driven patterns, mobile architecture
- `03-DATABASE-SCHEMA.md` - Tables: time_entries, time_off_requests, time_off_balances
- `04-DOMAIN-MODELS.md` - Business entities, validation rules, domain events
- `payroll-cote-d-ivoire.md:96-112` - Overtime rules and multipliers
- `HCI-DESIGN-PRINCIPLES.md` - **UX design principles for low digital literacy**
- `09-EPIC-WORKFLOW-AUTOMATION.md` - Leave notifications, approval workflows

**Dependencies:**
- Employee Management (employees must exist)
- Geolocation services (mobile device GPS)
- File storage (Supabase for photos)
- Multi-country configuration (overtime rules by country)

**Dependent Systems:**
- Payroll (consumes overtime hours for pay calculation)
- Workflows (approval chains for time-off)
- Reports (attendance analytics)

---

## Success Criteria

- [x] Clock in/out from mobile with GPS location
- [x] Geofence validation (only within designated work area)
- [x] Photo verification on clock in/out
- [x] Offline sync (queue entries when no network)
- [x] Automatic overtime detection (> 40 hours/week)
- [x] Time-off request and approval workflow
- [x] Leave balance accrual automation
- [x] Integration with payroll (overtime → pay calculation)
- [x] Approval workflow for managers
- [x] French mobile UI for low digital literacy

---

## Features & User Stories

### FEATURE 1: Time Entry (Clock In/Out)

#### Story 1.1: Clock In (Mobile)
**As an** employee
**I want** to clock in from my mobile phone
**So that** my work hours are tracked

**Acceptance Criteria:**
- [ ] Capture current GPS location
- [ ] Validate location within geofence (if configured)
- [ ] Capture optional photo (selfie)
- [ ] Create time_entry record with clock_in timestamp
- [ ] Work offline (queue if no network)
- [ ] Show confirmation with time and location
- [ ] Large touch target (min 44x44px button)
- [ ] Simple French: "Pointer l'arrivée"

**Test Cases:**
```typescript
describe('Clock In', () => {
  it('should create time entry with location', async () => {
    const result = await caller.timeTracking.clockIn({
      employeeId: emp.id,
      location: {
        latitude: 5.3600, // Abidjan coordinates
        longitude: -4.0083,
      },
      photoUrl: 'https://storage.supabase.co/...',
    });

    expect(result.id).toBeDefined();
    expect(result.clock_in).toBeDefined();
    expect(result.clock_in_location).toEqual({
      type: 'Point',
      coordinates: [-4.0083, 5.3600], // GeoJSON format [lng, lat]
    });
    expect(result.clock_in_photo_url).toBeDefined();
    expect(result.clock_out).toBeNull();
  });

  it('should validate geofence if configured', async () => {
    // Configure geofence: office at (5.3600, -4.0083), radius 100m
    await setGeofence(tenant.id, {
      latitude: 5.3600,
      longitude: -4.0083,
      radiusMeters: 100,
    });

    // Try to clock in from far away
    await expect(
      caller.timeTracking.clockIn({
        employeeId: emp.id,
        location: {
          latitude: 6.0000, // ~70km away
          longitude: -4.0000,
        },
      })
    ).rejects.toThrow('Vous êtes trop loin du lieu de travail');
  });

  it('should allow clock in within geofence', async () => {
    await setGeofence(tenant.id, {
      latitude: 5.3600,
      longitude: -4.0083,
      radiusMeters: 100,
    });

    // Clock in 50m away
    const result = await caller.timeTracking.clockIn({
      employeeId: emp.id,
      location: {
        latitude: 5.3605, // ~50m from geofence center
        longitude: -4.0083,
      },
    });

    expect(result.geofence_verified).toBe(true);
  });

  it('should prevent double clock in', async () => {
    await caller.timeTracking.clockIn({
      employeeId: emp.id,
      location: { latitude: 5.36, longitude: -4.00 },
    });

    await expect(
      caller.timeTracking.clockIn({
        employeeId: emp.id,
        location: { latitude: 5.36, longitude: -4.00 },
      })
    ).rejects.toThrow('Vous avez déjà pointé votre arrivée');
  });

  it('should work offline (queue for sync)', async () => {
    // Simulate offline mode
    mockNetworkStatus('offline');

    const result = await caller.timeTracking.clockIn({
      employeeId: emp.id,
      location: { latitude: 5.36, longitude: -4.00 },
    });

    // Check queued locally
    const queue = await getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe('clockIn');

    // Simulate coming back online
    mockNetworkStatus('online');
    await syncOfflineQueue();

    // Check synced to server
    const synced = await db.query.time_entries.findFirst({
      where: eq(time_entries.employee_id, emp.id),
    });
    expect(synced).toBeDefined();
  });
});
```

**Mobile UI Implementation:**
```typescript
// Mobile component (React Native)
export function ClockInButton() {
  const [location, setLocation] = useState(null);
  const [photoUri, setPhotoUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleClockIn = async () => {
    setIsLoading(true);

    try {
      // 1. Get GPS location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(loc.coords);

      // 2. Optional: Take photo
      const { status } = await Camera.requestCameraPermissionsAsync();
      if (status === 'granted') {
        const photo = await capturePhoto();
        setPhotoUri(photo.uri);

        // Upload to Supabase storage
        const photoUrl = await uploadPhoto(photo.uri);
      }

      // 3. Clock in
      await api.timeTracking.clockIn.mutate({
        employeeId: currentUser.employeeId,
        location: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
        photoUrl,
      });

      Alert.alert('Succès', 'Arrivée enregistrée');
    } catch (error) {
      if (error.message.includes('trop loin')) {
        Alert.alert('Erreur', 'Vous êtes trop loin du lieu de travail');
      } else {
        // Queue offline
        await queueOfflineAction('clockIn', { location, photoUri });
        Alert.alert('Hors ligne', 'Sera synchronisé quand vous aurez du réseau');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleClockIn}
      disabled={isLoading}
      style={styles.button} // min 44x44px
    >
      <Icon name="clock" size={24} color="#fff" />
      <Text style={styles.buttonText}>Pointer l'arrivée</Text>
    </TouchableOpacity>
  );
}
```

#### Story 1.2: Clock Out (Mobile)
**As an** employee
**I want** to clock out from my mobile phone
**So that** my work hours are recorded

**Acceptance Criteria:**
- [ ] Find open time_entry (clock_out = null)
- [ ] Set clock_out timestamp
- [ ] Capture GPS location
- [ ] Capture optional photo
- [ ] Calculate total_hours (clock_out - clock_in)
- [ ] Detect if overtime (> 8 hours/day)
- [ ] Submit for approval if required
- [ ] Show summary: "Travaillé: 8h 30min"

**Test Cases:**
```typescript
describe('Clock Out', () => {
  it('should complete time entry and calculate hours', async () => {
    const clockInTime = new Date('2025-01-15T08:00:00Z');
    const clockOutTime = new Date('2025-01-15T17:30:00Z');

    // Clock in
    await caller.timeTracking.clockIn({
      employeeId: emp.id,
      location: { latitude: 5.36, longitude: -4.00 },
    });

    // Clock out
    const result = await caller.timeTracking.clockOut({
      employeeId: emp.id,
      location: { latitude: 5.36, longitude: -4.00 },
      clockOutTime,
    });

    expect(result.clock_out).toEqual(clockOutTime);
    expect(result.total_hours).toBe(9.5); // 8am - 5:30pm = 9.5 hours
    expect(result.status).toBe('pending'); // Needs approval
  });

  it('should detect overtime', async () => {
    await caller.timeTracking.clockIn({
      employeeId: emp.id,
      clockInTime: new Date('2025-01-15T08:00:00Z'),
    });

    const result = await caller.timeTracking.clockOut({
      employeeId: emp.id,
      clockOutTime: new Date('2025-01-15T19:00:00Z'), // 11 hours
    });

    expect(result.total_hours).toBe(11);
    expect(result.entry_type).toBe('overtime');
  });

  it('should prevent clock out without clock in', async () => {
    await expect(
      caller.timeTracking.clockOut({
        employeeId: emp.id,
        location: { latitude: 5.36, longitude: -4.00 },
      })
    ).rejects.toThrow('Vous n\'avez pas pointé votre arrivée');
  });
});
```

---

### FEATURE 2: Overtime Calculation & Classification

#### Story 2.1: Detect Overtime Hours
**As a** payroll system
**I want** to automatically detect overtime
**So that** employees are paid correctly

**Source:** Multi-country overtime rules (country-specific)

**Rules (Country-Specific):**

**Côte d'Ivoire:**
- Legal hours: 40/week (173.33/month)
- Hours 41-46: × 1.15
- Hours 46+: × 1.50
- Night work (21h-6h): × 1.75
- Weekend: × 1.75

**Senegal:**
- Legal hours: 40/week (173.33/month)
- Overtime: × 1.15 (first 8 hours)
- Overtime: × 1.40 (beyond 8 hours)
- Night/Sunday: × 1.60

**Implementation Note:**
- Overtime rules should be loaded from database based on `tenant.country_code`
- Consider adding `overtime_rules` table or including in country configuration
- Each country has different legal hours and multipliers

**Acceptance Criteria:**
- [ ] Sum weekly hours for employee
- [ ] Load country-specific overtime rules from database
- [ ] Classify hours by type based on country rules (e.g., CI: regular, 41-46, 46+, night, weekend)
- [ ] Store breakdown in time_entry with applicable multipliers
- [ ] Aggregate for payroll period
- [ ] Validate max overtime limits (country-specific: CI=15h/week, SN may differ)

**Test Cases:**
```typescript
describe('Overtime Detection', () => {
  it('should classify hours correctly', async () => {
    // Week: Monday-Friday 8h/day (40h) + Saturday 6h = 46h total
    const entries = [
      { day: 'Mon', hours: 8 },
      { day: 'Tue', hours: 8 },
      { day: 'Wed', hours: 8 },
      { day: 'Thu', hours: 8 },
      { day: 'Fri', hours: 8 },
      { day: 'Sat', hours: 6 },
    ];

    const overtime = await calculateWeeklyOvertime(emp.id, entries);

    expect(overtime.regularHours).toBe(40);
    expect(overtime.hours_41_to_46).toBe(6); // Saturday hours
    expect(overtime.hours_above_46).toBe(0);
  });

  it('should detect night work', async () => {
    await caller.timeTracking.clockIn({
      employeeId: emp.id,
      clockInTime: new Date('2025-01-15T22:00:00Z'), // 10pm
    });

    await caller.timeTracking.clockOut({
      employeeId: emp.id,
      clockOutTime: new Date('2025-01-16T06:00:00Z'), // 6am
    });

    const entry = await db.query.time_entries.findFirst({
      where: eq(time_entries.employee_id, emp.id),
    });

    expect(entry.entry_type).toBe('night');
    expect(entry.total_hours).toBe(8);
  });

  it('should detect Sunday work', async () => {
    const sunday = new Date('2025-01-19T08:00:00Z'); // Sunday

    await caller.timeTracking.clockIn({
      employeeId: emp.id,
      clockInTime: sunday,
    });

    await caller.timeTracking.clockOut({
      employeeId: emp.id,
      clockOutTime: new Date('2025-01-19T17:00:00Z'),
    });

    const entry = await db.query.time_entries.findFirst({
      where: eq(time_entries.employee_id, emp.id),
    });

    expect(entry.entry_type).toBe('overtime'); // Sunday
  });

  it('should aggregate for payroll period', async () => {
    // Create 10 time entries for Jan 1-31
    await createTimeEntries(emp.id, {
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      hoursPerDay: 9, // 1 hour overtime per day
    });

    const summary = await getOvertimeSummary(emp.id, {
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
    });

    expect(summary.regularHours).toBe(160); // 20 days × 8h
    expect(summary.overtimeHours).toBe(20); // 20 days × 1h
  });

  it('should enforce overtime limits', async () => {
    // Try to add 16 hours in one week (max is 15)
    await expect(
      createWeeklyTimeEntries(emp.id, {
        weekStart: new Date('2025-01-13'),
        regularHours: 40,
        overtimeHours: 16, // Exceeds limit
      })
    ).rejects.toThrow('Dépassement de la limite d\'heures supplémentaires (15h/semaine)');
  });
});
```

#### Story 2.2: Integrate Overtime with Payroll
**As a** payroll system
**I want** to consume approved overtime hours
**So that** employees are paid with correct multipliers

**Acceptance Criteria:**
- [ ] Query approved time entries for payroll period
- [ ] Sum hours by classification (41-46, 46+, night, etc.)
- [ ] Pass to payroll calculation service
- [ ] Apply multipliers from payroll-cote-d-ivoire.md
- [ ] Include in payroll_line_items.earnings_details

**Test Cases:**
```typescript
describe('Overtime Integration with Payroll', () => {
  it('should include overtime in payroll calculation', async () => {
    const emp = await createTestEmployee({
      baseSalary: 200000, // From payroll-cote-d-ivoire.md:164
    });

    // Create time entries with overtime (from example 7.2)
    await createTimeEntries(emp.id, [
      { hours: 6, type: 'hours_41_to_46' },
      { hours: 4, type: 'hours_above_46' },
    ]);

    // Run payroll
    const payroll = await calculatePayroll({
      employeeId: emp.id,
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
    });

    const hourlyRate = 200000 / 173.33; // ~1,154 FCFA

    expect(payroll.overtimePay).toBeCloseTo(14892, 0); // 7,968 + 6,924
    expect(payroll.grossSalary).toBeCloseTo(214892, 0); // 200k + 14,892
  });
});
```

---

### FEATURE 3: Time-Off & Leave Management

#### Story 3.1: Create Time-Off Policy
**As an** HR admin
**I want** to define time-off policies
**So that** leave accrual and approval rules are standardized

**Acceptance Criteria:**
- [ ] Define policy type (annual_leave, sick_leave, maternity, etc.)
- [ ] Set accrual method (fixed, monthly, hourly)
- [ ] Set accrual rate (e.g., 2.2 days/month for CI)
- [ ] Set max balance carry-over
- [ ] Configure approval requirements
- [ ] Set advance notice period
- [ ] Define blackout periods (e.g., year-end closing)
- [ ] Effective-dated for policy changes

**Note:** Côte d'Ivoire legal requirement (payroll-cote-d-ivoire.md:192):
- 2.2 days per month worked
- Paid at average salary of last 3 months

**Test Cases:**
```typescript
describe('Time-Off Policies', () => {
  it('should create annual leave policy (Côte d\'Ivoire)', async () => {
    const policy = await caller.timeOff.createPolicy({
      name: 'Congés annuels',
      policyType: 'annual_leave',
      accrualMethod: 'accrued_monthly',
      accrualRate: 2.2, // Days per month (CI standard)
      maxBalance: 30, // Max carry-over
      requiresApproval: true,
      advanceNoticeDays: 15,
      minDaysPerRequest: 0.5,
      maxDaysPerRequest: 30,
      isPaid: true,
    });

    expect(policy.accrual_rate).toBe(2.2);
    expect(policy.requires_approval).toBe(true);
  });

  it('should create sick leave policy', async () => {
    const policy = await caller.timeOff.createPolicy({
      name: 'Congé maladie',
      policyType: 'sick_leave',
      accrualMethod: 'fixed',
      accrualRate: 15, // 15 days/year
      requiresApproval: false, // Post-approval with doctor note
      advanceNoticeDays: 0,
      isPaid: true,
    });

    expect(policy.policy_type).toBe('sick_leave');
    expect(policy.requires_approval).toBe(false);
  });

  it('should define blackout periods', async () => {
    const policy = await caller.timeOff.createPolicy({
      name: 'Congés annuels',
      policyType: 'annual_leave',
      accrualMethod: 'accrued_monthly',
      accrualRate: 2.2,
      blackoutPeriods: [
        {
          start: new Date('2025-12-15'),
          end: new Date('2026-01-05'),
          reason: 'Clôture de fin d\'année',
        },
      ],
    });

    expect(policy.blackout_periods).toHaveLength(1);
  });
});
```

#### Story 3.2: Accrue Leave Balances
**As a** system
**I want** to automatically accrue leave balances
**So that** employees earn time off based on policy

**Acceptance Criteria:**
- [ ] Run monthly accrual job
- [ ] Calculate accrual per employee based on policy
- [ ] Update time_off_balances table
- [ ] Respect max balance limits
- [ ] Pro-rate for mid-month hires
- [ ] Emit event: `timeoff.balance_accrued`

**Test Cases:**
```typescript
describe('Leave Accrual', () => {
  it('should accrue 2.2 days per month (CI standard)', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2024-01-01'),
    });

    const policy = await createAnnualLeavePolicy({ accrualRate: 2.2 });

    // Accrue for January
    await runAccrualJob(new Date('2025-01-31'));

    const balance = await db.query.time_off_balances.findFirst({
      where: and(
        eq(time_off_balances.employee_id, emp.id),
        eq(time_off_balances.policy_id, policy.id)
      ),
    });

    expect(balance.balance).toBe(2.2);
  });

  it('should pro-rate for mid-month hire', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2025-01-15'), // Mid-month
    });

    const policy = await createAnnualLeavePolicy({ accrualRate: 2.2 });

    await runAccrualJob(new Date('2025-01-31'));

    const balance = await getBalance(emp.id, policy.id);

    // Worked 17 days out of 31: 2.2 × (17/31) = 1.21 days
    expect(balance.balance).toBeCloseTo(1.21, 2);
  });

  it('should respect max balance', async () => {
    const emp = await createTestEmployee();
    const policy = await createAnnualLeavePolicy({
      accrualRate: 2.2,
      maxBalance: 30,
    });

    // Set current balance to 29
    await setBalance(emp.id, policy.id, 29);

    // Try to accrue 2.2 more (would be 31.2)
    await runAccrualJob(new Date('2025-02-28'));

    const balance = await getBalance(emp.id, policy.id);

    expect(balance.balance).toBe(30); // Capped at max
  });

  it('should accrue for 12 months = 26.4 days', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2024-01-01'),
    });
    const policy = await createAnnualLeavePolicy({ accrualRate: 2.2 });

    // Accrue for full year
    for (let month = 1; month <= 12; month++) {
      await runAccrualJob(new Date(2025, month - 1, 28));
    }

    const balance = await getBalance(emp.id, policy.id);

    expect(balance.balance).toBeCloseTo(26.4, 1); // 2.2 × 12
  });
});
```

#### Story 3.3: Request Time Off
**As an** employee
**I want** to request time off
**So that** I can take leave with approval

**Acceptance Criteria:**
- [ ] Select policy (annual leave, sick leave, etc.)
- [ ] Select date range (start, end)
- [ ] Calculate total days (excluding weekends/holidays)
- [ ] Validate sufficient balance
- [ ] Validate advance notice requirement
- [ ] Validate not in blackout period
- [ ] Create time_off_requests with status 'pending'
- [ ] Deduct from available balance (mark as 'pending')
- [ ] Notify manager for approval
- [ ] Mobile-friendly form

**Test Cases:**
```typescript
describe('Time-Off Requests', () => {
  it('should create time-off request', async () => {
    const emp = await createTestEmployee();
    const policy = await createAnnualLeavePolicy();

    // Set balance to 10 days
    await setBalance(emp.id, policy.id, 10);

    const request = await caller.timeOff.request({
      employeeId: emp.id,
      policyId: policy.id,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-02-14'), // 5 days (Mon-Fri)
      reason: 'Vacances familiales',
    });

    expect(request.status).toBe('pending');
    expect(request.total_days).toBe(5);

    // Check balance updated
    const balance = await getBalance(emp.id, policy.id);
    expect(balance.balance).toBe(10); // Unchanged
    expect(balance.pending).toBe(5); // Pending deduction
  });

  it('should calculate days excluding weekends', async () => {
    const request = await caller.timeOff.request({
      employeeId: emp.id,
      policyId: policy.id,
      startDate: new Date('2025-02-10'), // Monday
      endDate: new Date('2025-02-16'), // Sunday (next week)
      reason: 'Test',
    });

    // Mon-Fri (5 days), Sat-Sun excluded
    expect(request.total_days).toBe(5);
  });

  it('should reject if insufficient balance', async () => {
    await setBalance(emp.id, policy.id, 2); // Only 2 days

    await expect(
      caller.timeOff.request({
        employeeId: emp.id,
        policyId: policy.id,
        startDate: new Date('2025-02-10'),
        endDate: new Date('2025-02-14'), // Requesting 5 days
      })
    ).rejects.toThrow('Solde insuffisant (disponible: 2 jours)');
  });

  it('should reject if in blackout period', async () => {
    const policy = await createAnnualLeavePolicy({
      blackoutPeriods: [
        {
          start: new Date('2025-12-15'),
          end: new Date('2026-01-05'),
          reason: 'Clôture',
        },
      ],
    });

    await expect(
      caller.timeOff.request({
        employeeId: emp.id,
        policyId: policy.id,
        startDate: new Date('2025-12-20'), // In blackout
        endDate: new Date('2025-12-24'),
      })
    ).rejects.toThrow('Période bloquée: Clôture');
  });

  it('should reject if insufficient advance notice', async () => {
    const policy = await createAnnualLeavePolicy({
      advanceNoticeDays: 15,
    });

    await expect(
      caller.timeOff.request({
        employeeId: emp.id,
        policyId: policy.id,
        startDate: addDays(new Date(), 10), // Only 10 days notice
        endDate: addDays(new Date(), 12),
      })
    ).rejects.toThrow('Préavis insuffisant (15 jours requis)');
  });
});
```

#### Story 3.4: Approve/Reject Time-Off Request
**As a** manager
**I want** to approve or reject time-off requests
**So that** I can manage team availability

**Acceptance Criteria:**
- [ ] View pending requests for my team
- [ ] Approve request:
  - Update status to 'approved'
  - Deduct from balance (move from pending to used)
  - Emit event: `timeoff.approved`
  - Notify employee
- [ ] Reject request:
  - Update status to 'rejected'
  - Restore balance (remove from pending)
  - Require rejection reason
  - Emit event: `timeoff.rejected`
  - Notify employee
- [ ] Create audit log

**Test Cases:**
```typescript
describe('Time-Off Approval', () => {
  it('should approve request and deduct balance', async () => {
    await setBalance(emp.id, policy.id, 10);

    const request = await caller.timeOff.request({
      employeeId: emp.id,
      policyId: policy.id,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-02-14'), // 5 days
    });

    const approved = await caller.timeOff.approve({
      requestId: request.id,
      reviewedBy: manager.id,
      notes: 'Approuvé',
    });

    expect(approved.status).toBe('approved');

    // Check balance
    const balance = await getBalance(emp.id, policy.id);
    expect(balance.balance).toBe(10); // Unchanged
    expect(balance.used).toBe(5); // Deducted
    expect(balance.pending).toBe(0); // Cleared
  });

  it('should reject request and restore balance', async () => {
    await setBalance(emp.id, policy.id, 10);

    const request = await caller.timeOff.request({
      employeeId: emp.id,
      policyId: policy.id,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-02-14'), // 5 days
    });

    const rejected = await caller.timeOff.reject({
      requestId: request.id,
      reviewedBy: manager.id,
      reviewNotes: 'Période chargée',
    });

    expect(rejected.status).toBe('rejected');

    // Check balance restored
    const balance = await getBalance(emp.id, policy.id);
    expect(balance.balance).toBe(10); // Unchanged
    expect(balance.pending).toBe(0); // Restored
    expect(balance.used).toBe(0); // Not deducted
  });

  it('should emit timeoff.approved event', async () => {
    const eventSpy = jest.spyOn(eventBus, 'publish');

    const request = await createTimeOffRequest();
    await caller.timeOff.approve({ requestId: request.id, reviewedBy: manager.id });

    expect(eventSpy).toHaveBeenCalledWith('timeoff.approved', {
      requestId: request.id,
      employeeId: request.employee_id,
      startDate: request.start_date,
      endDate: request.end_date,
      totalDays: request.total_days,
    });
  });

  it('should integrate with payroll for unpaid leave', async () => {
    // Request unpaid leave
    const request = await caller.timeOff.request({
      employeeId: emp.id,
      policyId: unpaidLeavePolicy.id,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-02-14'), // 5 days
    });

    await caller.timeOff.approve({ requestId: request.id, reviewedBy: manager.id });

    // Run payroll for February
    const payroll = await calculatePayroll({
      employeeId: emp.id,
      periodStart: new Date('2025-02-01'),
      periodEnd: new Date('2025-02-28'),
    });

    // Salary should be prorated: 23 days worked out of 28
    // Base 300k: 300,000 × (23/28) = 246,428 FCFA
    expect(payroll.daysWorked).toBe(23); // 28 - 5
    expect(payroll.baseSalary).toBeCloseTo(246428, 0);
  });
});
```

---

## Implementation Phases

### Phase 1: Basic Time Tracking (Week 1)
- [ ] Story 1.1: Clock in (mobile)
- [ ] Story 1.2: Clock out (mobile)
- [ ] Geofencing validation
- [ ] Photo capture & upload
- [ ] Offline queue & sync

**Deliverable:** Mobile app for clock in/out

### Phase 2: Overtime Integration (Week 2)
- [ ] Story 2.1: Overtime detection
- [ ] Story 2.2: Payroll integration
- [ ] Hour classification (41-46, 46+, night, weekend)
- [ ] Approval workflow for time entries

**Deliverable:** Overtime flows into payroll correctly

### Phase 3: Time-Off Management (Week 3)
- [ ] Story 3.1: Time-off policies
- [ ] Story 3.2: Leave accrual automation
- [ ] Story 3.3: Request time off (mobile)
- [ ] Story 3.4: Approve/reject requests

**Deliverable:** Complete leave management system

---

## Acceptance Testing Checklist

Before marking this epic complete:

- [ ] Mobile clock in/out works offline
- [ ] Geofencing prevents remote clock-ins
- [ ] Photo verification captures selfies
- [ ] Overtime automatically detected (> 40h/week)
- [ ] Overtime integrated with payroll (correct multipliers)
- [ ] Leave accrues 2.2 days/month (Côte d'Ivoire)
- [ ] Time-off requests validated (balance, blackouts, notice)
- [ ] Approval workflow updates balances correctly
- [ ] Events emitted for downstream systems
- [ ] French mobile UI with large touch targets
- [ ] Works with poor connectivity (offline queue)

---

**Next:** Read `08-EPIC-ONBOARDING-WORKFLOW.md`
