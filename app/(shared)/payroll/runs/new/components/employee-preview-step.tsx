'use client';

import { api } from '@/trpc/react';
import { Check, AlertCircle, Clock, ChevronDown, Users } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DailyWorkersQuickEntry } from '@/components/admin/daily-workers-quick-entry';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface EmployeePreviewStepProps {
  periodStart: Date;
  periodEnd: Date;
}

export function EmployeePreviewStep({
  periodStart,
  periodEnd,
}: EmployeePreviewStepProps) {
  const [showQuickEntry, setShowQuickEntry] = useState(false);

  const { data: preview, isLoading, refetch } = api.payroll.getEmployeePayrollPreview.useQuery({
    periodStart,
    periodEnd,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  const missingCount = preview?.dailyWorkers.missingTimeEntries.length || 0;
  const hasValidationErrors = missingCount > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Workers Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="text-4xl font-bold text-primary">
              {preview?.monthlyWorkers.count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Employés mensuels</div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-sm">Prêts pour le calcul</span>
            </div>
          </CardContent>
        </Card>

        {/* Daily Workers Card */}
        <Card className={missingCount > 0 ? 'border-orange-500' : ''}>
          <CardHeader className="pb-3">
            <div className={`text-4xl font-bold ${missingCount > 0 ? 'text-orange-600' : 'text-primary'}`}>
              {preview?.dailyWorkers.count || 0}
            </div>
            <div className="text-sm text-muted-foreground">Employés journaliers</div>
          </CardHeader>
          <CardContent>
            {missingCount > 0 ? (
              <div className="flex items-center gap-2 text-orange-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{missingCount} sans heures saisies</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm">
                  {preview?.dailyWorkers.count === 0
                    ? 'Aucun employé journalier'
                    : 'Tous ont leurs heures'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warning for Missing Time Entries */}
      {missingCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Heures manquantes</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {missingCount} employé{missingCount > 1 ? 's' : ''} journalier
              {missingCount > 1 ? 's' : ''} n'ont pas d'heures saisies pour cette période.
            </p>
            <p className="font-semibold">
              Ces employés seront payés 0 FCFA si vous continuez sans saisir leurs heures.
            </p>
            {/* List missing employees */}
            <div className="mt-3 text-sm">
              <p className="font-medium mb-1">Employés concernés :</p>
              <ul className="list-disc list-inside space-y-1">
                {preview?.dailyWorkers.missingTimeEntries.slice(0, 5).map((emp) => (
                  <li key={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                  </li>
                ))}
                {missingCount > 5 && (
                  <li className="text-muted-foreground">
                    ... et {missingCount - 5} autre{missingCount - 5 > 1 ? 's' : ''}
                  </li>
                )}
              </ul>
            </div>
          </AlertDescription>
          <div className="mt-4">
            <Button
              onClick={() => setShowQuickEntry(true)}
              variant="outline"
              size="sm"
              className="min-h-[44px]"
            >
              <Clock className="mr-2 h-4 w-4" />
              Saisir les heures maintenant
            </Button>
          </div>
        </Alert>
      )}

      {/* Expandable Employee List */}
      {preview && preview.totalEmployees > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
            <ChevronDown className="h-4 w-4" />
            Voir la liste complète des employés ({preview.totalEmployees})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="space-y-4">
              {/* Monthly Workers */}
              {preview.monthlyWorkers.count > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Employés mensuels ({preview.monthlyWorkers.count})
                  </h4>
                  <div className="border rounded-lg divide-y">
                    {preview.monthlyWorkers.employees.map((emp) => (
                      <div
                        key={emp.id}
                        className="p-3 flex items-center justify-between hover:bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{emp.employeeNumber}</p>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Prêt</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Workers */}
              {preview.dailyWorkers.count > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Employés journaliers ({preview.dailyWorkers.count})
                  </h4>
                  <div className="border rounded-lg divide-y">
                    {preview.dailyWorkers.employees.map((emp) => {
                      const isMissing = preview.dailyWorkers.missingTimeEntries.some(
                        (missing) => missing.id === emp.id
                      );
                      return (
                        <div
                          key={emp.id}
                          className={`p-3 flex items-center justify-between hover:bg-muted/50 ${
                            isMissing ? 'bg-orange-50' : ''
                          }`}
                        >
                          <div>
                            <p className="font-medium">
                              {emp.firstName} {emp.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{emp.employeeNumber}</p>
                          </div>
                          {isMissing ? (
                            <div className="flex items-center gap-2 text-orange-600">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Heures manquantes</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-green-600">
                              <Check className="h-4 w-4" />
                              <span className="text-sm">Heures saisies</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Quick Entry Modal */}
      {showQuickEntry && (
        <DailyWorkersQuickEntry
          open={showQuickEntry}
          onOpenChange={setShowQuickEntry}
          date={periodStart} // Start with first day of period
          onSuccess={() => {
            refetch(); // Refresh preview after time entry
            setShowQuickEntry(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Export validation function to be used by wizard
 */
export function validateEmployeePreview(missingCount: number): boolean {
  return missingCount === 0;
}
