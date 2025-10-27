'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown } from 'lucide-react';
import { formatCurrencyWithRate, convertMonthlyAmountToRateType } from '@/features/employees/utils/rate-type-labels';
import type { RateType } from '@/features/employees/utils/rate-type-labels';

interface PayslipPreviewCardProps {
  employee: {
    firstName: string;
    lastName: string;
  };
  payslip: {
    grossSalary: number;
    baseSalary: number;
    components?: Array<{
      code: string;
      name: string;
      amount: number;
      sourceType: 'standard' | 'template';
    }>;
    transportAllowance?: number;
    housingAllowance?: number;
    mealAllowance?: number;
    cnpsEmployee: number;
    cmuEmployee?: number;
    incomeTax: number;
    netSalary: number;
    fiscalParts: number;
    cnpsEmployer: number;
    cmuEmployer?: number;
    totalEmployerCost: number;
  };
  rateType?: RateType | null;
  onContinue: () => void;
  onEdit: () => void;
  isCreating?: boolean;
}

export function PayslipPreviewCard({
  employee,
  payslip,
  rateType = 'MONTHLY',
  onContinue,
  onEdit,
  isCreating = false,
}: PayslipPreviewCardProps) {
  // Helper to safely format numbers with rate awareness
  const formatCurrency = (value: number | undefined): string => {
    return (value ?? 0).toLocaleString('fr-FR');
  };

  // Helper to format with rate suffix
  const formatWithRate = (value: number | undefined): string => {
    return formatCurrencyWithRate(value ?? 0, rateType as RateType);
  };

  // Helper to convert component amounts from monthly to rate type
  const convertComponent = (amount: number | undefined): number => {
    return convertMonthlyAmountToRateType(amount ?? 0, rateType as RateType);
  };

  // IMPORTANT: calculatePayrollV2 returns MONTHLY totals for SOME fields but NOT ALL
  // - grossSalary, netSalary, deductions: MONTHLY totals (need conversion)
  // - baseSalary: ORIGINAL input rate (already daily/hourly, NO conversion needed!)
  // We need to convert monthly totals back to per-day/per-hour rates for display
  const convertMonthlyToRate = (monthlyAmount: number | undefined): number => {
    if (!monthlyAmount) return 0;
    return convertMonthlyAmountToRateType(monthlyAmount, rateType as RateType);
  };

  // baseSalary is returned as-is from input, so format without conversion
  const formatBaseSalary = (amount: number | undefined): string => {
    return formatCurrencyWithRate(amount ?? 0, rateType as RateType);
  };

  return (
    <Card className="border-2 border-green-500 bg-green-50/50 mt-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">
              {employee.firstName} {employee.lastName} ajouté(e)
            </h3>
            <p className="text-sm text-muted-foreground">
              Profil créé et paie calculée automatiquement
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Payslip Summary */}
        <div className="p-4 bg-white rounded-lg border">
          <h4 className="font-semibold mb-3">Aperçu de la paie mensuelle</h4>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Salaire brut:</span>
              <strong className="text-lg">{formatWithRate(convertMonthlyToRate(payslip.grossSalary))}</strong>
            </div>

            <Separator />

            <div className="flex justify-between text-sm">
              <span>CNPS (6.3%):</span>
              <span className="text-red-600">-{formatWithRate(convertMonthlyToRate(payslip.cnpsEmployee))}</span>
            </div>

            {payslip.cmuEmployee && payslip.cmuEmployee > 0 && (
              <div className="flex justify-between text-sm">
                <span>CMU (1%):</span>
                <span className="text-red-600">-{formatWithRate(convertMonthlyToRate(payslip.cmuEmployee))}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span>ITS ({payslip.fiscalParts ?? 1} parts):</span>
              <span className="text-red-600">-{formatWithRate(convertMonthlyToRate(payslip.incomeTax))}</span>
            </div>

            <Separator />

            <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
              <span className="font-semibold">Salaire net:</span>
              <strong className="text-2xl text-green-700">
                {formatWithRate(convertMonthlyToRate(payslip.netSalary))}
              </strong>
            </div>
          </div>

          {/* Collapsible: Detailed breakdown */}
          <Collapsible className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                <ChevronDown className="w-4 h-4 mr-2" />
                Voir les détails
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-3 text-sm">
              {/* Gross components */}
              <div>
                <h5 className="font-semibold mb-2">Composantes du salaire brut:</h5>
                <div className="space-y-1 pl-3">
                  <div className="flex justify-between">
                    <span>Salaire de base:</span>
                    <span>{formatBaseSalary(payslip.baseSalary)}</span>
                  </div>
                  {/* Display modern components array */}
                  {payslip.components && payslip.components.length > 0 && (
                    payslip.components.map((component, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{component.name}:</span>
                        <span>{formatWithRate(convertComponent(component.amount))}</span>
                      </div>
                    ))
                  )}
                  {/* Backward compatibility: display individual allowances if no components array */}
                  {(!payslip.components || payslip.components.length === 0) && (
                    <>
                      {payslip.transportAllowance && payslip.transportAllowance > 0 && (
                        <div className="flex justify-between">
                          <span>Indemnité transport:</span>
                          <span>{formatWithRate(convertComponent(payslip.transportAllowance))}</span>
                        </div>
                      )}
                      {payslip.housingAllowance && payslip.housingAllowance > 0 && (
                        <div className="flex justify-between">
                          <span>Indemnité logement:</span>
                          <span>{formatWithRate(convertComponent(payslip.housingAllowance))}</span>
                        </div>
                      )}
                      {payslip.mealAllowance && payslip.mealAllowance > 0 && (
                        <div className="flex justify-between">
                          <span>Indemnité repas:</span>
                          <span>{formatWithRate(convertComponent(payslip.mealAllowance))}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Employer contributions */}
              <div>
                <h5 className="font-semibold mb-2">Cotisations patronales:</h5>
                <div className="space-y-1 pl-3">
                  <div className="flex justify-between">
                    <span>CNPS employeur:</span>
                    <span>{formatWithRate(convertMonthlyToRate(payslip.cnpsEmployer))}</span>
                  </div>
                  {payslip.cmuEmployer && payslip.cmuEmployer > 0 && (
                    <div className="flex justify-between">
                      <span>CMU employeur:</span>
                      <span>{formatWithRate(convertMonthlyToRate(payslip.cmuEmployer))}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Coût total employeur:</span>
                  <span>{formatWithRate(convertMonthlyToRate(payslip.totalEmployerCost))}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onContinue}
            size="lg"
            className="flex-1 min-h-[56px]"
            disabled={isCreating}
          >
            {isCreating ? 'Création en cours...' : "C'est correct, continuer"}
          </Button>

          <Button
            onClick={onEdit}
            variant="outline"
            size="lg"
            disabled={isCreating}
          >
            Modifier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
