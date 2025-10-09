/**
 * Onboarding Service
 *
 * Handles questionnaire-based discovery and adaptive onboarding paths
 */

import { db } from '@/lib/db';
import { tenants, employees, positions, assignments, employeeSalaries } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { generateEmployeeNumber } from '@/features/employees/services/employee-number';
import { autoInjectCalculatedComponents } from '@/lib/salary-components/component-calculator';

// Types
export type CompanySize = 'solo' | 'small_team' | 'medium' | 'large';
export type OnboardingPath = 'SOLO' | 'SMALL_TEAM' | 'MEDIUM' | 'LARGE';
export type CompensationType = 'fixed_salary' | 'with_allowances' | 'with_commissions' | 'full';
export type TimeTrackingType = 'none' | 'basic' | 'geofencing' | 'overtime';
export type TimeOffType = 'none' | 'legal_only' | 'custom_policies';

export interface QuestionnaireAnswers {
  company_size?: CompanySize;
  has_departments?: boolean;
  contract_types?: 'full_time_only' | 'multiple';
  compensation?: CompensationType;
  time_tracking?: TimeTrackingType;
  time_off?: TimeOffType;
  payroll_frequency?: 'monthly' | 'bi_weekly';
}

export interface OnboardingState {
  questionnaire_complete: boolean;
  questionnaire_answers: QuestionnaireAnswers;
  current_step: string | null;
  completed_steps: string[];
  path: OnboardingPath | null;
  onboarding_complete: boolean;
  onboarding_completed_at: string | null;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  duration: number; // minutes
  order: number;
}

export interface PathPreview {
  path: OnboardingPath;
  steps: OnboardingStep[];
  totalDuration: number;
  estimatedMinutes: number;
}

/**
 * Get onboarding state for tenant
 */
export async function getOnboardingState(tenantId: string): Promise<OnboardingState> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', tenantId);
  }

  const settings = (tenant.settings as any) || {};
  const onboarding = settings.onboarding || {};

  return {
    questionnaire_complete: onboarding.questionnaire_complete || false,
    questionnaire_answers: onboarding.questionnaire_answers || {},
    current_step: onboarding.current_step || null,
    completed_steps: onboarding.completed_steps || [],
    path: onboarding.path || null,
    onboarding_complete: onboarding.onboarding_complete || false,
    onboarding_completed_at: onboarding.onboarding_completed_at || null,
  };
}

/**
 * Answer questionnaire question
 */
export async function answerQuestion(
  tenantId: string,
  questionId: keyof QuestionnaireAnswers,
  answer: any
): Promise<OnboardingState> {
  const state = await getOnboardingState(tenantId);

  const updatedAnswers = {
    ...state.questionnaire_answers,
    [questionId]: answer,
  };

  // Check if questionnaire is complete (all 7 questions answered)
  const requiredQuestions: (keyof QuestionnaireAnswers)[] = [
    'company_size',
    'has_departments',
    'contract_types',
    'compensation',
    'time_tracking',
    'time_off',
    'payroll_frequency',
  ];

  const allAnswered = requiredQuestions.every(q => updatedAnswers[q] !== undefined);

  const newState: OnboardingState = {
    ...state,
    questionnaire_answers: updatedAnswers,
    questionnaire_complete: allAnswered,
  };

  // If questionnaire complete, determine path
  if (allAnswered) {
    newState.path = determineOnboardingPath(updatedAnswers);
  }

  await updateOnboardingState(tenantId, newState);

  return newState;
}

/**
 * Determine onboarding path based on answers
 */
function determineOnboardingPath(answers: QuestionnaireAnswers): OnboardingPath {
  const size = answers.company_size;

  if (size === 'solo') return 'SOLO';
  if (size === 'small_team') return 'SMALL_TEAM';
  if (size === 'medium') return 'MEDIUM';
  if (size === 'large') return 'LARGE';

  return 'SOLO'; // Default fallback
}

