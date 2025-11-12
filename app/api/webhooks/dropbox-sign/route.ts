/**
 * Dropbox Sign Webhook Handler
 * Epic: Document Management - E-Signature
 *
 * Handles webhook events from Dropbox Sign API:
 * - signature_request_sent - Signature request sent to signers
 * - signature_request_viewed - Signer viewed the document
 * - signature_request_signed - Signer signed the document
 * - signature_request_all_signed - All signers completed
 * - signature_request_declined - Signer declined to sign
 * - signature_request_canceled - Request was canceled
 * - signature_request_remind - Reminder sent to signer
 *
 * Reference: https://developers.hellosign.com/api/reference/tag/Callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { uploadedDocuments, signatureEvents } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import crypto from 'crypto';

// =====================================================
// Types
// =====================================================

interface DropboxSignWebhookEvent {
  event: {
    event_type: string;
    event_time: number;
    event_hash: string;
    event_metadata: {
      related_signature_id?: string;
      reported_for_account_id?: string;
      reported_for_app_id?: string;
      event_message?: string;
    };
  };
  signature_request: {
    signature_request_id: string;
    title: string;
    subject?: string;
    message?: string;
    is_complete: boolean;
    is_declined: boolean;
    has_error: boolean;
    metadata?: Record<string, any>;
    signatures: Array<{
      signature_id: string;
      signer_email_address: string;
      signer_name: string;
      status_code: 'awaiting_signature' | 'signed' | 'declined';
      signed_at?: number | null;
      last_viewed_at?: number | null;
      last_reminded_at?: number | null;
      order?: number | null;
    }>;
  };
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Verify webhook signature from Dropbox Sign
 *
 * Security: Always verify webhook signatures in production to prevent spoofing
 *
 * @param apiKey - Dropbox Sign API key
 * @param eventTime - Unix timestamp from event.event_time
 * @param eventHash - Hash from event.event_hash
 * @returns true if signature is valid
 */
function verifyWebhookSignature(
  apiKey: string,
  eventTime: number,
  eventHash: string
): boolean {
  // Dropbox Sign verification: HMAC-SHA256(api_key + event_time)
  const computedHash = crypto
    .createHmac('sha256', apiKey)
    .update(eventTime.toString())
    .digest('hex');

  return computedHash === eventHash;
}

/**
 * Map Dropbox Sign event types to our internal event types
 */
function mapEventType(dropboxEventType: string): string {
  const mapping: Record<string, string> = {
    signature_request_sent: 'request_sent',
    signature_request_viewed: 'viewed',
    signature_request_signed: 'signed',
    signature_request_all_signed: 'completed',
    signature_request_declined: 'declined',
    signature_request_canceled: 'cancelled',
    signature_request_remind: 'reminder_sent',
  };

  return mapping[dropboxEventType] || dropboxEventType;
}

/**
 * Determine document signature status based on signatures array
 */
function calculateSignatureStatus(signatures: any[]): string {
  const total = signatures.length;
  const signed = signatures.filter((s) => s.status_code === 'signed').length;
  const declined = signatures.some((s) => s.status_code === 'declined');

  if (declined) return 'declined';
  if (signed === 0) return 'pending';
  if (signed < total) return 'partially_signed';
  return 'signed';
}

// =====================================================
// Webhook Handler
// =====================================================

