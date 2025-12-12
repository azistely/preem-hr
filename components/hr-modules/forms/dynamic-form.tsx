/**
 * Dynamic Form Component
 *
 * Renders forms dynamically based on JSONB schema from hr_form_templates.
 * Used by both Performance (evaluations) and Training (assessments) modules.
 *
 * Features:
 * - Supports all field types: text, textarea, number, date, select, rating, etc.
 * - Conditional logic (show/hide/require based on other fields)
 * - Computed fields (sum, average, weighted_average)
 * - Section grouping with descriptions
 * - Auto-save and draft support
 * - Scoring calculation
 * - Accessibility compliant
 *
 * HCI Principles:
 * - Large touch targets (min 44px)
 * - French labels throughout
 * - Progressive disclosure (sections)
 * - Clear error messages
 * - Visual feedback on changes
 */

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Save,
  Send,
  AlertCircle,
  Star,
} from 'lucide-react';
import type {
  FormDefinition,
  FormFieldDefinition,
  FormSectionDefinition,
  FormScoringConfig,
  FormConditionalRule,
  ComputedScores,
} from '@/lib/db/schema/hr-forms';

// =============================================================================
// TYPES
// =============================================================================

export interface DynamicFormProps {
  /** Form definition from hr_form_templates */
  definition: FormDefinition;
  /** Scoring configuration */
  scoringConfig?: FormScoringConfig | null;
  /** Initial values (for editing) */
  defaultValues?: Record<string, unknown>;
  /** Called when form is submitted */
  onSubmit: (data: Record<string, unknown>, scores?: ComputedScores) => void;
  /** Called on auto-save (optional) */
  onAutoSave?: (data: Record<string, unknown>) => void;
  /** Enable auto-save every N seconds */
  autoSaveInterval?: number;
  /** Show submit button */
  showSubmit?: boolean;
  /** Submit button text */
  submitText?: string;
  /** Show save draft button */
  showSaveDraft?: boolean;
  /** Is form read-only */
  readOnly?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Form title (overrides definition) */
  formTitle?: string;
  /** Form description (overrides definition) */
  formDescription?: string;
  /** Additional className */
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build Zod schema from form fields
 */
function buildZodSchema(fields: FormFieldDefinition[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'rich_text':
        fieldSchema = z.string();
        if (field.minLength) {
          fieldSchema = (fieldSchema as z.ZodString).min(field.minLength, `Minimum ${field.minLength} caractères`);
        }
        if (field.maxLength) {
          fieldSchema = (fieldSchema as z.ZodString).max(field.maxLength, `Maximum ${field.maxLength} caractères`);
        }
        break;

      case 'number':
      case 'rating':
      case 'slider':
        fieldSchema = z.number();
        if (field.min !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).min(field.min, `Minimum ${field.min}`);
        }
        if (field.max !== undefined) {
          fieldSchema = (fieldSchema as z.ZodNumber).max(field.max, `Maximum ${field.max}`);
        }
        break;

      case 'date':
      case 'datetime':
        fieldSchema = z.string();
        break;

      case 'select':
      case 'radio':
        fieldSchema = z.string();
        break;

      case 'multiselect':
      case 'checkbox':
        fieldSchema = z.array(z.string());
        break;

      case 'employee':
        fieldSchema = z.string().uuid();
        break;

      case 'multiemployee':
        fieldSchema = z.array(z.string().uuid());
        break;

      case 'file':
        fieldSchema = z.string().optional();
        break;

      case 'computed':
      case 'heading':
      case 'paragraph':
        // These don't have values
        continue;

      default:
        fieldSchema = z.any();
    }

    // Make optional if not required
    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.id] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Check if conditions are met
 */
function evaluateConditions(
  conditions: FormConditionalRule[] | undefined,
  values: Record<string, unknown>
): { visible: boolean; required: boolean; disabled: boolean } {
  const result = { visible: true, required: false, disabled: false };

  if (!conditions || conditions.length === 0) {
    return result;
  }

  for (const rule of conditions) {
    const conditionResults = rule.conditions.map((condition) => {
      const fieldValue = values[condition.field];

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'not_contains':
          return !String(fieldValue).includes(String(condition.value));
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'is_empty':
          return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);
        case 'is_not_empty':
          return !!fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        default:
          return true;
      }
    });

    const conditionsMet =
      rule.logic === 'AND'
        ? conditionResults.every((r) => r)
        : conditionResults.some((r) => r);

    if (conditionsMet) {
      switch (rule.action) {
        case 'show':
          result.visible = true;
          break;
        case 'hide':
          result.visible = false;
          break;
        case 'require':
          result.required = true;
          break;
        case 'disable':
          result.disabled = true;
          break;
      }
    }
  }

  return result;
}

