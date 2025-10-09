# Workflow Automation & Orchestration Setup Guide

## Overview

This guide explains how to set up and use the workflow automation system powered by Inngest for event-driven workflows and scheduled jobs.

## Architecture

The workflow automation system uses **Inngest** as the event bus and workflow orchestration engine. Key components:

- **Scheduled Jobs**: Daily alert generation (runs at 6 AM WAT)
- **Event-Driven Functions**: Respond to employee lifecycle events (hire, termination, salary changes, leave approvals)
- **Batch Operations**: Async processing of bulk operations with progress tracking
- **Alert Escalation**: Automatic escalation of overdue alerts

## Prerequisites

1. **Inngest Account**: Sign up at [inngest.com](https://www.inngest.com/)
2. **Inngest CLI** (for local development): `npm install -g inngest-cli`

## Environment Variables

Add to your `.env.local`:

```bash
# Inngest Configuration
INNGEST_EVENT_KEY="your-inngest-event-key"  # Get from Inngest dashboard
INNGEST_SIGNING_KEY="your-inngest-signing-key"  # Production only
```

## Local Development Setup

### 1. Start the Inngest Dev Server

```bash
npx inngest-cli dev
```

This starts the Inngest Dev Server at `http://localhost:8288` with:
- Function explorer UI
- Event stream viewer
- Function execution logs
- Manual event triggering

### 2. Start Your Next.js Application

```bash
npm run dev
```

### 3. Access the Inngest Dashboard

Open `http://localhost:8288` to:
- View registered functions
- Trigger functions manually
- View function execution history
- Debug step-by-step function execution

## Production Deployment

### 1. Configure Inngest Cloud

1. Go to [inngest.com](https://www.inngest.com/)
2. Create a new app
3. Get your Event Key and Signing Key
4. Add to production environment variables

### 2. Deploy Your Application

Deploy to Vercel/Netlify/etc. Inngest will automatically discover your functions at `https://your-domain.com/api/inngest`

### 3. Verify Function Registration

1. Go to Inngest Dashboard
2. Navigate to "Functions"
3. Verify all functions are registered:
   - `daily-alerts-generation`
   - `employee-terminated-handler`
   - `employee-hired-handler`
   - `salary-changed-handler`
   - `leave-approved-handler`
   - `alert-escalation-handler`
   - `batch-operation-completed-handler`

## Scheduled Jobs

### Daily Alerts Generation

**Schedule**: Every day at 6:00 AM WAT (5:00 AM UTC)

**What it does**:
- Checks for contracts expiring in 30/15/7 days
- Creates alerts for HR managers
- Checks for upcoming leaves
- Generates payroll reminders

**Manual Trigger** (for testing):

```typescript
import { sendEvent } from '@/lib/inngest/client';

await sendEvent({
  name: 'alerts/generate.manual',
  data: { user: 'admin@example.com' },
});
```

## Event-Driven Functions

### Employee Lifecycle Events

#### 1. Employee Terminated

**Event**: `employee.terminated`

**Triggers when**: Employee contract is terminated

**Actions**:
- Calculates final payroll with prorations
- Creates payroll event for audit trail
- Creates alert for HR manager

**Example**:

```typescript
import { sendEvent } from '@/lib/inngest/client';

await sendEvent({
  name: 'employee.terminated',
  data: {
    employeeId: 'uuid',
    employeeName: 'John Doe',
    terminationDate: new Date('2025-10-15'),
    reason: 'resignation',
    tenantId: 'tenant-uuid',
  },
});
```

#### 2. Employee Hired

**Event**: `employee.hired`

**Triggers when**: New employee is hired mid-month

**Actions**:
- Calculates prorated first payroll
- Creates payroll event
- Creates alert for HR manager

**Example**:

```typescript
await sendEvent({
  name: 'employee.hired',
  data: {
    employeeId: 'uuid',
    employeeName: 'Jane Smith',
    hireDate: new Date('2025-10-15'),
    startDate: new Date('2025-10-15'),
    baseSalary: 300000,
    positionId: 'position-uuid',
    tenantId: 'tenant-uuid',
  },
});
```

#### 3. Salary Changed

**Event**: `salary.changed`

**Triggers when**: Employee salary is changed mid-month

**Actions**:
- Recalculates affected payroll runs with proration
- Creates payroll event
- Creates alert for HR manager

**Example**:

```typescript
await sendEvent({
  name: 'salary.changed',
  data: {
    employeeId: 'uuid',
    employeeName: 'John Doe',
    oldSalary: 300000,
    newSalary: 350000,
    effectiveDate: new Date('2025-10-15'),
    reason: 'Promotion',
    tenantId: 'tenant-uuid',
  },
});
```

#### 4. Leave Approved

**Event**: `leave.approved`

**Triggers when**: Unpaid leave is approved

**Actions**:
- Calculates unpaid leave deduction
- Creates payroll event
- Creates alert for HR manager

**Example**:

```typescript
await sendEvent({
  name: 'leave.approved',
  data: {
    employeeId: 'uuid',
    employeeName: 'Jane Smith',
    leaveType: 'unpaid',
    startDate: new Date('2025-10-20'),
    endDate: new Date('2025-10-22'),
    days: 3,
    isUnpaid: true,
    tenantId: 'tenant-uuid',
  },
});
```

### System Events

#### Alert Escalation

**Event**: `alert.escalation.needed`

**Triggers when**: Alert is overdue

**Actions**:
- Escalates to manager's manager or tenant admin
- Creates escalated alert
- Sends urgent notification

**Example**:

```typescript
await sendEvent({
  name: 'alert.escalation.needed',
  data: {
    alertId: 'alert-uuid',
    alertType: 'contract_expiry',
    originalAssigneeId: 'user-uuid',
    daysOverdue: 5,
    tenantId: 'tenant-uuid',
  },
});
```

#### Batch Operation Completed

**Event**: `batch.operation.completed`

**Triggers when**: Batch operation finishes

**Actions**:
- Creates completion alert
- Sends notification to user

**Example** (automatically published by batch-processor):

```typescript
await sendEvent({
  name: 'batch.operation.completed',
  data: {
    operationId: 'operation-uuid',
    operationType: 'salary_update',
    successCount: 95,
    errorCount: 5,
    duration: 12500, // ms
    tenantId: 'tenant-uuid',
  },
});
```

## Testing

### Test Individual Functions

1. Open Inngest Dev Server: `http://localhost:8288`
2. Navigate to "Functions"
3. Click on a function
4. Click "Trigger" and provide test data

### Test Scheduled Jobs

```bash
# Manually trigger daily alerts
curl -X POST http://localhost:3000/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "alerts/generate.manual",
    "data": { "user": "test@example.com" }
  }'
```

### Test Event Flow

```typescript
// In your test file or API route
import { sendEvent } from '@/lib/inngest/client';

// Trigger employee termination flow
await sendEvent({
  name: 'employee.terminated',
  data: {
    employeeId: 'test-uuid',
    employeeName: 'Test Employee',
    terminationDate: new Date(),
    reason: 'resignation',
    tenantId: 'test-tenant',
  },
});

// Check Inngest dashboard to see function execution
```

## Monitoring & Debugging

### Function Execution Logs

1. Go to Inngest Dashboard
2. Click on "Runs"
3. View function execution history with:
   - Input data
   - Step-by-step execution
   - Duration
   - Success/failure status

### Event Stream

View all published events in real-time:
1. Inngest Dashboard → Events
2. Filter by event name
3. View event payload and processing status

### Retry Behavior

All functions have automatic retries:
- **3 retries** for most functions
- **2 retries** for alert escalation
- **Exponential backoff**: 1s, 2s, 4s, 8s, 16s

## Troubleshooting

### Functions Not Appearing in Dashboard

1. Verify Inngest Dev Server is running
2. Check `app/api/inngest/route.ts` exports all functions
3. Restart Next.js dev server
4. Check console for registration errors

### Events Not Triggering Functions

1. Check event name matches exactly (e.g., `employee.terminated` not `employee.Terminated`)
2. Verify event data matches Zod schema in `lib/inngest/events.ts`
3. Check Inngest event stream for errors

### Scheduled Jobs Not Running

1. Verify cron expression is correct (5 0 * * * = 5 AM UTC)
2. Check timezone settings (UTC vs WAT)
3. View scheduled runs in Inngest Dashboard

## Best Practices

### 1. Always Use Type-Safe Events

```typescript
// ✅ Good: Type-safe event
import { sendEvent } from '@/lib/inngest/client';
import type { EmployeeTerminatedEvent } from '@/lib/inngest/events';

await sendEvent({
  name: 'employee.terminated',
  data: {
    // TypeScript will validate this
  },
} as EmployeeTerminatedEvent);

// ❌ Bad: Untyped event
await sendEvent({
  name: 'employee.terminated',
  data: { whatever: 'values' }, // No type checking
});
```

### 2. Use Step Functions for Reliability

```typescript
export const myFunction = inngest.createFunction(
  { id: 'my-function' },
  { event: 'my.event' },
  async ({ event, step }) => {
    // Each step is retried independently
    const data = await step.run('fetch-data', async () => {
      return await fetchData();
    });

    // If this fails, previous step won't re-run
    await step.run('process-data', async () => {
      return await processData(data);
    });
  }
);
```

### 3. Include Metadata for Debugging

```typescript
await sendEvent({
  name: 'employee.hired',
  data: {
    // ... required fields
    metadata: {
      userId: currentUser.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    },
  },
});
```

### 4. Monitor Function Performance

- Review execution times in Inngest Dashboard
- Set up alerts for failed functions
- Track retry rates

## Next Steps

1. Set up monitoring for failed functions
2. Configure email/SMS notifications
3. Add custom functions for your business logic
4. Implement workflow versioning

## Resources

- [Inngest Documentation](https://www.inngest.com/docs)
- [Inngest TypeScript SDK](https://www.inngest.com/docs/sdk/typescript)
- [Event-Driven Architecture](https://www.inngest.com/docs/learn/event-driven-architecture)
