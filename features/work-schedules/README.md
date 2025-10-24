# Work Schedule Tracking System (GAP-JOUR-002)

> Variable schedule tracking for daily and hourly workers in Preem HR

## Overview

This feature enables tracking of irregular work schedules for employees who work variable days per week/month or variable hours per day. It supports the complete workflow from employee entry to manager approval to payroll integration.

**Target Users:**
- Daily workers (construction, retail, hospitality)
- Hourly workers (part-time, flexible schedules)
- Seasonal workers with variable attendance

## Features

### ✅ Completed Features

1. **Database Schema** (`work_schedules` table)
   - Single-day granularity tracking
   - Time-based tracking (start/end times)
   - Hours calculation (auto or manual)
   - Approval workflow (draft → pending → approved/rejected)
   - Week grouping for bulk operations
   - Multi-tenant with RLS

2. **Service Layer** (`work-schedule.service.ts`)
   - Record single day
   - Record full week (bulk)
   - Get schedules by date range
   - Calculate monthly totals
   - Submit week for approval
   - Approve/reject schedules
   - Validation for payroll

3. **tRPC API** (`work-schedules.ts`)
   - `recordDay` - Record single work day
   - `recordWeek` - Bulk record week
   - `getSchedules` - Get date range
   - `getMonthSchedule` - Get month view
   - `getMonthTotals` - Payroll totals
   - `submitForApproval` - Submit week
   - `approve` - Approve schedules
   - `reject` - Reject schedules
   - `getPending` - Manager view
   - `validateForPayroll` - Pre-payroll check

4. **UI Components**
   - `WeeklyScheduleGrid` - Interactive weekly entry
   - `MonthlyCalendar` - Month overview
   - `ScheduleApprovalCard` - Manager approval

5. **Pages**
   - `/horaires` - Employee schedule entry
   - `/horaires/approvals` - Manager approvals

6. **Payroll Integration** (`payroll-integration.service.ts`)
   - Get totals for payroll
   - Validate schedules approved
   - Calculate prorated salaries
   - Batch validation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                          │
├─────────────────────────────────────────────────────────────┤
│  Employee Entry        │  Manager Approval                  │
│  /horaires             │  /horaires/approvals               │
│  - WeeklyScheduleGrid  │  - ScheduleApprovalCard            │
│  - MonthlyCalendar     │  - Bulk approve/reject             │
└────────────┬───────────┴────────────┬────────────────────────┘
             │                        │
             ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      tRPC ROUTER                            │
│  workSchedules.* (12 endpoints)                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  work-schedule.service.ts                                   │
│  - Record schedules (day/week)                              │
│  - Approval workflow                                        │
│  - Monthly calculations                                     │
│                                                             │
│  payroll-integration.service.ts                             │
│  - Validation for payroll                                   │
│  - Prorated calculations                                    │
│  - Batch validation                                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE                                 │
│  work_schedules table                                       │
│  - RLS policies                                             │
│  - Triggers (auto-calculate hours, week_start_date)         │
│  - Helper functions (totals, distance)                      │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### `work_schedules` Table

```sql
CREATE TABLE work_schedules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),

  -- Work date
  work_date DATE NOT NULL,

  -- Time tracking (optional)
  start_time TIME,
  end_time TIME,
  hours_worked NUMERIC(5,2), -- Auto-calculated or manual

  -- Attendance
  is_present BOOLEAN NOT NULL DEFAULT false,
  schedule_type VARCHAR(20) DEFAULT 'FULL_DAY', -- FULL_DAY, PARTIAL_DAY, ABSENT

  -- Approval workflow
  status VARCHAR(20) DEFAULT 'draft', -- draft, pending, approved, rejected
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,

  -- Week grouping (auto-calculated)
  week_start_date DATE, -- Monday of week

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, employee_id, work_date)
);
```

### Helper Functions

**`get_work_schedule_totals(employee_id, tenant_id, month_start, month_end)`**
- Returns: `days_worked`, `total_hours`, `pending_days`, `approved_days`
- Used by payroll integration

