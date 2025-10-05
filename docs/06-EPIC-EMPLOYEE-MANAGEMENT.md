# 👥 EPIC: Employee Management

## Epic Overview

**Goal:** Implement comprehensive employee lifecycle management with position-based organization, effective-dated assignments, and full CRUD operations while maintaining data integrity and audit trails.

**Priority:** P0 (Must-have for MVP)

**Source Documents:**
- `01-CONSTRAINTS-AND-RULES.md` - Multi-tenancy, effective dating, validation rules
- `02-ARCHITECTURE-OVERVIEW.md` - Bounded contexts, event-driven patterns
- `03-DATABASE-SCHEMA.md` - Tables: employees, positions, assignments, employee_salaries
- `04-DOMAIN-MODELS.md` - Business entities, validation rules, domain events
- `HCI-DESIGN-PRINCIPLES.md` - **UX design principles for low digital literacy**
- `09-EPIC-WORKFLOW-AUTOMATION.md` - Alerts, batch operations for employees

**Dependencies:**
- Multi-tenant infrastructure (RLS policies)
- Authentication system (user context)
- Position management (for assignments)
- Multi-country configuration (countries table with SMIG/minimum wage)

**Dependent Systems:**
- Payroll (reads employee data, salaries)
- Time Tracking (links to employees)
- Workflows (onboarding, offboarding)

---

## Success Criteria

- [x] CRUD operations for employees with RLS enforcement
- [x] Position management separate from people
- [x] Assignment system binding employees to positions
- [x] Effective-dated salary changes (no history loss)
- [x] Employee lifecycle events (hire, promote, transfer, terminate)
- [x] Audit trail for all changes
- [x] Data validation (SMIG minimum, email uniqueness)
- [x] Event emission for downstream systems
- [x] French-language error messages

---

## Features & User Stories

### FEATURE 1: Employee CRUD Operations

#### Story 1.1: Create Employee (Hire)
**As a** HR manager
**I want** to add a new employee to the system
**So that** they can be paid and tracked

**Acceptance Criteria:**
- [ ] Validate required fields (first name, last name, email, hire date, position, base salary)
- [ ] Generate unique employee_number (format: tenant prefix + sequential number)
- [ ] Validate email uniqueness within tenant
- [ ] Validate base salary >= country-specific SMIG (from countries.minimum_wage)
- [ ] Create employee record with status 'active'
- [ ] Create initial salary record (effective from hire date)
- [ ] Create position assignment (effective from hire date)
- [ ] Set payroll-specific fields (fiscal_parts, sector_code from tenant defaults)
- [ ] Encrypt PII fields (national_id, bank_account)
- [ ] Set tenant_id from authenticated user context
- [ ] Create audit log entry
- [ ] Emit event: `employee.hired`
- [ ] Return employee with generated ID

**Multi-Country Note:**
- SMIG minimum varies by country: CI=75,000 FCFA, SN=60,000 FCFA, etc.
- Load minimum wage from `countries` table based on `tenant.country_code`
- fiscal_parts defaults to 1.0 (single, no children) - required for tax calculations
- sector_code inherited from tenant - used for work accident contribution rates

