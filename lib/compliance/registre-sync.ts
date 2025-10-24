/**
 * Registre du Personnel - Automatic Sync
 *
 * Automatically creates register entries when employees are hired or terminated.
 * This ensures the legal register is always up-to-date without manual intervention.
 *
 * Events:
 * - employee.hired → Create hire entry
 * - employee.terminated → Create exit entry
 */

import { eventBus, type EmployeeHiredEvent, type EmployeeTerminatedEvent } from '@/lib/event-bus';
import { createHireEntry, createExitEntry } from './registre-personnel.service';

/**
 * Initialize automatic register sync
 * Call this function once at application startup
 */
export function initializeRegistreSync() {
  console.log('[Registre Sync] Initializing automatic register sync...');

  // Subscribe to employee.hired event
  eventBus.subscribe<EmployeeHiredEvent>('employee.hired', async (event) => {
    console.log('[Registre Sync] Employee hired event received:', event);

    try {
      // Note: userId should come from the context that created the employee
      // For now, we'll use a system user or the tenantId as fallback
      const result = await createHireEntry({
        employeeId: event.employeeId,
        tenantId: event.tenantId,
        userId: 'system', // TODO: Get actual user ID from event or context
      });

      console.log(`[Registre Sync] Hire entry created: #${result.entryNumber} for employee ${event.employeeId}`);
    } catch (error: any) {
      console.error('[Registre Sync] Failed to create hire entry:', error);
      // Don't throw - we don't want to break the employee creation process
    }
  });

  // Subscribe to employee.terminated event
  eventBus.subscribe<EmployeeTerminatedEvent>('employee.terminated', async (event) => {
    console.log('[Registre Sync] Employee terminated event received:', event);

    try {
      const result = await createExitEntry({
        employeeId: event.employeeId,
        exitDate: event.terminationDate,
        exitReason: event.reason,
        tenantId: event.tenantId,
        userId: 'system', // TODO: Get actual user ID from event or context
      });

      console.log(`[Registre Sync] Exit entry created: #${result.entryNumber} for employee ${event.employeeId}`);
    } catch (error: any) {
      console.error('[Registre Sync] Failed to create exit entry:', error);
      // Don't throw - we don't want to break the termination process
    }
  });

  console.log('[Registre Sync] Automatic register sync initialized successfully');
}

/**
 * Cleanup function (for testing or shutdown)
 */
export function cleanupRegistreSync() {
  // Event bus doesn't expose a way to unsubscribe by event name
  // This would need to be enhanced if cleanup is required
  console.log('[Registre Sync] Cleanup requested (not implemented)');
}
