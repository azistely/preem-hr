/**
 * Calculation Progress Component
 *
 * Displays real-time progress for payroll calculations.
 * Designed for West African 3G connections - shows meaningful feedback
 * even when the connection is unreliable.
 *
 * Features:
 * - Progress bar with percentage
 * - Employee count (processed/total)
 * - Estimated time remaining
 * - Offline mode indicator
 * - Error count with expandable details
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  ChevronDown,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalculationProgressProps {
  /** Current status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Number of employees processed */
  processedCount: number;
  /** Total number of employees */
  totalEmployees: number;
  /** Number of errors encountered */
  errorCount: number;
  /** Error details */
  errors?: Array<{ employeeId: string; message: string }>;
  /** Whether the user is currently online */
  isOnline: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number | null;
  /** Format time remaining for display */
  formatTimeRemaining?: (seconds: number | null) => string;
  /** Last error message */
  lastError?: string | null;
  /** Optional className */
  className?: string;
}

export function CalculationProgress({
  status,
  percentComplete,
  processedCount,
  totalEmployees,
  errorCount,
  errors = [],
  isOnline,
  estimatedTimeRemaining,
  formatTimeRemaining = (s) => (s ? `${s}s` : ''),
  lastError,
  className,
}: CalculationProgressProps) {
  const [showErrors, setShowErrors] = useState(false);

  const isProcessing = status === 'processing';
  const isPending = status === 'pending';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isPending && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Démarrage du calcul...</span>
            </>
          )}
          {isProcessing && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Calcul en cours...</span>
            </>
          )}
          {isCompleted && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Calcul terminé</span>
            </>
          )}
          {isFailed && (
            <>
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span>Calcul échoué</span>
            </>
          )}
          {status === 'paused' && (
            <>
              <Clock className="h-5 w-5 text-orange-500" />
              <span>Calcul en pause</span>
            </>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={percentComplete} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {totalEmployees > 0 ? (
                <>
                  {processedCount.toLocaleString('fr-FR')} / {totalEmployees.toLocaleString('fr-FR')} employés
                </>
              ) : (
                <span className="text-muted-foreground">Chargement des employés...</span>
              )}
            </span>
            <span className="font-medium">{percentComplete}%</span>
          </div>
        </div>

        {/* Estimated time remaining */}
        {isProcessing && estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Temps restant estimé: {formatTimeRemaining(estimatedTimeRemaining)}</span>
          </div>
        )}

        {/* Offline warning */}
        {!isOnline && isProcessing && (
          <Alert variant="default" className="border-orange-200 bg-orange-50">
            <WifiOff className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Connexion perdue. Le calcul continue en arrière-plan.
              Vous serez notifié une fois le calcul terminé.
            </AlertDescription>
          </Alert>
        )}

        {/* Error summary */}
        {errorCount > 0 && (
          <Collapsible open={showErrors} onOpenChange={setShowErrors}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between text-destructive hover:text-destructive"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {errorCount} erreur{errorCount > 1 ? 's' : ''} rencontrée{errorCount > 1 ? 's' : ''}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showErrors && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{err.employeeId}:</span>{' '}
                        {err.message}
                      </div>
                    ))}
                    {errors.length > 5 && (
                      <div className="text-sm text-muted-foreground">
                        ... et {errors.length - 5} autres erreurs
                      </div>
                    )}
                    {lastError && errors.length === 0 && (
                      <div className="text-sm">{lastError}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Success message */}
        {isCompleted && errorCount === 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Tous les salaires ont été calculés avec succès.
            </AlertDescription>
          </Alert>
        )}

        {/* Completed with errors */}
        {isCompleted && errorCount > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Calcul terminé avec {errorCount} erreur{errorCount > 1 ? 's' : ''}.
              Vérifiez les employés concernés avant d&apos;approuver.
            </AlertDescription>
          </Alert>
        )}

        {/* Failed message */}
        {isFailed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Le calcul a échoué. {lastError || 'Veuillez réessayer.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
