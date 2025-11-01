/**
 * Employee Salary Edit Page
 *
 * Direct route to edit employee salary without navigating through employee detail page.
 * Provides a streamlined experience when clicking "Edit Salary" from payroll review.
 *
 * Route: /employees/[id]/salary/edit
 *
 * Features:
 * - Full-screen salary change wizard
 * - Browser back button support
 * - Sticky header with employee context
 * - Automatic redirect after save
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc/client';
import { SalaryChangeWizard } from '@/features/employees/components/salary/salary-change-wizard';

interface SalaryEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function SalaryEditPage({ params }: SalaryEditPageProps) {
  const router = useRouter();

  // Next.js 15: Unwrap async params
  const resolvedParams = React.use(params);
  const employeeId = resolvedParams.id;

  // Fetch employee data
  const { data: employee, isLoading: isLoadingEmployee } = trpc.employees.getById.useQuery({
    id: employeeId,
  });

  // Fetch current salary information
  const { data: currentSalaryHistory } = trpc.salaries.getHistory.useQuery({
    employeeId,
  }, {
    enabled: !!employee,
  });

  const handleCancel = () => {
    router.back();
  };

  const handleSuccess = () => {
    // Redirect back to previous page (could be payroll review or employee detail)
    router.back();
  };

  // Get current salary from history (most recent entry)
  // The query returns an array directly, sorted by effectiveFrom DESC
  const currentSalary = currentSalaryHistory?.[0] || null;

  if (isLoadingEmployee || !employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentSalary) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Aucun historique de salaire trouvé pour cet employé. Veuillez d'abord définir un salaire depuis la fiche employé.
          </AlertDescription>
        </Alert>
        <Button onClick={handleCancel} className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>

          {/* Employee Info Card */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">
                    {(employee as any).firstName} {(employee as any).lastName}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Modification du salaire
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - Salary Change Wizard */}
      <div className="container mx-auto px-4 py-6">
        {(() => {
          // Extract allowances from JSONB
          const allowances = (currentSalary.allowances as any) || {};
          const components = (currentSalary.components as any) || [];

          return (
            <SalaryChangeWizard
              employeeId={employeeId}
              employeeName={`${(employee as any).firstName} ${(employee as any).lastName}`}
              currentSalary={{
                baseSalary: parseFloat(currentSalary.baseSalary) || 0,
                housingAllowance: allowances.housing || 0,
                transportAllowance: allowances.transport || 0,
                mealAllowance: allowances.meal || 0,
                components: Array.isArray(components) ? components : [],
              }}
              onSuccess={handleSuccess}
            />
          );
        })()}
      </div>
    </div>
  );
}
