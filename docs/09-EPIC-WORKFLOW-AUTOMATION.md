# 🔄 EPIC: Workflow Automation & Orchestration

## Epic Overview

**Goal:** Automate repetitive HR tasks, provide proactive alerts, and enable batch operations to reduce manual work for HR managers managing 100+ employees across multiple locations.

**Architecture:** Event-driven automation with proactive alerts, batch operations, and future visual workflow builder.

**Priority:** P0 (Must-have for MVP - critical for HR efficiency)

**Source Documents:**
- `01-CONSTRAINTS-AND-RULES.md` - Validation rules, security constraints
- `02-ARCHITECTURE-OVERVIEW.md` - Event-driven patterns, CQRS
- `03-DATABASE-SCHEMA.md` - Events, notifications, workflow tables
- `04-DOMAIN-MODELS.md` - Business entities, validation rules, domain events
- `HCI-DESIGN-PRINCIPLES.md` - **UX design for low digital literacy automation**

**Real User Pain Point (Alexise):**
> "I manage 135 employees across 3 laboratories. I need the system to proactively alert me when contracts are about to expire, and let me process salary updates for multiple employees at once. With Excel, I was tracking everything manually. Odoo was too complex to set up."

**Dependencies:**
- Employee Management (employees, contracts, positions)
- Payroll System (batch payroll runs)
- Notification infrastructure (email/SMS)
- Event bus (for workflow triggers)

**Dependent Systems:**
- All modules (can trigger workflows)
- Reporting (workflow analytics)
- Mobile app (push notifications)

---

## Success Criteria

### Proactive Management
- [ ] Contract expiry alerts (30/15/7 days before)
- [ ] Leave notifications (upcoming absences)
- [ ] Document expiry warnings (work permits, medical certs)
- [ ] Payroll reminders (monthly cycle alerts)
- [ ] Dashboard showing all urgent items

### Batch Operations
- [ ] Bulk salary updates (select multiple employees)
- [ ] Mass document generation (pay slips, contracts)
- [ ] Group position changes (promotions, transfers)
- [ ] Batch notifications (email/SMS to groups)

### Automation
- [ ] Event-driven workflows (contract renewal triggers)
- [ ] Auto-escalation (overdue tasks notify manager)
- [ ] Scheduled jobs (monthly payroll reminder)
- [ ] Custom rules (if-then automation)

### UX Compliance
- [ ] Zero learning curve (alerts = instant understanding)
- [ ] One-click actions (renew contract from alert)
- [ ] Mobile-friendly (alerts work on phones)
- [ ] French language (business terms, no jargon)

---

## Implementation Phases

### Phase 1: Proactive Alerts System (Week 1-2)
**Goal:** Prevent problems before they happen

1. Alert engine infrastructure
2. Contract expiry alerts
3. Leave calendar notifications
4. Alerts dashboard widget
5. Mobile notifications

### Phase 2: Batch Operations (Week 3-4)
**Goal:** Process many employees at once

1. Bulk selection UI pattern
2. Batch salary updates
3. Mass document generation
4. Batch payroll calculations
5. Progress tracking for long operations

### Phase 3: Event-Driven Automation (Week 5-6)
**Goal:** Automate repetitive workflows

1. Event bus implementation
2. Auto-renewal workflows
3. Onboarding automation
4. Offboarding automation
5. Event-driven payroll calculations
6. Escalation rules

### Phase 4: Visual Workflow Builder (Future)
**Goal:** No-code automation for power users

1. Drag-drop workflow designer
2. Trigger configuration
3. Action templates
4. Workflow versioning

---

## Features & User Stories

### FEATURE 1: Proactive Alerts Dashboard

#### Story 1.1: Contract Expiry Alerts
**As an** HR manager
**I want** to be alerted 30 days before employee contracts expire
**So that** I can renew them proactively without tracking in Excel

**Acceptance Criteria:**
- [ ] Alert created 30 days before contract `effective_to` date
- [ ] Severity levels: 30 days (info), 15 days (warning), 7 days (urgent)
- [ ] Alert shows employee name, contract type, expiry date
- [ ] One-click "Renew Contract" action from alert
- [ ] Alert disappears when contract renewed
- [ ] Mobile push notification support

