/**
 * Dynamic Field Editor
 *
 * Automatically selects the correct widget based on:
 * - Field type (percentage, amount, enum)
 * - Compliance level (locked, configurable, freeform)
 * - Presence of legal bounds
 *
 * See: /docs/SALARY-COMPONENTS-UI-WIDGETS-GUIDE.md
 */

import { Control, FieldValues, Path } from 'react-hook-form';
import { FormField } from '@/components/ui/form';
import { RateSlider } from './rate-slider';
import { AmountSlider } from './amount-slider';
import { InputNumber } from './input-number';
import { InputPercentage } from './input-percentage';
import { ReadOnlyField } from './read-only-field';

interface LegalBounds {
  min: number;
  max: number;
  recommended: number;
  legalReference?: string;
}

interface FieldConfig {
  fieldPath: string; // e.g., "calculationRule.rate"
  fieldType: 'percentage' | 'amount' | 'enum' | 'boolean';
  complianceLevel: 'locked' | 'configurable' | 'freeform';
  legalBounds?: LegalBounds;
  label: string;
  description?: string;
  placeholder?: string;
}

interface DynamicFieldEditorProps<T extends FieldValues> {
  control: Control<T>;
  fieldName: Path<T>;
  config: FieldConfig;
  currentValue: any;
  isCustomizable: boolean;
}

export function DynamicFieldEditor<T extends FieldValues>({
  control,
  fieldName,
  config,
  currentValue,
  isCustomizable,
}: DynamicFieldEditorProps<T>) {
  // If field is locked (not in customizableFields), show read-only
  if (!isCustomizable) {
    return (
      <ReadOnlyField
        label={config.label}
        value={currentValue}
        description={config.description}
        reason={config.legalBounds?.legalReference || "Défini par la loi"}
      />
    );
  }

  // CASE 1: Configurable percentage with legal bounds → RateSlider
  if (
    config.complianceLevel === 'configurable' &&
    config.fieldType === 'percentage' &&
    config.legalBounds
  ) {
    return (
      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <RateSlider
            value={field.value || config.legalBounds!.recommended}
            onChange={field.onChange}
            min={config.legalBounds!.min}
            max={config.legalBounds!.max}
            recommended={config.legalBounds!.recommended}
            label={config.label}
            description={config.description}
            legalReference={config.legalBounds!.legalReference}
          />
        )}
      />
    );
  }

  // CASE 2: Configurable amount with legal bounds → AmountSlider
  if (
    config.complianceLevel === 'configurable' &&
    config.fieldType === 'amount' &&
    config.legalBounds
  ) {
    return (
      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <AmountSlider
            value={field.value || config.legalBounds!.recommended}
            onChange={field.onChange}
            min={config.legalBounds!.min}
            max={config.legalBounds!.max}
            recommended={config.legalBounds!.recommended}
            label={config.label}
            description={config.description}
            legalReference={config.legalBounds!.legalReference}
          />
        )}
      />
    );
  }

  // CASE 3: Freeform percentage → InputPercentage
  if (config.fieldType === 'percentage' && config.complianceLevel === 'freeform') {
    return (
      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <InputPercentage
            value={field.value}
            onChange={field.onChange}
            label={config.label}
            description={config.description}
            placeholder={config.placeholder}
          />
        )}
      />
    );
  }

  // CASE 4: Freeform amount → InputNumber
  if (config.fieldType === 'amount' && config.complianceLevel === 'freeform') {
    return (
      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <InputNumber
            value={field.value}
            onChange={field.onChange}
            label={config.label}
            description={config.description}
            placeholder={config.placeholder}
          />
        )}
      />
    );
  }

  // Fallback: InputNumber for amounts, InputPercentage for rates
  if (config.fieldType === 'percentage') {
    return (
      <FormField
        control={control}
        name={fieldName}
        render={({ field }) => (
          <InputPercentage
            value={field.value}
            onChange={field.onChange}
            label={config.label}
            description={config.description}
            placeholder={config.placeholder}
          />
        )}
      />
    );
  }

  return (
    <FormField
      control={control}
      name={fieldName}
      render={({ field }) => (
        <InputNumber
          value={field.value}
          onChange={field.onChange}
          label={config.label}
          description={config.description}
          placeholder={config.placeholder}
        />
      )}
    />
  );
}