/**
 * Calculate computed field value
 */
function calculateComputedValue(
  field: FormFieldDefinition,
  values: Record<string, unknown>
): number | string {
  if (!field.computedConfig) return '';

  const { formula, sourceFields, weights, decimals = 2 } = field.computedConfig;
  const sourceValues = sourceFields.map((id) => Number(values[id]) || 0);

  let result: number;

  switch (formula) {
    case 'sum':
      result = sourceValues.reduce((a, b) => a + b, 0);
      break;

    case 'average':
      if (sourceValues.length === 0) return 0;
      result = sourceValues.reduce((a, b) => a + b, 0) / sourceValues.length;
      break;

    case 'weighted_average':
      if (!weights || sourceValues.length === 0) return 0;
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
      if (totalWeight === 0) return 0;
      result = sourceFields.reduce((sum, fieldId, i) => {
        const weight = weights[fieldId] || 0;
        return sum + sourceValues[i] * weight;
      }, 0) / totalWeight;
      break;

    case 'min':
      result = Math.min(...sourceValues);
      break;

    case 'max':
      result = Math.max(...sourceValues);
      break;

    case 'count':
      result = sourceValues.filter((v) => v > 0).length;
      break;

    default:
      result = 0;
  }

  const formatted = Number(result.toFixed(decimals));
  return field.computedConfig.suffix ? `${formatted}${field.computedConfig.suffix}` : formatted;
}

/**
 * Calculate form scores
 */
