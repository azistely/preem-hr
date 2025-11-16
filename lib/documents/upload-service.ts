/**
 * Document Upload Service
 * Epic: Document Management System
 *
 * Purpose: Handle file validation, upload to Supabase Storage, and database record creation
 * Features:
 * - File validation (MIME type, size, extension)
 * - Upload to Supabase Storage with organized folder structure
 * - Database record creation with approval workflow
 * - Inngest event emission for approval workflows
 * - Soft delete support
 * - Metadata updates
 *
 * NOTE: This file is used by tRPC routers, not as Server Actions.
 * The 'use server' directive is not needed here since tRPC handles server-side execution.
 *
 * Related docs:
 * - docs/IMPLEMENTATION-GUIDE-DOCUMENT-MANAGEMENT.md
 * - docs/DOCUMENT-MANAGEMENT-INNGEST-INTEGRATION.md
 */

import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { uploadedDocuments, employees } from '@/lib/db/schema';
import { sendEvent } from '@/lib/inngest/client';
import { eq } from 'drizzle-orm';

// Type for auth context (from tRPC or server components)
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
}

// =====================================================
// File Validation Constants
// =====================================================

/**
 * Allowed MIME types with their file extensions
 * PDF, JPEG, PNG, DOCX only for security
 */
const ALLOWED_MIME_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
} as const;

/**
 * Maximum file size: 25MB
 * Balance between usability and storage costs
 */
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES;

// =====================================================
// Type Definitions
// =====================================================

export interface UploadDocumentParams {
  file: File;
  employeeId: string | null;
  documentCategory: string;
  documentSubcategory?: string;
  expiryDate?: string; // Date string in YYYY-MM-DD format
  tags?: string[];
  metadata?: Record<string, unknown>;
  auth: AuthContext; // Auth context from tRPC or server component
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  fileUrl?: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// =====================================================
// File Validation Functions
// =====================================================

/**
 * Validate file before upload
 *
 * Checks:
 * 1. File size (max 25MB)
 * 2. MIME type (PDF, JPEG, PNG, DOCX only)
 * 3. File extension matches MIME type
 *
 * @param file - File object to validate
 * @returns Validation result with success flag and error message
 *
 * @example
 * const result = validateFile(file);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export function validateFile(file: File): ValidationResult {
  // Check 1: File size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Le fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} Mo). Taille maximale: 25 Mo.`,
    };
  }

  // Check 2: MIME type
  const mimeType = file.type as AllowedMimeType;
  if (!(mimeType in ALLOWED_MIME_TYPES)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé: ${file.type}. Formats acceptés: PDF, JPEG, PNG, DOCX.`,
    };
  }

  // Check 3: File extension matches MIME type
  const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  const allowedExtensions = ALLOWED_MIME_TYPES[mimeType] as readonly string[];

  if (!(allowedExtensions as string[]).includes(extension)) {
    return {
      valid: false,
      error: `Extension de fichier non valide: ${extension}. Extensions acceptées pour ${file.type}: ${allowedExtensions.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent security issues
 * - Remove special characters
 * - Replace spaces with underscores
 * - Keep only alphanumeric, hyphens, underscores, and dots
 *
 * @param filename - Original filename
 * @returns Sanitized filename
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// =====================================================
// Document Upload Functions
// =====================================================

/**
 * Upload document to Supabase Storage and create database record
 *
 * Process:
 * 1. Validate authentication (tenant + user)
 * 2. Validate file (size, type, extension)
 * 3. Generate unique filename with timestamp
 * 4. Upload to Supabase Storage (organized by tenant/category/employee)
 * 5. Create database record with approval status
 * 6. Emit Inngest event for approval workflow (if pending)
 *
 * @param params - Upload parameters
 * @returns Upload result with success flag and document ID
 *
 * @example
 * const result = await uploadDocument({
 *   file: myFile,
 *   employeeId: 'uuid',
 *   documentCategory: 'medical',
 *   expiryDate: new Date('2025-12-31'),
 *   tags: ['urgent'],
 * });
 */
export async function uploadDocument(params: UploadDocumentParams): Promise<UploadResult> {
  try {
    // Step 1: Extract auth context
    const { auth } = params;

    if (!auth.tenantId || !auth.userId) {
      return { success: false, error: 'Non authentifié' };
    }

    // Step 2: Validate file
    const validation = validateFile(params.file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Step 3: Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFilename(params.file.name);
    const fileName = `${timestamp}_${sanitizedFileName}`;

    // Step 4: Determine storage path (organized by tenant/category/employee)
    const storagePath = params.employeeId
      ? `${auth.tenantId}/uploaded/${params.documentCategory}/${params.employeeId}/${fileName}`
      : `${auth.tenantId}/uploaded/${params.documentCategory}/company/${fileName}`;

    // Step 5: Upload to Supabase Storage
    const supabase = await createClient();
    const fileBuffer = await params.file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: params.file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload Service] Storage upload error:', uploadError);
      return { success: false, error: 'Échec du téléchargement du fichier' };
    }

    // Step 6: Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    // Step 7: Determine approval status
    // Employee uploading certain categories = pending approval
    // HR/Admin uploading anything = auto-approved
    const isEmployeeUpload = auth.role.toLowerCase() === 'employee';
    const requiresApproval = isEmployeeUpload && ['medical', 'diploma', 'other'].includes(params.documentCategory);

    const approvalStatus = requiresApproval ? 'pending' : 'approved';

    // Step 8: Create database record
    const [document] = await db.insert(uploadedDocuments).values({
      tenantId: auth.tenantId,
      employeeId: params.employeeId,
      documentCategory: params.documentCategory,
      documentSubcategory: params.documentSubcategory,
      fileName: params.file.name,
      fileUrl: urlData.publicUrl,
      fileSize: params.file.size,
      mimeType: params.file.type,
      uploadedBy: auth.userId,
      expiryDate: params.expiryDate,
      tags: params.tags || [],
      metadata: params.metadata || {},
      approvalStatus,
    }).returning();

    console.log('[Upload Service] Document created:', {
      documentId: document.id,
      approvalStatus,
      requiresApproval,
    });

    // Step 9: Emit Inngest event for approval workflow (if pending)
    if (approvalStatus === 'pending' && params.employeeId) {
      // Get employee details for event
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, params.employeeId))
        .limit(1);

