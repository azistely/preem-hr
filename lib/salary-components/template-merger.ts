/**
 * Template Merger Service (Option B Architecture)
 *
 * Merges salary component templates with tenant-specific overrides.
 * Single source of truth: Template defines law, Activation defines customization.
 *
 * @example
 * const merged = mergeTemplateWithOverrides(template, activation);
 * // Result: Full component with tax treatment from template + custom rate from activation
 */

import type { ComponentMetadata } from '@/features/employees/types/salary-components';

// ============================================================================
// Types
// ============================================================================

export interface SalaryComponentTemplate {
  id: string;
  code: string;
  countryCode: string;
  name: Record<string, string>; // { fr: "Indemnité de logement" }
  description?: string | null;
  category: string;
  metadata: ComponentMetadata;
  complianceLevel?: string; // locked | configurable | freeform
  customizableFields?: string[]; // ["calculationRule.rate"]
  canModify?: boolean;
  canDeactivate?: boolean;
  legalReference?: string | null;
  isCommon?: boolean;
  isPopular?: boolean;
  displayOrder: number;
}

export interface TenantActivation {
  id: string;
  tenantId: string;
  countryCode: string;
  templateCode: string;
  overrides: Record<string, any>; // { calculationRule: { rate: 0.25 } }
  customName?: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export interface MergedComponent {
  id: string; // activation.id
  code: string; // template.code
  name: string; // activation.customName || template.name.fr
  description?: string | null;
  category: string;
  metadata: ComponentMetadata; // merged: template.metadata + activation.overrides
  templateCode: string;
  complianceLevel: string;
  customizableFields: string[];
  canModify: boolean;
  canDeactivate: boolean;
  legalReference?: string | null;
  isActive: boolean;
  displayOrder: number;
}

// ============================================================================
// Core Merge Function
// ============================================================================

/**
 * Merge template with tenant activation overrides
 *
 * Rules:
 * 1. Tax treatment, CNPS, category ALWAYS from template (law)
 * 2. Calculation rule from activation overrides (if present), else template
 * 3. Name from activation.customName (if present), else template.name.fr
 *
 * @param template - The component template (law)
 * @param activation - Tenant activation with overrides (customization)
 * @returns Merged component ready for use
 */
export function mergeTemplateWithOverrides(
  template: SalaryComponentTemplate,
  activation: TenantActivation
): MergedComponent {
  // Start with template metadata (contains all legal compliance fields)
  const baseMetadata = template.metadata as ComponentMetadata;

  // Deep merge: overrides can modify nested fields (e.g., calculationRule.rate)
  const mergedMetadata = deepMerge(baseMetadata, activation.overrides);

  return {
    id: activation.id,
    code: template.code,
    name: activation.customName || (template.name.fr || template.name.en || 'Sans nom'),
    description: template.description,
    category: template.category,
    metadata: mergedMetadata,
    templateCode: template.code,
    complianceLevel: template.complianceLevel || 'freeform',
    customizableFields: template.customizableFields || [],
    canModify: template.canModify ?? true,
    canDeactivate: template.canDeactivate ?? true,
    legalReference: template.legalReference,
    isActive: activation.isActive,
    displayOrder: activation.displayOrder,
  };
}

/**
 * Merge multiple templates with their activations
 *
 * @param templates - Array of templates
 * @param activations - Array of tenant activations
 * @returns Array of merged components
 */
export function mergeTemplatesWithActivations(
  templates: SalaryComponentTemplate[],
  activations: TenantActivation[]
): MergedComponent[] {
  // Create a map for fast template lookup
  const templateMap = new Map<string, SalaryComponentTemplate>();
  templates.forEach((t) => {
    templateMap.set(t.code, t);
  });

  // Merge each activation with its template
  return activations
    .map((activation) => {
      const template = templateMap.get(activation.templateCode);
      if (!template) {
        console.warn(`Template not found for activation: ${activation.templateCode}`);
        return null;
      }
      return mergeTemplateWithOverrides(template, activation);
    })
    .filter((merged): merged is MergedComponent => merged !== null);
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Deep merge two objects (overrides wins)
 *
 * @example
 * const base = { a: 1, b: { c: 2, d: 3 } };
 * const overrides = { b: { d: 4 } };
 * deepMerge(base, overrides); // { a: 1, b: { c: 2, d: 4 } }
 */
function deepMerge<T extends Record<string, any>>(base: T, overrides: Record<string, any>): T {
  const result = { ...base };

  for (const key in overrides) {
    if (overrides[key] !== undefined && overrides[key] !== null) {
      if (
        typeof overrides[key] === 'object' &&
        !Array.isArray(overrides[key]) &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        // Recursive merge for nested objects
        result[key] = deepMerge(result[key], overrides[key]);
      } else {
        // Direct override for primitives and arrays
        result[key] = overrides[key];
      }
    }
  }

  return result;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that overrides only contain customizable fields
 *
 * @param overrides - The overrides object
 * @param customizableFields - Array of allowed field paths
 * @returns True if valid, error message if invalid
 */
export function validateOverrides(
  overrides: Record<string, any>,
  customizableFields: string[]
): { valid: boolean; error?: string } {
  // Extract field paths from overrides (e.g., "calculationRule.rate")
  const overrideFields = extractFieldPaths(overrides);

  // Check if all override fields are in customizableFields
  for (const field of overrideFields) {
    if (!customizableFields.includes(field)) {
      return {
        valid: false,
        error: `Le champ "${field}" ne peut pas être modifié. Champs autorisés: ${customizableFields.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Extract field paths from nested object
 *
 * @example
 * extractFieldPaths({ calculationRule: { rate: 0.25 } })
 * // Returns: ["calculationRule.rate"]
 */
function extractFieldPaths(obj: Record<string, any>, prefix = ''): string[] {
  const paths: string[] = [];

  for (const key in obj) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && obj[key] !== null) {
      // Recursive for nested objects
      paths.push(...extractFieldPaths(obj[key], fullPath));
    } else {
      // Leaf node
      paths.push(fullPath);
    }
  }

  return paths;
}
