'use client';

import { api } from '@/server/api/client';
import { EmployeeAdvancesPage } from '@/features/salary-advances/components/employee';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function SalaryAdvancesPage() {
  const { data: user, isLoading } = api.auth.me.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user?.employeeId) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Profil employé non trouvé. Veuillez contacter les Ressources Humaines.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <EmployeeAdvancesPage
      employeeId={user.employeeId}
      employeeName={`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Employé'}
    />
  );
}
