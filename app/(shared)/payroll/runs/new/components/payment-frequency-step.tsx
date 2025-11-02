'use client';

/**
 * Payment Frequency Selection Step
 *
 * Allows user to select payment frequency for the payroll run:
 * - MONTHLY: Standard monthly workers (default)
 * - WEEKLY: Workers paid weekly (shows closure sequence 1-4)
 * - BIWEEKLY: Workers paid biweekly (shows closure sequence 1-2)
 * - DAILY: Workers paid daily (rare)
 *
 * HCI Principles:
 * - Smart defaults: Pre-selects MONTHLY (most common)
 * - Progressive disclosure: Only shows closure sequence for non-monthly
 * - Visual clarity: Large cards with icons and examples
 * - Error prevention: Validates closure sequence based on frequency
 */

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, Clock, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export type PaymentFrequency = 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'DAILY';

interface PaymentFrequencyStepProps {
  periodStart: Date;
  periodEnd: Date;
  paymentFrequency: PaymentFrequency;
  closureSequence: number | null;
  onPaymentFrequencyChange: (frequency: PaymentFrequency) => void;
  onClosureSequenceChange: (sequence: number | null) => void;
}

export function PaymentFrequencyStep({
  periodStart,
  periodEnd,
  paymentFrequency,
  closureSequence,
  onPaymentFrequencyChange,
  onClosureSequenceChange,
}: PaymentFrequencyStepProps) {
  // Reset closure sequence when switching to MONTHLY
  useEffect(() => {
    if (paymentFrequency === 'MONTHLY') {
      onClosureSequenceChange(null);
    }
  }, [paymentFrequency, onClosureSequenceChange]);

  // Smart defaults for non-monthly frequencies
  useEffect(() => {
    if (paymentFrequency === 'WEEKLY' && closureSequence === null) {
      onClosureSequenceChange(1); // Default to week 1
    } else if (paymentFrequency === 'BIWEEKLY' && closureSequence === null) {
      onClosureSequenceChange(1); // Default to quinzaine 1
    }
  }, [paymentFrequency, closureSequence, onClosureSequenceChange]);

  const frequencies: Array<{
    value: PaymentFrequency;
    label: string;
    description: string;
    icon: typeof Calendar;
    example: string;
  }> = [
    {
      value: 'MONTHLY',
      label: 'Mensuel',
      description: 'Paiement une fois par mois (le plus courant)',
      icon: Calendar,
      example: 'Ex: Paie du 1er au 31 janvier',
    },
    {
      value: 'WEEKLY',
      label: 'Hebdomadaire',
      description: 'Paiement chaque semaine (4 paies par mois)',
      icon: Clock,
      example: 'Ex: Semaine 1, 2, 3, 4 de janvier',
    },
    {
      value: 'BIWEEKLY',
      label: 'Quinzaine',
      description: 'Paiement deux fois par mois (1ère et 2ème quinzaine)',
      icon: Clock,
      example: 'Ex: 1-15 janvier, 16-31 janvier',
    },
    {
      value: 'DAILY',
      label: 'Journalier',
      description: 'Paiement quotidien (rare)',
      icon: Clock,
      example: 'Ex: Paie du 15 janvier',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Fréquence de paiement</AlertTitle>
        <AlertDescription>
          Sélectionnez la fréquence de paiement pour cette paie. Cela déterminera quels employés seront inclus
          et comment le livre de paie sera généré.
        </AlertDescription>
      </Alert>

      {/* Period Display */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="text-sm font-medium text-muted-foreground mb-1">Période sélectionnée</div>
          <div className="text-2xl font-bold">
            {format(periodStart, 'd MMM', { locale: fr })} - {format(periodEnd, 'd MMM yyyy', { locale: fr })}
          </div>
        </CardContent>
      </Card>

      {/* Payment Frequency Selection */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Fréquence de paiement</Label>

        <div className="grid gap-4">
          {frequencies.map((freq) => {
            const Icon = freq.icon;
            const isSelected = paymentFrequency === freq.value;

            return (
              <div
                key={freq.value}
                onClick={() => onPaymentFrequencyChange(freq.value)}
                className={`
                  relative flex cursor-pointer rounded-lg border-2 p-4 transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                  }
                `}
              >
                <div className="flex flex-1 items-start gap-4">
                  {/* Icon */}
                  <div className={`
                    rounded-full p-3
                    ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                  `}>
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg mb-1">{freq.label}</div>
                    <p className="text-sm text-muted-foreground mb-2">{freq.description}</p>
                    <p className="text-xs text-muted-foreground italic">{freq.example}</p>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <div className="h-3 w-3 rounded-full bg-white" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Closure Sequence Selection (only for WEEKLY and BIWEEKLY) */}
      {(paymentFrequency === 'WEEKLY' || paymentFrequency === 'BIWEEKLY') && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Quelle {paymentFrequency === 'WEEKLY' ? 'semaine' : 'quinzaine'} payez-vous ?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {paymentFrequency === 'WEEKLY'
                  ? 'Sélectionnez la semaine du mois pour cette paie (Semaine 1, 2, 3 ou 4)'
                  : 'Sélectionnez la quinzaine du mois pour cette paie (1ère ou 2ème quinzaine)'}
              </p>

              <div className="space-y-2">
                <Label htmlFor="closureSequence" className="text-base">
                  {paymentFrequency === 'WEEKLY' ? 'Semaine' : 'Quinzaine'}
                </Label>
                <Select
                  value={closureSequence?.toString() || ''}
                  onValueChange={(value) => onClosureSequenceChange(parseInt(value, 10))}
                >
                  <SelectTrigger id="closureSequence" className="min-h-[48px] text-base">
                    <SelectValue placeholder={`Sélectionnez la ${paymentFrequency === 'WEEKLY' ? 'semaine' : 'quinzaine'}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentFrequency === 'WEEKLY' ? (
                      <>
                        <SelectItem value="1">Semaine 1 (1er-7 du mois)</SelectItem>
                        <SelectItem value="2">Semaine 2 (8-14 du mois)</SelectItem>
                        <SelectItem value="3">Semaine 3 (15-21 du mois)</SelectItem>
                        <SelectItem value="4">Semaine 4 (22-fin du mois)</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="1">1ère quinzaine (1-15 du mois)</SelectItem>
                        <SelectItem value="2">2ème quinzaine (16-fin du mois)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  💡 Cette information sera affichée sur le livre de paie
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information about what happens next */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Ce qui va se passer</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {paymentFrequency === 'MONTHLY' && (
              <>
                <li>• Tous les employés mensuels seront inclus dans cette paie</li>
                <li>• Les employés journaliers/hebdomadaires/quinzaine seront payés selon leurs heures</li>
                <li>• Un seul livre de paie mensuel sera généré</li>
              </>
            )}
            {paymentFrequency === 'WEEKLY' && (
              <>
                <li>• Seuls les employés hebdomadaires seront inclus dans cette paie</li>
                <li>• Les heures de la semaine {closureSequence} seront utilisées pour le calcul</li>
                <li>• Le livre de paie sera intitulé "Livre de Paie - Hebdomadaire Semaine {closureSequence}"</li>
              </>
            )}
            {paymentFrequency === 'BIWEEKLY' && (
              <>
                <li>• Seuls les employés quinzaine seront inclus dans cette paie</li>
                <li>• Les heures de la {closureSequence === 1 ? '1ère' : '2ème'} quinzaine seront utilisées</li>
                <li>• Le livre de paie sera intitulé "Livre de Paie - Quinzaine {closureSequence}"</li>
              </>
            )}
            {paymentFrequency === 'DAILY' && (
              <>
                <li>• Seuls les employés journaliers seront inclus dans cette paie</li>
                <li>• Les heures de la journée sélectionnée seront utilisées</li>
                <li>• Un livre de paie journalier sera généré</li>
              </>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Validation function for payment frequency step
 */
export function validatePaymentFrequency(
  paymentFrequency: PaymentFrequency,
  closureSequence: number | null
): { isValid: boolean; error?: string } {
  // MONTHLY doesn't need closure sequence
  if (paymentFrequency === 'MONTHLY') {
    return { isValid: true };
  }

  // WEEKLY and BIWEEKLY require closure sequence
  if (!closureSequence) {
    return {
      isValid: false,
      error: paymentFrequency === 'WEEKLY'
        ? 'Veuillez sélectionner la semaine'
        : 'Veuillez sélectionner la quinzaine',
    };
  }

  // Validate closure sequence range
  if (paymentFrequency === 'WEEKLY' && (closureSequence < 1 || closureSequence > 4)) {
    return { isValid: false, error: 'La semaine doit être entre 1 et 4' };
  }

  if (paymentFrequency === 'BIWEEKLY' && (closureSequence < 1 || closureSequence > 2)) {
    return { isValid: false, error: 'La quinzaine doit être 1 ou 2' };
  }

  return { isValid: true };
}
