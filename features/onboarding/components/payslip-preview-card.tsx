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
}

export function PayslipPreviewCard({
  employee,
  payslip,
  onContinue,
  onEdit,
}: PayslipPreviewCardProps) {
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
              <strong className="text-lg">{payslip.grossSalary.toLocaleString('fr-FR')} FCFA</strong>
            </div>

            <Separator />

            <div className="flex justify-between text-sm">
              <span>CNPS (6.3%):</span>
              <span className="text-red-600">-{payslip.cnpsEmployee.toLocaleString('fr-FR')} FCFA</span>
            </div>

            {payslip.cmuEmployee && payslip.cmuEmployee > 0 && (
              <div className="flex justify-between text-sm">
                <span>CMU (1%):</span>
                <span className="text-red-600">-{payslip.cmuEmployee.toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span>ITS ({payslip.fiscalParts} parts):</span>
              <span className="text-red-600">-{payslip.incomeTax.toLocaleString('fr-FR')} FCFA</span>
            </div>

            <Separator />

            <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
              <span className="font-semibold">Salaire net:</span>
              <strong className="text-2xl text-green-700">
                {payslip.netSalary.toLocaleString('fr-FR')} FCFA
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
                    <span>{payslip.baseSalary.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  {payslip.transportAllowance && payslip.transportAllowance > 0 && (
                    <div className="flex justify-between">
                      <span>Indemnité transport:</span>
                      <span>{payslip.transportAllowance.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                  {payslip.housingAllowance && payslip.housingAllowance > 0 && (
                    <div className="flex justify-between">
                      <span>Indemnité logement:</span>
                      <span>{payslip.housingAllowance.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                  {payslip.mealAllowance && payslip.mealAllowance > 0 && (
                    <div className="flex justify-between">
                      <span>Indemnité repas:</span>
                      <span>{payslip.mealAllowance.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Employer contributions */}
              <div>
                <h5 className="font-semibold mb-2">Cotisations patronales:</h5>
                <div className="space-y-1 pl-3">
                  <div className="flex justify-between">
                    <span>CNPS employeur:</span>
                    <span>{payslip.cnpsEmployer.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  {payslip.cmuEmployer && payslip.cmuEmployer > 0 && (
                    <div className="flex justify-between">
                      <span>CMU employeur:</span>
                      <span>{payslip.cmuEmployer.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Coût total employeur:</span>
                  <span>{payslip.totalEmployerCost.toLocaleString('fr-FR')} FCFA</span>
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
          >
            C'est correct, continuer
          </Button>

          <Button
            onClick={onEdit}
            variant="outline"
            size="lg"
          >
            Modifier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
