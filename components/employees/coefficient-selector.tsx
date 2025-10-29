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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Get tenant data to fetch CGECI sector
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const cgeciSectorCode = tenant?.cgeciSectorCode;

  // Fetch categories filtered by tenant's CGECI sector
  const { data: categories, isLoading } = trpc.cgeci.getCategoriesBySector.useQuery(
    {
      sectorCode: cgeciSectorCode || '',
      countryCode,
    },
    { enabled: !!cgeciSectorCode }
  );

  // Find current category by ID or by coefficient
  const currentCategory = categories?.find((cat) =>
    selectedCategoryId
      ? cat.id === selectedCategoryId
      : selectedCoefficient >= cat.minCoefficient && selectedCoefficient <= cat.maxCoefficient
  );

  // Set initial category ID when categories load
  useEffect(() => {
    if (categories && !selectedCategoryId) {
      const initialCategory = categories.find(
        (cat) => selectedCoefficient >= cat.minCoefficient && selectedCoefficient <= cat.maxCoefficient
      );
      if (initialCategory) {
        setSelectedCategoryId(initialCategory.id);
      }
    }
  }, [categories, selectedCoefficient, selectedCategoryId]);

  // Validate selected coefficient (only if sector is configured)
  const { data: validation } = trpc.employeeCategories.validateCoefficient.useQuery(
    {
      coefficient: selectedCoefficient,
      countryCode,
    },
    {
      enabled: selectedCoefficient > 0 && !!cgeciSectorCode,
    }
  );

  // Update parent when coefficient changes
  useEffect(() => {
    onChange(selectedCoefficient);
  }, [selectedCoefficient, onChange]);

  if (isLoading) {
    return (
      <div className={className}>
        <Label>Catégorie professionnelle</Label>
        <Skeleton className="h-12 w-full mt-2" />
      </div>
    );
  }

  // Show helpful message if sector is not configured
  if (!cgeciSectorCode) {
    return (
      <div className={className}>
        <Label>Catégorie professionnelle</Label>
        <Alert className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Veuillez d'abord configurer le secteur d'activité de votre entreprise dans les paramètres.
            Les catégories professionnelles dépendent de votre secteur CGECI.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show message if no categories found for sector
  if (!categories || categories.length === 0) {
    return (
      <div className={className}>
        <Label>Catégorie professionnelle</Label>
        <Alert className="mt-2">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Aucune catégorie disponible pour le secteur configuré ({cgeciSectorCode}).
          </AlertDescription>
        </Alert>
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
        value={selectedCategoryId || undefined}
        onValueChange={(categoryId) => {
          setSelectedCategoryId(categoryId);
          const category = categories?.find((cat) => cat.id === categoryId);
          if (category) {
            setSelectedCoefficient(category.minCoefficient);
          }
        }}
      >
        <SelectTrigger id="coefficient" className="min-h-[48px]">
          <SelectValue placeholder="Sélectionnez une catégorie" />
        </SelectTrigger>
        <SelectContent>
          {categories?.map((category) => (
            <SelectItem
              key={category.id}
              value={category.id}
              className="py-2"
            >
              {/* Simplified: Only show category label and code */}
              <div className="flex items-center gap-2">
                <span className="font-medium">{category.labelFr}</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {category.category}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Immediate Feedback: Show category info after selection */}
      {currentCategory && (
        <div className="mt-3 space-y-3">
          {/* Coefficient Range - Show prominently */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">
              Coefficient: {currentCategory.minCoefficient} - {currentCategory.maxCoefficient}
            </p>
          </div>

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
