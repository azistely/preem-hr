/**
 * Form Renderer Service
 * Dynamic form rendering, validation, and conditional logic evaluation
 */

import type {
  FormFieldDefinition,
  FormSectionDefinition,
  FormDefinition,
  FormFieldCondition,
  FormConditionalRule,
  FormFieldType,
  RatingScaleConfig,
  SliderFieldConfig,
  ComputedFieldConfig,
} from '@/lib/db/schema/hr-forms';

import type {
  FormFieldState,
  FormRenderContext,
  FormFieldChange,
  FormValidationResult,
} from '../types/form-builder.types';

// ============================================================================
// FORM RENDERING
// ============================================================================

/**
 * Prepare form fields for rendering with initial state
 */
export function prepareFormFields(
  definition: FormDefinition,
  initialData: Record<string, unknown> = {},
  context: FormRenderContext
): Map<string, FormFieldState> {
  const fieldStates = new Map<string, FormFieldState>();

  for (const field of definition.fields) {
    const value = initialData[field.id] ?? field.defaultValue ?? getDefaultValueForType(field.type);
    const visible = evaluateFieldVisibility(field, initialData, definition);
    const required = evaluateFieldRequired(field, initialData, definition);
    const disabled = field.readOnly || context.isReadOnly;

    fieldStates.set(field.id, {
      id: field.id,
      value,
      touched: false,
      dirty: false,
      visible,
      disabled,
      required,
    });
  }

  // Calculate computed fields
  for (const field of definition.fields) {
    if (field.type === 'computed' && field.computedConfig) {
      const computedValue = calculateComputedField(field.computedConfig, fieldStates);
      const state = fieldStates.get(field.id);
      if (state) {
        state.value = computedValue;
      }
    }
  }

  return fieldStates;
}

/**
 * Get default value for a field type
 */
export function getDefaultValueForType(type: FormFieldType): unknown {
  switch (type) {
    case 'text':
    case 'textarea':
    case 'rich_text':
      return '';
    case 'number':
    case 'rating':
    case 'slider':
      return null;
    case 'date':
    case 'datetime':
      return null;
    case 'select':
    case 'radio':
    case 'employee':
      return null;
    case 'multiselect':
    case 'multiemployee':
      return [];
    case 'checkbox':
      return false;
    case 'file':
      return null;
    case 'computed':
      return 0;
    case 'heading':
    case 'paragraph':
      return undefined;
    default:
      return null;
  }
}

/**
 * Get fields grouped by section
 */
