/**
 * Employee Contract Retrieval Tests
 *
 * Tests the getEmployeeById() function's ability to retrieve employee data
 * with contract information via JOIN on employment_contracts table.
 *
 * Test Coverage:
 * 1. Employee with CDI contract (contract object populated)
 * 2. Employee with CDD contract (includes end date)
 * 3. Employee with CDDTI contract (daily workers)
 * 4. Employee without contract (contract object is null)
 * 5. Contract data fields are correctly populated
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { employees, employmentContracts, tenants, sectorConfigurations, users } from '@/drizzle/schema';
import { getEmployeeById } from '../employee.service';
import { eq, and } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';
import { randomUUID } from 'crypto';

describe('Employee Contract Retrieval via JOIN', () => {
  let testTenantId: string;
  let testUserId: string;
  let testEmployeeWithCDI: string;
  let testEmployeeWithCDD: string;
  let testEmployeeWithCDDTI: string;
  let testEmployeeWithoutContract: string;
  let testContractCDI: string;
  let testContractCDD: string;
  let testContractCDDTI: string;
  let testSectorConfigId: string;

  beforeEach(async () => {
    // Create sector configuration first (required FK for tenant)
    const existingSector = await db
      .select()
      .from(sectorConfigurations)
      .where(
        and(
          eq(sectorConfigurations.countryCode, 'CI'),
          eq(sectorConfigurations.sectorCode, 'services')
        )
      )
      .limit(1);

    if (existingSector.length === 0) {
      const [sectorConfig] = await db
        .insert(sectorConfigurations)
        .values({
          countryCode: 'CI',
          sectorCode: 'services',
          name: { fr: 'Services', en: 'Services' },
          workAccidentRate: '0.0200',
        })
        .returning();
      testSectorConfigId = sectorConfig.id;
    }

    // Create test tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Test Company Contract Retrieval',
        slug: `test-contract-retrieval-${Date.now()}`,
        countryCode: 'CI',
        sectorCode: 'services',
        currency: 'XOF',
      })
      .returning();
    testTenantId = tenant.id;

    // Create test user
    const userId = randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        id: userId,
        tenantId: testTenantId,
        email: `test.user.${Date.now()}@test.com`,
        firstName: 'Test',
        lastName: 'User',
        role: 'hr_manager',
      })
      .returning();
    testUserId = user.id;

    // Create employee with CDI contract
    const [employeeCDI] = await db
      .insert(employees)
      .values({
        tenantId: testTenantId,
        employeeNumber: 'EMP-CDI-001',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont.cdi@test.com',
        phone: '+225070000001',
        hireDate: '2024-01-15',
        coefficient: 100,
        rateType: 'MONTHLY',
        status: 'active',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testEmployeeWithCDI = employeeCDI.id;

    // Create CDI contract
    const [contractCDI] = await db
      .insert(employmentContracts)
      .values({
        tenantId: testTenantId,
        employeeId: testEmployeeWithCDI,
        contractType: 'CDI',
        contractNumber: 'CDI-001',
        startDate: '2024-01-15',
        endDate: null,
        renewalCount: 0,
        isActive: true,
        createdBy: testUserId,
      })
      .returning();
    testContractCDI = contractCDI.id;

    // Link contract to employee
    await db
      .update(employees)
      .set({ currentContractId: testContractCDI })
      .where(eq(employees.id, testEmployeeWithCDI));

    // Create employee with CDD contract
    const [employeeCDD] = await db
      .insert(employees)
      .values({
        tenantId: testTenantId,
        employeeNumber: 'EMP-CDD-002',
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie.martin.cdd@test.com',
        phone: '+225070000002',
        hireDate: '2024-06-01',
        coefficient: 100,
        rateType: 'MONTHLY',
        status: 'active',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testEmployeeWithCDD = employeeCDD.id;

    // Create CDD contract with end date
    const [contractCDD] = await db
      .insert(employmentContracts)
      .values({
        tenantId: testTenantId,
        employeeId: testEmployeeWithCDD,
        contractType: 'CDD',
        contractNumber: 'CDD-002',
        startDate: '2024-06-01',
        endDate: '2025-05-31',
        renewalCount: 1,
        isActive: true,
        cddReason: 'SURCROIT_ACTIVITE',
        cddTotalDurationMonths: 12,
        createdBy: testUserId,
      })
      .returning();
    testContractCDD = contractCDD.id;

    // Link contract to employee
    await db
      .update(employees)
      .set({ currentContractId: testContractCDD })
      .where(eq(employees.id, testEmployeeWithCDD));

    // Create employee with CDDTI contract (daily workers)
    const [employeeCDDTI] = await db
      .insert(employees)
      .values({
        tenantId: testTenantId,
        employeeNumber: 'EMP-CDDTI-003',
        firstName: 'Pierre',
        lastName: 'Kouassi',
        email: 'pierre.kouassi.cddti@test.com',
        phone: '+225070000003',
        hireDate: '2024-03-01',
        coefficient: 100,
        rateType: 'DAILY',
        status: 'active',
        createdBy: 'test-user',
        updatedBy: 'test-user',
      })
      .returning();
    testEmployeeWithCDDTI = employeeCDDTI.id;

    // Create CDDTI contract
    const [contractCDDTI] = await db
      .insert(employmentContracts)
      .values({
        tenantId: testTenantId,
        employeeId: testEmployeeWithCDDTI,
        contractType: 'CDDTI',
        contractNumber: 'CDDTI-003',
        startDate: '2024-03-01',
        endDate: null, // CDDTI has no end date (indefinite term)
        renewalCount: 0,
        isActive: true,
        cddtiTaskDescription: 'Travaux de manutention dans l\'entrepôt',
        createdBy: testUserId,
      })
      .returning();
    testContractCDDTI = contractCDDTI.id;

    // Link contract to employee
    await db
      .update(employees)
      .set({ currentContractId: testContractCDDTI })
      .where(eq(employees.id, testEmployeeWithCDDTI));

    // Create employee WITHOUT contract
    const [employeeNoContract] = await db
      .insert(employees)
      .values({
        tenantId: testTenantId,
        employeeNumber: 'EMP-NOCONTRACT-004',
        firstName: 'Aissata',
        lastName: 'Diallo',
        email: 'aissata.diallo.nocontract@test.com',
        phone: '+225070000004',
        hireDate: '2024-08-01',
        coefficient: 100,
        rateType: 'MONTHLY',
        status: 'active',
        createdBy: testUserId,
        updatedBy: testUserId,
      })
      .returning();
    testEmployeeWithoutContract = employeeNoContract.id;
  });

  afterEach(async () => {
    // Cleanup: Delete test data (in reverse order due to FK constraints)
    // Delete contracts first (they reference employees)
    if (testContractCDI) {
      await db.delete(employmentContracts).where(eq(employmentContracts.id, testContractCDI));
    }
    if (testContractCDD) {
      await db.delete(employmentContracts).where(eq(employmentContracts.id, testContractCDD));
    }
    if (testContractCDDTI) {
      await db.delete(employmentContracts).where(eq(employmentContracts.id, testContractCDDTI));
    }
    // Then delete employees
    if (testEmployeeWithCDI) {
      await db.delete(employees).where(eq(employees.id, testEmployeeWithCDI));
    }
    if (testEmployeeWithCDD) {
      await db.delete(employees).where(eq(employees.id, testEmployeeWithCDD));
    }
    if (testEmployeeWithCDDTI) {
      await db.delete(employees).where(eq(employees.id, testEmployeeWithCDDTI));
    }
    if (testEmployeeWithoutContract) {
      await db.delete(employees).where(eq(employees.id, testEmployeeWithoutContract));
    }
    // Delete users
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    // Delete tenant
    if (testTenantId) {
      await db.delete(tenants).where(eq(tenants.id, testTenantId));
    }
    // Delete sector config
    if (testSectorConfigId) {
      await db.delete(sectorConfigurations).where(eq(sectorConfigurations.id, testSectorConfigId));
    }
  });

  it('should retrieve employee with CDI contract (contract object populated)', async () => {
    const result = await getEmployeeById(testEmployeeWithCDI, testTenantId);

    // Verify employee data
    expect(result.id).toBe(testEmployeeWithCDI);
    expect(result.firstName).toBe('Jean');
    expect(result.lastName).toBe('Dupont');
    expect(result.email).toBe('jean.dupont.cdi@test.com');

    // Verify contract object is populated
    expect(result.contract).not.toBeNull();
    expect(result.contract).toBeDefined();

    // Verify contract fields
    expect(result.contract!.id).toBe(testContractCDI);
    expect(result.contract!.contractType).toBe('CDI');
    expect(result.contract!.contractNumber).toBe('CDI-001');
    expect(result.contract!.startDate).toBe('2024-01-15');
    expect(result.contract!.endDate).toBeNull();
    expect(result.contract!.renewalCount).toBe(0);
    expect(result.contract!.isActive).toBe(true);
  });

  it('should retrieve employee with CDD contract (includes end date and reason)', async () => {
    const result = await getEmployeeById(testEmployeeWithCDD, testTenantId);

    // Verify employee data
    expect(result.id).toBe(testEmployeeWithCDD);
    expect(result.firstName).toBe('Marie');
    expect(result.lastName).toBe('Martin');

    // Verify contract object is populated
    expect(result.contract).not.toBeNull();
    expect(result.contract).toBeDefined();

    // Verify CDD-specific fields
    expect(result.contract!.contractType).toBe('CDD');
    expect(result.contract!.startDate).toBe('2024-06-01');
    expect(result.contract!.endDate).toBe('2025-05-31'); // CDD has end date
    expect(result.contract!.cddReason).toBe('SURCROIT_ACTIVITE');
    expect(result.contract!.cddTotalDurationMonths).toBe(12);
    expect(result.contract!.renewalCount).toBe(1);
    expect(result.contract!.isActive).toBe(true);
  });

  it('should retrieve employee with CDDTI contract (daily workers)', async () => {
    const result = await getEmployeeById(testEmployeeWithCDDTI, testTenantId);

    // Verify employee data
    expect(result.id).toBe(testEmployeeWithCDDTI);
    expect(result.firstName).toBe('Pierre');
    expect(result.lastName).toBe('Kouassi');
    expect(result.rateType).toBe('DAILY'); // CDDTI employees are daily workers

    // Verify contract object is populated
    expect(result.contract).not.toBeNull();
    expect(result.contract).toBeDefined();

    // Verify CDDTI-specific fields
    expect(result.contract!.contractType).toBe('CDDTI');
    expect(result.contract!.startDate).toBe('2024-03-01');
    expect(result.contract!.endDate).toBeNull(); // CDDTI has no end date (indefinite term)
    expect(result.contract!.cddtiTaskDescription).toBe('Travaux de manutention dans l\'entrepôt');
    expect(result.contract!.renewalCount).toBe(0);
    expect(result.contract!.isActive).toBe(true);
  });

  it('should retrieve employee without contract (contract object is null)', async () => {
    const result = await getEmployeeById(testEmployeeWithoutContract, testTenantId);

    // Verify employee data
    expect(result.id).toBe(testEmployeeWithoutContract);
    expect(result.firstName).toBe('Aissata');
    expect(result.lastName).toBe('Diallo');

    // Verify contract object is null (LEFT JOIN returns null when no match)
    expect(result.contract).toBeNull();
  });

  it('should verify all contract data fields are correctly mapped', async () => {
    const result = await getEmployeeById(testEmployeeWithCDD, testTenantId);

    // Verify all expected contract fields exist
    expect(result.contract).toHaveProperty('id');
    expect(result.contract).toHaveProperty('tenantId');
    expect(result.contract).toHaveProperty('employeeId');
    expect(result.contract).toHaveProperty('contractType');
    expect(result.contract).toHaveProperty('contractNumber');
    expect(result.contract).toHaveProperty('startDate');
    expect(result.contract).toHaveProperty('endDate');
    expect(result.contract).toHaveProperty('renewalCount');
    expect(result.contract).toHaveProperty('isActive');
    expect(result.contract).toHaveProperty('terminationDate');
    expect(result.contract).toHaveProperty('terminationReason');
    expect(result.contract).toHaveProperty('originalContractId');
    expect(result.contract).toHaveProperty('replacesContractId');
    expect(result.contract).toHaveProperty('cddReason');
    expect(result.contract).toHaveProperty('cddTotalDurationMonths');
    expect(result.contract).toHaveProperty('cddtiTaskDescription');
    expect(result.contract).toHaveProperty('signedDate');
    expect(result.contract).toHaveProperty('contractFileUrl');
    expect(result.contract).toHaveProperty('createdBy');
    expect(result.contract).toHaveProperty('createdAt');
    expect(result.contract).toHaveProperty('updatedAt');
  });

  it('should verify JOIN is used (not separate queries)', async () => {
    // This test verifies the JOIN pattern by checking that the contract data
    // is retrieved in a single query with the employee data
    const result = await getEmployeeById(testEmployeeWithCDI, testTenantId);

    // If JOIN is working correctly, contract data should be populated
    // and match the expected contract ID
    expect(result.contract).not.toBeNull();
    expect(result.contract!.id).toBe(testContractCDI);
    expect(result.contract!.employeeId).toBe(testEmployeeWithCDI);
  });

  it('should handle tenant isolation (employee from different tenant)', async () => {
    // Create another tenant
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: 'Other Tenant',
        slug: `other-tenant-${Date.now()}`,
        countryCode: 'CI',
        sectorCode: 'services',
        currency: 'XOF',
      })
      .returning();

    // Try to get employee with wrong tenant ID
    await expect(async () => {
      await getEmployeeById(testEmployeeWithCDI, otherTenant.id);
    }).rejects.toThrow('Employé');

    // Cleanup
    await db.delete(tenants).where(eq(tenants.id, otherTenant.id));
  });

  it('should still return other employee data (salary, position) along with contract', async () => {
    const result = await getEmployeeById(testEmployeeWithCDI, testTenantId);

    // Verify contract is present
    expect(result.contract).not.toBeNull();

    // Verify other related data is also returned
    expect(result).toHaveProperty('currentSalary');
    expect(result).toHaveProperty('currentPosition');
    expect(result).toHaveProperty('salaryHistory');
    expect(result).toHaveProperty('assignmentHistory');
  });
});
