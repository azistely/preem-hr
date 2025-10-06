/**
 * Formula Builder Component
 *
 * Visual form for creating/editing calculation rules in component metadata
 * Supports: Fixed Amount, Percentage, Auto-Calculated formulas
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import type { CIComponentMetadata } from '@/features/employees/types/salary-components';

export interface FormulaBuilderProps {
  metadata: CIComponentMetadata;
  onChange: (metadata: CIComponentMetadata) => void;
}

export function FormulaBuilder({ metadata, onChange }: FormulaBuilderProps) {
  const calculationType = metadata.calculationRule?.type || 'fixed';

  const handleTypeChange = (newType: 'fixed' | 'percentage' | 'auto-calculated') => {
    const updatedMetadata: CIComponentMetadata = {
      ...metadata,
      calculationRule: {
        type: newType,
        // Set sensible defaults based on type
        ...(newType === 'fixed' && { baseAmount: 0 }),
        ...(newType === 'percentage' && { rate: 0.10 }), // 10%
        ...(newType === 'auto-calculated' && { rate: 0.02, cap: 0.25 }), // Seniority defaults
      },
    };
    onChange(updatedMetadata);
  };

  const handleFieldChange = (field: string, value: number | undefined) => {
    const updatedMetadata: CIComponentMetadata = {
      ...metadata,
      calculationRule: {
        ...metadata.calculationRule!,
        [field]: value,
      },
    };
    onChange(updatedMetadata);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Règle de calcul</CardTitle>
        <CardDescription>
          Configurez comment le montant de ce composant est calculé
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calculation Type Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Type de calcul *</label>
          <Select value={calculationType} onValueChange={handleTypeChange}>
            <SelectTrigger className="min-h-[48px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Montant fixe</SelectItem>
              <SelectItem value="percentage">Pourcentage du salaire de base</SelectItem>
              <SelectItem value="auto-calculated">Auto-calculé (formule)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fixed Amount Input */}
        {calculationType === 'fixed' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Montant fixe (FCFA)</label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={metadata.calculationRule?.baseAmount || 0}
              onChange={(e) =>
                handleFieldChange('baseAmount', parseFloat(e.target.value) || undefined)
              }
              placeholder="Ex: 25000"
              className="min-h-[48px]"
            />
            <p className="text-sm text-muted-foreground">
              Le même montant sera appliqué à tous les employés
            </p>
          </div>
        )}

        {/* Percentage Input */}
        {calculationType === 'percentage' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Pourcentage (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={((metadata.calculationRule?.rate || 0) * 100).toFixed(1)}
              onChange={(e) => handleFieldChange('rate', parseFloat(e.target.value) / 100 || 0)}
              placeholder="Ex: 10"
              className="min-h-[48px]"
            />
            <p className="text-sm text-muted-foreground">
              Exemple: 10% signifie 30,000 FCFA pour un salaire de base de 300,000 FCFA
            </p>
          </div>
        )}

        {/* Auto-Calculated Inputs */}
        {calculationType === 'auto-calculated' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Taux par année (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={((metadata.calculationRule?.rate || 0) * 100).toFixed(1)}
                onChange={(e) => handleFieldChange('rate', parseFloat(e.target.value) / 100 || 0)}
                placeholder="Ex: 2"
                className="min-h-[48px]"
              />
              <p className="text-sm text-muted-foreground">
                Augmentation du pourcentage par année de service
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Plafond maximum (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={((metadata.calculationRule?.cap || 0) * 100).toFixed(1)}
                onChange={(e) => handleFieldChange('cap', parseFloat(e.target.value) / 100 || 0)}
                placeholder="Ex: 25"
                className="min-h-[48px]"
              />
              <p className="text-sm text-muted-foreground">
                Le pourcentage ne pourra jamais dépasser ce plafond
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Exemple de formule auto-calculée:</strong>
                <br />
                Prime d'ancienneté = Salaire de base × (Années de service × 2%) [plafonné à 25%]
                <br />
                <br />
                Après 7 ans: 300,000 × 14% = 42,000 FCFA
                <br />
                Après 15 ans: 300,000 × 25% = 75,000 FCFA (plafonné)
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Help Text Based on Type */}
        {calculationType === 'fixed' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Montant fixe:</strong> Tous les employés avec ce composant recevront le même
              montant, quel que soit leur salaire de base.
              <br />
              <br />
              Cas d'usage: Prime de téléphone, indemnité de transport fixe, etc.
            </AlertDescription>
          </Alert>
        )}

        {calculationType === 'percentage' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Pourcentage:</strong> Le montant sera calculé comme un pourcentage du salaire
              de base de l'employé.
              <br />
              <br />
              Cas d'usage: Prime de logement (15% du salaire), prime de performance (10% du
              salaire), etc.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
