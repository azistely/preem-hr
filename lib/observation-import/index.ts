/**
 * Observation Import Module
 *
 * Provides Excel/CSV import and template generation for factory KPI observations
 *
 * Usage:
 * - parseObservationFile: Parse uploaded Excel/CSV file
 * - generateBasicTemplate: Generate standard template
 * - generateExtendedTemplate: Generate template with all KPI fields
 * - generatePrefilledTemplate: Generate template pre-filled with employee list
 */

export {
  parseObservationFile,
  detectObservationDuplicates,
  validateEmployeeNumbers,
  type ParsedObservationRow,
  type ParseError,
  type ObservationParseResult,
} from './parser';

export {
  generateObservationTemplate,
  generateBasicTemplate,
  generateExtendedTemplate,
  generatePrefilledTemplate,
  getTemplateFilename,
  getPrefilledTemplateFilename,
  type TemplateConfig,
} from './template';

export {
  OBSERVATION_FIELD_MAPPING,
  REQUIRED_OBSERVATION_FIELDS,
  findObservationField,
  validateObservationField,
  transformObservationField,
  isRequiredObservationField,
  parseObservationDate,
} from './field-mappings';
