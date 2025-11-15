/**
 * AI Import - Entity Definitions
 *
 * This file defines all importable entities for the AI import system.
 * Each definition includes:
 * - Database table and fields
 * - Human recognition patterns (how to identify in Excel)
 * - Employee linking strategy
 * - Field mappings and variations
 *
 * The AI uses these definitions to:
 * 1. Identify entity types from Excel sheets
 * 2. Extract correct fields
 * 3. Link entities to employees
 * 4. Generate properly structured JSON output
 */

export const IMPORTABLE_ENTITIES = {
  /**
   * 1. EMPLOYEES
   * Core entity - all other entities must link to an employee
   */
  employees: {
    table: 'employees',
    description: 'Employee master data - personal info, contact details, employment info',

    recognition: {
      sheetNames: ['Personnel', 'Employés', 'Staff', 'Liste des employés', 'Employees'],
      required: ['firstName + lastName OR fullName'],
      pattern: 'ONE ROW = ONE PERSON (no repetition across months)',
      typical: ['Nom', 'Prénom', 'Matricule', 'Email', 'Téléphone', 'Poste', 'Date embauche'],
    },

    employeeLink: null, // This IS the employee entity

    fields: {
      // Required
      firstName: {
        type: 'string',
        required: true,
        variations: ['firstName', 'first_name', 'prenom', 'prénom', 'First Name'],
      },
      lastName: {
        type: 'string',
        required: true,
        variations: ['lastName', 'last_name', 'nom', 'Last Name', 'family_name'],
      },

      // Optional but common
      employeeNumber: {
        type: 'string',
        variations: ['employeeNumber', 'employee_number', 'matricule', 'Employee #', 'N° Employé', 'ID'],
      },
      email: {
        type: 'string',
        variations: ['email', 'courriel', 'Email', 'e-mail'],
      },
      phoneNumber: {
        type: 'string',
        variations: ['phoneNumber', 'phone', 'telephone', 'téléphone', 'tel', 'mobile'],
      },
      cnpsNumber: {
        type: 'string',
        variations: ['cnpsNumber', 'cnps', 'CNPS', 'N° CNPS', 'Numero CNPS'],
        countrySpecific: {
          CI: '10 digits',
          SN: 'IPRES - 13 digits',
        },
      },
      hireDate: {
        type: 'date',
        variations: ['hireDate', 'hire_date', 'date_embauche', 'dateEmbauche', 'Date d\'embauche', 'Start Date'],
      },
      position: {
        type: 'string',
        variations: ['position', 'poste', 'job_title', 'title', 'fonction'],
      },
      department: {
        type: 'string',
        variations: ['department', 'departement', 'département', 'service', 'direction'],
      },
    },
  },

  /**
   * 2. EMPLOYEE SALARIES (Payslips/Bulletins de paie)
   * Historical salary/payslip records
   */
  employee_salaries: {
    table: 'employee_salaries',
    description: 'Monthly payslip records - salary, deductions, net pay',

    recognition: {
      sheetNames: ['Paie', 'Bulletins', 'Salaires', 'Payroll', 'Paie Janvier', 'Paie_01_2024'],
      required: ['period/month AND (grossSalary OR netSalary)'],
      pattern: 'ONE ROW = ONE MONTHLY PAYSLIP (same employee repeats across months)',
      typical: ['Matricule', 'Nom', 'Période', 'Mois', 'Salaire brut', 'Salaire net', 'CNPS', 'ITS'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'cnpsNumber', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      // Required
      period: {
        type: 'string', // YYYY-MM format
        required: true,
        variations: ['period', 'periode', 'période', 'mois', 'month', 'date_paie', 'payPeriod'],
        formats: ['YYYY-MM', 'MM/YYYY', 'Janvier 2024', 'Jan 2024', '01/2024'],
      },
      grossSalary: {
        type: 'number',
        required: true,
        variations: ['grossSalary', 'gross_salary', 'salaire_brut', 'salairebrut', 'Salaire brut', 'Brut', 'Gross'],
      },
      netSalary: {
        type: 'number',
        required: true,
        variations: ['netSalary', 'net_salary', 'salaire_net', 'salairenet', 'Salaire net', 'Net', 'Net Pay'],
      },

      // Optional
      cnpsEmployee: {
        type: 'number',
        variations: ['cnpsEmployee', 'cnps_employe', 'CNPS Employé', 'Employee CNPS'],
      },
      cnpsEmployer: {
        type: 'number',
        variations: ['cnpsEmployer', 'cnps_employeur', 'CNPS Employeur', 'Employer CNPS'],
      },
      tax: {
        type: 'number',
        variations: ['tax', 'impot', 'impôt', 'ITS', 'IRPP', 'Impôt'],
      },
    },
  },

  /**
   * 3. EMPLOYEE CONTRACTS
   * Employment contracts (CDI/CDD/Stage)
   */
  employee_contracts: {
    table: 'employee_contracts',
    description: 'Employment contracts - type, dates, position, salary',

    recognition: {
      sheetNames: ['Contrats', 'Contracts', 'CDI', 'CDD', 'Employee Contracts'],
      required: ['contractType (CDI/CDD/Stage) AND startDate'],
      pattern: 'ONE ROW = ONE CONTRACT (employee may have multiple if renewed)',
      typical: ['Matricule', 'Nom', 'Type contrat', 'Date début', 'Date fin', 'Poste', 'Salaire'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      // Required
      contractType: {
        type: 'string',
        required: true,
        variations: ['contractType', 'type_contrat', 'typeContrat', 'Type', 'Contract Type'],
        values: ['CDI', 'CDD', 'Stage', 'Essai', 'Apprentissage'],
      },
      startDate: {
        type: 'date',
        required: true,
        variations: ['startDate', 'start_date', 'date_debut', 'dateDebut', 'Date début', 'Start Date'],
      },

      // Optional
      endDate: {
        type: 'date',
        variations: ['endDate', 'end_date', 'date_fin', 'dateFin', 'Date fin', 'End Date'],
        note: 'Required for CDD, optional for CDI',
      },
      position: {
        type: 'string',
        variations: ['position', 'poste', 'job_title', 'title'],
      },
      baseSalary: {
        type: 'number',
        variations: ['baseSalary', 'base_salary', 'salaire', 'salary', 'Salaire de base'],
      },
    },
  },

  /**
   * 4. TIME ENTRIES (Pointage/Attendance)
   * Daily or weekly time tracking
   */
  time_entries: {
    table: 'time_entries',
    description: 'Time tracking - daily attendance, hours worked',

    recognition: {
      sheetNames: ['Pointage', 'Heures', 'Attendance', 'Timesheet', 'Time Tracking'],
      required: ['date (specific date, not month) AND hours'],
      pattern: 'ONE ROW = ONE DAY/WEEK (MANY rows per employee per month)',
      typical: ['Matricule', 'Nom', 'Date', 'Heures', 'Type', 'Normal', 'Heures sup'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      // Required
      date: {
        type: 'date',
        required: true,
        variations: ['date', 'jour', 'day', 'work_date'],
        note: 'Specific date like 2024-01-15, NOT period/month',
      },
      hoursWorked: {
        type: 'number',
        required: true,
        variations: ['hoursWorked', 'hours', 'heures', 'hours_worked', 'Heures travaillées'],
      },

      // Optional
      overtimeHours: {
        type: 'number',
        variations: ['overtimeHours', 'heures_sup', 'heuresSup', 'Heures supplémentaires', 'Overtime'],
      },
      type: {
        type: 'string',
        variations: ['type', 'Type', 'work_type'],
        values: ['Normal', 'Overtime', 'Weekend', 'Holiday'],
      },
    },
  },

  /**
   * 5. LEAVES (Congés)
   * Leave requests and absences
   */
  leaves: {
    table: 'leaves',
    description: 'Leave tracking - annual leave, sick leave, etc.',

    recognition: {
      sheetNames: ['Congés', 'Absences', 'Leaves', 'Time Off', 'Vacances'],
      required: ['leaveType AND startDate AND (endDate OR days)'],
      pattern: 'ONE ROW = ONE LEAVE REQUEST (date range)',
      typical: ['Matricule', 'Nom', 'Type congé', 'Date début', 'Date fin', 'Nombre jours', 'Statut'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      // Required
      leaveType: {
        type: 'string',
        required: true,
        variations: ['leaveType', 'type_conge', 'typeConge', 'Type', 'Leave Type'],
        values: ['Annuel', 'Maladie', 'Maternité', 'Paternité', 'Sans solde', 'Formation'],
      },
      startDate: {
        type: 'date',
        required: true,
        variations: ['startDate', 'start_date', 'date_debut', 'Date début', 'Start Date'],
      },
      endDate: {
        type: 'date',
        variations: ['endDate', 'end_date', 'date_fin', 'Date fin', 'End Date'],
      },
      days: {
        type: 'number',
        variations: ['days', 'jours', 'nombre_jours', 'nombreJours', 'Nombre de jours', 'Duration'],
      },

      // Optional
      status: {
        type: 'string',
        variations: ['status', 'statut', 'Status', 'État'],
        values: ['Pending', 'Approved', 'Rejected', 'En attente', 'Approuvé', 'Rejeté'],
      },
    },
  },

  /**
   * 6. EMPLOYEE BENEFITS (Avantages)
   * Employee benefits and allowances
   */
  employee_benefits: {
    table: 'employee_benefits',
    description: 'Employee benefits - housing, transport, phone allowances',

    recognition: {
      sheetNames: ['Avantages', 'Benefits', 'Primes', 'Allowances', 'Indemnités'],
      required: ['benefitType AND amount'],
      pattern: 'ONE ROW = ONE BENEFIT per employee',
      typical: ['Matricule', 'Nom', 'Type avantage', 'Montant', 'Logement', 'Transport'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      // Required
      benefitType: {
        type: 'string',
        required: true,
        variations: ['benefitType', 'type_avantage', 'typeAvantage', 'Type', 'Benefit Type'],
        values: ['Logement', 'Transport', 'Téléphone', 'Voiture', 'Prime', 'Housing', 'Car'],
      },
      amount: {
        type: 'number',
        required: true,
        variations: ['amount', 'montant', 'Montant', 'Amount', 'Value'],
      },

      // Optional
      frequency: {
        type: 'string',
        variations: ['frequency', 'frequence', 'Fréquence', 'Period'],
        values: ['monthly', 'yearly', 'one-time', 'mensuel', 'annuel'],
      },
    },
  },

  /**
   * 7. PAYROLL RUNS
   * Monthly payroll execution records
   */
  payroll_runs: {
    table: 'payroll_runs',
    description: 'Payroll run records - historical payroll executions',

    recognition: {
      sheetNames: ['Historique Paie', 'Payroll History', 'Payroll Runs'],
      required: ['period AND status'],
      pattern: 'ONE ROW = ONE MONTHLY PAYROLL RUN',
      typical: ['Période', 'Date exécution', 'Nombre employés', 'Montant total', 'Statut'],
    },

    employeeLink: null, // No employee link - this is a run-level entity

    fields: {
      period: {
        type: 'string', // YYYY-MM
        required: true,
        variations: ['period', 'periode', 'période', 'mois', 'month'],
      },
      status: {
        type: 'string',
        required: true,
        variations: ['status', 'statut', 'Status'],
        values: ['completed', 'draft', 'approved', 'paid'],
      },
      totalAmount: {
        type: 'number',
        variations: ['totalAmount', 'total_amount', 'montant_total', 'Montant total'],
      },
    },
  },

  /**
   * 8. PAYROLL LINE ITEMS
   * Individual payroll line items per employee per run
   */
  payroll_line_items: {
    table: 'payroll_line_items',
    description: 'Detailed payroll breakdown - earnings, deductions per employee',

    recognition: {
      sheetNames: ['Détails Paie', 'Payroll Details', 'Line Items'],
      required: ['period AND componentType AND amount'],
      pattern: 'MULTIPLE ROWS per employee (one per component: salary, CNPS, tax, etc.)',
      typical: ['Matricule', 'Nom', 'Période', 'Type', 'Description', 'Montant'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      period: {
        type: 'string',
        required: true,
        variations: ['period', 'periode', 'période'],
      },
      componentType: {
        type: 'string',
        required: true,
        variations: ['componentType', 'type', 'Type', 'category'],
        values: ['earnings', 'deduction', 'tax', 'contribution'],
      },
      description: {
        type: 'string',
        required: true,
        variations: ['description', 'desc', 'label', 'Libellé'],
      },
      amount: {
        type: 'number',
        required: true,
        variations: ['amount', 'montant', 'value'],
      },
    },
  },

  /**
   * 9. POSITIONS
   * Job positions/titles in the organization
   */
  positions: {
    table: 'positions',
    description: 'Job positions - titles, levels, departments',

    recognition: {
      sheetNames: ['Postes', 'Positions', 'Job Titles'],
      required: ['title'],
      pattern: 'ONE ROW = ONE POSITION',
      typical: ['Titre', 'Code', 'Département', 'Niveau', 'Salaire min', 'Salaire max'],
    },

    employeeLink: null, // Reference data, not employee-specific

    fields: {
      title: {
        type: 'string',
        required: true,
        variations: ['title', 'titre', 'name', 'position', 'poste'],
      },
      code: {
        type: 'string',
        variations: ['code', 'Code', 'ID'],
      },
      department: {
        type: 'string',
        variations: ['department', 'departement', 'département', 'service'],
      },
    },
  },

  /**
   * 10. EMPLOYEE DEPENDENTS
   * Employee family members for tax/benefits calculations
   */
  employee_dependents: {
    table: 'employee_dependents',
    description: 'Employee dependents - spouse, children for deductions',

    recognition: {
      sheetNames: ['Ayants droit', 'Dependents', 'Famille', 'Family'],
      required: ['relationship'],
      pattern: 'ONE ROW = ONE DEPENDENT',
      typical: ['Matricule employé', 'Nom', 'Prénom', 'Relation', 'Date naissance'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      firstName: {
        type: 'string',
        required: true,
        variations: ['firstName', 'prenom', 'prénom', 'First Name'],
      },
      lastName: {
        type: 'string',
        required: true,
        variations: ['lastName', 'nom', 'Last Name'],
      },
      relationship: {
        type: 'string',
        required: true,
        variations: ['relationship', 'relation', 'lien', 'Type'],
        values: ['spouse', 'child', 'conjoint', 'enfant', 'épouse', 'mari'],
      },
      birthDate: {
        type: 'date',
        variations: ['birthDate', 'birth_date', 'date_naissance', 'dateNaissance', 'Date de naissance'],
      },
    },
  },

  /**
   * 11. DEPARTMENTS
   * Organizational departments
   */
  departments: {
    table: 'departments',
    description: 'Organization departments/services',

    recognition: {
      sheetNames: ['Départements', 'Departments', 'Services', 'Directions'],
      required: ['name'],
      pattern: 'ONE ROW = ONE DEPARTMENT',
      typical: ['Nom', 'Code', 'Responsable', 'Budget'],
    },

    employeeLink: null, // Reference data

    fields: {
      name: {
        type: 'string',
        required: true,
        variations: ['name', 'nom', 'department', 'departement'],
      },
      code: {
        type: 'string',
        variations: ['code', 'Code', 'ID'],
      },
    },
  },

  /**
   * 12. EMPLOYEE DOCUMENTS
   * Employee document metadata (not file content)
   */
  employee_documents: {
    table: 'employee_documents',
    description: 'Employee documents metadata - contracts, IDs, certificates',

    recognition: {
      sheetNames: ['Documents', 'Pièces', 'Employee Documents'],
      required: ['documentType'],
      pattern: 'ONE ROW = ONE DOCUMENT',
      typical: ['Matricule', 'Nom', 'Type document', 'Date', 'Référence', 'Statut'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      documentType: {
        type: 'string',
        required: true,
        variations: ['documentType', 'type', 'Type document', 'Category'],
        values: ['ID', 'Passport', 'Contract', 'Diploma', 'CNI', 'Passeport', 'Diplôme'],
      },
      reference: {
        type: 'string',
        variations: ['reference', 'ref', 'number', 'Référence', 'Numéro'],
      },
      issueDate: {
        type: 'date',
        variations: ['issueDate', 'date', 'Date émission', 'Issue Date'],
      },
    },
  },

  /**
   * 13. EMPLOYEE TERMINATIONS
   * Employee exit records
   */
  employee_terminations: {
    table: 'employee_terminations',
    description: 'Employee termination/exit records',

    recognition: {
      sheetNames: ['Sorties', 'Terminations', 'Exits', 'Départs'],
      required: ['terminationDate AND reason'],
      pattern: 'ONE ROW = ONE TERMINATION',
      typical: ['Matricule', 'Nom', 'Date sortie', 'Motif', 'Type', 'Notice'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      terminationDate: {
        type: 'date',
        required: true,
        variations: ['terminationDate', 'exit_date', 'date_sortie', 'dateSortie', 'Date de sortie', 'Last Day'],
      },
      reason: {
        type: 'string',
        required: true,
        variations: ['reason', 'motif', 'Motif', 'Reason'],
        values: ['Resignation', 'Termination', 'Retirement', 'Démission', 'Licenciement', 'Retraite'],
      },
      type: {
        type: 'string',
        variations: ['type', 'Type'],
        values: ['voluntary', 'involuntary', 'volontaire', 'involontaire'],
      },
    },
  },

  /**
   * 14. TENANT SALARY COMPONENTS
   * Custom salary components defined per tenant
   */
  tenant_salary_components: {
    table: 'tenant_salary_components',
    description: 'Custom salary components - bonuses, allowances, deductions',

    recognition: {
      sheetNames: ['Composantes', 'Salary Components', 'Rubriques paie'],
      required: ['name AND componentType'],
      pattern: 'ONE ROW = ONE COMPONENT DEFINITION',
      typical: ['Code', 'Libellé', 'Type', 'Formule', 'Montant fixe'],
    },

    employeeLink: null, // Configuration data

    fields: {
      name: {
        type: 'string',
        required: true,
        variations: ['name', 'nom', 'libelle', 'libellé', 'Label'],
      },
      code: {
        type: 'string',
        required: true,
        variations: ['code', 'Code', 'reference'],
      },
      componentType: {
        type: 'string',
        required: true,
        variations: ['componentType', 'type', 'Type', 'Category'],
        values: ['earning', 'deduction', 'benefit', 'tax'],
      },
      amount: {
        type: 'number',
        variations: ['amount', 'montant', 'Montant', 'fixedAmount'],
      },
    },
  },

  /**
   * 15. OVERTIME ENTRIES
   * Overtime hours tracking (separate from regular time entries)
   */
  overtime_entries: {
    table: 'overtime_entries',
    description: 'Overtime hours tracking - supplementary hours worked',

    recognition: {
      sheetNames: ['Heures supplémentaires', 'Overtime', 'Heures sup'],
      required: ['date AND overtimeHours'],
      pattern: 'ONE ROW = ONE OVERTIME RECORD',
      typical: ['Matricule', 'Nom', 'Date', 'Heures sup', 'Taux', 'Type'],
    },

    employeeLink: {
      priority: ['employeeNumber', 'email', 'fullName'],
      description: 'Link via employee identifier - REQUIRED',
    },

    fields: {
      date: {
        type: 'date',
        required: true,
        variations: ['date', 'jour', 'work_date'],
      },
      overtimeHours: {
        type: 'number',
        required: true,
        variations: ['overtimeHours', 'heures_sup', 'heuresSup', 'Heures supplémentaires', 'Hours'],
      },
      rate: {
        type: 'number',
        variations: ['rate', 'taux', 'Taux', 'multiplier'],
        note: '1.5 for weekday overtime, 2.0 for Sunday/holiday',
      },
    },
  },

  /**
   * 16. TENANT (Company Information)
   * Company-level configuration and settings
   */
  tenant: {
    table: 'tenants',
    description: 'Company/organization information and configuration',

    recognition: {
      sheetNames: ['Entreprise', 'Company', 'Organization', 'Société', 'Info Société'],
      required: ['name'],
      pattern: 'ONE ROW = COMPANY INFO (typically single row with company details)',
      typical: ['Nom', 'Pays', 'Secteur', 'NIF', 'RCCM', 'Industrie'],
    },

    employeeLink: null, // Company-level data

    fields: {
      name: {
        type: 'string',
        required: true,
        variations: ['name', 'nom', 'companyName', 'company_name', 'Nom société', 'Raison sociale'],
      },
      countryCode: {
        type: 'string',
        required: true,
        variations: ['countryCode', 'country_code', 'country', 'pays', 'Pays', 'Code pays'],
        values: ['CI', 'SN', 'BF', 'ML', 'TG', 'BJ', 'NE'],
        note: 'ISO 3166-1 alpha-2 code (e.g., CI for Côte d\'Ivoire)',
      },
      currency: {
        type: 'string',
        variations: ['currency', 'devise', 'monnaie', 'Currency'],
        values: ['XOF', 'XAF', 'USD', 'EUR'],
        note: 'ISO 4217 currency code',
      },
      timezone: {
        type: 'string',
        variations: ['timezone', 'time_zone', 'fuseau', 'Time Zone'],
        note: 'IANA timezone (e.g., Africa/Abidjan)',
      },
      taxId: {
        type: 'string',
        variations: ['taxId', 'tax_id', 'NIF', 'nif', 'Numéro NIF', 'Tax ID'],
      },
      businessRegistration: {
        type: 'string',
        variations: ['businessRegistration', 'business_registration', 'RCCM', 'rccm', 'Numéro RCCM', 'Registration'],
      },
      industry: {
        type: 'string',
        variations: ['industry', 'industrie', 'secteur_activite', 'Secteur d\'activité', 'Industry'],
      },
      sectorCode: {
        type: 'string',
        required: true,
        variations: ['sectorCode', 'sector_code', 'code_secteur', 'Code secteur', 'Sector'],
        note: 'Required for payroll calculations - determines AT/MP rates',
      },
      cgeciSectorCode: {
        type: 'string',
        variations: ['cgeciSectorCode', 'cgeci_sector_code', 'code_cgeci', 'CGECI', 'Secteur CGECI'],
        note: 'CGECI sector classification (Côte d\'Ivoire only)',
      },
      workAccidentRate: {
        type: 'number',
        variations: ['workAccidentRate', 'work_accident_rate', 'taux_at', 'Taux AT/MP', 'AT Rate'],
        note: 'Work accident insurance rate (e.g., 0.02 for 2%)',
      },
      defaultDailyTransportRate: {
        type: 'number',
        variations: ['defaultDailyTransportRate', 'default_daily_transport_rate', 'transport_journalier', 'Transport par jour'],
        note: 'Default daily transport allowance amount',
      },
    },
  },
} as const;

export type ImportableEntityType = keyof typeof IMPORTABLE_ENTITIES;
