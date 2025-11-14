/**
 * Build Complete Entities Tool - Merge Multi-Source Data with Provenance
 *
 * This tool takes matched records and resolved conflicts and builds complete
 * entities ready for database insertion. Each entity includes:
 *
 * - Merged data from all sources
 * - Provenance tracking (which file/sheet each field came from)
 * - Resolved conflicts applied
 * - Completeness score
 * - Field categorization for UI display
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

import type {
  RecordMatch,
  FieldConflict,
  CompleteEntity,
  EntityProvenance,
} from '../types';

/**
 * Field categories for UI display
 */
const FIELD_CATEGORIES: Record<string, string[]> = {
  'Informations personnelles': [
    'firstName',
    'lastName',
    'dateOfBirth',
    'placeOfBirth',
    'gender',
    'maritalStatus',
    'nationality',
  ],
  'Coordonnées': [
    'email',
    'phone',
    'mobilePhone',
    'address',
    'city',
    'postalCode',
    'country',
  ],
  'Informations professionnelles': [
    'employeeNumber',
    'hireDate',
    'position',
    'department',
    'contractType',
    'status',
    'manager',
    'workLocation',
  ],
  'Rémunération': [
    'baseSalary',
    'salary',
    'grossSalary',
    'netSalary',
    'salaryType',
    'paymentFrequency',
    'bankName',
    'bankAccountNumber',
  ],
  'Sécurité sociale et fiscalité': [
    'cnpsNumber',
    'taxId',
    'socialSecurityNumber',
    'healthInsuranceNumber',
  ],
  'Autres': [],
};

/**
 * Build a complete entity from matched records and resolved conflicts
 */
export function buildCompleteEntity<T = Record<string, any>>(params: {
  match: RecordMatch;
  conflicts: FieldConflict[];
  targetSchema?: {
    requiredFields: string[];
    optionalFields: string[];
  };
}): CompleteEntity<T> {
  const { match, conflicts, targetSchema } = params;

  // Initialize entity data and provenance
  const entityData: Record<string, any> = {};
  const sources: Record<string, string> = {};
  const entityConflicts = conflicts.filter((c) => c.entityId === match.entityId);

  // Get all fields from all sources
  const allFields = new Set<string>();
  for (const source of match.sourceRecords) {
    Object.keys(source.data).forEach((field) => allFields.add(field));
  }

  // Merge data field by field
  for (const field of allFields) {
    const result = mergeFieldData({
      field,
      sourceRecords: match.sourceRecords,
      conflicts: entityConflicts,
    });

    if (result.value !== undefined && result.value !== null && result.value !== '') {
      entityData[field] = result.value;
      sources[field] = result.source;
    }
  }

  // Calculate completeness
  const completeness = calculateCompleteness(entityData, targetSchema);

  // Categorize fields
  const categories = categorizeFields(Object.keys(entityData));

  const provenance: EntityProvenance = {
    sources,
    conflicts: entityConflicts,
    completeness,
    categories,
  };

  return {
    data: entityData as T,
    _meta: provenance,
  };
}

/**
 * Merge data for a specific field from multiple sources
 *
 * Priority:
 * 1. Resolved conflict value (if conflict was resolved)
 * 2. Most recent source value (if no conflict)
 * 3. Most complete value (non-empty)
 */
function mergeFieldData(params: {
  field: string;
  sourceRecords: RecordMatch['sourceRecords'];
  conflicts: FieldConflict[];
}): {
  value: any;
  source: string;
} {
  const { field, sourceRecords, conflicts } = params;

  // Check if there's a resolved conflict for this field
  const conflict = conflicts.find((c) => c.field === field && c.resolved && c.resolution);

  if (conflict && conflict.resolution) {
    // Use resolved conflict value
    return {
      value: conflict.resolution.chosenValue,
      source: conflict.resolution.chosenSource,
    };
  }

  // No conflict or unresolved - get all non-empty values
  const valuesWithSources = sourceRecords
    .map((source) => ({
      value: source.data[field],
      source: `${source.fileName}::${source.sheetName}`,
      uploadedAt: source.parsedAt,
    }))
    .filter((v) => v.value !== undefined && v.value !== null && v.value !== '');

  if (valuesWithSources.length === 0) {
    return { value: undefined, source: '' };
  }

  if (valuesWithSources.length === 1) {
    return valuesWithSources[0];
  }

  // Multiple values - prefer most recent
  valuesWithSources.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

  return {
    value: valuesWithSources[0].value,
    source: valuesWithSources[0].source,
  };
}

/**
 * Calculate completeness score (0-100)
 *
 * Based on:
 * - Required fields filled: 70% weight
 * - Optional fields filled: 30% weight
 */
function calculateCompleteness(
  entityData: Record<string, any>,
  targetSchema?: {
    requiredFields: string[];
    optionalFields: string[];
  }
): number {
  if (!targetSchema) {
    // If no schema, calculate based on non-empty fields
    const totalFields = Object.keys(entityData).length;
    const filledFields = Object.values(entityData).filter(
      (v) => v !== undefined && v !== null && v !== ''
    ).length;
    return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  }

  const requiredFilled = targetSchema.requiredFields.filter(
    (field) => {
      const value = entityData[field];
      return value !== undefined && value !== null && value !== '';
    }
  ).length;

  const optionalFilled = targetSchema.optionalFields.filter(
    (field) => {
      const value = entityData[field];
      return value !== undefined && value !== null && value !== '';
    }
  ).length;

  const requiredScore = targetSchema.requiredFields.length > 0
    ? (requiredFilled / targetSchema.requiredFields.length) * 70
    : 70; // If no required fields, assume 70%

  const optionalScore = targetSchema.optionalFields.length > 0
    ? (optionalFilled / targetSchema.optionalFields.length) * 30
    : 30; // If no optional fields, assume 30%

  return Math.round(requiredScore + optionalScore);
}

