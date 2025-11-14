/**
 * AI Import System - Core Types
 *
 * Shared types for cross-file entity building, streaming progress,
 * conflict resolution, and provenance tracking.
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

// ============================================================================
// Streaming Progress Types
// ============================================================================

export type ImportPhase =
  | 'upload'
  | 'parse'
  | 'classify'
  | 'build_graph'
  | 'match_records'
  | 'detect_conflicts'
  | 'resolve_conflicts'
  | 'build_entities'
  | 'validate'
  | 'import';

export interface ProgressUpdate {
  /** Current phase of the import process */
  phase: ImportPhase;

  /** Progress percentage (0-100) */
  percent: number;

  /** User-friendly message in French */
  message: string;

  /** Phase-specific details */
  details?: Record<string, any>;

  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;

  /** Timestamp of this update */
  timestamp: Date;
}

// ============================================================================
// Entity Graph Types
// ============================================================================

export interface SheetReference {
  /** File name */
  fileName: string;

  /** Sheet name within the file */
  sheetName: string;

  /** Sheet index (0-based) */
  sheetIndex: number;

  /** Number of rows in this sheet */
  rowCount: number;

  /** Classified data type */
  dataType: string;

  /** Classification confidence (0-100) */
  confidence: number;
}

export interface EntityTypeNode {
  /** Entity type (e.g., "employees", "employee_salaries") */
  entityType: string;

  /** Human-readable name in French */
  displayName: string;

  /** Target database table */
  targetTable: string;

  /** Sources (sheets) that contribute to this entity */
  sources: SheetReference[];

  /** Keys used for matching records across sources */
  matchingKeys: string[];

  /** Estimated number of unique entities */
  estimatedCount: number;

  /** Dependencies (other entities that must be imported first) */
  dependencies: string[];

  /** Priority (1 = highest, import first) */
  priority: number;
}

export interface CrossReference {
  /** Source entity type */
  from: string;

  /** Target entity type */
  to: string;

  /** Field name used for linking */
  via: string;

  /** Confidence of this cross-reference (0-100) */
  confidence: number;
}

export interface EntityGraph {
  /** Map of entity types to their definitions */
  entities: Record<string, EntityTypeNode>;

  /** Cross-references between entities */
  crossReferences: CrossReference[];

  /** Detected circular dependencies (should be empty in valid graphs) */
  circularDependencies: string[][];
}

// ============================================================================
// Entity Matching Types
// ============================================================================

export type MatchingStrategy =
  | 'employeeNumber' // Primary key
  | 'email' // Secondary key
  | 'cnpsNumber' // Tertiary key
  | 'fuzzy_match' // Name + date heuristics
  | 'manual'; // User-specified match

export interface MatchResult {
  /** Whether records match */
  matched: boolean;

  /** Matching strategy used */
  strategy: MatchingStrategy;

  /** Confidence score (0-100) */
  confidence: number;

  /** Explanation in French */
  reasoning?: string;
}

export interface RecordMatch {
  /** Unique temporary ID for this entity during analysis */
  entityId: string;

  /** Records from different sources that refer to same entity */
  sourceRecords: Array<{
    /** Source file name */
    fileName: string;

    /** Source sheet name */
    sheetName: string;

    /** Data type */
    dataType: string;

    /** The actual record data */
    data: Record<string, any>;

    /** When this record was parsed */
    parsedAt: Date;
  }>;

  /** How records were matched */
  matchStrategy: MatchingStrategy;

  /** Overall confidence in this match (0-100) */
  matchConfidence: number;

  /**
   * Duplicate detection - if this entity matches an existing employee in the database
   */
  duplicate?: {
    /** Existing employee ID in database */
    existingEmployeeId: string;

    /** Existing employee number for display */
    existingEmployeeNumber?: string;

    /** Existing employee name for display */
    existingEmployeeName: string;

    /** How duplicate was detected */
    matchMethod: 'employeeNumber' | 'email' | 'cnpsNumber' | 'fuzzyName';

    /** Confidence that this is the same person (0-100) */
    matchConfidence: number;

    /** Recommended action */
    recommendedAction: 'update' | 'skip' | 'ask_user';

    /** Reasoning for recommendation (in French) */
    reasoning: string;
  };
}

// ============================================================================
// Conflict Detection Types
// ============================================================================

export type ConflictSeverity = 'critical' | 'medium' | 'low';

export interface FieldConflict {
  /** Unique conflict ID */
  conflictId: string;

  /** Entity this conflict belongs to */
  entityId: string;

  /** Field name that has conflicting values */
  field: string;

  /** Sources with different values */
  sources: Array<{
    /** Source file name */
    fileName: string;

    /** Source sheet name */
    sheetName: string;

    /** Value from this source */
    value: any;

    /** When file was uploaded */
    uploadedAt: Date;

    /** File metadata (size, format, etc.) */
    metadata?: Record<string, any>;
  }>;

