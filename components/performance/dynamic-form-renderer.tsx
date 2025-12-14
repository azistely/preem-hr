/**
 * Dynamic Form Renderer
 *
 * Renders form fields from a FormDefinition (template) with support for:
 * - All field types: text, textarea, rating, slider, select, etc.
 * - Sections with collapsible groups
 * - Conditional logic
 * - Validation
 */

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Star, Info, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  FormDefinition,
  FormFieldDefinition,
  FormSectionDefinition,
} from '@/lib/db/schema/hr-forms';

interface DynamicFormRendererProps {
  definition: FormDefinition;
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}

// Rating input component for star/scale ratings
function RatingField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormFieldDefinition;
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const config = field.ratingConfig;
  const scale = config?.scale || 5;
  const type = config?.type || 'stars';

  if (type === 'emoji') {
    const emojis = ['😞', '😕', '😐', '🙂', '😀'];
    const emojiScale = scale === 3 ? [emojis[0], emojis[2], emojis[4]] : emojis.slice(0, scale);

    return (
      <div className="flex gap-2">
        {emojiScale.map((emoji, i) => {
          const ratingValue = i + 1;
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onChange(ratingValue)}
              disabled={disabled}
              className={`text-2xl p-2 rounded-lg border-2 transition-all ${
                value === ratingValue
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:border-muted'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    );
  }

  // Stars or numeric rating
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: scale }, (_, i) => i + 1).map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => !disabled && onChange(rating)}
            disabled={disabled}
            className={`p-1 rounded transition-colors ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'
            }`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                value && rating <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </button>
        ))}
      </div>
      {config?.labels && value && config.labels[value] && (
        <span className="text-sm text-muted-foreground">{config.labels[value]}</span>
      )}
      <div className="flex justify-between text-xs text-muted-foreground">
        {config?.lowLabel && <span>{config.lowLabel}</span>}
        {config?.highLabel && <span>{config.highLabel}</span>}
      </div>
    </div>
  );
}

// Slider field component
function SliderField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormFieldDefinition;
  value: number | undefined;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const config = field.sliderConfig;
  const min = config?.min ?? 0;
  const max = config?.max ?? 100;
  const step = config?.step ?? 1;

  return (
    <div className="space-y-4">
      <Slider
        value={[value ?? min]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full"
      />
      {config?.showValue !== false && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{min}{config?.unit}</span>
          <span className="font-medium">{value ?? min}{config?.unit}</span>
          <span className="text-muted-foreground">{max}{config?.unit}</span>
        </div>
      )}
    </div>
  );
}

// Single field renderer
function FormField({
  field,
  value,
  onChange,
  disabled,
  error,
}: {
  field: FormFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}) {
  // Skip hidden fields
  if (field.hidden) return null;

  // Render different field types
  const renderFieldInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled || field.readOnly}
            minLength={field.minLength}
            maxLength={field.maxLength}
            className="min-h-[48px]"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled || field.readOnly}
            minLength={field.minLength}
            maxLength={field.maxLength}
            rows={4}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
            placeholder={field.placeholder}
            disabled={disabled || field.readOnly}
            min={field.min}
            max={field.max}
            className="min-h-[48px]"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || field.readOnly}
            className="min-h-[48px]"
          />
        );

      case 'rating':
        return (
          <RatingField
            field={field}
            value={value as number | undefined}
            onChange={onChange}
            disabled={disabled || field.readOnly}
          />
        );

      case 'slider':
        return (
          <SliderField
            field={field}
            value={value as number | undefined}
            onChange={onChange}
            disabled={disabled || field.readOnly}
          />
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={onChange}
            disabled={disabled || field.readOnly}
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
        );

      case 'radio':
        return (
          <RadioGroup
            value={(value as string) || ''}
            onValueChange={onChange}
            disabled={disabled || field.readOnly}
            className="space-y-2"
          >
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${field.id}-${option.value}`} />
                <Label htmlFor={`${field.id}-${option.value}`} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={(value as boolean) || false}
              onCheckedChange={onChange}
              disabled={disabled || field.readOnly}
            />
            <Label htmlFor={field.id} className="cursor-pointer">
              {field.label}
            </Label>
          </div>
        );

      case 'multiselect':
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option.value]);
                    } else {
                      onChange(selectedValues.filter(v => v !== option.value));
                    }
                  }}
                  disabled={disabled || field.readOnly}
                />
                <Label htmlFor={`${field.id}-${option.value}`} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'heading':
        return <h3 className="text-lg font-semibold">{field.label}</h3>;

      case 'paragraph':
        return <p className="text-muted-foreground">{field.helpText || field.label}</p>;

      default:
        return (
          <Input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled || field.readOnly}
            className="min-h-[48px]"
          />
        );
    }
  };

  // Don't show label for heading/paragraph types
  if (field.type === 'heading' || field.type === 'paragraph') {
    return <div className={`${field.width === 'half' ? 'col-span-1' : field.width === 'third' ? 'col-span-1' : 'col-span-full'}`}>{renderFieldInput()}</div>;
  }

  // Don't show separate label for checkbox (it's inline)
  if (field.type === 'checkbox') {
    return (
      <div className={`space-y-2 ${field.width === 'half' ? 'col-span-1' : field.width === 'third' ? 'col-span-1' : 'col-span-full'}`}>
        {renderFieldInput()}
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${field.width === 'half' ? 'col-span-1' : field.width === 'third' ? 'col-span-1' : 'col-span-full'}`}>
      <div className="flex items-center gap-2">
        <Label htmlFor={field.id} className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{field.helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {renderFieldInput()}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}

// Section renderer
function FormSection({
  section,
  fields,
  values,
  onChange,
  disabled,
  errors,
}: {
  section: FormSectionDefinition;
  fields: FormFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(!section.defaultCollapsed);

  const content = (
    <div className="grid grid-cols-2 gap-4">
      {fields
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(value) => onChange(field.id, value)}
            disabled={disabled}
            error={errors?.[field.id]}
          />
        ))}
    </div>
  );

  if (!section.collapsible) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{section.title}</CardTitle>
          {section.description && (
            <CardDescription>{section.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{section.title}</CardTitle>
              {section.description && (
                <CardDescription>{section.description}</CardDescription>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <>
                    Réduire
                    <ChevronUp className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Développer
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>{content}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Main renderer component
export function DynamicFormRenderer({
  definition,
  values,
  onChange,
  disabled,
  errors,
}: DynamicFormRendererProps) {
  // Group fields by section
  const fieldsBySection = new Map<string, FormFieldDefinition[]>();
  const orphanFields: FormFieldDefinition[] = [];

  definition.fields.forEach((field) => {
    if (field.section) {
      if (!fieldsBySection.has(field.section)) {
        fieldsBySection.set(field.section, []);
      }
      fieldsBySection.get(field.section)!.push(field);
    } else {
      orphanFields.push(field);
    }
  });

  // Sort sections by order
  const sortedSections = [...definition.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Render orphan fields first (not in any section) */}
      {orphanFields.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              {orphanFields
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((field) => (
                  <FormField
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onChange={(value) => onChange(field.id, value)}
                    disabled={disabled}
                    error={errors?.[field.id]}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Render sections */}
      {sortedSections.map((section) => {
        const sectionFields = fieldsBySection.get(section.id) || [];
        if (sectionFields.length === 0) return null;

        return (
          <FormSection
            key={section.id}
            section={section}
            fields={sectionFields}
            values={values}
            onChange={onChange}
            disabled={disabled}
            errors={errors}
          />
        );
      })}

      {/* Progress indicator if enabled */}
      {definition.showProgress && (
        <div className="text-sm text-muted-foreground text-center">
          {(() => {
            const totalRequired = definition.fields.filter(f => f.required && !f.hidden).length;
            const filledRequired = definition.fields.filter(
              f => f.required && !f.hidden && values[f.id] !== undefined && values[f.id] !== ''
            ).length;
            const percentage = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 100;
            return `${percentage}% complété (${filledRequired}/${totalRequired} champs requis)`;
          })()}
        </div>
      )}
    </div>
  );
}

// Export for use in evaluation form
export type { DynamicFormRendererProps };
