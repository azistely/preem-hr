/**
 * Email Client Configuration
 *
 * Uses Resend for email delivery
 * Requires RESEND_API_KEY environment variable
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send email via Resend API
 */
export async function sendEmail(options: EmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping email send');
    return {
      success: false,
      error: 'Email service not configured',
    };
  }

  const from = options.from || process.env.EMAIL_FROM || 'noreply@preem-hr.com';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await response.json();

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send multiple emails in batch
 */
export async function sendBatchEmails(emails: EmailOptions[]) {
  const results = await Promise.allSettled(
    emails.map((email) => sendEmail(email))
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return {
    successful,
    failed,
    total: emails.length,
  };
}
