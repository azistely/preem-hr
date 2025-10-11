/**
 * Alert Engine Tests
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Tests for proactive alert creation:
 * - Contract expiry alerts
 * - Leave notifications
 * - Document expiry warnings
 * - Payroll reminders
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import {
  createContractExpiryAlerts,
  createLeaveNotifications,
  createDocumentExpiryAlerts,
  createPayrollReminders,
  cleanupOldAlerts,
  generateDailyAlerts,
} from '../alert-engine';
import { alerts, assignments, employees, users } from '@/lib/db/schema';
import { addDays, subDays } from 'date-fns';

// Mock database queries
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      assignments: {
        findMany: vi.fn(),
      },
      alerts: {
        findFirst: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      employees: {
        findMany: vi.fn(),
      },
      tenants: {
        findMany: vi.fn(),
      },
      payrollRuns: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
        innerJoin: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({ count: 5 }),
    })),
  },
}));

describe('Alert Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createContractExpiryAlerts', () => {
    it('should create urgent alert for contract expiring in 7 days', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      // Mock expiring contract with manual select pattern
      const mockContract = {
        id: 'contract-1',
        employeeId: 'emp-1',
        effectiveTo: in7Days.toISOString().split('T')[0],
        assignmentType: 'primary',
        tenantId: 'tenant-1',
        employeeFirstName: 'John',
        employeeLastName: 'Doe',
        employeeStatus: 'active',
        employeeTerminationDate: null,
        employeeTenantId: 'tenant-1',
      };

      // Mock db.select().from().innerJoin().where()
      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([mockContract]),
          })),
        })),
      }));

      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(1);
      expect(result.contractsChecked).toBe(1);
      expect(db.insert).toHaveBeenCalledWith(alerts);
    });

    it('should create warning alert for contract expiring in 15 days', async () => {
      const today = new Date();
      const in15Days = addDays(today, 15);

      const mockContract = {
        id: 'contract-2',
        employeeId: 'emp-2',
        positionId: 'pos-2',
        tenantId: 'tenant-1',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in15Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-2',
          firstName: 'Jane',
          lastName: 'Smith',
          tenantId: 'tenant-1',
          status: 'active',
          terminationDate: null,
        },
      };

      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);
      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(1);
    });

    it('should create info alert for contract expiring in 30 days', async () => {
      const today = new Date();
      const in30Days = addDays(today, 30);

      const mockContract = {
        id: 'contract-3',
        employeeId: 'emp-3',
        positionId: 'pos-3',
        tenantId: 'tenant-1',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in30Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-3',
          firstName: 'Bob',
          lastName: 'Johnson',
          tenantId: 'tenant-1',
          status: 'active',
          terminationDate: null,
        },
      };

      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);
      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(1);
    });

    it('should skip inactive employees', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockContract = {
        id: 'contract-4',
        employeeId: 'emp-4',
        positionId: 'pos-4',
        tenantId: 'tenant-1',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in7Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-4',
          firstName: 'Inactive',
          lastName: 'User',
          tenantId: 'tenant-1',
          status: 'terminated',
          terminationDate: '2024-12-31',
        },
      };

      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should skip employees with termination date', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockContract = {
        id: 'contract-5',
        employeeId: 'emp-5',
        positionId: 'pos-5',
        tenantId: 'tenant-1',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in7Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-5',
          firstName: 'Terminating',
          lastName: 'Employee',
          tenantId: 'tenant-1',
          status: 'active',
          terminationDate: '2025-02-01',
        },
      };

      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should update existing alert severity if changed', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockContract = {
        id: 'contract-6',
        employeeId: 'emp-6',
        positionId: 'pos-6',
        tenantId: 'tenant-1',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in7Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-6',
          firstName: 'Existing',
          lastName: 'Alert',
          tenantId: 'tenant-1',
          status: 'active',
          terminationDate: null,
        },
      };

      // Existing alert with warning severity (should be urgent now)
      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);
      vi.mocked(db.query.alerts.findFirst).mockResolvedValue({
        id: 'alert-1',
        type: 'contract_expiry',
        severity: 'warning',
        employeeId: 'emp-6',
        status: 'active',
      } as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0); // No new alert created
      expect(db.update).toHaveBeenCalledWith(alerts);
    });

    it('should skip if no HR manager found for tenant', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockContract = {
        id: 'contract-7',
        employeeId: 'emp-7',
        positionId: 'pos-7',
        tenantId: 'tenant-no-hr',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in7Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-7',
          firstName: 'No',
          lastName: 'Manager',
          tenantId: 'tenant-no-hr',
          status: 'active',
          terminationDate: null,
        },
      };

      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);
      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined); // No HR manager

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should handle multiple expiring contracts', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);
      const in15Days = addDays(today, 15);

      const mockContracts = [
        {
          id: 'contract-8',
          employeeId: 'emp-8',
          positionId: 'pos-8',
          tenantId: 'tenant-1',
          assignmentType: 'primary',
          effectiveFrom: '2024-01-01',
          effectiveTo: in7Days.toISOString().split('T')[0],
          employee: {
            id: 'emp-8',
            firstName: 'First',
            lastName: 'Employee',
            tenantId: 'tenant-1',
            status: 'active',
            terminationDate: null,
          },
        },
        {
          id: 'contract-9',
          employeeId: 'emp-9',
          positionId: 'pos-9',
          tenantId: 'tenant-1',
          assignmentType: 'primary',
          effectiveFrom: '2024-01-01',
          effectiveTo: in15Days.toISOString().split('T')[0],
          employee: {
            id: 'emp-9',
            firstName: 'Second',
            lastName: 'Employee',
            tenantId: 'tenant-1',
            status: 'active',
            terminationDate: null,
          },
        },
      ];

      vi.mocked(db.query.assignments.findMany).mockResolvedValue(mockContracts as any);
      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createContractExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(2);
      expect(result.contractsChecked).toBe(2);
    });
  });

  describe('createLeaveNotifications', () => {
    it('should return not implemented message', async () => {
      const result = await createLeaveNotifications();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0);
      expect(result.message).toContain('not yet implemented');
    });
  });

  describe('createDocumentExpiryAlerts', () => {
    beforeEach(() => {
      // Add db.select mock for document expiry alerts
      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      }));
    });

    it('should create alert for national ID expiring in 7 days', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockEmployee = {
        id: 'emp-1',
        tenantId: 'tenant-1',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
        nationalIdExpiry: in7Days.toISOString().split('T')[0],
        workPermitExpiry: null,
      };

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([mockEmployee]),
        })),
      }));

      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createDocumentExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(1);
      expect(db.insert).toHaveBeenCalledWith(alerts);
    });

    it('should create alert for work permit expiring in 15 days', async () => {
      const today = new Date();
      const in15Days = addDays(today, 15);

      const mockEmployee = {
        id: 'emp-2',
        tenantId: 'tenant-1',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active',
        nationalIdExpiry: null,
        workPermitExpiry: in15Days.toISOString().split('T')[0],
      };

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([mockEmployee]),
        })),
      }));

      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createDocumentExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(1);
    });

    it('should create alerts for both expiring documents', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);
      const in15Days = addDays(today, 15);

      const mockEmployee = {
        id: 'emp-3',
        tenantId: 'tenant-1',
        firstName: 'Bob',
        lastName: 'Johnson',
        status: 'active',
        nationalIdExpiry: in7Days.toISOString().split('T')[0],
        workPermitExpiry: in15Days.toISOString().split('T')[0],
      };

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([mockEmployee]),
        })),
      }));

      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await createDocumentExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(2); // One for each document
    });

    it('should update existing alert severity if changed', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockEmployee = {
        id: 'emp-4',
        tenantId: 'tenant-1',
        firstName: 'Existing',
        lastName: 'Alert',
        status: 'active',
        nationalIdExpiry: in7Days.toISOString().split('T')[0],
        workPermitExpiry: null,
      };

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([mockEmployee]),
        })),
      }));

      vi.mocked(db.query.alerts.findFirst).mockResolvedValue({
        id: 'alert-1',
        type: 'document_expiry',
        severity: 'warning',
        employeeId: 'emp-4',
        status: 'active',
      } as any);

      const result = await createDocumentExpiryAlerts();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0);
      expect(db.update).toHaveBeenCalledWith(alerts);
    });
  });

  describe('createPayrollReminders', () => {
    it('should return not implemented message', async () => {
      const result = await createPayrollReminders();

      expect(result.success).toBe(true);
      expect(result.alertsCreated).toBe(0);
      expect(result.message).toContain('not yet implemented');
    });
  });

  describe('cleanupOldAlerts', () => {
    it('should delete old dismissed/completed alerts', async () => {
      const result = await cleanupOldAlerts(90);

      expect(result.success).toBe(true);
      expect(result.message).toContain('90 days');
      expect(db.delete).toHaveBeenCalledWith(alerts);
    });

    it('should use default 90 days if not specified', async () => {
      const result = await cleanupOldAlerts();

      expect(result.success).toBe(true);
      expect(result.message).toContain('90 days');
    });
  });

  describe('generateDailyAlerts', () => {
    it('should run all alert generation functions', async () => {
      // Mock all functions to succeed
      vi.mocked(db.query.assignments.findMany).mockResolvedValue([]);

      const result = await generateDailyAlerts();

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.contractExpiry).toBeDefined();
      expect(result.summary.leaveNotifications).toBeDefined();
      expect(result.summary.documentExpiry).toBeDefined();
      expect(result.summary.payrollReminders).toBeDefined();
      expect(result.summary.totalAlerts).toBe(0);
    });

    it('should handle errors gracefully with Promise.allSettled', async () => {
      // Mock one function to fail
      vi.mocked(db.query.assignments.findMany).mockRejectedValue(
        new Error('Database error')
      );

      const result = await generateDailyAlerts();

      // Should still return success with summary showing 0 alerts for failed tasks
      expect(result.success).toBe(true);
      expect(result.summary.contractExpiry).toEqual({ alertsCreated: 0 });
    });

    it('should calculate total alerts correctly', async () => {
      const today = new Date();
      const in7Days = addDays(today, 7);

      const mockContract = {
        id: 'contract-10',
        employeeId: 'emp-10',
        positionId: 'pos-10',
        tenantId: 'tenant-1',
        assignmentType: 'primary',
        effectiveFrom: '2024-01-01',
        effectiveTo: in7Days.toISOString().split('T')[0],
        employee: {
          id: 'emp-10',
          firstName: 'Total',
          lastName: 'Test',
          tenantId: 'tenant-1',
          status: 'active',
          terminationDate: null,
        },
      };

      vi.mocked(db.query.assignments.findMany).mockResolvedValue([mockContract] as any);
      vi.mocked(db.query.alerts.findFirst).mockResolvedValue(undefined);
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: 'hr-1',
        tenantId: 'tenant-1',
        role: 'hr_manager',
      } as any);

      const result = await generateDailyAlerts();

      expect(result.success).toBe(true);
      expect(result.summary.totalAlerts).toBe(1);
    });
  });
});