/**
 * Categorize fields for UI display
 *
 * Groups fields into logical categories:
 * - Informations personnelles
 * - Coordonnées
 * - Informations professionnelles
 * - Rémunération
 * - Sécurité sociale et fiscalité
 * - Autres (uncategorized)
 */
function categorizeFields(fields: string[]): Record<string, string[]> {
  const categorized: Record<string, string[]> = {};

  // Initialize all categories
  for (const category of Object.keys(FIELD_CATEGORIES)) {
    categorized[category] = [];
  }

  // Categorize each field
  for (const field of fields) {
    let categorized_field = false;

    for (const [category, categoryFields] of Object.entries(FIELD_CATEGORIES)) {
      if (categoryFields.includes(field)) {
        categorized[category].push(field);
        categorized_field = true;
        break;
      }
    }

    // If not categorized, add to "Autres"
    if (!categorized_field) {
      categorized['Autres'].push(field);
    }
  }

  // Remove empty categories
  for (const category of Object.keys(categorized)) {
    if (categorized[category].length === 0) {
      delete categorized[category];
    }
  }

  return categorized;
}

/**
 * Build all entities for a specific entity type
 */
export function buildEntitiesForType<T = Record<string, any>>(params: {
  matches: RecordMatch[];
  conflicts: FieldConflict[];
  targetSchema?: {
    requiredFields: string[];
    optionalFields: string[];
  };
}): CompleteEntity<T>[] {
  const { matches, conflicts, targetSchema } = params;

  return matches.map((match) =>
    buildCompleteEntity<T>({
      match,
      conflicts,
      targetSchema,
    })
  );
}

/**
 * Generate entity preview for UI display
 *
 * This creates a user-friendly preview showing:
 * - Entity description (e.g., "KOUASSI Jean - EMP001")
 * - Key fields by category
 * - Source citations
 */
export function generateEntityPreview(entity: CompleteEntity): {
  description: string;
  categories: Record<string, Record<string, any>>;
  sources: Record<string, string>;
} {
  const data = entity.data;
  const meta = entity._meta;

  // Generate description
  let description = '';
  if (data.firstName && data.lastName) {
    description = `${data.lastName} ${data.firstName}`;
    if (data.employeeNumber) {
      description += ` - ${data.employeeNumber}`;
    }
  } else if (data.employeeNumber) {
    description = data.employeeNumber;
  } else if (data.email) {
    description = data.email;
  } else {
    description = 'Entité sans nom';
  }

  // Get categorized fields (limit to 3-4 fields per category for preview)
  const categories: Record<string, Record<string, any>> = {};

  for (const [category, fields] of Object.entries(meta.categories)) {
    const categoryData: Record<string, any> = {};
    const previewFields = fields.slice(0, 4); // Limit to 4 fields per category

    for (const field of previewFields) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        categoryData[field] = data[field];
      }
    }

    if (Object.keys(categoryData).length > 0) {
      categories[category] = categoryData;
    }
  }

  return {
    description,
    categories,
    sources: meta.sources,
  };
}

/**
 * Validate entity completeness
 *
 * Returns validation errors if required fields are missing
 */
export function validateEntityCompleteness(params: {
  entity: CompleteEntity;
  requiredFields: string[];
}): {
  isValid: boolean;
  missingFields: string[];
  completeness: number;
} {
  const { entity, requiredFields } = params;

  const missingFields = requiredFields.filter((field) => {
    const value = entity.data[field];
    return value === undefined || value === null || value === '';
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
    completeness: entity._meta.completeness,
  };
}

/**
 * Get entities with unresolved conflicts
 */
export function getEntitiesWithUnresolvedConflicts(
  entities: CompleteEntity[]
): CompleteEntity[] {
  return entities.filter((entity) => {
    const unresolvedConflicts = entity._meta.conflicts.filter(
      (c) => !c.resolved || (c.resolution && c.resolution.requiresUserConfirmation)
    );
    return unresolvedConflicts.length > 0;
  });
}

/**
 * Get entity statistics
 */
export function getEntityStats(entities: CompleteEntity[]): {
  total: number;
  withUnresolvedConflicts: number;
  averageCompleteness: number;
  completenessDistribution: {
    high: number; // 90-100%
    medium: number; // 70-89%
    low: number; // <70%
  };
} {
  const total = entities.length;
  const withUnresolvedConflicts = getEntitiesWithUnresolvedConflicts(entities).length;

  const completenessScores = entities.map((e) => e._meta.completeness);
  const averageCompleteness = completenessScores.length > 0
    ? Math.round(completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length)
    : 0;

  const completenessDistribution = {
    high: completenessScores.filter((c) => c >= 90).length,
    medium: completenessScores.filter((c) => c >= 70 && c < 90).length,
    low: completenessScores.filter((c) => c < 70).length,
  };

  return {
    total,
    withUnresolvedConflicts,
    averageCompleteness,
    completenessDistribution,
  };
}
