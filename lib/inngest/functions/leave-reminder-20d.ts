/**
 * Leave Reminder - 20 Days Before
 *
 * Runs daily at 6 AM to send notifications to employees
 * whose leave starts in exactly 20 days
 */

import { inngest } from '../client';
import { db } from '@/db';
import { timeOffRequests, employees, notifications, users, timeOffPolicies } from '@/drizzle/schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const leaveReminder20Days = inngest.createFunction(
  { id: 'leave-reminder-20d', name: 'Leave Reminder - 20 Days Before' },
  { cron: '0 6 * * *' }, // Every day at 6 AM
  async ({ step }) => {
    const result = await step.run('send-20-day-reminders', async () => {
      const today = new Date();
      const twentyDaysFromNow = addDays(today, 20);
      const twentyOneDaysFromNow = addDays(today, 21);

      // Find all approved leaves starting in exactly 20 days
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
            gte(timeOffRequests.startDate, twentyDaysFromNow.toISOString().split('T')[0]),
            lte(timeOffRequests.startDate, twentyOneDaysFromNow.toISOString().split('T')[0]),
            // Only send if not already sent
            isNull(timeOffRequests.reminder20dSentAt)
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

          // Create notification
          await db.insert(notifications).values({
            userId: user.id,
            type: 'leave_reminder_20d',
            title: '⏰ Rappel : Congé dans 20 jours',
            message: `Votre ${policy.name} commence le ${format(new Date(request.startDate), 'dd MMMM yyyy', { locale: fr })}. Pensez à préparer votre passation de charge.`,
            actionUrl: `/employee/time-off/${request.id}`,
          });

          // Mark reminder as sent
          await db.update(timeOffRequests)
            .set({ reminder20dSentAt: new Date().toISOString() })
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