export function getFieldsBySection(
  definition: FormDefinition
): Map<string, FormFieldDefinition[]> {
  const sectionMap = new Map<string, FormFieldDefinition[]>();

  // Initialize sections
  for (const section of definition.sections) {
    sectionMap.set(section.id, []);
  }
  sectionMap.set('_unsectioned', []); // For fields without section

  // Group fields
  for (const field of definition.fields) {
    const sectionId = field.section ?? '_unsectioned';
    const sectionFields = sectionMap.get(sectionId) ?? [];
    sectionFields.push(field);
    sectionMap.set(sectionId, sectionFields);
  }

  // Sort fields by order within each section
  for (const [sectionId, fields] of sectionMap) {
    fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  return sectionMap;
}

/**
 * Get visible sections based on conditions
 */
export function getVisibleSections(
  definition: FormDefinition,
  data: Record<string, unknown>
): FormSectionDefinition[] {
  return definition.sections
    .filter((section) => {
      if (!section.conditions || section.conditions.length === 0) {
        return true;
      }
      return evaluateConditionalRules(section.conditions, data);
    })
    .sort((a, b) => a.order - b.order);
}

// ============================================================================
// CONDITIONAL LOGIC
// ============================================================================

/**
 * Evaluate field visibility based on conditions
 */
export function evaluateFieldVisibility(
  field: FormFieldDefinition,
  data: Record<string, unknown>,
  definition: FormDefinition
): boolean {
  if (field.hidden) return false;

  if (!field.conditions || field.conditions.length === 0) {
    return true;
  }

  const showRules = field.conditions.filter((c) => c.action === 'show');
  const hideRules = field.conditions.filter((c) => c.action === 'hide');

  // If there are hide rules, check them first
  for (const rule of hideRules) {
    if (evaluateConditions(rule.conditions, rule.logic, data)) {
      return false;
    }
  }

  // If there are show rules, at least one must be satisfied
  if (showRules.length > 0) {
    return showRules.some((rule) => evaluateConditions(rule.conditions, rule.logic, data));
  }

  return true;
}

/**
 * Evaluate field required state based on conditions
 */
export function evaluateFieldRequired(
  field: FormFieldDefinition,
  data: Record<string, unknown>,
  definition: FormDefinition
): boolean {
  if (field.required) return true;

  if (!field.conditions) return false;

  const requireRules = field.conditions.filter((c) => c.action === 'require');

  for (const rule of requireRules) {
    if (evaluateConditions(rule.conditions, rule.logic, data)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluate conditional rules
 */
export function evaluateConditionalRules(
  rules: FormConditionalRule[],
  data: Record<string, unknown>
): boolean {
  if (rules.length === 0) return true;

  // Default: all rules must pass (AND logic between rules)
  return rules.every((rule) => {
    const result = evaluateConditions(rule.conditions, rule.logic, data);
    return rule.action === 'show' ? result : !result;
  });
}

/**
 * Evaluate a set of conditions with logic
 */
export function evaluateConditions(
  conditions: FormFieldCondition[],
  logic: 'AND' | 'OR',
  data: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;

  const results = conditions.map((condition) => evaluateCondition(condition, data));

  return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: FormFieldCondition,
  data: Record<string, unknown>
): boolean {
  const fieldValue = data[condition.field];

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue ?? '').includes(String(condition.value));
    case 'not_contains':
      return !String(fieldValue ?? '').includes(String(condition.value));
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    default:
      return true;
  }
}

/**
 * Re-evaluate all field states after a change
 */
export function reEvaluateFieldStates(
  definition: FormDefinition,
  currentStates: Map<string, FormFieldState>,
  changedFieldId: string
): Map<string, FormFieldState> {
  const data: Record<string, unknown> = {};
  for (const [id, state] of currentStates) {
    data[id] = state.value;
  }

  for (const field of definition.fields) {
    const state = currentStates.get(field.id);
    if (!state) continue;

    // Re-evaluate visibility and required
    state.visible = evaluateFieldVisibility(field, data, definition);
    state.required = evaluateFieldRequired(field, data, definition);

    // Re-calculate computed fields
    if (field.type === 'computed' && field.computedConfig) {
      const sourceFields = field.computedConfig.sourceFields ?? [];
      if (sourceFields.includes(changedFieldId) || sourceFields.length === 0) {
        state.value = calculateComputedField(field.computedConfig, currentStates);
      }
    }
  }

  return currentStates;
}

// ============================================================================
// COMPUTED FIELDS
// ============================================================================

/**
 * Calculate computed field value
 */
export function calculateComputedField(
  config: ComputedFieldConfig,
  fieldStates: Map<string, FormFieldState>
): number {
  const values: number[] = [];
  const weights: Record<string, number> = config.weights ?? {};

  for (const sourceId of config.sourceFields) {
    const state = fieldStates.get(sourceId);
    if (state && state.value !== null && state.value !== undefined) {
      const numValue = Number(state.value);
      if (!isNaN(numValue)) {
        values.push(numValue);
      }
    }
  }

  if (values.length === 0) return 0;

  let result: number;

  switch (config.formula) {
    case 'sum':
      result = values.reduce((a, b) => a + b, 0);
      break;
    case 'average':
      result = values.reduce((a, b) => a + b, 0) / values.length;
      break;
    case 'min':
      result = Math.min(...values);
      break;
    case 'max':
      result = Math.max(...values);
      break;
    case 'count':
      result = values.length;
      break;
    case 'weighted_average': {
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < config.sourceFields.length; i++) {
        const fieldId = config.sourceFields[i];
        const state = fieldStates.get(fieldId);
        if (state && state.value !== null && state.value !== undefined) {
          const numValue = Number(state.value);
          const weight = weights[fieldId] ?? 1;
          if (!isNaN(numValue)) {
            weightedSum += numValue * weight;
            totalWeight += weight;
          }
        }
      }
      result = totalWeight > 0 ? weightedSum / totalWeight : 0;
      break;
    }
    case 'custom':
      // Custom formula evaluation would go here
      result = 0;
      break;
    default:
      result = 0;
  }

  // Apply decimals
  if (config.decimals !== undefined) {
    result = Number(result.toFixed(config.decimals));
  }

  return result;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate entire form
 */
export function validateForm(
  definition: FormDefinition,
  data: Record<string, unknown>,
  fieldStates: Map<string, FormFieldState>
): FormValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  for (const field of definition.fields) {
    const state = fieldStates.get(field.id);
    if (!state || !state.visible) continue;

    const value = data[field.id];
    const fieldErrors = validateField(field, value, state.required);

    if (fieldErrors.length > 0) {
      errors[field.id] = fieldErrors[0]; // First error
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single field
 */
export function validateField(
  field: FormFieldDefinition,
  value: unknown,
  isRequired: boolean
): string[] {
  const errors: string[] = [];

  // Skip validation for display-only fields
  if (field.type === 'heading' || field.type === 'paragraph' || field.type === 'computed') {
    return errors;
  }

  // Required check
  if (isRequired) {
    if (value === null || value === undefined || value === '') {
      errors.push('Ce champ est requis');
      return errors;
    }
    if (Array.isArray(value) && value.length === 0) {
      errors.push('Veuillez sélectionner au moins une option');
      return errors;
    }
  }

  // Skip further validation if empty and not required
  if (value === null || value === undefined || value === '') {
    return errors;
  }

  // Type-specific validation
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'rich_text': {
      const strValue = String(value);
      if (field.minLength && strValue.length < field.minLength) {
        errors.push(`Minimum ${field.minLength} caractères requis`);
      }
      if (field.maxLength && strValue.length > field.maxLength) {
        errors.push(`Maximum ${field.maxLength} caractères autorisés`);
      }
      if (field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(strValue)) {
          errors.push('Format invalide');
        }
      }
      break;
    }

    case 'number':
    case 'slider': {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        errors.push('Veuillez entrer un nombre valide');
        break;
      }
      if (field.min !== undefined && numValue < field.min) {
        errors.push(`La valeur minimum est ${field.min}`);
      }
      if (field.max !== undefined && numValue > field.max) {
        errors.push(`La valeur maximum est ${field.max}`);
      }
      break;
    }

    case 'rating': {
      const ratingValue = Number(value);
      if (isNaN(ratingValue) || ratingValue < 1) {
        errors.push('Veuillez sélectionner une note');
      }
      if (field.ratingConfig) {
        const maxRating = field.ratingConfig.scale;
        if (ratingValue > maxRating) {
          errors.push(`La note maximum est ${maxRating}`);
        }
      }
      break;
    }

    case 'date':
    case 'datetime': {
      const dateValue = new Date(String(value));
      if (isNaN(dateValue.getTime())) {
        errors.push('Date invalide');
      }
      break;
    }

    case 'select':
    case 'radio': {
      if (field.options) {
        const validValues = field.options.map((o) => o.value);
        if (!validValues.includes(String(value)) && !field.allowOther) {
          errors.push('Option invalide');
        }
      }
      break;
    }

    case 'multiselect': {
      if (!Array.isArray(value)) {
        errors.push('Format de sélection invalide');
        break;
      }
      if (field.options && !field.allowOther) {
        const validValues = field.options.map((o) => o.value);
        const invalidOptions = (value as string[]).filter((v) => !validValues.includes(v));
        if (invalidOptions.length > 0) {
          errors.push('Certaines options sont invalides');
        }
      }
      break;
    }

    case 'employee':
    case 'file': {
      // UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(value))) {
        errors.push('Sélection invalide');
      }
      break;
    }

    case 'multiemployee': {
      if (!Array.isArray(value)) {
        errors.push('Format de sélection invalide');
        break;
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const invalidIds = (value as string[]).filter((v) => !uuidRegex.test(v));
      if (invalidIds.length > 0) {
        errors.push('Certaines sélections sont invalides');
      }
      break;
    }
  }

  return errors;
}

// ============================================================================
// FORM DATA UTILITIES
// ============================================================================

/**
 * Extract form data from field states
 */
export function extractFormData(fieldStates: Map<string, FormFieldState>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [id, state] of fieldStates) {
    if (state.visible) {
      data[id] = state.value;
    }
  }
  return data;
}