**Test Cases:**
```typescript
describe('Create Employee', () => {
  it('should create employee with all required fields', async () => {
    const result = await caller.employees.create({
      firstName: 'Kouadio',
      lastName: 'N\'Guessan',
      email: 'kouadio@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 300000,
      housingAllowance: 50000,
    });

    expect(result.id).toBeDefined();
    expect(result.employee_number).toMatch(/^EMP-\d{6}$/);
    expect(result.status).toBe('active');
    expect(result.hire_date).toEqual(new Date('2025-01-15'));
  });

  it('should reject salary below country SMIG', async () => {
    // Tenant is in CI with SMIG = 75,000 FCFA
    await expect(
      caller.employees.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        hireDate: new Date('2025-01-15'),
        positionId: position.id,
        baseSalary: 50000, // Below CI SMIG
      })
    ).rejects.toThrow('Le salaire doit être supérieur ou égal au SMIG (75000 FCFA)');
  });

  it('should validate against correct country SMIG', async () => {
    // For Senegal tenant, SMIG is 60,000 FCFA
    const snTenant = await createTenant({ countryCode: 'SN' });

    const result = await caller.employees.create({
      firstName: 'Fatou',
      lastName: 'Diop',
      email: 'fatou@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 65000, // Valid for SN (>60k), would be invalid for CI (<75k)
    });

    expect(result.base_salary).toBe(65000);
  });

  it('should reject duplicate email within tenant', async () => {
    await caller.employees.create({
      firstName: 'First',
      lastName: 'Employee',
      email: 'duplicate@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 100000,
    });

    await expect(
      caller.employees.create({
        firstName: 'Second',
        lastName: 'Employee',
        email: 'duplicate@example.com', // Duplicate
        hireDate: new Date('2025-01-15'),
        positionId: position.id,
        baseSalary: 100000,
      })
    ).rejects.toThrow('Un employé avec cet email existe déjà');
  });

  it('should allow same email in different tenants', async () => {
    // Tenant 1
    const emp1 = await caller1.employees.create({
      email: 'shared@example.com',
      // ... other fields
    });

    // Tenant 2 (different tenant_id)
    const emp2 = await caller2.employees.create({
      email: 'shared@example.com', // Same email, different tenant
      // ... other fields
    });

    expect(emp1.tenant_id).not.toBe(emp2.tenant_id);
    expect(emp1.email).toBe(emp2.email);
  });

  it('should encrypt PII fields', async () => {
    const result = await caller.employees.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 100000,
      nationalId: '1234567890', // PII
      bankAccount: 'CI93 CI 001 01234567890123 45', // PII
    });

    // Check encrypted in database
    const dbEmployee = await db.query.employees.findFirst({
      where: eq(employees.id, result.id),
    });

    expect(dbEmployee.national_id).not.toBe('1234567890');
    expect(dbEmployee.bank_account).not.toBe('CI93 CI 001 01234567890123 45');

    // But decrypted in API response
    expect(result.national_id).toBe('1234567890');
    expect(result.bank_account).toBe('CI93 CI 001 01234567890123 45');
  });

  it('should create salary and assignment records', async () => {
    const result = await caller.employees.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 300000,
      housingAllowance: 50000,
    });

    // Check salary record
    const salary = await db.query.employee_salaries.findFirst({
      where: and(
        eq(employee_salaries.employee_id, result.id),
        isNull(employee_salaries.effective_to) // Current
      ),
    });

    expect(salary).toBeDefined();
    expect(salary.base_salary).toBe(300000);
    expect(salary.housing_allowance).toBe(50000);
    expect(salary.effective_from).toEqual(new Date('2025-01-15'));

    // Check assignment record
    const assignment = await db.query.assignments.findFirst({
      where: and(
        eq(assignments.employee_id, result.id),
        isNull(assignments.effective_to) // Current
      ),
    });

    expect(assignment).toBeDefined();
    expect(assignment.position_id).toBe(position.id);
    expect(assignment.effective_from).toEqual(new Date('2025-01-15'));
  });

  it('should emit employee.hired event', async () => {
    const eventSpy = jest.spyOn(eventBus, 'publish');

    const result = await caller.employees.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 300000,
    });

    expect(eventSpy).toHaveBeenCalledWith('employee.hired', {
      employeeId: result.id,
      tenantId: result.tenant_id,
      hireDate: result.hire_date,
      positionId: position.id,
    });
  });
});
```

**Implementation:**
```typescript
// src/features/employees/services/employee.service.ts

import { encrypt } from '@/shared/crypto';
import { generateEmployeeNumber } from './employee-number';

export async function createEmployee(data: CreateEmployeeInput) {
  // Validation
  if (data.baseSalary < 75000) {
    throw new ValidationError('Le salaire doit être supérieur ou égal au SMIG (75000 FCFA)');
  }

  // Check email uniqueness within tenant
  const existing = await db.query.employees.findFirst({
    where: and(
      eq(employees.tenant_id, data.tenantId),
      eq(employees.email, data.email)
    ),
  });

  if (existing) {
    throw new ValidationError('Un employé avec cet email existe déjà');
  }

  return await db.transaction(async (tx) => {
    // Generate employee number
    const employeeNumber = await generateEmployeeNumber(data.tenantId, tx);

    // Create employee
    const employee = await tx.insert(employees).values({
      tenant_id: data.tenantId,
      employee_number: employeeNumber,
      first_name: data.firstName,
      last_name: data.lastName,
      preferred_name: data.preferredName,
      email: data.email,
      phone: data.phone,
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      national_id: data.nationalId ? encrypt(data.nationalId) : null,
      bank_account: data.bankAccount ? encrypt(data.bankAccount) : null,
      hire_date: data.hireDate,
      status: 'active',
      created_by: data.createdBy,
    }).returning();

    const emp = employee[0];

    // Create salary record
    await tx.insert(employee_salaries).values({
      tenant_id: data.tenantId,
      employee_id: emp.id,
      base_salary: data.baseSalary,
      housing_allowance: data.housingAllowance || 0,
      transport_allowance: data.transportAllowance || 0,
      meal_allowance: data.mealAllowance || 0,
      effective_from: data.hireDate,
      effective_to: null,
      change_reason: 'hire',
      created_by: data.createdBy,
    });

    // Create assignment
    await tx.insert(assignments).values({
      tenant_id: data.tenantId,
      employee_id: emp.id,
      position_id: data.positionId,
      assignment_type: 'primary',
      effective_from: data.hireDate,
      effective_to: null,
      assignment_reason: 'hire',
      created_by: data.createdBy,
    });

    // Audit log
    await tx.insert(audit_logs).values({
      tenant_id: data.tenantId,
      user_id: data.createdBy,
      user_email: data.createdByEmail,
      action: 'create',
      entity_type: 'employee',
      entity_id: emp.id,
      new_values: {
        firstName: emp.first_name,
        lastName: emp.last_name,
        email: emp.email,
        hireDate: emp.hire_date,
      },
    });

    return emp;
  });
}

// Event emission (after transaction commits)
await eventBus.publish('employee.hired', {
  employeeId: employee.id,
  tenantId: employee.tenant_id,
  hireDate: employee.hire_date,
  positionId: data.positionId,
});
```

