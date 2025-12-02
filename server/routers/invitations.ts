/**
 * Invitations tRPC Router
 *
 * Manages user invitations for tenant access
 * - Create invitations (with optional email)
 * - List/filter invitations
 * - Resend invitation emails
 * - Revoke pending invitations
 * - Validate and accept invitations
 */

import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  hrManagerProcedure,
  publicProcedure,
} from '../api/trpc';
import { db } from '@/lib/db';
import {
  userInvitations,
  users,
  userTenants,
  employees,
  tenants,
} from '@/lib/db/schema';
import { eq, and, desc, isNull, ne, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { generateInviteToken, generateInviteUrl } from '@/lib/invitations/token';
import {
  generateInvitationEmailHtml,
  generateInvitationEmailText,
  generateInvitationEmailSubject,
} from '@/lib/invitations/email-template';
import { sendEmail } from '@/lib/notifications/email-service';

// Input schemas
const invitableRoles = ['employee', 'manager', 'hr_manager', 'tenant_admin'] as const;

const createInviteSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }).optional(),
  role: z.enum(invitableRoles, {
    errorMap: () => ({ message: 'Role invalide' }),
  }),
  employeeId: z.string().uuid().optional(),
  sendEmail: z.boolean().default(false), // Default to false since email may not be provided
  personalMessage: z.string().max(500).optional(),
});