/**
 * Generate adaptive path preview
 */
export async function getPathPreview(tenantId: string): Promise<PathPreview> {
  const state = await getOnboardingState(tenantId);

  if (!state.questionnaire_complete || !state.path) {
    throw new ValidationError('Le questionnaire doit être complété avant de générer l\'aperçu du parcours');
  }

  const answers = state.questionnaire_answers;
  const path = state.path;

  // Core steps (all paths)
  const coreSteps: OnboardingStep[] = [
    {
      id: 'country_selection',
      title: 'Pays',
      description: 'Sélectionnez votre pays d\'opération',
      required: true,
      duration: 1,
      order: 1,
    },
    {
      id: 'company_info',
      title: 'Informations',
      description: 'Détails de votre entreprise',
      required: true,
      duration: 2,
      order: 2,
    },
  ];

  let steps: OnboardingStep[] = [...coreSteps];
  let order = 3;

  // Departments (Medium/Large only)
  if (path === 'MEDIUM' || path === 'LARGE') {
    if (answers.has_departments) {
      steps.push({
        id: 'departments_setup',
        title: 'Départements',
        description: 'Organisez votre entreprise',
        required: false,
        duration: 3,
        order: order++,
      });
    }
  }

  // Employee setup (varies by path)
  if (path === 'SOLO') {
    steps.push({
      id: 'first_employee',
      title: 'Votre profil',
      description: 'Ajoutez-vous comme employé',
      required: true,
      duration: 2,
      order: order++,
    });
  } else if (path === 'SMALL_TEAM') {
    steps.push({
      id: 'employees_wizard',
      title: 'Employés',
      description: 'Ajoutez votre équipe (2-10)',
      required: true,
      duration: 5,
      order: order++,
    });
  } else {
    steps.push({
      id: 'bulk_import',
      title: 'Importation',
      description: 'Importez vos employés en masse',
      required: true,
      duration: 7,
      order: order++,
    });
  }

  // Compensation components (if needed)
  if (answers.compensation && answers.compensation !== 'fixed_salary') {
    steps.push({
      id: 'compensation_components',
      title: 'Rémunération',
      description: 'Primes et indemnités',
      required: false,
      duration: 4,
      order: order++,
    });
  }

  // Time tracking (if enabled)
  if (answers.time_tracking && answers.time_tracking !== 'none') {
    steps.push({
      id: 'time_tracking_config',
      title: 'Pointage',
      description: 'Configuration du pointage',
      required: false,
      duration: 3,
      order: order++,
    });
  }

  // Time-off policies (if enabled)
  if (answers.time_off && answers.time_off !== 'none') {
    steps.push({
      id: 'time_off_policies',
      title: 'Congés',
      description: 'Politiques de congés',
      required: false,
      duration: 4,
      order: order++,
    });
  }

  // Approval workflows (Medium/Large only)
  if (path === 'MEDIUM' || path === 'LARGE') {
    steps.push({
      id: 'approval_workflows',
      title: 'Approbations',
      description: 'Configurez les validations',
      required: false,
      duration: 3,
      order: order++,
    });
  }

  // Final steps (all paths)
  steps.push({
    id: 'payroll_preview',
    title: 'Aperçu paie',
    description: 'Vérifiez les calculs',
    required: true,
    duration: 3,
    order: order++,
  });

  steps.push({
    id: 'completion',
    title: 'Terminé',
    description: 'Félicitations !',
    required: true,
    duration: 1,
    order: order++,
  });

  // Sort by order
  steps.sort((a, b) => a.order - b.order);

  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  return {
    path,
    steps,
    totalDuration,
    estimatedMinutes: totalDuration,
  };
}

/**
 * Start onboarding (after questionnaire)
 */