/**
 * Merge partial data with existing form data
 */
export function mergeFormData(
  existing: Record<string, unknown>,
  partial: Record<string, unknown>
): Record<string, unknown> {
  return { ...existing, ...partial };
}

/**
 * Get rating label for a value
 */
export function getRatingLabel(value: number, config: RatingScaleConfig): string {
  if (config.labels && config.labels[value]) {
    return config.labels[value];
  }
  return String(value);
}

/**
 * Get formatted slider value
 */
export function getSliderDisplayValue(value: number, config: SliderFieldConfig): string {
  const formattedValue = String(value);
  return config.unit ? `${formattedValue}${config.unit}` : formattedValue;
}

/**
 * Check if form has unsaved changes
 */
export function hasUnsavedChanges(fieldStates: Map<string, FormFieldState>): boolean {
  for (const [, state] of fieldStates) {
    if (state.dirty) return true;
  }
  return false;
}

/**
 * Get completion percentage
 */
export function getFormCompletionPercentage(
  fieldStates: Map<string, FormFieldState>,
  definition: FormDefinition
): number {
  let requiredFields = 0;
  let completedFields = 0;

  for (const field of definition.fields) {
    const state = fieldStates.get(field.id);
    if (!state || !state.visible) continue;

    // Skip display-only fields
    if (field.type === 'heading' || field.type === 'paragraph') continue;

    if (state.required) {
      requiredFields++;
      if (state.value !== null && state.value !== undefined && state.value !== '') {
        if (!Array.isArray(state.value) || state.value.length > 0) {
          completedFields++;
        }
      }
    }
  }

  if (requiredFields === 0) return 100;
  return Math.round((completedFields / requiredFields) * 100);
}

// ============================================================================
// FORM BUILDER UTILITIES
// ============================================================================

/**
 * Generate a unique field ID
 */
export function generateFieldId(type: FormFieldType): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${type}_${timestamp}_${random}`;
}

/**
 * Clone a field definition
 */
export function cloneFieldDefinition(field: FormFieldDefinition): FormFieldDefinition {
  return {
    ...JSON.parse(JSON.stringify(field)),
    id: generateFieldId(field.type),
  };
}

/**
 * Reorder fields in a section
 */
export function reorderFields(
  fields: FormFieldDefinition[],
  fromIndex: number,
  toIndex: number
): FormFieldDefinition[] {
  const result = [...fields];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // Update order property
  return result.map((field, index) => ({
    ...field,
    order: index,
  }));
}

/**
 * Move field to a different section
 */
export function moveFieldToSection(
  field: FormFieldDefinition,
  newSectionId: string
): FormFieldDefinition {
  return {
    ...field,
    section: newSectionId,
    order: undefined, // Will be assigned when added to section
  };
}
