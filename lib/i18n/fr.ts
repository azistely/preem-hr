/**
 * French Translations for Payroll System
 *
 * All text in French for Côte d'Ivoire users.
 */

export const fr = {
  payroll: {
    calculator: {
      title: 'Calculateur de Paie',
      subtitle: 'Calculez le salaire net d\'un employé',

      // Form labels
      baseSalary: 'Salaire de base',
      baseSalaryPlaceholder: 'Ex: 300 000',
      baseSalaryHelper: 'Minimum SMIG: 75 000 FCFA',

      housingAllowance: 'Indemnité de logement',
      housingAllowancePlaceholder: 'Ex: 50 000',

      transportAllowance: 'Indemnité de transport',
      transportAllowancePlaceholder: 'Ex: 25 000',

      mealAllowance: 'Indemnité de repas',
      mealAllowancePlaceholder: 'Ex: 15 000',

      hasFamily: 'Employé avec famille',
      hasFamilyHelper: 'Augmente la cotisation CMU employeur',

      sector: 'Secteur d\'activité',
      sectorServices: 'Services',
      sectorConstruction: 'BTP',
      sectorAgriculture: 'Agriculture',
      sectorOther: 'Autre',

      // Buttons
      calculate: 'Calculer',
      calculating: 'Calcul en cours...',
      reset: 'Réinitialiser',

      // Results
      results: 'Résultats',
      grossSalary: 'Salaire brut',
      netSalary: 'Salaire net',
      deductions: 'Déductions',
      employerCost: 'Coût employeur',

      // Deductions breakdown
      cnpsEmployee: 'CNPS Salarié (6,3%)',
      cmuEmployee: 'CMU Salarié',
      its: 'ITS (Impôt)',
      totalDeductions: 'Total déductions',

      // Employer costs
      cnpsEmployer: 'CNPS Employeur (7,7%)',
      cmuEmployer: 'CMU Employeur',
      totalEmployerCost: 'Coût total employeur',

      // Details
      showDetails: 'Voir les détails',
      hideDetails: 'Masquer les détails',

      // Errors
      errorMinimumSalary: 'Le salaire doit être au moins 75 000 FCFA (SMIG)',
      errorCalculation: 'Erreur lors du calcul',
      errorRequired: 'Ce champ est obligatoire',
    },

    // Common
    fcfa: 'FCFA',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
  },
} as const;