#### Story 1.2: List Employees with Filtering
**As a** HR manager
**I want** to view a list of employees with filtering options
**So that** I can find specific employees quickly

**Acceptance Criteria:**
- [ ] Filter by status (active, terminated, suspended)
- [ ] Filter by position/department
- [ ] Search by name or employee number
- [ ] Pagination (cursor-based, 50 per page)
- [ ] RLS automatically filters by tenant_id
- [ ] Include current salary and position (eager loading)
- [ ] Sort by hire date (desc) by default

**Test Cases:**
```typescript
describe('List Employees', () => {
  it('should return only active employees by default', async () => {
    await createTestEmployees([
      { status: 'active', firstName: 'Active1' },
      { status: 'active', firstName: 'Active2' },
      { status: 'terminated', firstName: 'Terminated1' },
    ]);

    const result = await caller.employees.list({});

    expect(result.employees).toHaveLength(2);
    expect(result.employees.every(e => e.status === 'active')).toBe(true);
  });

  it('should filter by status', async () => {
    await createTestEmployees([
      { status: 'active' },
      { status: 'terminated' },
      { status: 'suspended' },
    ]);

    const result = await caller.employees.list({ status: 'terminated' });

    expect(result.employees).toHaveLength(1);
    expect(result.employees[0].status).toBe('terminated');
  });

  it('should search by name', async () => {
    await createTestEmployees([
      { firstName: 'Kouadio', lastName: 'Yao' },
      { firstName: 'Marie', lastName: 'Kouassi' },
      { firstName: 'Jean', lastName: 'Diallo' },
    ]);

    const result = await caller.employees.list({ search: 'Koua' });

    expect(result.employees).toHaveLength(2); // Kouadio and Kouassi
  });

  it('should paginate results', async () => {
    await createTestEmployees(60); // More than page size

    const page1 = await caller.employees.list({ limit: 50 });
    expect(page1.employees).toHaveLength(50);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await caller.employees.list({
      limit: 50,
      cursor: page1.nextCursor,
    });
    expect(page2.employees).toHaveLength(10);
    expect(page2.nextCursor).toBeUndefined();
  });

  it('should enforce RLS (tenant isolation)', async () => {
    // Tenant 1 employees
    await caller1.employees.create({ /* ... */ });
    await caller1.employees.create({ /* ... */ });

    // Tenant 2 employees
    await caller2.employees.create({ /* ... */ });

    const tenant1List = await caller1.employees.list({});
    expect(tenant1List.employees).toHaveLength(2);

    const tenant2List = await caller2.employees.list({});
    expect(tenant2List.employees).toHaveLength(1);
  });

  it('should include current salary and position', async () => {
    const emp = await caller.employees.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      hireDate: new Date('2025-01-15'),
      positionId: position.id,
      baseSalary: 300000,
    });

    const result = await caller.employees.list({});

    expect(result.employees[0].currentSalary).toBeDefined();
    expect(result.employees[0].currentSalary.base_salary).toBe(300000);
    expect(result.employees[0].currentPosition).toBeDefined();
    expect(result.employees[0].currentPosition.id).toBe(position.id);
  });
});
```

#### Story 1.3: Get Employee Details
**As a** HR manager
**I want** to view complete employee details
**So that** I can review or edit employee information

**Acceptance Criteria:**
- [ ] Fetch by employee ID
- [ ] Include all basic information
- [ ] Decrypt PII fields (national_id, bank_account)
- [ ] Include salary history (effective-dated)
- [ ] Include assignment history
- [ ] Include custom fields
- [ ] RLS enforcement (403 if different tenant)
- [ ] 404 if employee not found

