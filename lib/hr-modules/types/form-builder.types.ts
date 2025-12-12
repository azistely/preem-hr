/**
 * Form Builder Type Definitions
 * Types for dynamic form rendering and validation
 */

import type {
  FormFieldType,
  FormFieldDefinition,
  FormSectionDefinition,
  FormDefinition,
  FormScoringConfig,
  ComputedScores,
  RatingScaleConfig,
} from '@/lib/db/schema/hr-forms';

// Re-export schema types
export type {
  FormFieldType,
  FormFieldDefinition,
  FormSectionDefinition,
  FormDefinition,
  FormScoringConfig,
  ComputedScores,
  RatingScaleConfig,
};

// ============================================================================
// FORM RENDERING TYPES
// ============================================================================

/**
 * Form field render state
 */
export interface FormFieldState {
  id: string;
  value: unknown;
  error?: string;
  touched: boolean;
  dirty: boolean;
  visible: boolean;
  disabled: boolean;
  required: boolean;
}

/**
 * Form render context
 */
export interface FormRenderContext {
  mode: 'view' | 'edit' | 'preview';
  isReadOnly: boolean;
  showValidation: boolean;
  enableAutoSave: boolean;
  currentSection?: string;
}

/**
 * Form field change event
 */
export interface FormFieldChange {
  fieldId: string;
  value: unknown;
  previousValue: unknown;
  timestamp: Date;
}

/**
 * Form validation result
 */
export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

// ============================================================================
// RATING COMPONENT TYPES
// ============================================================================

/**
 * Rating display configuration
 */
export interface RatingDisplayConfig {
  showLabels: boolean;
  showValue: boolean;
  size: 'sm' | 'md' | 'lg';
  variant: 'numeric' | 'stars' | 'emoji' | 'colored';
}

/**
 * Pre-defined rating scale presets
 */
export const RatingScalePresets = {
  simple5: {
    type: 'numeric' as const,
    scale: 5 as const,
    labels: {
      1: 'Insuffisant',
      2: 'A améliorer',
      3: 'Satisfaisant',
      4: 'Très bien',
      5: 'Excellent',
    },
  },
  corporate5: {
    type: 'numeric' as const,
    scale: 5 as const,
    labels: {
      1: 'Nécessite amélioration significative',
      2: 'Nécessite amélioration',
      3: 'Répond aux attentes',
      4: 'Dépasse les attentes',
      5: 'Performance exceptionnelle',
    },
  },
  stars5: {
    type: 'stars' as const,
    scale: 5 as const,
  },
  emoji3: {
    type: 'emoji' as const,
    scale: 3 as const,
    labels: {
      1: '😞 Insatisfait',
      2: '😐 Neutre',
      3: '😊 Satisfait',
    },
  },
  nps10: {
    type: 'numeric' as const,
    scale: 10 as const,
    lowLabel: 'Pas du tout probable',
    highLabel: 'Très probable',
  },
};

// ============================================================================
// FORM BUILDER UI TYPES
// ============================================================================

/**
 * Field palette category
 */
export interface FieldPaletteCategory {
  id: string;
  name: string;
  icon: string;
  fields: FieldPaletteItem[];
}

/**
 * Field palette item (draggable)
 */
export interface FieldPaletteItem {
  type: FormFieldType;
  name: string;
  description: string;
  icon: string;
  defaultConfig: Partial<FormFieldDefinition>;
}

/**
 * Default field palette configuration
 */
