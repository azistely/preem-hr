/**
 * Validate Data Tool - Context-Aware Business Rule Validation
 *
 * Uses AI to validate data against business rules with context awareness.
 * Understands exceptions (e.g., STAGIAIRE can earn below SMIG).
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

export interface ValidationError {
  row: number;
  field: string;
  value: any;
  rule: string;
  message: string;
  suggestedFix?: string;
}

export interface ValidationWarning {
  row: number;
  field: string;
  value: any;
  rule: string;
  message: string;
  canProceed: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  rowsValidated: number;
  rowsPassed: number;
  rowsFailed: number;
  summary: string;
}

/**
 * Validate employee/payroll data against business rules
 *
 * This tool uses AI to:
 * - Validate required fields are present
 * - Check data types and formats
 * - Apply business rules with context awareness
 * - Distinguish between ERRORS (blocking) and WARNINGS (informational)
 * - Understand exceptions based on employee type, contract type, etc.
 */
export async function validateData(params: {
  data: Record<string, any>[];
  dataType: string;
  targetTable: string;
  countryCode?: string;
  context?: {
    tenantId: string;
    allowPartialImport?: boolean;
  };
}): Promise<ValidationResult> {
  const { data, dataType, targetTable, countryCode = 'CI', context } = params;

  // Define the output schema
  const validationSchema = z.object({
    isValid: z
      .boolean()
      .describe('Overall validation status. False if ANY errors exist, true if only warnings or all passed.'),

    errors: z
      .array(
        z.object({
          row: z.number().describe('Row number (1-indexed)'),
          field: z.string().describe('Database field name'),
          value: z.any().describe('The problematic value'),
          rule: z.string().describe('Which business rule was violated'),
          message: z
            .string()
            .describe('User-friendly error message in French explaining the problem'),
          suggestedFix: z
            .string()
            .optional()
            .describe('Optional suggestion for how to fix this error'),
        })
      )
      .describe('BLOCKING errors that prevent import. Must be fixed before proceeding.'),

    warnings: z
      .array(
        z.object({
          row: z.number().describe('Row number (1-indexed)'),
          field: z.string().describe('Database field name'),
          value: z.any().describe('The suspicious value'),
          rule: z.string().describe('Which business rule triggered this warning'),
          message: z
            .string()
            .describe('User-friendly warning message in French explaining the concern'),
          canProceed: z
            .boolean()
            .describe('Whether import can proceed despite this warning'),
        })
      )
      .describe('NON-BLOCKING warnings. Import can proceed, but user should review.'),

    rowsValidated: z.number().describe('Total number of rows validated'),
    rowsPassed: z.number().describe('Number of rows with no errors (may have warnings)'),
    rowsFailed: z.number().describe('Number of rows with blocking errors'),

    summary: z
      .string()
      .describe('One-sentence summary in French of validation results'),
  });

  // Use AI to validate the data
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-20250514'),
    schema: validationSchema,
    prompt: `You are an expert at validating HR data against business rules for West African countries.

**Task:** Validate this ${dataType} data against business rules and regulations.

**Context:**
- Data type: ${dataType}
- Target table: ${targetTable}
- Country: ${countryCode} (${countryCode === 'CI' ? 'Côte d\'Ivoire' : countryCode === 'SN' ? 'Sénégal' : 'Other'})
- Rows to validate: ${data.length}

**Data to Validate (first 5 rows):**
${JSON.stringify(data.slice(0, 5), null, 2)}

**Validation Rules:**

1. **Required Fields**
   - Check all required fields are present and non-null
   - ERROR if missing: "Le champ [field] est obligatoire"

2. **Data Type Validation**
   - Dates must be valid dates
   - Numbers must be numeric
   - Emails must be valid email format
   - Phone numbers must match country format
   - ERROR if wrong type: "Le champ [field] doit être un(e) [type]"

3. **Format Constraints**
   - Email: valid format (contains @)
   - Phone (CI): +225 followed by 10 digits
   - Phone (SN): +221 followed by 9 digits
   - CNPS number (CI): 10 digits
   - IPRES number (SN): varies
   - Dates: ISO format YYYY-MM-DD
   - ERROR if invalid format: "Le format du champ [field] est invalide"

4. **Business Rules - Employee Data**

   **Salary Rules:**
   - Regular employees (CDI, CDD): baseSalary >= SMIG
     - CI: SMIG = 75,000 FCFA
     - SN: SMIG = 60,000 FCFA
   - **EXCEPTION:** STAGIAIRE (interns) can earn below SMIG
   - **EXCEPTION:** APPRENTI can earn below SMIG
   - WARNING (not error) if below SMIG for interns: "Salaire inférieur au SMIG, mais autorisé pour les stagiaires"
   - ERROR if below SMIG for regular employees: "Le salaire de base ({value} FCFA) est inférieur au SMIG de ${countryCode === 'CI' ? '75,000' : '60,000'} FCFA"

   **Date Rules:**
   - hireDate cannot be in the future
   - hireDate should not be more than 50 years ago (WARNING)
   - dateOfBirth: employee should be 18-70 years old
   - ERROR if hireDate > today: "La date d'embauche ne peut pas être dans le futur"
   - WARNING if age < 18: "L'employé a moins de 18 ans"

   **Contract Rules:**
   - CDD (fixed-term) must have endDate
   - CDI (permanent) should NOT have endDate
   - ERROR if CDD without endDate: "Un contrat CDD doit avoir une date de fin"
   - startDate must be before endDate
   - ERROR if startDate >= endDate: "La date de début doit être antérieure à la date de fin"

   **Unique Constraints:**
   - employeeNumber must be unique within the import data
   - email should be unique (WARNING if duplicate)
   - cnpsNumber should be unique (WARNING if duplicate)
   - ERROR if duplicate employeeNumber: "Le matricule {value} est en double"

5. **Business Rules - Payroll Data**

   **Amount Validation:**
   - grossSalary >= netSalary (gross should be higher than net)
   - netSalary > 0
   - cnpsEmployee, cnpsEmployer, its >= 0 (can be 0, but not negative)
   - ERROR if grossSalary < netSalary: "Le salaire brut ne peut pas être inférieur au net"
   - ERROR if negative amounts: "Les montants ne peuvent pas être négatifs"

   **Period Validation:**
   - payrollPeriod format: YYYY-MM or similar
   - month: 1-12
   - year: 2000-2030 (reasonable range)
   - ERROR if invalid period: "Période de paie invalide"

6. **Business Rules - Time-Off Data**

   **Balance Validation:**
   - days >= 0 (can't have negative balance)
   - WARNING if days > 60: "Solde de congés inhabituellement élevé ({value} jours)"
   - ERROR if days < 0: "Le solde ne peut pas être négatif"

   **Date Validation:**
   - startDate must be before endDate
   - totalDays should match date range
   - WARNING if mismatch: "Le nombre de jours ({value}) ne correspond pas à la période"

7. **Context-Aware Exceptions**

   - **STAGIAIRE (Intern):**
     - Can earn below SMIG → WARNING instead of ERROR
     - May have limited benefits → OK
     - Contract is usually STAGE (internship agreement)

   - **EXPAT (Expatriate):**
     - Different tax rules may apply → Don't validate ITS the same way
     - May have special allowances → OK

   - **CDDTI (Travail Temporaire):**
     - Short contract duration is normal → Don't warn about short CDD
     - May have different social security treatment

**Country-Specific Rules (${countryCode}):**
${countryCode === 'CI' ? `
**Côte d'Ivoire:**
- SMIG (minimum wage): 75,000 FCFA/month
- CNPS: 10-digit number
- Phone: +225 XX XX XX XX XX
- Tax: ITS (Impôt sur Traitement et Salaire)
- Sectors: BTP (construction), others
- Work accident rates by sector
` : countryCode === 'SN' ? `
**Sénégal:**
- SMIG (minimum wage): 60,000 FCFA/month
- IPRES: social security number
- Phone: +221 XX XXX XX XX
- Tax: IRPP (Impôt sur le Revenu des Personnes Physiques)
` : ''}

**Error vs Warning Guidelines:**

**ERROR (blocks import):**
- Missing required field
- Invalid data type or format
- Violates hard constraint (unique, not null)
- Business rule violation for regular employees
- Data inconsistency (gross < net)

**WARNING (allows import with confirmation):**
- Business rule violation with valid exception (intern below SMIG)
- Suspicious but possibly valid data (very high salary, old hire date)
- Potential duplicates (same name, similar values)
- Missing optional field that's usually present

**Output Requirements:**
- Be strict but context-aware
- Generate helpful error messages in French
- Suggest fixes when possible
- Distinguish between blocking errors and informational warnings
- Consider employee type and contract type when applying rules

Validate thoroughly and think step by step.`,
  });

  return object as ValidationResult;
}
