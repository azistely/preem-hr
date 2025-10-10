/**
 * Formula History Component
 *
 * Displays version history of a salary component's formula
 * Shows timeline of changes, who made them, and why
 *
 * Used for:
 * - Audit compliance (tracking formula changes)
 * - Understanding formula evolution
 * - Comparing different versions
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, User, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CalculationRule } from '@/features/employees/types/salary-components';

// ============================================================================
// Types
// ============================================================================

export interface FormulaVersion {
  id: string;
  versionNumber: number;
  calculationRule: CalculationRule | null | undefined;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null;
  changedBy: string | null;
  changeReason: string | null;
  createdAt: string;
}

export interface FormulaHistoryProps {
  versions: FormulaVersion[];
  currentVersionNumber?: number;
  loading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function FormulaHistory({ versions, currentVersionNumber, loading }: FormulaHistoryProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

  const toggleVersion = (versionNumber: number) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionNumber)) {
      newExpanded.delete(versionNumber);
    } else {
      newExpanded.add(versionNumber);
    }
    setExpandedVersions(newExpanded);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des modifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Chargement de l'historique...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des modifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Aucune modification enregistrée pour ce composant.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Historique des modifications</CardTitle>
        <CardDescription>
          Suivi des changements de formule pour la conformité et l'audit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {versions.map((version) => {
          const isExpanded = expandedVersions.has(version.versionNumber);
          const isCurrent = version.versionNumber === currentVersionNumber;
          const isActive = version.effectiveTo === null;

          return (
            <Collapsible
              key={version.id}
              open={isExpanded}
              onOpenChange={() => toggleVersion(version.versionNumber)}
            >
              <div
                className={`border rounded-lg p-4 ${
                  isCurrent ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                {/* Version Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">Version {version.versionNumber}</h4>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">
                          Version actuelle
                        </Badge>
                      )}
                      {isActive && !isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Du {formatDate(version.effectiveFrom)}
                        {version.effectiveTo ? ` au ${formatDate(version.effectiveTo)}` : ' à aujourd\'hui'}
                      </span>
                    </div>

                    {/* Change Reason */}
                    {version.changeReason && (
                      <p className="text-sm text-muted-foreground italic mb-2">
                        "{version.changeReason}"
                      </p>
                    )}

                    {/* Formula Summary */}
                    <div className="text-sm font-mono bg-muted p-2 rounded">
                      {formatFormulaSummary(version.calculationRule)}
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                {/* Expanded Details */}
                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t space-y-3">
                    {/* Changed By */}
                    {version.changedBy && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Modifié par:</span>
                        <span className="font-medium">{version.changedBy}</span>
                      </div>
                    )}

                    {/* Created Date */}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Créé le:</span>
                      <span className="font-medium">{formatDateTime(version.createdAt)}</span>
                    </div>

                    {/* Full Formula Details */}
                    <div className="bg-muted p-3 rounded space-y-2">
                      <p className="text-sm font-semibold">Détails de la formule:</p>
                      {formatFormulaDetails(version.calculationRule)}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFormulaSummary(rule: CalculationRule | null | undefined): string {
  if (!rule) return 'Aucune formule définie';

  if (rule.type === 'fixed') {
    return `Montant fixe: ${(rule.baseAmount || 0).toLocaleString('fr-FR')} FCFA`;
  }

  if (rule.type === 'percentage') {
    const percentage = ((rule.rate || 0) * 100).toFixed(1);
    return `${percentage}% du salaire de base`;
  }

  if (rule.type === 'auto-calculated') {
    const ratePerYear = ((rule.rate || 0) * 100).toFixed(1);
    const maxRate = ((rule.cap || 0) * 100).toFixed(0);
    return `${ratePerYear}% par an, plafonné à ${maxRate}%`;
  }

  return 'Formule inconnue';
}

function formatFormulaDetails(rule: CalculationRule | null | undefined) {
  if (!rule) {
    return <p className="text-sm text-muted-foreground">Aucune formule définie</p>;
  }

  if (rule.type === 'fixed') {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type:</span>
          <span className="font-medium">Montant fixe</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Montant:</span>
          <span className="font-medium">{(rule.baseAmount || 0).toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
    );
  }

  if (rule.type === 'percentage') {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type:</span>
          <span className="font-medium">Pourcentage</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taux:</span>
          <span className="font-medium">{((rule.rate || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  if (rule.type === 'auto-calculated') {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Type:</span>
          <span className="font-medium">Auto-calculé</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taux par an:</span>
          <span className="font-medium">{((rule.rate || 0) * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Plafond:</span>
          <span className="font-medium">{((rule.cap || 0) * 100).toFixed(0)}%</span>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Type de formule inconnu</p>;
}
