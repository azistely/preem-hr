/**
 * Integration Tests for Workflows Router
 * Tests tRPC procedures for workflow automation management
 *
 * Tests actual database operations with test database isolation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { workflowsRouter } from '../workflows';
import {
  createTestContext,
  seedTestData,
  cleanupTestData,
  testHRManager,
  testEmployee,
  testEmployeeRecord,
  testTenant,
} from './test-utils';
import { db } from '@/lib/db';
import { workflowDefinitions, workflowExecutions } from '@/lib/db/schema/workflows';
import { eq } from 'drizzle-orm';

// Test workflow data helpers
function createTestWorkflowData(overrides: Partial<any> = {}) {
  return {
    tenantId: testTenant.id,
    name: 'Test Workflow',
    description: 'Test workflow description',
    triggerType: 'contract_expiry',
    triggerConfig: { daysBeforeExpiry: 30 },
    conditions: [],
    actions: [
      {
        type: 'create_alert',
        config: { severity: 'urgent', message: 'Contract expiring' },
      },
    ],
    status: 'draft',
    createdBy: testHRManager.id,
    version: 1,
    executionCount: 0,
    successCount: 0,
    errorCount: 0,
    isTemplate: false,
    ...overrides,
  };
}

function createTestWorkflowExecutionData(workflowId: string, overrides: Partial<any> = {}) {
  return {
    workflowId,
    tenantId: testTenant.id,
    employeeId: testEmployeeRecord.id,
    status: 'success',
    startedAt: new Date(),
    completedAt: new Date(),
    durationMs: 1000,
    actionsExecuted: [],
    errorMessage: null,
    executionLog: [],
    workflowSnapshot: {},
    triggerData: {},
    ...overrides,
  };
}

describe('Workflows Router Integration Tests', () => {
  // Setup and teardown
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up workflows before each test
    await db.delete(workflowExecutions).where(eq(workflowExecutions.tenantId, testTenant.id));
    await db.delete(workflowDefinitions).where(eq(workflowDefinitions.tenantId, testTenant.id));
  });

  describe('list', () => {
    it('should list workflows for the tenant', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create test workflows
      await db.insert(workflowDefinitions).values([
        createTestWorkflowData({ name: 'Workflow 1' }),
        createTestWorkflowData({ name: 'Workflow 2' }),
      ]);

      const result = await caller.list({});

      expect(result.workflows).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter workflows by status', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create workflows with different statuses
      await db.insert(workflowDefinitions).values([
        createTestWorkflowData({ status: 'draft' }),
        createTestWorkflowData({ status: 'active' }),
        createTestWorkflowData({ status: 'paused' }),
      ]);

      const result = await caller.list({ status: 'active' });

      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].status).toBe('active');
    });

    it('should filter workflows by template category', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create workflows with different categories
      await db.insert(workflowDefinitions).values([
        createTestWorkflowData({ templateCategory: 'contract_management' }),
        createTestWorkflowData({ templateCategory: 'payroll' }),
      ]);

      const result = await caller.list({ templateCategory: 'contract_management' });

      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].templateCategory).toBe('contract_management');
    });

    it('should paginate workflows correctly', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create 25 workflows
      const workflowsData = Array.from({ length: 25 }, (_, i) =>
        createTestWorkflowData({ name: `Workflow ${i}` })
      );
      await db.insert(workflowDefinitions).values(workflowsData);

      // First page
      const firstPage = await caller.list({ limit: 10, offset: 0 });
      expect(firstPage.workflows).toHaveLength(10);
      expect(firstPage.total).toBe(25);
      expect(firstPage.hasMore).toBe(true);

      // Last page
      const lastPage = await caller.list({ limit: 10, offset: 20 });
      expect(lastPage.workflows).toHaveLength(5);
      expect(lastPage.hasMore).toBe(false);
    });
  });

  describe('getById', () => {
    it('should return workflow by ID', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [inserted] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData())
        .returning();

      const result = await caller.getById({ id: inserted.id });

      expect(result.id).toBe(inserted.id);
      expect(result.name).toBe(inserted.name);
    });

    it('should throw NOT_FOUND for non-existent workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      await expect(
        caller.getById({ id: '00000000-0000-0000-0000-000000000099' })
      ).rejects.toThrow('Workflow non trouvé');
    });
  });

  describe('getTemplates', () => {
    it('should return workflow templates', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create system templates (undefined tenantId for system templates)
      await db.insert(workflowDefinitions).values([
        { ...createTestWorkflowData(), tenantId: undefined as any, isTemplate: true },
        { ...createTestWorkflowData(), tenantId: undefined as any, isTemplate: true },
      ]);

      const result = await caller.getTemplates({});

      expect(result).toHaveLength(2);
      expect('isTemplate' in result[0] ? result[0].isTemplate : false).toBe(true);
    });

    it('should filter templates by category', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create templates with different categories
      await db.insert(workflowDefinitions).values([
        {
          ...createTestWorkflowData(),
          tenantId: undefined as any,
          isTemplate: true,
          templateCategory: 'contract_management',
        },
        {
          ...createTestWorkflowData(),
          tenantId: undefined as any,
          isTemplate: true,
          templateCategory: 'payroll',
        },
      ]);

      const result = await caller.getTemplates({ category: 'contract_management' });

      expect(result).toHaveLength(1);
      expect('templateCategory' in result[0] ? result[0].templateCategory : null).toBe('contract_management');
    });
  });

  describe('create', () => {
    it('should create a new workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const result = await caller.create({
        name: 'New Workflow',
        description: 'New workflow description',
        triggerType: 'employee_hired',
        triggerConfig: {},
        conditions: [],
        actions: [{ type: 'send_notification', config: {} }],
        status: 'draft',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('New Workflow');
      expect(result.tenantId).toBe(testTenant.id);
      expect(result.createdBy).toBe(testHRManager.id);
    });

    it('should create workflow from template', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create template
      const [template] = await db
        .insert(workflowDefinitions)
        .values({
          ...createTestWorkflowData(),
          tenantId: undefined as any,
          isTemplate: true,
          templateCategory: 'contract_management',
        })
        .returning();

      const result = await caller.create({
        name: 'My Custom Workflow',
        triggerType: 'contract_expiry',
        triggerConfig: {},
        actions: [{ type: 'create_alert', config: {} }],
        templateId: template.id,
      });

      expect(result).toBeDefined();
      expect(result.templateCategory).toBe('contract_management');
      expect(result.isTemplate).toBe(false);
    });

    it('should throw NOT_FOUND for invalid template ID', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      await expect(
        caller.create({
          name: 'Test',
          triggerType: 'test',
          triggerConfig: {},
          actions: [],
          templateId: '00000000-0000-0000-0000-000000000099',
        })
      ).rejects.toThrow('Modèle non trouvé');
    });
  });

  describe('update', () => {
    it('should update workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [inserted] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData({ name: 'Old Name' }))
        .returning();

      const result = await caller.update({
        id: inserted.id,
        name: 'New Name',
        description: 'Updated description',
      });

      expect(result.name).toBe('New Name');
      expect(result.description).toBe('Updated description');
    });

    it('should throw NOT_FOUND for non-existent workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      await expect(
        caller.update({
          id: '00000000-0000-0000-0000-000000000099',
          name: 'Test',
        })
      ).rejects.toThrow('Workflow non trouvé');
    });
  });

  describe('activate', () => {
    it('should activate a draft workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [inserted] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData({ status: 'draft' }))
        .returning();

      const result = await caller.activate({ id: inserted.id });

      expect(result.status).toBe('active');
    });

    it('should throw BAD_REQUEST if workflow has no actions', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [inserted] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData({ actions: [] }))
        .returning();

      await expect(caller.activate({ id: inserted.id })).rejects.toThrow(
        'Le workflow doit avoir au moins une action'
      );
    });
  });

  describe('pause', () => {
    it('should pause an active workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [inserted] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData({ status: 'active' }))
        .returning();

      const result = await caller.pause({ id: inserted.id });

      expect(result.status).toBe('paused');
    });
  });

  describe('delete', () => {
    it('should archive workflow (soft delete)', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [inserted] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData())
        .returning();

      const result = await caller.delete({ id: inserted.id });

      expect(result.status).toBe('archived');

      // Verify it's not deleted from database
      const archived = await db.query.workflowDefinitions.findFirst({
        where: eq(workflowDefinitions.id, inserted.id),
      });
      expect(archived).toBeDefined();
      expect(archived?.status).toBe('archived');
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history for a workflow', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [workflow] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData())
        .returning();

      // Create executions
      await db.insert(workflowExecutions).values([
        createTestWorkflowExecutionData(workflow.id, { status: 'success' }),
        createTestWorkflowExecutionData(workflow.id, { status: 'failed' }),
      ]);

      const result = await caller.getExecutionHistory({ workflowId: workflow.id });

      expect(result.executions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter executions by status', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [workflow] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData())
        .returning();

      // Create executions
      await db.insert(workflowExecutions).values([
        createTestWorkflowExecutionData(workflow.id, { status: 'success' }),
        createTestWorkflowExecutionData(workflow.id, { status: 'failed' }),
      ]);

      const result = await caller.getExecutionHistory({
        workflowId: workflow.id,
        status: 'success',
      });

      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].status).toBe('success');
    });
  });

  describe('getStats', () => {
    it('should return workflow statistics', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [workflow] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData())
        .returning();

      // Create executions
      await db.insert(workflowExecutions).values([
        createTestWorkflowExecutionData(workflow.id, { status: 'success', durationMs: 1000 }),
        createTestWorkflowExecutionData(workflow.id, { status: 'success', durationMs: 2000 }),
        createTestWorkflowExecutionData(workflow.id, { status: 'failed', durationMs: 500 }),
      ]);

      const result = await caller.getStats({ id: workflow.id });

      expect(result.workflow).toBeDefined();
      expect(result.stats).toHaveLength(2); // success and failed
    });
  });

  describe('testWorkflow', () => {
    it('should test workflow (dry run)', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      const [workflow] = await db
        .insert(workflowDefinitions)
        .values(createTestWorkflowData())
        .returning();

      const result = await caller.testWorkflow({
        workflowId: workflow.id,
        testData: { employeeId: testEmployeeRecord.id },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Test réussi');
    });
  });

  describe('Tenant Isolation', () => {
    it('should not access workflows from different tenants', async () => {
      const ctx = createTestContext(testHRManager);
      const caller = workflowsRouter.createCaller(ctx);

      // Create workflow for a different tenant
      const differentTenantWorkflow = {
        ...createTestWorkflowData(),
        tenantId: '00000000-0000-0000-0000-000000000002', // Different tenant
      };

      await db.insert(workflowDefinitions).values(differentTenantWorkflow);

      // Create workflow for current tenant
      await db.insert(workflowDefinitions).values(createTestWorkflowData());

      const result = await caller.list({});

      // Should only see workflow from current tenant
      expect(result.workflows).toHaveLength(1);
      expect(result.workflows[0].tenantId).toBe(testTenant.id);
    });
  });
});
