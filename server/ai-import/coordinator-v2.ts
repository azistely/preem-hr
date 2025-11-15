/**
 * AI Import Coordinator V2 - Cross-File Entity Building
 *
 * This coordinator implements the complete multi-file entity building workflow:
 * 1. Parse all Excel files
 * 2. Classify all sheets
 * 3. Build entity graph (cross-file relationships)
 * 4. Match records across sources
 * 5. Detect conflicts
 * 6. Resolve conflicts (AI-powered)
 * 7. Build complete entities with provenance
 * 8. Validate entities
 * 9. Import to database
 *
 * @see docs/AI-IMPORT-CROSS-FILE-ARCHITECTURE.md
 */

import { parseExcel, type ParsedSheet } from './tools/parse-excel';
import { classifySheet, type ClassificationResult } from './tools/classify-sheet';
import { buildEntityGraph } from './tools/build-entity-graph';
import { matchRecords, type SourceRecord } from './tools/match-records';
import { detectConflicts, analyzeConflictPatterns } from './tools/detect-conflicts';
import { autoResolveLowRiskConflicts } from './tools/resolve-conflicts';
import {
  buildEntitiesForType,
  generateEntityPreview,
  getEntityStats,
} from './tools/build-entities';
import { validateData } from './tools/validate-data';
import { executeImport } from './importers';
import { loadExistingEmployees } from './tools/load-existing-employees';
import { detectDuplicateEmployee } from './tools/detect-duplicate-employee';
import {
  resolveValidEmployees,
  findEmployeeForEntity,
  formatRejectedEntityDescription,
  type ResolvedEmployee,
} from './tools/resolve-employees';
import type {
  ProgressUpdate,
  ImportPhase,
  MultiFileAnalysisResult,
  EntityGraph,
  RecordMatch,
  FieldConflict,
  CompleteEntity,
  EnhancedImportSummary,
  EntityPreview,
  ImportContext,
} from './types';

/**
 * Analyze multiple files and build cross-file entity graph
 *
 * This is the new multi-file analysis that replaces the old single-file approach
 */
