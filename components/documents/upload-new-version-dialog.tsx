'use client';

/**
 * Upload New Version Dialog
 * Epic: Document Management - Version Control
 *
 * Features:
 * - Upload new version of existing document
 * - Optional version notes explaining changes
 * - File validation (size, type)
 * - Progress indication
 * - Auto-increments version number
 *
 * Design principles:
 * - Simple 2-step process (Select file → Add notes → Upload)
 * - Clear feedback during upload
 * - Touch-friendly (min 44px buttons)
 * - French language throughout
 */

import { useState } from 'react';
import { Upload, FileUp, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

// =====================================================
// Types
// =====================================================

interface UploadNewVersionDialogProps {
  originalDocumentId: string;
  originalDocumentName: string;
  currentVersionNumber: number;
  trigger?: React.ReactNode;
}

// =====================================================
// Constants
// =====================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// =====================================================
// Helper Functions
// =====================================================

function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Fichier trop volumineux (max 10 MB)',
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Type de fichier non autorisé (PDF, Images, Word, Excel uniquement)',
    };
  }

  return { valid: true };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// =====================================================
// Main Component
// =====================================================

export function UploadNewVersionDialog({
  originalDocumentId,
  originalDocumentName,
  currentVersionNumber,
  trigger,
}: UploadNewVersionDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const utils = api.useUtils();

  // Create version mutation
  const createVersionMutation = api.documents.createDocumentVersion.useMutation({
    onSuccess: (data) => {
      toast.success(`Version ${data.versionNumber} créée avec succès`);
      setOpen(false);
      resetForm();
      utils.documents.listUploaded.invalidate();
      utils.documents.getDocumentVersionHistory.invalidate({ documentId: originalDocumentId });
      utils.documents.getDocumentVersionStats.invalidate({ documentId: originalDocumentId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de la création de la version');
      setIsUploading(false);
    },
  });

  // =====================================================
  // Handlers
  // =====================================================

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Fichier invalide');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setValidationError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `document-versions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || 'Erreur lors du téléversement');
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Impossible de récupérer l\'URL du fichier');
      }

      // 2. Create version record in database
      await createVersionMutation.mutateAsync({
        originalDocumentId,
        fileUrl: urlData.publicUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        versionNotes: versionNotes.trim() || undefined,
      });
    } catch (error: any) {
      console.error('[Upload New Version] Error:', error);
      toast.error(error.message || 'Erreur lors de la création de la version');
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setVersionNotes('');
    setValidationError(null);
    setIsUploading(false);
  };

  const handleCancel = () => {
    resetForm();
    setOpen(false);
  };

  // =====================================================
  // Render
  // =====================================================

  const nextVersionNumber = currentVersionNumber + 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle version
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Téléverser une nouvelle version
          </DialogTitle>
          <DialogDescription>
            Document : <span className="font-medium text-foreground">{originalDocumentName}</span>
            <br />
            Nouvelle version : <span className="font-medium text-primary">v{nextVersionNumber}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Selection */}
          <div>
            <Label htmlFor="file-upload" className="text-base mb-3 block">
              Sélectionner un fichier
            </Label>

            <div className="relative">
              <input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept={ALLOWED_MIME_TYPES.join(',')}
                disabled={isUploading}
              />
              <Label
                htmlFor="file-upload"
                className={`
                  flex items-center justify-center gap-3 min-h-[120px] border-2 border-dashed rounded-lg
                  cursor-pointer transition-colors
                  ${
                    isUploading
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-primary hover:bg-primary/5'
                  }
                  ${selectedFile ? 'border-primary bg-primary/5' : 'border-border'}
                `}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="font-medium">{selectedFile.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatFileSize(selectedFile.size)}
                    </div>
                    {!isUploading && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Cliquez pour changer de fichier
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <div className="font-medium">Cliquez pour sélectionner un fichier</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      PDF, Images, Word, Excel (max 10 MB)
                    </div>
                  </div>
                )}
              </Label>
            </div>

            {/* Validation Error */}
            {validationError && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Version Notes */}
          <div>
            <Label htmlFor="version-notes" className="text-base mb-2 block">
              Notes de version <span className="text-muted-foreground text-sm">(optionnel)</span>
            </Label>
            <Textarea
              id="version-notes"
              placeholder="Décrivez les changements effectués dans cette version..."
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              className="min-h-[100px]"
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Exemples : "Mise à jour du salaire", "Correction de l'adresse", "Nouvelle clause ajoutée"
            </p>
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              La version actuelle (v{currentVersionNumber}) sera conservée dans l'historique. La
              nouvelle version (v{nextVersionNumber}) deviendra la version active.
            </AlertDescription>
          </Alert>
        </div>

        {/* Footer Buttons */}
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isUploading}
            className="min-h-[44px]"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="min-h-[44px]"
          >
            {isUploading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Téléversement en cours...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Téléverser v{nextVersionNumber}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