**Implementation:**
```typescript
// Event-driven alert creation
export async function createContractExpiryAlerts() {
  const expiringContracts = await db.query.employeeAssignments.findMany({
    where: and(
      eq(employeeAssignments.status, 'active'),
      between(
        employeeAssignments.effectiveTo,
        new Date(),
        addDays(new Date(), 30)
      )
    ),
    with: { employee: true }
  });

  for (const contract of expiringContracts) {
    const daysUntilExpiry = differenceInDays(contract.effectiveTo, new Date());

    const severity =
      daysUntilExpiry <= 7 ? 'urgent' :
      daysUntilExpiry <= 15 ? 'warning' : 'info';

    await createAlert({
      type: 'contract_expiry',
      severity,
      employeeId: contract.employeeId,
      message: `Contrat de ${contract.employee.fullName} expire dans ${daysUntilExpiry} jours`,
      actionUrl: `/employees/${contract.employeeId}/contract/renew`,
      dueDate: contract.effectiveTo,
    });
  }
}
```

**UI Component:**
```tsx
<AlertCard variant="urgent">
  <AlertHeader>
    <AlertTriangle className="h-5 w-5" />
    <AlertTitle>Contrat expire dans 5 jours</AlertTitle>
  </AlertHeader>

  <AlertContent>
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback>{employee.initials}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{employee.fullName}</p>
        <p className="text-sm text-muted-foreground">
          CDD expire le {format(contract.effectiveTo, 'dd MMM yyyy', { locale: fr })}
        </p>
      </div>
    </div>
  </AlertContent>

  <AlertActions>
    <Button onClick={handleRenewContract}>
      Renouveler le contrat
    </Button>
    <Button variant="ghost" onClick={handleDismiss}>
      Plus tard
    </Button>
  </AlertActions>
</AlertCard>
```

#### Story 1.2: Upcoming Leave Notifications
**As an** HR manager
**I want** to see all upcoming employee absences
**So that** I can plan workload and ensure coverage

**Acceptance Criteria:**
- [ ] Dashboard shows leaves starting in next 7/14/30 days
- [ ] Visual calendar view of absences
- [ ] Filter by department, location, leave type
- [ ] Export to Excel for planning
- [ ] Conflict detection (too many absent in same period)

#### Story 1.3: Alerts Dashboard Widget
**As an** HR manager
**I want** an at-a-glance view of all urgent items
**So that** I never miss critical deadlines

**Acceptance Criteria:**
- [ ] Dashboard widget shows top 5 urgent alerts
- [ ] Color-coded by severity (red = urgent, yellow = warning)
- [ ] Click alert to navigate to action
- [ ] Badge count on navigation menu
- [ ] Mobile responsive (swipeable cards)

**UI Component:**
```tsx
<DashboardWidget title="Alertes urgentes" badge={urgentCount}>
  <div className="space-y-2">
    {alerts.slice(0, 5).map(alert => (
      <AlertItem
        key={alert.id}
        severity={alert.severity}
        title={alert.message}
        dueDate={alert.dueDate}
        onClick={() => router.push(alert.actionUrl)}
      />
    ))}
  </div>

  <Button variant="ghost" className="w-full mt-4">
    Voir toutes les alertes ({alerts.length})
  </Button>
</DashboardWidget>
```

---

### FEATURE 2: Batch Operations

#### Story 2.1: Bulk Salary Updates
**As an** HR manager
**I want** to update salaries for multiple employees at once
**So that** I don't update each employee individually

**Acceptance Criteria:**
- [ ] Select multiple employees via checkboxes
- [ ] Apply same or different salary changes
- [ ] Preview changes before applying
- [ ] Effective date for all changes
- [ ] Audit trail for bulk operations
- [ ] Cancel/undo option

**Implementation:**
```typescript
export async function bulkUpdateSalaries(params: {
  employeeIds: string[];
  updateType: 'absolute' | 'percentage';
  value: number;
  effectiveDate: Date;
  userId: string;
}) {
  const updates = params.employeeIds.map(employeeId => ({
    employeeId,
    effectiveFrom: params.effectiveDate,
    baseSalary: params.updateType === 'absolute'
      ? params.value
      : getCurrentSalary(employeeId) * (1 + params.value / 100),
    updatedBy: params.userId,
  }));

  // Transaction to ensure atomicity
  await db.transaction(async (tx) => {
    // Close current salaries
    await tx.update(employeeSalaries)
      .set({ effectiveTo: params.effectiveDate })
      .where(
        and(
          inArray(employeeSalaries.employeeId, params.employeeIds),
          isNull(employeeSalaries.effectiveTo)
        )
      );

    // Insert new salaries
    await tx.insert(employeeSalaries).values(updates);

    // Create audit log
    await tx.insert(auditLogs).values({
      action: 'bulk_salary_update',
      entityType: 'employee_salaries',
      entityIds: params.employeeIds,
      userId: params.userId,
      metadata: { updateType: params.updateType, value: params.value },
    });
  });

  // Emit event for notifications
  await eventBus.publish('salaries.bulk_updated', {
    employeeIds: params.employeeIds,
    effectiveDate: params.effectiveDate,
  });
}
```

