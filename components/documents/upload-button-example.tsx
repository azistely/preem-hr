'use client';

/**
 * Upload Button Example
 *
 * Shows how to integrate the UploadDocumentDialog component
 * into any page. Can be used by both employees and HR managers.
 *
 * Usage Examples:
 *
 * 1. Employee self-service (upload their own documents):
 *    <UploadButton />
 *
 * 2. HR uploading for a specific employee:
 *    <UploadButton employeeId="uuid-here" />
 */

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadDocumentDialog } from './upload-document-dialog';
import { api } from '@/trpc/react';

interface UploadButtonProps {
  employeeId?: string; // If provided, upload for specific employee (HR feature)
  onUploadSuccess?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

export function UploadButton({
  employeeId,
  onUploadSuccess,
  variant = 'default',
  className,
}: UploadButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = api.useUtils();

  const handleUploadSuccess = () => {
    // Invalidate queries to refresh document lists
    utils.documents.listUploaded.invalidate();
    utils.documents.getPendingCount.invalidate();

    // Call parent callback if provided
    onUploadSuccess?.();
  };

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        variant={variant}
        className={className}
        size="lg"
      >
        <Upload className="h-5 w-5 mr-2" />
        Télécharger un document
      </Button>

      <UploadDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employeeId}
        onUploadSuccess={handleUploadSuccess}
      />
    </>
  );
}

/**
 * Floating Action Button variant for mobile
 * Shows a fixed button in bottom-right corner
 */
export function UploadFAB({
  employeeId,
  onUploadSuccess,
}: Omit<UploadButtonProps, 'variant' | 'className'>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = api.useUtils();

  const handleUploadSuccess = () => {
    utils.documents.listUploaded.invalidate();
    utils.documents.getPendingCount.invalidate();
    onUploadSuccess?.();
  };

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden"
        size="icon"
      >
        <Upload className="h-6 w-6" />
      </Button>

      <UploadDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employeeId}
        onUploadSuccess={handleUploadSuccess}
      />
    </>
  );
}
