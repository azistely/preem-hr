/**
 * Form Preview Mode Component
 *
 * Live preview of the form being built.
 * Shows how the form will appear to respondents.
 *
 * Features:
 * - Real-time preview updates
 * - Device size toggles (mobile/tablet/desktop)
 * - Sample data mode
 * - Validation preview
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Smartphone,
  Tablet,
  Monitor,
  Eye,
  EyeOff,
  Star,
  Upload,
  Calendar,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import type { FormFieldDefinition } from '@/lib/db/schema/hr-forms';

// Device presets
const deviceSizes = {
  mobile: { width: 375, label: 'Mobile', icon: Smartphone },
  tablet: { width: 768, label: 'Tablette', icon: Tablet },
  desktop: { width: 1024, label: 'Desktop', icon: Monitor },
} as const;

type DeviceSize = keyof typeof deviceSizes;

interface FormPreviewProps {
  /** Form title */
  title?: string;
  /** Form description */
  description?: string;
  /** Form fields to preview */
  fields: FormFieldDefinition[];
  /** Show sample data */
  showSampleData?: boolean;
  /** Show validation states */
  showValidation?: boolean;
  /** Selected field for highlighting */
  selectedFieldId?: string | null;
  /** Callback when field is clicked */
  onFieldClick?: (fieldId: string) => void;
  /** Custom class name */
  className?: string;
}

// Sample data generator
function getSampleValue(field: FormFieldDefinition): unknown {
  switch (field.type) {
    case 'text':
      return field.placeholder || 'Texte exemple';
    case 'textarea':
      return field.placeholder || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
    case 'number':
      return field.min ?? 42;
    case 'date':
      return '2025-01-15';
    case 'datetime':
      return '2025-01-15T14:30';
    case 'select':
    case 'radio':
      return field.options?.[0]?.value ?? '';
    case 'multiselect':
      return field.options?.slice(0, 2).map((o) => o.value) ?? [];
    case 'checkbox':
      return true;
    case 'rating':
      return Math.ceil((field.ratingConfig?.scale ?? 5) / 2);
    case 'slider':
      const sliderMin = field.sliderConfig?.min ?? 0;
      const sliderMax = field.sliderConfig?.max ?? 100;
      return Math.round((sliderMin + sliderMax) / 2);
    case 'employee':
    case 'multiemployee':
      return 'emp-sample-123';
    case 'file':
      return null;
    case 'rich_text':
      return '<p>Texte <strong>enrichi</strong> exemple</p>';
    default:
      return null;
  }
}

// Field renderer
function PreviewField({
  field,
  value,
  showValidation,
  isSelected,
  onClick,
}: {
  field: FormFieldDefinition;
  value: unknown;
  showValidation: boolean;
  isSelected: boolean;
  onClick?: () => void;
}) {
  const hasError = showValidation && field.required && !value;

  // Render based on field type
  const renderField = () => {
    switch (field.type) {
      case 'heading':
        return (
          <h3 className="text-lg font-semibold text-foreground">
            {field.label}
          </h3>
        );

      case 'paragraph':
        return (
          <p className="text-sm text-muted-foreground">
            {field.helpText || field.label}
          </p>
        );

      case 'text':
        return (
          <Input
            type="text"
            placeholder={field.placeholder || field.label}
            defaultValue={value as string}
            disabled
            className="bg-background"
          />
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={field.placeholder || field.label}
            defaultValue={value as string}
            disabled
            className="bg-background min-h-[100px]"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder || '0'}
            defaultValue={value as number}
            disabled
            className="bg-background"
          />
        );

      case 'date':
        return (
          <div className="relative">
            <Input
              type="text"
              placeholder="JJ/MM/AAAA"
              defaultValue={value as string}
              disabled
              className="bg-background pl-10"
            />
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        );

      case 'datetime':
        return (
          <div className="relative">
            <Input
              type="text"
              placeholder="JJ/MM/AAAA HH:MM"
              defaultValue={value as string}
              disabled
              className="bg-background pl-10"
            />
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        );

      case 'select':
        return (
          <Select disabled defaultValue={value as string}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder={field.placeholder || 'Sélectionner...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${field.id}-${opt.value}`}
                  checked={(value as string[])?.includes(opt.value)}
                  disabled
                />
                <Label htmlFor={`${field.id}-${opt.value}`} className="text-sm">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'radio':
        return (
          <RadioGroup disabled defaultValue={value as string}>
            {field.options?.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                <Label htmlFor={`${field.id}-${opt.value}`} className="text-sm">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.id}
              checked={value as boolean}
              disabled
            />
            <Label htmlFor={field.id} className="text-sm">
              {field.label}
            </Label>
          </div>
        );

      case 'rating':
        const maxRating = field.ratingConfig?.scale ?? 5;
        const currentRating = value as number;
        return (
          <div className="space-y-2">
            <div className="flex gap-1">
              {Array.from({ length: maxRating }, (_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-6 w-6 cursor-pointer transition-colors',
                    i < currentRating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  )}
                />
              ))}
            </div>
            {(field.ratingConfig?.lowLabel || field.ratingConfig?.highLabel) && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{field.ratingConfig?.lowLabel || '1'}</span>
                <span>{field.ratingConfig?.highLabel || maxRating}</span>
              </div>
            )}
          </div>
        );

      case 'slider':
        const sliderMin = field.sliderConfig?.min ?? 0;
        const sliderMax = field.sliderConfig?.max ?? 100;
        const sliderStep = field.sliderConfig?.step ?? 1;
        return (
          <div className="space-y-4">
            <Slider
              defaultValue={[value as number]}
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              disabled
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{sliderMin}{field.sliderConfig?.unit || ''}</span>
              <span className="font-medium text-foreground">{String(value)}</span>
              <span>{sliderMax}{field.sliderConfig?.unit || ''}</span>
            </div>
          </div>
        );

      case 'employee':
      case 'multiemployee':
        return (
          <div className="relative">
            <Input
              type="text"
              placeholder="Rechercher un employé..."
              disabled
              className="bg-background pl-10"
            />
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        );

      case 'file':
        return (
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {field.placeholder || 'Glissez un fichier ou cliquez pour sélectionner'}
            </p>
          </div>
        );

      case 'rich_text':
        return (
          <div className="border rounded-lg p-3 min-h-[120px] bg-background">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: value as string }}
            />
          </div>
        );

      case 'computed':
        return (
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Valeur calculée</p>
            <p className="text-2xl font-bold">{field.computedConfig?.formula || '—'}</p>
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground italic">
            Type non supporté: {field.type}
          </div>
        );
    }
  };

  // Layout fields (heading, paragraph) don't need wrapper
  if (field.type === 'heading' || field.type === 'paragraph') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'py-2 px-1 rounded transition-all cursor-pointer',
          isSelected && 'ring-2 ring-primary ring-offset-2',
          !isSelected && 'hover:bg-muted/50'
        )}
      >
        {renderField()}
      </div>
    );
  }

  // Checkbox has integrated label
  if (field.type === 'checkbox') {
    return (
      <div
        onClick={onClick}
        className={cn(
          'py-3 px-1 rounded transition-all cursor-pointer',
          isSelected && 'ring-2 ring-primary ring-offset-2',
          !isSelected && 'hover:bg-muted/50'
        )}
      >
        {renderField()}
        {field.helpText && (
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {field.helpText}
          </p>
        )}
        {hasError && (
          <p className="text-xs text-destructive mt-1 ml-6 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Ce champ est requis
          </p>
        )}
      </div>
    );
  }

  // Standard field with label
  return (
    <div
      onClick={onClick}
      className={cn(
        'space-y-2 py-3 px-1 rounded transition-all cursor-pointer',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        !isSelected && 'hover:bg-muted/50'
      )}
    >
      <Label className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {hasError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Ce champ est requis
        </p>
      )}
    </div>
  );
}