**`get_week_start_date(date)`**
- Returns Monday of the week for any date
- ISO week (Monday start)

## User Workflows

### Employee: Record Weekly Schedule

1. Navigate to `/horaires`
2. Select current week (or navigate to other weeks)
3. For each day:
   - Click "Présent" or "Absent"
   - If present, enter hours worked (default 8h)
   - Optionally enter start/end times
4. Click "Enregistrer le brouillon" (save draft)
5. Click "Soumettre pour approbation" (submit for approval)

**Validation Rules:**
- Cannot submit future weeks
- Cannot submit weeks with already-approved days
- Must have at least one day marked present

### Manager: Approve Schedules

1. Navigate to `/horaires/approvals`
2. View pending weekly schedules
3. Review each employee's week:
   - Days worked
   - Total hours
   - Daily breakdown
4. Approve or reject:
   - **Approve:** Click "Approuver" (individual or bulk)
   - **Reject:** Click "Rejeter" and provide reason
5. Employee receives notification

**Bulk Operations:**
- Select multiple weeks
- Click "Approuver (n)" to approve all selected

### Payroll: Integration

```typescript
import { getWorkScheduleTotalsForPayroll } from '@/features/work-schedules/services/payroll-integration.service';
import { calculatePayrollV2 } from '@/features/payroll/services/payroll-calculation-v2';

// Get work totals
const totals = await getWorkScheduleTotalsForPayroll(
  employeeId,
  tenantId,
  new Date('2025-10-01'),
  new Date('2025-10-31')
);

// Validate all approved
if (!totals.isValid) {
  throw new Error(totals.validationMessage);
}

// Calculate payroll
const payroll = await calculatePayrollV2({
  employeeId,
  countryCode: 'CI',
  periodStart: new Date('2025-10-01'),
  periodEnd: new Date('2025-10-31'),
  baseSalary: 500000,
  rateType: 'DAILY',
  daysWorkedThisMonth: totals.daysWorked, // 22
  hoursWorkedThisMonth: totals.totalHours, // 176
});
```

## API Reference

### tRPC Endpoints

#### `workSchedules.recordDay`
Record a single work day.

**Input:**
```typescript
{
  employeeId: string;
  workDate: Date;
  scheduleType?: 'FULL_DAY' | 'PARTIAL_DAY' | 'ABSENT';
  hoursWorked?: number;
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  isPresent?: boolean;
  notes?: string;
  status?: 'draft' | 'pending';
}
```

**Returns:** `WorkSchedule`

#### `workSchedules.recordWeek`
Bulk record a full week.

**Input:**
```typescript
{
  employeeId: string;
  weekSchedules: Array<{
    workDate: Date;
    isPresent: boolean;
    hoursWorked?: number;
    startTime?: string;
    endTime?: string;
    scheduleType?: 'FULL_DAY' | 'PARTIAL_DAY' | 'ABSENT';
    notes?: string;
  }>;
}
```

**Returns:** `WorkSchedule[]`

#### `workSchedules.getMonthTotals`
Get monthly totals for payroll.

**Input:**
```typescript
{
  employeeId: string;
  month: Date; // Any date in target month
}
```

**Returns:**
```typescript
{
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  daysWorked: number;
  totalHours: number;
  pendingDays: number;
  approvedDays: number;
  hasUnapproved: boolean;
}
```

#### `workSchedules.submitForApproval`
Submit week for manager approval.

**Input:**
```typescript
{
  employeeId: string;
  weekStartDate: Date; // Monday of week
}
```

**Returns:** `WorkSchedule[]` (updated to pending)

#### `workSchedules.approve`
Approve schedules (single or batch).

**Input:**
```typescript
{
  scheduleIds: string[]; // Max 100
}
```

**Returns:** `WorkSchedule[]` (updated to approved)

#### `workSchedules.reject`
Reject schedules.

**Input:**
```typescript
{
  scheduleIds: string[];
  rejectedReason: string; // Min 5, max 500 chars
}
```

