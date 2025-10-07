/**
 * Coefficient Selector Component
 *
 * HCI Principles Applied:
 * - Pattern 2: Smart Defaults (coefficient 100 pre-selected)
 * - Pattern 3: Error Prevention (validate on change)
 * - Pattern 5: Immediate Feedback (show category as user selects)
 * - Pattern 7: Country-Specific Labels ("Cadre" not "Category D")
 *
 * Convention Collective:
 * - Displays A1-F categories with friendly labels
 * - Shows coefficient ranges (90-115, 120-145, etc.)
 * - Includes job examples for each category
 */

'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Briefcase, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CoefficientSelectorProps {
  countryCode: string;
  value?: number;
  onChange: (coefficient: number) => void;
  showExamples?: boolean;
  className?: string;
}

export function CoefficientSelector({
  countryCode,
  value = 100, // Smart default: Category A1
  onChange,
  showExamples = true,
  className,
}: CoefficientSelectorProps) {
  const [selectedCoefficient, setSelectedCoefficient] = useState(value);

  // Fetch all categories for country
  const { data: categories, isLoading } = trpc.employeeCategories.getCategoriesByCountry.useQuery({
    countryCode,
  });

  // Validate selected coefficient
  const { data: validation } = trpc.employeeCategories.validateCoefficient.useQuery(
    {
      coefficient: selectedCoefficient,
      countryCode,
    },
    {
      enabled: selectedCoefficient > 0,
    }
  );

  // Update parent when value changes
  useEffect(() => {
    onChange(selectedCoefficient);
  }, [selectedCoefficient, onChange]);

  // Find current category
  const currentCategory = categories?.find(
    (cat) =>
      selectedCoefficient >= cat.minCoefficient &&
      selectedCoefficient <= cat.maxCoefficient
  );

  if (isLoading) {
    return (
      <div className={className}>
        <Label>Catégorie professionnelle</Label>
        <Skeleton className="h-12 w-full mt-2" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Label with helper text */}
      <div className="flex items-center justify-between mb-2">
        <Label htmlFor="coefficient" className="text-base">
          Catégorie professionnelle
        </Label>
        {currentCategory && (
          <Badge variant="secondary" className="gap-1">
            <Briefcase className="h-3 w-3" />
            {currentCategory.labelFr}
          </Badge>
        )}
      </div>

      {/* Category Selector */}
      <Select
        value={selectedCoefficient.toString()}
        onValueChange={(val) => setSelectedCoefficient(parseInt(val, 10))}
      >
        <SelectTrigger id="coefficient" className="min-h-[48px]">
          <SelectValue placeholder="Sélectionnez une catégorie" />
        </SelectTrigger>
        <SelectContent>
          {categories?.map((category) => (
            <SelectItem
              key={category.category}
              value={category.minCoefficient.toString()}
              className="min-h-[56px] py-3"
            >
              <div className="flex flex-col gap-1">
                {/* Primary: Category label */}
                <div className="flex items-center gap-2">
                  <span className="font-medium">{category.labelFr}</span>
                  <Badge variant="outline" className="text-xs">
                    {category.category}
                  </Badge>
                </div>

                {/* Secondary: Coefficient range */}
                <span className="text-sm text-muted-foreground">
                  Coefficient {category.minCoefficient}-{category.maxCoefficient}
                </span>

                {/* Tertiary: Examples (optional) */}
                {showExamples && category.notes && (
                  <span className="text-xs text-muted-foreground">
                    Ex: {category.notes}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Immediate Feedback: Show category info */}
      {currentCategory && (
        <div className="mt-3 space-y-2">
          {/* Notice Period Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">Préavis de licenciement:</span>{' '}
              {currentCategory.noticePeriodDays} jours
              {currentCategory.noticePeriodDays === 15 && ' (2 semaines)'}
              {currentCategory.noticePeriodDays === 30 && ' (1 mois)'}
              {currentCategory.noticePeriodDays === 90 && ' (3 mois)'}
            </AlertDescription>
          </Alert>

          {/* Examples */}
          {showExamples && currentCategory.notes && (
            <p className="text-sm text-muted-foreground">
              <strong>Exemples de postes:</strong> {currentCategory.notes}
            </p>
          )}
        </div>
      )}

      {/* Error Prevention: Warn if invalid coefficient */}
      {validation && !validation.valid && (
        <Alert variant="destructive" className="mt-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Ce coefficient ne correspond à aucune catégorie.{' '}
            {validation.suggestedCategory && (
              <span>
                Catégorie suggérée: <strong>{validation.suggestedCategory}</strong>
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Help Text */}
      <p className="text-sm text-muted-foreground mt-2">
        La catégorie détermine le préavis de licenciement et le salaire minimum selon
        la Convention Collective Interprofessionnelle.
      </p>
    </div>
  );
}
