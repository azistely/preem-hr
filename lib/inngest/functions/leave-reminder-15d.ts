/**
 * Leave Reminder - 15 Days Before (with Certificate Generation)
 *
 * Runs daily at 6 AM to:
 * 1. Send notifications to employees whose leave starts in exactly 15 days
 * 2. Generate PDF certificate (required by law)
 */

import { inngest } from '../client';
import { db } from '@/db';
import { timeOffRequests, employees, notifications, users, timeOffPolicies } from '@/drizzle/schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateLeaveCertificate } from '@/lib/documents/leave-certificate-service';

export const leaveReminder15Days = inngest.createFunction(
  { id: 'leave-reminder-15d', name: 'Leave Reminder - 15 Days Before + Certificate' },
  { cron: '0 6 * * *' }, // Every day at 6 AM
  async ({ step }) => {
    const result = await step.run('send-15-day-reminders-and-certificates', async () => {
      const today = new Date();
      const fifteenDaysFromNow = addDays(today, 15);
      const sixteenDaysFromNow = addDays(today, 16);

      // Find all approved leaves starting in exactly 15 days
      const requests = await db
        .select({
          request: timeOffRequests,
          employee: employees,
          user: users,
          policy: timeOffPolicies,
        })
        .from(timeOffRequests)
        .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
        .leftJoin(users, eq(employees.userId, users.id))
        .innerJoin(timeOffPolicies, eq(timeOffRequests.policyId, timeOffPolicies.id))
        .where(
          and(
            eq(timeOffRequests.status, 'approved'),
            gte(timeOffRequests.startDate, fifteenDaysFromNow.toISOString().split('T')[0]),
            lte(timeOffRequests.startDate, sixteenDaysFromNow.toISOString().split('T')[0]),
            // Only send if not already sent
            isNull(timeOffRequests.reminder15dSentAt)
          )
        );

      const results = {
        success: 0,
        errors: [] as Array<{ requestId: string; error: string }>,
      };

      for (const { request, employee, user, policy } of requests) {
        try {
          if (!user) {
            throw new Error('Utilisateur introuvable pour cet employé');
          }

          // Generate PDF certificate
          const certificateBlob = await generateLeaveCertificate(
            request.id,
            request.tenantId
          );

          // TODO: Upload certificate to Supabase storage
          // For now, we mark it as generated (done in generateLeaveCertificate)

          // Create notification
          await db.insert(notifications).values({
            userId: user.id,
            type: 'leave_reminder_15d',
            title: '📄 Attestation de congé générée',
            message: `Votre attestation de départ en congé a été générée. Votre congé commence le ${format(new Date(request.startDate), 'dd MMMM yyyy', { locale: fr })}. Veuillez compléter votre passation de charge si ce n'est pas déjà fait.`,
            actionUrl: `/employee/time-off/${request.id}`,
          });

          // Mark reminder as sent
          await db.update(timeOffRequests)
            .set({ reminder15dSentAt: new Date().toISOString() })
            .where(eq(timeOffRequests.id, request.id));

          results.success++;
        } catch (error) {
          results.errors.push({
            requestId: request.id,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          });
        }
      }

      return results;
    });

    return result;
  }
);
