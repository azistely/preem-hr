/**
 * AI Import Coordinator
 *
 * Orchestrates the entire import process:
 * 1. Parse Excel file
 * 2. Classify each sheet
 * 3. Clean data
 * 4. Validate data
 * 5. Execute import
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

import { parseExcel, type ParseExcelResult } from './tools/parse-excel';
import { classifySheet, type ClassificationResult } from './tools/classify-sheet';
import { cleanData, type CleanDataResult } from './tools/clean-data';
import { validateData, type ValidationResult } from './tools/validate-data';
import { executeImport, hasImporter } from './importers';
import { generateImportSummary, type ImportSummary } from './tools/generate-summary';

export interface ImportStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  message: string;
  data?: any;
}

export interface SheetImportPlan {
  sheetName: string;
  classification: ClassificationResult;
  cleaningResult?: CleanDataResult;
  validationResult?: ValidationResult;
  importResult?: {
    success: boolean;
    recordsInserted: number;
    errors?: string[];
  };
}

export interface ImportAnalysisResult {
  fileName: string;
  totalSheets: number;
  sheetsToImport: number;
  sheetPlans: SheetImportPlan[];
  needsConfirmation: boolean;
  lowConfidenceSheets: string[];
  estimatedRecords: number;
  /** User-friendly summary in French showing what will be created */
  summary?: ImportSummary;
}

/**
 * Analyze Excel file and create import plan
 *
 * This is Step 1: Parse and classify all sheets
 */
export async function analyzeImportFile(params: {
  filePath: string;
  countryCode?: string;
  onProgress?: (step: ImportStep) => void;
}): Promise<ImportAnalysisResult> {
  const { filePath, countryCode = 'CI', onProgress } = params;

  // Step 1: Parse Excel file
  onProgress?.({
    step: 1,
    name: 'Analyse du fichier Excel',
    status: 'in_progress',
    progress: 10,
    message: 'Lecture du fichier...',
  });

  const parseResult = await parseExcel({
    filePath,
    includeEmptyRows: false,
    maxSampleRows: 10,
  });

  onProgress?.({
    step: 1,
    name: 'Analyse du fichier Excel',
    status: 'completed',
    progress: 30,
    message: `${parseResult.totalSheets} feuille(s) trouvée(s), ${parseResult.totalRows} ligne(s)`,
    data: parseResult,
  });

  // Step 2: Classify each sheet
  onProgress?.({
    step: 2,
    name: 'Classification des données',
    status: 'in_progress',
    progress: 40,
    message: 'Analyse intelligente des types de données...',
  });

  const sheetPlans: SheetImportPlan[] = [];
  const lowConfidenceSheets: string[] = [];

  for (const sheet of parseResult.sheets) {
    const classification = await classifySheet({
      sheetName: sheet.name,
      columns: sheet.columns,
      sampleData: sheet.sampleData,
      countryCode,
    });

    sheetPlans.push({
      sheetName: sheet.name,
      classification,
    });

    // Track low-confidence classifications (< 90%)
    if (classification.confidence < 90) {
      lowConfidenceSheets.push(sheet.name);
    }
  }

  onProgress?.({
    step: 2,
    name: 'Classification des données',
    status: 'completed',
    progress: 60,
    message: `${sheetPlans.length} feuille(s) classifiée(s)`,
    data: sheetPlans,
  });

  // Step 3: Generate user-friendly summary
  onProgress?.({
    step: 3,
    name: 'Génération du résumé',
    status: 'in_progress',
    progress: 70,
    message: 'Création du résumé en français...',
  });

  const summary = await generateImportSummary({
    fileName: parseResult.fileName,
    sheets: sheetPlans.map((plan) => {
      const sheetData = parseResult.sheets.find((s) => s.name === plan.sheetName)!;
      return {
        sheetData,
        classification: plan.classification,
      };
    }),
    countryCode,
  });

  onProgress?.({
    step: 3,
    name: 'Génération du résumé',
    status: 'completed',
    progress: 80,
    message: 'Résumé généré',
    data: summary,
  });

  const result: ImportAnalysisResult = {
    fileName: parseResult.fileName,
    totalSheets: parseResult.totalSheets,
    sheetsToImport: sheetPlans.length,
    sheetPlans,
    needsConfirmation: lowConfidenceSheets.length > 0,
    lowConfidenceSheets,
    estimatedRecords: parseResult.totalRows,
    summary,
  };

  return result;
}

/**
 * Execute import for a specific sheet
 *
 * This is Step 2: Clean, validate, and import data
 */