export async function analyzeMultiFileImport(params: {
  filePaths: Array<{ path: string; name: string; uploadedAt: Date }>;
  context: ImportContext;
}): Promise<MultiFileAnalysisResult> {
  const { filePaths, context } = params;
  const { countryCode = 'CI', tenantId, onProgress } = context;

  const startTime = Date.now();

  // Phase 0: Load existing employees (CRITICAL RESOURCE for duplicate detection)
  onProgress?.({
    phase: 'parse',
    percent: 2,
    message: 'Chargement des employés existants...',
    timestamp: new Date(),
  });

  const existingEmployees = await loadExistingEmployees({ tenantId });

  onProgress?.({
    phase: 'parse',
    percent: 4,
    message: `${existingEmployees.length} employé(s) existant(s) chargé(s)`,
    details: {
      existingEmployeesCount: existingEmployees.length,
    },
    timestamp: new Date(),
  });

  // Phase 1: Parse all files
  onProgress?.({
    phase: 'parse',
    percent: 5,
    message: `Lecture de ${filePaths.length} fichier(s)...`,
    timestamp: new Date(),
  });

  const parsedFiles = [];
  for (let i = 0; i < filePaths.length; i++) {
    const file = filePaths[i];
    const parseResult = await parseExcel({
      filePath: file.path,
      includeEmptyRows: false,
      maxSampleRows: 10,
    });

    parsedFiles.push({
      fileName: file.name,
      uploadedAt: file.uploadedAt,
      parseResult,
    });

    onProgress?.({
      phase: 'parse',
      percent: 5 + (i + 1) / filePaths.length * 10,
      message: `Fichier ${i + 1}/${filePaths.length} analysé: ${file.name}`,
      timestamp: new Date(),
    });
  }

  // Phase 2: Classify all sheets
  onProgress?.({
    phase: 'classify',
    percent: 15,
    message: 'Classification intelligente des données...',
    timestamp: new Date(),
  });

  const allClassifiedSheets = [];
  let totalSheets = 0;
  for (const parsedFile of parsedFiles) {
    totalSheets += parsedFile.parseResult.sheets.length;
  }

  let classifiedCount = 0;
  for (const parsedFile of parsedFiles) {
    for (const sheet of parsedFile.parseResult.sheets) {
      const classification = await classifySheet({
        sheetName: sheet.name,
        columns: sheet.columns,
        sampleData: sheet.sampleData,
        countryCode,
      });

      allClassifiedSheets.push({
        fileName: parsedFile.fileName,
        sheetName: sheet.name,
        sheetIndex: parsedFile.parseResult.sheets.indexOf(sheet),
        rowCount: sheet.rowCount,
        classification,
      });

      classifiedCount++;
      onProgress?.({
        phase: 'classify',
        percent: 15 + (classifiedCount / totalSheets) * 15,
        message: `Classification: ${sheet.name} → ${classification.dataTypeName} (${classification.confidence}%)`,
        details: {
          sheetName: sheet.name,
          dataType: classification.dataTypeName,
          confidence: classification.confidence,
        },
        timestamp: new Date(),
      });
    }
  }

  // Phase 3: Build entity graph
  onProgress?.({
    phase: 'build_graph',
    percent: 35,
    message: 'Construction du graphe d\'entités...',
    timestamp: new Date(),
  });

  const entityGraph = await buildEntityGraph({
    sheets: allClassifiedSheets,
    countryCode,
  });

  onProgress?.({
    phase: 'build_graph',
    percent: 45,
    message: `${Object.keys(entityGraph.entities).length} types d'entités identifiés`,
    details: {
      entityTypes: Object.keys(entityGraph.entities),
      crossReferences: entityGraph.crossReferences.length,
    },
    timestamp: new Date(),
  });

  // Phase 4: Match records across sources for each entity type
  onProgress?.({
    phase: 'match_records',
    percent: 50,
    message: 'Correspondance des enregistrements...',
    timestamp: new Date(),
  });

  const allMatches: Record<string, RecordMatch[]> = {};
  const entityTypes = Object.keys(entityGraph.entities);

  for (let i = 0; i < entityTypes.length; i++) {
    const entityType = entityTypes[i];
    const entityNode = entityGraph.entities[entityType];

    // Get all records for this entity type from all sources
    const sourceRecords: SourceRecord[] = [];

    for (const source of entityNode.sources) {
      const parsedFile = parsedFiles.find((f) => f.fileName === source.fileName);
      if (!parsedFile) continue;

      const sheet = parsedFile.parseResult.sheets[source.sheetIndex];
      if (!sheet) continue;

      // Convert all rows to source records
      for (const row of sheet.allData) {
        sourceRecords.push({
          fileName: source.fileName,
          sheetName: source.sheetName,
          dataType: source.dataType,
          data: row,
          parsedAt: parsedFile.uploadedAt,
        });
      }
    }

    // Match records for this entity type
    const matches = await matchRecords({
      entityType: entityNode,
      sourceRecords,
      countryCode,
    });

    // DUPLICATE DETECTION: For employee entities, detect duplicates with existing database employees
    if (entityType === 'employees' || entityNode.targetTable === 'employees') {
      onProgress?.({
        phase: 'match_records',
        percent: 50 + ((i + 0.5) / entityTypes.length) * 10,
        message: `Détection des doublons pour ${matches.length} employé(s)...`,
        timestamp: new Date(),
      });

      for (const match of matches) {
        // Get employee data from first source record (they should all be matched to same employee)
        const candidateEmployee = match.sourceRecords[0]?.data || {};

        // Detect if this employee already exists in database
        const duplicate = await detectDuplicateEmployee({
          candidateEmployee,
          existingEmployees,
          countryCode,
        });

        // Store duplicate detection result
        if (duplicate) {
          match.duplicate = duplicate;
        }
      }

      const duplicatesCount = matches.filter((m) => m.duplicate).length;
      const newCount = matches.length - duplicatesCount;

      onProgress?.({
        phase: 'match_records',
        percent: 50 + ((i + 0.8) / entityTypes.length) * 10,
        message: `${duplicatesCount} doublon(s) détecté(s), ${newCount} nouveau(x)`,
        details: {
          duplicates: duplicatesCount,
          newEmployees: newCount,
        },
        timestamp: new Date(),
      });
    }

    allMatches[entityType] = matches;

    onProgress?.({
      phase: 'match_records',
      percent: 50 + ((i + 1) / entityTypes.length) * 10,
      message: `${entityNode.displayName}: ${matches.length} entité(s) unique(s)`,
      details: {
        entityType: entityNode.displayName,
        uniqueEntities: matches.length,
        totalRecords: sourceRecords.length,
      },
      timestamp: new Date(),
    });
  }

  // Phase 4.5: Resolve valid employees (CRITICAL for employee-centric referential integrity)
  onProgress?.({
    phase: 'match_records',
    percent: 60,
    message: 'Résolution des employés valides...',
    timestamp: new Date(),
  });

  const employeeMatchesForResolution = Object.entries(allMatches).find(
    ([entityType, matches]) =>
      entityType === 'employees' ||
      entityGraph.entities[entityType]?.targetTable === 'employees'
  )?.[1] || [];

  const validEmployees = resolveValidEmployees({
    existingEmployees,
    employeeMatches: employeeMatchesForResolution,
  });

  onProgress?.({
    phase: 'match_records',
    percent: 62,
    message: `${validEmployees.size} employé(s) valide(s) disponible(s) pour référence`,
    details: {
      validEmployees: validEmployees.size,
      existingFromDB: existingEmployees.length,
      newFromExcel: employeeMatchesForResolution.filter((m) => !m.duplicate).length,
    },
    timestamp: new Date(),
  });

  // Phase 5: Detect conflicts
  onProgress?.({
    phase: 'detect_conflicts',
    percent: 65,
    message: 'Détection des conflits...',
    timestamp: new Date(),
  });

  const allConflicts: FieldConflict[] = [];

  for (const entityType of entityTypes) {
    const matches = allMatches[entityType] || [];
    const conflicts = detectConflicts({
      matches,
      entityType,
    });

    allConflicts.push(...conflicts);
  }

  // Analyze conflict patterns for file quality scores
  const { fileQualityScores, recommendations } = analyzeConflictPatterns({
    conflicts: allConflicts,
    matches: Object.values(allMatches).flat(),
  });

  onProgress?.({
    phase: 'detect_conflicts',
    percent: 70,
    message: `${allConflicts.length} conflit(s) détecté(s)`,
    details: {
      totalConflicts: allConflicts.length,
      fileQualityScores,
    },
    timestamp: new Date(),
  });

  // Phase 6: Resolve conflicts (auto-resolve low-risk, flag high-risk)
  onProgress?.({
    phase: 'resolve_conflicts',
    percent: 72,
    message: 'Résolution intelligente des conflits...',
    timestamp: new Date(),
  });

  let totalAutoResolved = 0;
  let totalRequiringReview = 0;

  for (const entityType of entityTypes) {
    const matches = allMatches[entityType] || [];

    for (const match of matches) {
      const { autoResolved, requiresReview } = await autoResolveLowRiskConflicts({
        conflicts: allConflicts,
        entityType,
        entityId: match.entityId,
        countryCode,
        fileQualityScores,
      });

      totalAutoResolved += autoResolved.length;
      totalRequiringReview += requiresReview.length;

      // Update conflicts with resolutions
      for (const resolved of autoResolved) {
        const index = allConflicts.findIndex((c) => c.conflictId === resolved.conflictId);
        if (index !== -1) {
          allConflicts[index] = resolved;
        }
      }

      for (const review of requiresReview) {
        const index = allConflicts.findIndex((c) => c.conflictId === review.conflictId);
        if (index !== -1) {
          allConflicts[index] = review;
        }
      }
    }
  }

  onProgress?.({
    phase: 'resolve_conflicts',
    percent: 80,
    message: `${totalAutoResolved} conflit(s) résolus automatiquement`,
    details: {
      autoResolved: totalAutoResolved,
      requiresReview: totalRequiringReview,
    },
    timestamp: new Date(),
  });

  // Phase 7: Build complete entities with employee linking
  onProgress?.({
    phase: 'build_entities',
    percent: 85,
    message: 'Construction des entités complètes...',
    timestamp: new Date(),
  });

  const completeEntities: Record<string, CompleteEntity[]> = {};
  let totalRejected = 0;
  const rejectionsByEntityType: Record<string, number> = {};

  for (const entityType of entityTypes) {
    const entityNode = entityGraph.entities[entityType];
    const matches = allMatches[entityType] || [];

    const entities = buildEntitiesForType({
      matches,
      conflicts: allConflicts,
      targetSchema: {
        requiredFields: entityNode.sources[0]?.dataType
          ? allClassifiedSheets.find((s) => s.classification.dataType === entityNode.sources[0].dataType)
              ?.classification.requiredFieldsPresent || []
          : [],
        optionalFields: entityNode.sources[0]?.dataType
          ? allClassifiedSheets.find((s) => s.classification.dataType === entityNode.sources[0].dataType)
              ?.classification.optionalFieldsPresent || []
          : [],
      },
    });

    // EMPLOYEE LINKING: For non-employee entities, link to valid employees
    const isEmployeeEntity = entityType === 'employees' || entityNode.targetTable === 'employees';

    if (!isEmployeeEntity) {
      let linkedCount = 0;
      let rejectedCount = 0;

      for (const entity of entities) {
        // Try to find employee for this entity
        const employeeMatch = findEmployeeForEntity({
          entityData: entity.data,
          validEmployees,
        });

        if (employeeMatch) {
          // ✅ LINKED - Add employee reference
          entity._meta.linkedEmployee = {
            employeeId: employeeMatch.employee.employeeId,
            employeeNumber: employeeMatch.employee.employeeNumber,
            employeeName: employeeMatch.employee.employeeName,
            isNew: employeeMatch.employee.isNew,
            matchMethod: employeeMatch.matchMethod,
            matchConfidence: employeeMatch.matchConfidence,
          };
          linkedCount++;
        } else {
          // ❌ REJECTED - No employee match found
          const entityDescription = formatRejectedEntityDescription({
            entityData: entity.data,
            entityType: entityNode.displayName,
          });
          entity._meta.rejectionReason = `Employé non trouvé pour: ${entityDescription}`;
          rejectedCount++;
          totalRejected++;
        }
      }

      rejectionsByEntityType[entityType] = rejectedCount;

      onProgress?.({
        phase: 'build_entities',
        percent: 85 + ((entityTypes.indexOf(entityType) + 0.5) / entityTypes.length) * 10,
        message: `${entityNode.displayName}: ${linkedCount} lié(s), ${rejectedCount} rejeté(s)`,
        details: {
          entityType: entityNode.displayName,
          linked: linkedCount,
          rejected: rejectedCount,
        },
        timestamp: new Date(),
      });
    }

    completeEntities[entityType] = entities;

    onProgress?.({
      phase: 'build_entities',
      percent: 85 + ((entityTypes.indexOf(entityType) + 1) / entityTypes.length) * 10,
      message: `${entityNode.displayName}: ${entities.length} entité(s) construite(s)`,
      timestamp: new Date(),
    });
  }

  // Phase 8: Generate enhanced summary
  onProgress?.({
    phase: 'validate',
    percent: 95,
    message: 'Génération du résumé...',
    timestamp: new Date(),
  });

  const entityPreviews: EntityPreview[] = [];

  for (const entityType of entityTypes) {
    const entityNode = entityGraph.entities[entityType];
    const entities = completeEntities[entityType] || [];
    const stats = getEntityStats(entities);

    // Generate 2-3 example previews
    const examples = entities.slice(0, 3).map((entity) => {
      const preview = generateEntityPreview(entity);
      return {
        description: preview.description,
        categories: preview.categories,
        sources: preview.sources,
      };
    });

    entityPreviews.push({
      entityType,
      entityName: entityNode.displayName,
      count: entities.length,
      completeness: stats.averageCompleteness,
      examples,
      unresolvedConflicts: stats.withUnresolvedConflicts,
    });
  }

  // Calculate duplicate statistics for employee entities
  const employeeMatches = Object.entries(allMatches).find(
    ([entityType, matches]) =>
      entityType === 'employees' ||
      entityGraph.entities[entityType]?.targetTable === 'employees'
  )?.[1] || [];

  const duplicateStats = {
    total: employeeMatches.filter((m) => m.duplicate).length,
    willUpdate: employeeMatches.filter((m) => m.duplicate?.recommendedAction === 'update').length,
    willSkip: employeeMatches.filter((m) => m.duplicate?.recommendedAction === 'skip').length,
    requiresUserDecision: employeeMatches.filter((m) => m.duplicate?.recommendedAction === 'ask_user')
      .length,
    newEntities: employeeMatches.filter((m) => !m.duplicate).length,
  };

  // Build enhanced overall summary with duplicate info and rejections
  const totalEntitiesFound = entityPreviews.reduce((sum, e) => sum + e.count, 0);
  const totalWillImport = totalEntitiesFound - totalRejected;

  let overallSummary = `${parsedFiles.length} fichier(s) analysé(s) → ${totalWillImport} entité(s) seront importée(s)`;

  if (totalRejected > 0) {
    overallSummary += ` (${totalRejected} rejetée(s) - employé non trouvé)`;
  }

  if (duplicateStats.total > 0) {
    const parts: string[] = [];
    if (duplicateStats.newEntities > 0) {
      parts.push(`${duplicateStats.newEntities} nouveau(x)`);
    }
    if (duplicateStats.willUpdate > 0) {
      parts.push(`${duplicateStats.willUpdate} mise(s) à jour`);
    }
    if (duplicateStats.requiresUserDecision > 0) {
      parts.push(`${duplicateStats.requiresUserDecision} à confirmer`);
    }
    if (parts.length > 0) {
      overallSummary += ` | Employés: ${parts.join(' + ')}`;
    }
  }

  const summary: EnhancedImportSummary = {
    overallSummary,
    entities: entityPreviews,
    warnings: [
      ...recommendations,
      ...(totalRejected > 0
        ? [
            `⚠️  ${totalRejected} entité(s) rejetée(s) car aucun employé correspondant n'a été trouvé. Ces enregistrements ne seront pas importés.`,
          ]
        : []),
    ],
    estimatedTime: estimateImportTime(entityPreviews),
    totalConflicts: allConflicts.length,
    conflictsAutoResolved: totalAutoResolved,
    conflictsRequiringUser: totalRequiringReview,
    duplicates: duplicateStats.total > 0 ? duplicateStats : undefined,
    rejections:
      totalRejected > 0
        ? {
            total: totalRejected,
            byEntityType: rejectionsByEntityType,
          }
        : undefined,
  };

  const processingTimeMs = Date.now() - startTime;

  return {
    files: parsedFiles.map((f) => ({
      fileName: f.fileName,
      totalSheets: f.parseResult.sheets.length,
      totalRows: f.parseResult.totalRows,
    })),
    entityGraph,
    matchedEntities: Object.values(allMatches).flat(),
    conflicts: allConflicts,
    completeEntities,
    summary,
    needsConfirmation: totalRequiringReview > 0,
    confirmationReasons:
      totalRequiringReview > 0
        ? [`${totalRequiringReview} conflit(s) nécessitent votre confirmation`]
        : [],
    processingTimeMs,
  };
}

