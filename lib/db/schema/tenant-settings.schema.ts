/**
 * Tenant Settings Schema
 *
 * Defines the structure for tenant configuration stored in the `settings` JSONB field.
 * This includes company information, legal details, and fund accounts.
 *
 * Design decisions:
 * - Uses JSONB for flexibility across different countries
 * - Country-specific fields handled via validation logic
 * - Fund accounts stored as array for easy CRUD operations
 */

import { z } from "zod";

/**
 * Company General Information
 * Basic business details that apply to all countries
 */
export const CompanyGeneralInfoSchema = z.object({
  // Company names
  legalName: z.string().min(1, "La raison sociale est requise").optional(),
  tradeName: z.string().optional(),

  // Leadership
  legalRepresentative: z.string().optional(),

  // Founding
  foundedDate: z.string().optional(), // ISO date string

  // Contact information
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

/**
 * Company Legal Information
 * Country-specific legal identifiers and configuration
 */
export const CompanyLegalInfoSchema = z.object({
  // Social security identifiers (country-specific)
  socialSecurityNumber: z.string().optional(), // CNPS (CI), IPRES (SN), CNSS (BF)

  // Tax identifiers (country-specific)
  taxId: z.string().optional(), // Compte Contribuable (CI), NINEA (SN), IFU (BF)

  // Business registration
  rccm: z.string().optional(), // Registre du Commerce

  // Labor regulations
  collectiveAgreement: z.string().optional(), // Convention Collective
  workAccidentRate: z.number().min(0).max(10).optional(), // Taux AT (0-10%)
});

/**
 * Fund Account (Caisse)
 * Represents a government agency or insurance provider account
 */
export const FundAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Le nom de la caisse est requis"),
  accountNumber: z.string().optional(),
  contact: z.string().optional(), // Email or phone
  type: z.enum(["tax", "social", "insurance", "mutual"]).optional(),

  // Metadata
  notes: z.string().optional(),
});

/**
 * Onboarding State
 * Tracks user progress through onboarding flow
 */
export const OnboardingStateSchema = z.object({
  questionnaire_complete: z.boolean().optional(),
  questionnaire_answers: z.record(z.unknown()).optional(),
  current_step: z.string().optional(),
  completed_steps: z.array(z.string()).optional(),
  path: z.enum(["SOLO", "SMALL_TEAM", "MEDIUM_BUSINESS", "LARGE_ENTERPRISE"]).optional(),
  firstEmployeeId: z.string().optional(),
  company_info_complete: z.boolean().optional(),
});

/**
 * Competency Scale Types
 * Available rating scales for competency evaluation
 */
export const CompetencyScaleType = z.enum([
  "french_descriptive", // Non acquis → Expert (1-5)
  "numeric_1_5",        // 1-5 simple numeric
  "numeric_1_4",        // 1-4 (no neutral option)
  "numeric_1_3",        // 1-3 simple
  "numeric_1_10",       // 1-10 detailed
  "letter_grade",       // A-F grades
  "percentage",         // 0-100% slider
  "custom",             // Custom defined levels
]);

export type CompetencyScaleType = z.infer<typeof CompetencyScaleType>;

/**
 * Performance Settings
 * Configuration for performance management module
 */
export const PerformanceSettingsSchema = z.object({
  // Default competency rating scale for the organization
  // Can be overridden at individual competency level
  defaultCompetencyScale: CompetencyScaleType.optional().default("french_descriptive"),
});

/**
 * Tenant Settings (Complete)
 * Top-level schema that encompasses all tenant configuration
 */
export const TenantSettingsSchema = z.object({
  // Company information
  company: CompanyGeneralInfoSchema.optional(),

  // Legal information
  legal: CompanyLegalInfoSchema.optional(),

  // Fund accounts (caisses)
  funds: z.array(FundAccountSchema).optional(),

  // Onboarding state
  onboarding: OnboardingStateSchema.optional(),

  // Departments (temporary storage during onboarding)
  departments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })).optional(),

  // Performance management settings
  performance: PerformanceSettingsSchema.optional(),

  // Allow additional fields for future extensions
}).passthrough();

/**
 * Type exports for use throughout the application
 */
export type CompanyGeneralInfo = z.infer<typeof CompanyGeneralInfoSchema>;
export type CompanyLegalInfo = z.infer<typeof CompanyLegalInfoSchema>;
export type FundAccount = z.infer<typeof FundAccountSchema>;
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;
export type PerformanceSettings = z.infer<typeof PerformanceSettingsSchema>;
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

/**
 * Input schemas for mutations (make all fields optional for partial updates)
 */
export const UpdateCompanyGeneralInfoInputSchema = CompanyGeneralInfoSchema.partial();
export const UpdateCompanyLegalInfoInputSchema = CompanyLegalInfoSchema.partial();
export const AddFundInputSchema = FundAccountSchema.omit({ id: true }); // ID auto-generated
export const UpdateFundInputSchema = FundAccountSchema.partial().required({ id: true });

export type UpdateCompanyGeneralInfoInput = z.infer<typeof UpdateCompanyGeneralInfoInputSchema>;
export type UpdateCompanyLegalInfoInput = z.infer<typeof UpdateCompanyLegalInfoInputSchema>;
export type AddFundInput = z.infer<typeof AddFundInputSchema>;
export type UpdateFundInput = z.infer<typeof UpdateFundInputSchema>;