export async function startOnboarding(tenantId: string): Promise<OnboardingState> {
  const state = await getOnboardingState(tenantId);

  if (!state.questionnaire_complete || !state.path) {
    throw new ValidationError('Le questionnaire doit être complété avant de commencer');
  }

  const preview = await getPathPreview(tenantId);

  const newState: OnboardingState = {
    ...state,
    current_step: preview.steps[0].id,
    completed_steps: [],
  };

  await updateOnboardingState(tenantId, newState);

  return newState;
}

/**
 * Complete onboarding step
 */
export async function completeStep(
  tenantId: string,
  stepId: string
): Promise<OnboardingState> {
  const state = await getOnboardingState(tenantId);
  const preview = await getPathPreview(tenantId);

  // Add to completed steps
  if (!state.completed_steps.includes(stepId)) {
    state.completed_steps.push(stepId);
  }

  // Find current step index
  const currentIndex = preview.steps.findIndex(s => s.id === stepId);

  // Set next step or null if complete
  const nextStep = currentIndex < preview.steps.length - 1
    ? preview.steps[currentIndex + 1].id
    : null;

  const newState: OnboardingState = {
    ...state,
    current_step: nextStep,
    completed_steps: state.completed_steps,
  };

  await updateOnboardingState(tenantId, newState);

  return newState;
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(tenantId: string): Promise<OnboardingState> {
  const state = await getOnboardingState(tenantId);

  const newState: OnboardingState = {
    ...state,
    onboarding_complete: true,
    onboarding_completed_at: new Date().toISOString(),
    current_step: null,
  };

  await updateOnboardingState(tenantId, newState);

  return newState;
}

/**
 * Update onboarding state in database
 */
async function updateOnboardingState(
  tenantId: string,
  state: OnboardingState
): Promise<void> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', tenantId);
  }

  const currentSettings = (tenant.settings as any) || {};

  await db
    .update(tenants)
    .set({
      settings: {
        ...currentSettings,
        onboarding: state,
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));
}

/**
 * Reset questionnaire (allow re-answering)
 */
export async function resetQuestionnaire(tenantId: string): Promise<OnboardingState> {
  const newState: OnboardingState = {
    questionnaire_complete: false,
    questionnaire_answers: {},
    current_step: null,
    completed_steps: [],
    path: null,
    onboarding_complete: false,
    onboarding_completed_at: null,
  };

  await updateOnboardingState(tenantId, newState);

  return newState;
}

/**
 * Get onboarding summary (for completion screen)
 */
export async function getOnboardingSummary(tenantId: string) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', tenantId);
  }

  const state = await getOnboardingState(tenantId);

  // Get employee count (simplified - would need to query employees table)
  // const employees = await db.select().from(employees).where(eq(employees.tenantId, tenantId));

  return {
    companyName: tenant.name,
    employeeCount: 0, // TODO: Query actual count
    departmentCount: 0, // TODO: Query actual count
    timeTrackingEnabled: state.questionnaire_answers.time_tracking !== 'none',
    timeOffEnabled: state.questionnaire_answers.time_off !== 'none',
    path: state.path,
    completedAt: state.onboarding_completed_at,
  };
}

/**
 * Step-specific functions
 */

export interface SelectCountryInput {
  tenantId: string;
  countryCode: string;
}

/**
 * Select country for tenant
 */
export async function selectCountry(input: SelectCountryInput) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Update tenant with country
  const [updated] = await db
    .update(tenants)
    .set({
      countryCode: input.countryCode,
      currency: input.countryCode === 'CI' ? 'XOF' : 'XOF', // Default to XOF for West Africa
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId))
    .returning();

  return updated;
}

export interface SetCompanyInfoInput {
  tenantId: string;
  legalName?: string;
  industry?: string;
  taxId?: string;
  addresses?: string[];
  phone?: string;
  email?: string;
}

/**
 * Set company information
 */