**Test Cases:**
```typescript
describe('Get Employee Details', () => {
  it('should return complete employee data', async () => {
    const emp = await createTestEmployee({
      firstName: 'Kouadio',
      lastName: 'Yao',
      baseSalary: 300000,
      nationalId: '1234567890',
    });

    const result = await caller.employees.getById(emp.id);

    expect(result.id).toBe(emp.id);
    expect(result.first_name).toBe('Kouadio');
    expect(result.national_id).toBe('1234567890'); // Decrypted
  });

  it('should include salary history', async () => {
    const emp = await createTestEmployee({ baseSalary: 200000 });

    // Change salary
    await changeSalary(emp.id, 300000, new Date('2025-02-01'));

    const result = await caller.employees.getById(emp.id);

    expect(result.salaryHistory).toHaveLength(2);
    expect(result.salaryHistory[0].base_salary).toBe(300000); // Current
    expect(result.salaryHistory[0].effective_to).toBeNull();
    expect(result.salaryHistory[1].base_salary).toBe(200000); // Old
    expect(result.salaryHistory[1].effective_to).toEqual(new Date('2025-02-01'));
  });

  it('should enforce tenant isolation', async () => {
    const emp = await caller1.employees.create({ /* tenant 1 */ });

    await expect(
      caller2.employees.getById(emp.id) // Tenant 2 trying to access
    ).rejects.toThrow('Employé non trouvé');
  });

  it('should return 404 for non-existent employee', async () => {
    await expect(
      caller.employees.getById('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow('Employé non trouvé');
  });
});
```

#### Story 1.4: Update Employee
**As a** HR manager
**I want** to update employee information
**So that** records stay current

**Acceptance Criteria:**
- [ ] Allow update of non-sensitive fields (name, contact info, custom fields)
- [ ] Prevent update of immutable fields (employee_number, hire_date, tenant_id)
- [ ] Validate email uniqueness if changed
- [ ] Encrypt PII fields if updated
- [ ] Create audit log entry with old/new values
- [ ] Emit event: `employee.updated`
- [ ] Do NOT update salary or position (use dedicated endpoints)

**Test Cases:**
```typescript
describe('Update Employee', () => {
  it('should update allowed fields', async () => {
    const emp = await createTestEmployee({
      firstName: 'Old',
      email: 'old@example.com',
    });

    const updated = await caller.employees.update({
      id: emp.id,
      firstName: 'New',
      email: 'new@example.com',
      phone: '+225 0123456789',
    });

    expect(updated.first_name).toBe('New');
    expect(updated.email).toBe('new@example.com');
    expect(updated.phone).toBe('+225 0123456789');
  });

  it('should prevent update of immutable fields', async () => {
    const emp = await createTestEmployee({ employee_number: 'EMP-000001' });

    await expect(
      caller.employees.update({
        id: emp.id,
        employee_number: 'EMP-999999', // Immutable
      })
    ).rejects.toThrow('Impossible de modifier le numéro d\'employé');
  });

  it('should validate email uniqueness', async () => {
    const emp1 = await createTestEmployee({ email: 'existing@example.com' });
    const emp2 = await createTestEmployee({ email: 'other@example.com' });

    await expect(
      caller.employees.update({
        id: emp2.id,
        email: 'existing@example.com', // Duplicate
      })
    ).rejects.toThrow('Un employé avec cet email existe déjà');
  });

  it('should create audit log', async () => {
    const emp = await createTestEmployee({ firstName: 'Old' });

    await caller.employees.update({
      id: emp.id,
      firstName: 'New',
    });

    const logs = await db.query.audit_logs.findMany({
      where: and(
        eq(audit_logs.entity_type, 'employee'),
        eq(audit_logs.entity_id, emp.id)
      ),
      orderBy: desc(audit_logs.created_at),
    });

    expect(logs[0].action).toBe('update');
    expect(logs[0].old_values).toEqual({ firstName: 'Old' });
    expect(logs[0].new_values).toEqual({ firstName: 'New' });
  });
});
```

---

### FEATURE 2: Position Management (Separate from People)

#### Story 2.1: Create Position
**As a** HR manager
**I want** to define positions separate from people
**So that** I can manage org structure independently

**Acceptance Criteria:**
- [ ] Create position with title, code, department
- [ ] Set salary range (min/max)
- [ ] Set work schedule (weekly hours, days)
- [ ] Set headcount (how many people can fill this position)
- [ ] Validate title is unique within department
- [ ] Effective-dated for org changes
- [ ] Emit event: `position.created`

