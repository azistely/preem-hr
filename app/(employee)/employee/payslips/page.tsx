/**
 * Employee Payslips Page (P0-2)
 *
 * Task-oriented design: "Consulter mes bulletins de paie"
 * Following HCI principles:
 * - Zero learning curve (obvious card-based layout)
 * - Smart defaults (latest payslips first)
 * - Progressive disclosure (summary → full details)
 * - Mobile-first (touch targets ≥ 44px)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileText,
  DollarSign,
  Calendar,
  Loader2,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCurrentEmployee } from '@/hooks/use-current-employee';

export default function EmployeePayslipsPage() {
  const [selectedPayslip, setSelectedPayslip] = useState<string | null>(null);

  // Get current employee from context
  const { employeeId, isLoading: employeeLoading } = useCurrentEmployee();

  // Fetch payslips for current employee
  const { data: payslips, isLoading: payslipsLoading } = trpc.payroll.getEmployeePayslips.useQuery(
    { employeeId: employeeId || '' },
    { enabled: !!employeeId }
  );

  const isLoading = employeeLoading || payslipsLoading;

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR').format(numAmount) + ' FCFA';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-600">Payé</Badge>;
      case 'finalized':
        return <Badge className="bg-blue-600">Finalisé</Badge>;
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mes bulletins de paie</h1>
        <p className="text-muted-foreground mt-2">
          Consultez et téléchargez vos bulletins de paie
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement des bulletins...</span>
            </div>
          </CardContent>
        </Card>
      ) : !payslips || payslips.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Aucun bulletin de paie</p>
              <p className="text-sm text-muted-foreground mt-2">
                Vos bulletins de paie apparaîtront ici une fois générés
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Payslips List */
        <div className="space-y-4">
          {payslips.map((payslip) => {
            const isExpanded = selectedPayslip === payslip.id;

            return (
              <Card key={payslip.id} className={isExpanded ? 'border-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">
                          {format(new Date(payslip.periodStart), 'MMMM yyyy', { locale: fr })}
                        </CardTitle>
                        {getStatusBadge(payslip.status)}
                      </div>
                      <CardDescription>
                        Période: {format(new Date(payslip.periodStart), 'dd MMM', { locale: fr })}
                        {' → '}
                        {format(new Date(payslip.periodEnd), 'dd MMM yyyy', { locale: fr })}
                      </CardDescription>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(payslip.netSalary)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Net à payer</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Quick Summary - Always Visible */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Salaire brut</p>
                      <p className="font-semibold">{formatCurrency(payslip.grossSalary)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date de paiement</p>
                      <p className="font-semibold">
                        {format(new Date(payslip.paymentDate), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <p className="text-xs text-muted-foreground">Charges patronales</p>
                      <p className="font-semibold">{formatCurrency(payslip.employerContributions)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col md:flex-row gap-3">
                    {payslip.pdfUrl && (
                      <Button
                        className="flex-1 min-h-[48px]"
                        onClick={() => window.open(payslip.pdfUrl!, '_blank')}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger le PDF
                      </Button>
                    )}

                    <Collapsible
                      open={isExpanded}
                      onOpenChange={() => setSelectedPayslip(isExpanded ? null : payslip.id)}
                      className="flex-1"
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full min-h-[48px]">
                          <Eye className="mr-2 h-4 w-4" />
                          {isExpanded ? 'Masquer les détails' : 'Voir les détails'}
                          <ChevronDown
                            className={`ml-2 h-4 w-4 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>

                      {/* Progressive Disclosure - Level 2: Detailed Breakdown */}
                      <CollapsibleContent className="mt-4">
                        <div className="space-y-4">
                          {/* Salary Components */}
                          {payslip.salaryComponents && Array.isArray(payslip.salaryComponents) && payslip.salaryComponents.length > 0 ? (
                            <div>
                              <h4 className="font-semibold mb-2">Composantes du salaire</h4>
                              <div className="space-y-2">
                                {payslip.salaryComponents.map((comp: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center p-2 bg-muted/20 rounded"
                                  >
                                    <span className="text-sm">{comp.name}</span>
                                    <span className="font-semibold">{formatCurrency(comp.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Deductions */}
                          {payslip.deductions && Array.isArray(payslip.deductions) && payslip.deductions.length > 0 ? (
                            <div>
                              <h4 className="font-semibold mb-2">Retenues</h4>
                              <div className="space-y-2">
                                {payslip.deductions.map((deduction: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center p-2 bg-red-50 rounded"
                                  >
                                    <span className="text-sm">{deduction.name}</span>
                                    <span className="font-semibold text-red-600">
                                      -{formatCurrency(deduction.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Employer Costs (Informational) */}
                          {payslip.employerCosts && Array.isArray(payslip.employerCosts) && payslip.employerCosts.length > 0 ? (
                            <div>
                              <h4 className="font-semibold mb-2">Charges patronales (informatives)</h4>
                              <div className="space-y-2">
                                {payslip.employerCosts.map((cost: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center p-2 bg-muted/20 rounded"
                                  >
                                    <span className="text-sm">{cost.name}</span>
                                    <span className="font-semibold">{formatCurrency(cost.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Total Summary */}
                          <div className="pt-4 border-t">
                            <div className="flex justify-between items-center text-lg font-bold">
                              <span>Net à payer</span>
                              <span className="text-primary text-2xl">
                                {formatCurrency(payslip.netSalary)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
