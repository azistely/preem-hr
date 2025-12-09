'use client';

/**
 * Manager Document Requests Page
 *
 * Allows managers to request documents on behalf of their team members.
 * HCI Principles: Task-oriented design, clear team selection
 */

import { RequestForTeam } from '@/features/document-requests/components/manager';

export default function ManagerDocumentRequestsPage() {
  return (
    <div className="container mx-auto max-w-6xl py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Demandes de documents</h1>
        <p className="text-muted-foreground mt-2">
          Demander des documents administratifs pour votre équipe
        </p>
      </div>

      <RequestForTeam />
    </div>
  );
}