**Test Cases:**
```typescript
describe('Create Position', () => {
  it('should create position with required fields', async () => {
    const result = await caller.positions.create({
      title: 'Développeur Senior',
      code: 'DEV-001',
      departmentId: dept.id,
      minSalary: 500000,
      maxSalary: 1000000,
      weeklyHours: 40,
      headcount: 3,
    });

    expect(result.id).toBeDefined();
    expect(result.title).toBe('Développeur Senior');
    expect(result.headcount).toBe(3);
  });

  it('should validate salary range', async () => {
    await expect(
      caller.positions.create({
        title: 'Test Position',
        minSalary: 1000000,
        maxSalary: 500000, // Min > Max
      })
    ).rejects.toThrow('Le salaire minimum doit être inférieur au maximum');
  });

  it('should enforce minimum wage for minSalary', async () => {
    await expect(
      caller.positions.create({
        title: 'Test Position',
        minSalary: 50000, // Below SMIG
        maxSalary: 100000,
      })
    ).rejects.toThrow('Le salaire minimum doit être >= SMIG (75000 FCFA)');
  });
});
```

#### Story 2.2: Organizational Hierarchy
**As a** HR manager
**I want** to define reporting relationships between positions
**So that** org charts can be generated

**Acceptance Criteria:**
- [ ] Set `reports_to_position_id` on position
- [ ] Prevent circular reporting (A → B → A)
- [ ] Query hierarchy (get all reports for a position)
- [ ] Calculate org depth
- [ ] Support matrix reporting (secondary assignments)

**Test Cases:**
```typescript
describe('Position Hierarchy', () => {
  it('should create reporting relationship', async () => {
    const ceo = await createPosition({ title: 'CEO' });
    const cto = await createPosition({
      title: 'CTO',
      reportsTo: ceo.id,
    });
    const dev = await createPosition({
      title: 'Developer',
      reportsTo: cto.id,
    });

    const hierarchy = await caller.positions.getHierarchy(ceo.id);

    expect(hierarchy).toEqual({
      id: ceo.id,
      title: 'CEO',
      reports: [
        {
          id: cto.id,
          title: 'CTO',
          reports: [
            { id: dev.id, title: 'Developer', reports: [] }
          ]
        }
      ]
    });
  });

  it('should prevent circular reporting', async () => {
    const posA = await createPosition({ title: 'Position A' });
    const posB = await createPosition({ title: 'Position B', reportsTo: posA.id });

    await expect(
      caller.positions.update({
        id: posA.id,
        reportsTo: posB.id, // Creates cycle: A → B → A
      })
    ).rejects.toThrow('Hiérarchie circulaire détectée');
  });
});
```

---

### FEATURE 3: Employee-Position Assignments (Binding)

#### Story 3.1: Assign Employee to Position
**As a** HR manager
**I want** to assign an employee to a position
**So that** their role and responsibilities are clear

**Acceptance Criteria:**
- [ ] Create assignment with effective_from date
- [ ] Validate position exists and has available headcount
- [ ] Validate employee not already assigned (primary)
- [ ] Support assignment types (primary, secondary, temporary)
- [ ] Track assignment reason (hire, promotion, transfer, demotion)
- [ ] Effective-dated for history
- [ ] Emit event: `employee.assigned`

**Test Cases:**
```typescript
describe('Employee Assignments', () => {
  it('should assign employee to position', async () => {
    const emp = await createTestEmployee();
    const pos = await createPosition({ headcount: 5 });

    const assignment = await caller.assignments.create({
      employeeId: emp.id,
      positionId: pos.id,
      effectiveFrom: new Date('2025-02-01'),
      assignmentType: 'primary',
      assignmentReason: 'promotion',
    });

    expect(assignment.employee_id).toBe(emp.id);
    expect(assignment.position_id).toBe(pos.id);
    expect(assignment.effective_from).toEqual(new Date('2025-02-01'));
  });

  it('should prevent overlapping primary assignments', async () => {
    const emp = await createTestEmployee();
    const pos1 = await createPosition();
    const pos2 = await createPosition();

    await caller.assignments.create({
      employeeId: emp.id,
      positionId: pos1.id,
      effectiveFrom: new Date('2025-01-01'),
      assignmentType: 'primary',
    });

    await expect(
      caller.assignments.create({
        employeeId: emp.id,
        positionId: pos2.id,
        effectiveFrom: new Date('2025-01-15'), // Overlaps
        assignmentType: 'primary',
      })
    ).rejects.toThrow('L\'employé a déjà une affectation principale pour cette période');
  });

  it('should allow secondary assignments', async () => {
    const emp = await createTestEmployee();
    const primary = await createPosition({ title: 'Primary' });
    const secondary = await createPosition({ title: 'Secondary' });

    await caller.assignments.create({
      employeeId: emp.id,
      positionId: primary.id,
      assignmentType: 'primary',
    });

    const secondaryAssignment = await caller.assignments.create({
      employeeId: emp.id,
      positionId: secondary.id,
      assignmentType: 'secondary',
    });

    expect(secondaryAssignment).toBeDefined();
  });

  it('should validate position headcount availability', async () => {
    const pos = await createPosition({ headcount: 1 });
    const emp1 = await createTestEmployee();
    const emp2 = await createTestEmployee();

    // First assignment OK
    await caller.assignments.create({
      employeeId: emp1.id,
      positionId: pos.id,
    });

    // Second assignment exceeds headcount
    await expect(
      caller.assignments.create({
        employeeId: emp2.id,
        positionId: pos.id,
      })
    ).rejects.toThrow('Effectif complet pour ce poste (1/1)');
  });
});
```

