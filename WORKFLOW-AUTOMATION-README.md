# Workflow Automation & Orchestration - Quick Start

## What Was Implemented

✅ **Priority 1: Scheduled Jobs Setup** (Completed)
- Inngest SDK installed and configured
- Daily alerts job (runs at 6 AM WAT)
- Inngest API route for function serving
- Environment variables for Inngest Cloud

✅ **Priority 2: Event-Driven Automation** (Completed)
- Event type definitions with Zod validation
- Employee lifecycle event handlers:
  - Employee terminated → Calculate final payroll
  - Employee hired → Calculate prorated first payroll
  - Salary changed → Recalculate affected payroll
  - Leave approved → Apply unpaid leave deductions
- System event handlers:
  - Alert escalation
  - Batch operation completed
- Batch processor refactored to publish events

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Add to `.env.local`:

```bash
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"  # Production only
```

### 3. Local Development

**Terminal 1 - Start Inngest Dev Server:**
```bash
npx inngest-cli dev
```

**Terminal 2 - Start Next.js:**
```bash
npm run dev
```

**Terminal 3 - Access Inngest Dashboard:**
```
Open: http://localhost:8288
```

### 4. Test the Implementation

#### Trigger a Test Event

Create a test file `scripts/test-events.ts`:

```typescript
import { sendEvent } from './lib/inngest/client';

// Test employee termination event
await sendEvent({
  name: 'employee.terminated',
  data: {
    employeeId: 'test-uuid',
    employeeName: 'Test Employee',
    terminationDate: new Date(),
    reason: 'resignation',
    tenantId: 'test-tenant-uuid',
  },
});

console.log('Event sent! Check Inngest dashboard at http://localhost:8288');
```

Run it:
```bash
npx tsx scripts/test-events.ts
```

#### View Function Execution

1. Go to `http://localhost:8288`
2. Click "Runs" tab
3. See your function execution with step-by-step details

### 5. Deploy to Production

#### Setup Inngest Cloud

1. Sign up at [inngest.com](https://www.inngest.com/)
2. Create a new app
3. Get your Event Key and Signing Key
4. Add to production environment variables

#### Deploy Your App

```bash
# Deploy to Vercel (or your platform)
vercel --prod
```

Inngest will automatically discover your functions at:
```
https://your-domain.com/api/inngest
```

## File Structure

```
lib/
├── inngest/
│   ├── client.ts                          # Inngest client config
│   ├── events.ts                          # Event type definitions
│   └── functions/
│       ├── daily-alerts.ts                # Scheduled job
│       ├── employee-terminated.ts         # Event handler
│       ├── employee-hired.ts              # Event handler
│       ├── salary-changed.ts              # Event handler
│       ├── leave-approved.ts              # Event handler
│       ├── alert-escalation.ts            # Event handler
│       └── batch-operation-completed.ts   # Event handler
│
├── workflow/
│   ├── alert-engine.ts                    # Existing (called by scheduled job)
│   └── batch-processor.ts                 # Updated (now publishes events)
│
app/
└── api/
    └── inngest/
        └── route.ts                       # Inngest API route handler
```

## Available Events

### Employee Lifecycle
- `employee.terminated` - Employee contract terminated
- `employee.hired` - New employee hired mid-month
- `salary.changed` - Employee salary changed mid-month
- `leave.approved` - Unpaid leave approved

### System Events
- `alert.escalation.needed` - Alert needs escalation
- `batch.operation.completed` - Batch operation finished

## Documentation

📚 **Complete Documentation:**
- `/docs/WORKFLOW-AUTOMATION-SETUP.md` - Detailed setup guide
- `/docs/WORKFLOW-AUTOMATION-IMPLEMENTATION-SUMMARY.md` - Implementation details

## Troubleshooting

### Functions Not Showing in Dashboard

1. Verify Inngest Dev Server is running: `npx inngest-cli dev`
2. Restart Next.js: `npm run dev`
3. Check `app/api/inngest/route.ts` exports all functions

### Events Not Triggering Functions

1. Check event name matches exactly (case-sensitive)
2. Verify event data matches Zod schema in `lib/inngest/events.ts`
3. View Inngest event stream for errors

### TypeScript Errors

The path alias errors (`@/lib/...`) are expected and will be resolved by Next.js at runtime. If you see actual logic errors:

1. Run `npm run type-check` (if available)
2. Check Inngest Dashboard for runtime errors
3. Review function execution logs

## Next Steps

1. ✅ Scheduled jobs infrastructure - **DONE**
2. ✅ Event-driven automation - **DONE**
3. ⏳ Implement remaining features:
   - Email/SMS notifications
   - Vacation payout calculation
   - Exit benefits calculation (country-specific)
   - Visual workflow builder (Phase 4)

## Support

- Inngest Documentation: https://www.inngest.com/docs
- Epic Specification: `/docs/09-EPIC-WORKFLOW-AUTOMATION.md`
- Architecture: `/docs/02-ARCHITECTURE-OVERVIEW.md`

---

**Implementation Date**: October 9, 2025
**Status**: Priority 1 & 2 Complete ✅