**Returns:** `WorkSchedule[]` (updated to rejected)

## UI Components

### `<WeeklyScheduleGrid>`

Interactive weekly schedule entry with large touch targets.

**Props:**
```typescript
{
  weekStartDate: Date;
  initialSchedules?: WorkSchedule[];
  onSave: (schedules: DaySchedule[]) => Promise<void>;
  onSubmit?: (schedules: DaySchedule[]) => Promise<void>;
  disabled?: boolean;
  standardHours?: number; // Default: 8
}
```

**Features:**
- 7-day grid (Monday-Sunday)
- Present/Absent toggle (min 56px height)
- Hours input (auto-calculated from times)
- Color-coded status (green=approved, yellow=pending, blue=draft)
- Totals display (days + hours)
- Mobile-first responsive design

### `<MonthlyCalendar>`

Month overview with day details.

**Props:**
```typescript
{
  month: Date;
  schedules: WorkSchedule[];
  onMonthChange?: (newMonth: Date) => void;
  onDayClick?: (date: Date) => void;
  readOnly?: boolean;
}
```

**Features:**
- Calendar grid with color-coded days
- Click day to view details
- Summary stats (days/hours/approved/pending)
- Legend for status colors
- Month navigation

### `<ScheduleApprovalCard>`

Manager approval interface.

**Props:**
```typescript
{
  weeklySchedule: WeeklyScheduleGroup;
  employeeName: string;
  employeeNumber?: string;
  employeePhotoUrl?: string;
  onApprove: (scheduleIds: string[]) => Promise<void>;
  onReject: (scheduleIds: string[], reason: string) => Promise<void>;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  disabled?: boolean;
}
```

**Features:**
- Employee info with avatar
- Week summary (days + hours)
- Daily breakdown (7-day mini grid)
- Approve/Reject actions
- Rejection reason dialog
- Bulk selection support

## HCI Design Principles Applied

1. **Task-Oriented Design** ✅
   - "Enregistrez vos horaires" not "Gestion des plannings"
   - "Soumettre pour approbation" not "Changer le statut à pending"

2. **Zero Learning Curve** ✅
   - Large Present/Absent buttons (no explanation needed)
   - Color-coded visual feedback (green=good, red=problem)
   - Default 8 hours pre-filled

3. **Error Prevention** ✅
   - Cannot submit future weeks
   - Cannot modify approved schedules
   - Validation before payroll

4. **Cognitive Load Minimization** ✅
   - Weekly grid (not overwhelming month view)
   - Progressive disclosure (details on click)
   - Smart defaults (8h, full day)

5. **Mobile-First** ✅
   - Touch targets ≥ 56px
   - Responsive grid (7 cols on desktop, 1 col on mobile)
   - Works on 5" screens

6. **Immediate Feedback** ✅
   - Color changes on toggle
   - Live totals calculation
   - Toast notifications

## Multi-Country Support

The work schedule system is **country-agnostic**. All country-specific logic is handled by the payroll calculation service:

- Work schedules track **days/hours** (universal)
- Payroll calculation applies **country-specific rules** (tax, social security, holidays)
- Daily/hourly rates calculated per country regulations

**Example:**
```typescript
// Same schedule data
const totals = { daysWorked: 22, totalHours: 176 };

// Different payroll calculations per country
const payrollCI = await calculatePayrollV2({
  ...totals,
  countryCode: 'CI', // Applies CI tax/CNPS rules
  baseSalary: 500000,
  rateType: 'DAILY',
});

const payrollSN = await calculatePayrollV2({
  ...totals,
  countryCode: 'SN', // Applies SN tax/IPRES rules
  baseSalary: 450000,
  rateType: 'DAILY',
});
```

## Testing Checklist

### Unit Tests (Service Layer)
- [ ] Record single day
- [ ] Record full week
- [ ] Calculate monthly totals
- [ ] Submit for approval (validation)
- [ ] Approve schedules
- [ ] Reject schedules
- [ ] Payroll validation (unapproved check)
- [ ] Prorated salary calculation