export function FormPreview({
  title = 'Aperçu du formulaire',
  description,
  fields,
  showSampleData: initialShowSample = false,
  showValidation: initialShowValidation = false,
  selectedFieldId,
  onFieldClick,
  className,
}: FormPreviewProps) {
  const [device, setDevice] = useState<DeviceSize>('desktop');
  const [showSampleData, setShowSampleData] = useState(initialShowSample);
  const [showValidation, setShowValidation] = useState(initialShowValidation);

  // Generate sample values
  const sampleValues = showSampleData
    ? fields.reduce((acc, field) => {
        acc[field.id] = getSampleValue(field);
        return acc;
      }, {} as Record<string, unknown>)
    : {};

  // Group fields by section
  const sections: { title?: string; fields: FormFieldDefinition[] }[] = [];
  let currentSection: FormFieldDefinition[] = [];

  fields.forEach((field) => {
    if (field.type === 'heading' && currentSection.length > 0) {
      sections.push({ fields: currentSection });
      currentSection = [field];
    } else {
      currentSection.push(field);
    }
  });

  if (currentSection.length > 0) {
    sections.push({ fields: currentSection });
  }

  const DeviceIcon = deviceSizes[device].icon;

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Aperçu</CardTitle>
            <CardDescription>
              Prévisualisation du formulaire
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <DeviceIcon className="h-3 w-3" />
            {deviceSizes[device].width}px
          </Badge>
        </div>

        {/* Device toggles */}
        <div className="flex items-center justify-between gap-4">
          <Tabs value={device} onValueChange={(v) => setDevice(v as DeviceSize)}>
            <TabsList className="h-9">
              {Object.entries(deviceSizes).map(([key, { label, icon: Icon }]) => (
                <TabsTrigger key={key} value={key} className="gap-1 px-3">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-1">
            <Button
              variant={showSampleData ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowSampleData(!showSampleData)}
              className="gap-1"
            >
              {showSampleData ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Données</span>
            </Button>
            <Button
              variant={showValidation ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowValidation(!showValidation)}
              className="gap-1"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Validation</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <div className="h-full flex justify-center bg-muted/30 p-4">
          {/* Preview container with device width */}
          <div
            className="bg-background rounded-lg shadow-sm border overflow-hidden transition-all duration-300"
            style={{
              width: `min(${deviceSizes[device].width}px, 100%)`,
              maxWidth: '100%',
            }}
          >
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="p-6 space-y-6">
                {/* Form header */}
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">{title}</h2>
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>

                {/* Empty state */}
                {fields.length === 0 && (
                  <div className="py-12 text-center border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">
                      Glissez des champs depuis la palette
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      pour construire votre formulaire
                    </p>
                  </div>
                )}

                {/* Form fields */}
                {sections.map((section, sectionIdx) => (
                  <div key={sectionIdx} className="space-y-4">
                    {section.fields.map((field) => (
                      <PreviewField
                        key={field.id}
                        field={field}
                        value={sampleValues[field.id]}
                        showValidation={showValidation}
                        isSelected={selectedFieldId === field.id}
                        onClick={() => onFieldClick?.(field.id)}
                      />
                    ))}
                  </div>
                ))}

                {/* Submit button preview */}
                {fields.length > 0 && (
                  <div className="pt-4 border-t">
                    <Button className="w-full" disabled>
                      Soumettre
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FormPreview;
