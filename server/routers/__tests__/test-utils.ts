/**
 * Test utilities for tRPC router integration tests
 * Provides helper functions for setting up test context and database
 */

import { db } from '@/lib/db';
import { tenants, users, employees, assignments } from '@/lib/db/schema';
import { alerts, batchOperations } from '@/lib/db/schema/automation';
import { eq, inArray } from 'drizzle-orm';
import { addDays } from 'date-fns';

/**
 * Test tenant data
 */
export const testTenant = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Tenant',
  slug: 'test-tenant',
  countryCode: 'CI',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
  plan: 'trial' as const,
  features: [],
  settings: {},
  status: 'active' as const,
};

/**
 * Test users data
 */
export const testHRManager = {
  id: '00000000-0000-0000-0000-000000000010',
  tenantId: testTenant.id,
  email: 'hr@test.com',
  firstName: 'HR',
  lastName: 'Manager',
  role: 'hr_manager' as const,
  status: 'active' as const,
};

export const testEmployee = {
  id: '00000000-0000-0000-0000-000000000020',
  tenantId: testTenant.id,
  email: 'employee@test.com',
  firstName: 'Test',
  lastName: 'Employee',
  role: 'employee' as const,
  status: 'active' as const,
};

/**
 * Test employee record
 */
export const testEmployeeRecord = {
  id: '00000000-0000-0000-0000-000000000030',
  tenantId: testTenant.id,
  employeeNumber: 'EMP001',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@test.com',
  phone: '+2250700000000',
  dateOfBirth: '1990-01-01',
  gender: 'male' as const,
  nationalId: 'CI123456789',
  countryCode: 'CI',
  status: 'active' as const,
  hireDate: '2024-01-01',
  terminationDate: null,
  taxDependents: 0,
  coefficient: 100,
  customFields: {},
};

/**
 * Create test context for tRPC procedures
 */
export function createTestContext(user: typeof testHRManager | typeof testEmployee) {
  return {
    db,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      employeeId: user.id === testEmployee.id ? testEmployeeRecord.id : null,
    },
  };
}

/**
 * Seed test database with basic data
 */
export async function seedTestData() {
  // Create tenant
  await db.insert(tenants).values(testTenant).onConflictDoNothing();

  // Create users
  await db
    .insert(users)
    .values([testHRManager, testEmployee])
    .onConflictDoNothing();

  // Create employee record
  await db.insert(employees).values(testEmployeeRecord).onConflictDoNothing();
}

/**
 * Clean up test data
 */
export async function cleanupTestData() {
  // Delete in reverse order of dependencies
  await db.delete(alerts).where(eq(alerts.tenantId, testTenant.id));
  await db
    .delete(batchOperations)
    .where(eq(batchOperations.tenantId, testTenant.id));
  await db
    .delete(assignments)
    .where(eq(assignments.tenantId, testTenant.id));
  await db
    .delete(employees)
    .where(eq(employees.tenantId, testTenant.id));
  await db
    .delete(users)
    .where(
      inArray(users.id, [testHRManager.id, testEmployee.id])
    );
  await db.delete(tenants).where(eq(tenants.id, testTenant.id));
}

/**
 * Create test alert data
 */
export function createTestAlertData(overrides: Partial<any> = {}) {
  const today = new Date();
  return {
    tenantId: testTenant.id,
    type: 'contract_expiry',
    severity: 'urgent',
    message: 'Test alert message',
    assigneeId: testHRManager.id,
    employeeId: testEmployeeRecord.id,
    actionUrl: '/test-action',
    actionLabel: 'Test Action',
    dueDate: addDays(today, 7),
    status: 'active',
    metadata: {},
    ...overrides,
  };
}

/**
 * Create test batch operation data
 */
export function createTestBatchOperationData(overrides: Partial<any> = {}) {
  return {
    tenantId: testTenant.id,
    operationType: 'salary_update',
    entityType: 'employees',
    entityIds: [testEmployeeRecord.id],
    params: {
      updateType: 'percentage',
      value: 10,
      effectiveDate: new Date().toISOString(),
    },
    status: 'pending',
    totalCount: 1,
    processedCount: 0,
    successCount: 0,
    errorCount: 0,
    errors: [],
    startedBy: testHRManager.id,
    resultData: {},
    ...overrides,
  };
}

/**
 * Create test assignment/contract data
 */
export function createTestAssignmentData(overrides: Partial<any> = {}) {
  const today = new Date();
  return {
    tenantId: testTenant.id,
    employeeId: testEmployeeRecord.id,
    positionId: '00000000-0000-0000-0000-000000000040', // Mock position ID
    assignmentType: 'primary',
    effectiveFrom: '2024-01-01',
    effectiveTo: addDays(today, 7).toISOString().split('T')[0],
    isPrimary: true,
    status: 'active',
    ...overrides,
  };
}
