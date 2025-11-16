/**
 * Tenant tRPC Router
 *
 * Provides type-safe API endpoints for tenant operations including
 * tenant switching for users who work with multiple companies.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../api/trpc';
import { db } from '@/lib/db';
import { tenants, users, userTenants } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { seedTimeOffPoliciesForTenant } from '@/features/time-off/services/policy-seeding.service';
import {
  TenantSettingsSchema,
  UpdateCompanyGeneralInfoInputSchema,
  UpdateCompanyLegalInfoInputSchema,
  AddFundInputSchema,
  UpdateFundInputSchema,
  type TenantSettings,
  type CompanyGeneralInfo,
  type CompanyLegalInfo,
  type FundAccount,
} from '@/lib/db/schema/tenant-settings.schema';

export const tenantRouter = createTRPCRouter({
  /**
   * Get current tenant information
   *
   * Returns tenant details including country code for payroll configuration.
   * Uses the authenticated user's activeTenantId or tenantId from the session context.
   *
   * @example
   * ```typescript
   * const tenant = await trpc.tenant.getCurrent.query();
   * // tenant = { id: '...', name: 'Company', countryCode: 'CI', ... }
   * ```
   */
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      // Use active_tenant_id if set, otherwise fallback to tenant_id
      const tenantId = ctx.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active tenant selected',
        });
      }

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      // Parse settings with defaults
      const settings = (tenant.settings as TenantSettings) || {};

      // Backward compatibility: Merge old top-level fields with settings.company
      // If settings.company is empty, populate from legacy fields
      const companyInfo = settings.company || {};
      const mergedCompanyInfo = {
        legalName: companyInfo.legalName || tenant.name,
        address: companyInfo.address,
        phone: companyInfo.phone,
        email: companyInfo.email,
        tradeName: companyInfo.tradeName,
        legalRepresentative: companyInfo.legalRepresentative,
        foundedDate: companyInfo.foundedDate,
      };

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        countryCode: tenant.countryCode,
        currency: tenant.currency,
        timezone: tenant.timezone,
        cgeciSectorCode: tenant.cgeciSectorCode,
        genericSectorCode: tenant.genericSectorCode,

        // Company information from settings (with backward compatibility)
        company: mergedCompanyInfo,
        legal: settings.legal || {},
        funds: settings.funds || [],
      };
    }),

  /**
   * Get list of tenants the current user has access to
   *
   * Returns all tenants from the user_tenants junction table.
   * Used for the tenant switcher dropdown.
   *
   * @example
   * ```typescript
   * const tenants = await trpc.tenant.listUserTenants.query();
   * // tenants = [{ id, name, slug, countryCode, userRole }, ...]
   * ```
   */
  listUserTenants: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;

      // Query user_tenants junction table with joined tenant data
      const userTenantRecords = await db
        .select({
          tenantId: userTenants.tenantId,
          userRole: userTenants.role,
          tenantName: tenants.name,
          tenantSlug: tenants.slug,
          tenantCountryCode: tenants.countryCode,
          tenantStatus: tenants.status,
        })
        .from(userTenants)
        .innerJoin(tenants, eq(userTenants.tenantId, tenants.id))
        .where(eq(userTenants.userId, userId))
        .orderBy(tenants.name);

      return userTenantRecords.map((record) => ({
        id: record.tenantId,
        name: record.tenantName,
        slug: record.tenantSlug,
        countryCode: record.tenantCountryCode,
        userRole: record.userRole,
        status: record.tenantStatus,
      }));
    }),

  /**
   * Get the current active tenant for the user
   *
   * Returns the tenant that is currently selected via active_tenant_id.
   *
   * @example
   * ```typescript
   * const activeTenant = await trpc.tenant.getActiveTenant.query();
   * // activeTenant = { id, name, slug, countryCode } or null
   * ```
   */
  getActiveTenant: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        columns: {
          activeTenantId: true,
        },
      });

      if (!user?.activeTenantId) {
        return null;
      }

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, user.activeTenantId),
      });

      if (!tenant) {
        return null;
      }

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        countryCode: tenant.countryCode,
        currency: tenant.currency,
      };
    }),

  /**
   * Switch to a different tenant
   *
   * Updates the user's active_tenant_id to the specified tenant.
   * Validates that the user has access to the tenant via user_tenants.
   *
   * @example
   * ```typescript
   * await trpc.tenant.switchTenant.mutate({ tenantId: 'uuid-here' });
   * ```
   */
  switchTenant: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const { tenantId } = input;

      // 1. Verify user has access to this tenant
      const hasAccess = await db.query.userTenants.findFirst({
        where: and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        ),
      });

      if (!hasAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas accès à cette entreprise',
        });
      }

      // 2. Verify tenant exists and is active
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      if (tenant.status !== 'active') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cette entreprise est inactive',
        });
      }

      // 3. Update user's active_tenant_id
      await db
        .update(users)
        .set({
          activeTenantId: tenantId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return {
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          countryCode: tenant.countryCode,
        },
      };
    }),

  /**
   * Admin: Add a user to a tenant
   *
   * Grants a user access to a tenant by creating a user_tenants record.
   * Only accessible by super_admin and tenant_admin roles.
   *
   * @example
   * ```typescript
   * await trpc.tenant.addUserToTenant.mutate({
   *   userId: 'uuid-here',
   *   tenantId: 'uuid-here',
   *   role: 'hr_manager'
   * });
   * ```
   */
  addUserToTenant: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      tenantId: z.string().uuid(),
      role: z.enum(['super_admin', 'tenant_admin', 'hr_manager', 'manager', 'employee']),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only super_admin or tenant_admin can grant access
      if (!['super_admin', 'tenant_admin'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas la permission d\'ajouter des utilisateurs',
        });
      }

      const { userId, tenantId, role } = input;

      // Verify tenant exists
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Insert or update user_tenants record
      await db
        .insert(userTenants)
        .values({
          userId,
          tenantId,
          role,
        })
        .onConflictDoUpdate({
          target: [userTenants.userId, userTenants.tenantId],
          set: {
            role,
            updatedAt: new Date(),
          },
        });

      return {
        success: true,
        message: `Utilisateur ajouté à ${tenant.name}`,
      };
    }),

  /**
   * Admin: Remove a user from a tenant
   *
   * Revokes a user's access to a tenant by deleting the user_tenants record.
   * Prevents removing the last tenant from a user.
   *
   * @example
   * ```typescript
   * await trpc.tenant.removeUserFromTenant.mutate({
   *   userId: 'uuid-here',
   *   tenantId: 'uuid-here',
   * });
   * ```
   */
  removeUserFromTenant: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      tenantId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only super_admin or tenant_admin can revoke access
      if (!['super_admin', 'tenant_admin'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas la permission de retirer des utilisateurs',
        });
      }

      const { userId, tenantId } = input;

      // Prevent removing user's last tenant
      const userTenantCount = await db
        .select()
        .from(userTenants)
        .where(eq(userTenants.userId, userId));

      if (userTenantCount.length <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Impossible de retirer le dernier accès de l\'utilisateur',
        });
      }

      // Delete user_tenants record
      await db
        .delete(userTenants)
        .where(
          and(
            eq(userTenants.userId, userId),
            eq(userTenants.tenantId, tenantId)
          )
        );

      // If this was the active tenant, clear it
      await db
        .update(users)
        .set({
          activeTenantId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, userId),
            eq(users.activeTenantId, tenantId)
          )
        );

      return {
        success: true,
        message: 'Accès retiré',
      };
    }),

  /**
   * Create a new tenant/company
   *
   * Creates a new tenant and automatically adds the creator as tenant_admin.
   * The user is automatically switched to the new tenant.
   * Intended to be used before redirecting to onboarding.
   *
   * @example
   * ```typescript
   * const result = await trpc.tenant.createTenant.mutate({
   *   name: 'Nouvelle Entreprise SARL',
   *   countryCode: 'CI',
   * });
   * // User is now switched to the new tenant
   * // Redirect to /onboarding/q1
   * ```
   */
  createTenant: protectedProcedure
    .input(z.object({
      name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
      countryCode: z.string().length(2).default('CI'),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only tenant_admin or super_admin can create tenants
      if (!['tenant_admin', 'super_admin'].includes(ctx.user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas la permission de créer des entreprises',
        });
      }

      const { name, countryCode } = input;

      // Generate slug with conflict handling
      const baseSlug = generateTenantSlug(name);
      let slug = baseSlug;
      let attempt = 0;
      const maxAttempts = 10;

      // Try to find a unique slug
      while (attempt < maxAttempts) {
        const existing = await db.query.tenants.findFirst({
          where: eq(tenants.slug, slug),
        });

        if (!existing) {
          break; // Slug is unique
        }

        // Append random suffix if conflict
        attempt++;
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        slug = `${baseSlug}-${randomSuffix}`;
      }

      if (attempt >= maxAttempts) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de générer un identifiant unique pour l\'entreprise',
        });
      }

      // Get country details for currency and timezone defaults
      const countryDefaults: Record<string, { currency: string; timezone: string }> = {
        'CI': { currency: 'XOF', timezone: 'Africa/Abidjan' },
        'SN': { currency: 'XOF', timezone: 'Africa/Dakar' },
        'BF': { currency: 'XOF', timezone: 'Africa/Ouagadougou' },
        'ML': { currency: 'XOF', timezone: 'Africa/Bamako' },
        'TG': { currency: 'XOF', timezone: 'Africa/Lome' },
        'BJ': { currency: 'XOF', timezone: 'Africa/Porto-Novo' },
        'NE': { currency: 'XOF', timezone: 'Africa/Niamey' },
        'GW': { currency: 'XOF', timezone: 'Africa/Bissau' },
      };

      const defaults = countryDefaults[countryCode] || countryDefaults['CI'];

      // Create the tenant
      const [newTenant] = await db
        .insert(tenants)
        .values({
          name,
          slug,
          countryCode,
          currency: defaults.currency,
          timezone: defaults.timezone,
          sectorCode: 'SERVICES', // Default sector (lowest risk)
          plan: 'trial',
          status: 'active',
        })
        .returning();

      if (!newTenant) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur lors de la création de l\'entreprise',
        });
      }

      // Add creator to user_tenants as tenant_admin
      await db
        .insert(userTenants)
        .values({
          userId: ctx.user.id,
          tenantId: newTenant.id,
          role: 'tenant_admin',
        });

      // Seed time-off policies from templates for the tenant's country
      let policiesSeeded = 0;
      try {
        policiesSeeded = await seedTimeOffPoliciesForTenant(
          newTenant.id,
          countryCode,
          ctx.user.id
        );
        console.log(`[Tenant Creation] Seeded ${policiesSeeded} time-off policies for ${newTenant.name}`);
      } catch (error) {
        // Log error but don't fail tenant creation
        console.error('[Tenant Creation] Failed to seed time-off policies:', error);
      }

      // Switch user to the new tenant
      await db
        .update(users)
        .set({
          activeTenantId: newTenant.id,
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return {
        success: true,
        tenant: {
          id: newTenant.id,
          name: newTenant.name,
          slug: newTenant.slug,
          countryCode: newTenant.countryCode,
        },
        policiesSeeded,
        message: `Entreprise "${newTenant.name}" créée avec succès`,
      };
    }),

  /**
   * Update company information
   *
   * Updates general and/or legal information in tenant settings.
   * Uses tenant from authenticated context (ctx.user.tenantId).
   *
   * @example
   * ```typescript
   * await trpc.tenant.updateCompanyInfo.mutate({
   *   generalInfo: {
   *     legalName: 'Preem Technologies SARL',
   *     address: '01 BP 1234 Abidjan 01',
   *   },
   *   legalInfo: {
   *     socialSecurityNumber: '12345678',
   *     taxId: 'CI202056789',
   *   },
   * });
   * ```
   */
  updateCompanyInfo: protectedProcedure
    .input(z.object({
      generalInfo: UpdateCompanyGeneralInfoInputSchema.optional(),
      legalInfo: UpdateCompanyLegalInfoInputSchema.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch current tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Parse existing settings
      const currentSettings = (tenant.settings as TenantSettings) || {};

      // Merge updates
      const updatedSettings: TenantSettings = {
        ...currentSettings,
        company: input.generalInfo ? {
          ...currentSettings.company,
          ...input.generalInfo,
        } : currentSettings.company,
        legal: input.legalInfo ? {
          ...currentSettings.legal,
          ...input.legalInfo,
        } : currentSettings.legal,
      };

      // Update tenant with merged settings
      await db
        .update(tenants)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        message: 'Informations de l\'entreprise mises à jour',
      };
    }),

  /**
   * Add a new fund/caisse to the tenant
   *
   * Adds a fund account (tax office, social security, insurance, etc.)
   * to the tenant's settings. Auto-generates UUID for the fund.
   *
   * @example
   * ```typescript
   * await trpc.tenant.addFund.mutate({
   *   name: 'CNPS (Caisse Nationale de Prévoyance Sociale)',
   *   accountNumber: 'CNPS-12345678',
   *   contact: 'cnps@gouv.ci',
   *   type: 'social',
   * });
   * ```
   */
  addFund: protectedProcedure
    .input(AddFundInputSchema)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch current tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Parse existing settings
      const currentSettings = (tenant.settings as TenantSettings) || {};
      const currentFunds = currentSettings.funds || [];

      // Create new fund with UUID
      const newFund: FundAccount = {
        ...input,
        id: crypto.randomUUID(),
      };

      // Add to funds array
      const updatedSettings: TenantSettings = {
        ...currentSettings,
        funds: [...currentFunds, newFund],
      };

      // Update tenant
      await db
        .update(tenants)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        fund: newFund,
        message: `Caisse "${newFund.name}" ajoutée`,
      };
    }),

  /**
   * Update an existing fund/caisse
   *
   * Updates a fund account by ID. Only updates provided fields.
   *
   * @example
   * ```typescript
   * await trpc.tenant.updateFund.mutate({
   *   id: 'uuid-here',
   *   accountNumber: 'CNPS-87654321',
   * });
   * ```
   */
  updateFund: protectedProcedure
    .input(UpdateFundInputSchema)
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch current tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Parse existing settings
      const currentSettings = (tenant.settings as TenantSettings) || {};
      const currentFunds = currentSettings.funds || [];

      // Find fund to update
      const fundIndex = currentFunds.findIndex((f) => f.id === input.id);

      if (fundIndex === -1) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Caisse non trouvée',
        });
      }

      // Update fund (merge with existing)
      const updatedFund: FundAccount = {
        ...currentFunds[fundIndex],
        ...input,
        id: input.id, // Preserve ID
      };

      // Replace in array
      const updatedFunds = [...currentFunds];
      updatedFunds[fundIndex] = updatedFund;

      const updatedSettings: TenantSettings = {
        ...currentSettings,
        funds: updatedFunds,
      };

      // Update tenant
      await db
        .update(tenants)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        fund: updatedFund,
        message: `Caisse "${updatedFund.name}" mise à jour`,
      };
    }),

  /**
   * Remove a fund/caisse from the tenant
   *
   * Deletes a fund account by ID from the tenant's settings.
   *
   * @example
   * ```typescript
   * await trpc.tenant.removeFund.mutate({ fundId: 'uuid-here' });
   * ```
   */
  removeFund: protectedProcedure
    .input(z.object({
      fundId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch current tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Parse existing settings
      const currentSettings = (tenant.settings as TenantSettings) || {};
      const currentFunds = currentSettings.funds || [];

      // Find fund to delete
      const fundToDelete = currentFunds.find((f) => f.id === input.fundId);

      if (!fundToDelete) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Caisse non trouvée',
        });
      }

      // Remove from array
      const updatedFunds = currentFunds.filter((f) => f.id !== input.fundId);

      const updatedSettings: TenantSettings = {
        ...currentSettings,
        funds: updatedFunds,
      };

      // Update tenant
      await db
        .update(tenants)
        .set({
          settings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        message: `Caisse "${fundToDelete.name}" supprimée`,
      };
    }),

  /**
   * Get tenant information (alias for getCurrent)
   *
   * Returns tenant details including settings.
   * Used by components that need access to full tenant settings.
   *
   * @example
   * ```typescript
   * const tenant = await trpc.tenant.getTenant.query();
   * // tenant = { id, name, countryCode, settings: { documents, company, legal, funds } }
   * ```
   */
  getTenant: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.user.tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No active tenant selected',
        });
      }

      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Tenant not found',
        });
      }

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        countryCode: tenant.countryCode,
        currency: tenant.currency,
        timezone: tenant.timezone,
        settings: tenant.settings as TenantSettings,
      };
    }),

  /**
   * Update tenant settings
   *
   * Updates the tenant's settings JSONB field.
   * Used for storing flexible configuration like company documents.
   *
   * @example
   * ```typescript
   * await trpc.tenant.updateTenantSettings.mutate({
   *   settings: {
   *     documents: {
   *       businessRegistration: 'https://...',
   *       taxCertificate: 'https://...',
   *     },
   *   },
   * });
   * ```
   */
  updateTenantSettings: protectedProcedure
    .input(z.object({
      settings: z.record(z.any()),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch current tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Update tenant with new settings
      await db
        .update(tenants)
        .set({
          settings: input.settings,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        message: 'Paramètres mis à jour avec succès',
      };
    }),

  /**
   * Update sector settings (sector, work accident rate, industry)
   *
   * Updates sector configuration along with custom work accident rate and industry.
   * Similar to onboarding Q1 but for settings page.
   *
   * @example
   * ```typescript
   * await trpc.tenant.updateSectorSettings.mutate({
   *   cgeciSectorCode: 'COMMERCE',
   *   workAccidentRate: 2.5,
   *   industry: 'Vente de vêtements',
   * });
   * ```
   */
  updateSectorSettings: protectedProcedure
    .input(z.object({
      cgeciSectorCode: z.string().optional(),
      workAccidentRate: z.number().min(0).max(10).optional(),
      industry: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const tenantId = ctx.user.tenantId;

      // Fetch current tenant
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      });

      if (!tenant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Entreprise non trouvée',
        });
      }

      // Parse existing settings
      const currentSettings = (tenant.settings as TenantSettings) || {};

      // Update settings with sector info
      const updatedSettings: TenantSettings = {
        ...currentSettings,
        company: {
          ...currentSettings.company,
          ...(input.industry !== undefined && { industry: input.industry }),
        },
        legal: {
          ...currentSettings.legal,
          ...(input.workAccidentRate !== undefined && { workAccidentRate: input.workAccidentRate }),
        },
      };

      // Prepare tenant updates
      const tenantUpdates: any = {
        settings: updatedSettings,
        updatedAt: new Date(),
      };

      // If sector is being updated, also update the sector field
      if (input.cgeciSectorCode) {
        tenantUpdates.sector = input.cgeciSectorCode;
      }

      // Update tenant
      await db
        .update(tenants)
        .set(tenantUpdates)
        .where(eq(tenants.id, tenantId));

      return {
        success: true,
        message: 'Configuration du secteur mise à jour',
      };
    }),
});

/**
 * Generate tenant slug from company name
 * Same logic as signup flow
 */
function generateTenantSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Spaces to dashes
    .replace(/-+/g, '-') // Multiple dashes to single
    .replace(/^-|-$/g, '') // Trim dashes
    .substring(0, 50); // Max length
}