/**
 * Execute import for analyzed multi-file result
 */
export async function executeMultiFileImport(params: {
  analysisResult: MultiFileAnalysisResult;
  context: ImportContext;
}): Promise<{
  success: boolean;
  totalRecordsImported: number;
  entitiesByType: Record<string, number>;
  errors: string[];
}> {
  const { analysisResult, context } = params;
  const { tenantId, countryCode = 'CI', onProgress } = context;

  const errors: string[] = [];
  let totalRecordsImported = 0;
  const entitiesByType: Record<string, number> = {};

  // Get entity types in priority order (dependencies first)
  const entityTypes = Object.values(analysisResult.entityGraph.entities)
    .sort((a, b) => a.priority - b.priority)
    .map((e) => e.entityType);

  onProgress?.({
    phase: 'import',
    percent: 0,
    message: `Import de ${entityTypes.length} types d'entités...`,
    timestamp: new Date(),
  });

  // Import each entity type in order
  for (let i = 0; i < entityTypes.length; i++) {
    const entityType = entityTypes[i];
    const entityNode = analysisResult.entityGraph.entities[entityType];
    const entities = analysisResult.completeEntities[entityType] || [];

    if (entities.length === 0) {
      continue;
    }

    onProgress?.({
      phase: 'import',
      percent: (i / entityTypes.length) * 90,
      message: `Import ${entityNode.displayName}: ${entities.length} enregistrement(s)...`,
      details: {
        entityType: entityNode.displayName,
        count: entities.length,
      },
      timestamp: new Date(),
    });

    try {
      // Extract entity data (without _meta)
      const dataToImport = entities.map((e) => e.data);

      // Validate before import
      const validationResult = await validateData({
        data: dataToImport,
        dataType: entityNode.sources[0]?.dataType || entityType,
        targetTable: entityNode.targetTable,
        countryCode,
        context: {
          tenantId,
          allowPartialImport: context.allowPartialImport,
        },
      });

      if (!validationResult.isValid) {
        errors.push(
          `${entityNode.displayName}: ${validationResult.rowsFailed} erreur(s) de validation`
        );
        continue;
      }

      // Execute import
      const importResult = await executeImport(
        entityNode.sources[0]?.dataType || entityType,
        dataToImport,
        {
          tenantId,
          countryCode,
          allowPartialImport: context.allowPartialImport,
        }
      );

      if (importResult.success) {
        totalRecordsImported += importResult.recordsInserted;
        entitiesByType[entityType] = importResult.recordsInserted;

        onProgress?.({
          phase: 'import',
          percent: ((i + 1) / entityTypes.length) * 90,
          message: `✓ ${entityNode.displayName}: ${importResult.recordsInserted} importé(s)`,
          timestamp: new Date(),
        });
      } else {
        errors.push(...importResult.errors.map((e) => `${entityNode.displayName}: ${e.message}`));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      errors.push(`${entityNode.displayName}: ${errorMessage}`);
    }
  }

  onProgress?.({
    phase: 'import',
    percent: 100,
    message: `Import terminé: ${totalRecordsImported} enregistrement(s)`,
    details: {
      totalRecords: totalRecordsImported,
      entitiesByType,
      errors: errors.length,
    },
    timestamp: new Date(),
  });

  return {
    success: errors.length === 0,
    totalRecordsImported,
    entitiesByType,
    errors,
  };
}

/**
 * Estimate import time based on entity counts
 */
function estimateImportTime(entityPreviews: EntityPreview[]): string {
  const totalEntities = entityPreviews.reduce((sum, e) => sum + e.count, 0);

  // Rough estimate: 10 entities per second
  const seconds = Math.ceil(totalEntities / 10);

  if (seconds < 60) {
    return `environ ${seconds} seconde(s)`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `environ ${minutes} minute(s)`;
}