const listInvitesSchema = z.object({
  status: z.enum(['pending', 'accepted', 'expired', 'revoked', 'all']).default('all'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
  search: z.string().optional(),
});

export const invitationsRouter = createTRPCRouter({
  /**
   * Create a new invitation
   *
   * Creates an invitation record and optionally sends an email.
   * Returns the invitation details including the invite URL for manual sharing.
   */
  create: hrManagerProcedure
    .input(createInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const inviterId = ctx.user.id;

      // If email is provided, check for existing user/invitation
      if (input.email) {
        // Check if user already exists in this tenant
        const existingUser = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(userTenants, eq(users.id, userTenants.userId))
          .where(
            and(
              eq(users.email, input.email),
              eq(userTenants.tenantId, tenantId)
            )
          )
          .limit(1);

        if (existingUser.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cet utilisateur existe deja dans cette entreprise',
          });
        }

        // Check if there's already a pending invitation for this email in this tenant
        const existingInviteResult = await db
          .select({ id: userInvitations.id })
          .from(userInvitations)
          .where(
            and(
              eq(userInvitations.email, input.email),
              eq(userInvitations.tenantId, tenantId),
              eq(userInvitations.status, 'pending')
            )
          )
          .limit(1);

        if (existingInviteResult.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Une invitation est deja en cours pour cet email',
          });
        }
      }

      // If sendEmail is requested but no email provided, throw error
      if (input.sendEmail && !input.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Un email est requis pour envoyer l\'invitation par email',
        });
      }

      // If employeeId provided, verify employee exists and belongs to this tenant
      if (input.employeeId) {
        const employeeResult = await db
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.id, input.employeeId),
              eq(employees.tenantId, tenantId)
            )
          )
          .limit(1);

        if (employeeResult.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Employe non trouve',
          });
        }

        // Check if employee already has a user account
        const employeeUserResult = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.employeeId, input.employeeId))
          .limit(1);

        if (employeeUserResult.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Cet employe a deja un compte utilisateur',
          });
        }
      }

      // Generate secure token
      const { token, expiresAt } = generateInviteToken();
      const inviteUrl = generateInviteUrl(token);

      // Get tenant and inviter info for email
      const [tenantResult, inviterResult] = await Promise.all([
        db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1),
        db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, inviterId))
          .limit(1),
      ]);

      const tenant = tenantResult[0];
      const inviter = inviterResult[0];

      const inviterName = inviter
        ? `${inviter.firstName} ${inviter.lastName}`
        : 'Un administrateur';
      const companyName = tenant?.name || 'Votre entreprise';

      // Create invitation record
      const [invitation] = await db
        .insert(userInvitations)
        .values({
          tenantId,
          email: input.email,
          role: input.role,
          employeeId: input.employeeId,
          token,
          expiresAt,
          invitedBy: inviterId,
        })
        .returning();

      // Send email if requested (already validated that email exists if sendEmail is true)
      let emailSent = false;
      if (input.sendEmail && input.email) {
        const emailResult = await sendEmail({
          to: input.email,
          subject: generateInvitationEmailSubject(companyName),
          html: generateInvitationEmailHtml({
            inviteeEmail: input.email,
            inviterName,
            companyName,
            role: input.role,
            inviteUrl,
            expiresAt,
            personalMessage: input.personalMessage,
          }),
          text: generateInvitationEmailText({
            inviteeEmail: input.email,
            inviterName,
            companyName,
            role: input.role,
            inviteUrl,
            expiresAt,
            personalMessage: input.personalMessage,
          }),
        });

        if (emailResult.success) {
          emailSent = true;
          await db
            .update(userInvitations)
            .set({
              emailSentAt: new Date(),
              lastEmailSentAt: new Date(),
            })
            .where(eq(userInvitations.id, invitation.id));
        }
      }

      return {
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          inviteUrl, // Return URL for manual sharing
        },
        emailSent,
      };
    }),

  /**
   * List invitations for the current tenant
   *
   * Returns paginated list of invitations with optional status filter.
   */
  list: hrManagerProcedure
    .input(listInvitesSchema)
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const { status, page, limit, search } = input;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(userInvitations.tenantId, tenantId)];

      if (status !== 'all') {
        conditions.push(eq(userInvitations.status, status));
      }

      // Get invitations with inviter info
      const invitationsData = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          status: userInvitations.status,
          expiresAt: userInvitations.expiresAt,
          createdAt: userInvitations.createdAt,
          acceptedAt: userInvitations.acceptedAt,
          emailSentAt: userInvitations.emailSentAt,
          emailResentCount: userInvitations.emailResentCount,
          employeeId: userInvitations.employeeId,
          inviterFirstName: users.firstName,
          inviterLastName: users.lastName,
        })
        .from(userInvitations)
        .leftJoin(users, eq(userInvitations.invitedBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(userInvitations.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userInvitations)
        .where(and(...conditions));

      const total = countResult[0]?.count || 0;

      // Check for expired invitations and update status
      const now = new Date();
      const expiredIds = invitationsData
        .filter(
          (inv) =>
            inv.status === 'pending' && inv.expiresAt && new Date(inv.expiresAt) < now
        )
        .map((inv) => inv.id);

      if (expiredIds.length > 0) {
        await db
          .update(userInvitations)
          .set({ status: 'expired' })
          .where(
            and(
              eq(userInvitations.tenantId, tenantId),
              sql`${userInvitations.id} = ANY(${expiredIds})`
            )
          );
      }

      return {
        invitations: invitationsData.map((inv) => ({
          ...inv,
          inviterName: inv.inviterFirstName
            ? `${inv.inviterFirstName} ${inv.inviterLastName}`
            : 'Inconnu',
          // Update status in response if expired
          status: expiredIds.includes(inv.id) ? 'expired' : inv.status,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),

  /**
   * Resend invitation email
   *
   * Resends the invitation email (max 3 times total).
   */
  resend: hrManagerProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const invitationResult = await db
        .select()
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.id, input.invitationId),
            eq(userInvitations.tenantId, tenantId)
          )
        )
        .limit(1);

      const invitation = invitationResult[0];

      if (!invitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvee',
        });
      }

      if (invitation.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation n\'est plus en attente',
        });
      }

      if (invitation.emailResentCount >= 3) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Nombre maximum de renvois atteint (3)',
        });
      }

      // Cannot resend if invitation has no email (link-only invite)
      if (!invitation.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de renvoyer une invitation sans email',
        });
      }

      // Check if expired
      if (new Date() > invitation.expiresAt) {
        await db
          .update(userInvitations)
          .set({ status: 'expired' })
          .where(eq(userInvitations.id, invitation.id));

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation a expire',
        });
      }

      // Get tenant and inviter info
      const [tenantResult2, inviterResult2] = await Promise.all([
        db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1),
        db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, invitation.invitedBy))
          .limit(1),
      ]);

      const tenant2 = tenantResult2[0];
      const inviter2 = inviterResult2[0];

      const inviterName = inviter2
        ? `${inviter2.firstName} ${inviter2.lastName}`
        : 'Un administrateur';
      const companyName = tenant2?.name || 'Votre entreprise';
      const inviteUrl = generateInviteUrl(invitation.token);

      // Send email
      const emailResult = await sendEmail({
        to: invitation.email,
        subject: generateInvitationEmailSubject(companyName),
        html: generateInvitationEmailHtml({
          inviteeEmail: invitation.email,
          inviterName,
          companyName,
          role: invitation.role,
          inviteUrl,
          expiresAt: invitation.expiresAt,
        }),
        text: generateInvitationEmailText({
          inviteeEmail: invitation.email,
          inviterName,
          companyName,
          role: invitation.role,
          inviteUrl,
          expiresAt: invitation.expiresAt,
        }),
      });

      if (!emailResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de l\'envoi de l\'email',
        });
      }

      // Update resent count
      await db
        .update(userInvitations)
        .set({
          emailResentCount: invitation.emailResentCount + 1,
          lastEmailSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userInvitations.id, invitation.id));

      return { success: true };
    }),

  /**
   * Revoke a pending invitation
   */
  revoke: hrManagerProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const revokeInviteResult = await db
        .select({ id: userInvitations.id, status: userInvitations.status })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.id, input.invitationId),
            eq(userInvitations.tenantId, tenantId)
          )
        )
        .limit(1);

      const revokeInvitation = revokeInviteResult[0];

      if (!revokeInvitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvee',
        });
      }

      if (revokeInvitation.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seules les invitations en attente peuvent etre annulees',
        });
      }

      await db
        .update(userInvitations)
        .set({
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .where(eq(userInvitations.id, revokeInvitation.id));

      return { success: true };
    }),

  /**
   * Get invitation link for a pending invitation
   *
   * Used to copy the invite link for manual sharing.
   */
  getInviteLink: hrManagerProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const linkInviteResult = await db
        .select({
          token: userInvitations.token,
          status: userInvitations.status,
          expiresAt: userInvitations.expiresAt,
        })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.id, input.invitationId),
            eq(userInvitations.tenantId, tenantId)
          )
        )
        .limit(1);

      const linkInvitation = linkInviteResult[0];

      if (!linkInvitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvee',
        });
      }

      if (linkInvitation.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation n\'est plus valide',
        });
      }

      if (new Date() > linkInvitation.expiresAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation a expire',
        });
      }

      return {
        inviteUrl: generateInviteUrl(linkInvitation.token),
        expiresAt: linkInvitation.expiresAt,
      };
    }),

  /**
   * Validate a token (public endpoint for invite acceptance page)
   *
   * Returns invitation details if valid, or error info if invalid.
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const validateInviteResult = await db
        .select()
        .from(userInvitations)
        .where(eq(userInvitations.token, input.token))
        .limit(1);

      const validateInvitation = validateInviteResult[0];

      if (!validateInvitation) {
        return {
          valid: false,
          error: 'invalid' as const,
          message: 'Invitation non trouvee',
        };
      }

      if (validateInvitation.status === 'accepted') {
        return {
          valid: false,
          error: 'used' as const,
          message: 'Cette invitation a deja ete acceptee',
        };
      }

      if (validateInvitation.status === 'revoked') {
        return {
          valid: false,
          error: 'revoked' as const,
          message: 'Cette invitation a ete annulee',
        };
      }

      if (validateInvitation.status === 'expired' || new Date() > validateInvitation.expiresAt) {
        // Update status if not already expired
        if (validateInvitation.status !== 'expired') {
          await db
            .update(userInvitations)
            .set({ status: 'expired' })
            .where(eq(userInvitations.id, validateInvitation.id));
        }

        return {
          valid: false,
          error: 'expired' as const,
          message: 'Cette invitation a expire',
        };
      }

      // Get tenant info
      const validateTenantResult = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, validateInvitation.tenantId))
        .limit(1);

      const validateTenant = validateTenantResult[0];

      // Check if user already exists with this email (only if email was provided)
      let existingUser: { id: string; firstName: string; lastName: string } | null = null;
      if (validateInvitation.email) {
        const existingUserResult = await db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.email, validateInvitation.email))
          .limit(1);

        existingUser = existingUserResult[0] || null;
      }

      // Fetch employee data if employeeId is present (to prefill name in signup form)
      let employeeData: { firstName: string; lastName: string; phone: string | null } | null = null;
      if (validateInvitation.employeeId) {
        const employeeResult = await db
          .select({
            firstName: employees.firstName,
            lastName: employees.lastName,
            phone: employees.phone,
          })
          .from(employees)
          .where(eq(employees.id, validateInvitation.employeeId))
          .limit(1);

        employeeData = employeeResult[0] || null;
      }

      return {
        valid: true,
        invitation: {
          id: validateInvitation.id,
          email: validateInvitation.email, // Can be null for link-only invites
          role: validateInvitation.role,
          tenantName: validateTenant?.name || 'Entreprise',
          employeeId: validateInvitation.employeeId,
        },
        // Employee data from the linked employee record (for prefilling signup forms)
        employee: employeeData
          ? {
              firstName: employeeData.firstName,
              lastName: employeeData.lastName,
              phone: employeeData.phone,
            }
          : null,
        existingUser: existingUser
          ? {
              id: existingUser.id,
              name: `${existingUser.firstName} ${existingUser.lastName}`,
            }
          : null,
      };
    }),

  /**
   * Accept invitation (for authenticated users)
   *
   * Links the current user to the tenant with the invited role.
   */
  accept: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const acceptInviteResult = await db
        .select()
        .from(userInvitations)
        .where(eq(userInvitations.token, input.token))
        .limit(1);

      const acceptInvitation = acceptInviteResult[0];

      if (!acceptInvitation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invitation non trouvee',
        });
      }

      if (acceptInvitation.status === 'accepted') {
        // Check if accepted by this user
        if (acceptInvitation.acceptedByUserId === userId) {
          return { success: true, alreadyAccepted: true };
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation a deja ete acceptee',
        });
      }

      if (acceptInvitation.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation n\'est plus valide',
        });
      }

      if (new Date() > acceptInvitation.expiresAt) {
        await db
          .update(userInvitations)
          .set({ status: 'expired' })
          .where(eq(userInvitations.id, acceptInvitation.id));

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette invitation a expire',
        });
      }

      // Check if user already has access to this tenant
      const existingAccessResult = await db
        .select({ id: userTenants.id })
        .from(userTenants)
        .where(
          and(
            eq(userTenants.userId, userId),
            eq(userTenants.tenantId, acceptInvitation.tenantId)
          )
        )
        .limit(1);

      if (existingAccessResult.length > 0) {
        // Mark invitation as accepted but don't create duplicate access
        await db
          .update(userInvitations)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedByUserId: userId,
            updatedAt: new Date(),
          })
          .where(eq(userInvitations.id, acceptInvitation.id));

        return { success: true, alreadyHadAccess: true };
      }

      // Create user_tenants record
      await db.insert(userTenants).values({
        userId,
        tenantId: acceptInvitation.tenantId,
        role: acceptInvitation.role,
      });

      // Link employee if specified
      if (acceptInvitation.employeeId) {
        await db
          .update(users)
          .set({
            employeeId: acceptInvitation.employeeId,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }

      // Set as active tenant
      await db
        .update(users)
        .set({
          activeTenantId: acceptInvitation.tenantId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Mark invitation as accepted
      await db
        .update(userInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(userInvitations.id, acceptInvitation.id));

      return { success: true, tenantId: acceptInvitation.tenantId };
    }),

  /**
   * Get employees without user accounts (for invite wizard)
   *
   * Returns employees in the tenant that don't have linked user accounts.
   */
  getInvitableEmployees: hrManagerProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      // Get employees without user accounts
      const employeesData = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          email: employees.email,
          jobTitle: employees.jobTitle,
          employeeNumber: employees.employeeNumber,
        })
        .from(employees)
        .leftJoin(users, eq(employees.id, users.employeeId))
        .where(
          and(
            eq(employees.tenantId, tenantId),
            isNull(users.id), // No linked user
            isNull(employees.terminationDate) // Active employees only
          )
        )
        .limit(input.limit);

      // Filter by search if provided
      let filtered = employeesData;
      if (input.search) {
        const searchLower = input.search.toLowerCase();
        filtered = employeesData.filter(
          (e) =>
            e.firstName?.toLowerCase().includes(searchLower) ||
            e.lastName?.toLowerCase().includes(searchLower) ||
            e.email?.toLowerCase().includes(searchLower) ||
            e.employeeNumber?.toLowerCase().includes(searchLower)
        );
      }

      return filtered.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        email: e.email,
        jobTitle: e.jobTitle,
        employeeNumber: e.employeeNumber,
      }));
    }),

  /**
   * Get team members (users with access to this tenant)
   *
   * Returns all users who have access to the current tenant.
   */
  getTeamMembers: hrManagerProcedure
    .input(
      z.object({
        status: z.enum(['active', 'inactive', 'all']).default('all'),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const { status, page, limit } = input;
      const offset = (page - 1) * limit;

      // Build conditions
      const conditions = [eq(userTenants.tenantId, tenantId)];

      if (status !== 'all') {
        conditions.push(eq(users.status, status));
      }

      // Get team members
      const members = await db
        .select({
          userId: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarUrl: users.avatarUrl,
          role: userTenants.role,
          status: users.status,
          lastLoginAt: users.lastLoginAt,
          employeeId: users.employeeId,
          createdAt: userTenants.createdAt,
        })
        .from(userTenants)
        .innerJoin(users, eq(userTenants.userId, users.id))
        .where(and(...conditions))
        .orderBy(users.firstName)
        .limit(limit)
        .offset(offset);

      // Get count
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userTenants)
        .innerJoin(users, eq(userTenants.userId, users.id))
        .where(and(...conditions));

      const total = countResult[0]?.count || 0;

      return {
        members: members.map((m) => ({
          id: m.userId,
          email: m.email,
          name: `${m.firstName} ${m.lastName}`,
          avatarUrl: m.avatarUrl,
          role: m.role,
          status: m.status,
          lastLoginAt: m.lastLoginAt,
          employeeId: m.employeeId,
          joinedAt: m.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }),
});