#### Story 3.2: Transfer Employee (Change Position)
**As a** HR manager
**I want** to transfer an employee to a different position
**So that** org changes are tracked with history

**Acceptance Criteria:**
- [ ] End current assignment (set effective_to)
- [ ] Create new assignment (with new effective_from)
- [ ] Validate no gap between assignments
- [ ] Allow future-dated transfers
- [ ] Create audit log
- [ ] Emit event: `employee.transferred`
- [ ] Optionally change salary with transfer

**Test Cases:**
```typescript
describe('Employee Transfer', () => {
  it('should transfer employee to new position', async () => {
    const emp = await createTestEmployee();
    const oldPos = await createPosition({ title: 'Old Position' });
    const newPos = await createPosition({ title: 'New Position' });

    // Initial assignment
    await caller.assignments.create({
      employeeId: emp.id,
      positionId: oldPos.id,
      effectiveFrom: new Date('2025-01-01'),
    });

    // Transfer
    await caller.employees.transfer({
      employeeId: emp.id,
      newPositionId: newPos.id,
      effectiveFrom: new Date('2025-02-01'),
      reason: 'promotion',
    });

    // Check old assignment ended
    const oldAssignment = await db.query.assignments.findFirst({
      where: and(
        eq(assignments.employee_id, emp.id),
        eq(assignments.position_id, oldPos.id)
      ),
    });
    expect(oldAssignment.effective_to).toEqual(new Date('2025-02-01'));

    // Check new assignment created
    const newAssignment = await db.query.assignments.findFirst({
      where: and(
        eq(assignments.employee_id, emp.id),
        eq(assignments.position_id, newPos.id)
      ),
    });
    expect(newAssignment.effective_from).toEqual(new Date('2025-02-01'));
    expect(newAssignment.effective_to).toBeNull();
  });

  it('should allow future-dated transfer', async () => {
    const emp = await createTestEmployee();
    const currentPos = await createPosition({ title: 'Current' });
    const futurePos = await createPosition({ title: 'Future' });

    await caller.assignments.create({
      employeeId: emp.id,
      positionId: currentPos.id,
      effectiveFrom: new Date('2025-01-01'),
    });

    // Schedule transfer for future
    await caller.employees.transfer({
      employeeId: emp.id,
      newPositionId: futurePos.id,
      effectiveFrom: new Date('2025-06-01'), // Future date
      reason: 'promotion',
    });

    // Current position still active today
    const current = await getCurrentAssignment(emp.id, new Date('2025-02-01'));
    expect(current.position_id).toBe(currentPos.id);

    // Future position active on transfer date
    const future = await getCurrentAssignment(emp.id, new Date('2025-06-01'));
    expect(future.position_id).toBe(futurePos.id);
  });
});
```

---

### FEATURE 4: Employee Lifecycle Management

#### Story 4.1: Terminate Employee
**As a** HR manager
**I want** to terminate an employee
**So that** they are removed from active payroll

**Acceptance Criteria:**
- [ ] Set termination_date on employee
- [ ] Set status to 'terminated'
- [ ] End all active assignments (effective_to = termination_date)
- [ ] Keep salary history (effective-dated)
- [ ] Calculate final pay (prorated salary, unused leave)
- [ ] Emit event: `employee.terminated`
- [ ] Prevent termination if date < hire_date
- [ ] Store termination reason

