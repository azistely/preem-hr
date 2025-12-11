/**
 * Dynamic Tracker Form Renderer
 *
 * Renders form fields based on tracker type definition.
 * Supports: text, textarea, date, datetime, select, multiselect,
 * number, employee, file, checkbox, location
 *
 * Features:
 * - Section-based grouping
 * - Computed fields (deadlines)
 * - Conditional rules (skip fields based on values)
 * - Validation
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useForm, Controller, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/trpc/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, X, HelpCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { addHours, addBusinessDays } from '@/lib/utils/date';
import { FileUploadField } from './file-upload-field';

// Type definitions from schema
interface TrackerFieldDefinition {
  id: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'date'
    | 'datetime'
    | 'select'
    | 'multiselect'
    | 'number'
    | 'employee'
    | 'multiemployee'
    | 'file'
    | 'checkbox'
    | 'location';
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  helpText?: string;
  section?: string;
  readOnly?: boolean;
  computed?: {
    type: 'add_hours' | 'add_business_days';
    sourceField: string;
    value: number;
  };
}

interface TrackerSectionDefinition {
  id: string;
  title: string;
  description?: string;
}

interface TrackerTypeDefinition {
  fields: TrackerFieldDefinition[];
  sections?: TrackerSectionDefinition[];
  rules?: Array<{
    condition: {
      field: string;
      operator: 'equals' | 'not_equals';
      value: string;
    };
    action: 'skip_action_plan' | 'require_field';
    targetField?: string;
  }>;
}

interface TrackerFormProps {
  definition: TrackerTypeDefinition;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export function TrackerForm({
  definition,
  initialData = {},
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = 'create',
}: TrackerFormProps) {
  // Build dynamic zod schema based on field definitions
  const schema = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    definition.fields.forEach((field) => {
      let fieldSchema: z.ZodTypeAny;

      switch (field.type) {
        case 'text':
        case 'textarea':
        case 'location':
          fieldSchema = field.required
            ? z.string().min(1, `${field.label} est requis`)
            : z.string().optional();
          break;
        case 'date':
        case 'datetime':
          fieldSchema = field.required
            ? z.date({ required_error: `${field.label} est requis` })
            : z.date().optional().nullable();
          break;
        case 'select':
          fieldSchema = field.required
            ? z.string().min(1, `${field.label} est requis`)
            : z.string().optional();
          break;
        case 'multiselect':
          fieldSchema = field.required
            ? z.array(z.string()).min(1, `Sélectionnez au moins une option`)
            : z.array(z.string()).optional();
          break;
        case 'number':
          fieldSchema = field.required
            ? z.number({ required_error: `${field.label} est requis` })
            : z.number().optional().nullable();
          break;
        case 'employee':
          fieldSchema = field.required
            ? z.string().uuid(`${field.label} est requis`)
            : z.string().uuid().optional().nullable();
          break;
        case 'multiemployee':
          fieldSchema = field.required
            ? z.array(z.string().uuid()).min(1, `Sélectionnez au moins un employé`)
            : z.array(z.string().uuid()).optional();
          break;
        case 'checkbox':
          fieldSchema = z.boolean().optional();
          break;
        case 'file':
          // File field stores array of uploaded file objects
          fieldSchema = z.array(z.object({
            id: z.string(),
            name: z.string(),
            url: z.string(),
            size: z.number(),
            type: z.string(),
          })).optional().default([]);
          break;
        case 'location':
          fieldSchema = field.required
            ? z.string().uuid(`${field.label} est requis`)
            : z.string().uuid().optional().nullable();
          break;
        default:
          fieldSchema = z.any();
      }

      schemaFields[field.id] = fieldSchema;
    });

    return z.object(schemaFields);
  }, [definition.fields]);

  // Initialize form
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData,
  });

  const { control, watch, setValue, handleSubmit, formState } = form;

  // Fetch employees for employee picker
  const { data: employees } = api.employees.list.useQuery(
    { status: 'active', limit: 100 },
    { enabled: definition.fields.some((f) => f.type === 'employee' || f.type === 'multiemployee') }
  );

  // Fetch locations for location picker
  const { data: locations } = api.locations.list.useQuery(
    undefined,
    { enabled: definition.fields.some((f) => f.type === 'location') }
  );

  // Get computed field definitions
  const computedFields = useMemo(() =>
    definition.fields.filter((f) => f.computed && f.readOnly),
    [definition.fields]
  );

  // Get source field names for computed fields
  const sourceFieldNames = useMemo(() =>
    computedFields.map((f) => f.computed!.sourceField),
    [computedFields]
  );

  // Watch only the source fields for computed values
  const sourceFieldValues = watch(sourceFieldNames);

  // Handle computed fields - only runs when source field values change
  useEffect(() => {
    if (computedFields.length === 0) return;

    computedFields.forEach((field, index) => {
      const sourceValue = sourceFieldValues[index];
      if (sourceValue instanceof Date) {
        let computedValue: Date;
        if (field.computed!.type === 'add_hours') {
          computedValue = addHours(sourceValue, field.computed!.value);
        } else {
          computedValue = addBusinessDays(sourceValue, field.computed!.value);
        }
        // Only update if value actually changed to prevent loops
        const currentValue = form.getValues(field.id);
        if (!currentValue || currentValue.getTime?.() !== computedValue.getTime()) {
          setValue(field.id, computedValue, { shouldValidate: false });
        }
      }
    });
  }, [sourceFieldValues, computedFields, setValue, form]);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const sections = definition.sections || [];
    const grouped: Record<string, TrackerFieldDefinition[]> = {
      _default: [],
    };

    sections.forEach((s) => {
      grouped[s.id] = [];
    });

    definition.fields.forEach((field) => {
      const sectionId = field.section || '_default';
      if (!grouped[sectionId]) {
        grouped[sectionId] = [];
      }
      grouped[sectionId].push(field);
    });

    return grouped;
  }, [definition]);

  // Render a single field
  const renderField = (field: TrackerFieldDefinition) => {
    const isReadOnly = mode === 'view' || field.readOnly;
    const hasError = !!formState.errors[field.id];

    return (
      <div key={field.id} className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={field.id} className={cn(field.required && 'after:content-["*"] after:ml-0.5 after:text-destructive')}>
            {field.label}
          </Label>
          {field.helpText && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm">
                {field.helpText}
              </PopoverContent>
            </Popover>
          )}
          {field.computed && (
            <Badge variant="secondary" className="text-xs">
              Auto-calculé
            </Badge>
          )}
        </div>

        <Controller
          name={field.id}
          control={control}
          render={({ field: formField }) => {
            switch (field.type) {
              case 'text':
                return (
                  <Input
                    {...formField}
                    id={field.id}
                    placeholder={field.placeholder}
                    disabled={isReadOnly}
                    className={cn('min-h-[48px]', hasError && 'border-destructive')}
                    value={formField.value || ''}
                  />
                );

              case 'textarea':
                return (
                  <Textarea
                    {...formField}
                    id={field.id}
                    placeholder={field.placeholder}
                    disabled={isReadOnly}
                    className={cn('min-h-[100px]', hasError && 'border-destructive')}
                    value={formField.value || ''}
                  />
                );

              case 'number':
                return (
                  <Input
                    {...formField}
                    id={field.id}
                    type="number"
                    placeholder={field.placeholder}
                    disabled={isReadOnly}
                    className={cn('min-h-[48px]', hasError && 'border-destructive')}
                    value={formField.value ?? ''}
                    onChange={(e) => formField.onChange(e.target.value ? Number(e.target.value) : null)}
                  />
                );

              case 'date':
              case 'datetime':
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full min-h-[48px] justify-start text-left font-normal',
                          !formField.value && 'text-muted-foreground',
                          hasError && 'border-destructive'
                        )}
                        disabled={isReadOnly}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formField.value
                          ? format(
                              new Date(formField.value),
                              field.type === 'datetime' ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy',
                              { locale: fr }
                            )
                          : field.placeholder || 'Sélectionner une date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formField.value ? new Date(formField.value) : undefined}
                        onSelect={formField.onChange}
                        locale={fr}
                        initialFocus
                      />
                      {field.type === 'datetime' && formField.value && (
                        <div className="p-3 border-t">
                          <Label className="text-xs">Heure</Label>
                          <Input
                            type="time"
                            value={format(new Date(formField.value), 'HH:mm')}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(':');
                              const newDate = new Date(formField.value);
                              newDate.setHours(Number(hours), Number(minutes));
                              formField.onChange(newDate);
                            }}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                );

              case 'select':
                const selectOptions = field.options?.filter((option) => option.value) || [];
                if (selectOptions.length === 0) {
                  return (
                    <div className={cn('min-h-[48px] flex items-center px-3 border rounded-md bg-muted text-muted-foreground', hasError && 'border-destructive')}>
                      Aucune option disponible
                    </div>
                  );
                }
                return (
                  <Select
                    value={formField.value || undefined}
                    onValueChange={formField.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className={cn('min-h-[48px]', hasError && 'border-destructive')}>
                      <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {selectOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );

              case 'multiselect':
                const selectedValues = (formField.value as string[]) || [];
                const availableOptions = field.options?.filter((o) => o.value && !selectedValues.includes(o.value)) || [];
                return (
                  <div className="space-y-2">
                    {selectedValues.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedValues.map((value) => {
                          const option = field.options?.find((o) => o.value === value);
                          return (
                            <Badge key={value} variant="secondary" className="gap-1">
                              {option?.label || value}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    formField.onChange(selectedValues.filter((v) => v !== value))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    {!isReadOnly && availableOptions.length > 0 && (
                      <Select
                        key={`multiselect-${selectedValues.length}`}
                        value={undefined}
                        onValueChange={(value) => {
                          if (value && !selectedValues.includes(value)) {
                            formField.onChange([...selectedValues, value]);
                          }
                        }}
                      >
                        <SelectTrigger className={cn('min-h-[48px]', hasError && 'border-destructive')}>
                          <SelectValue placeholder="Ajouter..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );

              case 'employee':
                const employeeList = employees?.employees?.filter((emp: { id: string }) => emp.id) || [];
                if (employeeList.length === 0) {
                  return (
                    <div className={cn('min-h-[48px] flex items-center px-3 border rounded-md bg-muted text-muted-foreground', hasError && 'border-destructive')}>
                      Aucun employé disponible
                    </div>
                  );
                }
                return (
                  <Select
                    value={formField.value || undefined}
                    onValueChange={formField.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className={cn('min-h-[48px]', hasError && 'border-destructive')}>
                      <SelectValue placeholder="Sélectionner un employé..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeList.map((emp: { id: string; firstName: string; lastName: string; employeeNumber: string }) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );

              case 'location':
                const locationList = locations?.filter((loc: { id: string }) => loc.id) || [];
                if (locationList.length === 0) {
                  return (
                    <div className={cn('min-h-[48px] flex items-center px-3 border rounded-md bg-muted text-muted-foreground', hasError && 'border-destructive')}>
                      Aucun site configuré
                    </div>
                  );
                }
                return (
                  <Select
                    value={formField.value || undefined}
                    onValueChange={formField.onChange}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className={cn('min-h-[48px]', hasError && 'border-destructive')}>
                      <SelectValue placeholder="Sélectionner un site..." />
                    </SelectTrigger>
                    <SelectContent>
                      {locationList.map((loc: { id: string; locationName: string; locationCode: string; city?: string | null }) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.locationName} {loc.city ? `(${loc.city})` : ''} - {loc.locationCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );

              case 'multiemployee':
                const selectedEmployees = (formField.value as string[]) || [];
                const availableEmployees = employees?.employees?.filter(
                  (emp: { id: string }) => !selectedEmployees.includes(emp.id)
                ) || [];
                return (
                  <div className="space-y-2">
                    {selectedEmployees.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedEmployees.map((empId) => {
                          const emp = employees?.employees?.find((e: { id: string; firstName: string; lastName: string; employeeNumber: string }) => e.id === empId);
                          return (
                            <Badge key={empId} variant="secondary" className="gap-1">
                              {emp ? `${emp.firstName} ${emp.lastName}` : empId}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    formField.onChange(selectedEmployees.filter((id) => id !== empId))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    {!isReadOnly && availableEmployees.length > 0 && (
                      <Select
                        key={`multiemployee-${selectedEmployees.length}`}
                        value={undefined}
                        onValueChange={(empId) => {
                          if (empId && !selectedEmployees.includes(empId)) {
                            formField.onChange([...selectedEmployees, empId]);
                          }
                        }}
                      >
                        <SelectTrigger className={cn('min-h-[48px]', hasError && 'border-destructive')}>
                          <SelectValue placeholder="Ajouter un employé..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEmployees.map((emp: { id: string; firstName: string; lastName: string; employeeNumber: string }) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!isReadOnly && availableEmployees.length === 0 && selectedEmployees.length > 0 && (
                      <p className="text-xs text-muted-foreground">Tous les employés ont été sélectionnés</p>
                    )}
                  </div>
                );

              case 'checkbox':
                return (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={field.id}
                      checked={formField.value || false}
                      onCheckedChange={formField.onChange}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={field.id} className="font-normal cursor-pointer">
                      {field.placeholder || 'Oui'}
                    </Label>
                  </div>
                );

              case 'file':
                return (
                  <FileUploadField
                    value={formField.value || []}
                    onChange={formField.onChange}
                    disabled={isReadOnly}
                    maxFiles={10}
                  />
                );

              default:
                return <Input {...formField} disabled={isReadOnly} />;
            }
          }}
        />

        {formState.errors[field.id] && (
          <p className="text-sm text-destructive">
            {formState.errors[field.id]?.message as string}
          </p>
        )}
      </div>
    );
  };

  // Render sections
  const renderSections = () => {
    const sections = definition.sections || [];

    return (
      <div className="space-y-8">
        {/* Default section (fields without section) */}
        {fieldsBySection._default.length > 0 && (
          <div className="space-y-4">
            {fieldsBySection._default.map(renderField)}
          </div>
        )}

        {/* Named sections */}
        {sections.map((section) => {
          const sectionFields = fieldsBySection[section.id] || [];
          if (sectionFields.length === 0) return null;

          return (
            <div key={section.id} className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-semibold text-lg">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                )}
              </div>
              {sectionFields.map(renderField)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {renderSections()}

      {mode !== 'view' && (
        <div className="flex flex-col-reverse md:flex-row gap-3 pt-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="min-h-[48px]"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
          )}
          <Button
            type="submit"
            className="min-h-[56px] flex-1 md:flex-none"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enregistrement...' : mode === 'edit' ? 'Enregistrer' : 'Créer le dossier'}
          </Button>
        </div>
      )}
    </form>
  );
}
