/**
 * Contract Expiring Event Handler
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md
 *
 * Triggered when: A contract is expiring soon (30/15/7 days)
 * Actions:
 * 1. Create renewal alert
 * 2. Trigger renewal workflow
 * 3. Notify relevant stakeholders
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { alerts } from '@/lib/db/schema/automation';
import { addDays } from 'date-fns';

export const contractExpiringHandler = inngest.createFunction(
  {
    id: 'contract-expiring',
    name: 'Traiter expiration de contrat',
    retries: 3,
  },
  { event: 'contract.expiring' },
  async ({ event, step }) => {
    const {
      contractId,
      employeeId,
      employeeName,
      expiryDate,
      daysUntilExpiry,
      contractType,
      tenantId,
    } = event.data;

    // Determine severity based on days until expiry
    const severity =
      daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'warning' : 'info';

    // Create renewal alert
    const alertId = await step.run('create-renewal-alert', async () => {
      const expiryDateObj = new Date(expiryDate);

      const [alert] = await db
        .insert(alerts)
        .values({
          tenantId,
          type: 'contract_expiring',
          severity,
          message: `Contrat à renouveler: ${employeeName}. Le contrat ${contractType} expire dans ${daysUntilExpiry} jours (${expiryDateObj.toLocaleDateString('fr-FR')})`,
          assigneeId: tenantId, // Will be replaced with HR manager ID
          employeeId,
          actionUrl: `/employees/${employeeId}/contracts/${contractId}`,
          actionLabel: 'Renouveler le contrat',
          status: 'active',
          dueDate: expiryDateObj,
          metadata: {
            contractId,
            expiryDate: expiryDate.toISOString(),
            daysUntilExpiry,
            contractType,
          },
        })
        .returning();

      return alert.id;
    });

    console.log(`[Contract Expiring] Alert created for ${employeeName}, expires in ${daysUntilExpiry} days`);

    return {
      success: true,
      alertId,
      contractId,
      employeeId,
    };
  }
);
