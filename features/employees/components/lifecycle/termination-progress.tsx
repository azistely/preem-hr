/**
 * Termination Progress Component
 *
 * Displays real-time progress for termination processing (STC + documents).
 * Designed for West African 3G connections - shows meaningful feedback
 * even when the connection is unreliable.
 *
 * Features:
 * - Progress bar with percentage
 * - Current step indicator (French labels)
 * - Estimated time remaining
 * - Offline mode indicator
 * - STC results preview (when available)
 * - Document generation status
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
  FileText,
  Calculator,
  Euro,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TerminationProgressProps {
  /** Current status */
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Current processing step (French label) */
  currentStep: string | null;
  /** Whether the user is currently online */
  isOnline: boolean;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number | null;
  /** Format time remaining for display */
  formatTimeRemaining?: (seconds: number | null) => string;
  /** Error message if failed */
  error?: string | null;
  /** STC results (if calculated) */
  stcResults?: {
    severancePay: number;
    vacationPayout: number;
    gratification: number;
    proratedSalary: number;
    noticePayment: number;
    grossTotal: number;
    netTotal: number;
  } | null;
  /** Document IDs (if generated) */
  documents?: {
    workCertificateId: string | null;
    finalPayslipId: string | null;
    cnpsAttestationId: string | null;
  };
  /** Optional className */
  className?: string;
}

export function TerminationProgress({
  status,
  percentComplete,
  currentStep,
  isOnline,
  estimatedTimeRemaining,
  formatTimeRemaining = (s) => (s ? `${s}s` : ''),
  error,
  stcResults,
  documents,
  className,
}: TerminationProgressProps) {
  const [showSTCDetails, setShowSTCDetails] = useState(false);

  const isIdle = status === 'idle';
  const isPending = status === 'pending';
  const isProcessing = status === 'processing';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  // Don't render anything if idle
  if (isIdle) {
    return null;
  }

  // Count generated documents
  const documentsGenerated = [
    documents?.workCertificateId,
    documents?.finalPayslipId,
    documents?.cnpsAttestationId,
  ].filter(Boolean).length;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isPending && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Démarrage du traitement...</span>
            </>
          )}
          {isProcessing && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Traitement en cours...</span>
            </>
          )}
          {isCompleted && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Traitement terminé</span>
            </>
          )}
          {isFailed && (
            <>
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span>Traitement échoué</span>
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
              {currentStep || 'En attente...'}
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
        {!isOnline && (isPending || isProcessing) && (
          <Alert variant="default" className="border-orange-200 bg-orange-50">
            <WifiOff className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Connexion perdue. Le traitement continue en arrière-plan.
              Vous serez notifié une fois le traitement terminé.
            </AlertDescription>
          </Alert>
        )}

        {/* STC Results Preview (when available) */}
        {stcResults && (
          <Collapsible open={showSTCDetails} onOpenChange={setShowSTCDetails}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between text-primary hover:text-primary"
              >
                <span className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  STC calculé: {stcResults.netTotal.toLocaleString('fr-FR')} FCFA
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    showSTCDetails && 'rotate-180'
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Salaire proratisé</span>
                  <span className="font-medium">{stcResults.proratedSalary.toLocaleString('fr-FR')} FCFA</span>
                </div>
                {stcResults.severancePay > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Indemnité de licenciement</span>
                    <span className="font-medium">{stcResults.severancePay.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                {stcResults.vacationPayout > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Congés payés</span>
                    <span className="font-medium">{stcResults.vacationPayout.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                {stcResults.gratification > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Gratification</span>
                    <span className="font-medium">{stcResults.gratification.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                {stcResults.noticePayment > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Indemnité de préavis</span>
                    <span className="font-medium">{stcResults.noticePayment.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-sm font-medium">
                  <span>Total brut</span>
                  <span>{stcResults.grossTotal.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary">
                  <span>Net à payer</span>
                  <span>{stcResults.netTotal.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Document Generation Status */}
        {(isProcessing || isCompleted) && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            <span className="text-muted-foreground">
              Documents générés: {documentsGenerated}/3
            </span>
            {documentsGenerated === 3 && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
        )}

        {/* Success message */}
        {isCompleted && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Tous les calculs et documents ont été générés avec succès.
              L&apos;employé peut recevoir son solde de tout compte.
            </AlertDescription>
          </Alert>
        )}

        {/* Failed message */}
        {isFailed && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Le traitement a échoué. {error || 'Veuillez réessayer.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
