/**
 * Step 3: STC Preview
 *
 * Displays complete Solde de Tout Compte (STC) calculation breakdown.
 * Shows all components with:
 * - Calculation formulas
 * - Fiscal treatment (taxable vs non-taxable)
 * - Underlying calculation data
 */

'use client';

import { UseFormReturn } from 'react-hook-form';
import type { WizardData } from '../terminate-employee-wizard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, TrendingUp, TrendingDown, Info, CheckCircle2, ChevronDown, Calculator, FileText } from 'lucide-react';
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
                <p className="text-destructive">Aucun résultat de calcul STC reçu</p>
              )}
              {stcResult && !stcResult.calculationDetails?.yearsOfService && (
                <p className="text-destructive">Années d'ancienneté non calculées</p>
              )}
              {stcResult && !stcResult.calculationDetails?.averageSalary12M && (
                <p className="text-destructive">Salaire moyen 12 mois non calculé</p>
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

  const formatNumber = (num: number, decimals = 2) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
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

  // Get taxation breakdown for a component
  const getTaxBadge = (breakdown: any) => {
    if (!breakdown) return null;

    if (breakdown.taxationRule === 'fully_exempt') {
      return <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Exonéré</Badge>;
    }
    if (breakdown.taxationRule === 'fully_taxable') {
      return <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">100% imposable</Badge>;
    }
    if (breakdown.taxationRule === 'half_taxable_if_above_threshold') {
      if (breakdown.thresholdApplied) {
        return <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">50% imposable</Badge>;
      }
      return <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Exonéré (&lt;75K)</Badge>;
    }
    return null;
  };

  // Component for displaying a line item with formula and fiscal details
  const STCLineItem = ({
    label,
    amount,
    formula,
    taxBreakdown,
    subItems,
    highlight = false
  }: {
    label: string;
    amount: number;
    formula?: string;
    taxBreakdown?: any;
    subItems?: React.ReactNode;
    highlight?: boolean;
  }) => {
    if (amount <= 0) return null;

    return (
      <div className={`py-2 ${highlight ? 'bg-primary/5 -mx-4 px-4 rounded-lg' : ''}`}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm ${highlight ? 'font-semibold' : ''}`}>{label}</span>
              {getTaxBadge(taxBreakdown)}
            </div>
            {formula && (
              <p className="text-xs text-muted-foreground mt-0.5">{formula}</p>
            )}
            {taxBreakdown && taxBreakdown.taxableAmount !== taxBreakdown.totalAmount && (
              <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                <span className="text-orange-600">Imposable: {formatCurrency(taxBreakdown.taxableAmount)}</span>
                <span className="text-green-600">Exonéré: {formatCurrency(taxBreakdown.nonTaxableAmount)}</span>
              </div>
            )}
          </div>
          <span className={`font-medium whitespace-nowrap ${highlight ? 'text-lg font-bold' : ''}`}>
            {formatCurrency(amount)}
          </span>
        </div>
        {subItems && (
          <div className="ml-4 mt-1 border-l-2 border-muted pl-3 space-y-1">
            {subItems}
          </div>
        )}
      </div>
    );
  };

  const { calculationDetails, taxation } = stcResult;

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
              <p className="text-2xl font-bold">{formatNumber(calculationDetails.yearsOfService)} ans</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Salaire moyen 12 mois</p>
              <p className="text-2xl font-bold">{formatCurrency(calculationDetails.averageSalary12M)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Montant net à payer</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(taxation?.estimatedNetPayable || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Données de base (Collapsible) */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex w-full items-center justify-between hover:opacity-80 transition-opacity">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Données de base utilisées
              </CardTitle>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Salaire brut mensuel</p>
                  <p className="font-medium">{formatCurrency(calculationDetails.monthlyGrossSalary || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Salaire catégoriel</p>
                  <p className="font-medium">{formatCurrency(calculationDetails.salaireCategoriel || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Jours de congés non pris</p>
                  <p className="font-medium">{formatNumber(calculationDetails.unusedLeaveDays || 0, 1)} jours</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ancienneté exacte</p>
                  <p className="font-medium">{formatNumber(calculationDetails.yearsOfService)} ans</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <p className="font-medium">{calculationDetails.isCadre ? 'Cadre' : 'Non-cadre'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type de contrat</p>
                  <p className="font-medium">{stcResult.metadata?.contractType || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Detailed Breakdown - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: STC Components */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Composantes du STC
            </CardTitle>
            <CardDescription>Détail des calculs avec formules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* Prorated Salary */}
            <STCLineItem
              label="Salaire prorata"
              amount={stcResult.salary || stcResult.proratedSalary || 0}
              formula={calculationDetails.monthlyGrossSalary
                ? `${formatCurrency(calculationDetails.monthlyGrossSalary)} × jours travaillés / jours du mois`
                : undefined}
              taxBreakdown={taxation?.salary}
            />

            {/* Vacation Payout */}
            <STCLineItem
              label="Indemnité compensatrice de congés"
              amount={stcResult.vacationPayout || 0}
              formula={calculationDetails.unusedLeaveDays && calculationDetails.averageSalary12M
                ? `${formatNumber(calculationDetails.unusedLeaveDays, 1)} jours × ${formatCurrency(calculationDetails.averageSalary12M / 30)}/jour`
                : undefined}
              taxBreakdown={taxation?.vacationPayout}
            />

            {/* Gratification */}
            <STCLineItem
              label="Gratification"
              amount={stcResult.gratification || 0}
              formula={calculationDetails.salaireCategoriel
                ? `75% × ${formatCurrency(calculationDetails.salaireCategoriel)} × mois travaillés / 12`
                : undefined}
              taxBreakdown={taxation?.gratification}
            />

            {stcResult.severancePay > 0 && <Separator className="my-2" />}

            {/* Severance Pay */}
            {stcResult.severancePay > 0 && (
              <STCLineItem
                label="Indemnité de licenciement"
                amount={stcResult.severancePay}
                formula={`Salaire moyen × ancienneté × taux progressif`}
                taxBreakdown={taxation?.severancePay}
                highlight
                subItems={stcResult.severancePayBreakdown && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>0-5 ans ({formatNumber(stcResult.severancePayBreakdown.tranche1Years, 2)} ans) × 30%</span>
                      <span>{formatCurrency(stcResult.severancePayBreakdown.tranche1Amount)}</span>
                    </div>
                    {stcResult.severancePayBreakdown.tranche2Years > 0 && (
                      <div className="flex justify-between text-xs">
                        <span>6-10 ans ({formatNumber(stcResult.severancePayBreakdown.tranche2Years, 2)} ans) × 35%</span>
                        <span>{formatCurrency(stcResult.severancePayBreakdown.tranche2Amount)}</span>
                      </div>
                    )}
                    {stcResult.severancePayBreakdown.tranche3Years > 0 && (
                      <div className="flex justify-between text-xs">
                        <span>11+ ans ({formatNumber(stcResult.severancePayBreakdown.tranche3Years, 2)} ans) × 40%</span>
                        <span>{formatCurrency(stcResult.severancePayBreakdown.tranche3Amount)}</span>
                      </div>
                    )}
                  </>
                )}
              />
            )}

            {/* Notice Period Payment */}
            {(stcResult.noticePeriod?.payment > 0 || stcResult.noticePayment > 0) && (
              <STCLineItem
                label="Indemnité compensatrice de préavis"
                amount={stcResult.noticePeriod?.payment || stcResult.noticePayment || 0}
                formula={stcResult.noticePeriod
                  ? `${stcResult.noticePeriod.totalDays || stcResult.noticePeriod.months * 30} jours (${stcResult.noticePeriod.months} mois)`
                  : undefined}
                taxBreakdown={taxation?.noticePayment}
              />
            )}

            {/* CDD End Indemnity */}
            <STCLineItem
              label="Indemnité de fin de CDD (précarité)"
              amount={stcResult.cddEndIndemnity || 0}
              formula={`3% × rémunération totale du contrat`}
              taxBreakdown={taxation?.cddEndIndemnity}
            />

            {/* Funeral Expenses */}
            {stcResult.funeralExpenses > 0 && (
              <>
                <Separator className="my-2" />
                <STCLineItem
                  label="Frais funéraires"
                  amount={stcResult.funeralExpenses}
                  formula={
                    calculationDetails.yearsOfService <= 5 ? '3 × SMIG' :
                    calculationDetails.yearsOfService <= 10 ? '4 × SMIG' : '6 × SMIG'
                  }
                  taxBreakdown={taxation?.funeralExpenses}
                />
              </>
            )}

            <Separator className="my-3" />

            {/* Total Gross */}
            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold">Montant brut total</span>
              <span className="text-lg font-bold">
                {formatCurrency(taxation?.totalGrossAmount || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Fiscal Treatment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Traitement fiscal détaillé
            </CardTitle>
            <CardDescription>Répartition imposable / exonéré</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {taxation && (
              <>
                {/* Per-component fiscal breakdown */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:opacity-80 transition-opacity">
                    <span>Détail par composante</span>
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="space-y-2 text-xs">
                      {/* Salary */}
                      {taxation.salary?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Salaire</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.salary.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.salary.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      {/* Vacation */}
                      {taxation.vacationPayout?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Congés</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.vacationPayout.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.vacationPayout.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      {/* Gratification */}
                      {taxation.gratification?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Gratification</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.gratification.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.gratification.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      {/* Notice */}
                      {taxation.noticePayment?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Préavis</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.noticePayment.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.noticePayment.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      {/* Severance */}
                      {taxation.severancePay?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Ind. licenciement</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.severancePay.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.severancePay.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      {/* CDD Indemnity */}
                      {taxation.cddEndIndemnity?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Ind. fin CDD</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.cddEndIndemnity.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.cddEndIndemnity.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      {/* Funeral */}
                      {taxation.funeralExpenses?.totalAmount > 0 && (
                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                          <span>Frais funéraires</span>
                          <div className="flex gap-2">
                            <span className="text-orange-600">{formatCurrency(taxation.funeralExpenses.taxableAmount)}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-green-600">{formatCurrency(taxation.funeralExpenses.nonTaxableAmount)}</span>
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground pt-1">
                        <span className="text-orange-600">Orange</span> = Imposable | <span className="text-green-600">Vert</span> = Exonéré
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total imposable</span>
                    <span className="font-medium text-orange-600">
                      {formatCurrency(taxation.totalTaxableAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total exonéré</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(taxation.totalNonTaxableAmount)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Deductions */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm">ITS estimé</span>
                      <p className="text-xs text-muted-foreground">Impôt sur Traitements et Salaires</p>
                    </div>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(taxation.estimatedITS)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm">CNPS employé</span>
                      <p className="text-xs text-muted-foreground">6,3% sur imposable</p>
                    </div>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(taxation.estimatedCNPSEmployee)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Net to Pay */}
                <div className="flex justify-between items-center bg-primary/5 -mx-4 px-4 py-4 rounded-lg">
                  <span className="font-semibold text-lg">Net à payer</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(taxation.estimatedNetPayable)}
                  </span>
                </div>

                {/* Taxation Rules */}
                <Alert className="bg-muted/50">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <p className="font-medium mb-1">Règles fiscales appliquées:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                      <li>Salaire, congés, gratification, préavis: 100% imposables</li>
                      <li>Indemnités &gt; 75 000 F: 50% imposables, 50% exonérés</li>
                      <li>Indemnités ≤ 75 000 F: 100% exonérés</li>
                      <li>Frais funéraires: toujours exonérés</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dates and Metadata */}
      <Card className="bg-muted/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Informations de référence
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stcResult.metadata?.hireDate && (
              <div>
                <p className="text-muted-foreground">Date d'embauche</p>
                <p className="font-medium">
                  {new Date(stcResult.metadata.hireDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Date de cessation</p>
              <p className="font-medium">
                {new Date(stcResult.metadata?.terminationDate || form.getValues('terminationDate')).toLocaleDateString('fr-FR')}
              </p>
            </div>
            {stcResult.metadata?.lastWorkingDay && (
              <div>
                <p className="text-muted-foreground">Dernier jour travaillé</p>
                <p className="font-medium">
                  {new Date(stcResult.metadata.lastWorkingDay).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Type de contrat</p>
              <p className="font-medium">{stcResult.metadata?.contractType || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Message */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <p className="font-medium text-green-700">Le calcul du STC est complet</p>
          <p className="text-sm text-green-600 mt-1">
            Vérifiez les montants et formules ci-dessus avant de passer à la génération des documents
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