export async function setCompanyInfo(input: SetCompanyInfoInput) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  const updates: any = {
    updatedAt: new Date().toISOString(),
  };

  if (input.legalName) updates.name = input.legalName;
  if (input.taxId) updates.taxId = input.taxId;
  if (input.industry) updates.industry = input.industry;

  // Store additional info in settings
  const currentSettings = (tenant.settings as any) || {};
  updates.settings = {
    ...currentSettings,
    company: {
      addresses: input.addresses,
      phone: input.phone,
      email: input.email,
    },
  };

  const [updated] = await db
    .update(tenants)
    .set(updates)
    .where(eq(tenants.id, input.tenantId))
    .returning();

  return updated;
}

export interface CreateFirstEmployeeInput {
  tenantId: string;
  userId: string; // User ID to link employee to
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  positionTitle: string;
  baseSalary: number;
  hireDate: Date;
}

/**
 * Create first employee (usually the business owner)
 * Creates position, employee, assignment, and salary records
 */
export async function createFirstEmployee(input: CreateFirstEmployeeInput) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Validate hireDate
  if (!input.hireDate || isNaN(input.hireDate.getTime())) {
    throw new ValidationError('La date d\'embauche est invalide');
  }

  // Step 1: Create default position
  const [position] = await db
    .insert(positions)
    .values({
      tenantId: input.tenantId,
      title: input.positionTitle,
      employmentType: 'full_time',
      status: 'active',
      headcount: 1,
      currency: tenant.currency || 'XOF',
      weeklyHours: '40',
      minSalary: String(input.baseSalary),
      maxSalary: String(input.baseSalary),
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning();

  // Step 2: Generate employee number
  const employeeNumber = await generateEmployeeNumber(input.tenantId);

  // Step 3: Create employee record
  const [employee] = await db
    .insert(employees)
    .values({
      tenantId: input.tenantId,
      employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      hireDate: input.hireDate.toISOString().split('T')[0],
      countryCode: tenant.countryCode || 'CI',
      coefficient: 100,
      status: 'active',
      taxDependents: 0,
      customFields: {},
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning();

  // Step 4: Create assignment (link employee to position)
  const [assignment] = await db
    .insert(assignments)
    .values({
      tenantId: input.tenantId,
      employeeId: employee.id,
      positionId: position.id,
      assignmentType: 'primary',
      effectiveFrom: input.hireDate.toISOString().split('T')[0],
      effectiveTo: null,
      createdBy: input.userId,
    })
    .returning();

  // Step 5: Create salary record with auto-injected components
  const componentsWithCalculated = await autoInjectCalculatedComponents({
    tenantId: input.tenantId,
    countryCode: tenant.countryCode || 'CI',
    components: [], // No additional components for first employee
    baseSalary: input.baseSalary,
  });

  const [salary] = await db
    .insert(employeeSalaries)
    .values({
      tenantId: input.tenantId,
      employeeId: employee.id,
      baseSalary: String(input.baseSalary),
      components: componentsWithCalculated,
      currency: tenant.currency || 'XOF',
      effectiveFrom: input.hireDate.toISOString().split('T')[0],
      effectiveTo: null,
      changeReason: 'Initial hire',
      createdBy: input.userId,
    })
    .returning();

  // Update onboarding state to store employee ID for later use
  const state = await getOnboardingState(input.tenantId);
  const settings = (tenant.settings as any) || {};

  await db
    .update(tenants)
    .set({
      settings: {
        ...settings,
        onboarding: {
          ...state,
          firstEmployeeId: employee.id,
        },
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId));

  return {
    employee,
    position,
    assignment,
    salary,
  };
}

/**
 * Add employee during onboarding (Small Team path)
 * Similar to createFirstEmployee but for multiple employees
 */
export interface AddEmployeeInput {
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  positionTitle: string;
  baseSalary: number;
  hireDate: Date;
}

export async function addEmployeeToOnboarding(input: AddEmployeeInput) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  // Validate hireDate
  if (!input.hireDate || isNaN(input.hireDate.getTime())) {
    throw new ValidationError('La date d\'embauche est invalide');
  }

  // Create position
  const [position] = await db
    .insert(positions)
    .values({
      tenantId: input.tenantId,
      title: input.positionTitle,
      employmentType: 'full_time',
      status: 'active',
      headcount: 1,
      currency: tenant.currency || 'XOF',
      weeklyHours: '40',
      minSalary: String(input.baseSalary),
      maxSalary: String(input.baseSalary),
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning();

  // Generate employee number
  const employeeNumber = await generateEmployeeNumber(input.tenantId);

  // Create employee
  const [employee] = await db
    .insert(employees)
    .values({
      tenantId: input.tenantId,
      employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      hireDate: input.hireDate.toISOString().split('T')[0],
      countryCode: tenant.countryCode || 'CI',
      coefficient: 100,
      status: 'active',
      taxDependents: 0,
      customFields: {},
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning();

  // Create assignment
  const [assignment] = await db
    .insert(assignments)
    .values({
      tenantId: input.tenantId,
      employeeId: employee.id,
      positionId: position.id,
      assignmentType: 'primary',
      effectiveFrom: input.hireDate.toISOString().split('T')[0],
      effectiveTo: null,
      createdBy: input.userId,
    })
    .returning();

  // Create salary with components
  const componentsWithCalculated = await autoInjectCalculatedComponents({
    tenantId: input.tenantId,
    countryCode: tenant.countryCode || 'CI',
    components: [],
    baseSalary: input.baseSalary,
  });

  const [salary] = await db
    .insert(employeeSalaries)
    .values({
      tenantId: input.tenantId,
      employeeId: employee.id,
      baseSalary: String(input.baseSalary),
      components: componentsWithCalculated,
      currency: tenant.currency || 'XOF',
      effectiveFrom: input.hireDate.toISOString().split('T')[0],
      effectiveTo: null,
      changeReason: 'Initial hire',
      createdBy: input.userId,
    })
    .returning();

  return {
    employee,
    position,
    assignment,
    salary,
  };
}

/**
 * Import employees from CSV (Medium/Large path)
 */
export interface ImportEmployeesInput {
  tenantId: string;
  userId: string;
  csvContent: string;
}

export interface ImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  data: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    positionTitle: string;
    baseSalary: number;
    hireDate: string;
  }>;
}

/**
 * Validate CSV content before import
 */
export function validateEmployeeImport(csvContent: string): ImportValidationResult {
  const lines = csvContent.trim().split('\n');

  if (lines.length < 2) {
    throw new ValidationError('Le fichier CSV doit contenir au moins une ligne de données');
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim());

  // Expected columns
  const requiredColumns = ['Prénom', 'Nom', 'Email', 'Poste', 'Salaire', 'Date embauche'];
  const missingColumns = requiredColumns.filter(col => !header.includes(col));

  if (missingColumns.length > 0) {
    throw new ValidationError(`Colonnes manquantes: ${missingColumns.join(', ')}`);
  }

  const errors: Array<{ row: number; field: string; message: string }> = [];
  const data: ImportValidationResult['data'] = [];
  let validRows = 0;

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    const row = i + 1;

    const firstName = values[header.indexOf('Prénom')];
    const lastName = values[header.indexOf('Nom')];
    const email = values[header.indexOf('Email')];
    const phone = values[header.indexOf('Téléphone')];
    const positionTitle = values[header.indexOf('Poste')];
    const salaryStr = values[header.indexOf('Salaire')];
    const hireDateStr = values[header.indexOf('Date embauche')];

    let hasError = false;

    // Validate firstName
    if (!firstName || firstName.length < 2) {
      errors.push({ row, field: 'Prénom', message: 'Le prénom est requis (min 2 caractères)' });
      hasError = true;
    }

    // Validate lastName
    if (!lastName || lastName.length < 2) {
      errors.push({ row, field: 'Nom', message: 'Le nom est requis (min 2 caractères)' });
      hasError = true;
    }

    // Validate email
    if (!email || !email.includes('@')) {
      errors.push({ row, field: 'Email', message: 'Email invalide' });
      hasError = true;
    }

    // Validate position
    if (!positionTitle || positionTitle.length < 2) {
      errors.push({ row, field: 'Poste', message: 'Le poste est requis' });
      hasError = true;
    }

    // Validate salary
    const baseSalary = parseFloat(salaryStr);
    if (isNaN(baseSalary) || baseSalary < 75000) {
      errors.push({ row, field: 'Salaire', message: 'Salaire invalide (minimum 75,000 FCFA)' });
      hasError = true;
    }

    // Validate hire date
    if (!hireDateStr) {
      errors.push({ row, field: 'Date embauche', message: 'Date d\'embauche requise' });
      hasError = true;
    }

    if (!hasError) {
      data.push({
        firstName,
        lastName,
        email,
        phone,
        positionTitle,
        baseSalary,
        hireDate: hireDateStr,
      });
      validRows++;
    }
  }

  return {
    totalRows: lines.length - 1,
    validRows,
    invalidRows: errors.length,
    errors,
    data,
  };
}

/**
 * Import employees from validated CSV
 */
export async function importEmployeesFromCSV(input: ImportEmployeesInput) {
  const validation = validateEmployeeImport(input.csvContent);

  if (validation.invalidRows > 0) {
    throw new ValidationError(`Le fichier contient ${validation.invalidRows} ligne(s) invalide(s)`);
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  const imported: any[] = [];

  // Import each employee
  for (const empData of validation.data) {
    try {
      // Parse hire date (assume DD/MM/YYYY format)
      const [day, month, year] = empData.hireDate.split('/');
      const hireDate = new Date(`${year}-${month}-${day}`);

      const result = await addEmployeeToOnboarding({
        tenantId: input.tenantId,
        userId: input.userId,
        firstName: empData.firstName,
        lastName: empData.lastName,
        email: empData.email,
        phone: empData.phone,
        positionTitle: empData.positionTitle,
        baseSalary: empData.baseSalary,
        hireDate,
      });

      imported.push(result);
    } catch (error: any) {
      // Log error but continue importing others
      console.error(`Failed to import ${empData.firstName} ${empData.lastName}:`, error);
    }
  }

  return {
    importedCount: imported.length,
    totalRows: validation.totalRows,
    employees: imported,
  };
}

/**
 * Download CSV template for employee import
 */
export function getEmployeeImportTemplate(): { csvContent: string } {
  const csvContent = `Prénom,Nom,Email,Téléphone,Poste,Salaire,Date embauche
Jean,Kouassi,jean.kouassi@example.com,+225 01 23 45 67 89,Vendeur,150000,01/01/2025
Marie,Koffi,marie.koffi@example.com,+225 09 87 65 43 21,Caissier,120000,01/01/2025`;

  return { csvContent };
}

/**
 * Create departments (Medium/Large path)
 */
export interface CreateDepartmentsInput {
  tenantId: string;
  userId: string;
  departments: Array<{
    name: string;
    description?: string;
  }>;
}

export async function createDepartments(input: CreateDepartmentsInput) {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) {
    throw new NotFoundError('Entreprise', input.tenantId);
  }

  if (input.departments.length < 2) {
    throw new ValidationError('Veuillez créer au moins 2 départements');
  }

  // TODO: Create departments when departments table exists
  // For now, store in tenant settings
  const currentSettings = (tenant.settings as any) || {};

  await db
    .update(tenants)
    .set({
      settings: {
        ...currentSettings,
        departments: input.departments.map((dept, idx) => ({
          id: `dept-${idx + 1}`,
          name: dept.name,
          description: dept.description,
        })),
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId));

  return {
    departments: input.departments,
    count: input.departments.length,
  };
}
