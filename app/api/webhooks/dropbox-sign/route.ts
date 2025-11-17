/**
 * Dropbox Sign Webhook Handler
 * Epic: Document Management - E-Signature
 *
 * Handles webhook events from Dropbox Sign API:
 *
 * Signature Request Events:
 * - signature_request_sent - Signature request sent to signers
 * - signature_request_viewed - Signer viewed the document
 * - signature_request_signed - Signer signed the document
 * - signature_request_all_signed - All signers completed
 * - signature_request_declined - Signer declined to sign
 * - signature_request_canceled - Request was canceled
 * - signature_request_remind - Reminder sent to signer
 * - signature_request_downloadable - Document ready for download
 * - signature_request_email_bounce - Email delivery failed
 *
 * Template Events:
 * - template_created - Template successfully created
 * - template_error - Template creation failed
 *
 * Error Events:
 * - file_error - File processing error
 * - unknown_error - Unknown error occurred
 *
 * Reference: https://developers.hellosign.com/api/reference/tag/Callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedDocuments, signatureEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/inngest/client';
import * as crypto from 'crypto';

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
 * Dropbox Sign IP addresses for webhook validation
 * Source: https://developers.hellosign.com/docs/events/walkthrough
 *
 * These IPs should be whitelisted to ensure webhooks come from Dropbox Sign.
 * Last updated: 2025-11-17
 * Update this list periodically by checking the official documentation.
 */
const DROPBOX_SIGN_IP_WHITELIST: string[] = [
  // US IPs (from Dropbox Sign official IP list)
  '13.59.145.12',
  '184.73.232.209',
  '3.135.245.223',
  '3.17.43.141',
  '3.229.107.48',
  '3.23.150.114',
  '34.194.118.45',
  '34.198.117.22',
  '34.198.205.50',
  '34.200.190.67',
  '34.225.110.50',
  '44.216.219.123',
  '52.206.82.198',
  '54.208.134.250',
  '54.237.177.69',
];

/**
 * Verify that the request comes from a Dropbox Sign IP address
 *
 * @param ipAddress - IP address from request headers
 * @returns true if IP is whitelisted or whitelist is empty (dev mode)
 */
function verifySourceIP(ipAddress: string | null): boolean {
  // If no IP provided, warn but allow in development (reject in production)
  if (!ipAddress) {
    console.warn('[Dropbox Sign Webhook] No IP address in request headers');
    if (process.env.NODE_ENV === 'production') {
      return false; // Strict in production
    }
    return true; // Allow in development (for localhost testing)
  }

  // If whitelist is empty, allow (but log warning for production)
  if (DROPBOX_SIGN_IP_WHITELIST.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Dropbox Sign Webhook] IP whitelist not configured in production!');
    }
    return true;
  }

  // Check if IP is in whitelist
  const isWhitelisted = DROPBOX_SIGN_IP_WHITELIST.includes(ipAddress);

  if (!isWhitelisted) {
    console.error(`[Dropbox Sign Webhook] Request from non-whitelisted IP: ${ipAddress}`);
    console.error(`[Dropbox Sign Webhook] Valid IPs: ${DROPBOX_SIGN_IP_WHITELIST.join(', ')}`);
  }

  return isWhitelisted;
}

/**
 * Verify webhook signature from Dropbox Sign
 *
 * Security: Always verify webhook signatures in production to prevent spoofing
 *
 * Algorithm: HMAC-SHA256(event_time + event_type, api_key)
 * Reference: https://developers.hellosign.com/docs/events/walkthrough
 *
 * @param apiKey - Dropbox Sign API key
 * @param eventTime - Unix timestamp from event.event_time
 * @param eventType - Event type from event.event_type
 * @param eventHash - Hash from event.event_hash
 * @returns true if signature is valid
 */
function verifyWebhookSignature(
  apiKey: string,
  eventTime: number,
  eventType: string,
  eventHash: string
): boolean {
  // CRITICAL: Hash includes BOTH event_time AND event_type
  // Dropbox Sign verification: HMAC-SHA256(event_time + event_type, api_key)
  const message = eventTime.toString() + eventType;
  const computedHash = crypto
    .createHmac('sha256', apiKey)
    .update(message)
    .digest('hex');

  return computedHash === eventHash;
}

/**
 * Map Dropbox Sign event types to our internal event types
 */
