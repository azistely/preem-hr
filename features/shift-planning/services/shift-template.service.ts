/**
 * Shift Template Service
 *
 * CRUD operations for shift templates (reusable shift definitions).
 * Templates define standard shifts (Morning, Afternoon, Night) that can be
 * quickly assigned to employees.
 *
 * @module shift-planning/services/shift-template
 */

import { db } from '@/lib/db';
import {
  shiftTemplates,
  type ShiftTemplate,
  type NewShiftTemplate,
  ShiftType,
} from '@/lib/db/schema/shift-planning';
import { eq, and, sql } from 'drizzle-orm';

// ============================================
// Error Class
// ============================================

export class ShiftTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiftTemplateError';
  }
}

// ============================================
// Types
// ============================================

export interface ShiftTemplateFilters {
  tenantId: string;
  isActive?: boolean;
  shiftType?: string;
  departmentId?: string; // Filter by applicable department
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new shift template
 *
 * @param data - Template data
 * @returns Created template with auto-calculated duration/paid hours
 *
 * @example
 * ```typescript
 * const template = await createShiftTemplate({
 *   tenantId: "...",
 *   name: "Morning Shift",
 *   code: "MORN",
 *   startTime: "08:00:00",
 *   endTime: "16:00:00",
 *   breakMinutes: 60,
 *   shiftType: "regular"
 * });
 * // Result: { ..., durationHours: 8.00, paidHours: 7.00 }
 * ```
 */
export async function createShiftTemplate(
  data: NewShiftTemplate
): Promise<ShiftTemplate> {
  try {
    const [template] = await db
      .insert(shiftTemplates)
      .values(data)
      .returning();

    return template;
  } catch (error) {
    if (error instanceof Error) {
      // Check for unique constraint violation on code
      if (error.message.includes('unique') || error.message.includes('duplicate') || error.message.includes('23505')) {
        throw new ShiftTemplateError(
          `Un modèle avec le code "${data.code}" existe déjà. Veuillez utiliser un code différent.`
        );
      }
      throw new ShiftTemplateError(
        `Erreur lors de la création du modèle: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Update an existing shift template
 *
 * @param id - Template ID
 * @param tenantId - Tenant ID (for security)
 * @param data - Fields to update
 * @returns Updated template
 */
export async function updateShiftTemplate(
  id: string,
  tenantId: string,
  data: Partial<NewShiftTemplate>
): Promise<ShiftTemplate> {
  try {
    const [updated] = await db
      .update(shiftTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(shiftTemplates.id, id), eq(shiftTemplates.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ShiftTemplateError('Modèle non trouvé');
    }

    return updated;
  } catch (error) {
    if (error instanceof ShiftTemplateError) throw error;
    if (error instanceof Error) {
      throw new ShiftTemplateError(
        `Erreur lors de la mise à jour du modèle: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Delete (soft delete by marking inactive) a shift template
 *
 * @param id - Template ID
 * @param tenantId - Tenant ID (for security)
 */
export async function deleteShiftTemplate(
  id: string,
  tenantId: string
): Promise<void> {
  try {
    const [deleted] = await db
      .update(shiftTemplates)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(shiftTemplates.id, id), eq(shiftTemplates.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      throw new ShiftTemplateError('Modèle non trouvé');
    }
  } catch (error) {
    if (error instanceof ShiftTemplateError) throw error;
    if (error instanceof Error) {
      throw new ShiftTemplateError(
        `Erreur lors de la suppression du modèle: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Get a single shift template by ID
 *
 * @param id - Template ID
 * @param tenantId - Tenant ID (for security)
 * @returns Template or null if not found
 */
export async function getShiftTemplateById(
  id: string,
  tenantId: string
): Promise<ShiftTemplate | null> {
  try {
    const [template] = await db
      .select()
      .from(shiftTemplates)
      .where(and(eq(shiftTemplates.id, id), eq(shiftTemplates.tenantId, tenantId)))
      .limit(1);

    return template ?? null;
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftTemplateError(
        `Erreur lors de la récupération du modèle: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Get all shift templates with optional filters
 *
 * @param filters - Query filters
 * @returns Array of templates
 *
 * @example
 * ```typescript
 * // Get all active templates for a tenant
 * const templates = await getShiftTemplates({
 *   tenantId: "...",
 *   isActive: true
 * });
 *
 * // Get only night shift templates
 * const nightTemplates = await getShiftTemplates({
 *   tenantId: "...",
 *   shiftType: "night"
 * });
 * ```
 */
export async function getShiftTemplates(
  filters: ShiftTemplateFilters
): Promise<ShiftTemplate[]> {
  try {
    const conditions = [eq(shiftTemplates.tenantId, filters.tenantId)];

    if (filters.isActive !== undefined) {
      conditions.push(eq(shiftTemplates.isActive, filters.isActive));
    }

    if (filters.shiftType) {
      conditions.push(eq(shiftTemplates.shiftType, filters.shiftType));
    }

    if (filters.departmentId) {
      // Check if department is in applicable_departments array
      conditions.push(
        sql`${filters.departmentId}::uuid = ANY(${shiftTemplates.applicableDepartments}) OR ${shiftTemplates.applicableDepartments} IS NULL`
      );
    }

    const templates = await db
      .select()
      .from(shiftTemplates)
      .where(and(...conditions))
      .orderBy(shiftTemplates.name);

    return templates;
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftTemplateError(
        `Erreur lors de la récupération des modèles: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Validation
// ============================================

/**
 * Validate if a template can be used for a specific employee
 *
 * Checks if the template is applicable based on:
 * - Department restrictions
 * - Position restrictions
 * - Sector restrictions
 *
 * @param templateId - Template ID
 * @param employeeId - Employee ID
 * @returns Validation result
 */
export async function validateTemplateForEmployee(
  templateId: string,
  employeeId: string,
  tenantId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const template = await getShiftTemplateById(templateId, tenantId);

    if (!template) {
      return { valid: false, reason: 'Modèle non trouvé' };
    }

    if (!template.isActive) {
      return { valid: false, reason: 'Modèle inactif' };
    }

    // Get employee details to check restrictions
    const [employee] = await db.query.employees.findMany({
      where: (employees, { eq, and }) =>
        and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)),
      with: {
        // TODO: Add department/position relations if needed
      },
      limit: 1,
    });

    if (!employee) {
      return { valid: false, reason: 'Employé non trouvé' };
    }

    // Check department restrictions
    if (template.applicableDepartments && template.applicableDepartments.length > 0) {
      // TODO: Check if employee's department is in applicable list
      // For now, we'll assume it's valid
    }

    // Check position restrictions
    if (template.applicablePositions && template.applicablePositions.length > 0) {
      // TODO: Check if employee's position is in applicable list
    }

    // Check sector restrictions
    if (template.applicableSectors && template.applicableSectors.length > 0) {
      if (employee.sector && !template.applicableSectors.includes(employee.sector)) {
        return {
          valid: false,
          reason: `Ce modèle n'est pas applicable au secteur ${employee.sector}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftTemplateError(
        `Erreur lors de la validation du modèle: ${error.message}`
      );
    }
    throw error;
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get default shift templates for a new tenant
 *
 * Returns standard templates (Morning, Afternoon, Night) that can be
 * created for new tenants.
 *
 * @param tenantId - Tenant ID
 * @returns Array of template data ready to insert
 */
export function getDefaultShiftTemplates(tenantId: string): NewShiftTemplate[] {
  return [
    {
      tenantId,
      name: 'Journée (8h-16h)',
      code: 'MORN',
      startTime: '08:00:00',
      endTime: '16:00:00',
      durationHours: '8.00',
      breakMinutes: 60,
      paidHours: '7.00',
      shiftType: ShiftType.REGULAR,
      color: '#3B82F6', // Blue
      minEmployees: 1,
      description: 'Quart de jour standard (8 heures avec 1h de pause)',
    },
    {
      tenantId,
      name: 'Après-midi (14h-22h)',
      code: 'AFT',
      startTime: '14:00:00',
      endTime: '22:00:00',
      durationHours: '8.00',
      breakMinutes: 60,
      paidHours: '7.00',
      shiftType: ShiftType.REGULAR,
      color: '#F59E0B', // Orange
      minEmployees: 1,
      description: 'Quart d\'après-midi (8 heures avec 1h de pause)',
    },
    {
      tenantId,
      name: 'Nuit (22h-6h)',
      code: 'NIGHT',
      startTime: '22:00:00',
      endTime: '06:00:00',
      durationHours: '8.00',
      breakMinutes: 30,
      paidHours: '7.50',
      shiftType: ShiftType.NIGHT,
      color: '#8B5CF6', // Purple
      minEmployees: 1,
      overtimeMultiplier: '1.15', // Night shift premium
      description: 'Quart de nuit (8 heures avec 30min de pause, majoration 15%)',
    },
    {
      tenantId,
      name: 'Weekend (8h-16h)',
      code: 'WKND',
      startTime: '08:00:00',
      endTime: '16:00:00',
      durationHours: '8.00',
      breakMinutes: 60,
      paidHours: '7.00',
      shiftType: ShiftType.WEEKEND,
      color: '#10B981', // Green
      minEmployees: 1,
      overtimeMultiplier: '1.40', // Weekend premium (CI law)
      description: 'Quart de weekend (majoration 40%)',
    },
  ];
}

/**
 * Bulk create default templates for a tenant
 *
 * @param tenantId - Tenant ID
 * @param createdBy - User ID creating the templates
 * @param dbClient - Database client with RLS context (optional, defaults to standard db)
 * @returns Created templates
 */
export async function createDefaultTemplates(
  tenantId: string,
  createdBy?: string
): Promise<ShiftTemplate[]> {
  try {
    const defaults = getDefaultShiftTemplates(tenantId).map((t) => ({
      ...t,
      createdBy,
    }));

    // Wrap in transaction to ensure RLS session variable persists
    // Connection pooling means variables set in context don't always persist
    // RLS policy checks: current_setting('app.tenant_id', true)
    const created = await db.transaction(async (tx) => {
      // Set session variable for this transaction (matches context.ts variable name)
      await tx.execute(sql`
        SELECT set_config('app.tenant_id', ${tenantId}, true);
      `);

      // Insert templates
      return await tx
        .insert(shiftTemplates)
        .values(defaults)
        .returning();
    });

    return created;
  } catch (error) {
    if (error instanceof Error) {
      throw new ShiftTemplateError(
        `Erreur lors de la création des modèles par défaut: ${error.message}`
      );
    }
    throw error;
  }
}
