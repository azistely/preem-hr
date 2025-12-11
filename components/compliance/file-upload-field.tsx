'use client';

/**
 * Multi-File Upload Component for Compliance Trackers
 *
 * Features:
 * - Multiple file upload (drag & drop or click)
 * - Camera/photo capture on mobile
 * - Preview uploaded files
 * - Remove individual files
 * - Progress tracking
 *
 * Supported file types: PDF, JPEG, PNG, DOCX
 * Max file size: 25MB per file
 */

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  Loader2,
  Camera,
  Image as ImageIcon,
  File,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

interface FileUploadFieldProps {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  className?: string;
}

export function FileUploadField({
  value = [],
  onChange,
  disabled = false,
  maxFiles = 10,
  className,
}: FileUploadFieldProps) {
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string>('');
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = api.documents.uploadTemporaryFile.useMutation();

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Start progress tracking
      setUploadingFiles((prev) => new Map(prev).set(tempId, 0));

      // Simulate initial progress
      const progressInterval = setInterval(() => {
        setUploadingFiles((prev) => {
          const current = prev.get(tempId) || 0;
          if (current >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          const newMap = new Map(prev);
          newMap.set(tempId, current + 10);
          return newMap;
        });
      }, 150);

      // Convert to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Upload
      const result = await uploadMutation.mutateAsync({
        fileData: base64,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      clearInterval(progressInterval);
      setUploadingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });

      if (result.fileUrl) {
        return {
          id: tempId,
          name: file.name,
          url: result.fileUrl,
          size: file.size,
          type: file.type,
        };
      }
      return null;
    } catch (error: any) {
      setUploadingFiles((prev) => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });
      setErrorMessage(error.message || `Erreur lors du téléchargement de ${file.name}`);
      return null;
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return;

      setErrorMessage('');

      // Check max files limit
      const remainingSlots = maxFiles - value.length;
      if (remainingSlots <= 0) {
        setErrorMessage(`Nombre maximum de fichiers atteint (${maxFiles})`);
        return;
      }

      const filesToUpload = acceptedFiles.slice(0, remainingSlots);

      // Validate each file
      const validFiles: File[] = [];
      for (const file of filesToUpload) {
        if (file.size > 25 * 1024 * 1024) {
          setErrorMessage(`${file.name}: Taille maximale dépassée (25MB)`);
          continue;
        }
        validFiles.push(file);
      }

      // Upload all valid files
      const uploadPromises = validFiles.map((file) => uploadFile(file));
      const results = await Promise.all(uploadPromises);

      // Add successful uploads to value
      const successfulUploads = results.filter((r): r is UploadedFile => r !== null);
      if (successfulUploads.length > 0) {
        onChange([...value, ...successfulUploads]);
      }
    },
    [value, onChange, disabled, maxFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 25 * 1024 * 1024,
    multiple: true,
    disabled,
  });

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await onDrop(Array.from(files));
    }
    // Reset input so same file can be selected again
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    onChange(value.filter((f) => f.id !== fileId));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const isUploading = uploadingFiles.size > 0;
  const canAddMore = value.length < maxFiles && !disabled;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden camera input for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />

      {/* Dropzone */}
      {canAddMore && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isDragActive ? 'Déposez les fichiers ici' : 'Glissez des fichiers ou cliquez pour sélectionner'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, JPEG, PNG, DOCX (max 25MB par fichier)
          </p>

          {/* Camera button for mobile */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 min-h-[44px]"
            onClick={(e) => {
              e.stopPropagation();
              handleCameraCapture();
            }}
            disabled={disabled}
          >
            <Camera className="h-4 w-4 mr-2" />
            Prendre une photo
          </Button>
        </div>
      )}

      {/* Uploading files progress */}
      {isUploading && (
        <div className="space-y-2">
          {Array.from(uploadingFiles.entries()).map(([id, progress]) => (
            <div key={id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Téléchargement en cours...</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ))}
        </div>
      )}

      {/* Uploaded files list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 border rounded-lg p-3 bg-muted/30"
            >
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => removeFile(file.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File count indicator */}
      {maxFiles > 1 && (
        <p className="text-xs text-muted-foreground text-right">
          {value.length} / {maxFiles} fichier{maxFiles > 1 ? 's' : ''}
        </p>
      )}

      {/* Error message */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
