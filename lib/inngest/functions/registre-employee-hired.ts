/**
 * Event-Driven Function: Registre - Employee Hired
 * Week 16: Digital Registre du Personnel
 *
 * Triggered when: employee.hired event is published
 * Action: Create hire entry in digital employee register
 */

import { inngest } from '../client';
import { createHireEntry } from '@/lib/compliance/registre-personnel.service';

/**
 * Registre - Employee Hired Event Handler
 * Automatically creates a register entry when an employee is hired
 */
export const registreEmployeeHiredFunction = inngest.createFunction(
  {
    id: 'registre-employee-hired',
    name: 'Registre du Personnel - Embauche',
    retries: 3,
    rateLimit: {
      limit: 20,
      period: '1m',
    },
  },

  { event: 'employee.hired' },

  async ({ event, step }) => {
    const { employeeId, tenantId } = event.data;

    console.log('[Registre Sync] Processing employee hire for register:', {
      employeeId,
      tenantId,
    });

    // Create hire entry in register
    const registerEntry = await step.run('create-hire-entry', async () => {
      try {
        const result = await createHireEntry({
          employeeId,
          tenantId,
          userId: event.data.createdBy || 'system', // Use creator if available
        });

        console.log(`[Registre Sync] Hire entry created: #${result.entryNumber}`);

        return {
          success: true,
          entryId: result.entryId,
          entryNumber: result.entryNumber,
        };
      } catch (error: any) {
        console.error('[Registre Sync] Failed to create hire entry:', error);
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
