/**
 * Data Type Registry for AI Import System
 *
 * Provides schema context to AI for semantic understanding of Excel data.
 * NO hardcoded field mappings - AI determines mappings based on this context.
 *
 * @see docs/AI-IMPORT-SYSTEM-DESIGN.md
 */

export type DataTypeCategory =
  | 'employee'
  | 'payroll'
  | 'benefits'
  | 'time_attendance'
  | 'organizational'
  | 'documents'
  | 'accounting';

export type ImportPriority = 'critical' | 'high' | 'medium' | 'low';

export interface DataTypeDefinition {
  /** Unique identifier for this data type */
  id: string;

  /** Human-readable name (French) */
  name: string;

  /** Category */
  category: DataTypeCategory;

  /** Target database table */
  table: string;

  /** Import priority (affects order) */
  priority: ImportPriority;

  /** Description for AI context */
  description: string;

  /** Required fields */
  requiredFields: string[];

  /** Optional fields */
  optionalFields: string[];

  /** Foreign key relationships */
  foreignKeys?: Record<string, string>;

  /** Special import mode */
  importMode?: 'preserve_amounts' | 'calculate' | 'standard';

  /** Common French column names (for AI hint, not strict matching) */
  commonColumnNames?: string[];
}

/**
 * Complete registry of all importable HR data types
 *
 * Total: 32 distinct types across 7 categories
 */
