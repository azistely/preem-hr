/**
 * Document Expiry Reminders - Scheduled Inngest Function
 * Epic: Document Management System
 *
 * Daily scheduled job that:
 * 1. Finds documents expiring in the next 30 days
 * 2. Creates alerts for HR managers
 * 3. Identifies expired documents
 * 4. Sends notifications for critical documents (contracts, IDs)
 */

import { inngest } from '../client';
import { db } from '@/lib/db';
import { uploadedDocuments, alerts, employees, users } from '@/lib/db/schema';
import { and, eq, gte, lte, sql, isNotNull } from 'drizzle-orm';

/**
 * Daily document expiry check
 * Runs every day at 8:00 AM tenant local time
 */
export const documentExpiryCheckFunction = inngest.createFunction(
  {
    id: 'document-expiry-check',
    name: 'Daily Document Expiry Check',
    retries: 2,
  },

  // Run daily at 8:00 AM
  { cron: '0 8 * * *' },

  async ({ step }) => {
    console.log('[Inngest] Starting daily document expiry check');

    // Step 1: Find documents expiring in next 30 days
    const expiringSoon = await step.run('find-expiring-documents', async () => {
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Convert dates to YYYY-MM-DD strings for SQL comparison
      const nowStr = now.toISOString().split('T')[0];
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

      const documents = await db
        .select({
          document: uploadedDocuments,
          employee: employees,
          tenant: {
            id: uploadedDocuments.tenantId,
          },
        })
        .from(uploadedDocuments)
        .leftJoin(employees, eq(uploadedDocuments.employeeId, employees.id))
        .where(
          and(
            isNotNull(uploadedDocuments.expiryDate),
            gte(uploadedDocuments.expiryDate, nowStr),
            lte(uploadedDocuments.expiryDate, thirtyDaysStr),
            eq(uploadedDocuments.isArchived, false),
            eq(uploadedDocuments.approvalStatus, 'approved')
          )
        );

      return documents;
    });

    console.log(`[Inngest] Found ${expiringSoon.length} documents expiring soon`);

    // Step 2: Find already expired documents
    const expired = await step.run('find-expired-documents', async () => {
      const now = new Date();
      const nowStr = now.toISOString().split('T')[0];

      const documents = await db
        .select({
          document: uploadedDocuments,
          employee: employees,
        })
        .from(uploadedDocuments)
        .leftJoin(employees, eq(uploadedDocuments.employeeId, employees.id))
        .where(
          and(
            isNotNull(uploadedDocuments.expiryDate),
            lte(uploadedDocuments.expiryDate, nowStr),
            eq(uploadedDocuments.isArchived, false),
            eq(uploadedDocuments.approvalStatus, 'approved')
          )
        );

      return documents;
    });

    console.log(`[Inngest] Found ${expired.length} expired documents`);

    // Step 3: Group by tenant and create alerts
    const alertsCreated = await step.run('create-expiry-alerts', async () => {
      // Group expiring documents by tenant
      const byTenant = new Map<string, typeof expiringSoon>();

      for (const doc of expiringSoon) {
        const tenantId = doc.document.tenantId;
        if (!byTenant.has(tenantId)) {
          byTenant.set(tenantId, []);
        }
        byTenant.get(tenantId)!.push(doc);
      }

      const createdAlerts = [];

      // Create one alert per tenant (summary)
      for (const [tenantId, documents] of byTenant.entries()) {
        // Get HR managers for this tenant
        const hrManagers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.tenantId, tenantId),
              eq(users.role, 'HR_MANAGER')
            )
          );

        if (hrManagers.length === 0) {
          console.warn(`[Inngest] No HR managers found for tenant ${tenantId}`);
          continue;
        }

        // Categorize by urgency
        const critical = documents.filter((d) => {
          // Convert string date to Date object for calculation
          const expiryDate = new Date(d.document.expiryDate!);
          const daysUntilExpiry = Math.floor(
            (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilExpiry <= 7; // Expires in 7 days or less
        });

        const urgent = documents.filter((d) => {
          const expiryDate = new Date(d.document.expiryDate!);
          const daysUntilExpiry = Math.floor(
            (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilExpiry > 7 && daysUntilExpiry <= 14;
        });

        const warning = documents.filter((d) => {
          const expiryDate = new Date(d.document.expiryDate!);
          const daysUntilExpiry = Math.floor(
            (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilExpiry > 14;
        });

        // Create alerts for HR managers
        for (const manager of hrManagers) {
          if (critical.length > 0) {
            const [alert] = await db
              .insert(alerts)
              .values({
                tenantId,
                type: 'documents_expiring',
                severity: 'critical',
                message: `${critical.length} document(s) expire dans moins de 7 jours`,
                assigneeId: manager.id,
                actionUrl: '/admin/documents?filter=expiring',
                actionLabel: 'Voir les documents',
                status: 'active',
                metadata: {
                  critical: critical.length,
                  urgent: urgent.length,
                  warning: warning.length,
                  documentIds: critical.map((d) => d.document.id),
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            createdAlerts.push(alert);
          } else if (urgent.length > 0) {
            const [alert] = await db
              .insert(alerts)
              .values({
                tenantId,
                type: 'documents_expiring',
                severity: 'warning',
                message: `${urgent.length} document(s) expire dans moins de 14 jours`,
                assigneeId: manager.id,
                actionUrl: '/admin/documents?filter=expiring',
                actionLabel: 'Voir les documents',
                status: 'active',
                metadata: {
                  urgent: urgent.length,
                  warning: warning.length,
                  documentIds: urgent.map((d) => d.document.id),
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();

            createdAlerts.push(alert);
          }
        }
      }

      return createdAlerts;
    });

    // Step 4: Create alerts for expired documents
    const expiredAlerts = await step.run('create-expired-alerts', async () => {
      const byTenant = new Map<string, typeof expired>();

      for (const doc of expired) {
        const tenantId = doc.document.tenantId;
        if (!byTenant.has(tenantId)) {
          byTenant.set(tenantId, []);
        }
        byTenant.get(tenantId)!.push(doc);
      }

      const createdAlerts = [];

      for (const [tenantId, documents] of byTenant.entries()) {
        // Get HR managers
        const hrManagers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.tenantId, tenantId),
              eq(users.role, 'HR_MANAGER')
            )
          );

        if (hrManagers.length === 0) continue;

        // Create alert for each HR manager
        for (const manager of hrManagers) {
          const [alert] = await db
            .insert(alerts)
            .values({
              tenantId,
              type: 'documents_expired',
              severity: 'critical',
              message: `${documents.length} document(s) expiré(s) nécessitent une mise à jour`,
              assigneeId: manager.id,
              actionUrl: '/admin/documents?filter=expired',
              actionLabel: 'Voir les documents',
              status: 'active',
              metadata: {
                expiredCount: documents.length,
                documentIds: documents.map((d) => d.document.id),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          createdAlerts.push(alert);
        }
      }

      return createdAlerts;
    });

    // Step 5: Publish events for critical expired documents (contracts, IDs)
    await step.run('publish-critical-expiry-events', async () => {
      const criticalTypes = ['contract', 'id_card'];

      const criticalExpired = expired.filter((d) =>
        criticalTypes.includes(d.document.documentCategory)
      );

      for (const doc of criticalExpired) {
        await inngest.send({
          name: 'document.expired',
          data: {
            documentId: doc.document.id,
            documentCategory: doc.document.documentCategory,
            employeeId: doc.document.employeeId!,
            employeeName: doc.employee
              ? `${doc.employee.firstName} ${doc.employee.lastName}`
              : 'Unknown',
            tenantId: doc.document.tenantId,
            expiryDate: doc.document.expiryDate!,
            fileName: doc.document.fileName,
          },
        });
      }

      return {
        criticalExpiredCount: criticalExpired.length,
      };
    });

    console.log('[Inngest] Document expiry check completed:', {
      expiringSoon: expiringSoon.length,
      expired: expired.length,
      alertsCreated: alertsCreated.length,
      expiredAlertsCreated: expiredAlerts.length,
    });

    return {
      success: true,
      summary: {
        expiringSoon: expiringSoon.length,
        expired: expired.length,
        alertsCreated: alertsCreated.length,
        expiredAlertsCreated: expiredAlerts.length,
      },
    };
  }
);

/**
 * Critical document expired event handler
 * Handles urgent cases like expired contracts or IDs
 */
export const criticalDocumentExpiredHandler = inngest.createFunction(
  {
    id: 'critical-document-expired-handler',
    name: 'Critical Document Expired Handler',
    retries: 2,
  },

  { event: 'document.expired' },

  async ({ event, step }) => {
    const { documentId, documentCategory, employeeId, employeeName, tenantId, expiryDate, fileName } =
      event.data;

    console.log('[Inngest] Processing critical document expiry:', {
      documentId,
      documentCategory,
      employeeId,
    });

    // Step 1: Create high-priority alert
    await step.run('create-critical-alert', async () => {
      // Get HR managers and admins
      const recipients = await db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            sql`${users.role} IN ('HR_MANAGER', 'ADMIN')`
          )
        );

      const categoryLabels: Record<string, string> = {
        contract: 'Contrat de travail',
        id_card: 'Pièce d\'identité',
      };

      const categoryLabel = categoryLabels[documentCategory] || 'Document';

      for (const recipient of recipients) {
        await db.insert(alerts).values({
          tenantId,
          type: 'critical_document_expired',
          severity: 'critical',
          message: `⚠️ ${categoryLabel} de ${employeeName} a expiré le ${new Date(expiryDate).toLocaleDateString('fr-FR')}`,
          assigneeId: recipient.id,
          actionUrl: `/admin/employees/${employeeId}/documents`,
          actionLabel: 'Mettre à jour maintenant',
          status: 'active',
          metadata: {
            documentId,
            documentCategory,
            employeeId,
            employeeName,
            fileName,
            expiryDate,
            requiresImmediateAction: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      console.log(`[Inngest] Created ${recipients.length} critical alerts`);

      return { alertsCreated: recipients.length };
    });

    // Step 2: TODO: Send email/SMS notification for critical cases
    await step.run('send-urgent-notification', async () => {
      // Future: integrate with email/SMS service
      console.log('[Inngest] Would send urgent notification for expired document');

      return {
        notificationSent: false,
        reason: 'Email/SMS service not yet implemented',
      };
    });

    return {
      success: true,
      documentId,
      alertsCreated: true,
    };
  }
);
