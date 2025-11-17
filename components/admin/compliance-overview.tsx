/**
 * Compliance Overview Component
 *
 * Shows employees approaching overtime limits and protected employees
 * For HR dashboard to monitor labor law compliance
 *
 * Displays:
 * - Employees at ≥80% of yearly overtime limit (75h)
 * - Protected employees (minors, pregnant women)
 * - Visual progress indicators
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Shield, TrendingUp, User } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface EmployeeOvertimeStatus {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  yearlyUsed: number;
  yearlyLimit: number;
  yearlyRemaining: number;
  yearlyPercentage: number;
  isAtRisk: boolean;
}

interface ProtectedEmployee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  category: 'MINOR' | 'PREGNANT' | 'PREGNANT_WITH_EXEMPTION';
  age?: number | null;
  isPregnant: boolean;
  expectedDeliveryDate?: Date | null;
  medicalExemptionExpiry?: Date | null;
}

interface ComplianceOverviewProps {
  employeesAtRisk: EmployeeOvertimeStatus[];
  protectedEmployees: ProtectedEmployee[];
  isLoading?: boolean;
}

export function ComplianceOverview({
  employeesAtRisk,
  protectedEmployees,
  isLoading,
}: ComplianceOverviewProps) {
  const [overtimeExpanded, setOvertimeExpanded] = useState(true);
  const [protectedExpanded, setProtectedExpanded] = useState(true);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Conformité du code du travail
          </CardTitle>
          <CardDescription>Chargement des données de conformité...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasComplianceIssues = employeesAtRisk.length > 0 || protectedEmployees.length > 0;

  if (!hasComplianceIssues) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <Shield className="h-5 w-5" />
            Conformité du code du travail
          </CardTitle>
          <CardDescription className="text-green-700">
            ✓ Aucun problème de conformité détecté
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overtime Limits Warning */}
      {employeesAtRisk.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <Collapsible open={overtimeExpanded} onOpenChange={setOvertimeExpanded}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-orange-900 flex items-center gap-2">
                      Limites d'heures supplémentaires
                      <Badge variant="secondary" className="bg-orange-200 text-orange-900">
                        {employeesAtRisk.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      Employés approchant la limite annuelle de 75h
                    </CardDescription>
                  </div>
                </div>
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </CollapsibleTrigger>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="space-y-3">
                {employeesAtRisk.map((employee) => (
                  <div
                    key={employee.id}
                    className="bg-white rounded-lg p-4 border border-orange-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-sm">{employee.fullName}</span>
                      </div>
                      <Badge
                        variant={employee.yearlyPercentage >= 90 ? 'destructive' : 'secondary'}
                        className={
                          employee.yearlyPercentage >= 90
                            ? ''
                            : 'bg-orange-100 text-orange-900'
                        }
                      >
                        {employee.yearlyPercentage.toFixed(0)}%
                      </Badge>
                    </div>

                    <Progress value={employee.yearlyPercentage} className="h-2" />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {employee.yearlyUsed.toFixed(1)}h utilisées sur {employee.yearlyLimit}h
                      </span>
                      <span className="font-medium text-orange-700">
                        {employee.yearlyRemaining.toFixed(1)}h restantes
                      </span>
                    </div>

                    {employee.yearlyPercentage >= 95 && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                        ⚠️ Limite presque atteinte - Vérifier avant toute approbation
                      </div>
                    )}
                  </div>
                ))}

                <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded text-sm text-orange-900">
                  <strong>Convention Collective Article 23:</strong> Maximum 75 heures
                  supplémentaires par an et par employé
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Protected Employees */}
      {protectedEmployees.length > 0 && (
        <Card className="border-purple-200 bg-purple-50">
          <Collapsible open={protectedExpanded} onOpenChange={setProtectedExpanded}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <CardTitle className="text-purple-900 flex items-center gap-2">
                      Employés protégés
                      <Badge variant="secondary" className="bg-purple-200 text-purple-900">
                        {protectedEmployees.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-purple-700">
                      Mineurs et femmes enceintes
                    </CardDescription>
                  </div>
                </div>
                <Shield className="h-5 w-5 text-purple-600" />
              </CollapsibleTrigger>
            </CardHeader>

            <CollapsibleContent>
              <CardContent className="space-y-3">
                {protectedEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="bg-white rounded-lg p-4 border border-purple-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-sm">{employee.fullName}</span>
                      </div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-900">
                        {employee.category === 'MINOR'
                          ? `Mineur (${employee.age} ans)`
                          : employee.category === 'PREGNANT_WITH_EXEMPTION'
                          ? 'Enceinte (exemption)'
                          : 'Enceinte'}
                      </Badge>
                    </div>

                    {employee.category === 'MINOR' && (
                      <div className="text-xs text-purple-800 space-y-1">
                        <p>🚫 Travail de nuit interdit (21h-5h)</p>
                        <p>🚫 Travaux dangereux interdits</p>
                      </div>
                    )}

                    {employee.category === 'PREGNANT' && (
                      <div className="text-xs text-purple-800 space-y-1">
                        <p>🚫 Travail de nuit interdit sans certificat médical</p>
                        {employee.expectedDeliveryDate && (
                          <p>
                            📅 Date d'accouchement prévue:{' '}
                            {new Date(employee.expectedDeliveryDate).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        <p>✓ Congé de maternité: 14 semaines</p>
                      </div>
                    )}

                    {employee.category === 'PREGNANT_WITH_EXEMPTION' && (
                      <div className="text-xs text-purple-800 space-y-1">
                        <p>✓ Travail de nuit autorisé par certificat médical</p>
                        {employee.medicalExemptionExpiry && (
                          <p>
                            📋 Certificat valide jusqu'au:{' '}
                            {new Date(employee.medicalExemptionExpiry).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        <p>✓ Congé de maternité: 14 semaines</p>
                      </div>
                    )}
                  </div>
                ))}

                <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded text-sm text-purple-900">
                  <strong>Code du Travail:</strong> Les mineurs et les femmes enceintes ne peuvent
                  pas travailler la nuit (21h-5h)
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  );
}
