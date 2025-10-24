/**
 * Shift Length Validation Service (GAP-SEC-003)
 *
 * Enforces legal shift length limits for specific sectors.
 * Security and healthcare sectors are limited to 12-hour shifts by law.
 *
 * Legal Reference: Code du travail - Security/Healthcare regulations
 */

export interface ShiftValidationResult {
  isValid: boolean;
  shiftLength: number; // in hours
  maxAllowed: number; // in hours
  sectorCode: string;
  errorMessage: string | null;
}

/**
 * Sectors with shift length restrictions
 */
const RESTRICTED_SECTORS = {
  SECURITY: {
    code: 'SECURITY',
    maxShiftHours: 12,
    labelFr: 'Sécurité',
  },
  HEALTHCARE: {
    code: 'HEALTHCARE',
    maxShiftHours: 12,
    labelFr: 'Santé',
  },
  // Add more restricted sectors here as needed
} as const;

/**
 * Check if a sector has shift length restrictions
 *
 * @param sectorCode - Sector code (e.g., 'SECURITY', 'SERVICES')
 * @returns true if sector has restrictions
 */
export function isSectorRestricted(sectorCode: string): boolean {
  const normalizedCode = sectorCode.toUpperCase();
  return Object.values(RESTRICTED_SECTORS).some(
    (sector) => sector.code === normalizedCode
  );
}

/**
 * Get maximum allowed shift hours for a sector
 *
 * @param sectorCode - Sector code
 * @returns Max hours or null if no restriction
 */
export function getMaxShiftHours(sectorCode: string): number | null {
  const normalizedCode = sectorCode.toUpperCase();
  const sector = Object.values(RESTRICTED_SECTORS).find(
    (s) => s.code === normalizedCode
  );
  return sector ? sector.maxShiftHours : null;
}

/**
 * Calculate shift length in hours
 *
 * @param clockIn - Shift start time
 * @param clockOut - Shift end time
 * @returns Shift length in hours (decimal)
 */
export function calculateShiftLength(
  clockIn: Date,
  clockOut: Date
): number {
  const diffMs = clockOut.getTime() - clockIn.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100; // Round to 2 decimals
}

/**
 * Validate shift length against sector restrictions
 *
 * @param clockIn - Shift start time
 * @param clockOut - Shift end time
 * @param sectorCode - Employee's sector code
 * @returns Validation result with error message if invalid
 *
 * @example
 * ```typescript
 * const result = validateShiftLength(
 *   new Date('2025-01-15T08:00:00'),
 *   new Date('2025-01-15T21:00:00'),
 *   'SECURITY'
 * );
 *
 * if (!result.isValid) {
 *   throw new Error(result.errorMessage);
 * }
 * ```
 */
export function validateShiftLength(
  clockIn: Date,
  clockOut: Date,
  sectorCode: string
): ShiftValidationResult {
  // Calculate shift length
  const shiftLength = calculateShiftLength(clockIn, clockOut);

  // Check if sector has restrictions
  const maxAllowed = getMaxShiftHours(sectorCode);

  if (maxAllowed === null) {
    // No restrictions for this sector
    return {
      isValid: true,
      shiftLength,
      maxAllowed: Infinity,
      sectorCode,
      errorMessage: null,
    };
  }

  // Check if shift exceeds maximum
  const isValid = shiftLength <= maxAllowed;

  // Get sector label for error message
  const normalizedCode = sectorCode.toUpperCase();
  const sector = Object.values(RESTRICTED_SECTORS).find(
    (s) => s.code === normalizedCode
  );
  const sectorLabel = sector?.labelFr || sectorCode;

  return {
    isValid,
    shiftLength,
    maxAllowed,
    sectorCode,
    errorMessage: isValid
      ? null
      : `Les quarts de travail dans le secteur de la ${sectorLabel} sont limités à ${maxAllowed} heures. Durée actuelle: ${shiftLength.toFixed(1)} heures.`,
  };
}

/**
 * Get shift length helper text for UI
 *
 * Returns warning message if sector has restrictions.
 *
 * @param sectorCode - Employee's sector code
 * @returns Helper text in French or null if no restrictions
 *
 * @example
 * ```typescript
 * const helper = getShiftLengthHelper('SECURITY');
 * // "Maximum: 12 heures (Secteur Sécurité)"
 * ```
 */
export function getShiftLengthHelper(sectorCode: string): string | null {
  const maxAllowed = getMaxShiftHours(sectorCode);

  if (maxAllowed === null) {
    return null;
  }

  const normalizedCode = sectorCode.toUpperCase();
  const sector = Object.values(RESTRICTED_SECTORS).find(
    (s) => s.code === normalizedCode
  );
  const sectorLabel = sector?.labelFr || sectorCode;

  return `Maximum: ${maxAllowed} heures (Secteur ${sectorLabel})`;
}