**UI Component:**
```tsx
<BulkSalaryUpdateDialog
  selectedEmployees={selected}
  onClose={() => setSelected([])}
>
  <DialogHeader>
    <DialogTitle>
      Modifier les salaires ({selected.length} employés)
    </DialogTitle>
  </DialogHeader>

  <DialogContent>
    <RadioGroup value={updateType} onValueChange={setUpdateType}>
      <RadioItem value="absolute">
        <Label>Définir un salaire fixe</Label>
        <Input type="number" placeholder="Ex: 300,000 FCFA" />
      </RadioItem>

      <RadioItem value="percentage">
        <Label>Augmentation en pourcentage</Label>
        <Input type="number" placeholder="Ex: 10% d'augmentation" />
      </RadioItem>
    </RadioGroup>

    <DatePicker
      label="Date d'effet"
      defaultValue={addMonths(new Date(), 1)}
    />

    <PreviewTable>
      <TableHeader>
        <TableRow>
          <TableHead>Employé</TableHead>
          <TableHead>Ancien salaire</TableHead>
          <TableHead>Nouveau salaire</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {selected.map(emp => (
          <TableRow key={emp.id}>
            <TableCell>{emp.fullName}</TableCell>
            <TableCell>{formatCurrency(emp.currentSalary)}</TableCell>
            <TableCell className="font-medium text-primary">
              {formatCurrency(calculateNewSalary(emp, updateType, value))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </PreviewTable>
  </DialogContent>

  <DialogActions>
    <Button variant="outline" onClick={onCancel}>
      Annuler
    </Button>
    <Button onClick={handleApply} disabled={isApplying}>
      {isApplying ? 'Application...' : 'Appliquer les changements'}
    </Button>
  </DialogActions>
</BulkSalaryUpdateDialog>
```

#### Story 2.2: Batch Document Generation
**As an** HR manager
**I want** to generate pay slips for all employees at once
**So that** I don't generate each pay slip individually

**Acceptance Criteria:**
- [ ] Select payroll run or employee group
- [ ] Generate documents in background (async job)
- [ ] Progress indicator (5/135 completed)
- [ ] Download all as ZIP file
- [ ] Email documents directly to employees
- [ ] Retry failed generations

#### Story 2.3: Bulk Actions UI Pattern
**As a** developer
**I want** a reusable bulk actions pattern
**So that** all batch operations have consistent UX

**Implementation:**
```tsx
export function useBulkActions<T extends { id: string }>() {
  const [selected, setSelected] = useState<T[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectAll = (items: T[]) => setSelected(items);
  const deselectAll = () => setSelected([]);
  const toggleSelect = (item: T) => {
    setSelected(prev =>
      prev.find(p => p.id === item.id)
        ? prev.filter(p => p.id !== item.id)
        : [...prev, item]
    );
  };

  const executeBulkAction = async (
    action: (ids: string[]) => Promise<void>,
    successMessage: string
  ) => {
    setIsProcessing(true);
    try {
      await action(selected.map(s => s.id));
      toast.success(successMessage);
      deselectAll();
    } catch (error) {
      toast.error("Erreur lors de l'opération groupée");
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    selected,
    selectAll,
    deselectAll,
    toggleSelect,
    executeBulkAction,
    isProcessing,
  };
}

// Usage
function EmployeeList() {
  const {
    selected,
    toggleSelect,
    selectAll,
    executeBulkAction
  } = useBulkActions<Employee>();

  return (
    <>
      <DataTable
        data={employees}
        selected={selected}
        onSelect={toggleSelect}
        onSelectAll={selectAll}
      />

      {selected.length > 0 && (
        <BulkActionsBar count={selected.length}>
          <Button onClick={() => executeBulkAction(
            bulkUpdateSalaries,
            'Salaires mis à jour avec succès'
          )}>
            Modifier les salaires
          </Button>

          <Button onClick={() => executeBulkAction(
            bulkGenerateContracts,
            'Contrats générés avec succès'
          )}>
            Générer les contrats
          </Button>
        </BulkActionsBar>
      )}
    </>
  );
}
```

---

### FEATURE 3: Event-Driven Automation

#### Story 3.1: Auto-Renewal Workflow
**As the** system
**I want** to automatically trigger contract renewal 30 days before expiry
**So that** HR managers don't miss renewal deadlines

