/**
 * Custom Error Classes
 *
 * Domain-specific errors with structured information for better error handling.
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation errors (user input issues)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/**
 * Business rule violations
 */
export class BusinessRuleError extends AppError {
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message, code, details);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} non trouvé: ${identifier}`
      : `${resource} non trouvé`;
    super(message, 'NOT_FOUND', { resource, identifier });
  }
}

/**
 * Authorization/permission errors
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Accès refusé') {
    super(message, 'FORBIDDEN');
  }
}

/**
 * Conflict errors (duplicate records, etc.)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', details);
  }
}
