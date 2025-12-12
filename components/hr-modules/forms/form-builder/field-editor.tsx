/**
 * Field Editor Component
 *
 * Property editor panel for configuring form field settings.
 * Shows different options based on field type.
 *
 * Features:
 * - Common properties (label, required, help text)
 * - Type-specific options (choices, rating scale, etc.)
 * - Validation rules
 * - Conditional logic
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, X, GripVertical, Settings, Eye, Ruler, Calculator } from 'lucide-react';
import type { FormFieldDefinition, FormFieldType } from '@/lib/db/schema/hr-forms';

interface FieldEditorProps {
  /** Field to edit */
  field: FormFieldDefinition;
  /** Callback when field is updated */
  onFieldUpdate: (field: FormFieldDefinition) => void;
  /** Available sections for section assignment */
  sections?: { id: string; title: string }[];
  /** All fields for conditional logic */
  allFields?: FormFieldDefinition[];
  /** Custom class name */
  className?: string;
}

export function FieldEditor({
  field,
  onFieldUpdate,
  sections = [],
  allFields = [],
  className,
}: FieldEditorProps) {
  const [openSections, setOpenSections] = useState<string[]>(['basic']);

  // Update a single property
  const updateField = (updates: Partial<FormFieldDefinition>) => {
    onFieldUpdate({ ...field, ...updates });
  };

  // Add a choice option
  const addChoice = () => {
    const currentOptions = field.options || [];
    const newOption = {
      value: `option_${currentOptions.length + 1}`,
      label: `Option ${currentOptions.length + 1}`,
    };
    updateField({ options: [...currentOptions, newOption] });
  };

  // Remove a choice option
  const removeChoice = (index: number) => {
    const currentOptions = field.options || [];
    updateField({ options: currentOptions.filter((_, i) => i !== index) });
  };

  // Update a choice option
  const updateChoice = (index: number, updates: { value?: string; label?: string }) => {
    const currentOptions = field.options || [];
    updateField({
      options: currentOptions.map((opt, i) =>
        i === index ? { ...opt, ...updates } : opt
      ),
    });
  };

  // Check if field type has options
  const hasOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(field.type);

  // Check if field type has rating config
  const hasRatingConfig = field.type === 'rating';

  // Check if field type has slider config
  const hasSliderConfig = field.type === 'slider' || field.type === 'number';

  // Check if field type can be computed
  const isComputed = field.type === 'computed';

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Propriétés du champ
          </CardTitle>
          <Badge variant="outline">{field.type}</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)]">
          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="px-4 pb-4"
          >
            {/* Basic Properties */}
            <AccordionItem value="basic">
              <AccordionTrigger className="text-sm font-medium">
                Informations de base
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {/* Label */}
                <div className="space-y-2">
                  <Label htmlFor="label">Libellé</Label>
                  <Input
                    id="label"
                    value={field.label}
                    onChange={(e) => updateField({ label: e.target.value })}
                    placeholder="Libellé du champ"
                  />
                </div>

                {/* Section */}
                {sections.length > 0 && (
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select
                      value={field.section || 'none'}
                      onValueChange={(val) => updateField({ section: val === 'none' ? undefined : val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucune section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune section</SelectItem>
                        {sections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Help Text */}
                <div className="space-y-2">
                  <Label htmlFor="helpText">Texte d&apos;aide</Label>
                  <Textarea
                    id="helpText"
                    value={field.helpText || ''}
                    onChange={(e) => updateField({ helpText: e.target.value || undefined })}
                    placeholder="Instructions pour l'utilisateur..."
                    className="min-h-[60px]"
                  />
                </div>

                {/* Placeholder */}
                {['text', 'textarea', 'number'].includes(field.type) && (
                  <div className="space-y-2">
                    <Label htmlFor="placeholder">Placeholder</Label>
                    <Input
                      id="placeholder"
                      value={field.placeholder || ''}
                      onChange={(e) => updateField({ placeholder: e.target.value || undefined })}
                      placeholder="Texte indicatif..."
                    />
                  </div>
                )}

                {/* Default Value */}
                <div className="space-y-2">
                  <Label htmlFor="defaultValue">Valeur par défaut</Label>
                  <Input
                    id="defaultValue"
                    value={String(field.defaultValue || '')}
                    onChange={(e) => updateField({ defaultValue: e.target.value || undefined })}
                    placeholder="Valeur par défaut"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Validation */}
            <AccordionItem value="validation">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Validation
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {/* Required */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Obligatoire</Label>
                    <p className="text-xs text-muted-foreground">
                      L&apos;utilisateur doit remplir ce champ
                    </p>
                  </div>
                  <Switch
                    checked={field.required ?? false}
                    onCheckedChange={(checked) => updateField({ required: checked })}
                  />
                </div>

                {/* Min/Max for numbers */}
                {hasSliderConfig && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="min">Minimum</Label>
                        <Input
                          id="min"
                          type="number"
                          value={field.min ?? ''}
                          onChange={(e) => updateField({ min: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max">Maximum</Label>
                        <Input
                          id="max"
                          type="number"
                          value={field.max ?? ''}
                          onChange={(e) => updateField({ max: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="100"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Min/Max length for text */}
                {['text', 'textarea'].includes(field.type) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="minLength">Longueur min</Label>
                      <Input
                        id="minLength"
                        type="number"
                        value={field.minLength ?? ''}
                        onChange={(e) => updateField({ minLength: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxLength">Longueur max</Label>
                      <Input
                        id="maxLength"
                        type="number"
                        value={field.maxLength ?? ''}
                        onChange={(e) => updateField({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="500"
                      />
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Options (for select, radio, checkbox) */}
            {hasOptions && (
              <AccordionItem value="options">
                <AccordionTrigger className="text-sm font-medium">
                  Options de choix
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    {(field.options || []).map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          value={option.label}
                          onChange={(e) => updateChoice(index, { label: e.target.value })}
                          placeholder="Libellé"
                          className="flex-1"
                        />
                        <Input
                          value={option.value}
                          onChange={(e) => updateChoice(index, { value: e.target.value })}
                          placeholder="Valeur"
                          className="w-24"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeChoice(index)}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addChoice}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Ajouter une option
                  </Button>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Rating Config */}
            {hasRatingConfig && (
              <AccordionItem value="rating">
                <AccordionTrigger className="text-sm font-medium">
                  Configuration de notation
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Échelle</Label>
                    <Select
                      value={String(field.ratingConfig?.scale || 5)}
                      onValueChange={(val) => updateField({
                        ratingConfig: {
                          ...field.ratingConfig,
                          scale: Number(val) as 3 | 5 | 7 | 10,
                          type: field.ratingConfig?.type ?? 'stars',
                        },
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">1 à 3</SelectItem>
                        <SelectItem value="5">1 à 5</SelectItem>
                        <SelectItem value="7">1 à 7</SelectItem>
                        <SelectItem value="10">1 à 10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Style</Label>
                    <Select
                      value={field.ratingConfig?.type || 'stars'}
                      onValueChange={(val) => updateField({
                        ratingConfig: {
                          ...field.ratingConfig,
                          scale: field.ratingConfig?.scale ?? 5,
                          type: val as 'stars' | 'numeric' | 'emoji' | 'custom',
                        },
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stars">Étoiles</SelectItem>
                        <SelectItem value="numeric">Numérique</SelectItem>
                        <SelectItem value="emoji">Emoji</SelectItem>
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Libellé bas</Label>
                    <Input
                      value={field.ratingConfig?.lowLabel ?? ''}
                      placeholder="Ex: Insuffisant"
                      onChange={(e) => updateField({
                        ratingConfig: {
                          ...field.ratingConfig,
                          scale: field.ratingConfig?.scale ?? 5,
                          type: field.ratingConfig?.type ?? 'stars',
                          lowLabel: e.target.value || undefined,
                        },
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Libellé haut</Label>
                    <Input
                      value={field.ratingConfig?.highLabel ?? ''}
                      placeholder="Ex: Excellent"
                      onChange={(e) => updateField({
                        ratingConfig: {
                          ...field.ratingConfig,
                          scale: field.ratingConfig?.scale ?? 5,
                          type: field.ratingConfig?.type ?? 'stars',
                          highLabel: e.target.value || undefined,
                        },
                      })}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Slider Config */}
            {field.type === 'slider' && (
              <AccordionItem value="slider">
                <AccordionTrigger className="text-sm font-medium">
                  Configuration du curseur
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="sliderMin">Min</Label>
                      <Input
                        id="sliderMin"
                        type="number"
                        value={field.sliderConfig?.min ?? 0}
                        onChange={(e) => updateField({
                          sliderConfig: {
                            ...field.sliderConfig,
                            min: Number(e.target.value),
                            max: field.sliderConfig?.max ?? 100,
                            step: field.sliderConfig?.step ?? 1,
                          },
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sliderMax">Max</Label>
                      <Input
                        id="sliderMax"
                        type="number"
                        value={field.sliderConfig?.max ?? 100}
                        onChange={(e) => updateField({
                          sliderConfig: {
                            ...field.sliderConfig,
                            min: field.sliderConfig?.min ?? 0,
                            max: Number(e.target.value),
                            step: field.sliderConfig?.step ?? 1,
                          },
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sliderStep">Pas</Label>
                      <Input
                        id="sliderStep"
                        type="number"
                        value={field.sliderConfig?.step ?? 1}
                        onChange={(e) => updateField({
                          sliderConfig: {
                            ...field.sliderConfig,
                            min: field.sliderConfig?.min ?? 0,
                            max: field.sliderConfig?.max ?? 100,
                            step: Number(e.target.value),
                          },
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sliderUnit">Unité</Label>
                    <Input
                      id="sliderUnit"
                      value={field.sliderConfig?.unit || ''}
                      onChange={(e) => updateField({
                        sliderConfig: {
                          ...field.sliderConfig,
                          min: field.sliderConfig?.min ?? 0,
                          max: field.sliderConfig?.max ?? 100,
                          step: field.sliderConfig?.step ?? 1,
                          unit: e.target.value || undefined,
                        },
                      })}
                      placeholder="%, points, etc."
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Computed Field Config */}
            {isComputed && (
              <AccordionItem value="computed">
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Formule de calcul
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Type de calcul</Label>
                    <Select
                      value={field.computedConfig?.formula || 'sum'}
                      onValueChange={(val) => updateField({
                        computedConfig: {
                          ...field.computedConfig,
                          formula: val as 'sum' | 'average' | 'min' | 'max' | 'count' | 'custom',
                          sourceFields: field.computedConfig?.sourceFields ?? [],
                        },
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sum">Somme</SelectItem>
                        <SelectItem value="average">Moyenne</SelectItem>
                        <SelectItem value="min">Minimum</SelectItem>
                        <SelectItem value="max">Maximum</SelectItem>
                        <SelectItem value="count">Nombre</SelectItem>
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Champs sources</Label>
                    <Select
                      value=""
                      onValueChange={(fieldId) => {
                        const currentSources = field.computedConfig?.sourceFields || [];
                        if (!currentSources.includes(fieldId)) {
                          updateField({
                            computedConfig: {
                              ...field.computedConfig,
                              formula: field.computedConfig?.formula ?? 'sum',
                              sourceFields: [...currentSources, fieldId],
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Ajouter un champ..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allFields
                          .filter((f) => f.id !== field.id && ['number', 'rating', 'slider'].includes(f.type))
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {/* Selected source fields */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(field.computedConfig?.sourceFields || []).map((sourceId) => {
                        const sourceField = allFields.find((f) => f.id === sourceId);
                        return (
                          <Badge key={sourceId} variant="secondary" className="gap-1">
                            {sourceField?.label || sourceId}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => updateField({
                                computedConfig: {
                                  ...field.computedConfig,
                                  formula: field.computedConfig?.formula ?? 'sum',
                                  sourceFields: (field.computedConfig?.sourceFields || []).filter((id) => id !== sourceId),
                                },
                              })}
                            />
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Visibility */}
            <AccordionItem value="visibility">
              <AccordionTrigger className="text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Visibilité
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Lecture seule</Label>
                    <p className="text-xs text-muted-foreground">
                      L&apos;utilisateur ne peut pas modifier
                    </p>
                  </div>
                  <Switch
                    checked={field.readOnly ?? false}
                    onCheckedChange={(checked) => updateField({ readOnly: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Masqué</Label>
                    <p className="text-xs text-muted-foreground">
                      Champ non visible par défaut
                    </p>
                  </div>
                  <Switch
                    checked={field.hidden ?? false}
                    onCheckedChange={(checked) => updateField({ hidden: checked })}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default FieldEditor;