**Test Cases:**
```typescript
describe('Terminate Employee', () => {
  it('should terminate employee', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2024-01-01'),
    });

    const result = await caller.employees.terminate({
      employeeId: emp.id,
      terminationDate: new Date('2025-01-31'),
      reason: 'resignation',
    });

    expect(result.status).toBe('terminated');
    expect(result.termination_date).toEqual(new Date('2025-01-31'));
    expect(result.termination_reason).toBe('resignation');
  });

  it('should end all active assignments', async () => {
    const emp = await createTestEmployee();
    const pos = await createPosition();

    await caller.assignments.create({
      employeeId: emp.id,
      positionId: pos.id,
      effectiveFrom: new Date('2024-01-01'),
    });

    await caller.employees.terminate({
      employeeId: emp.id,
      terminationDate: new Date('2025-01-31'),
      reason: 'resignation',
    });

    const assignment = await db.query.assignments.findFirst({
      where: and(
        eq(assignments.employee_id, emp.id),
        eq(assignments.position_id, pos.id)
      ),
    });

    expect(assignment.effective_to).toEqual(new Date('2025-01-31'));
  });

  it('should prevent termination before hire date', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2025-02-01'),
    });

    await expect(
      caller.employees.terminate({
        employeeId: emp.id,
        terminationDate: new Date('2025-01-15'), // Before hire
        reason: 'error',
      })
    ).rejects.toThrow('Date de départ antérieure à la date d\'embauche');
  });

  it('should calculate final pay', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2024-01-01'),
      baseSalary: 300000,
    });

    const finalPay = await caller.employees.terminate({
      employeeId: emp.id,
      terminationDate: new Date('2025-01-15'), // Mid-month
      reason: 'resignation',
    });

    // Prorated salary: 300,000 × (15/31) = 145,161
    expect(finalPay.proratedSalary).toBeCloseTo(145161, 0);
    expect(finalPay.daysWorked).toBe(15);
  });

  it('should emit employee.terminated event', async () => {
    const eventSpy = jest.spyOn(eventBus, 'publish');
    const emp = await createTestEmployee();

    await caller.employees.terminate({
      employeeId: emp.id,
      terminationDate: new Date('2025-01-31'),
      reason: 'resignation',
    });

    expect(eventSpy).toHaveBeenCalledWith('employee.terminated', {
      employeeId: emp.id,
      tenantId: emp.tenant_id,
      terminationDate: new Date('2025-01-31'),
      reason: 'resignation',
    });
  });
});
```

#### Story 4.2: Suspend Employee
**As a** HR manager
**I want** to temporarily suspend an employee
**So that** they are excluded from payroll without termination

**Acceptance Criteria:**
- [ ] Set status to 'suspended'
- [ ] Specify suspension start and end dates
- [ ] Keep assignments active (but flag as suspended)
- [ ] Exclude from payroll during suspension period
- [ ] Emit event: `employee.suspended`
- [ ] Allow reactivation

**Test Cases:**
```typescript
describe('Suspend Employee', () => {
  it('should suspend employee for period', async () => {
    const emp = await createTestEmployee();

    const result = await caller.employees.suspend({
      employeeId: emp.id,
      suspensionStart: new Date('2025-02-01'),
      suspensionEnd: new Date('2025-02-28'),
      reason: 'disciplinary',
    });

    expect(result.status).toBe('suspended');
  });

  it('should exclude from payroll during suspension', async () => {
    const emp = await createTestEmployee();

    await caller.employees.suspend({
      employeeId: emp.id,
      suspensionStart: new Date('2025-02-01'),
      suspensionEnd: new Date('2025-02-28'),
    });

    // Run payroll for February
    const payrollRun = await createPayrollRun({
      periodStart: new Date('2025-02-01'),
      periodEnd: new Date('2025-02-28'),
    });

    const lineItems = await db.query.payroll_line_items.findMany({
      where: eq(payroll_line_items.payroll_run_id, payrollRun.id),
    });

    expect(lineItems.find(item => item.employee_id === emp.id)).toBeUndefined();
  });

  it('should allow reactivation', async () => {
    const emp = await createTestEmployee();

    await caller.employees.suspend({
      employeeId: emp.id,
      suspensionStart: new Date('2025-02-01'),
      suspensionEnd: new Date('2025-02-28'),
    });

    const reactivated = await caller.employees.reactivate({
      employeeId: emp.id,
      effectiveDate: new Date('2025-03-01'),
    });

    expect(reactivated.status).toBe('active');
  });
});
```

---

### FEATURE 5: Salary Management (Effective-Dated)

#### Story 5.1: Change Employee Salary
**As a** HR manager
**I want** to change an employee's salary
**So that** raises and adjustments are tracked with history

**Acceptance Criteria:**
- [ ] End current salary record (set effective_to)
- [ ] Create new salary record (with new effective_from)
- [ ] Validate new salary >= SMIG
- [ ] Prevent gaps in salary history
- [ ] Allow future-dated changes
- [ ] Track change reason (promotion, adjustment, cost_of_living)
- [ ] Emit event: `employee.salary_changed`
- [ ] Create audit log

