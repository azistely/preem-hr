'use client';

/**
 * Document Version History Component
 * Epic: Document Management - Version Control
 *
 * Features:
 * - Timeline view of all document versions
 * - Version comparison
 * - Rollback capability (HR only)
 * - Download any version
 * - View version notes and metadata
 *
 * Design principles:
 * - Clear visual hierarchy (latest version prominently displayed)
 * - Touch-friendly (min 44px buttons)
 * - French language throughout
 * - Mobile-first responsive design
 */

import { useState } from 'react';
import {
  History,
  Download,
  RotateCcw,
  Eye,
  FileText,
  Clock,
  User,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// =====================================================
// Types
// =====================================================

interface DocumentVersionHistoryProps {
  documentId: string;
  documentName: string;
  trigger?: React.ReactNode;
  isHRManager?: boolean;
}

// =====================================================
// Helper Functions
// =====================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function getApprovalStatusBadge(status: string | null) {
  if (!status) return null;

  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approuvé
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Refusé
        </Badge>
      );
    default:
      return null;
  }
}

function getSignatureStatusBadge(status: string | null) {
  if (!status) return null;

  switch (status) {
    case 'signed':
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Signé
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          <Clock className="h-3 w-3 mr-1" />
          Signature en attente
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Signature refusée
        </Badge>
      );
    default:
      return null;
  }
}

// =====================================================
// Main Component
// =====================================================

export function DocumentVersionHistory({
  documentId,
  documentName,
  trigger,
  isHRManager = false,
}: DocumentVersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [selectedVersionForRollback, setSelectedVersionForRollback] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch version history
  const { data: versions, isLoading } = api.documents.getDocumentVersionHistory.useQuery(
    { documentId },
    { enabled: open }
  );

  // Fetch version stats
  const { data: stats } = api.documents.getDocumentVersionStats.useQuery(
    { documentId },
    { enabled: open }
  );

  // Rollback mutation
  const rollbackMutation = api.documents.rollbackDocumentVersion.useMutation({
    onSuccess: () => {
      toast.success('Version restaurée avec succès');
      utils.documents.getDocumentVersionHistory.invalidate({ documentId });
      utils.documents.getDocumentVersionStats.invalidate({ documentId });
      utils.documents.listUploaded.invalidate();
      setSelectedVersionForRollback(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la restauration de la version');
    },
  });

  const handleRollback = () => {
    if (!selectedVersionForRollback) return;
    rollbackMutation.mutate({ versionId: selectedVersionForRollback });
  };

  // =====================================================
  // Render
  // =====================================================

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="min-h-[44px]">
              <History className="h-4 w-4 mr-2" />
              Historique des versions
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des versions
            </DialogTitle>
            <DialogDescription>
              Document : <span className="font-medium text-foreground">{documentName}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Statistics Summary */}
          {stats && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Statistiques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total versions</div>
                    <div className="text-2xl font-bold">{stats.totalVersions}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Version actuelle</div>
                    <div className="text-2xl font-bold">v{stats.latestVersion}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Versions signées</div>
                    <div className="text-2xl font-bold">{stats.signedVersions}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Taille totale</div>
                    <div className="text-2xl font-bold">{formatFileSize(stats.totalSizeBytes)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Version Timeline */}
          <ScrollArea className="flex-1 pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : !versions || versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune version trouvée</p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {versions.map((version, index) => (
                  <Card
                    key={version.id}
                    className={`relative ${
                      version.isLatestVersion
                        ? 'border-primary border-2 bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    {/* Latest Version Badge */}
                    {version.isLatestVersion && (
                      <div className="absolute -top-3 left-4">
                        <Badge variant="default" className="shadow-sm">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Version actuelle
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                            v{version.versionNumber}
                          </div>
                          <div>
                            <CardTitle className="text-base">{version.fileName}</CardTitle>
                            <CardDescription className="mt-1">
                              {formatFileSize(version.fileSize)} •{' '}
                              {formatDistanceToNow(new Date(version.uploadedAt), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </CardDescription>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Download */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px] min-w-[44px]"
                            onClick={() => window.open(version.fileUrl, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>

                          {/* Rollback (HR only, not for latest) */}
                          {isHRManager && !version.isLatestVersion && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px] min-w-[44px]"
                              onClick={() => setSelectedVersionForRollback(version.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 space-y-3">
                      {/* Version Notes */}
                      {version.versionNotes && (
                        <div className="p-3 bg-muted rounded-md text-sm">
                          <div className="font-medium text-xs text-muted-foreground mb-1">
                            Notes de version :
                          </div>
                          <p className="text-foreground">{version.versionNotes}</p>
                        </div>
                      )}

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        {getApprovalStatusBadge(version.approvalStatus)}
                        {getSignatureStatusBadge(version.signatureStatus)}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Téléversé par {version.uploadedBy}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(version.uploadedAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </CardContent>

                    {/* Version Connector Line */}
                    {index < versions.length - 1 && (
                      <div className="absolute left-9 bottom-0 w-0.5 h-4 bg-border translate-y-full" />
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog
        open={!!selectedVersionForRollback}
        onOpenChange={(open) => !open && setSelectedVersionForRollback(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action marquera la version sélectionnée comme version actuelle. La version
              actuelle sera conservée dans l'historique mais ne sera plus la version active.
              <br />
              <br />
              Cette action est réversible - vous pourrez revenir à n'importe quelle version plus
              tard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollbackMutation.isPending}
              className="bg-primary"
            >
              {rollbackMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Restauration...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restaurer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