export const DATA_TYPE_REGISTRY: Record<string, DataTypeDefinition> = {
  // ============================================================================
  // 1. EMPLOYEE-RELATED DATA (5 types)
  // ============================================================================

  employee_master: {
    id: 'employee_master',
    name: 'Données employés',
    category: 'employee',
    table: 'employees',
    priority: 'critical',
    description: 'Employee master data with personal and employment information',
    requiredFields: [
      'tenantId',
      'employeeNumber',
      'firstName',
      'lastName',
      'email',
      'hireDate',
      'status',
      'employeeType',
    ],
    optionalFields: [
      'cnpsNumber',
      'contractType',
      'baseSalary',
      'gender',
      'dateOfBirth',
      'placeOfBirth',
      'nationality',
      'maritalStatus',
      'numberOfChildren',
      'address',
      'phone',
      'personalEmail',
      'emergencyContact',
      'emergencyPhone',
      'bankName',
      'bankAccountNumber',
      'bankAccountName',
      'paymentMethod',
      'departmentId',
      'positionId',
      'locationId',
      'managerId',
      'sector',
      'classification',
      'echelon',
      'familyDeductionsCode',
      'taxExemptPercentage',
      'customFields',
    ],
    commonColumnNames: [
      'Matricule',
      'Nom',
      'Prénom',
      'Email',
      'Date embauche',
      'N° CNPS',
      'Salaire de base',
      'Sexe',
      'Date de naissance',
    ],
  },

  employment_contract: {
    id: 'employment_contract',
    name: 'Contrats de travail',
    category: 'employee',
    table: 'employment_contracts',
    priority: 'high',
    description: 'Employment contracts (CDI, CDD, CDDTI, etc.)',
    requiredFields: ['tenantId', 'employeeId', 'contractType', 'startDate'],
    optionalFields: [
      'endDate',
      'contractNumber',
      'cddReason',
      'position',
      'salary',
      'workingHours',
      'trialPeriodEndDate',
    ],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: [
      'Type de contrat',
      'Date début',
      'Date fin',
      'N° contrat',
      'Motif CDD',
    ],
  },

  employee_dependent: {
    id: 'employee_dependent',
    name: 'Personnes à charge',
    category: 'employee',
    table: 'employee_dependents',
    priority: 'medium',
    description: 'Employee dependents (spouse, children)',
    requiredFields: ['tenantId', 'employeeId', 'relationship', 'firstName', 'lastName'],
    optionalFields: ['dateOfBirth', 'gender', 'nationalIdNumber', 'isStudent'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Lien familial', 'Nom personne', 'Prénom personne', 'Date naissance'],
  },

  employee_salary: {
    id: 'employee_salary',
    name: 'Historique salaires',
    category: 'employee',
    table: 'employee_salaries',
    priority: 'critical',
    description: 'Salary history with components',
    requiredFields: ['tenantId', 'employeeId', 'effectiveDate', 'baseSalary'],
    optionalFields: [
      'housingAllowance',
      'transportAllowance',
      'functionAllowance',
      'otherAllowances',
      'totalGrossSalary',
      'reason',
    ],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: [
      'Salaire de base',
      'Prime logement',
      'Prime transport',
      'Date effet',
    ],
  },

  employee_termination: {
    id: 'employee_termination',
    name: 'Départs employés',
    category: 'employee',
    table: 'employee_terminations',
    priority: 'low',
    description: 'Employee terminations',
    requiredFields: ['tenantId', 'employeeId', 'effectiveDate', 'reason'],
    optionalFields: ['compensationAmount', 'notes', 'exitInterviewDate'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Date départ', 'Motif départ', 'Indemnité'],
  },

  // ============================================================================
  // 2. PAYROLL-RELATED DATA (6 types)
  // ============================================================================

  payroll_history: {
    id: 'payroll_history',
    name: 'Historique paie',
    category: 'payroll',
    table: 'historical_payroll_data',
    priority: 'critical',
    description: 'Historical payroll records imported as-is from legacy systems',
    importMode: 'preserve_amounts',
    requiredFields: ['tenantId', 'employeeNumber', 'payrollPeriod'],
    optionalFields: [
      'grossSalary',
      'netSalary',
      'baseSalary',
      'allowances',
      'bonuses',
      'cnpsEmployee',
      'cnpsEmployer',
      'its',
      'otherDeductions',
      'employerContributions',
    ],
    commonColumnNames: [
      'Période',
      'Salaire brut',
      'Salaire net',
      'CNPS salarié',
      'ITS',
      'Retenues',
    ],
  },

  payroll_run: {
    id: 'payroll_run',
    name: 'Périodes de paie',
    category: 'payroll',
    table: 'payroll_runs',
    priority: 'high',
    description: 'Payroll runs (monthly cycles)',
    requiredFields: ['tenantId', 'month', 'year', 'status'],
    optionalFields: [
      'startDate',
      'endDate',
      'paymentDate',
      'totalGross',
      'totalNet',
      'totalEmployeeCNPS',
      'totalEmployerCNPS',
      'totalITS',
    ],
    commonColumnNames: ['Mois', 'Année', 'Date paiement', 'Total brut', 'Total net'],
  },

  payroll_line_item: {
    id: 'payroll_line_item',
    name: 'Lignes de paie',
    category: 'payroll',
    table: 'payroll_line_items',
    priority: 'high',
    description: 'Individual payroll line items per employee per month',
    requiredFields: ['tenantId', 'payrollRunId', 'employeeId'],
    optionalFields: [
      'grossSalary',
      'netSalary',
      'baseSalary',
      'allowances',
      'deductions',
      'cnpsEmployee',
      'cnpsEmployer',
      'its',
    ],
    foreignKeys: {
      payrollRunId: 'payroll_runs.id',
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Brut', 'Net', 'Base', 'Primes', 'Retenues'],
  },

  cnps_declaration: {
    id: 'cnps_declaration',
    name: 'Déclarations CNPS',
    category: 'payroll',
    table: 'cnps_declaration_edits',
    priority: 'medium',
    description: 'CNPS monthly declaration edits',
    requiredFields: ['tenantId', 'employeeId', 'month', 'year', 'baseSalary'],
    optionalFields: [
      'allowances',
      'familyAllowances',
      'cnpsContribution',
      'pensionableWages',
    ],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Mois', 'Salaire plafonné', 'Cotisation CNPS', 'Allocations'],
  },

  bonus: {
    id: 'bonus',
    name: 'Primes',
    category: 'payroll',
    table: 'bonuses',
    priority: 'medium',
    description: 'Employee bonuses',
    requiredFields: ['tenantId', 'employeeId', 'bonusType', 'amount', 'effectiveMonth'],
    optionalFields: ['effectiveYear', 'description', 'isTaxable'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Type prime', 'Montant', 'Mois', 'Année', 'Imposable'],
  },

  variable_pay: {
    id: 'variable_pay',
    name: 'Éléments variables',
    category: 'payroll',
    table: 'variable_pay_inputs',
    priority: 'low',
    description: 'Variable pay components (commissions, overtime)',
    requiredFields: ['tenantId', 'employeeId', 'inputType', 'amount', 'month', 'year'],
    optionalFields: ['description', 'rate', 'units'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Type', 'Montant', 'Mois', 'Année', 'Taux', 'Unités'],
  },

  // ============================================================================
  // 3. BENEFITS & INSURANCE (3 types)
  // ============================================================================

  benefit_plan: {
    id: 'benefit_plan',
    name: 'Régimes avantages',
    category: 'benefits',
    table: 'benefit_plans',
    priority: 'medium',
    description: 'Benefit plans (CMU, health insurance, etc.)',
    requiredFields: ['tenantId', 'name', 'benefitType'],
    optionalFields: [
      'provider',
      'employeeCost',
      'employerCost',
      'coverageDetails',
      'isActive',
    ],
    commonColumnNames: ['Nom régime', 'Type', 'Fournisseur', 'Coût salarié', 'Coût employeur'],
  },

  benefit_enrollment: {
    id: 'benefit_enrollment',
    name: 'Adhésions avantages',
    category: 'benefits',
    table: 'employee_benefit_enrollments',
    priority: 'high',
    description: 'Employee benefit enrollments',
    requiredFields: ['tenantId', 'employeeId', 'benefitPlanId', 'enrollmentDate', 'status'],
    optionalFields: ['endDate', 'employeeCost', 'employerCost', 'dependentIds'],
    foreignKeys: {
      employeeId: 'employees.id',
      benefitPlanId: 'benefit_plans.id',
    },
    commonColumnNames: ['Régime', 'Date début', 'Date fin', 'Statut', 'Personnes couvertes'],
  },

  benefit_enrollment_history: {
    id: 'benefit_enrollment_history',
    name: 'Historique adhésions',
    category: 'benefits',
    table: 'employee_benefit_enrollment_history',
    priority: 'low',
    description: 'Benefit enrollment history',
    requiredFields: ['tenantId', 'enrollmentId', 'changeDate', 'changeType'],
    optionalFields: ['previousValue', 'newValue', 'reason'],
    foreignKeys: {
      enrollmentId: 'employee_benefit_enrollments.id',
    },
    commonColumnNames: ['Date changement', 'Type changement', 'Raison'],
  },

  // ============================================================================
  // 4. TIME & ATTENDANCE (7 types)
  // ============================================================================

  time_off_balance: {
    id: 'time_off_balance',
    name: 'Soldes congés',
    category: 'time_attendance',
    table: 'time_off_balances',
    priority: 'high',
    description: 'Employee time-off balances (CP, CP acquis)',
    requiredFields: ['tenantId', 'employeeId', 'balanceType', 'days'],
    optionalFields: ['asOfDate', 'expirationDate', 'notes'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Type congé', 'Solde jours', 'Date calcul', 'Date expiration'],
  },

  time_off_request: {
    id: 'time_off_request',
    name: 'Demandes congés',
    category: 'time_attendance',
    table: 'time_off_requests',
    priority: 'medium',
    description: 'Time-off requests',
    requiredFields: ['tenantId', 'employeeId', 'requestType', 'startDate', 'endDate', 'status'],
    optionalFields: ['totalDays', 'reason', 'approvedBy', 'approvedAt'],
    foreignKeys: {
      employeeId: 'employees.id',
      approvedBy: 'users.id',
    },
    commonColumnNames: [
      'Type',
      'Date début',
      'Date fin',
      'Nb jours',
      'Statut',
      'Approbateur',
    ],
  },

  acp_payment: {
    id: 'acp_payment',
    name: 'Paiements ACP',
    category: 'time_attendance',
    table: 'acp_payment_history',
    priority: 'medium',
    description: 'Acquired leave payments (ACP)',
    requiredFields: ['tenantId', 'employeeId', 'paymentDate', 'totalAmount', 'daysConverted'],
    optionalFields: ['month', 'year', 'rate', 'notes'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Date paiement', 'Montant', 'Jours convertis', 'Taux'],
  },

  time_entry: {
    id: 'time_entry',
    name: 'Pointages',
    category: 'time_attendance',
    table: 'time_entries',
    priority: 'medium',
    description: 'Time tracking entries (regular, overtime)',
    requiredFields: ['tenantId', 'employeeId', 'date', 'hoursWorked'],
    optionalFields: [
      'checkIn',
      'checkOut',
      'overtimeHours',
      'nightHours',
      'holidayHours',
      'status',
    ],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: [
      'Date',
      'Heures travaillées',
      'Heures supplémentaires',
      'Entrée',
      'Sortie',
    ],
  },

  work_schedule: {
    id: 'work_schedule',
    name: 'Horaires travail',
    category: 'time_attendance',
    table: 'work_schedules',
    priority: 'medium',
    description: 'Work schedules',
    requiredFields: ['tenantId', 'name', 'hoursPerWeek'],
    optionalFields: ['hoursPerDay', 'daysPerWeek', 'isDefault', 'description'],
    commonColumnNames: ['Nom', 'Heures/semaine', 'Heures/jour', 'Jours/semaine'],
  },

  planned_shift: {
    id: 'planned_shift',
    name: 'Plannings',
    category: 'time_attendance',
    table: 'planned_shifts',
    priority: 'low',
    description: 'Shift planning',
    requiredFields: ['tenantId', 'employeeId', 'date', 'startTime', 'endTime'],
    optionalFields: ['breakMinutes', 'shiftType', 'notes'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Date', 'Heure début', 'Heure fin', 'Type', 'Pause'],
  },

  overtime_record: {
    id: 'overtime_record',
    name: 'Heures supplémentaires',
    category: 'time_attendance',
    table: 'time_entries',
    priority: 'medium',
    description: 'Overtime records (stored in time_entries)',
    requiredFields: ['tenantId', 'employeeId', 'date', 'overtimeHours'],
    optionalFields: ['overtimeRate', 'approvedBy', 'notes'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Date', 'Heures sup', 'Taux', 'Approbateur'],
  },

  // ============================================================================
  // 5. ORGANIZATIONAL DATA (4 types)
  // ============================================================================

  department: {
    id: 'department',
    name: 'Départements',
    category: 'organizational',
    table: 'departments',
    priority: 'low',
    description: 'Organizational departments',
    requiredFields: ['tenantId', 'name', 'code'],
    optionalFields: ['description', 'managerId', 'parentDepartmentId'],
    commonColumnNames: ['Code', 'Nom département', 'Manager', 'Parent'],
  },

  position: {
    id: 'position',
    name: 'Postes',
    category: 'organizational',
    table: 'positions',
    priority: 'low',
    description: 'Job positions',
    requiredFields: ['tenantId', 'title', 'code'],
    optionalFields: ['description', 'departmentId', 'level', 'category'],
    foreignKeys: {
      departmentId: 'departments.id',
    },
    commonColumnNames: ['Code poste', 'Titre', 'Département', 'Niveau'],
  },

  assignment: {
    id: 'assignment',
    name: 'Affectations',
    category: 'organizational',
    table: 'assignments',
    priority: 'low',
    description: 'Employee assignments',
    requiredFields: ['tenantId', 'employeeId', 'departmentId', 'positionId', 'startDate'],
    optionalFields: ['endDate', 'isPrimary', 'allocationPercentage'],
    foreignKeys: {
      employeeId: 'employees.id',
      departmentId: 'departments.id',
      positionId: 'positions.id',
    },
    commonColumnNames: ['Département', 'Poste', 'Date début', 'Date fin', 'Allocation %'],
  },

  location: {
    id: 'location',
    name: 'Sites',
    category: 'organizational',
    table: 'locations',
    priority: 'low',
    description: 'Physical locations/sites',
    requiredFields: ['tenantId', 'name', 'code'],
    optionalFields: ['address', 'city', 'country', 'isHeadquarters'],
    commonColumnNames: ['Code site', 'Nom', 'Adresse', 'Ville', 'Pays'],
  },

  // ============================================================================
  // 6. DOCUMENTS & COMPLIANCE (2 types)
  // ============================================================================

  uploaded_document: {
    id: 'uploaded_document',
    name: 'Documents',
    category: 'documents',
    table: 'uploaded_documents',
    priority: 'low',
    description: 'Employee documents (contracts, IDs, etc.)',
    requiredFields: ['tenantId', 'employeeId', 'documentType', 'fileName', 'fileUrl'],
    optionalFields: ['uploadDate', 'expirationDate', 'notes'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Type document', 'Nom fichier', 'Date upload', 'Expiration'],
  },

  employee_register_entry: {
    id: 'employee_register_entry',
    name: 'Registre du personnel',
    category: 'documents',
    table: 'employee_register_entries',
    priority: 'low',
    description: 'Employee registry (legal requirement)',
    requiredFields: ['tenantId', 'employeeId', 'entryDate', 'entryType'],
    optionalFields: ['exitDate', 'notes'],
    foreignKeys: {
      employeeId: 'employees.id',
    },
    commonColumnNames: ['Date entrée', 'Date sortie', 'Type'],
  },

  // ============================================================================
  // 7. ACCOUNTING DATA (2 types)
  // ============================================================================

  gl_journal_entry: {
    id: 'gl_journal_entry',
    name: 'Écritures comptables',
    category: 'accounting',
    table: 'gl_journal_entries',
    priority: 'low',
    description: 'General ledger journal entries from payroll',
    requiredFields: ['tenantId', 'entryDate', 'accountCode', 'debit', 'credit'],
    optionalFields: ['description', 'reference', 'payrollRunId'],
    foreignKeys: {
      payrollRunId: 'payroll_runs.id',
    },
    commonColumnNames: ['Date', 'Compte', 'Libellé', 'Débit', 'Crédit', 'Référence'],
  },

  account_mapping: {
    id: 'account_mapping',
    name: 'Plan comptable paie',
    category: 'accounting',
    table: 'payroll_account_mappings',
    priority: 'low',
    description: 'Payroll account mappings for GL integration',
    requiredFields: ['tenantId', 'elementType', 'debitAccount', 'creditAccount'],
    optionalFields: ['description', 'isActive'],
    commonColumnNames: ['Type élément', 'Compte débit', 'Compte crédit', 'Libellé'],
  },
};

/**
 * Get data type definitions by category
 */
export function getDataTypesByCategory(category: DataTypeCategory): DataTypeDefinition[] {
  return Object.values(DATA_TYPE_REGISTRY).filter((dt) => dt.category === category);
}

/**
 * Get data type definitions by priority
 */
export function getDataTypesByPriority(priority: ImportPriority): DataTypeDefinition[] {
  return Object.values(DATA_TYPE_REGISTRY).filter((dt) => dt.priority === priority);
}

/**
 * Get data type definition by ID
 */
export function getDataType(id: string): DataTypeDefinition | undefined {
  return DATA_TYPE_REGISTRY[id];
}

/**
 * Get all data types sorted by import priority
 */
export function getDataTypesSortedByPriority(): DataTypeDefinition[] {
  const priorityOrder: Record<ImportPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return Object.values(DATA_TYPE_REGISTRY).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

/**
 * Get schema context for AI (simplified version for prompts)
 */
export function getSchemaContext(): Record<string, {
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  foreignKeys?: Record<string, string>;
}> {
  const context: Record<string, any> = {};

  Object.values(DATA_TYPE_REGISTRY).forEach((dt) => {
    context[dt.table] = {
      description: dt.description,
      requiredFields: dt.requiredFields,
      optionalFields: dt.optionalFields,
      foreignKeys: dt.foreignKeys,
    };
  });

  return context;
}
