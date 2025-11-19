/**
 * STC Taxation Service
 *
 * Implements fiscal and social treatment of termination indemnities according to:
 * - Convention Collective Interprofessionnelle
 * - Code Général des Impôts de Côte d'Ivoire
 *
 * Key Rules:
 * - Salaire de présence: FULLY TAXABLE
 * - Indemnité compensatrice de congés: FULLY TAXABLE
 * - Gratification: FULLY TAXABLE
 * - Indemnité compensatrice de préavis: FULLY TAXABLE
 * - Indemnités (licenciement, retraite, fin CDD, décès):
 *   → If > 75,000 FCFA: 50% taxable, 50% non-taxable
 *   → If ≤ 75,000 FCFA: 100% non-taxable
 * - Frais funéraires: NEVER TAXABLE
 */

/**
 * Breakdown of taxable vs non-taxable portions for a single amount
 */
export interface TaxationBreakdown {
  totalAmount: number;
  taxableAmount: number;
  nonTaxableAmount: number;
  taxationRule: 'fully_taxable' | 'fully_exempt' | 'half_taxable_if_above_threshold';
  thresholdApplied: boolean; // Whether the 75,000 F threshold was applied
}

/**
 * Complete taxation analysis for all STC components
 */
export interface STCTaxationResult {
  // Individual component breakdowns
  salary: TaxationBreakdown;
  vacationPayout: TaxationBreakdown;
  gratification: TaxationBreakdown;
  noticePayment: TaxationBreakdown;
  severancePay: TaxationBreakdown;
  cddEndIndemnity: TaxationBreakdown;
  funeralExpenses: TaxationBreakdown;

  // Aggregated totals
  totalGrossAmount: number;          // Total STC amount
  totalTaxableAmount: number;        // Total subject to ITS/CNPS
  totalNonTaxableAmount: number;     // Total exempt from ITS/CNPS

  // Tax computation (ITS)
  estimatedITS: number;              // Estimated income tax (simplified)
  estimatedCNPSEmployee: number;     // Estimated employee CNPS contribution

  // Net to pay
  estimatedNetPayable: number;       // After tax/CNPS deductions
}

/**
 * Input for STC taxation calculation
 */
export interface STCTaxationInput {
  // Core STC components
  salary: number;                    // Salaire de présence (last month prorata)
  vacationPayout: number;            // Indemnité compensatrice de congés payés
  gratification: number;             // Gratification au prorata temporis
  noticePayment: number;             // Indemnité compensatrice de préavis (can be negative if deducted)
  severancePay: number;              // Indemnité de licenciement/retraite/décès
  cddEndIndemnity: number;           // Indemnité de fin de CDD (3%)
  funeralExpenses: number;           // Frais funéraires (non-taxable)

  // Context for tax calculation (optional, for estimates)
  employeeCNPSRate?: number;         // Default 6.3%
  tenantCountryCode?: string;        // For country-specific rules (future)
}

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Threshold for indemnity taxation (CFA Francs)
 * Above this amount, indemnities are taxable de moitié (50%)
 * Below or equal, indemnities are fully exempt
 */
const INDEMNITY_TAX_THRESHOLD = 75000;

/**
 * Default CNPS employee contribution rate
 */
const DEFAULT_CNPS_EMPLOYEE_RATE = 0.063; // 6.3%

// =====================================================
// TAXATION BREAKDOWN FUNCTIONS
// =====================================================

/**
 * Calculate taxation for fully taxable components
 * (salary, vacation payout, gratification, notice payment)
 */
function calculateFullyTaxable(amount: number): TaxationBreakdown {
  return {
    totalAmount: amount,
    taxableAmount: amount,
    nonTaxableAmount: 0,
    taxationRule: 'fully_taxable',
    thresholdApplied: false,
  };
}

/**
 * Calculate taxation for fully exempt components
 * (funeral expenses)
 */
function calculateFullyExempt(amount: number): TaxationBreakdown {
  return {
    totalAmount: amount,
    taxableAmount: 0,
    nonTaxableAmount: amount,
    taxationRule: 'fully_exempt',
    thresholdApplied: false,
  };
}

/**
 * Calculate taxation for indemnities with 75,000 F threshold
 * (severance pay, retirement indemnity, CDD end indemnity, death indemnity)
 *
 * Rule:
 * - If amount > 75,000 F → 50% taxable, 50% non-taxable
 * - If amount ≤ 75,000 F → 100% non-taxable
 */