**Acceptance Criteria:**
- [ ] Scheduled job runs daily at 6 AM
- [ ] Detects contracts expiring in 30 days
- [ ] Creates alert for HR manager
- [ ] Sends email notification
- [ ] If not actioned in 7 days, escalates to manager's manager
- [ ] Tracks workflow state (pending, in_progress, completed)

**Implementation:**
```typescript
// Scheduled job (cron)
export async function scheduleContractRenewalWorkflows() {
  const expiringIn30Days = await getContractsExpiringInDays(30);

  for (const contract of expiringIn30Days) {
    await startWorkflow({
      type: 'contract_renewal',
      entityId: contract.id,
      triggeredBy: 'system',
      steps: [
        {
          type: 'create_alert',
          severity: 'info',
          assignee: contract.employee.managerId,
          dueDate: addDays(new Date(), 23), // 7 days before expiry
        },
        {
          type: 'send_notification',
          channel: 'email',
          template: 'contract_renewal_reminder',
          recipient: contract.employee.manager.email,
        },
        {
          type: 'wait_for_action',
          timeout: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        },
        {
          type: 'escalate',
          condition: 'if_timeout',
          escalateTo: contract.employee.manager.managerId,
        },
      ],
    });
  }
}

// Workflow execution engine
export async function executeWorkflowStep(workflow: Workflow, step: WorkflowStep) {
  switch (step.type) {
    case 'create_alert':
      await createAlert({
        type: workflow.type,
        severity: step.severity,
        assigneeId: step.assignee,
        message: getAlertMessage(workflow),
        dueDate: step.dueDate,
      });
      break;

    case 'send_notification':
      await sendNotification({
        channel: step.channel,
        template: step.template,
        recipient: step.recipient,
        data: { workflow, employee: workflow.employee },
      });
      break;

    case 'wait_for_action':
      // Workflow pauses here, resumes when action taken or timeout
      await pauseWorkflow(workflow.id, step.timeout);
      break;

    case 'escalate':
      if (step.condition === 'if_timeout' && workflow.status === 'timeout') {
        await createAlert({
          type: 'escalation',
          severity: 'urgent',
          assigneeId: step.escalateTo,
          message: `Action requise: ${workflow.type}`,
        });
      }
      break;
  }
}
```

#### Story 3.2: Onboarding Automation
**As an** HR manager
**I want** automatic checklist creation when I hire someone
**So that** I don't forget onboarding steps

**Acceptance Criteria:**
- [ ] Creating employee triggers onboarding workflow
- [ ] Auto-creates tasks: contract, ID card, email setup, office access
- [ ] Assigns tasks to relevant people (IT, Facilities, HR)
- [ ] Tracks completion progress (3/10 tasks done)
- [ ] Sends reminders for overdue tasks
- [ ] Marks workflow complete when all tasks done

#### Story 3.3: Offboarding Automation
**As an** HR manager
**I want** automatic exit checklist when employee leaves
**So that** I don't forget offboarding steps

**Acceptance Criteria:**
- [ ] Setting `terminationDate` triggers offboarding
- [ ] Auto-creates tasks: exit interview, equipment return, access revocation
- [ ] Calculates final payroll (prorated + vacation payout)
- [ ] Generates exit documents (certificate, reference letter)
- [ ] Archives employee data (GDPR compliance)
- [ ] Workflow completes 30 days after termination date

#### Story 3.4: Event-Driven Payroll Calculations
**As the** system
**I want** to automatically trigger payroll calculations on employee lifecycle events
**So that** payroll is always accurate without manual intervention