export async function executeSheetImport(params: {
  sheetPlan: SheetImportPlan;
  sheetData: Record<string, any>[];
  countryCode?: string;
  tenantId: string;
  onProgress?: (step: ImportStep) => void;
}): Promise<SheetImportPlan> {
  const { sheetPlan, sheetData, countryCode = 'CI', tenantId, onProgress } = params;

  // Step 3: Clean data
  onProgress?.({
    step: 3,
    name: 'Nettoyage des données',
    status: 'in_progress',
    progress: 70,
    message: `Transformation des données de "${sheetPlan.sheetName}"...`,
  });

  const cleaningResult = await cleanData({
    rawData: sheetData,
    targetTable: sheetPlan.classification.targetTable,
    fieldMappings: sheetPlan.classification.fieldMappings,
    targetSchema: {
      requiredFields: sheetPlan.classification.requiredFieldsPresent,
      optionalFields: sheetPlan.classification.optionalFieldsPresent,
    },
    countryCode,
  });

  sheetPlan.cleaningResult = cleaningResult;

  onProgress?.({
    step: 3,
    name: 'Nettoyage des données',
    status: 'completed',
    progress: 80,
    message: `${cleaningResult.rowsCleaned}/${cleaningResult.rowsProcessed} lignes nettoyées`,
    data: cleaningResult,
  });

  // Step 4: Validate data
  onProgress?.({
    step: 4,
    name: 'Validation des données',
    status: 'in_progress',
    progress: 85,
    message: `Validation des règles métier...`,
  });

  const validationResult = await validateData({
    data: cleaningResult.cleanedData,
    dataType: sheetPlan.classification.dataType,
    targetTable: sheetPlan.classification.targetTable,
    countryCode,
    context: {
      tenantId,
    },
  });

  sheetPlan.validationResult = validationResult;

  onProgress?.({
    step: 4,
    name: 'Validation des données',
    status: validationResult.isValid ? 'completed' : 'failed',
    progress: 90,
    message: validationResult.isValid
      ? `${validationResult.rowsPassed}/${validationResult.rowsValidated} lignes validées`
      : `${validationResult.rowsFailed} erreur(s) trouvée(s)`,
    data: validationResult,
  });

  // If validation failed, don't proceed to import
  if (!validationResult.isValid) {
    return sheetPlan;
  }

  // Step 5: Execute import using appropriate importer
  onProgress?.({
    step: 5,
    name: 'Importation',
    status: 'in_progress',
    progress: 95,
    message: `Insertion des données dans ${sheetPlan.classification.targetTable}...`,
  });

  // Execute import via dispatcher
  // Pass the cleaned data (validation doesn't modify data, just checks it)
  const importResult = await executeImport(
    sheetPlan.classification.dataType,
    cleaningResult.cleanedData,
    {
      tenantId,
      countryCode,
      allowPartialImport: true, // Allow partial imports for flexibility
    }
  );

  // Store detailed import result
  sheetPlan.importResult = {
    success: importResult.success,
    recordsInserted: importResult.recordsInserted,
    errors: importResult.errors.map((e) => e.message),
  };

  onProgress?.({
    step: 5,
    name: 'Importation',
    status: importResult.success ? 'completed' : 'failed',
    progress: 100,
    message: importResult.success
      ? `${importResult.recordsInserted} enregistrement(s) importé(s)`
      : `Échec de l'import: ${importResult.errors[0]?.message || 'Erreur inconnue'}`,
    data: sheetPlan.importResult,
  });

  return sheetPlan;
}

/**
 * Execute full import process
 *
 * Coordinates all steps from file analysis to database insertion
 */
export async function executeFullImport(params: {
  filePath: string;
  countryCode?: string;
  tenantId: string;
  confirmedSheets?: string[]; // Sheets user explicitly confirmed
  onProgress?: (step: ImportStep) => void;
}): Promise<{
  success: boolean;
  totalRecordsImported: number;
  sheetResults: SheetImportPlan[];
  errors: string[];
}> {
  const { filePath, countryCode = 'CI', tenantId, confirmedSheets, onProgress } = params;

  const errors: string[] = [];

  try {
    // Step 1: Analyze file
    const analysis = await analyzeImportFile({
      filePath,
      countryCode,
      onProgress,
    });

    // Check if user confirmation is needed
    if (analysis.needsConfirmation && !confirmedSheets) {
      throw new Error(
        `Confirmation requise pour ${analysis.lowConfidenceSheets.length} feuille(s): ${analysis.lowConfidenceSheets.join(', ')}`
      );
    }

    // Parse file again to get full data
    const parseResult = await parseExcel({
      filePath,
      includeEmptyRows: false,
      maxSampleRows: 10,
    });

    // Step 2: Execute import for each sheet
    let totalRecordsImported = 0;

    for (let i = 0; i < analysis.sheetPlans.length; i++) {
      const sheetPlan = analysis.sheetPlans[i];
      const sheet = parseResult.sheets.find((s) => s.name === sheetPlan.sheetName);

      if (!sheet) {
        errors.push(`Feuille "${sheetPlan.sheetName}" non trouvée`);
        continue;
      }

      // Skip sheets that need confirmation if not confirmed
      if (
        analysis.lowConfidenceSheets.includes(sheetPlan.sheetName) &&
        confirmedSheets &&
        !confirmedSheets.includes(sheetPlan.sheetName)
      ) {
        onProgress?.({
          step: i + 3,
          name: `Import ${sheetPlan.sheetName}`,
          status: 'pending',
          progress: 0,
          message: 'Ignoré (non confirmé)',
        });
        continue;
      }

      try {
        const result = await executeSheetImport({
          sheetPlan,
          sheetData: sheet.allData,
          countryCode,
          tenantId,
          onProgress,
        });

        if (result.importResult?.success) {
          totalRecordsImported += result.importResult.recordsInserted;
        } else if (result.validationResult && !result.validationResult.isValid) {
          errors.push(
            `${sheetPlan.sheetName}: ${result.validationResult.rowsFailed} erreur(s) de validation`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push(`${sheetPlan.sheetName}: ${errorMessage}`);
      }
    }

    return {
      success: errors.length === 0,
      totalRecordsImported,
      sheetResults: analysis.sheetPlans,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    errors.push(errorMessage);

    return {
      success: false,
      totalRecordsImported: 0,
      sheetResults: [],
      errors,
    };
  }
}