function mapEventType(dropboxEventType: string): string {
  const mapping: Record<string, string> = {
    // Signature request lifecycle events
    signature_request_sent: 'request_sent',
    signature_request_viewed: 'viewed',
    signature_request_signed: 'signed',
    signature_request_all_signed: 'completed',
    signature_request_declined: 'declined',
    signature_request_canceled: 'cancelled',
    signature_request_remind: 'reminder_sent',
    signature_request_downloadable: 'downloadable',
    signature_request_email_bounce: 'email_bounced',

    // Template events
    template_created: 'template_created',
    template_error: 'template_error',

    // Error events
    file_error: 'file_error',
    unknown_error: 'unknown_error',

    // Account events (informational - typically not used for document workflow)
    account_confirmed: 'account_confirmed',
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
    // 1. Verify source IP (first line of defense)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const sourceIP = forwardedFor?.split(',')[0].trim() || realIP || null;

    if (!verifySourceIP(sourceIP)) {
      console.error('[Dropbox Sign Webhook] Request rejected - invalid source IP:', sourceIP);
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 2. Parse webhook payload
    // Dropbox Sign sends multipart/form-data by default with data in 'json' field
    // Reference: https://developers.hellosign.com/docs/events/walkthrough
    const contentType = req.headers.get('content-type') || '';
    let payload: DropboxSignWebhookEvent;

    if (contentType.includes('multipart/form-data')) {
      // Default Dropbox Sign format: multipart/form-data with 'json' field
      const formData = await req.formData();
      const jsonField = formData.get('json');

      if (!jsonField) {
        console.error('[Dropbox Sign Webhook] Missing json field in multipart/form-data');
        return new NextResponse('Bad Request: Missing json field', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      payload = JSON.parse(jsonField.toString());
    } else {
      // Fallback: Direct JSON (for testing or alternative configurations)
      payload = await req.json();
    }

    console.log('[Dropbox Sign Webhook] Received event:', payload.event.event_type);

    // 3. Verify webhook signature (IMPORTANT for security!)
    const apiKey = process.env.DROPBOX_SIGN_API_KEY;
    if (!apiKey) {
      console.error('[Dropbox Sign Webhook] API key not configured');
      return new NextResponse('Internal Server Error: API key not configured', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const isValidSignature = verifyWebhookSignature(
      apiKey,
      payload.event.event_time,
      payload.event.event_type,
      payload.event.event_hash
    );

    if (!isValidSignature) {
      console.error('[Dropbox Sign Webhook] Invalid signature - possible spoofing attempt');
      return new NextResponse('Unauthorized: Invalid signature', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 4. Find document in our database using signature_request_id
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
      // Dropbox Sign requires this exact response format
      return new NextResponse('Hello API Event Received', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 5. Process event based on type
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

    // 6. Log signature event in our database
    await db.insert(signatureEvents).values({
      documentId: document.id,
      tenantId: document.tenantId,
      eventType: mappedEventType,
      eventTimestamp: new Date(payload.event.event_time * 1000).toISOString() as any,
      signerEmail: signerEmail || null,
      signerName: signerName || null,
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

    // 7. Update document status based on event
    if (eventType === 'signature_request_all_signed') {
      // All signatures completed
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: 'signed',
          signedAt: new Date(payload.event.event_time * 1000).toISOString() as any,
          signatureMetadata: {
            signatures: payload.signature_request.signatures,
            completed_at: new Date(payload.event.event_time * 1000).toISOString(),
          } as any, // Type assertion for JSONB field
        })
        .where(eq(uploadedDocuments.id, document.id));

      // Send Inngest event for post-processing (e.g., send notifications)
      try {
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
      } catch (inngestError) {
        console.warn('[Dropbox Sign Webhook] Failed to send Inngest event (non-critical):',
          inngestError instanceof Error ? inngestError.message : inngestError
        );
      }
    } else if (eventType === 'signature_request_declined') {
      // Signature declined
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: 'declined',
          signatureMetadata: {
            signatures: payload.signature_request.signatures,
            decline_reason: payload.event.event_metadata.event_message || 'No reason provided',
            declined_at: new Date(payload.event.event_time * 1000).toISOString(),
            declined_by: signerEmail || 'Unknown',
          } as any,
        })
        .where(eq(uploadedDocuments.id, document.id));

      // Send Inngest event
      try {
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
      } catch (inngestError) {
        console.warn('[Dropbox Sign Webhook] Failed to send Inngest event (non-critical):',
          inngestError instanceof Error ? inngestError.message : inngestError
        );
      }
    } else if (eventType === 'signature_request_signed') {
      // Individual signer completed (update status to partially_signed or signed)
      const newStatus = calculateSignatureStatus(payload.signature_request.signatures);
      await db
        .update(uploadedDocuments)
        .set({
          signatureStatus: newStatus,
          signatureMetadata: {
            signatures: payload.signature_request.signatures,
            last_signed_at: new Date(payload.event.event_time * 1000).toISOString(),
          } as any, // Type assertion for JSONB field
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

    // 8. Return success response
    // IMPORTANT: Dropbox Sign requires this exact response format
    // See: https://developers.hellosign.com/docs/events/walkthrough
    return new NextResponse('Hello API Event Received', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error: any) {
    console.error('[Dropbox Sign Webhook] Error processing webhook:', error);

    // Return 500 with plain text so Dropbox Sign will retry
    // Log full error details but return simple message to client
    return new NextResponse('Internal Server Error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
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