**Acceptance Criteria:**
- [ ] Contract termination triggers prorated final payroll
- [ ] Mid-month hire triggers prorated first payroll
- [ ] Salary changes automatically recalculate affected payroll runs
- [ ] Leave without pay triggers payroll deductions
- [ ] Position changes update payroll calculations (different benefits)
- [ ] All calculations respect country-specific rules (Côte d'Ivoire CNPS, etc.)

**Implementation:**
```typescript
// Event listener: Employee termination
eventBus.on('employee.terminated', async (event: EmployeeTerminatedEvent) => {
  const { employeeId, terminationDate, reason } = event;

  // Calculate final payroll
  const finalPayroll = await calculateFinalPayroll({
    employeeId,
    terminationDate,
    includeProration: true,
    includeVacationPayout: true,
    includeExitBenefits: reason === 'resignation' ? false : true,
  });

  // Create final payroll run entry
  await createPayrollEntry({
    employeeId,
    payrollRunId: await getCurrentPayrollRun(),
    baseSalary: finalPayroll.proratedSalary,
    deductions: finalPayroll.deductions,
    benefits: finalPayroll.benefits,
    vacationPayout: finalPayroll.vacationPayout,
    exitBenefits: finalPayroll.exitBenefits,
    isPartialMonth: true,
    workingDays: finalPayroll.workingDays,
  });

  // Create alert for HR manager
  await createAlert({
    type: 'final_payroll_ready',
    severity: 'info',
    employeeId,
    message: `Paie de sortie calculée pour ${event.employeeName}`,
    actionUrl: `/payroll/review/${finalPayroll.id}`,
  });
});

// Event listener: Mid-month hire
eventBus.on('employee.hired', async (event: EmployeeHiredEvent) => {
  const { employeeId, hireDate } = event;

  // Only create prorated payroll if hired mid-month
  if (hireDate.getDate() > 1) {
    const firstPayroll = await calculateProratedFirstPayroll({
      employeeId,
      hireDate,
      fullMonthlySalary: event.baseSalary,
    });

    await createPayrollEntry({
      employeeId,
      payrollRunId: await getCurrentPayrollRun(),
      baseSalary: firstPayroll.proratedSalary,
      isPartialMonth: true,
      workingDays: firstPayroll.workingDays,
    });

    // Alert HR manager
    await createAlert({
      type: 'prorated_payroll_created',
      severity: 'info',
      employeeId,
      message: `Paie au prorata créée pour ${event.employeeName} (embauche le ${format(hireDate, 'dd MMM')})`,
      actionUrl: `/payroll/review/${firstPayroll.id}`,
    });
  }
});

// Event listener: Salary change
eventBus.on('salary.changed', async (event: SalaryChangedEvent) => {
  const { employeeId, effectiveFrom, newSalary } = event;

  // Find affected payroll runs (current month if effective date is mid-month)
  const affectedRuns = await getPayrollRunsAffectedBy(effectiveFrom);

  for (const run of affectedRuns) {
    // Recalculate payroll with prorated salary
    const recalculated = await recalculatePayrollEntry({
      employeeId,
      payrollRunId: run.id,
      salaryChangeDate: effectiveFrom,
      oldSalary: event.oldSalary,
      newSalary: newSalary,
    });

    // Mark for review
    await markPayrollForReview(recalculated.id, 'salary_change');
  }

  // Alert HR manager
  await createAlert({
    type: 'payroll_recalculated',
    severity: 'warning',
    employeeId,
    message: `Paie recalculée suite au changement de salaire de ${event.employeeName}`,
    actionUrl: `/payroll/review?employee=${employeeId}`,
  });
});

// Event listener: Leave without pay
eventBus.on('leave.approved', async (event: LeaveApprovedEvent) => {
  const { employeeId, leaveType, startDate, endDate } = event;

  // Only process unpaid leave
  if (leaveType === 'unpaid') {
    const deduction = await calculateUnpaidLeaveDeduction({
      employeeId,
      startDate,
      endDate,
    });

    // Find affected payroll run
    const payrollRun = await getPayrollRunForMonth(startDate);

    // Add deduction to payroll entry
    await addPayrollDeduction({
      employeeId,
      payrollRunId: payrollRun.id,
      type: 'unpaid_leave',
      amount: deduction.amount,
      days: deduction.days,
      description: `Congé sans solde: ${deduction.days} jours`,
    });

    // Alert HR manager
    await createAlert({
      type: 'unpaid_leave_deduction',
      severity: 'info',
      employeeId,
      message: `Déduction pour congé sans solde ajoutée (${deduction.days}j - ${formatCurrency(deduction.amount)})`,
      actionUrl: `/payroll/review/${payrollRun.id}`,
    });
  }
});
```

**Payroll Calculation Functions:**
```typescript
// Calculate prorated salary for termination
export async function calculateFinalPayroll(params: {
  employeeId: string;
  terminationDate: Date;
  includeProration: boolean;
  includeVacationPayout: boolean;
  includeExitBenefits: boolean;
}) {
  const employee = await getEmployee(params.employeeId);
  const currentSalary = await getCurrentSalary(params.employeeId);

  // Prorated salary for partial month
  const workingDays = getWorkingDaysInMonth(
    params.terminationDate,
    employee.countryCode
  );
  const daysWorked = getDaysWorkedUntil(
    startOfMonth(params.terminationDate),
    params.terminationDate,
    employee.countryCode
  );

  const proratedSalary = params.includeProration
    ? (currentSalary.baseSalary / workingDays) * daysWorked
    : currentSalary.baseSalary;

  // Vacation payout
  const vacationPayout = params.includeVacationPayout
    ? await calculateVacationPayout(params.employeeId, params.terminationDate)
    : 0;

  // Exit benefits (indemnité de licenciement)
  const exitBenefits = params.includeExitBenefits
    ? await calculateExitBenefits(params.employeeId, employee.countryCode)
    : 0;

  // Standard deductions (CNPS, taxes on prorated amount)
  const deductions = await calculateDeductions({
    employeeId: params.employeeId,
    baseSalary: proratedSalary,
    countryCode: employee.countryCode,
  });

  return {
    proratedSalary,
    workingDays,
    daysWorked,
    vacationPayout,
    exitBenefits,
    deductions,
    netPay: proratedSalary + vacationPayout + exitBenefits - deductions.total,
  };
}

// Calculate prorated salary for mid-month hire
export async function calculateProratedFirstPayroll(params: {
  employeeId: string;
  hireDate: Date;
  fullMonthlySalary: number;
}) {
  const employee = await getEmployee(params.employeeId);

  const workingDays = getWorkingDaysInMonth(
    params.hireDate,
    employee.countryCode
  );
  const daysWorked = getDaysWorkedFrom(
    params.hireDate,
    endOfMonth(params.hireDate),
    employee.countryCode
  );

  const proratedSalary = (params.fullMonthlySalary / workingDays) * daysWorked;

  return {
    proratedSalary,
    workingDays,
    daysWorked,
    proratedPercentage: (daysWorked / workingDays) * 100,
  };
}

// Recalculate payroll when salary changes mid-month
export async function recalculatePayrollEntry(params: {
  employeeId: string;
  payrollRunId: string;
  salaryChangeDate: Date;
  oldSalary: number;
  newSalary: number;
}) {
  const employee = await getEmployee(params.employeeId);
  const payrollRun = await getPayrollRun(params.payrollRunId);

  // Calculate days at old salary vs new salary
  const totalWorkingDays = getWorkingDaysInMonth(
    payrollRun.payPeriodStart,
    employee.countryCode
  );

  const daysAtOldSalary = getDaysWorkedBetween(
    payrollRun.payPeriodStart,
    params.salaryChangeDate,
    employee.countryCode
  );

  const daysAtNewSalary = getDaysWorkedBetween(
    addDays(params.salaryChangeDate, 1),
    payrollRun.payPeriodEnd,
    employee.countryCode
  );

  // Prorated calculation
  const salaryFromOldRate = (params.oldSalary / totalWorkingDays) * daysAtOldSalary;
  const salaryFromNewRate = (params.newSalary / totalWorkingDays) * daysAtNewSalary;
  const totalSalary = salaryFromOldRate + salaryFromNewRate;

  // Update payroll entry
  await updatePayrollEntry(params.employeeId, params.payrollRunId, {
    baseSalary: totalSalary,
    metadata: {
      salaryChange: {
        date: params.salaryChangeDate,
        oldSalary: params.oldSalary,
        newSalary: params.newSalary,
        daysAtOldSalary,
        daysAtNewSalary,
      },
    },
  });

  return { totalSalary, daysAtOldSalary, daysAtNewSalary };
}
```

**Database Schema Addition:**
```sql
-- Track payroll events for audit trail
CREATE TABLE payroll_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Event details
  event_type TEXT NOT NULL, -- 'termination', 'hire', 'salary_change', 'unpaid_leave'
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_run_id UUID REFERENCES payroll_runs(id),

  -- Event data
  event_date DATE NOT NULL,
  metadata JSONB, -- Event-specific data

  -- Calculated amounts
  amount_calculated DECIMAL(15, 2),
  is_prorated BOOLEAN DEFAULT false,
  working_days INTEGER,
  days_worked INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT payroll_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_payroll_events_employee ON payroll_events(employee_id, event_date);
CREATE INDEX idx_payroll_events_run ON payroll_events(payroll_run_id);
```

---

### FEATURE 4: Visual Workflow Builder (Future)

#### Story 4.1: No-Code Workflow Designer
**As a** power user (HR manager)
**I want** to create custom workflows without coding
**So that** I can automate company-specific processes

**Acceptance Criteria:**
- [ ] Drag-drop workflow designer
- [ ] Visual triggers (when X happens)
- [ ] Visual actions (then do Y)
- [ ] Condition branches (if/else logic)
- [ ] Test workflow with sample data
- [ ] Publish workflow to production

**UI Concept:**
```tsx
<WorkflowBuilder>
  <Canvas>
    <TriggerNode type="employee.created">
      Quand un employé est créé
    </TriggerNode>

    <ActionNode type="create_tasks">
      Créer les tâches d'onboarding
      <TaskList>
        - Créer le contrat
        - Configurer l'email
        - Commander l'équipement
      </TaskList>
    </ActionNode>

    <ConditionNode>
      Si le poste est "Développeur"
      <TrueBranch>
        <ActionNode>Créer compte GitHub</ActionNode>
      </TrueBranch>
      <FalseBranch>
        <ActionNode>Passer</ActionNode>
      </FalseBranch>
    </ConditionNode>

    <ActionNode type="send_notification">
      Notifier le manager
    </ActionNode>
  </Canvas>

  <Toolbar>
    <Button>Tester le workflow</Button>
    <Button>Publier</Button>
  </Toolbar>
</WorkflowBuilder>
```

---

## Database Schema

### Alerts & Notifications
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Alert details
  type TEXT NOT NULL, -- 'contract_expiry', 'leave_notification', 'document_expiry'
  severity TEXT NOT NULL, -- 'info', 'warning', 'urgent'
  message TEXT NOT NULL,

  -- Assignment
  assignee_id UUID NOT NULL REFERENCES users(id),
  employee_id UUID REFERENCES employees(id), -- Related employee

  -- Action
  action_url TEXT, -- Where to navigate on click
  action_label TEXT, -- "Renouveler le contrat"
  due_date TIMESTAMP,

  -- State
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'dismissed', 'completed'
  dismissed_at TIMESTAMP,
  completed_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT alerts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_assignee ON alerts(assignee_id, status);
CREATE INDEX idx_alerts_due_date ON alerts(due_date) WHERE status = 'active';
```

### Workflows
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Workflow definition
  type TEXT NOT NULL, -- 'contract_renewal', 'onboarding', 'offboarding'
  entity_type TEXT NOT NULL, -- 'employee', 'contract', 'payroll_run'
  entity_id UUID NOT NULL,

  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'timeout'
  current_step INTEGER DEFAULT 0,

  -- Configuration
  steps JSONB NOT NULL, -- Array of workflow steps
  context JSONB, -- Runtime data

  -- Lifecycle
  triggered_by UUID REFERENCES users(id), -- User or 'system'
  triggered_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT workflows_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_workflows_entity ON workflows(entity_type, entity_id);
CREATE INDEX idx_workflows_status ON workflows(status, triggered_at);
```

### Batch Operations
```sql
CREATE TABLE batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Operation details
  operation_type TEXT NOT NULL, -- 'salary_update', 'document_generation'
  entity_type TEXT NOT NULL, -- 'employees', 'contracts'
  entity_ids UUID[] NOT NULL, -- Array of affected IDs

  -- Parameters
  params JSONB NOT NULL,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  total_count INTEGER NOT NULL,
  processed_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB, -- Array of { entityId, error }

  -- Execution
  started_by UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT batch_operations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_batch_operations_status ON batch_operations(status, started_at);
```

---

## API Endpoints (tRPC)

### Alerts Router
```typescript
export const alertsRouter = createTRPCRouter({
  // List alerts for current user
  list: publicProcedure
    .input(z.object({
      status: z.enum(['active', 'dismissed', 'completed']).optional(),
      severity: z.enum(['info', 'warning', 'urgent']).optional(),
      limit: z.number().default(20),
    }))
    .query(async ({ input, ctx }) => {
      return await db.query.alerts.findMany({
        where: and(
          eq(alerts.assigneeId, ctx.userId),
          input.status ? eq(alerts.status, input.status) : undefined,
          input.severity ? eq(alerts.severity, input.severity) : undefined
        ),
        orderBy: [desc(alerts.dueDate)],
        limit: input.limit,
      });
    }),

  // Dismiss alert
  dismiss: publicProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.update(alerts)
        .set({
          status: 'dismissed',
          dismissedAt: new Date()
        })
        .where(eq(alerts.id, input.alertId));
    }),

  // Complete alert (with action)
  complete: publicProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.update(alerts)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(alerts.id, input.alertId));
    }),
});
```

### Batch Operations Router
```typescript
export const batchRouter = createTRPCRouter({
  // Start batch salary update
  updateSalaries: publicProcedure
    .input(z.object({
      employeeIds: z.array(z.string().uuid()),
      updateType: z.enum(['absolute', 'percentage']),
      value: z.number(),
      effectiveDate: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      const operation = await createBatchOperation({
        type: 'salary_update',
        entityIds: input.employeeIds,
        params: input,
        userId: ctx.userId,
      });

      // Execute in background
      await executeBatchOperation(operation.id);

      return operation;
    }),

  // Get batch operation status
  getStatus: publicProcedure
    .input(z.object({ operationId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await db.query.batchOperations.findFirst({
        where: eq(batchOperations.id, input.operationId),
      });
    }),

  // Retry failed items
  retryFailed: publicProcedure
    .input(z.object({ operationId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const operation = await getBatchOperation(input.operationId);
      const failedIds = operation.errors.map(e => e.entityId);

      await executeBatchOperation(operation.id, failedIds);
    }),
});
```

---

## Performance & Scalability

### Async Processing
- **Background Jobs** - Use Bull/BullMQ for long-running operations
- **Progress Updates** - WebSocket for real-time progress (5/135 completed)
- **Chunking** - Process in batches of 50 to avoid memory issues
- **Retry Logic** - Exponential backoff for failed items

### Caching
- **Alert Counts** - Cache urgent alert count (invalidate on create/dismiss)
- **Workflow State** - Redis for active workflow state
- **Batch Status** - Cache operation progress for UI polling

### Database Optimization
```sql
-- Indexes for alert queries
CREATE INDEX idx_alerts_active_urgent ON alerts(assignee_id, due_date)
  WHERE status = 'active' AND severity = 'urgent';

-- Partial index for active workflows
CREATE INDEX idx_workflows_active ON workflows(entity_type, entity_id)
  WHERE status IN ('pending', 'in_progress');

-- Batch operations by user
CREATE INDEX idx_batch_operations_user ON batch_operations(started_by, status);
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('Contract Expiry Alerts', () => {
  it('creates alert 30 days before contract expiry', async () => {
    const contract = await createTestContract({
      effectiveTo: addDays(new Date(), 30),
    });

    await createContractExpiryAlerts();

    const alert = await getAlertForContract(contract.id);
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('info');
  });

  it('escalates to urgent when 7 days before expiry', async () => {
    const contract = await createTestContract({
      effectiveTo: addDays(new Date(), 7),
    });

    await createContractExpiryAlerts();

    const alert = await getAlertForContract(contract.id);
    expect(alert.severity).toBe('urgent');
  });
});
```

### Integration Tests
```typescript
describe('Bulk Salary Update', () => {
  it('updates 100 employees in < 5 seconds', async () => {
    const employees = await createTestEmployees(100);
    const start = Date.now();

    await bulkUpdateSalaries({
      employeeIds: employees.map(e => e.id),
      updateType: 'percentage',
      value: 10,
      effectiveDate: new Date('2025-01-01'),
    });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);

    // Verify all updated
    const updated = await getSalariesEffectiveOn(new Date('2025-01-01'));
    expect(updated).toHaveLength(100);
  });
});
```

---

## UX Checklist (HCI Compliance)

### Zero Learning Curve
- [ ] Alerts use familiar icons (⚠️ warning, 🔴 urgent)
- [ ] One-click actions from alerts ("Renouveler")
- [ ] Progress bars for batch operations (visual feedback)
- [ ] No technical terms ("workflow" → "tâche automatique")

### Error Prevention
- [ ] Preview changes before bulk operations
- [ ] Confirmation dialogs for destructive actions
- [ ] Cancel/undo option for batch operations
- [ ] Disable invalid selections (can't bulk update archived employees)

### Immediate Feedback
- [ ] Toast notifications for completed actions
- [ ] Real-time progress updates (5/135 completed)
- [ ] Badge counts on navigation (3 urgent alerts)
- [ ] Loading states for async operations

### Mobile-Friendly
- [ ] Swipeable alert cards on mobile
- [ ] Push notifications for urgent alerts
- [ ] Bottom sheet for batch actions (mobile)
- [ ] Touch-friendly action buttons (≥ 44px)

---

## Success Metrics

**Adoption:**
- Alert usage: % of HR managers using alerts daily
- Batch operations: Average employees per batch operation
- Workflow completion: % of workflows completed on time

**Efficiency:**
- Time saved: Compare manual vs automated workflows
- Error reduction: Fewer missed contract renewals
- User satisfaction: NPS for automation features

**Performance:**
- Alert delivery: < 1 minute from trigger to notification
- Batch operations: < 10 seconds per 100 employees
- Workflow execution: 99.9% completion rate

---

**Built to eliminate the manual tracking burden that forced Alexise to abandon Odoo.** 🚀
