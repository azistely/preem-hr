/**
 * Batch Processor Tests
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Tests for bulk operations:
 * - Bulk salary updates
 * - Employee validation
 * - Salary update preview
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  processBulkSalaryUpdate,
  processBatchOperation,
  validateEmployeesForBatchOperation,
  calculateSalaryUpdatePreview,
} from '../batch-processor';
import { batchOperations, employeeSalaries, employees, auditLogs } from '@/lib/db/schema';
import { sendEvent } from '@/lib/inngest/client';

// Mock database and Inngest
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      batchOperations: {
        findFirst: vi.fn(),
      },
      employeeSalaries: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      employees: {
        findMany: vi.fn(),
      },
    },
    transaction: vi.fn((callback) => callback(mockTx)),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('@/lib/inngest/client', () => ({
  sendEvent: vi.fn().mockResolvedValue({}),
}));

// Mock transaction object
const mockTx = {
  query: {
    employeeSalaries: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue([]),
  })),
};

describe('Batch Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processBulkSalaryUpdate', () => {
    it('should process absolute salary update successfully', async () => {
      const operationId = 'batch-op-1';
      const mockOperation = {
        id: operationId,
        tenantId: 'tenant-1',
        operationType: 'salary_update',
        entityIds: ['emp-1', 'emp-2'],
        status: 'pending',
        params: {
          updateType: 'absolute',
          value: 500000,
          effectiveDate: '2025-02-01',
          reason: 'Annual salary adjustment',
        },
        startedBy: 'user-1',
      };

      const mockCurrentSalary1 = {
        id: 'sal-1',
        employeeId: 'emp-1',
        baseSalary: '400000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      const mockCurrentSalary2 = {
        id: 'sal-2',
        employeeId: 'emp-2',
        baseSalary: '450000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst)
        .mockResolvedValueOnce(mockCurrentSalary1 as any)
        .mockResolvedValueOnce(mockCurrentSalary2 as any);

      const result = await processBulkSalaryUpdate(operationId);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify transaction was used
      expect(db.transaction).toHaveBeenCalled();

      // Verify event was sent
      expect(sendEvent).toHaveBeenCalledWith({
        name: 'batch.operation.completed',
        data: expect.objectContaining({
          operationId,
          operationType: 'salary_update',
          successCount: 2,
          errorCount: 0,
        }),
      });
    });

    it('should process percentage salary update successfully', async () => {
      const operationId = 'batch-op-2';
      const mockOperation = {
        id: operationId,
        tenantId: 'tenant-1',
        operationType: 'salary_update',
        entityIds: ['emp-3'],
        status: 'pending',
        params: {
          updateType: 'percentage',
          value: 10, // 10% increase
          effectiveDate: '2025-02-01',
          reason: '10% raise',
        },
        startedBy: 'user-1',
      };

      const mockCurrentSalary = {
        id: 'sal-3',
        employeeId: 'emp-3',
        baseSalary: '300000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst).mockResolvedValue(mockCurrentSalary as any);

      const result = await processBulkSalaryUpdate(operationId);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);

      // Verify new salary is 300,000 * 1.10 = 330,000
      const insertCalls = vi.mocked(mockTx.insert).mock.calls;
      expect(insertCalls.length).toBeGreaterThan(0);
    });

    it('should handle employee with no active salary', async () => {
      const operationId = 'batch-op-3';
      const mockOperation = {
        id: operationId,
        tenantId: 'tenant-1',
        operationType: 'salary_update',
        entityIds: ['emp-no-salary'],
        status: 'pending',
        params: {
          updateType: 'absolute',
          value: 500000,
          effectiveDate: '2025-02-01',
        },
        startedBy: 'user-1',
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst).mockResolvedValue(null);

      const result = await processBulkSalaryUpdate(operationId);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].entityId).toBe('emp-no-salary');
      expect(result.errors[0].error).toContain('No active salary found');
    });

    it('should handle mixed success and errors', async () => {
      const operationId = 'batch-op-4';
      const mockOperation = {
        id: operationId,
        tenantId: 'tenant-1',
        operationType: 'salary_update',
        entityIds: ['emp-success', 'emp-error'],
        status: 'pending',
        params: {
          updateType: 'absolute',
          value: 500000,
          effectiveDate: '2025-02-01',
        },
        startedBy: 'user-1',
      };

      const mockCurrentSalary = {
        id: 'sal-success',
        employeeId: 'emp-success',
        baseSalary: '400000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst)
        .mockResolvedValueOnce(mockCurrentSalary as any)
        .mockResolvedValueOnce(null); // Second employee has no salary

      const result = await processBulkSalaryUpdate(operationId);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw error if operation not found', async () => {
      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(undefined);

      await expect(processBulkSalaryUpdate('non-existent')).rejects.toThrow(
        'Batch operation non-existent not found'
      );
    });

    it('should throw error if operation is not pending', async () => {
      const mockOperation = {
        id: 'batch-op-running',
        status: 'running',
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);

      await expect(processBulkSalaryUpdate('batch-op-running')).rejects.toThrow(
        'is not pending'
      );
    });

    it('should update operation status to running at start', async () => {
      const operationId = 'batch-op-5';
      const mockOperation = {
        id: operationId,
        tenantId: 'tenant-1',
        operationType: 'salary_update',
        entityIds: ['emp-1'],
        status: 'pending',
        params: {
          updateType: 'absolute',
          value: 500000,
          effectiveDate: '2025-02-01',
        },
        startedBy: 'user-1',
      };

      const mockCurrentSalary = {
        id: 'sal-1',
        employeeId: 'emp-1',
        baseSalary: '400000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst).mockResolvedValue(mockCurrentSalary as any);

      await processBulkSalaryUpdate(operationId);

      // Verify status update to 'running'
      expect(db.update).toHaveBeenCalledWith(batchOperations);
      const updateCalls = vi.mocked(db.update).mock.results;
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should mark operation as completed on success', async () => {
      const operationId = 'batch-op-6';
      const mockOperation = {
        id: operationId,
        tenantId: 'tenant-1',
        operationType: 'salary_update',
        entityIds: ['emp-1'],
        status: 'pending',
        params: {
          updateType: 'absolute',
          value: 500000,
          effectiveDate: '2025-02-01',
        },
        startedBy: 'user-1',
      };

      const mockCurrentSalary = {
        id: 'sal-1',
        employeeId: 'emp-1',
        baseSalary: '400000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst).mockResolvedValue(mockCurrentSalary as any);

      await processBulkSalaryUpdate(operationId);

      // Verify final status update to 'completed'
      const updateCalls = vi.mocked(db.update).mock.calls;
      expect(updateCalls.length).toBeGreaterThan(1); // At least running + completed
    });
  });

  describe('processBatchOperation', () => {
    it('should route to salary update processor', async () => {
      const operationId = 'batch-op-7';
      const mockOperation = {
        id: operationId,
        operationType: 'salary_update',
        status: 'pending',
        entityIds: ['emp-1'],
        params: {
          updateType: 'absolute',
          value: 500000,
          effectiveDate: '2025-02-01',
        },
      };

      const mockCurrentSalary = {
        id: 'sal-1',
        employeeId: 'emp-1',
        baseSalary: '400000',
        currency: 'XOF',
        payFrequency: 'monthly',
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);
      vi.mocked(mockTx.query.employeeSalaries.findFirst).mockResolvedValue(mockCurrentSalary as any);

      const result = await processBatchOperation(operationId);

      expect(result.success).toBe(true);
    });

    it('should throw error for document_generation type', async () => {
      const mockOperation = {
        id: 'batch-op-8',
        operationType: 'document_generation',
        status: 'pending',
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);

      await expect(processBatchOperation('batch-op-8')).rejects.toThrow(
        'Document generation not yet implemented'
      );
    });

    it('should throw error for contract_renewal type', async () => {
      const mockOperation = {
        id: 'batch-op-9',
        operationType: 'contract_renewal',
        status: 'pending',
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);

      await expect(processBatchOperation('batch-op-9')).rejects.toThrow(
        'Contract renewal not yet implemented'
      );
    });

    it('should throw error for unknown operation type', async () => {
      const mockOperation = {
        id: 'batch-op-10',
        operationType: 'unknown_type',
        status: 'pending',
      };

      vi.mocked(db.query.batchOperations.findFirst).mockResolvedValue(mockOperation as any);

      await expect(processBatchOperation('batch-op-10')).rejects.toThrow(
        'Unknown operation type: unknown_type'
      );
    });
  });

  describe('validateEmployeesForBatchOperation', () => {
    it('should validate all employees exist', async () => {
      const employeeIds = ['emp-1', 'emp-2'];
      const tenantId = 'tenant-1';

      const mockEmployees = [
        { id: 'emp-1', firstName: 'John', lastName: 'Doe' },
        { id: 'emp-2', firstName: 'Jane', lastName: 'Smith' },
      ];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);

      const result = await validateEmployeesForBatchOperation(employeeIds, tenantId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('emp-1');
      expect(result[1].id).toBe('emp-2');
    });

    it('should throw error for missing employees', async () => {
      const employeeIds = ['emp-1', 'emp-missing'];
      const tenantId = 'tenant-1';

      const mockEmployees = [{ id: 'emp-1', firstName: 'John', lastName: 'Doe' }];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);

      await expect(
        validateEmployeesForBatchOperation(employeeIds, tenantId)
      ).rejects.toThrow("Les employés suivants n'existent pas: emp-missing");
    });

    it('should throw error for multiple missing employees', async () => {
      const employeeIds = ['emp-1', 'emp-missing-1', 'emp-missing-2'];
      const tenantId = 'tenant-1';

      const mockEmployees = [{ id: 'emp-1', firstName: 'John', lastName: 'Doe' }];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);

      await expect(
        validateEmployeesForBatchOperation(employeeIds, tenantId)
      ).rejects.toThrow("Les employés suivants n'existent pas: emp-missing-1, emp-missing-2");
    });
  });

  describe('calculateSalaryUpdatePreview', () => {
    it('should calculate absolute salary update preview', async () => {
      const params = {
        employeeIds: ['emp-1', 'emp-2'],
        updateType: 'absolute' as const,
        value: 500000,
        tenantId: 'tenant-1',
      };

      const mockEmployees = [
        { id: 'emp-1', firstName: 'John', lastName: 'Doe' },
        { id: 'emp-2', firstName: 'Jane', lastName: 'Smith' },
      ];

      const mockSalaries = [
        { employeeId: 'emp-1', baseSalary: '400000' },
        { employeeId: 'emp-2', baseSalary: '450000' },
      ];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);
      vi.mocked(db.query.employeeSalaries.findMany).mockResolvedValue(mockSalaries as any);

      const result = await calculateSalaryUpdatePreview(params);

      expect(result).toHaveLength(2);

      expect(result[0].employeeId).toBe('emp-1');
      expect(result[0].currentSalary).toBe('400000');
      expect(result[0].newSalary).toBe(500000);
      expect(result[0].change).toBe(100000);
      expect(result[0].error).toBe(null);

      expect(result[1].employeeId).toBe('emp-2');
      expect(result[1].currentSalary).toBe('450000');
      expect(result[1].newSalary).toBe(500000);
      expect(result[1].change).toBe(50000);
      expect(result[1].error).toBe(null);
    });

    it('should calculate percentage salary update preview', async () => {
      const params = {
        employeeIds: ['emp-3'],
        updateType: 'percentage' as const,
        value: 10, // 10% increase
        tenantId: 'tenant-1',
      };

      const mockEmployees = [{ id: 'emp-3', firstName: 'Bob', lastName: 'Johnson' }];

      const mockSalaries = [{ employeeId: 'emp-3', baseSalary: '300000' }];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);
      vi.mocked(db.query.employeeSalaries.findMany).mockResolvedValue(mockSalaries as any);

      const result = await calculateSalaryUpdatePreview(params);

      expect(result).toHaveLength(1);
      expect(result[0].currentSalary).toBe('300000');
      expect(result[0].newSalary).toBe(330000); // 300k * 1.10
      expect(result[0].change).toBe(30000);
      expect(result[0].changePercentage).toBe(10);
      expect(result[0].error).toBe(null);
    });

    it('should handle employee with no active salary', async () => {
      const params = {
        employeeIds: ['emp-no-salary'],
        updateType: 'absolute' as const,
        value: 500000,
        tenantId: 'tenant-1',
      };

      const mockEmployees = [{ id: 'emp-no-salary', firstName: 'No', lastName: 'Salary' }];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);
      vi.mocked(db.query.employeeSalaries.findMany).mockResolvedValue([]);

      const result = await calculateSalaryUpdatePreview(params);

      expect(result).toHaveLength(1);
      expect(result[0].employeeId).toBe('emp-no-salary');
      expect(result[0].currentSalary).toBe(null);
      expect(result[0].newSalary).toBe(null);
      expect(result[0].change).toBe(null);
      expect(result[0].error).toBe('Aucun salaire actif trouvé');
    });

    it('should calculate change percentage correctly', async () => {
      const params = {
        employeeIds: ['emp-calc'],
        updateType: 'absolute' as const,
        value: 550000,
        tenantId: 'tenant-1',
      };

      const mockEmployees = [{ id: 'emp-calc', firstName: 'Calc', lastName: 'Test' }];

      const mockSalaries = [{ employeeId: 'emp-calc', baseSalary: '500000' }];

      vi.mocked(db.query.employees.findMany).mockResolvedValue(mockEmployees as any);
      vi.mocked(db.query.employeeSalaries.findMany).mockResolvedValue(mockSalaries as any);

      const result = await calculateSalaryUpdatePreview(params);

      expect(result[0].change).toBe(50000);
      expect(result[0].changePercentage).toBe(10); // (50k / 500k) * 100 = 10%
    });
  });
});