      const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : 'Unknown';

      await sendEvent({
        name: 'document.uploaded',
        data: {
          documentId: document.id,
          employeeId: params.employeeId,
          employeeName,
          tenantId: auth.tenantId,
          documentCategory: params.documentCategory,
          fileName: params.file.name,
          requiresApproval: true,
          uploadedById: auth.userId,
        },
      });

      console.log('[Upload Service] Inngest event emitted: document.uploaded');
    }

    return {
      success: true,
      documentId: document.id,
      fileUrl: document.fileUrl,
    };
  } catch (error) {
    console.error('[Upload Service] Upload document error:', error);
    return {
      success: false,
      error: 'Une erreur est survenue lors du téléchargement',
    };
  }
}

/**
 * Upload temporary file (for onboarding/hire wizard)
 *
 * Simple file upload without database record - just returns URL.
 * Used when employee doesn't exist yet (hire wizard).
 * Files stored in temp location and can be cleaned up after 24h.
 *
 * @param file - File to upload (browser) OR buffer with metadata (server)
 * @param tenantId - Tenant ID for storage path
 * @returns Upload result with file URL
 */
export async function uploadTemporaryFile(
  file: File | { buffer: ArrayBuffer; name: string; type: string; size: number },
  tenantId: string
): Promise<UploadResult> {
  try {
    // Handle both File objects (browser) and plain objects (server)
    const fileName = file instanceof File ? file.name : file.name;
    const fileSize = file instanceof File ? file.size : file.size;
    const fileType = file instanceof File ? file.type : file.type;
    const fileBuffer = file instanceof File ? await file.arrayBuffer() : file.buffer;

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `Le fichier est trop volumineux (${(fileSize / 1024 / 1024).toFixed(2)} Mo). Taille maximale: 25 Mo.`,
      };
    }

    // Validate MIME type
    const mimeType = fileType as AllowedMimeType;
    if (!(mimeType in ALLOWED_MIME_TYPES)) {
      return {
        success: false,
        error: `Type de fichier non autorisé: ${fileType}. Formats acceptés: PDF, JPEG, PNG, DOCX.`,
      };
    }

    // Validate file extension
    const extension = `.${fileName.split('.').pop()?.toLowerCase()}`;
    const allowedExtensions = ALLOWED_MIME_TYPES[mimeType] as readonly string[];

    if (!(allowedExtensions as string[]).includes(extension)) {
      return {
        success: false,
        error: `Extension de fichier non valide: ${extension}. Extensions acceptées pour ${fileType}: ${allowedExtensions.join(', ')}`,
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFilename(fileName);
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`;

    // Store in temp location
    const storagePath = `${tenantId}/temp/${uniqueFileName}`;

    // Upload to Supabase Storage
    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload Service] Temp upload error:', {
        error: uploadError,
        message: uploadError.message,
        storagePath,
        fileType,
        fileSize,
      });
      return {
        success: false,
        error: `Échec du téléchargement: ${uploadError.message || 'Erreur inconnue'}`
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    return {
      success: true,
      fileUrl: urlData.publicUrl,
    };
  } catch (error) {
    console.error('[Upload Service] Temp upload error:', error);
    return {
      success: false,
      error: 'Une erreur est survenue lors du téléchargement',
    };
  }
}

// =====================================================
// Document Management Functions
// =====================================================

/**
 * Delete document (soft delete + storage cleanup)
 *
 * Process:
 * 1. Verify user has permission (HR/Admin only)
 * 2. Mark document as archived in database (soft delete)
 * 3. Optionally delete from Supabase Storage (currently skipped for recovery)
 *
 * @param documentId - UUID of document to delete
 * @returns Result with success flag
 */
export async function deleteDocument(documentId: string, auth: AuthContext): Promise<UploadResult> {
  try {
    const allowedRoles = ['hr_manager', 'tenant_admin', 'super_admin'];
    if (!allowedRoles.includes(auth.role.toLowerCase())) {
      return { success: false, error: 'Non autorisé' };
    }

    // Get document
    const [document] = await db
      .select()
      .from(uploadedDocuments)
      .where(eq(uploadedDocuments.id, documentId))
      .limit(1);

    if (!document) {
      return { success: false, error: 'Document introuvable' };
    }

    // Soft delete in database
    await db
      .update(uploadedDocuments)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(uploadedDocuments.id, documentId));

    // TODO: Delete from storage (optional - can keep for recovery)
    // const supabase = await createClient();
    // Extract path from URL and delete
    // await supabase.storage.from('documents').remove([path]);

    console.log('[Upload Service] Document archived:', documentId);

    return { success: true };
  } catch (error) {
    console.error('[Upload Service] Delete document error:', error);
    return { success: false, error: 'Échec de la suppression' };
  }
}

/**
 * Update document metadata
 *
 * Allows HR/Admin to update:
 * - Document category/subcategory
 * - Expiry date
 * - Tags
 * - Custom metadata
 *
 * @param documentId - UUID of document
 * @param updates - Fields to update
 * @returns Result with success flag
 */
export async function updateDocumentMetadata(
  documentId: string,
  updates: {
    documentCategory?: string;
    documentSubcategory?: string;
    expiryDate?: string | null; // Date string in YYYY-MM-DD format
    tags?: string[];
    metadata?: Record<string, unknown>;
  },
  auth: AuthContext
): Promise<UploadResult> {
  try {
    const allowedRoles = ['hr_manager', 'admin', 'super_admin'];
    if (!allowedRoles.includes(auth.role.toLowerCase())) {
      return { success: false, error: 'Non autorisé' };
    }

    await db
      .update(uploadedDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uploadedDocuments.id, documentId));

    console.log('[Upload Service] Document metadata updated:', documentId);

    return { success: true };
  } catch (error) {
    console.error('[Upload Service] Update document metadata error:', error);
    return { success: false, error: 'Échec de la mise à jour' };
  }
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Get document category label in French
 */
export function getDocumentCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    contract: 'Contrat de travail',
    bulletin: 'Bulletin de paie',
    certificate: 'Certificat',
    id_card: 'Pièce d\'identité',
    diploma: 'Diplôme',
    medical: 'Certificat médical',
    performance: 'Évaluation',
    policy: 'Politique d\'entreprise',
    other: 'Autre document',
  };

  return labels[category] || category;
}

/**
 * Check if document category requires HR approval
 */
export function requiresHrApproval(category: string): boolean {
  // Only medical certificates require approval from employees
  return category === 'medical';
}

/**
 * Check if employee can upload this document category
 */
export async function employeeCanUpload(category: string): Promise<boolean> {
  const allowed = ['medical', 'diploma', 'id_card', 'other'];
  return allowed.includes(category);
}
