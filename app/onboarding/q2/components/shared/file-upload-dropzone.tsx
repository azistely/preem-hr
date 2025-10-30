/**
 * File Upload Dropzone
 * HCI: Large drop area, visual feedback, file type validation
 */

'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadDropzoneProps {
  onFileSelect: (file: File) => void;
  dataSource: 'excel' | 'sage' | 'manual';
}

export function FileUploadDropzone({ onFileSelect, dataSource }: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const acceptedFormats = ['.xlsx', '.xls', '.csv'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.includes(extension)) {
      return `Format non supporté. Utilisez: ${acceptedFormats.join(', ')}`;
    }

    // Check file size
    if (file.size > maxSize) {
      return `Fichier trop volumineux. Maximum: 10 MB`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    // Simulate processing delay
    setTimeout(() => {
      onFileSelect(file);
      setIsProcessing(false);
    }, 500);
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div className="space-y-4">
      <Card
        className={`
          border-2 border-dashed transition-all cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5 scale-105' : 'border-gray-300 hover:border-primary'}
          ${error ? 'border-red-500' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CardContent className="p-12 text-center">
          {isProcessing ? (
            <div className="space-y-4">
              <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
              <div>
                <p className="text-lg font-medium">Lecture du fichier...</p>
                <p className="text-sm text-muted-foreground">Veuillez patienter</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                {isDragging ? (
                  <Upload className="w-10 h-10 text-primary animate-bounce" />
                ) : (
                  <FileSpreadsheet className="w-10 h-10 text-primary" />
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">
                  {isDragging ? 'Déposez le fichier ici' : 'Glissez votre fichier ici'}
                </h3>
                <p className="text-muted-foreground">
                  ou cliquez pour parcourir
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Formats acceptés: {acceptedFormats.join(', ')}</p>
                <p>Taille maximum: 10 MB</p>
              </div>

              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept={acceptedFormats.join(',')}
                onChange={handleFileInput}
              />
              <label htmlFor="file-upload">
                <Button asChild className="min-h-[56px] text-lg cursor-pointer">
                  <span>
                    <Upload className="w-5 h-5 mr-2" />
                    Parcourir les fichiers
                  </span>
                </Button>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Erreur de fichier</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Helper text specific to data source */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          {dataSource === 'excel' ? (
            <>
              💡 <strong>Astuce:</strong> Si vous avez vos données dans Excel, vous pouvez les copier directement dans notre modèle.
            </>
          ) : (
            <>
              💡 <strong>SAGE/CIEL:</strong> Exportez la liste des employés en format CSV ou Excel depuis votre logiciel.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
