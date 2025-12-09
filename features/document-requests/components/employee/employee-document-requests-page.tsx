'use client';

/**
 * Employee Document Requests Main Page
 *
 * Combines the request wizard and request history in a user-friendly interface.
 * HCI Principles: Clear primary action, easy access to history, progressive disclosure
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { RequestDocumentWizard } from './request-document-wizard';
import { MyDocumentRequests } from './my-document-requests';

interface EmployeeDocumentRequestsPageProps {
  employeeId: string;
  employeeName: string;
}

export function EmployeeDocumentRequestsPage({
  employeeId,
  employeeName,
}: EmployeeDocumentRequestsPageProps) {
  const [showRequestWizard, setShowRequestWizard] = useState(false);

  return (
    <div className="container max-w-4xl py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demandes de documents</h1>
          <p className="text-muted-foreground mt-2">
            Demandez des documents administratifs aux Ressources Humaines
          </p>
        </div>
        <Button
          onClick={() => setShowRequestWizard(true)}
          size="lg"
          className="min-h-[48px]"
        >
          <Plus className="mr-2 h-5 w-5" />
          Demander un document
        </Button>
      </div>

      <MyDocumentRequests />

      <Dialog open={showRequestWizard} onOpenChange={setShowRequestWizard}>
        <DialogContent className="max-w-2xl p-0">
          <VisuallyHidden>
            <DialogTitle>Demander un document</DialogTitle>
          </VisuallyHidden>
          <RequestDocumentWizard
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
