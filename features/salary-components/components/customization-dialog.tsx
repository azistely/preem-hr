/**
 * CustomizationDialog Component
 *
 * Dialog for customizing configurable salary component templates
 * Features:
 * - Legal range validation (housing 20-30%, transport ≤30k)
 * - Real-time compliance feedback
 * - Smart defaults from compliance rules
 * - Visual slider for percentage-based components
 */

'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Info, Check } from 'lucide-react';
import type { SalaryComponentTemplate } from '@/features/employees/types/salary-components';

interface CustomizationDialogProps {
  template: SalaryComponentTemplate;
  countryCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function CustomizationDialog({
  template,
  countryCode,
  open,
  onOpenChange,
  onComplete,
}: CustomizationDialogProps) {
  const name = (template.name as Record<string, string>).fr || 'Sans nom';
  const legalReference = (template as any).legalReference;
  const metadata = template.metadata as any;
  const calculationRule = metadata?.calculationRule;

  // Determine field type based on template
  const isPercentage = template.code.includes('HOUSING') || template.code.includes('HAZARD');
  const isAmount = template.code.includes('TRANSPORT');
  const fieldName = isPercentage ? 'rate' : 'baseAmount';

  // State
  const [value, setValue] = useState<number>(0);
  const [legalRange, setLegalRange] = useState<{
    min: number;
    max: number;
    recommended?: number;
  } | null>(null);

  // Fetch legal range
  const { data: rangeData } = trpc.salaryComponents.getLegalRange.useQuery(
    {
      templateCode: template.code,
      countryCode,
      field: fieldName,
    },
    { enabled: open }
  );

  // Validate customization in real-time
  const { data: validationResult, refetch: revalidate } =
    trpc.salaryComponents.validateCustomization.useQuery(
      {
        templateCode: template.code,
        countryCode,
        customizations: {
          metadata: {
            calculationRule: {
              ...calculationRule,
              [fieldName]: value,
            },
          },
        },
      },
      { enabled: false }
    );

  // Add from template mutation
  const addFromTemplate = trpc.salaryComponents.addFromTemplate.useMutation({
    onSuccess: () => {
      onComplete();
      onOpenChange(false);
    },
  });

  // Initialize value from legal range
  useEffect(() => {
    if (rangeData) {
      setLegalRange(rangeData);
      setValue(rangeData.recommended || rangeData.min);
    }
  }, [rangeData]);

  // Revalidate when value changes
  useEffect(() => {
    if (value > 0) {
      revalidate();
    }
  }, [value, revalidate]);

  const handleSubmit = () => {
    addFromTemplate.mutate({
      templateCode: template.code,
      customizations: {
        metadata: {
          calculationRule: {
            ...calculationRule,
            [fieldName]: value,
          },
        },
      },
    });
  };

  const hasViolations = validationResult && !validationResult.valid;
  const hasWarnings = validationResult?.warnings && validationResult.warnings.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            Configurez ce composant dans les limites fixées par la loi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Legal Reference */}
          {legalReference && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {legalReference}
              </AlertDescription>
            </Alert>
          )}

          {/* Percentage Input with Slider */}
          {isPercentage && legalRange && (
            <div className="space-y-4">
              <Label htmlFor="rate" className="text-base">
                Pourcentage
              </Label>
              <div className="space-y-4">
                <Slider
                  id="rate"
                  min={legalRange.min * 100}
                  max={legalRange.max * 100}
                  step={1}
                  value={[value * 100]}
                  onValueChange={([v]) => setValue(v / 100)}
                  className="py-4"
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{legalRange.min * 100}% min</span>
                  <span className="text-lg font-semibold text-foreground">
                    {(value * 100).toFixed(0)}%
                  </span>
                  <span>{legalRange.max * 100}% max</span>
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          {isAmount && legalRange && (
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base">
                Montant (FCFA)
              </Label>
              <Input
                id="amount"
                type="number"
                min={legalRange.min}
                max={legalRange.max}
                step={1000}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="min-h-[48px] text-lg"
              />
              <p className="text-sm text-muted-foreground">
                Maximum exonéré d'impôt: {legalRange.max.toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          )}

          {/* Validation Errors */}
          {hasViolations && validationResult.violations.map((violation, idx) => (
            <Alert key={idx} variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{violation.error}</AlertDescription>
            </Alert>
          ))}

          {/* Validation Warnings */}
          {hasWarnings && validationResult.warnings?.map((warning, idx) => (
            <Alert key={idx}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}

          {/* Success Message */}
          {validationResult?.valid && !hasWarnings && (
            <Alert>
              <Check className="h-4 w-4 text-success" />
              <AlertDescription>
                Configuration conforme à la Convention Collective
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={hasViolations || addFromTemplate.isPending}
            className="min-h-[48px]"
          >
            {addFromTemplate.isPending ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