function calculateIndemnityTaxation(amount: number): TaxationBreakdown {
  if (amount <= INDEMNITY_TAX_THRESHOLD) {
    // Fully exempt (small indemnity)
    return {
      totalAmount: amount,
      taxableAmount: 0,
      nonTaxableAmount: amount,
      taxationRule: 'half_taxable_if_above_threshold',
      thresholdApplied: false,
    };
  } else {
    // Half taxable (large indemnity)
    const taxableAmount = amount / 2;
    const nonTaxableAmount = amount / 2;

    return {
      totalAmount: amount,
      taxableAmount,
      nonTaxableAmount,
      taxationRule: 'half_taxable_if_above_threshold',
      thresholdApplied: true,
    };
  }
}

// =====================================================
// MAIN TAXATION CALCULATION
// =====================================================

/**
 * Calculate complete taxation breakdown for an STC
 *
 * @param input - STC components and context
 * @returns Complete taxation analysis with taxable/non-taxable breakdown
 */
export function calculateSTCTaxation(input: STCTaxationInput): STCTaxationResult {
  // 1. Calculate taxation for each component
  const salaryBreakdown = calculateFullyTaxable(input.salary);
  const vacationBreakdown = calculateFullyTaxable(input.vacationPayout);
  const gratificationBreakdown = calculateFullyTaxable(input.gratification);
  const noticeBreakdown = calculateFullyTaxable(input.noticePayment);
  const severanceBreakdown = calculateIndemnityTaxation(input.severancePay);
  const cddEndBreakdown = calculateIndemnityTaxation(input.cddEndIndemnity);
  const funeralBreakdown = calculateFullyExempt(input.funeralExpenses);

  // 2. Calculate totals
  const totalGrossAmount =
    input.salary +
    input.vacationPayout +
    input.gratification +
    input.noticePayment +
    input.severancePay +
    input.cddEndIndemnity +
    input.funeralExpenses;

  const totalTaxableAmount =
    salaryBreakdown.taxableAmount +
    vacationBreakdown.taxableAmount +
    gratificationBreakdown.taxableAmount +
    noticeBreakdown.taxableAmount +
    severanceBreakdown.taxableAmount +
    cddEndBreakdown.taxableAmount +
    funeralBreakdown.taxableAmount;

  const totalNonTaxableAmount = totalGrossAmount - totalTaxableAmount;

  // 3. Estimate tax and social charges (simplified)
  // Note: This is a simplified calculation for preview purposes
  // Actual tax calculation would use the full ITS progressive scale
  const cnpsEmployeeRate = input.employeeCNPSRate ?? DEFAULT_CNPS_EMPLOYEE_RATE;

  // CNPS employee contribution (6.3% of taxable salary components only)
  // Note: Indemnities are NOT subject to CNPS even if taxable
  const cnpsBase =
    salaryBreakdown.taxableAmount +
    vacationBreakdown.taxableAmount +
    gratificationBreakdown.taxableAmount +
    noticeBreakdown.taxableAmount;

  const estimatedCNPSEmployee = Math.round(cnpsBase * cnpsEmployeeRate);

  // ITS estimation (simplified progressive scale)
  // For STC, we use a simplified approach since it's a one-time payment
  // Actual calculation would require employee's cumulative income for the year
  const estimatedITS = estimateITS(totalTaxableAmount);

  // 4. Calculate net payable
  const estimatedNetPayable = totalGrossAmount - estimatedCNPSEmployee - estimatedITS;

  return {
    // Individual breakdowns
    salary: salaryBreakdown,
    vacationPayout: vacationBreakdown,
    gratification: gratificationBreakdown,
    noticePayment: noticeBreakdown,
    severancePay: severanceBreakdown,
    cddEndIndemnity: cddEndBreakdown,
    funeralExpenses: funeralBreakdown,

    // Totals
    totalGrossAmount: Math.round(totalGrossAmount),
    totalTaxableAmount: Math.round(totalTaxableAmount),
    totalNonTaxableAmount: Math.round(totalNonTaxableAmount),

    // Tax computation
    estimatedITS,
    estimatedCNPSEmployee,

    // Net
    estimatedNetPayable: Math.round(estimatedNetPayable),
  };
}

