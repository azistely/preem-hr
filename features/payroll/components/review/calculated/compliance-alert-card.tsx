'use client';

/**
 * Compliance Alert Card Component
 *
 * Displays compliance warnings from payroll calculations:
 * - 10% cap violations on non-taxable components (CI)
 * - Other country-specific compliance issues
 *
 * Design: Progressive disclosure similar to ValidationAlertCard
 */

import { useState } from 'react';
import { AlertTriangle, Shield, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';

type ComplianceWarning = {
  field: string;
  message: string;
  severity: 'warning' | 'error';
  legalReference?: string;
};

interface ComplianceAlertCardProps {
  warnings: ComplianceWarning[];
  employeeId?: string;
  employeeName?: string;
}

export function ComplianceAlertCard({
  warnings,
  employeeId,
  employeeName,
}: ComplianceAlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const errors = warnings.filter((w) => w.severity === 'error');
  const warningsOnly = warnings.filter((w) => w.severity === 'warning');

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    }
  };

  if (warnings.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-orange-600" />
              <div>
                <CardTitle className="text-base">Alertes de Conformité</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {warnings.length} problème{warnings.length > 1 ? 's' : ''} de conformité détecté
                  {warnings.length > 1 ? 's' : ''}
                  {employeeName && ` pour ${employeeName}`}
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
                <Badge variant="destructive">
                  {errors.length} erreur{errors.length > 1 ? 's' : ''}
                </Badge>
              )}
              {warningsOnly.length > 0 && (
                <Badge variant="secondary">
                  {warningsOnly.length} avertissement{warningsOnly.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {/* Errors */}
            {errors.map((warning, idx) => (
              <Alert
                key={`error-${idx}`}
                className="border-destructive/50 bg-destructive/5"
              >
                <div className="flex items-start gap-3">
                  {getIcon(warning.severity)}
                  <div className="flex-1 space-y-1">
                    <AlertDescription className="text-sm">
                      {warning.message}
                    </AlertDescription>
                    {warning.legalReference && (
                      <div className="flex items-center gap-2 mt-2">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Référence légale: {warning.legalReference}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            ))}

            {/* Warnings */}
            {warningsOnly.map((warning, idx) => (
              <Alert
                key={`warning-${idx}`}
                className="border-orange-300/50 bg-orange-50/50"
              >
                <div className="flex items-start gap-3">
                  {getIcon(warning.severity)}
                  <div className="flex-1 space-y-1">
                    <AlertDescription className="text-sm">
                      {warning.message}
                    </AlertDescription>
                    {warning.legalReference && (
                      <div className="flex items-center gap-2 mt-2">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Référence légale: {warning.legalReference}
                        </span>
                      </div>
                    )}
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
