'use client';

/**
 * Temporary File Upload Component
 *
 * Simple file upload for hire wizard (before employee exists).
 * Uploads to temporary storage and returns public URL.
 * No database record created.
 */

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

interface TempFileUploadProps {
  onUploadSuccess: (fileUrl: string, fileName: string) => void;
  className?: string;
}

export function TempFileUpload({ onUploadSuccess, className }: TempFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const uploadMutation = api.documents.uploadTemporaryFile.useMutation({
    onSuccess: (result) => {
      setUploadStatus('success');
      setUploadProgress(100);
      if (result.fileUrl && selectedFile) {
        onUploadSuccess(result.fileUrl, selectedFile.name);
      }
    },
    onError: (error: any) => {
      setUploadStatus('error');
      setErrorMessage(error.message || 'Échec du téléchargement');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadStatus('idle');
      setErrorMessage('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    multiple: false,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Convert to base64 (browser-compatible way)
      const arrayBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      await uploadMutation.mutateAsync({
        fileData: base64,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
      });

      clearInterval(progressInterval);
    } catch (error) {
      clearInterval(progressInterval);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {!selectedFile && uploadStatus === 'idle' && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            {isDragActive ? 'Déposez le fichier ici' : 'Glissez un fichier ou cliquez pour sélectionner'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            PDF, JPEG, PNG (max 25MB)
          </p>
        </div>
      )}

      {selectedFile && uploadStatus === 'idle' && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-10 w-10 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            onClick={handleUpload}
            className="w-full mt-4"
          >
            Uploader
          </Button>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium">Téléchargement en cours...</p>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {uploadStatus === 'success' && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-900">
            Fichier uploadé avec succès!
          </AlertDescription>
        </Alert>
      )}

      {uploadStatus === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