**Test Cases:**
```typescript
describe('Change Salary', () => {
  it('should change salary with history preservation', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2024-01-01'),
      baseSalary: 200000,
    });

    await caller.employees.changeSalary({
      employeeId: emp.id,
      newBaseSalary: 300000,
      effectiveFrom: new Date('2025-02-01'),
      reason: 'promotion',
    });

    const salaryHistory = await db.query.employee_salaries.findMany({
      where: eq(employee_salaries.employee_id, emp.id),
      orderBy: desc(employee_salaries.effective_from),
    });

    expect(salaryHistory).toHaveLength(2);

    // New salary
    expect(salaryHistory[0].base_salary).toBe(300000);
    expect(salaryHistory[0].effective_from).toEqual(new Date('2025-02-01'));
    expect(salaryHistory[0].effective_to).toBeNull();

    // Old salary
    expect(salaryHistory[1].base_salary).toBe(200000);
    expect(salaryHistory[1].effective_from).toEqual(new Date('2024-01-01'));
    expect(salaryHistory[1].effective_to).toEqual(new Date('2025-02-01'));
  });

  it('should validate minimum wage', async () => {
    const emp = await createTestEmployee({ baseSalary: 200000 });

    await expect(
      caller.employees.changeSalary({
        employeeId: emp.id,
        newBaseSalary: 50000, // Below SMIG
        effectiveFrom: new Date('2025-02-01'),
        reason: 'adjustment',
      })
    ).rejects.toThrow('Le salaire doit être >= SMIG (75000 FCFA)');
  });

  it('should allow future-dated salary change', async () => {
    const emp = await createTestEmployee({
      hireDate: new Date('2024-01-01'),
      baseSalary: 200000,
    });

    await caller.employees.changeSalary({
      employeeId: emp.id,
      newBaseSalary: 300000,
      effectiveFrom: new Date('2025-06-01'), // Future
      reason: 'scheduled_raise',
    });

    // Current salary (as of today)
    const current = await getCurrentSalary(emp.id, new Date('2025-02-01'));
    expect(current.base_salary).toBe(200000);

    // Future salary (as of June)
    const future = await getCurrentSalary(emp.id, new Date('2025-06-01'));
    expect(future.base_salary).toBe(300000);
  });

  it('should track change reason', async () => {
    const emp = await createTestEmployee({ baseSalary: 200000 });

    await caller.employees.changeSalary({
      employeeId: emp.id,
      newBaseSalary: 250000,
      effectiveFrom: new Date('2025-02-01'),
      reason: 'cost_of_living',
    });

    const salary = await db.query.employee_salaries.findFirst({
      where: and(
        eq(employee_salaries.employee_id, emp.id),
        isNull(employee_salaries.effective_to)
      ),
    });

    expect(salary.change_reason).toBe('cost_of_living');
  });
});
```

---

## Implementation Phases

### Phase 1: Core CRUD (Week 1)
- [ ] Story 1.1: Create employee
- [ ] Story 1.2: List employees
- [ ] Story 1.3: Get employee details
- [ ] Story 1.4: Update employee
- [ ] Employee number generation
- [ ] PII encryption
- [ ] RLS enforcement

**Deliverable:** Basic employee management via tRPC API

### Phase 2: Positions & Assignments (Week 2)
- [ ] Story 2.1: Create positions
- [ ] Story 2.2: Organizational hierarchy
- [ ] Story 3.1: Employee assignments
- [ ] Story 3.2: Employee transfers
- [ ] Headcount validation

**Deliverable:** Position management with assignment binding

### Phase 3: Lifecycle & Salary (Week 3)
- [ ] Story 4.1: Terminate employee
- [ ] Story 4.2: Suspend employee
- [ ] Story 5.1: Change salary
- [ ] Final pay calculations
- [ ] Event emissions

**Deliverable:** Complete employee lifecycle management

---

## Acceptance Testing Checklist

Before marking this epic complete:

- [ ] All CRUD operations enforce RLS
- [ ] PII fields encrypted at rest
- [ ] Effective dating works for salaries and assignments
- [ ] No data loss when changing salaries/positions
- [ ] Audit logs capture all changes
- [ ] Events emitted for downstream systems
- [ ] French error messages
- [ ] Validation prevents data integrity issues
- [ ] Can retrieve historical data (salary as of date X)
- [ ] Performance: List 1000 employees < 500ms

---

**Next:** Read `07-EPIC-TIME-AND-ATTENDANCE.md`
