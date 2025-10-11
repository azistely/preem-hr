'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, ChevronDown } from 'lucide-react';

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
  onContinue: () => void;
  onEdit: () => void;
  isCreating?: boolean;
}

export function PayslipPreviewCard({
  employee,
  payslip,
  onContinue,
  onEdit,
  isCreating = false,
}: PayslipPreviewCardProps) {
  // Helper to safely format numbers
  const formatCurrency = (value: number | undefined): string => {
    return (value ?? 0).toLocaleString('fr-FR');
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
              <strong className="text-lg">{formatCurrency(payslip.grossSalary)} FCFA</strong>
            </div>

            <Separator />

            <div className="flex justify-between text-sm">
              <span>CNPS (6.3%):</span>
              <span className="text-red-600">-{formatCurrency(payslip.cnpsEmployee)} FCFA</span>
            </div>

            {payslip.cmuEmployee && payslip.cmuEmployee > 0 && (
              <div className="flex justify-between text-sm">
                <span>CMU (1%):</span>
                <span className="text-red-600">-{formatCurrency(payslip.cmuEmployee)} FCFA</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span>ITS ({payslip.fiscalParts ?? 1} parts):</span>
              <span className="text-red-600">-{formatCurrency(payslip.incomeTax)} FCFA</span>
            </div>

            <Separator />

            <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
              <span className="font-semibold">Salaire net:</span>
              <strong className="text-2xl text-green-700">
                {formatCurrency(payslip.netSalary)} FCFA
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
                    <span>{formatCurrency(payslip.baseSalary)} FCFA</span>
                  </div>
                  {/* Display modern components array */}
                  {payslip.components && payslip.components.length > 0 && (
                    payslip.components.map((component, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{component.name}:</span>
                        <span>{formatCurrency(component.amount)} FCFA</span>
                      </div>
                    ))
                  )}
                  {/* Backward compatibility: display individual allowances if no components array */}
                  {(!payslip.components || payslip.components.length === 0) && (
                    <>
                      {payslip.transportAllowance && payslip.transportAllowance > 0 && (
                        <div className="flex justify-between">
                          <span>Indemnité transport:</span>
                          <span>{formatCurrency(payslip.transportAllowance)} FCFA</span>
                        </div>
                      )}
                      {payslip.housingAllowance && payslip.housingAllowance > 0 && (
                        <div className="flex justify-between">
                          <span>Indemnité logement:</span>
                          <span>{formatCurrency(payslip.housingAllowance)} FCFA</span>
                        </div>
                      )}
                      {payslip.mealAllowance && payslip.mealAllowance > 0 && (
                        <div className="flex justify-between">
                          <span>Indemnité repas:</span>
                          <span>{formatCurrency(payslip.mealAllowance)} FCFA</span>
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
                    <span>{formatCurrency(payslip.cnpsEmployer)} FCFA</span>
                  </div>
                  {payslip.cmuEmployer && payslip.cmuEmployer > 0 && (
                    <div className="flex justify-between">
                      <span>CMU employeur:</span>
                      <span>{formatCurrency(payslip.cmuEmployer)} FCFA</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Coût total employeur:</span>
                  <span>{formatCurrency(payslip.totalEmployerCost)} FCFA</span>
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
