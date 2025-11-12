/**
 * Document Approval Workflow - Inngest Function
 * Epic: Document Management System
 *
 * Handles the complete approval lifecycle for employee-uploaded documents:
 * 1. Employee uploads document → creates pending approval
 * 2. Notifies HR managers
 * 3. Waits for approval/rejection (with 7-day timeout)
 * 4. Notifies employee of outcome
 * 5. Auto-reject if no response within timeout
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { uploadedDocuments, alerts, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { NonRetriableError } from 'inngest';

/**
 * Event type definitions
 */
export type DocumentUploadedEvent = {
  name: 'document.uploaded';
  data: {
    documentId: string;
    employeeId: string;
    employeeName: string;
    tenantId: string;
    documentCategory: string;
    fileName: string;
    requiresApproval: boolean;
    uploadedById: string;
  };
};

export type DocumentApprovedEvent = {
  name: 'document.approved';
  data: {
    documentId: string;
    approvedById: string;
    approvedByName: string;
    tenantId: string;
  };
};

export type DocumentRejectedEvent = {
  name: 'document.rejected';
  data: {
    documentId: string;
    rejectedById: string;
    rejectedByName: string;
    rejectionReason: string;
    tenantId: string;
  };
};

/**
 * Main approval workflow function
 * Orchestrates the entire approval process with timeouts and notifications
 */