export async function POST(req: NextRequest) {
  try {
    // 1. Parse webhook payload
    const payload: DropboxSignWebhookEvent = await req.json();
    console.log('[Dropbox Sign Webhook] Received event:', payload.event.event_type);

    // 2. Verify webhook signature (IMPORTANT for security!)
    const apiKey = process.env.DROPBOX_SIGN_API_KEY;
    if (!apiKey) {
      console.error('[Dropbox Sign Webhook] API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const isValidSignature = verifyWebhookSignature(
      apiKey,
      payload.event.event_time,
      payload.event.event_hash
    );

    if (!isValidSignature) {
      console.error('[Dropbox Sign Webhook] Invalid signature - possible spoofing attempt');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Find document in our database using signature_request_id
    const document = await db.query.uploadedDocuments.findFirst({
      where: eq(
        uploadedDocuments.signatureRequestId,
        payload.signature_request.signature_request_id
      ),
    });

    if (!document) {
      console.warn(
        '[Dropbox Sign Webhook] Document not found for signature request:',
        payload.signature_request.signature_request_id
      );
      // Return 200 to prevent retries (document may have been deleted)
      return NextResponse.json({ message: 'Document not found' }, { status: 200 });
    }

    // 4. Process event based on type
    const eventType = payload.event.event_type;
    const mappedEventType = mapEventType(eventType);

    // Extract signer info from event (if available)
    let signerEmail: string | undefined;
    let signerName: string | undefined;
    const relatedSignatureId = payload.event.event_metadata.related_signature_id;

    if (relatedSignatureId) {
      const signer = payload.signature_request.signatures.find(
        (s) => s.signature_id === relatedSignatureId
      );
      if (signer) {
        signerEmail = signer.signer_email_address;
        signerName = signer.signer_name;
      }
    }

    // 5. Log signature event in our database
    await db.insert(signatureEvents).values({
      documentId: document.id,
      tenantId: document.tenantId,
      eventType: mappedEventType,
      eventTimestamp: new Date(payload.event.event_time * 1000).toISOString(),
      signerEmail,
      signerName,
      signatureProvider: 'dropbox_sign',
      providerEventId: payload.event.event_hash, // Use event hash as unique ID
      metadata: {
        event_type: eventType,
        signature_request_id: payload.signature_request.signature_request_id,
        related_signature_id: relatedSignatureId,
        event_message: payload.event.event_metadata.event_message,
        signatures: payload.signature_request.signatures,
      },
    });

    // 6. Update document status based on event
    if (eventType === 'signature_request_all_signed') {
      // All signatures completed
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: 'signed',
          signedAt: new Date().toISOString(),
          signatureMetadata: {
            signatures: payload.signature_request.signatures,
            completed_at: new Date().toISOString(),
          },
        })
        .where(eq(uploadedDocuments.id, document.id));

      // Send Inngest event for post-processing (e.g., send notifications)
      await inngest.send({
        name: 'document/signature-completed',
        data: {
          documentId: document.id,
          tenantId: document.tenantId,
          signatureRequestId: payload.signature_request.signature_request_id,
          signers: payload.signature_request.signatures.map((s) => ({
            email: s.signer_email_address,
            name: s.signer_name,
            signedAt: s.signed_at ? new Date(s.signed_at * 1000).toISOString() : null,
          })),
        },
      });
    } else if (eventType === 'signature_request_declined') {
      // Signature declined
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: 'declined',
        })
        .where(eq(uploadedDocuments.id, document.id));

      // Send Inngest event
      await inngest.send({
        name: 'document/signature-declined',
        data: {
          documentId: document.id,
          tenantId: document.tenantId,
          signatureRequestId: payload.signature_request.signature_request_id,
          declinerEmail: signerEmail,
          declinerName: signerName,
        },
      });
    } else if (eventType === 'signature_request_signed') {
      // Individual signer completed (update status to partially_signed or signed)
      const newStatus = calculateSignatureStatus(payload.signature_request.signatures);
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: newStatus,
          signatureMetadata: {
            signatures: payload.signature_request.signatures,
            last_signed_at: new Date().toISOString(),
          },
        })
        .where(eq(uploadedDocuments.id, document.id));
    } else if (eventType === 'signature_request_canceled') {
      // Signature request canceled
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: 'cancelled',
        })
        .where(eq(uploadedDocuments.id, document.id));
    }

    console.log('[Dropbox Sign Webhook] Event processed successfully:', eventType);

    // 7. Return success response
    return NextResponse.json({
      message: 'Webhook processed successfully',
      event_type: eventType,
      document_id: document.id,
    });
  } catch (error: any) {
    console.error('[Dropbox Sign Webhook] Error processing webhook:', error);

    // Return 500 so Dropbox Sign will retry
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// GET handler for webhook verification (optional)
// =====================================================

export async function GET(req: NextRequest) {
  // Dropbox Sign may send GET requests to verify the webhook URL
  return NextResponse.json({
    message: 'Dropbox Sign webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
