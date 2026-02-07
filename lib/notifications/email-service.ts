/**
 * Email Notification Service
 * Sends email notifications using Resend
 * Epic: 09-EPIC-WORKFLOW-AUTOMATION.md - Phase 2
 */

import { Resend } from 'resend';

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@jamana.app';

/**
 * Lazy initialization of Resend client
 * Only creates instance when needed (not during build time)
 */
let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  if (!resendClient) {
    throw new Error('Resend client not initialized - RESEND_API_KEY missing');
  }
  return resendClient;
}

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email notification
 */
export async function sendEmail(notification: EmailNotification): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[Email] RESEND_API_KEY not configured, skipping email send');
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: notification.to,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    });

    if (error) {
      console.error('[Email] Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log('[Email] Email sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Email] Unexpected error sending email:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send alert notification email
 */
export async function sendAlertNotification(params: {
  to: string;
  alertType: string;
  severity: 'info' | 'warning' | 'urgent';
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  employeeName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, alertType, severity, message, actionUrl, actionLabel, employeeName } = params;

  const severityColors = {
    info: '#3b82f6',
    warning: '#f59e0b',
    urgent: '#ef4444',
  };

  const severityLabels = {
    info: 'Information',
    warning: 'Attention',
    urgent: 'Urgent',
  };

  const subject = `[Jamana] ${severityLabels[severity]}: ${message}`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 24px; background-color: ${severityColors[severity]}; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                    ${severityLabels[severity]}
                  </h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 16px; color: #111827; font-size: 16px; line-height: 24px;">
                    ${message}
                  </p>

                  ${employeeName ? `
                    <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
                      Employé concerné: <strong>${employeeName}</strong>
                    </p>
                  ` : ''}

                  ${actionUrl && actionLabel ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="border-radius: 6px; background-color: ${severityColors[severity]};">
                          <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500;">
                            ${actionLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                  ` : ''}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                    Cette notification a été générée automatiquement par Jamana. Ne répondez pas à cet email.
                  </p>
                  <p style="margin: 12px 0 0; color: #9ca3af; font-size: 12px;">
                    © ${new Date().getFullYear()} Jamana. Tous droits réservés.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
${severityLabels[severity]}: ${message}

${employeeName ? `Employé concerné: ${employeeName}\n` : ''}
${actionUrl && actionLabel ? `\n${actionLabel}: ${actionUrl}` : ''}

---
Cette notification a été générée automatiquement par Jamana. Ne répondez pas à cet email.
© ${new Date().getFullYear()} Jamana. Tous droits réservés.
  `;

  return sendEmail({ to, subject, html, text });
}

/**
 * Send payroll completion notification
 */
export async function sendPayrollCompletionEmail(params: {
  to: string;
  payrollPeriod: string;
  totalEmployees: number;
  totalAmount: number;
  currency: string;
  downloadUrl: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, payrollPeriod, totalEmployees, totalAmount, currency, downloadUrl } = params;

  const subject = `[Jamana] Paie ${payrollPeriod} terminée`;

  const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 32px 32px 24px; background-color: #10b981; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                    ✓ Paie terminée
                  </h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px;">
                  <p style="margin: 0 0 24px; color: #111827; font-size: 16px; line-height: 24px;">
                    La paie pour la période <strong>${payrollPeriod}</strong> a été traitée avec succès.
                  </p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #6b7280; font-size: 14px;">Nombre d'employés</span>
                      </td>
                      <td align="right" style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #111827; font-size: 14px;">${totalEmployees}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0;">
                        <span style="color: #6b7280; font-size: 14px;">Montant total</span>
                      </td>
                      <td align="right" style="padding: 12px 0;">
                        <strong style="color: #111827; font-size: 18px;">${totalAmount.toLocaleString('fr-FR')} ${currency}</strong>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td style="border-radius: 6px; background-color: #3b82f6;">
                        <a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 500;">
                          Télécharger le rapport
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                    Cette notification a été générée automatiquement par Jamana.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Paie terminée

La paie pour la période ${payrollPeriod} a été traitée avec succès.

Nombre d'employés: ${totalEmployees}
Montant total: ${totalAmount.toLocaleString('fr-FR')} ${currency}

Télécharger le rapport: ${downloadUrl}

---
Cette notification a été générée automatiquement par Jamana.
  `;

  return sendEmail({ to, subject, html, text });
}
