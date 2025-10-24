/**
 * Employee Documents Page
 *
 * Self-service portal for employees to view and download their documents:
 * - Pay slips (Bulletins de paie)
 * - Work certificates (Certificats de travail)
 * - Other HR documents
 *
 * Following HCI principles:
 * - Zero learning curve (obvious card-based layout)
 * - Progressive disclosure (grouped by type)
 * - Mobile-first (touch targets ≥ 44px)
 * - Audit trail (logs all document access)
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileText,
  Eye,
  Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeeDocumentsPage() {
  // Fetch all documents for current employee
  const { data: documents, isLoading } = trpc.documents.getMyDocuments.useQuery();

  // Mutation to log document access
  const logAccess = trpc.documents.logDocumentAccess.useMutation();

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR').format(numAmount) + ' FCFA';
  };

  const getDocumentLabel = (documentType: string) => {
    const labels: Record<string, string> = {
      bulletin_de_paie: 'Bulletin de Paie',
      certificat_de_travail: 'Certificat de Travail',
      solde_de_tout_compte: 'Solde de Tout Compte',
      attestation_cnps: 'Attestation CNPS',
    };
    return labels[documentType] || documentType;
  };

  const handleView = async (documentId: string, fileUrl: string) => {
    // Log access
    await logAccess.mutateAsync({
      documentId,
      accessType: 'view',
    });

    // Open document in new tab
    window.open(fileUrl, '_blank');
  };

  const handleDownload = async (documentId: string, fileUrl: string) => {
    // Log access
    await logAccess.mutateAsync({
      documentId,
      accessType: 'download',
    });

    // Trigger download
    window.open(fileUrl, '_blank');
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header - Level 1: Essential */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Mes Documents</h1>
        <p className="text-muted-foreground mt-2">
          Consultez et téléchargez tous vos documents RH
        </p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Chargement des documents...</span>
            </div>
          </CardContent>
        </Card>
      ) : !documents || (documents.payslips.length === 0 && documents.others.length === 0) ? (
        /* Empty State */
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Aucun document disponible</p>
              <p className="text-sm text-muted-foreground mt-2">
                Vos documents apparaîtront ici une fois générés
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Bulletins de Paie Section */}
          {documents.payslips.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Bulletins de Paie</h2>
              <div className="space-y-3">
                {documents.payslips.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              Bulletin {doc.period ? format(new Date(doc.period + '-01'), 'MMMM yyyy', { locale: fr }) : 'N/A'}
                            </p>
                            {doc.versionNumber && doc.versionNumber > 1 && (
                              <Badge variant="secondary" className="mt-1">
                                Version {doc.versionNumber} (Corrigé)
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Généré le {format(new Date(doc.generationDate), 'dd MMM yyyy', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => handleView(doc.id, doc.fileUrl)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Voir
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => handleDownload(doc.id, doc.fileUrl)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Other Documents Section */}
          {documents.others.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Autres Documents</h2>
              <div className="space-y-3">
                {documents.others.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{getDocumentLabel(doc.documentType)}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(doc.generationDate), 'dd MMMM yyyy', { locale: fr })}
                            </p>
                            {doc.metadata && (doc.metadata as any).reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Motif: {(doc.metadata as any).reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => handleView(doc.id, doc.fileUrl)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Voir
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => handleDownload(doc.id, doc.fileUrl)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