  /** Severity of this conflict */
  severity: ConflictSeverity;

  /** Whether this conflict has been resolved */
  resolved: boolean;

  /** Resolution (if resolved) */
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  /** Which source was chosen */
  chosenSource: string;

  /** The chosen value */
  chosenValue: any;

  /** AI confidence in this resolution (0-100) */
  confidence: number;

  /** Detailed reasoning in French */
  reasoning: string;

  /** Whether user confirmation is required */
  requiresUserConfirmation: boolean;

  /** When this was resolved */
  resolvedAt: Date;

  /** How it was resolved */
  resolvedBy: 'ai' | 'user' | 'rule';
}

// ============================================================================
// Complete Entity Types
// ============================================================================

export interface EntityProvenance {
  /** Which file each field came from */
  sources: Record<string, string>;

  /** Conflicts that were resolved for this entity */
  conflicts: FieldConflict[];

  /** Completeness score (0-100) based on populated fields */
  completeness: number;

  /** Field categories for UI display */
  categories: Record<string, string[]>;
}

export interface CompleteEntity<T = Record<string, any>> {
  /** The actual entity data (ready for database insertion) */
  data: T;

  /** Provenance metadata (not inserted to DB) */
  _meta: EntityProvenance;
}

// ============================================================================
// Import Summary Types (Enhanced)
// ============================================================================

export interface EntityPreview {
  /** Entity type */
  entityType: string;

  /** Display name in French */
  entityName: string;

  /** Number of entities */
  count: number;

  /** Completeness percentage */
  completeness: number;

  /** Example entities (2-3) */
  examples: Array<{
    /** Description (e.g., "KOUASSI Jean - EMP001") */
    description: string;

    /** Categorized key fields */
    categories: Record<string, Record<string, any>>;

    /** Source citations */
    sources: Record<string, string>;
  }>;

  /** Number of unresolved conflicts */
  unresolvedConflicts: number;
}

export interface EnhancedImportSummary {
  /** Overall summary in French */
  overallSummary: string;

  /** Entity previews */
  entities: EntityPreview[];

  /** Warnings */
  warnings: string[];

  /** Estimated import time */
  estimatedTime: string;

  /** Total number of conflicts detected */
  totalConflicts: number;

  /** Number of conflicts resolved automatically */
  conflictsAutoResolved: number;

  /** Number requiring user input */
  conflictsRequiringUser: number;

  /** Duplicate detection statistics */
  duplicates?: {
    /** Total number of duplicates found */
    total: number;

    /** Entities that will UPDATE existing employees */
    willUpdate: number;

    /** Entities that will be SKIPPED (exact duplicates) */
    willSkip: number;

    /** Entities requiring USER decision */
    requiresUserDecision: number;

    /** NEW entities (not duplicates) */
    newEntities: number;
  };
}

// ============================================================================
// Import Context (Enhanced with Multi-File Support)
// ============================================================================

export interface ImportContext {
  /** Tenant ID for isolation */
  tenantId: string;

  /** Country code (CI, SN, etc.) */
  countryCode: string;

  /** User ID who initiated import */
  userId?: string;

  /** Whether to allow partial imports */
  allowPartialImport: boolean;

  /** Whether this is a dry run */
  dryRun: boolean;

  /** File metadata */
  files: Array<{
    fileName: string;
    uploadedAt: Date;
    size: number;
    hash?: string;
  }>;

  /**
   * Existing employees in the database (for duplicate detection)
   *
   * This context is CRITICAL for production use - it enables:
   * - Duplicate detection ("Jean Kouassi already exists as #1234")
   * - Update vs Insert decisions
   * - Intelligent matching across files
   * - User trust ("50 nouveaux + 20 mises à jour")
   */
  existingEmployees?: Array<{
    id: string;
    employeeNumber?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    cnpsNumber?: string;
    phoneNumber?: string;
    hireDate?: Date;
    position?: string;
    department?: string;
    status: string;
  }>;

  /** Streaming progress callback */
  onProgress?: (update: ProgressUpdate) => void;
}

// ============================================================================
// Analysis Result (Enhanced)
// ============================================================================

export interface MultiFileAnalysisResult {
  /** Input files */
  files: Array<{
    fileName: string;
    totalSheets: number;
    totalRows: number;
  }>;

  /** Entity graph */
  entityGraph: EntityGraph;

  /** Matched entities */
  matchedEntities: RecordMatch[];

  /** Detected conflicts */
  conflicts: FieldConflict[];

  /** Complete entities (ready for import) */
  completeEntities: Record<string, CompleteEntity[]>;

  /** User-friendly summary */
  summary: EnhancedImportSummary;

  /** Whether user confirmation is needed */
  needsConfirmation: boolean;

  /** Reasons why confirmation is needed */
  confirmationReasons: string[];

  /** Total processing time in milliseconds */
  processingTimeMs: number;
}
