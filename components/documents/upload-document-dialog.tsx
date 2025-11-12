'use client';

/**
 * Document Upload Dialog Component
 * Epic: Document Management System
 *
 * Features:
 * - File upload with drag & drop
 * - File validation (type, size)
 * - Category selection with role-based filtering
 * - Optional metadata (expiry date, tags)
 * - Real-time upload progress
 * - Mobile-friendly design
 *
 * Design principles:
 * - Zero learning curve: Simple 3-step wizard
 * - Error prevention: Client-side validation before upload
 * - Immediate feedback: Progress indicators and success messages
 * - Mobile-first: Touch-friendly targets, works on small screens
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Calendar, Tag, X, CheckCircle, AlertCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { api } from '@/trpc/react';
import { cn } from '@/lib/utils';

// =====================================================
// Validation Schema
// =====================================================

const uploadSchema = z.object({
  file: z.custom<File>((val) => val instanceof File, 'Fichier requis'),
  employeeId: z.string().uuid().nullable(),
  documentCategory: z.string().min(1, 'Catégorie requise'),
  documentSubcategory: z.string().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string()).optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

// =====================================================
// Props Interface
// =====================================================

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string | null; // If provided, upload for specific employee (HR feature)
  onUploadSuccess?: () => void;
}

// =====================================================
// Main Component
// =====================================================

export function UploadDocumentDialog({
  open,
  onOpenChange,
  employeeId,
  onUploadSuccess,
}: UploadDocumentDialogProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch document categories
  const { data: categories, isLoading: categoriesLoading } = api.documents.getCategories.useQuery();

  // Upload mutation
  const uploadMutation = api.documents.uploadDocument.useMutation({
    onSuccess: () => {
      setUploadStatus('success');
      setUploadProgress(100);
      setTimeout(() => {
        onUploadSuccess?.();
        handleClose();
      }, 2000);
    },
    onError: (error: any) => {
      setUploadStatus('error');
      setErrorMessage(error.message || 'Échec du téléchargement');
    },
  });

  // Form setup
  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      employeeId: employeeId || null,
      documentCategory: '',
      documentSubcategory: '',
      tags: [],
    },
  });

  // File drop handler
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];

        // Validate file size (25MB max)
        if (file.size > 25 * 1024 * 1024) {
          form.setError('file', {
            message: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} Mo). Taille maximale: 25 Mo.`,
          });
          return;
        }

        // Validate file type
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!allowedTypes.includes(file.type)) {
          form.setError('file', {
            message: 'Type de fichier non autorisé. Formats acceptés: PDF, JPEG, PNG, DOCX.',
          });
          return;
        }

        form.setValue('file', file);
        form.clearErrors('file');
      }
    },
    [form]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    multiple: false,
  });

  // Form submission
  const onSubmit = async (data: UploadFormData) => {
    try {
      setUploadStatus('uploading');
      setUploadProgress(0);

      // Convert File to base64
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 50; // First 50% for reading
          setUploadProgress(progress);
        }
      };

      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:image/png;base64, prefix

        setUploadProgress(50); // Reading complete

        // Upload to server
        await uploadMutation.mutateAsync({
          fileData: base64Data,
          fileName: data.file.name,
          fileSize: data.file.size,
          mimeType: data.file.type,
          employeeId: data.employeeId,
          documentCategory: data.documentCategory,
          documentSubcategory: data.documentSubcategory,
          expiryDate: data.expiryDate,
          tags: data.tags,
        });

        setUploadProgress(100);
      };

      reader.onerror = () => {
        setUploadStatus('error');
        setErrorMessage('Erreur lors de la lecture du fichier');
      };

      reader.readAsDataURL(data.file);
    } catch (error: any) {
      setUploadStatus('error');
      setErrorMessage(error.message || 'Une erreur est survenue');
    }
  };

  // Reset form and close
  const handleClose = () => {
    form.reset();
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
    onOpenChange(false);
  };

  // Get selected file
  const selectedFile = form.watch('file');
  const selectedCategory = form.watch('documentCategory');

  // Check if selected category requires expiry date
  const selectedCategoryData = categories?.find((c: any) => c.code === selectedCategory);
  const showExpiryDate = selectedCategory === 'id_card' || selectedCategory === 'contract';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Télécharger un document</DialogTitle>
          <DialogDescription>
            Sélectionnez un fichier et renseignez les informations nécessaires.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: File Selection */}
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fichier *</FormLabel>
                  <FormControl>
                    <div
                      {...getRootProps()}
                      className={cn(
                        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                        'hover:border-primary hover:bg-primary/5',
                        isDragActive && 'border-primary bg-primary/10',
                        form.formState.errors.file && 'border-destructive'
                      )}
                    >
                      <input {...getInputProps()} />
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      {selectedFile ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            <span className="font-medium">{selectedFile.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} Mo
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              form.setValue('file', undefined as any);
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Supprimer
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-base font-medium mb-2">
                            Glissez un fichier ici ou cliquez pour sélectionner
                          </p>
                          <p className="text-sm text-muted-foreground">
                            PDF, JPEG, PNG, DOCX (max 25 Mo)
                          </p>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Step 2: Document Category */}
            <FormField
              control={form.control}
              name="documentCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-h-[48px]">
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoriesLoading && (
                        <SelectItem value="_loading" disabled>
                          Chargement...
                        </SelectItem>
                      )}
                      {categories?.map((category: any) => (
                        <SelectItem key={category.code} value={category.code}>
                          <div className="flex items-center gap-2">
                            <span>{category.labelFr}</span>
                            {category.requiresHrApproval && (
                              <Badge variant="secondary" className="text-xs">
                                Approbation RH
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Type de document à télécharger
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Step 3: Optional Metadata */}
            {showExpiryDate && (
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Calendar className="inline h-4 w-4 mr-2" />
                      Date d'expiration
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="min-h-[48px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Pour les documents à durée limitée
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Upload Progress */}
            {uploadStatus === 'uploading' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Téléchargement en cours...</span>
                  <span className="font-medium">{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Success Message */}
            {uploadStatus === 'success' && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertDescription className="text-green-900">
                  Document téléchargé avec succès !
                  {selectedCategoryData?.requiresHrApproval &&
                    ' En attente de validation par les RH.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {uploadStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={uploadStatus === 'uploading'}
                className="min-h-[48px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  !selectedFile ||
                  !selectedCategory ||
                  uploadStatus === 'uploading' ||
                  uploadStatus === 'success'
                }
                className="min-h-[48px] min-w-[120px]"
              >
                {uploadStatus === 'uploading' ? 'Téléchargement...' : 'Télécharger'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
