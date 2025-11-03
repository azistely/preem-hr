'use client';

/**
 * Validation Alert Card Component
 *
 * Displays automatic detection of potential calculation errors:
 * - Missing overtime calculations
 * - Unusual salary variances
 * - Prorata calculations
 * - Deduction anomalies
 * - Large bonuses
 *
 * Design: Progressive disclosure with collapsible sections
 */

import { useState } from 'react';
import { AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp, Eye, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';

type ValidationIssue = {
  type: 'error' | 'warning' | 'info';
  category: 'overtime' | 'comparison' | 'prorata' | 'deduction' | 'bonus';
  employeeId: string;
  employeeName: string;
  title: string;
  description: string;
  expected?: number;
  actual?: number;
};

interface ValidationAlertCardProps {
  runId: string;
  issues: ValidationIssue[];
  onViewDetails?: (employeeId: string) => void;
  onRecalculate?: (employeeId: string) => void;
  onMarkVerified?: (employeeId: string) => void;
}

export function ValidationAlertCard({
  runId,
  issues,
  onViewDetails,
  onRecalculate,
  onMarkVerified,
}: ValidationAlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');
  const infos = issues.filter((i) => i.type === 'info');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive' as const;
      case 'warning':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  if (issues.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Aucune alerte détectée</p>
              <p className="text-sm text-green-700">
                Tous les calculs semblent corrects
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <CardTitle className="text-base">Alertes de Validation</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {issues.length} point{issues.length > 1 ? 's' : ''} à vérifier
                </p>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="min-h-[44px]">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-4">
            <div className="flex gap-2 mb-4">
              {errors.length > 0 && (
                <Badge variant="destructive">{errors.length} erreur{errors.length > 1 ? 's' : ''}</Badge>
              )}
              {warnings.length > 0 && (
                <Badge variant="secondary">{warnings.length} avertissement{warnings.length > 1 ? 's' : ''}</Badge>
              )}
              {infos.length > 0 && (
                <Badge variant="outline">{infos.length} info{infos.length > 1 ? 's' : ''}</Badge>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Errors */}
            {errors.map((issue, idx) => (
              <Alert key={`error-${idx}`} className="border-destructive/50 bg-destructive/5">
                <div className="flex items-start gap-3">
                  {getIcon(issue.type)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{issue.employeeName}</p>
                        <p className="text-sm mt-1">{issue.title}</p>
                      </div>
                    </div>
                    <AlertDescription className="text-xs text-muted-foreground">
                      {issue.description}
                    </AlertDescription>
                    {issue.expected !== undefined && issue.actual !== undefined && (
                      <div className="text-xs space-y-0.5 mt-2">
                        <div>Attendu: <span className="font-medium">{formatCurrency(issue.expected)} FCFA</span></div>
                        <div>Calculé: <span className="font-medium">{formatCurrency(issue.actual)} FCFA</span></div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      {onViewDetails && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewDetails(issue.employeeId)}
                          className="min-h-[40px] text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Voir détails
                        </Button>
                      )}
                      {onRecalculate && (
                        <Button
                          size="sm"
                          onClick={() => onRecalculate(issue.employeeId)}
                          className="min-h-[40px] text-xs"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Recalculer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}

            {/* Warnings */}
            {warnings.map((issue, idx) => (
              <Alert key={`warning-${idx}`} className="border-orange-300/50 bg-orange-50/50">
                <div className="flex items-start gap-3">
                  {getIcon(issue.type)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{issue.employeeName}</p>
                        <p className="text-sm mt-1">{issue.title}</p>
                      </div>
                    </div>
                    <AlertDescription className="text-xs text-muted-foreground">
                      {issue.description}
                    </AlertDescription>
                    {issue.expected !== undefined && issue.actual !== undefined && (
                      <div className="text-xs space-y-0.5 mt-2">
                        <div>Mois dernier: <span className="font-medium">{formatCurrency(issue.expected)} FCFA</span></div>
                        <div>Ce mois-ci: <span className="font-medium">{formatCurrency(issue.actual)} FCFA</span></div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      {onViewDetails && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewDetails(issue.employeeId)}
                          className="min-h-[40px] text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Voir détails
                        </Button>
                      )}
                      {onMarkVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkVerified(issue.employeeId)}
                          className="min-h-[40px] text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Marquer vérifié
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}

            {/* Info */}
            {infos.map((issue, idx) => (
              <Alert key={`info-${idx}`} className="border-blue-200 bg-blue-50/30">
                <div className="flex items-start gap-3">
                  {getIcon(issue.type)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{issue.employeeName}</p>
                        <p className="text-sm mt-1">{issue.title}</p>
                      </div>
                    </div>
                    <AlertDescription className="text-xs text-muted-foreground">
                      {issue.description}
                    </AlertDescription>
                    {issue.actual !== undefined && (
                      <div className="text-xs mt-2">
                        Montant: <span className="font-medium">{formatCurrency(issue.actual)} FCFA</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      {onMarkVerified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkVerified(issue.employeeId)}
                          className="min-h-[40px] text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Marquer vérifié
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
