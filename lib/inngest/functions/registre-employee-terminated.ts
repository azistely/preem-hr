/**
 * Event-Driven Function: Registre - Employee Terminated
 * Week 16: Digital Registre du Personnel
 *
 * Triggered when: employee.terminated event is published
 * Action: Create exit entry in digital employee register
 */

import { inngest } from '../client';
import { createExitEntry } from '@/lib/compliance/registre-personnel.service';

/**
 * Registre - Employee Terminated Event Handler
 * Automatically creates a register exit entry when an employee is terminated
 */
export const registreEmployeeTerminatedFunction = inngest.createFunction(
  {
    id: 'registre-employee-terminated',
    name: 'Registre du Personnel - Sortie',
    retries: 3,
    rateLimit: {
      limit: 20,
      period: '1m',
    },
  },

  { event: 'employee.terminated' },

  async ({ event, step }) => {
    const { employeeId, tenantId, terminationDate, reason } = event.data;

    console.log('[Registre Sync] Processing employee termination for register:', {
      employeeId,
      tenantId,
      terminationDate,
    });

    // Create exit entry in register
    const registerEntry = await step.run('create-exit-entry', async () => {
      try {
        const result = await createExitEntry({
          employeeId,
          exitDate: new Date(terminationDate),
          exitReason: reason || 'Motif non spécifié',
          tenantId,
          userId: event.data.terminatedBy || 'system', // Use terminator if available
        });

        console.log(`[Registre Sync] Exit entry created: #${result.entryNumber}`);

        return {
          success: true,
          entryId: result.entryId,
          entryNumber: result.entryNumber,
        };
      } catch (error: any) {
        console.error('[Registre Sync] Failed to create exit entry:', error);
        throw error;
      }
    });

    return {
      success: true,
      employeeId,
      registerEntry,
    };
  }
);
