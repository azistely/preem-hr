'use client';

/**
 * Documents Section Component
 * Reusable component for displaying and managing documents for any entity
 *
 * Features:
 * - Display uploaded document with download/preview
 * - Upload button that triggers inline file selection
 * - Optional label and helper text
 * - Mobile-friendly design (44px+ touch targets)
 * - French language
 *
 * Usage:
 * <DocumentsSection
 *   label="Contrat de travail"
 *   documentUrl={contract.contractFileUrl}
 *   onDocumentChange={(fileUrl) => updateContract({ contractFileUrl: fileUrl })}
 *   accept=".pdf,.jpg,.jpeg,.png"
 * />
 */

import { useState, useRef } from 'react';
import { Upload, FileText, Download, X, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';

// =====================================================
// Props Interface
// =====================================================

interface DocumentsSectionProps {
  /** Label for the document section */
  label: string;
  /** Helper text to guide user */
  helperText?: string;
  /** Current document URL (if already uploaded) */
  documentUrl?: string | null;
  /** Current document filename (optional, extracted from URL if not provided) */
  documentName?: string | null;
  /** Callback when document is uploaded/changed */
  onDocumentChange: (fileUrl: string) => void;
  /** Callback when document is removed (optional) */
  onDocumentRemove?: () => void;
  /** Accepted file types (default: .pdf,.jpg,.jpeg,.png,.docx) */
  accept?: string;
  /** Maximum file size in MB (default: 25) */
  maxSizeMB?: number;
  /** Whether to show the remove button */
  allowRemove?: boolean;
  /** Whether the section is disabled */
  disabled?: boolean;
  /** Custom className for the container */
  className?: string;
}

// =====================================================
// Main Component
// =====================================================

export function DocumentsSection({
  label,
  helperText,
  documentUrl,
  documentName,
  onDocumentChange,
  onDocumentRemove,
  accept = '.pdf,.jpg,.jpeg,.png,.docx',
  maxSizeMB = 25,
  allowRemove = false,
  disabled = false,
  className,
}: DocumentsSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload mutation
  const uploadMutation = api.documents.uploadTemporaryFile.useMutation({
    onSuccess: (result) => {
      setUploadProgress(100);
      if (result.fileUrl) {
        onDocumentChange(result.fileUrl);
      }
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    },
    onError: (error: any) => {
      setError(error.message || 'Erreur lors du téléchargement');
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  // Extract filename from URL if not provided
  const displayName = documentName || (documentUrl ? extractFilename(documentUrl) : null);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(`Le fichier est trop volumineux (max ${maxSizeMB} MB)`);
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const acceptedTypes = accept.split(',').map((t) => t.trim().toLowerCase());
    if (!acceptedTypes.includes(fileExtension)) {
      setError(`Type de fichier non autorisé. Formats acceptés: ${accept}`);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress (since we don't have real progress tracking)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Convert to base64 (browser-compatible way)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Upload using tRPC mutation
      await uploadMutation.mutateAsync({
        fileData: base64,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      clearInterval(progressInterval);
    } catch (err: any) {
      // Error handled by mutation onError callback
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle remove document
  const handleRemove = () => {
    if (onDocumentRemove) {
      onDocumentRemove();
    } else {
      onDocumentChange('');
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Label */}
      <div>
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
        {helperText && (
          <p className="text-sm text-muted-foreground mt-1">{helperText}</p>
        )}
      </div>

      {/* Current Document Display */}
      {documentUrl && !isUploading && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Téléchargé
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(documentUrl, '_blank')}
                className="min-h-[44px] min-w-[44px]"
              >
                <Download className="h-4 w-4" />
              </Button>
              {allowRemove && !disabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  className="min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Upload Button / Progress */}
      {!documentUrl && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            className="hidden"
          />

          {isUploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Téléchargement en cours... {uploadProgress}%
                </span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleUploadClick}
              disabled={disabled}
              className="w-full min-h-[56px]"
            >
              <Upload className="h-5 w-5 mr-2" />
              Télécharger un document
            </Button>
          )}
        </div>
      )}

      {/* Replace Document Button */}
      {documentUrl && !isUploading && !disabled && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleUploadClick}
            size="sm"
            className="min-h-[44px]"
          >
            <Upload className="h-4 w-4 mr-2" />
            Remplacer le document
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Extract filename from URL
 */
function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'document';
    return decodeURIComponent(filename);
  } catch {
    return 'document';
  }
}

