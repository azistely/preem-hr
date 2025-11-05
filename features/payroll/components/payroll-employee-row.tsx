'use client';

/**
 * Expandable Payroll Employee Row Component
 *
 * Displays employee payroll summary with expandable detailed breakdown:
 * - Collapsed: Basic info (name, gross, deductions, net)
 * - Expanded: Full salary breakdown, time tracking, time off, edit actions
 *
 * Design Principles:
 * - Progressive disclosure - Details hidden by default
 * - Touch-friendly - All buttons ≥44px
 * - Mobile-first - Works on small screens
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronUp,
  Edit,
  Clock,
  Plane,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Bot,
} from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OvertimeBreakdownCard } from '@/features/payroll/components/review/calculated';

interface PayrollEmployeeRowProps {
  item: any; // Line item from payroll run
  isExpanded: boolean;
  onToggle: () => void;
  formatCurrency: (amount: number | string) => string;
  status: string;
  runId?: string; // Add runId for overtime breakdown
  verificationStatus?: 'verified' | 'flagged' | 'unverified' | 'auto_ok'; // Verification status
  onPreviewPayslip?: (employeeId: string, employeeName: string) => void;
  onDownloadPayslip?: (employeeId: string, employeeName: string) => void;
  isGeneratingPayslip?: boolean;
  onRecalculateEmployee?: (employeeId: string) => Promise<void>;
  isRecalculating?: boolean;
  onMarkVerified?: (employeeId: string) => Promise<void>;
  isMarkingVerified?: boolean;
}

export function PayrollEmployeeRow({
  item,
  isExpanded,
  onToggle,
  formatCurrency,
  status,
  runId,
  verificationStatus,
  onPreviewPayslip,
  onDownloadPayslip,
  isGeneratingPayslip = false,
  onRecalculateEmployee,
  isRecalculating = false,
  onMarkVerified,
  isMarkingVerified = false,
}: PayrollEmployeeRowProps) {
  const router = useRouter();

  // Get verification status icon and color
  const getVerificationBadge = () => {
    if (!verificationStatus || status !== 'calculated' && status !== 'processing') {
      return null;
    }

    switch (verificationStatus) {
      case 'verified':
        return <span title="Vérifié"><CheckCircle className="h-4 w-4 text-green-600" /></span>;
      case 'flagged':
        return <span title="Alerte"><AlertTriangle className="h-4 w-4 text-orange-600" /></span>;
      case 'unverified':
        return <span title="Non vérifié"><XCircle className="h-4 w-4 text-gray-400" /></span>;
      case 'auto_ok':
        return <span title="Auto-vérifié"><Bot className="h-4 w-4 text-blue-600" /></span>;
      default:
        return null;
    }
  };

  // Parse JSONB fields
  const allowances = item.allowances as Record<string, number> || {};
  const earningsDetails = item.earningsDetails as any[] || [];
  const deductionsDetails = item.deductionsDetails as any[] || [];
  const employeeContributions = item.employeeContributions as Record<string, number> || {};
  const taxDeductions = item.taxDeductions as Record<string, number> || {};
  const employerContributions = item.employerContributions as Record<string, number> || {};
  const otherTaxesDetails = item.otherTaxesDetails as any[] || [];
  const contributionDetails = item.contributionDetails as any[] || [];

  const handleEditSalary = () => {
    // Navigate to salary edit page (direct route for salary changes)
    router.push(`/employees/${item.employeeId}/salary/edit`);
  };

  return (
    <>
      {/* Summary Row */}
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell>
          <div className="flex items-center gap-2">
            {getVerificationBadge()}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="font-medium">{item.employeeName || '-'}</div>
              <div className="text-sm text-muted-foreground">
                {item.employeeNumber || '-'}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          {item.baseSalary ? `${formatCurrency(item.baseSalary)} FCFA` : '-'}
        </TableCell>
        <TableCell>
          {item.grossSalary ? `${formatCurrency(item.grossSalary)} FCFA` : '-'}
        </TableCell>
        <TableCell>
          {item.cnpsEmployee ? `-${formatCurrency(item.cnpsEmployee)} FCFA` : '-'}
        </TableCell>
        <TableCell>
          {item.cmuEmployee ? `-${formatCurrency(item.cmuEmployee)} FCFA` : '-'}
        </TableCell>
        <TableCell>
          {item.its ? `-${formatCurrency(item.its)} FCFA` : '-'}
        </TableCell>
        <TableCell>
          {item.totalDeductions ? `-${formatCurrency(item.totalDeductions)} FCFA` : '-'}
        </TableCell>
        <TableCell className="text-right font-semibold">
          {item.netSalary ? `${formatCurrency(item.netSalary)} FCFA` : '-'}
        </TableCell>
        {/* Employer Costs */}
        <TableCell>
          {item.cnpsEmployer ? `${formatCurrency(item.cnpsEmployer)} FCFA` : '-'}
        </TableCell>
        <TableCell>
          {(() => {
            const fdfpTotal = otherTaxesDetails
              .filter((tax: any) => tax.code?.toLowerCase().includes('fdfp'))
              .reduce((sum: number, tax: any) => sum + (tax.amount || 0), 0);
            return fdfpTotal > 0 ? `${formatCurrency(fdfpTotal)} FCFA` : '-';
          })()}
        </TableCell>
        <TableCell className="text-right font-semibold">
          {item.totalEmployerCost ? `${formatCurrency(item.totalEmployerCost)} FCFA` : '-'}
        </TableCell>
        {(status === 'approved' || status === 'paid') && (
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Button
                size="default"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewPayslip?.(item.employeeId, item.employeeName || '');
                }}
                disabled={isGeneratingPayslip}
                className="min-h-[44px] gap-2"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Voir</span>
              </Button>
              <Button
                size="default"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadPayslip?.(item.employeeId, item.employeeName || '');
                }}
                disabled={isGeneratingPayslip}
                className="min-h-[44px] gap-2"
              >
                {isGeneratingPayslip ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Chargement...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Télécharger</span>
                  </>
                )}
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>

      {/* Detailed Breakdown (Expanded) */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={status === 'approved' || status === 'paid' ? 12 : 11} className="bg-muted/30 p-6">
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={handleEditSalary}
                  variant="outline"
                  className="gap-2 min-h-[44px]"
                >
                  <Edit className="h-4 w-4" />
                  Modifier le Salaire
                </Button>

                {/* Recalculate Button (only for calculated/processing status) */}
                {(status === 'calculated' || status === 'processing') && onRecalculateEmployee && (
                  <Button
                    onClick={() => onRecalculateEmployee(item.employeeId)}
                    disabled={isRecalculating}
                    variant="outline"
                    className="gap-2 min-h-[44px]"
                  >
                    {isRecalculating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Recalcul...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Recalculer Cet Employé
                      </>
                    )}
                  </Button>
                )}

                {/* Mark Verified Button (only for calculated/processing and not already verified) */}
                {(status === 'calculated' || status === 'processing') &&
                 onMarkVerified &&
                 verificationStatus !== 'verified' &&
                 verificationStatus !== 'auto_ok' && (
                  <Button
                    onClick={() => onMarkVerified(item.employeeId)}
                    disabled={isMarkingVerified}
                    variant="default"
                    className="gap-2 min-h-[44px]"
                  >
                    {isMarkingVerified ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Vérification...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Marquer comme vérifié
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Earnings Breakdown */}
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Détails des Gains</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Base Salary */}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Salaire de base</span>
                        <span className="font-medium">{formatCurrency(item.baseSalary)} FCFA</span>
                      </div>

                      {/* Earnings Details (CDDTI components: gratification, congés payés, précarité) */}
                      {earningsDetails.length > 0 ? (
                        earningsDetails.map((earning: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{earning.name || earning.label}</span>
                            <span className="font-medium">{formatCurrency(earning.amount)} FCFA</span>
                          </div>
                        ))
                      ) : (
                        /* Legacy: Show allowances from allowances JSONB field */
                        Object.entries(allowances).map(([key, value]) => {
                          if (value > 0) {
                            const labels: Record<string, string> = {
                              housing: 'Indemnité de logement',
                              transport: 'Indemnité de transport',
                              meal: 'Indemnité de repas',
                              seniority: 'Prime d\'ancienneté',
                              family: 'Allocations familiales',
                            };
                            return (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{labels[key] || key}</span>
                                <span className="font-medium">{formatCurrency(value)} FCFA</span>
                              </div>
                            );
                          }
                        })
                      )}

                      <Separator />

                      {/* Gross Salary */}
                      <div className="flex justify-between font-semibold">
                        <span>Salaire Brut</span>
                        <span className="text-primary">{formatCurrency(item.grossSalary)} FCFA</span>
                      </div>
                    </CardContent>
                </Card>

                {/* Deductions Breakdown */}
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Détails des Déductions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Employee Contributions */}
                      {item.cnpsEmployee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">CNPS Employé</span>
                          <span className="font-medium text-destructive">-{formatCurrency(item.cnpsEmployee)} FCFA</span>
                        </div>
                      )}
                      {item.cmuEmployee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">CMU Employé</span>
                          <span className="font-medium text-destructive">-{formatCurrency(item.cmuEmployee)} FCFA</span>
                        </div>
                      )}

                      {/* Tax Deductions */}
                      {item.its > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">ITS (Impôt)</span>
                          <span className="font-medium text-destructive">-{formatCurrency(item.its)} FCFA</span>
                        </div>
                      )}

                      <Separator />

                      {/* Total Deductions */}
                      <div className="flex justify-between font-semibold">
                        <span>Total Déductions</span>
                        <span className="text-destructive">-{formatCurrency(item.totalDeductions)} FCFA</span>
                      </div>

                      <Separator />

                      {/* Net Salary */}
                      <div className="flex justify-between font-bold text-lg">
                        <span>Net à Payer</span>
                        <span className="text-primary">{formatCurrency(item.netSalary)} FCFA</span>
                      </div>
                    </CardContent>
                </Card>

                {/* Employer Cost Breakdown */}
                <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Charges Patronales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Employer Contributions - Detailed Breakdown */}
                      {contributionDetails.length > 0 ? (
                        contributionDetails
                          .filter((contrib: any) => contrib.paidBy === 'employer' && contrib.amount > 0)
                          .map((contrib: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{contrib.name}</span>
                              <span className="font-medium">{formatCurrency(contrib.amount)} FCFA</span>
                            </div>
                          ))
                      ) : (
                        /* Fallback: Show aggregated CNPS/CMU if no detailed breakdown available */
                        <>
                          {item.cnpsEmployer > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">CNPS Employeur</span>
                              <span className="font-medium">{formatCurrency(item.cnpsEmployer)} FCFA</span>
                            </div>
                          )}
                          {item.cmuEmployer > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">CMU Employeur</span>
                              <span className="font-medium">{formatCurrency(item.cmuEmployer)} FCFA</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Other Taxes (FDFP, ITS Employer) */}
                      {otherTaxesDetails.map((tax: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{tax.name}</span>
                          <span className="font-medium">{formatCurrency(tax.amount)} FCFA</span>
                        </div>
                      ))}

                      <Separator />

                      {/* Total Employer Cost */}
                      <div className="flex justify-between font-semibold">
                        <span>Coût Total Employeur</span>
                        <span className="text-primary">{formatCurrency(item.totalEmployerCost)} FCFA</span>
                      </div>
                    </CardContent>
                </Card>

                {/* Time Tracking & Time Off with Overtime Breakdown */}
                {runId ? (
                  <OvertimeBreakdownCard
                    runId={runId}
                    employeeId={item.employeeId}
                    employeeName={item.employeeName || 'Employé'}
                    daysWorked={item.daysWorked || 0}
                    daysAbsent={item.daysAbsent || 0}
                    formatCurrency={formatCurrency}
                  />
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Temps de Travail et Congés</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Days Worked */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Jours travaillés</span>
                        </div>
                        <Badge variant="outline">{item.daysWorked || 0} jours</Badge>
                      </div>

                      {/* Days Absent */}
                      {item.daysAbsent > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Plane className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Jours d'absence</span>
                          </div>
                          <Badge variant="secondary">{item.daysAbsent} jours</Badge>
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground pt-2">
                        Les détails de pointage et congés seront affichés ici
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