export const documentApprovalWorkflow = inngest.createFunction(
  {
    id: 'document-approval-workflow',
    name: 'Document Approval Workflow',
    retries: 2,
  },

  { event: 'document.uploaded' },

  async ({ event, step }) => {
    const { documentId, employeeId, employeeName, tenantId, documentCategory, fileName, requiresApproval, uploadedById } =
      event.data;

    console.log('[Inngest] Starting document approval workflow:', {
      documentId,
      employeeId,
      requiresApproval,
    });

    // Skip approval workflow if document doesn't require it
    if (!requiresApproval) {
      console.log('[Inngest] Document does not require approval, skipping workflow');
      return {
        success: true,
        skipped: true,
        reason: 'Document does not require HR approval',
      };
    }

    // Step 1: Verify document exists and is pending
    const document = await step.run('verify-document', async () => {
      const [doc] = await db
        .select()
        .from(uploadedDocuments)
        .where(
          and(
            eq(uploadedDocuments.id, documentId),
            eq(uploadedDocuments.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!doc) {
        throw new NonRetriableError(`Document ${documentId} not found`);
      }

      if (doc.approvalStatus !== 'pending') {
        throw new NonRetriableError(`Document ${documentId} is not pending approval (status: ${doc.approvalStatus})`);
      }

      return doc;
    });

    // Step 2: Find HR managers in the tenant
    const hrManagers = await step.run('find-hr-managers', async () => {
      const managers = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.role, 'HR_MANAGER')
          )
        );

      if (managers.length === 0) {
        console.warn('[Inngest] No HR managers found for tenant, trying ADMIN role');

        // Fallback to admin if no HR managers
        const admins = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          })
          .from(users)
          .where(
            and(
              eq(users.tenantId, tenantId),
              eq(users.role, 'ADMIN')
            )
          );

        return admins;
      }

      return managers;
    });

    if (hrManagers.length === 0) {
      throw new NonRetriableError(`No HR managers or admins found for tenant ${tenantId}`);
    }

    // Step 3: Create alerts for all HR managers
    await step.run('create-hr-alerts', async () => {
      const categoryLabels: Record<string, string> = {
        medical: 'Certificat médical',
        diploma: 'Diplôme',
        id_card: 'Pièce d\'identité',
        other: 'Document',
      };

      const categoryLabel = categoryLabels[documentCategory] || 'Document';

      const alertsToCreate = hrManagers.map((manager) => ({
        tenantId,
        type: 'document_pending_approval' as const,
        severity: 'info' as const,
        message: `${categoryLabel} de ${employeeName} en attente de validation`,
        assigneeId: manager.id,
        actionUrl: `/admin/documents/approvals`,
        actionLabel: 'Voir le document',
        status: 'active' as const,
        metadata: {
          documentId,
          employeeId,
          employeeName,
          documentCategory,
          fileName,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const createdAlerts = await db.insert(alerts).values(alertsToCreate).returning();

      console.log(`[Inngest] Created ${createdAlerts.length} alerts for HR managers`);

      return createdAlerts;
    });

    // Step 4: Wait for approval or rejection (with 7-day timeout)
    console.log('[Inngest] Waiting for approval/rejection decision...');

    const decision = await step.waitForEvent('wait-for-decision', {
      event: 'document.approved',
      timeout: '7d',
      match: 'data.documentId',
    });

    // Step 5: Handle timeout (auto-reject after 7 days)
    if (!decision) {
      console.log('[Inngest] Approval timeout reached, auto-rejecting document');

      await step.run('auto-reject-document', async () => {
        await db
          .update(uploadedDocuments)
          .set({
            approvalStatus: 'rejected',
            rejectionReason: 'Document non vérifié dans les 7 jours (expiration automatique)',
            updatedAt: new Date(),
          })
          .where(eq(uploadedDocuments.id, documentId));
      });

      // Notify employee of auto-rejection
      await step.run('notify-employee-timeout', async () => {
        await db.insert(alerts).values({
          tenantId,
          type: 'document_rejected',
          severity: 'warning',
          message: `Votre ${document.fileName} n'a pas été vérifié à temps et a expiré`,
          assigneeId: uploadedById,
          actionUrl: `/employee/documents`,
          actionLabel: 'Voir mes documents',
          status: 'active',
          metadata: {
            documentId,
            reason: 'timeout',
            autoRejected: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Mark HR alerts as resolved
      await step.run('resolve-hr-alerts', async () => {
        await db
          .update(alerts)
          .set({ status: 'resolved', updatedAt: new Date() })
          .where(
            and(
              eq(alerts.tenantId, tenantId),
              eq(alerts.type, 'document_pending_approval')
            )
          );
      });

      return {
        success: true,
        outcome: 'auto_rejected',
        reason: 'Approval timeout after 7 days',
        documentId,
      };
    }

    // Step 6: Process approval
    console.log('[Inngest] Document approved:', decision.data);

    await step.run('notify-employee-approval', async () => {
      const categoryLabels: Record<string, string> = {
        medical: 'certificat médical',
        diploma: 'diplôme',
        id_card: 'pièce d\'identité',
        other: 'document',
      };

      const categoryLabel = categoryLabels[documentCategory] || 'document';

      await db.insert(alerts).values({
        tenantId,
        type: 'document_approved',
        severity: 'info',
        message: `Votre ${categoryLabel} (${fileName}) a été approuvé`,
        assigneeId: uploadedById,
        actionUrl: `/employee/documents`,
        actionLabel: 'Voir mes documents',
        status: 'active',
        metadata: {
          documentId,
          approvedById: decision.data.approvedById,
          approvedByName: decision.data.approvedByName,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Mark HR alerts as resolved
    await step.run('resolve-hr-alerts', async () => {
      await db
        .update(alerts)
        .set({ status: 'resolved', updatedAt: new Date() })
        .where(
          and(
            eq(alerts.tenantId, tenantId),
            eq(alerts.type, 'document_pending_approval')
          )
        );
    });

    console.log('[Inngest] Document approval workflow completed:', {
      documentId,
      outcome: 'approved',
    });

    return {
      success: true,
      outcome: 'approved',
      documentId,
      approvedById: decision.data.approvedById,
    };
  }
);

/**
 * Rejection handler function
 * Processes document rejections and notifies the employee
 */
export const documentRejectionHandler = inngest.createFunction(
  {
    id: 'document-rejection-handler',
    name: 'Document Rejection Handler',
    retries: 2,
  },

  { event: 'document.rejected' },

  async ({ event, step }) => {
    const { documentId, rejectedById, rejectedByName, rejectionReason, tenantId } = event.data;

    console.log('[Inngest] Processing document rejection:', {
      documentId,
      rejectedById,
    });

    // Step 1: Get document details
    const document = await step.run('get-document', async () => {
      const [doc] = await db
        .select()
        .from(uploadedDocuments)
        .where(eq(uploadedDocuments.id, documentId))
        .limit(1);

      if (!doc) {
        throw new NonRetriableError(`Document ${documentId} not found`);
      }

      return doc;
    });

    // Step 2: Notify employee of rejection
    await step.run('notify-employee', async () => {
      const categoryLabels: Record<string, string> = {
        medical: 'certificat médical',
        diploma: 'diplôme',
        id_card: 'pièce d\'identité',
        other: 'document',
      };

      const categoryLabel = categoryLabels[document.documentCategory] || 'document';

      await db.insert(alerts).values({
        tenantId,
        type: 'document_rejected',
        severity: 'warning',
        message: `Votre ${categoryLabel} (${document.fileName}) a été refusé`,
        assigneeId: document.uploadedBy,
        actionUrl: `/employee/documents`,
        actionLabel: 'Voir la raison',
        status: 'active',
        metadata: {
          documentId,
          rejectedById,
          rejectedByName,
          rejectionReason,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Step 3: Mark HR alerts as resolved
    await step.run('resolve-hr-alerts', async () => {
      await db
        .update(alerts)
        .set({ status: 'resolved', updatedAt: new Date() })
        .where(
          and(
            eq(alerts.tenantId, tenantId),
            eq(alerts.type, 'document_pending_approval')
          )
        );
    });

    console.log('[Inngest] Document rejection processed:', { documentId });

    return {
      success: true,
      documentId,
      notificationSent: true,
    };
  }
);
