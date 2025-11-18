'use client';

/**
 * Employee Salary Advance Request Wizard
 *
 * HCI Principles Applied:
 * - Zero Learning Curve: 3-step wizard with clear visual progress
 * - Task-Oriented Design: "Demander une avance" not technical jargon
 * - Progressive Disclosure: One question at a time
 * - Smart Defaults: Pre-fill with max allowed amount
 * - Immediate Feedback: Real-time validation with French messages
 * - Error Prevention: Disable submit until all validations pass
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc as api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ChevronRight, ChevronLeft, Check, Info, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface RequestAdvanceWizardProps {
  employeeId: string;
  employeeName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type WizardStep = 'amount' | 'period' | 'reason' | 'review';

export function RequestAdvanceWizard({
  employeeId,
  employeeName,
  onSuccess,
  onCancel,
}: RequestAdvanceWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>('amount');

  // Get tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Form state
  const [requestedAmount, setRequestedAmount] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('3');
  const [requestReason, setRequestReason] = useState('');
  const [requestNotes, setRequestNotes] = useState('');

  // Get max allowed amount
  const { data: maxData, isLoading: isLoadingMax } =
    api.salaryAdvances.getMaxAllowedAmount.useQuery({
      employeeId,
    });

  // Get policy
  const { data: policy } = api.salaryAdvances.getPolicy.useQuery();

  // Quick validation
  const { data: validation, isLoading: isValidating } =
    api.salaryAdvances.quickValidate.useQuery(
      {
        employeeId,
        requestedAmount: parseFloat(requestedAmount) || 0,
        repaymentMonths: parseInt(repaymentMonths) || 1,
      },
      {
        enabled: requestedAmount !== '' && parseFloat(requestedAmount) > 0,
      }
    );

  // Create advance mutation
  const createAdvance = api.salaryAdvances.create.useMutation({
    onSuccess: () => {
      // Invalidate salary advances queries to refetch updated data
      utils.salaryAdvances.list.invalidate();
      utils.salaryAdvances.getEmployeeStats.invalidate({ employeeId });

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/employee/salary-advances');
      }
    },
  });

  const maxAmount = maxData?.maxAmount ?? 0;
  const amount = parseFloat(requestedAmount) || 0;

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 'amount') setCurrentStep('period');
    else if (currentStep === 'period') setCurrentStep('reason');
    else if (currentStep === 'reason') setCurrentStep('review');
  };

  const handleBack = () => {
    if (currentStep === 'review') setCurrentStep('reason');
    else if (currentStep === 'reason') setCurrentStep('period');
    else if (currentStep === 'period') setCurrentStep('amount');
  };

  const handleSubmit = async () => {
    try {
      await createAdvance.mutateAsync({
        employeeId,
        requestedAmount: parseFloat(requestedAmount),
        repaymentMonths: parseInt(repaymentMonths),
        requestReason,
        requestNotes: requestNotes || undefined,
      });
    } catch (error) {
      // Error is handled by mutation
    }
  };

  // Validation states
  const isAmountValid = amount > 0 && amount <= maxAmount && validation?.isValid !== false;
  const isReasonValid = requestReason.trim().length >= 10;
  const canProceedFromAmount = isAmountValid && !isValidating;
  const canProceedFromReason = isReasonValid;
  const canSubmit = isAmountValid && isReasonValid && !createAdvance.isPending;

  // Step progress
  const steps = ['amount', 'period', 'reason', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  if (isLoadingMax) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (maxAmount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Avance non disponible</CardTitle>
          <CardDescription>
            Vous n'êtes pas éligible pour une avance sur salaire pour le moment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Veuillez contacter les Ressources Humaines pour plus d'informations.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={onCancel} className="w-full">
            Fermer
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      {/* Progress bar */}
      <div className="h-2 w-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <CardHeader>
        <CardTitle>Demande d'avance sur salaire</CardTitle>
        <CardDescription>
          Étape {currentStepIndex + 1} sur {steps.length}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Amount */}
        {currentStep === 'amount' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Quel montant souhaitez-vous?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Montant maximum autorisé: {formatCurrency(maxAmount, 'FCFA')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount" className="text-base">
                Montant demandé (FCFA)
              </Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  max={maxAmount}
                  step="1000"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  className="text-2xl h-14 pr-20"
                  placeholder="0"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
                  FCFA
                </span>
              </div>

              {/* Quick amount buttons */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRequestedAmount(Math.round(maxAmount * 0.25).toString())}
                  className="min-h-[44px]"
                >
                  25%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRequestedAmount(Math.round(maxAmount * 0.5).toString())}
                  className="min-h-[44px]"
                >
                  50%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRequestedAmount(Math.round(maxAmount).toString())}
                  className="min-h-[44px]"
                >
                  Maximum
                </Button>
              </div>
            </div>

            {/* Real-time validation feedback */}
            {amount > 0 && amount > maxAmount && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Le montant demandé dépasse le maximum autorisé de{' '}
                  {formatCurrency(maxAmount, 'FCFA')}
                </AlertDescription>
              </Alert>
            )}

            {validation && !validation.isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {validation.message || 'Montant non valide'}
                </AlertDescription>
              </Alert>
            )}

            {amount > 0 && amount <= maxAmount && validation?.isValid && (
              <Alert>
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-600">
                  Montant valide! Vous pouvez continuer.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Repayment Period */}
        {currentStep === 'period' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Sur combien de mois souhaitez-vous rembourser?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Le remboursement sera déduit automatiquement de votre salaire mensuel
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="months" className="text-base">
                Période de remboursement
              </Label>
              <Select value={repaymentMonths} onValueChange={setRepaymentMonths}>
                <SelectTrigger id="months" className="h-14 text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {policy?.allowedRepaymentMonths?.map((months) => (
                    <SelectItem key={months} value={months.toString()} className="text-lg py-3">
                      {months} mois
                    </SelectItem>
                  )) ?? (
                    <>
                      <SelectItem value="1" className="text-lg py-3">
                        1 mois
                      </SelectItem>
                      <SelectItem value="2" className="text-lg py-3">
                        2 mois
                      </SelectItem>
                      <SelectItem value="3" className="text-lg py-3">
                        3 mois
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Preview monthly deduction */}
            {amount > 0 && (
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Déduction mensuelle:</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(Math.ceil(amount / parseInt(repaymentMonths)), 'FCFA')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Reason */}
        {currentStep === 'reason' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Pour quelle raison?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Expliquez brièvement pourquoi vous avez besoin de cette avance
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-base">
                Raison de la demande *
              </Label>
              <Textarea
                id="reason"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Ex: Frais médicaux urgents, scolarité des enfants, etc."
                className="min-h-[100px] text-base"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {requestReason.length}/500 caractères (minimum 10)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base">
                Notes additionnelles (optionnel)
              </Label>
              <Textarea
                id="notes"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Informations supplémentaires..."
                className="min-h-[80px] text-base"
                maxLength={1000}
              />
            </div>

            {requestReason.length < 10 && requestReason.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Veuillez fournir une raison d'au moins 10 caractères
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Vérifiez votre demande</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Assurez-vous que toutes les informations sont correctes avant de soumettre
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Montant demandé:</span>
                <span className="text-xl font-bold">{formatCurrency(amount, 'FCFA')}</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Période de remboursement:</span>
                <span className="text-xl font-bold">{repaymentMonths} mois</span>
              </div>

              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Déduction mensuelle:</span>
                <span className="text-xl font-bold">
                  {formatCurrency(Math.ceil(amount / parseInt(repaymentMonths)), 'FCFA')}
                </span>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Raison:</p>
                <p className="text-base">{requestReason}</p>
              </div>

              {requestNotes && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                  <p className="text-base">{requestNotes}</p>
                </div>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Votre demande sera envoyée aux Ressources Humaines pour approbation. Vous
                recevrez une notification une fois qu'elle aura été traitée.
              </AlertDescription>
            </Alert>

            {createAdvance.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {createAdvance.error?.message ?? 'Erreur lors de la création de la demande'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3">
        {currentStep !== 'amount' ? (
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={createAdvance.isPending}
            className="min-h-[48px]"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Précédent
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={createAdvance.isPending}
            className="min-h-[48px]"
          >
            Annuler
          </Button>
        )}

        {currentStep !== 'review' ? (
          <Button
            onClick={handleNext}
            disabled={
              (currentStep === 'amount' && !canProceedFromAmount) ||
              (currentStep === 'reason' && !canProceedFromReason)
            }
            className="min-h-[48px] ml-auto"
          >
            Suivant
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-h-[48px] ml-auto"
          >
            {createAdvance.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Soumettre la demande
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
