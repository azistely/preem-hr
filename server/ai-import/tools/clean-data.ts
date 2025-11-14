/**
 * Clean Data Tool - Intelligent Data Transformation
 *
 * Uses AI to clean and transform raw Excel data to match database schema.
 * NO hardcoded cleaning rules - AI understands semantically.
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export interface DataTransformation {
  field: string;
  issue: string;
  action: string;
  exampleBefore: string;
  exampleAfter: string;
}

export interface DataWarning {
  row: number;
  field: string;
  message: string;
  severity: 'warning' | 'info';
}

export interface CleanDataResult {
  cleanedData: Record<string, any>[];
  transformations: DataTransformation[];
  warnings: DataWarning[];
  rowsProcessed: number;
  rowsCleaned: number;
}

/**
 * Clean and transform HR data to match database schema
 *
 * This tool uses AI to:
 * - Parse dates in any format (DD/MM/YYYY, MM/DD/YYYY, Excel serial)
 * - Normalize numbers (remove spaces, commas, currency symbols)
 * - Fix names (handle "LastName, FirstName" format)
 * - Map enums (PERMANENT→CDI, H→male, etc.)
 * - Standardize phone/email
 * - Handle missing values intelligently
 */
export async function cleanData(params: {
  rawData: Record<string, any>[];
  targetTable: string;
  fieldMappings: Record<string, string>;
  targetSchema: {
    requiredFields: string[];
    optionalFields: string[];
  };
  countryCode?: string;
}): Promise<CleanDataResult> {
  const { rawData, targetTable, fieldMappings, targetSchema, countryCode = 'CI' } = params;

  // Define the output schema
  const cleanDataSchema = z.object({
    cleanedData: z
      .array(z.record(z.any()))
      .describe('Array of cleaned data records, ready for database import. Use database field names, not Excel column names.'),

    transformations: z
      .array(
        z.object({
          field: z.string().describe('Database field name'),
          issue: z.string().describe('What was wrong with the data'),
          action: z.string().describe('How you fixed it'),
          exampleBefore: z.string().describe('Example original value'),
          exampleAfter: z.string().describe('Example transformed value'),
        })
      )
      .describe('List of all transformations applied to the data'),

    warnings: z
      .array(
        z.object({
          row: z.number().describe('Row number (1-indexed)'),
          field: z.string().describe('Database field name'),
          message: z.string().describe('Warning message'),
          severity: z.enum(['warning', 'info']).describe('Severity level'),
        })
      )
      .describe('Non-fatal issues that were handled'),

    rowsProcessed: z.number().describe('Total number of rows processed'),
    rowsCleaned: z.number().describe('Number of rows successfully cleaned'),
  });

  // Use AI to clean the data
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: cleanDataSchema,
    prompt: `You are an expert at cleaning and transforming HR data from Excel files.

**Task:** Clean this raw Excel data to match the database schema.

**Context:**
- Target table: ${targetTable}
- Country: ${countryCode} (${countryCode === 'CI' ? 'Côte d\'Ivoire' : countryCode === 'SN' ? 'Sénégal' : 'Other'})
- Rows to process: ${rawData.length}

**Field Mappings (Excel → Database):**
${JSON.stringify(fieldMappings, null, 2)}

**Target Schema:**
- Required fields: ${JSON.stringify(targetSchema.requiredFields)}
- Optional fields: ${JSON.stringify(targetSchema.optionalFields)}

**Raw Data (first 5 rows):**
${JSON.stringify(rawData.slice(0, 5), null, 2)}

**Cleaning Instructions:**

1. **Date Handling**
   - Parse dates in ANY format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, Excel serial numbers
   - Convert ALL dates to ISO format: YYYY-MM-DD
   - For ${countryCode}, prefer DD/MM/YYYY interpretation for ambiguous dates
   - Examples:
     - "15/06/2024" → "2024-06-15"
     - "06/15/2024" → "2024-06-15"
     - "44735" (Excel serial) → "2022-06-01"
     - "1er janvier 2024" → "2024-01-01"

2. **Number Handling**
   - Remove ALL non-numeric characters: spaces, commas, currency symbols
   - Parse French number format (space as thousands separator)
   - Examples:
     - "850 000 FCFA" → 850000
     - "1.500.000" → 1500000
     - "2,500.00" → 2500

3. **Name Handling**
   - Handle "LastName, FirstName" format
   - Split combined names correctly
   - Capitalize properly (UPPERCASE → Title Case)
   - Examples:
     - "KOUASSI, Jean" → firstName: "Jean", lastName: "KOUASSI"
     - "jean kouadio" → firstName: "Jean", lastName: "Kouadio"

4. **Enum Mapping**
   - Map French/English values to database enums
   - Handle variations and abbreviations
   - Examples:
     - "PERMANENT" / "CDI" → "CDI"
     - "Contrat à Durée Déterminée" → "CDD"
     - "H" / "M" / "Homme" / "Male" → "male"
     - "F" / "Femme" / "Female" → "female"
     - "Marié" / "Married" → "MARRIED"
     - "Célibataire" / "Single" → "SINGLE"

5. **Phone/Email Handling**
   - Standardize phone numbers for ${countryCode}
   - Validate email format
   - Examples (CI):
     - "07 12 34 56 78" → "+2250712345678"
     - "0712345678" → "+2250712345678"
     - "+225 07 12 34 56 78" → "+2250712345678"

6. **Missing Value Handling**
   - null, "N/A", "", "-", "n/a", "NULL" → null
   - Empty strings for required fields → generate warning
   - Keep meaningful zeros (0 is NOT null)

7. **Field Mapping**
   - Use the provided field mappings to rename columns
   - Excel column "Matricule" → database field "employeeNumber"
   - Excel column "Nom" → database field "lastName"
   - etc.

8. **Data Validation**
   - Check required fields are present (warn if missing)
   - Check data types are correct (string, number, date, boolean)
   - Warn about suspicious values (negative salaries, future dates for hireDate)

**Country-Specific Rules (${countryCode}):**
${countryCode === 'CI' ? `
- Phone format: +225 XX XX XX XX XX (10 digits)
- CNPS number: 10 digits
- Date preference: DD/MM/YYYY
- Currency: XOF (CFA Franc)
` : countryCode === 'SN' ? `
- Phone format: +221 XX XXX XX XX (9 digits)
- IPRES number format
- Date preference: DD/MM/YYYY
- Currency: XOF (CFA Franc)
` : ''}

**Output Requirements:**
- Return cleaned data with DATABASE field names (not Excel columns)
- Document EVERY transformation you make
- Generate warnings for any issues encountered
- Preserve original row order
- Count successful vs failed rows

Think step by step and be thorough. Quality over speed.`,
  });

  return object as CleanDataResult;
}