### Integration Tests (tRPC)
- [ ] End-to-end workflow (record → submit → approve)
- [ ] Bulk operations (record week, approve batch)
- [ ] Validation errors (future week, approved week)
- [ ] Payroll integration (totals match)

### UI Tests (Components)
- [ ] Weekly grid interactions
- [ ] Monthly calendar navigation
- [ ] Approval card actions
- [ ] Mobile responsive (375×667)
- [ ] Touch targets ≥ 56px

### E2E Tests (Pages)
- [ ] Employee records week and submits
- [ ] Manager approves pending schedules
- [ ] Payroll runs with approved schedules
- [ ] Error handling (unapproved schedules block payroll)

## Known Limitations

1. **No Partial Day Types**
   - Currently: FULL_DAY (8h), PARTIAL_DAY (custom), ABSENT
   - Future: Morning/Afternoon half-days

2. **No Schedule Templates**
   - Currently: Manual entry each week
   - Future: Copy previous week, recurring patterns

3. **No Overtime Tracking**
   - Currently: Hours tracked, but not classified as overtime
   - Future: Integration with overtime_rules table

4. **No Integration with Time Entries**
   - Currently: Separate from clock in/out system
   - Future: Auto-populate from time_entries for validation

## Future Enhancements

### Phase 2 (Medium Priority)
- [ ] Schedule templates (copy previous week)
- [ ] Recurring patterns (same schedule every week)
- [ ] Mobile app (native schedule entry)
- [ ] Push notifications (approval reminders)
- [ ] Export to Excel/PDF

### Phase 3 (Low Priority)
- [ ] Overtime classification (integration with overtime_rules)
- [ ] Time entry validation (compare with clock in/out)
- [ ] Geofence integration (auto-mark present if clocked in)
- [ ] AI predictions (suggest schedule based on history)
- [ ] Multi-week bulk entry

## Dependencies

### Database
- `tenants` table
- `employees` table
- `users` table (for approval)

### Services
- `payroll-calculation-v2.ts` (for payroll integration)
- `employee.service.ts` (for employee lookup)

### UI Libraries
- `shadcn/ui` (Button, Card, Input, etc.)
- `date-fns` (date utilities)
- `lucide-react` (icons)

### Related Features
- Time Tracking (`time_entries`) - Clock in/out
- Time Off (`time_off_requests`) - Leave management
- Payroll (`payroll_runs`) - Monthly payroll

## Migration Path

**Before running migration:**
```bash
# Backup database
pg_dump preem_hr > backup_before_work_schedules.sql

# Review migration
cat supabase/migrations/20251022_create_work_schedules.sql
```

**Run migration:**
```bash
# Apply via Supabase CLI
supabase db push

# Or via direct SQL
psql preem_hr < supabase/migrations/20251022_create_work_schedules.sql
```

**Post-migration verification:**
```sql
-- Verify table exists
SELECT * FROM work_schedules LIMIT 0;

-- Verify triggers
SELECT * FROM pg_trigger WHERE tgname LIKE 'work_schedules%';

-- Verify functions
SELECT * FROM pg_proc WHERE proname LIKE 'work_schedule%';

-- Test RLS
SET ROLE tenant_user;
SELECT * FROM work_schedules; -- Should return empty (no data yet)
```

## Support

**Issues:**
- Database errors → Check RLS policies and tenant context
- Validation errors → Check approval workflow state
- Payroll integration → Verify all schedules approved
- UI issues → Check browser console for errors

**Debugging:**
```typescript
// Enable debug logging
import { calculateMonthTotals } from '@/features/work-schedules/services/work-schedule.service';

const totals = await calculateMonthTotals(employeeId, tenantId, month);
console.log('Work schedule totals:', totals);
// { daysWorked: 22, totalHours: 176, pendingDays: 0, approvedDays: 22 }
```

## License

Internal use only - Preem HR System
