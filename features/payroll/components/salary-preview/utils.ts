/**
 * Utility functions for salary preview components
 */

export function formatCurrency(amount: number, countryCode: string = 'CI'): string {
  // West African CFA franc formatting
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

export function getMaritalStatusLabel(status: 'single' | 'married' | 'divorced' | 'widowed'): string {
  const labels = {
    single: 'Célibataire',
    married: 'Marié(e)',
    divorced: 'Divorcé(e)',
    widowed: 'Veuf/Veuve',
  };
  return labels[status];
}

export function getRateTypeLabel(rateType: 'MONTHLY' | 'DAILY' | 'HOURLY'): string {
  const labels = {
    MONTHLY: 'Mensuel',
    DAILY: 'Journalier',
    HOURLY: 'Horaire',
  };
  return labels[rateType];
}

export function getContractTypeLabel(contractType: 'CDI' | 'CDD' | 'STAGE'): string {
  const labels = {
    CDI: 'CDI (Contrat à Durée Indéterminée)',
    CDD: 'CDD (Contrat à Durée Déterminée)',
    STAGE: 'Stage',
  };
  return labels[contractType];
}

/**
 * Calculate fiscal parts based on marital status and dependent children
 *
 * Rules (Côte d'Ivoire):
 * - Single, no children: 1.0
 * - Single with children: 1.5 + (0.5 × children, max 4)
 * - Married: 2.0 + (0.5 × children, max 4)
 */
export function calculateFiscalParts(
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed',
  dependentChildren: number
): number {
  // Married, divorced, or widowed start at 2.0
  const base = maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed' ? 2.0 : 1.0;

  // Add 0.5 for first child if single
  const firstChildBonus = maritalStatus === 'single' && dependentChildren > 0 ? 0.5 : 0;

  // Add 0.5 per child (max 4 children counted)
  const childrenBonus = Math.min(dependentChildren, 4) * 0.5;

  return base + firstChildBonus + childrenBonus;
}

/**
 * Get fiscal parts calculation formula for display
 */
export function getFiscalPartsFormula(
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed',
  dependentChildren: number
): { formula: string; explanation: string } {
  const base = maritalStatus === 'married' || maritalStatus === 'divorced' || maritalStatus === 'widowed' ? 2.0 : 1.0;
  const firstChildBonus = maritalStatus === 'single' && dependentChildren > 0 ? 0.5 : 0;
  const childrenCounted = Math.min(dependentChildren, 4);
  const childrenBonus = childrenCounted * 0.5;

  let formula = `${base}`;
  let explanation = '';

  if (maritalStatus === 'single') {
    explanation = 'Base (célibataire): 1.0';
    if (dependentChildren > 0) {
      formula += ` + 0.5 (1er enfant)`;
      if (dependentChildren > 1) {
        formula += ` + ${childrenCounted - 1} × 0.5`;
      }
      explanation += `\n+ 0.5 pour le 1er enfant`;
      if (dependentChildren > 1) {
        explanation += `\n+ ${childrenCounted - 1} × 0.5 pour les autres enfants`;
      }
    }
  } else {
    explanation = `Base (${getMaritalStatusLabel(maritalStatus).toLowerCase()}): 2.0`;
    if (dependentChildren > 0) {
      formula += ` + ${childrenCounted} × 0.5`;
      explanation += `\n+ ${childrenCounted} × 0.5 pour les enfants`;
    }
  }

  if (dependentChildren > 4) {
    explanation += `\n(Maximum 4 enfants comptés)`;
  }

  return { formula, explanation };
}

/**
 * Format percentage
 * Shows up to 2 decimal places, removing trailing zeros
 */
export function formatPercentage(value: number): string {
  const percentage = value * 100;
  // Use up to 2 decimal places, but remove trailing zeros
  return `${percentage.toFixed(2).replace(/\.?0+$/, '')}%`;
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}
