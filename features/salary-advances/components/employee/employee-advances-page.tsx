'use client';

/**
 * Employee Salary Advances Main Page
 *
 * Combines the advances list and request wizard in a user-friendly interface
 */

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RequestAdvanceWizard } from './request-advance-wizard';
import { AdvancesList } from './advances-list';

interface EmployeeAdvancesPageProps {
  employeeId: string;
  employeeName: string;
}

export function EmployeeAdvancesPage({ employeeId, employeeName }: EmployeeAdvancesPageProps) {
  const [showRequestWizard, setShowRequestWizard] = useState(false);

  return (
    <div className="container max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Avances sur salaire</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos demandes d'avances sur salaire
        </p>
      </div>

      <AdvancesList
        employeeId={employeeId}
        onRequestNew={() => setShowRequestWizard(true)}
      />

      <Dialog open={showRequestWizard} onOpenChange={setShowRequestWizard}>
        <DialogContent className="max-w-2xl p-0">
          <RequestAdvanceWizard
            employeeId={employeeId}
            employeeName={employeeName}
            onSuccess={() => {
              setShowRequestWizard(false);
              // List will auto-refresh via tRPC
            }}
            onCancel={() => setShowRequestWizard(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