function calculateFormScores(
  config: FormScoringConfig | undefined | null,
  fields: FormFieldDefinition[],
  sections: FormSectionDefinition[],
  values: Record<string, unknown>
): ComputedScores | null {
  if (!config?.enabled) return null;

  const byField: Record<string, number> = {};
  const bySection: Record<string, number> = {};

  // Calculate per-field scores
  const scorableFields = fields.filter((f) =>
    f.type === 'rating' || f.type === 'slider' || f.type === 'number'
  );

  if (scorableFields.length === 0) return null;

  for (const field of scorableFields) {
    const value = Number(values[field.id]) || 0;
    byField[field.id] = value;
  }

  // Calculate per-section scores
  for (const section of sections) {
    const sectionFields = scorableFields.filter((f) => f.section === section.id);
    if (sectionFields.length === 0) continue;

    const sectionValues = sectionFields.map((f) => byField[f.id] || 0);
    bySection[section.id] = sectionValues.reduce((a, b) => a + b, 0) / sectionValues.length;
  }

  // Calculate total score
  let total: number;
  const maxPossible = scorableFields.reduce((sum, f) => sum + (f.max || 5), 0);

  switch (config.method) {
    case 'sum':
      total = Object.values(byField).reduce((a, b) => a + b, 0);
      break;
    case 'average':
      total = Object.values(byField).reduce((a, b) => a + b, 0) / scorableFields.length;
      break;
    case 'weighted':
      if (!config.fieldWeights) {
        total = Object.values(byField).reduce((a, b) => a + b, 0) / scorableFields.length;
      } else {
        const totalWeight = Object.values(config.fieldWeights).reduce((a, b) => a + b, 0);
        total = scorableFields.reduce((sum, f) => {
          const weight = config.fieldWeights![f.id] || 1;
          return sum + (byField[f.id] || 0) * weight;
        }, 0) / totalWeight;
      }
      break;
    default:
      total = Object.values(byField).reduce((a, b) => a + b, 0) / scorableFields.length;
  }

  const percentage = (total / (maxPossible / scorableFields.length)) * 100;

  // Determine category from thresholds
  let category: string | undefined;
  if (config.thresholds) {
    for (const threshold of config.thresholds) {
      if (percentage >= threshold.min && percentage <= threshold.max) {
        category = threshold.label;
        break;
      }
    }
  }

  return {
    byField,
    bySection,
    total: Math.round(total * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
    category,
  };
}

// =============================================================================
// FIELD COMPONENTS
// =============================================================================

interface FieldProps {
  field: FormFieldDefinition;
  control: ReturnType<typeof useForm>['control'];
  errors: Record<string, { message?: string }>;
  readOnly?: boolean;
  values: Record<string, unknown>;
  conditionResult: { visible: boolean; required: boolean; disabled: boolean };
}

/**
 * Text Input Field
 */
function TextField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue=""
      render={({ field: formField }) => (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <Input
            id={field.id}
            {...formField}
            placeholder={field.placeholder}
            disabled={readOnly || conditionResult.disabled}
            className="min-h-[48px]"
          />
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Textarea Field
 */
function TextareaField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue=""
      render={({ field: formField }) => (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <Textarea
            id={field.id}
            {...formField}
            placeholder={field.placeholder}
            disabled={readOnly || conditionResult.disabled}
            rows={4}
            className="min-h-[120px]"
          />
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Number Input Field
 */
function NumberField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={0}
      render={({ field: formField }) => (
        <div className="space-y-2">
          <Label htmlFor={field.id} className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <Input
            id={field.id}
            type="number"
            {...formField}
            onChange={(e) => formField.onChange(Number(e.target.value))}
            placeholder={field.placeholder}
            disabled={readOnly || conditionResult.disabled}
            min={field.min}
            max={field.max}
            className="min-h-[48px]"
          />
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Rating Field (Stars)
 */
function RatingField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  const maxRating = field.ratingConfig?.scale || 5;
  const labels = field.ratingConfig?.labels || {};

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={0}
      render={({ field: formField }) => (
        <div className="space-y-2">
          <Label className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map((rating) => (
              <button
                key={rating}
                type="button"
                disabled={readOnly || conditionResult.disabled}
                onClick={() => formField.onChange(rating)}
                className={cn(
                  'p-2 rounded-lg transition-all min-w-[48px] min-h-[48px] flex items-center justify-center',
                  formField.value >= rating
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-muted-foreground hover:text-amber-400',
                  (readOnly || conditionResult.disabled) && 'cursor-default'
                )}
                aria-label={labels[rating] || `${rating} étoiles`}
              >
                <Star
                  className={cn(
                    'h-8 w-8',
                    formField.value >= rating && 'fill-current'
                  )}
                />
              </button>
            ))}
            {formField.value > 0 && (
              <span className="ml-4 text-lg font-semibold">
                {formField.value}/{maxRating}
                {labels[formField.value] && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    - {labels[formField.value]}
                  </span>
                )}
              </span>
            )}
          </div>
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Slider Field
 */
function SliderField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  const config = field.sliderConfig;
  const min = config?.min ?? 0;
  const max = config?.max ?? 100;
  const step = config?.step ?? 1;

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={min}
      render={({ field: formField }) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              {field.label}
              {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
            </Label>
            <span className="text-xl font-bold text-primary">
              {formField.value}{config?.unit || ''}
            </span>
          </div>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <Slider
            value={[formField.value]}
            onValueChange={([value]) => formField.onChange(value)}
            min={min}
            max={max}
            step={step}
            disabled={readOnly || conditionResult.disabled}
            className="py-4"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{min}{config?.unit || ''}</span>
            <span>{max}{config?.unit || ''}</span>
          </div>
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Select Field
 */
function SelectField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue=""
      render={({ field: formField }) => (
        <div className="space-y-2">
          <Label className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <Select
            value={formField.value}
            onValueChange={formField.onChange}
            disabled={readOnly || conditionResult.disabled}
          >
            <SelectTrigger className="min-h-[48px]">
              <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Radio Group Field
 */
function RadioField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue=""
      render={({ field: formField }) => (
        <div className="space-y-3">
          <Label className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <RadioGroup
            value={formField.value}
            onValueChange={formField.onChange}
            disabled={readOnly || conditionResult.disabled}
            className="space-y-2"
          >
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <RadioGroupItem
                  value={option.value}
                  id={`${field.id}-${option.value}`}
                  className="min-w-[20px] min-h-[20px]"
                />
                <Label
                  htmlFor={`${field.id}-${option.value}`}
                  className="text-base cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Checkbox Group Field
 */
function CheckboxField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={[]}
      render={({ field: formField }) => (
        <div className="space-y-3">
          <Label className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <div className="space-y-2">
            {field.options?.map((option) => {
              const isChecked = formField.value?.includes(option.value);
              return (
                <div key={option.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={`${field.id}-${option.value}`}
                    checked={isChecked}
                    disabled={readOnly || conditionResult.disabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        formField.onChange([...formField.value, option.value]);
                      } else {
                        formField.onChange(
                          formField.value.filter((v: string) => v !== option.value)
                        );
                      }
                    }}
                    className="min-w-[20px] min-h-[20px]"
                  />
                  <Label
                    htmlFor={`${field.id}-${option.value}`}
                    className="text-base cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              );
            })}
          </div>
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Date Picker Field
 */
function DateField({ field, control, errors, readOnly, conditionResult }: FieldProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue=""
      render={({ field: formField }) => (
        <div className="space-y-2">
          <Label className="text-base font-medium">
            {field.label}
            {(field.required || conditionResult.required) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={readOnly || conditionResult.disabled}
                className={cn(
                  'min-h-[48px] w-full justify-start text-left font-normal',
                  !formField.value && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formField.value
                  ? format(new Date(formField.value), 'PPP', { locale: fr })
                  : field.placeholder || 'Sélectionner une date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formField.value ? new Date(formField.value) : undefined}
                onSelect={(date) => formField.onChange(date?.toISOString().split('T')[0])}
                locale={fr}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors[field.id] && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors[field.id].message}
            </p>
          )}
        </div>
      )}
    />
  );
}

/**
 * Computed Field (Read-only, calculated)
 */
function ComputedField({ field, values }: { field: FormFieldDefinition; values: Record<string, unknown> }) {
  const computedValue = calculateComputedValue(field, values);

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium">{field.label}</Label>
      {field.helpText && (
        <p className="text-sm text-muted-foreground">{field.helpText}</p>
      )}
      <div className="p-4 bg-muted rounded-lg">
        <span className="text-2xl font-bold">{computedValue}</span>
      </div>
    </div>
  );
}

/**
 * Heading Field
 */
function HeadingField({ field }: { field: FormFieldDefinition }) {
  return (
    <div className="pt-4">
      <h3 className="text-lg font-semibold">{field.label}</h3>
      {field.helpText && (
        <p className="text-muted-foreground mt-1">{field.helpText}</p>
      )}
    </div>
  );
}

/**
 * Paragraph Field
 */
function ParagraphField({ field }: { field: FormFieldDefinition }) {
  return (
    <div className="py-2">
      <p className="text-muted-foreground">{field.helpText || field.label}</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DynamicForm({
  definition,
  scoringConfig,
  defaultValues = {},
  onSubmit,
  onAutoSave,
  autoSaveInterval = 30,
  showSubmit = true,
  submitText = 'Soumettre',
  showSaveDraft = true,
  readOnly = false,
  isLoading = false,
  formTitle,
  formDescription,
  className,
}: DynamicFormProps) {
  // Build Zod schema
  const zodSchema = useMemo(() => buildZodSchema(definition.fields), [definition.fields]);

  // Initialize form
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    getValues,
  } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
  });

  // Watch all values for conditional logic
  const watchedValues = useWatch({ control });
  const values = watchedValues as Record<string, unknown>;

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const defaultCollapsed = new Set<string>();
    for (const section of definition.sections) {
      if (section.defaultCollapsed) {
        defaultCollapsed.add(section.id);
      }
    }
    return defaultCollapsed;
  });

  // Auto-save
  useEffect(() => {
    if (!onAutoSave || autoSaveInterval <= 0 || readOnly || !definition.autoSave) return;

    const interval = setInterval(() => {
      if (isDirty) {
        onAutoSave(getValues());
      }
    }, autoSaveInterval * 1000);

    return () => clearInterval(interval);
  }, [onAutoSave, autoSaveInterval, isDirty, getValues, readOnly, definition.autoSave]);

  // Handle form submit
  const handleFormSubmit = useCallback(
    (data: Record<string, unknown>) => {
      const scores = calculateFormScores(scoringConfig, definition.fields, definition.sections, data);
      onSubmit(data, scores ?? undefined);
    },
    [scoringConfig, definition.fields, definition.sections, onSubmit]
  );

  // Handle save draft
  const handleSaveDraft = useCallback(() => {
    if (onAutoSave) {
      onAutoSave(getValues());
    }
  }, [onAutoSave, getValues]);

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Render a single field
  const renderField = useCallback(
    (field: FormFieldDefinition) => {
      // Check visibility
      const conditionResult = evaluateConditions(field.conditions, values);
      if (!conditionResult.visible || field.hidden) {
        return null;
      }

      const fieldProps: FieldProps = {
        field,
        control,
        errors: errors as Record<string, { message?: string }>,
        readOnly,
        values,
        conditionResult,
      };

      switch (field.type) {
        case 'text':
          return <TextField key={field.id} {...fieldProps} />;
        case 'textarea':
        case 'rich_text':
          return <TextareaField key={field.id} {...fieldProps} />;
        case 'number':
          return <NumberField key={field.id} {...fieldProps} />;
        case 'rating':
          return <RatingField key={field.id} {...fieldProps} />;
        case 'slider':
          return <SliderField key={field.id} {...fieldProps} />;
        case 'select':
          return <SelectField key={field.id} {...fieldProps} />;
        case 'radio':
          return <RadioField key={field.id} {...fieldProps} />;
        case 'multiselect':
        case 'checkbox':
          return <CheckboxField key={field.id} {...fieldProps} />;
        case 'date':
        case 'datetime':
          return <DateField key={field.id} {...fieldProps} />;
        case 'computed':
          return <ComputedField key={field.id} field={field} values={values} />;
        case 'heading':
          return <HeadingField key={field.id} field={field} />;
        case 'paragraph':
          return <ParagraphField key={field.id} field={field} />;
        default:
          return <TextField key={field.id} {...fieldProps} />;
      }
    },
    [control, errors, readOnly, values]
  );

  // Calculate current score for display
  const currentScore = useMemo(
    () => calculateFormScores(scoringConfig, definition.fields, definition.sections, values),
    [scoringConfig, definition.fields, definition.sections, values]
  );

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const map = new Map<string, FormFieldDefinition[]>();
    for (const section of definition.sections) {
      map.set(section.id, []);
    }
    for (const field of definition.fields) {
      if (field.section && map.has(field.section)) {
        map.get(field.section)!.push(field);
      }
    }
    return map;
  }, [definition.fields, definition.sections]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={cn('space-y-6', className)}>
      {/* Form Header */}
      {(formTitle || formDescription) && (
        <div className="space-y-2">
          {formTitle && <h2 className="text-2xl font-bold">{formTitle}</h2>}
          {formDescription && <p className="text-muted-foreground">{formDescription}</p>}
        </div>
      )}

      {/* Score Display (if scoring enabled) */}
      {scoringConfig?.enabled && currentScore && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Score actuel</span>
              <div className="flex items-center gap-2">
                {currentScore.category && (
                  <Badge variant="outline">{currentScore.category}</Badge>
                )}
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {currentScore.total} ({Math.round(currentScore.percentage)}%)
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {definition.sections.map((section) => {
        const sectionConditions = evaluateConditions(section.conditions, values);
        if (!sectionConditions.visible) return null;

        const isCollapsed = collapsedSections.has(section.id);
        const sectionFields = fieldsBySection.get(section.id) || [];
        const visibleFields = sectionFields.filter(
          (f) => evaluateConditions(f.conditions, values).visible && !f.hidden
        );

        if (visibleFields.length === 0) return null;

        if (section.collapsible === false) {
          // Non-collapsible section
          return (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {visibleFields.sort((a, b) => (a.order || 0) - (b.order || 0)).map(renderField)}
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={section.id}>
            <Collapsible open={!isCollapsed} onOpenChange={() => toggleSection(section.id)}>
              <CardHeader className="cursor-pointer" onClick={() => toggleSection(section.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    {section.description && (
                      <CardDescription>{section.description}</CardDescription>
                    )}
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {isCollapsed ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronUp className="h-5 w-5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {visibleFields.sort((a, b) => (a.order || 0) - (b.order || 0)).map(renderField)}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Action Buttons */}
      {!readOnly && (showSubmit || showSaveDraft) && (
        <div className="flex gap-4 justify-end pt-4">
          {showSaveDraft && definition.allowDraft && onAutoSave && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isLoading || !isDirty}
              className="min-h-[48px]"
            >
              <Save className="mr-2 h-4 w-4" />
              Enregistrer le brouillon
            </Button>
          )}
          {showSubmit && (
            <Button
              type="submit"
              disabled={isLoading}
              className="min-h-[56px] px-8"
            >
              {isLoading ? (
                <>Envoi en cours...</>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {submitText}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

export default DynamicForm;
