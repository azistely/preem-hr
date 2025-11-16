/**
 * Company Documents Tab
 *
 * Upload and manage various company documents:
 * - Business registration (RCCM)
 * - Tax ID certificate
 * - Social security registration
 * - Insurance policies
 * - Work regulations
 * - Other company documents
 *
 * Documents are stored in uploaded_documents table with category='company_document'.
 * Uses full-featured DocumentList with search, filters, versioning, and signatures.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UploadButton, DocumentList } from '@/components/documents';
import { trpc } from '@/lib/trpc/client';
import { Loader2, FileText } from 'lucide-react';


export function DocumentsTab() {
  const { data: tenant, isLoading } = trpc.tenant.getTenant.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Documents de l'Entreprise</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Registre de commerce, certificats fiscaux, polices d'assurance, règlement intérieur, etc.
              </p>
            </div>
          </div>
          <UploadButton
            employeeId={undefined}
            defaultCategory="company_document"
            uploadContext="company_documents_tab"
            metadata={{ tenantId: tenant.id }}
          />
        </CardHeader>
        <CardContent>
          <DocumentList
            employeeId={undefined}
            showActions={true}
            uploadContext="company_documents_tab"
          />
        </CardContent>
      </Card>
    </div>
  );
}
