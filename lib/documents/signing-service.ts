/**
 * Dropbox Sign (HelloSign) API Service
 * Epic: Document Management - E-Signature
 *
 * This service wraps the Dropbox Sign API for:
 * - Creating signature requests
 * - Checking signature status
 * - Managing signers
 * - Getting embedded signing URLs
 *
 * Reference: docs/DOCUMENT-SIGNING-SOLUTIONS-ANALYSIS.md
 * API Docs: https://developers.hellosign.com/api/reference
 */

import * as dropboxSign from '@dropbox/sign';
import { db } from '@/lib/db';
import { uploadedDocuments, signatureEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';

// =====================================================
// Configuration
// =====================================================

const DROPBOX_SIGN_API_KEY = process.env.DROPBOX_SIGN_API_KEY;

if (!DROPBOX_SIGN_API_KEY) {
  console.warn('DROPBOX_SIGN_API_KEY not configured. E-signature features will be disabled.');
}

// Initialize Dropbox Sign API client
const signatureRequestApi = new dropboxSign.SignatureRequestApi();
signatureRequestApi.username = DROPBOX_SIGN_API_KEY || '';

// =====================================================
// Types
// =====================================================

export interface Signer {
  name: string;
  email: string;
  order?: number; // For sequential signing (0-indexed)
}

export interface SignatureRequestOptions {
  documentId: string; // Our uploaded_documents.id
  signers: Signer[];
  title: string;
  subject?: string;
  message?: string;
  testMode?: boolean;
  useTextTags?: boolean; // Use {{Sig_es_:signer1:signature}} tags in PDF
  hideTextTags?: boolean;
  metadata?: Record<string, any>;
  signingOrder?: 'sequential' | 'parallel'; // Sequential = one at a time, Parallel = all at once
}

export interface SignatureStatus {
  signatureRequestId: string;
  status: 'pending' | 'partially_signed' | 'signed' | 'declined' | 'cancelled';
  signers: Array<{
    name: string;
    email: string;
    status: 'awaiting_signature' | 'signed' | 'declined';
    signedAt?: Date;
    lastViewedAt?: Date;
  }>;
  createdAt: Date;
  expiresAt?: Date;
}

// =====================================================
// Service Functions
// =====================================================

/**
 * Create a signature request for a document
 *
 * @param options - Signature request configuration
 * @returns Dropbox Sign signature request ID and signing URLs
 *
 * @example
 * ```typescript
 * const result = await createSignatureRequest({
 *   documentId: 'uuid-of-uploaded-document',
 *   signers: [
 *     { name: 'John Doe', email: 'john@example.com', order: 0 },
 *     { name: 'HR Manager', email: 'hr@preem.ci', order: 1 }
 *   ],
 *   title: 'Employment Contract - John Doe',
 *   subject: 'Signature requise : Contrat de travail',
 *   message: 'Merci de signer ce document.',
 *   signingOrder: 'sequential'
 * });
 * ```
 */
export async function createSignatureRequest(
  options: SignatureRequestOptions
): Promise<{
  signatureRequestId: string;
  signingUrls: Array<{ email: string; url: string }>;
}> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  // 1. Get document from database
  const document = await db.query.uploadedDocuments.findFirst({
    where: eq(uploadedDocuments.id, options.documentId),
  });

  if (!document) {
    throw new Error(`Document not found: ${options.documentId}`);
  }

  // 2. Download document file from Supabase Storage
  // Note: file_url is a public Supabase Storage URL
  const fileUrl = document.fileUrl;

  // 3. Prepare signers for Dropbox Sign API
  const signers: dropboxSign.SubSignatureRequestSigner[] = options.signers.map((signer, index) => ({
    name: signer.name,
    emailAddress: signer.email,
    order: options.signingOrder === 'sequential' ? (signer.order ?? index) : undefined,
  }));

  // 4. Create signature request via API
  const data: dropboxSign.SignatureRequestSendRequest = {
    title: options.title,
    subject: options.subject || 'Signature requise',
    message: options.message || 'Merci de signer ce document.',
    signers,
    files: [fileUrl as any], // Dropbox Sign API supports URLs despite TypeScript types
    metadata: {
      document_id: options.documentId, // Link back to our system
      tenant_id: document.tenantId,
      ...options.metadata,
    },
    testMode: options.testMode ?? process.env.NODE_ENV === 'development',
    useTextTags: options.useTextTags ?? false,
    hideTextTags: options.hideTextTags ?? true,
  };

  try {
    const result = await signatureRequestApi.signatureRequestSend(data);
    const signatureRequest = result.body.signatureRequest;

    if (!signatureRequest || !signatureRequest.signatureRequestId) {
      throw new Error('Failed to create signature request');
    }

    // 5. Update our database with signature request ID
    await db
      .update(uploadedDocuments)
      .set({
        signatureRequestId: signatureRequest.signatureRequestId,
        signatureStatus: 'pending',
        signatureProvider: 'dropbox_sign',
        signatureMetadata: {
          signers: options.signers,
          title: options.title,
          created_at: new Date().toISOString(),
        },
      })
      .where(eq(uploadedDocuments.id, options.documentId));

    // 6. Log signature event
    await db.insert(signatureEvents).values({
      documentId: options.documentId,
      tenantId: document.tenantId,
      eventType: 'request_sent',
      eventTimestamp: new Date(),
      signatureProvider: 'dropbox_sign',
      providerEventId: signatureRequest.signatureRequestId,
      metadata: {
        signers: options.signers,
        title: options.title,
      },
    });

    // 7. Send Inngest event for tracking
    await inngest.send({
      name: 'document/signature-requested',
      data: {
        documentId: options.documentId,
        tenantId: document.tenantId,
        signatureRequestId: signatureRequest.signatureRequestId,
        signers: options.signers,
      },
    });

    // 8. Extract signing URLs from response
    const signingUrls = signatureRequest.signatures?.map((sig) => ({
      email: sig.signerEmailAddress || '',
      url: sig.signatureId || '',
    })) || [];

    return {
      signatureRequestId: signatureRequest.signatureRequestId,
      signingUrls,
    };
  } catch (error) {
    console.error('Failed to create signature request:', error);
    throw new Error(
      `Failed to create signature request: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the current status of a signature request
 *
 * @param signatureRequestId - Dropbox Sign signature request ID
 * @returns Current signature status and signer details
 */
export async function getSignatureStatus(
  signatureRequestId: string
): Promise<SignatureStatus> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  try {
    const result = await signatureRequestApi.signatureRequestGet(signatureRequestId);
    const signatureRequest = result.body.signatureRequest;

    if (!signatureRequest) {
      throw new Error('Signature request not found');
    }

    // Map Dropbox Sign status to our status
    let status: SignatureStatus['status'] = 'pending';
    if (signatureRequest.isComplete) {
      status = 'signed';
    } else if (signatureRequest.isDeclined) {
      status = 'declined';
    } else if (signatureRequest.hasError) {
      status = 'cancelled';
    } else {
      // Check if partially signed
      const signedCount = signatureRequest.signatures?.filter(
        (sig) => sig.statusCode === 'signed'
      ).length || 0;
      const totalSigners = signatureRequest.signatures?.length || 0;

      if (signedCount > 0 && signedCount < totalSigners) {
        status = 'partially_signed';
      }
    }

    // Extract signer details
    const signers = signatureRequest.signatures?.map((sig) => ({
      name: sig.signerName || '',
      email: sig.signerEmailAddress || '',
      status: (sig.statusCode as 'awaiting_signature' | 'signed' | 'declined') || 'awaiting_signature',
      signedAt: sig.signedAt ? new Date(sig.signedAt * 1000) : undefined,
      lastViewedAt: sig.lastViewedAt ? new Date(sig.lastViewedAt * 1000) : undefined,
    })) || [];

    return {
      signatureRequestId: signatureRequest.signatureRequestId || signatureRequestId,
      status,
      signers,
      createdAt: signatureRequest.createdAt ? new Date(signatureRequest.createdAt * 1000) : new Date(),
      expiresAt: signatureRequest.expiresAt ? new Date(signatureRequest.expiresAt * 1000) : undefined,
    };
  } catch (error) {
    console.error('Failed to get signature status:', error);
    throw new Error(
      `Failed to get signature status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get an embedded signing URL for a specific signer
 *
 * Use this to embed signing in an iframe instead of sending email
 *
 * @param signatureId - Dropbox Sign signature ID (from signatureRequest.signatures[].signatureId)
 * @returns Embedded signing URL
 */
export async function getEmbeddedSigningUrl(signatureId: string): Promise<string> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  try {
    const embeddedApi = new dropboxSign.EmbeddedApi();
    embeddedApi.username = DROPBOX_SIGN_API_KEY;

    const result = await embeddedApi.embeddedSignUrl(signatureId);
    const signUrl = result.body.embedded?.signUrl;

    if (!signUrl) {
      throw new Error('Failed to get embedded signing URL');
    }

    return signUrl;
  } catch (error) {
    console.error('Failed to get embedded signing URL:', error);
    throw new Error(
      `Failed to get embedded signing URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Cancel a pending signature request
 *
 * @param signatureRequestId - Dropbox Sign signature request ID
 */
export async function cancelSignatureRequest(signatureRequestId: string): Promise<void> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  try {
    await signatureRequestApi.signatureRequestCancel(signatureRequestId);

    // Update our database
    const document = await db.query.uploadedDocuments.findFirst({
      where: eq(uploadedDocuments.signatureRequestId, signatureRequestId),
    });

    if (document) {
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: 'cancelled',
        })
        .where(eq(uploadedDocuments.id, document.id));

      // Log cancellation event
      await db.insert(signatureEvents).values({
        documentId: document.id,
        tenantId: document.tenantId,
        eventType: 'cancelled',
        eventTimestamp: new Date(),
        signatureProvider: 'dropbox_sign',
        providerEventId: signatureRequestId,
      });
    }
  } catch (error) {
    console.error('Failed to cancel signature request:', error);
    throw new Error(
      `Failed to cancel signature request: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Send a reminder to pending signers
 *
 * @param signatureRequestId - Dropbox Sign signature request ID
 * @param emailAddress - Specific signer to remind (optional, defaults to all pending)
 */
export async function sendSignatureReminder(
  signatureRequestId: string,
  emailAddress?: string
): Promise<void> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  try {
    const data: dropboxSign.SignatureRequestRemindRequest = {
      emailAddress: emailAddress || '', // Email address to remind, empty string for all pending
    };

    await signatureRequestApi.signatureRequestRemind(signatureRequestId, data);

    // Log reminder event
    const document = await db.query.uploadedDocuments.findFirst({
      where: eq(uploadedDocuments.signatureRequestId, signatureRequestId),
    });

    if (document) {
      await db.insert(signatureEvents).values({
        documentId: document.id,
        tenantId: document.tenantId,
        eventType: 'reminder_sent',
        eventTimestamp: new Date(),
        signerEmail: emailAddress,
        signatureProvider: 'dropbox_sign',
        providerEventId: signatureRequestId,
      });
    }
  } catch (error) {
    console.error('Failed to send reminder:', error);
    throw new Error(
      `Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Download the signed document
 *
 * @param signatureRequestId - Dropbox Sign signature request ID
 * @returns PDF file as Buffer
 */
export async function downloadSignedDocument(signatureRequestId: string): Promise<Buffer> {
  if (!DROPBOX_SIGN_API_KEY) {
    throw new Error('Dropbox Sign API key not configured');
  }

  try {
    const result = await signatureRequestApi.signatureRequestFiles(
      signatureRequestId,
      'pdf' // File type
    );

    // Result is a binary buffer
    return result.body as unknown as Buffer;
  } catch (error) {
    console.error('Failed to download signed document:', error);
    throw new Error(
      `Failed to download signed document: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
