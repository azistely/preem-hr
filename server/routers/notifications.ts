import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { db } from '@/db';
import { notifications } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export const notificationsRouter = createTRPCRouter({
  getUnread: protectedProcedure.query(async ({ ctx }) => {
    const unread = await db.query.notifications.findMany({
      where: and(
        eq(notifications.userId, ctx.user.id),
        eq(notifications.read, false)
      ),
      orderBy: [desc(notifications.createdAt)],
      limit: 20,
    });

    return unread;
  }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ input }) => {
      await db.update(notifications)
        .set({ read: true, readAt: new Date().toISOString() })
        .where(eq(notifications.id, input.notificationId));

      return { success: true };
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.update(notifications)
      .set({ read: true, readAt: new Date().toISOString() })
      .where(and(
        eq(notifications.userId, ctx.user.id),
        eq(notifications.read, false)
      ));

    return { success: true };
  }),
});