export const DefaultFieldPalette: FieldPaletteCategory[] = [
  {
    id: 'basic',
    name: 'Champs de base',
    icon: 'Type',
    fields: [
      {
        type: 'text',
        name: 'Texte court',
        description: 'Champ texte simple',
        icon: 'Type',
        defaultConfig: { placeholder: 'Entrez du texte...' },
      },
      {
        type: 'textarea',
        name: 'Texte long',
        description: 'Champ texte multi-lignes',
        icon: 'AlignLeft',
        defaultConfig: { placeholder: 'Entrez votre réponse...' },
      },
      {
        type: 'number',
        name: 'Nombre',
        description: 'Champ numérique',
        icon: 'Hash',
        defaultConfig: { min: 0 },
      },
      {
        type: 'date',
        name: 'Date',
        description: 'Sélecteur de date',
        icon: 'Calendar',
        defaultConfig: {},
      },
    ],
  },
  {
    id: 'choice',
    name: 'Choix & Sélection',
    icon: 'List',
    fields: [
      {
        type: 'select',
        name: 'Liste déroulante',
        description: 'Sélection unique',
        icon: 'ChevronDown',
        defaultConfig: {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
      },
      {
        type: 'multiselect',
        name: 'Sélection multiple',
        description: 'Plusieurs choix possibles',
        icon: 'CheckSquare',
        defaultConfig: {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' },
          ],
        },
      },
      {
        type: 'radio',
        name: 'Boutons radio',
        description: 'Choix exclusif visible',
        icon: 'Circle',
        defaultConfig: {
          options: [
            { value: 'yes', label: 'Oui' },
            { value: 'no', label: 'Non' },
          ],
        },
      },
      {
        type: 'checkbox',
        name: 'Case à cocher',
        description: 'Oui/Non simple',
        icon: 'CheckSquare',
        defaultConfig: {},
      },
    ],
  },
  {
    id: 'evaluation',
    name: 'Évaluation',
    icon: 'Star',
    fields: [
      {
        type: 'rating',
        name: 'Notation',
        description: 'Échelle de 1 à 5',
        icon: 'Star',
        defaultConfig: {
          ratingConfig: RatingScalePresets.simple5,
        },
      },
      {
        type: 'slider',
        name: 'Curseur',
        description: 'Valeur sur un axe',
        icon: 'Sliders',
        defaultConfig: {
          sliderConfig: {
            min: 0,
            max: 100,
            step: 5,
            showValue: true,
            unit: '%',
          },
        },
      },
    ],
  },
  {
    id: 'advanced',
    name: 'Avancé',
    icon: 'Settings',
    fields: [
      {
        type: 'employee',
        name: 'Employé',
        description: 'Sélecteur d\'employé',
        icon: 'User',
        defaultConfig: {},
      },
      {
        type: 'multiemployee',
        name: 'Employés multiples',
        description: 'Sélection de plusieurs employés',
        icon: 'Users',
        defaultConfig: {},
      },
      {
        type: 'file',
        name: 'Fichier',
        description: 'Upload de document',
        icon: 'Paperclip',
        defaultConfig: {},
      },
      {
        type: 'computed',
        name: 'Calculé',
        description: 'Valeur auto-calculée',
        icon: 'Calculator',
        defaultConfig: {
          computedConfig: {
            formula: 'average',
            sourceFields: [],
          },
        },
      },
    ],
  },
  {
    id: 'layout',
    name: 'Mise en page',
    icon: 'Layout',
    fields: [
      {
        type: 'heading',
        name: 'Titre',
        description: 'En-tête de section',
        icon: 'Heading',
        defaultConfig: {},
      },
      {
        type: 'paragraph',
        name: 'Paragraphe',
        description: 'Texte explicatif',
        icon: 'FileText',
        defaultConfig: {},
      },
    ],
  },
];

// ============================================================================
// FORM SUBMISSION TYPES
// ============================================================================

/**
 * Form submission input
 */
export interface FormSubmissionInput {
  templateId: string;
  sourceType: string;
  sourceId: string;
  respondentEmployeeId?: string;
  subjectEmployeeId?: string;
  respondentRole?: string;
  data: Record<string, unknown>;
}

/**
 * Form auto-save data
 */
export interface FormAutoSaveData {
  submissionId: string;
  data: Record<string, unknown>;
  savedAt: Date;
}

/**
 * Scoring calculation input
 */
export interface ScoringInput {
  config: FormScoringConfig;
  fieldDefinitions: FormFieldDefinition[];
  sectionDefinitions: FormSectionDefinition[];
  data: Record<string, unknown>;
}

// ============================================================================
// FORM TEMPLATE TYPES
// ============================================================================

/**
 * Pre-built form template metadata
 */
export interface FormTemplateMetadata {
  slug: string;
  name: string;
  description: string;
  module: 'performance' | 'training' | 'shared';
  category: string;
  targetCompanySize?: 'small' | 'medium' | 'large' | 'all';
  countryCode?: string;
  version: string;
}

/**
 * Form template bundle (for import/export)
 */
export interface FormTemplateBundle {
  metadata: FormTemplateMetadata;
  definition: FormDefinition;
  scoringConfig?: FormScoringConfig;
  defaultRatingScale?: RatingScaleConfig;
}
