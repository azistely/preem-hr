/**
 * Step 3: STC Preview
 *
 * Displays complete Solde de Tout Compte (STC) calculation breakdown.
 * Shows all components with taxation details in a user-friendly format.
 */

'use client';

import { UseFormReturn } from 'react-hook-form';
import type { WizardData } from '../terminate-employee-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, DollarSign, TrendingUp, TrendingDown, Info, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface STCPreviewStepProps {
  form: UseFormReturn<WizardData>;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  stcResult: any;
  isLoading: boolean;
  error?: { message: string };
}

export function STCPreviewStep({ form, employee, stcResult, isLoading, error }: STCPreviewStepProps) {
  console.log('[STCPreviewStep] Rendering with props:');
  console.log('[STCPreviewStep] stcResult:', stcResult);
  console.log('[STCPreviewStep] isLoading:', isLoading);
  console.log('[STCPreviewStep] error:', error);
  console.log('[STCPreviewStep] stcResult?.calculationDetails?.yearsOfService:', stcResult?.calculationDetails?.yearsOfService);
  console.log('[STCPreviewStep] stcResult?.calculationDetails?.averageSalary12M:', stcResult?.calculationDetails?.averageSalary12M);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Calcul du STC en cours...</p>
        <p className="text-sm text-muted-foreground">
          Récupération des salaires, calcul des indemnités et taxation
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">Erreur lors du calcul du STC</p>
          <p className="text-sm">{error.message}</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (!stcResult || !stcResult.calculationDetails?.yearsOfService || !stcResult.calculationDetails?.averageSalary12M) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Impossible de calculer le STC</p>
            <p className="text-sm">Veuillez vérifier que l'employé a:</p>
            <ul className="list-disc list-inside mt-2 text-sm space-y-1">
              <li>Un contrat actif dans l'onglet "Contrat"</li>
              <li>Un salaire configuré dans l'onglet "Salaire"</li>
              <li>Une date d'embauche valide</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Informations manquantes détectées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {!stcResult && (
                <p className="text-destructive">❌ Aucun résultat de calcul STC reçu</p>
              )}
              {stcResult && !stcResult.calculationDetails?.yearsOfService && (
                <p className="text-destructive">❌ Années d'ancienneté non calculées</p>
              )}
              {stcResult && !stcResult.calculationDetails?.averageSalary12M && (
                <p className="text-destructive">❌ Salaire moyen 12 mois non calculé</p>
              )}
              <p className="text-muted-foreground mt-4">
                Retournez à la page de l'employé et vérifiez les informations requises.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const departureType = form.watch('departureType');
  const getDepartureTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FIN_CDD: 'Fin de CDD',
      DEMISSION_CDI: 'Démission CDI',
      DEMISSION_CDD: 'Démission CDD',
      LICENCIEMENT: 'Licenciement',
      RUPTURE_CONVENTIONNELLE: 'Rupture conventionnelle',
      RETRAITE: 'Retraite',
      DECES: 'Décès',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Calcul du Solde de Tout Compte (STC)
          </CardTitle>
          <CardDescription>
            {departureType ? getDepartureTypeLabel(departureType) : ''} - {employee.firstName} {employee.lastName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Années d'ancienneté</p>
              <p className="text-2xl font-bold">{stcResult.calculationDetails.yearsOfService.toFixed(2)} ans</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Salaire moyen 12 mois</p>
              <p className="text-2xl font-bold">{formatCurrency(stcResult.calculationDetails.averageSalary12M)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Montant net à payer</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(stcResult.taxation?.estimatedNetPayable || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Components */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Composantes du STC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Salary */}
            {stcResult.salary > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Salaire prorata</span>
                <span className="font-medium">{formatCurrency(stcResult.salary)}</span>
              </div>
            )}

            {/* Vacation Payout */}
            {stcResult.vacationPayout > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Congés payés</span>
                <span className="font-medium">{formatCurrency(stcResult.vacationPayout)}</span>
              </div>
            )}

            {/* Severance Pay */}
            {stcResult.severancePay > 0 && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Indemnité de licenciement</span>
                  <span className="font-bold">{formatCurrency(stcResult.severancePay)}</span>
                </div>
                {stcResult.severancePayBreakdown && (
                  <div className="ml-4 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>0-5 ans ({stcResult.severancePayBreakdown.tranche1Years} ans) × 30%</span>
                      <span>{formatCurrency(stcResult.severancePayBreakdown.tranche1Amount)}</span>
                    </div>
                    {stcResult.severancePayBreakdown.tranche2Years > 0 && (
                      <div className="flex justify-between">
                        <span>6-10 ans ({stcResult.severancePayBreakdown.tranche2Years} ans) × 35%</span>
                        <span>{formatCurrency(stcResult.severancePayBreakdown.tranche2Amount)}</span>
                      </div>
                    )}
                    {stcResult.severancePayBreakdown.tranche3Years > 0 && (
                      <div className="flex justify-between">
                        <span>11+ ans ({stcResult.severancePayBreakdown.tranche3Years} ans) × 40%</span>
                        <span>{formatCurrency(stcResult.severancePayBreakdown.tranche3Amount)}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Gratification */}
            {stcResult.gratification > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Gratification</span>
                <span className="font-medium">{formatCurrency(stcResult.gratification)}</span>
              </div>
            )}

            {/* Notice Period Payment */}
            {stcResult.noticePeriod?.payment > 0 && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Indemnité de préavis</span>
                  <span className="font-medium">{formatCurrency(stcResult.noticePeriod.payment)}</span>
                </div>
                <div className="ml-4 text-xs text-muted-foreground">
                  {stcResult.noticePeriod.totalDays} jours ({stcResult.noticePeriod.months} mois)
                </div>
              </>
            )}

            {/* CDD End Indemnity */}
            {stcResult.cddEndIndemnity > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Indemnité de précarité (3%)</span>
                <span className="font-medium">{formatCurrency(stcResult.cddEndIndemnity)}</span>
              </div>
            )}

            {/* Funeral Expenses */}
            {stcResult.funeralExpenses > 0 && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Frais funéraires</span>
                  <span className="font-medium">{formatCurrency(stcResult.funeralExpenses)}</span>
                </div>
                <div className="ml-4 text-xs text-muted-foreground">
                  {stcResult.calculationDetails.yearsOfService <= 5 && '3 × SMIG'}
                  {stcResult.calculationDetails.yearsOfService > 5 && stcResult.calculationDetails.yearsOfService <= 10 && '4 × SMIG'}
                  {stcResult.calculationDetails.yearsOfService > 10 && '6 × SMIG'}
                </div>
              </>
            )}

            <Separator className="my-3" />

            {/* Total Gross */}
            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold">Montant brut total</span>
              <span className="text-lg font-bold">
                {formatCurrency(stcResult.taxation?.totalGrossAmount || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Taxation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Traitement fiscal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stcResult.taxation && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Montant imposable</span>
                  <span className="font-medium">
                    {formatCurrency(stcResult.taxation.totalTaxableAmount)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm">Montant non-imposable</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(stcResult.taxation.totalNonTaxableAmount)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-sm">ITS estimé</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(stcResult.taxation.estimatedITS)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm">CNPS employé estimé</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(stcResult.taxation.estimatedCNPSEmployee)}
                  </span>
                </div>

                <Separator className="my-3" />

                <div className="flex justify-between items-center pt-2 bg-primary/5 -mx-4 px-4 py-3 rounded-lg">
                  <span className="font-semibold">Net à payer</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(stcResult.taxation.estimatedNetPayable)}
                  </span>
                </div>

                {/* Taxation Rules Info */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <p className="font-medium mb-1">Règles de taxation appliquées:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Salaire, congés, gratification: 100% imposables</li>
                      <li>Indemnités &gt; 75,000 F: 50% imposables</li>
                      <li>Frais funéraires: exonérés</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calculation Metadata */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Informations complémentaires</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-2 gap-4">
            {stcResult.metadata?.hireDate && (
              <div>
                <span className="text-muted-foreground">Date d'embauche:</span>
                <span className="ml-2 font-medium">
                  {new Date(stcResult.metadata.hireDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Date de cessation:</span>
              <span className="ml-2 font-medium">
                {new Date(stcResult.metadata.terminationDate).toLocaleDateString('fr-FR')}
              </span>
            </div>
            {stcResult.metadata?.lastWorkingDay && (
              <div>
                <span className="text-muted-foreground">Dernier jour travaillé:</span>
                <span className="ml-2 font-medium">
                  {new Date(stcResult.metadata.lastWorkingDay).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {stcResult.metadata?.contractType && (
              <div>
                <span className="text-muted-foreground">Type de contrat:</span>
                <span className="ml-2 font-medium">{stcResult.metadata.contractType}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Message */}
      <Alert>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <p className="font-medium text-green-600">Le calcul du STC est complet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Vérifiez les montants ci-dessus avant de passer à la génération des documents
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