// =====================================================
// TAX ESTIMATION (SIMPLIFIED ITS CALCULATION)
// =====================================================

/**
 * Estimate ITS (Impôt sur les Traitements et Salaires) for STC
 *
 * This is a SIMPLIFIED estimation for preview purposes.
 * Actual ITS calculation requires:
 * - Employee's cumulative annual income
 * - Family deductions
 * - Other income sources
 *
 * For STC, we use a conservative flat rate based on amount tiers
 *
 * @param taxableAmount - Total taxable amount from STC
 * @returns Estimated ITS amount
 */
function estimateITS(taxableAmount: number): number {
  // Very conservative simplified brackets (Côte d'Ivoire)
  // Actual ITS uses progressive scale with family deductions

  if (taxableAmount <= 50000) {
    return 0; // Likely no tax for small amounts
  } else if (taxableAmount <= 130000) {
    return Math.round(taxableAmount * 0.015); // ~1.5% effective rate
  } else if (taxableAmount <= 300000) {
    return Math.round(taxableAmount * 0.05); // ~5% effective rate
  } else if (taxableAmount <= 600000) {
    return Math.round(taxableAmount * 0.10); // ~10% effective rate
  } else if (taxableAmount <= 1500000) {
    return Math.round(taxableAmount * 0.15); // ~15% effective rate
  } else {
    return Math.round(taxableAmount * 0.20); // ~20% effective rate
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format taxation breakdown as human-readable summary
 *
 * @param breakdown - Taxation breakdown
 * @param componentName - Name of the component (for display)
 * @returns Human-readable summary
 */
export function formatTaxationBreakdown(
  breakdown: TaxationBreakdown,
  componentName: string
): string {
  if (breakdown.taxationRule === 'fully_taxable') {
    return `${componentName}: ${breakdown.totalAmount.toLocaleString()} F (100% imposable)`;
  } else if (breakdown.taxationRule === 'fully_exempt') {
    return `${componentName}: ${breakdown.totalAmount.toLocaleString()} F (non imposable)`;
  } else {
    // half_taxable_if_above_threshold
    if (breakdown.thresholdApplied) {
      return `${componentName}: ${breakdown.totalAmount.toLocaleString()} F (50% imposable: ${breakdown.taxableAmount.toLocaleString()} F)`;
    } else {
      return `${componentName}: ${breakdown.totalAmount.toLocaleString()} F (non imposable car ≤ 75 000 F)`;
    }
  }
}

/**
 * Get taxation rule description in French
 *
 * @param rule - Taxation rule
 * @returns French description
 */
export function getTaxationRuleDescription(
  rule: TaxationBreakdown['taxationRule']
): string {
  switch (rule) {
    case 'fully_taxable':
      return 'Entièrement imposable (100%)';
    case 'fully_exempt':
      return 'Non imposable (exonéré)';
    case 'half_taxable_if_above_threshold':
      return 'Imposable de moitié si > 75 000 F, sinon exonéré';
    default:
      return 'Règle inconnue';
  }
}

/**
 * Validate taxation input
 *
 * @param input - Input to validate
 * @throws Error if validation fails
 */
export function validateTaxationInput(input: STCTaxationInput): void {
  // Check for negative amounts (except notice payment which can be negative)
  if (input.salary < 0) {
    throw new Error('Le salaire de présence ne peut pas être négatif');
  }
  if (input.vacationPayout < 0) {
    throw new Error("L'indemnité de congés payés ne peut pas être négative");
  }
  if (input.gratification < 0) {
    throw new Error('La gratification ne peut pas être négative');
  }
  if (input.severancePay < 0) {
    throw new Error("L'indemnité de licenciement ne peut pas être négative");
  }
  if (input.cddEndIndemnity < 0) {
    throw new Error("L'indemnité de fin de CDD ne peut pas être négative");
  }
  if (input.funeralExpenses < 0) {
    throw new Error('Les frais funéraires ne peuvent pas être négatifs');
  }

  // CNPS rate validation
  if (input.employeeCNPSRate !== undefined) {
    if (input.employeeCNPSRate < 0 || input.employeeCNPSRate > 1) {
      throw new Error('Le taux CNPS employé doit être entre 0 et 1 (0% à 100%)');
    }
  }
}
