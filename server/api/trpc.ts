/**
 * tRPC Server Configuration (v11)
 *
 * This file contains the core tRPC setup:
 * - Procedure definitions
 * - Middleware
 * - Router factory
 */

import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context';
import superjson from 'superjson';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a new tRPC router
 */
export const router = t.router;
export const createTRPCRouter = t.router; // Alias for backwards compatibility

/**
 * Create caller factory for server-side calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check if user exists (ctx.user is now nullable after context update)
  if (!ctx.user || !ctx.hasRealSession) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Non authentifié'
    });
  }

  return next({
    ctx: {
      // Infers the `user` as non-nullable
      user: ctx.user,
      db: ctx.db,
      hasRealSession: ctx.hasRealSession,
    },
  });
});

/**
 * Employee procedure - requires employee role or higher
 * Accessible by: employee, manager, hr_manager, tenant_admin, super_admin
 */
export const employeeProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const allowedRoles = ['employee', 'manager', 'hr_manager', 'tenant_admin', 'super_admin'];

  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Accès refusé - Rôle employé requis'
    });
  }

  return next({ ctx });
});

/**
 * Manager procedure - requires manager role or higher
 * Accessible by: manager, hr_manager, tenant_admin, super_admin
 */
export const managerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const allowedRoles = ['manager', 'hr_manager', 'tenant_admin', 'super_admin'];

  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Accès refusé - Rôle manager requis'
    });
  }

  return next({ ctx });
});

/**
 * HR Manager procedure - requires hr_manager role or higher
 * Accessible by: hr_manager, tenant_admin, super_admin
 */
export const hrManagerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const allowedRoles = ['hr_manager', 'tenant_admin', 'super_admin'];

  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Accès refusé - Rôle RH requis'
    });
  }

  return next({ ctx });
});

/**
 * Admin procedure - requires tenant_admin role or higher
 * Accessible by: tenant_admin, super_admin
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const allowedRoles = ['tenant_admin', 'super_admin'];

  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Accès refusé - Rôle administrateur requis'
    });
  }

  return next({ ctx });
});

/**
 * Super admin procedure - requires super_admin role
 * Accessible by: super_admin only
 */
export const superAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'super_admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Accès refusé - Rôle super administrateur requis'
    });
  }

  return next({ ctx });
});
