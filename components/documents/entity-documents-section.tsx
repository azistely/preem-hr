/**
 * Entity Documents Section
 *
 * Reusable component to display and manage documents linked to specific entities
 * (contracts, benefits, dependents, leave requests, company documents).
 *
 * Uses the uploaded_documents table with versioning, e-signatures, and approval workflows.
 * Documents are linked via metadata JSONB field.
 *
 * HCI Principles:
 * - Progressive disclosure: Show list, open dialog for upload
 * - Immediate feedback: Upload progress, success confirmation
 * - Zero learning curve: Simple "Upload" button
 * - French language throughout
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadDocumentDialog } from '@/components/documents/upload-document-dialog';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Download,
  Eye,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EntityDocumentsSectionProps {
  /** Document category code (e.g., 'contract', 'benefit', 'dependent') */
  category: string;

  /** Entity ID to filter documents by (stored in metadata) */
  entityId: string;

  /** Employee ID for the upload dialog */
  employeeId?: string | null;

  /** Section title */
  label: string;

  /** Helper text shown below the title */
  helperText?: string;

  /** Whether to show the upload button */
  allowUpload?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Metadata key name for entity reference (defaults to '{category}Id') */
  metadataKey?: string;
}

export function EntityDocumentsSection({
  category,
  entityId,
  employeeId,
  label,
  helperText,
  allowUpload = true,
  className,
  metadataKey,
}: EntityDocumentsSectionProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Determine metadata key (e.g., 'contractId', 'benefitId', 'dependentId')
  const effectiveMetadataKey = metadataKey || `${category}Id`;

  // Query documents for this entity
  const { data: documentsResponse, isLoading, refetch } = trpc.documents.listUploaded.useQuery({
    documentCategory: category,
    // Note: The backend needs to support metadata filtering
    // For now, we'll filter client-side until backend is updated
  });

  // Filter documents by entity ID in metadata
  const filteredDocuments = documentsResponse?.documents?.filter((doc: any) => {
    const metadata = doc.metadata as Record<string, any> || {};
    return metadata[effectiveMetadataKey] === entityId;
  }) || [];

  const handleUploadSuccess = () => {
    toast.success('Document téléchargé avec succès');
    setShowUploadDialog(false);
    refetch();
  };

  const getApprovalStatusBadge = (status: string) => {
    const badges = {
      pending: { variant: 'outline' as const, label: 'En attente', icon: Clock },
      approved: { variant: 'default' as const, label: 'Approuvé', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, label: 'Rejeté', icon: XCircle },
    };
    const badge = badges[status as keyof typeof badges] || badges.approved;
    const Icon = badge.icon;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {badge.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {label}
              </CardTitle>
              {helperText && (
                <CardDescription className="mt-1">{helperText}</CardDescription>
              )}
            </div>
            {allowUpload && (
              <Button
                onClick={() => setShowUploadDialog(true)}
                className="min-h-[44px] gap-2"
              >
                <Upload className="h-4 w-4" />
                Télécharger
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredDocuments.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun document téléchargé
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate">{doc.fileName}</h4>
                      {doc.approvalStatus && getApprovalStatusBadge(doc.approvalStatus)}
                      {doc.versionNumber > 1 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <History className="h-3 w-3" />
                          v{doc.versionNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>
                        Téléchargé le {format(new Date(doc.uploadedAt), 'PPP', { locale: fr })}
                      </span>
                      {doc.fileSize && (
                        <span>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                      )}
                      {doc.expiryDate && (
                        <span className="text-orange-600">
                          Expire le {format(new Date(doc.expiryDate), 'PP', { locale: fr })}
                        </span>
                      )}
                    </div>
                    {doc.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">
                        Raison du rejet: {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {doc.fileUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="min-h-[36px] min-w-[36px] p-2"
                        >
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Voir le document"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="min-h-[36px] min-w-[36px] p-2"
                        >
                          <a
                            href={doc.fileUrl}
                            download={doc.fileName}
                            title="Télécharger le document"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <UploadDocumentDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        employeeId={employeeId}
        defaultCategory={category}
        onUploadSuccess={(result) => {
          // The metadata with entityId should be set by the parent component
          // when they call the upload mutation
          handleUploadSuccess();
        }}
        // Pass metadata to be stored with the document
        metadata={{
          [effectiveMetadataKey]: entityId,
        }}
      />
    </div>
  );
}
