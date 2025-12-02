/**
 * Invitation Email Templates
 *
 * HTML and text email templates for user invitations
 */

export interface InvitationEmailData {
  inviteeEmail: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
  personalMessage?: string;
}

/**
 * Role labels in French
 */
const roleLabels: Record<string, string> = {
  employee: 'Employe',
  manager: 'Manager',
  hr_manager: 'Gestionnaire RH',
  tenant_admin: 'Administrateur',
};

/**
 * Role descriptions for the email
 */
const roleDescriptions: Record<string, string> = {
  employee: 'consulter vos informations personnelles, bulletins de paie et demander des conges',
  manager: 'gerer votre equipe, approuver les conges et suivre les presences',
  hr_manager: 'gerer les employes, la paie et les ressources humaines',
  tenant_admin: 'administrer completement votre espace Preem HR',
};

/**
 * Generate HTML email for invitation
 */
export function generateInvitationEmailHtml(data: InvitationEmailData): string {
  const roleLabel = roleLabels[data.role] || data.role;
  const roleDescription = roleDescriptions[data.role] || '';
  const expiryDate = data.expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation a rejoindre ${data.companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 32px 24px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
                Bienvenue sur Preem HR
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px; color: #111827; font-size: 16px; line-height: 24px;">
                Bonjour,
              </p>

              <p style="margin: 0 0 20px; color: #111827; font-size: 16px; line-height: 24px;">
                <strong>${data.inviterName}</strong> vous invite a rejoindre <strong>${data.companyName}</strong> sur Preem HR en tant que <strong>${roleLabel}</strong>.
              </p>

              ${data.personalMessage ? `
              <div style="margin: 0 0 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #4F46E5;">
                <p style="margin: 0; color: #4b5563; font-size: 14px; font-style: italic;">
                  "${data.personalMessage}"
                </p>
              </div>
              ` : ''}

              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
                En tant que ${roleLabel}, vous pourrez:
              </p>
              <p style="margin: 0 0 24px; color: #111827; font-size: 14px;">
                ${roleDescription}
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);">
                    <a href="${data.inviteUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      Accepter l'invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
                Ou copiez ce lien dans votre navigateur:
              </p>
              <div style="margin: 0 0 24px; padding: 12px; background-color: #f3f4f6; border-radius: 6px; word-break: break-all;">
                <code style="color: #4b5563; font-size: 12px; font-family: monospace;">
                  ${data.inviteUrl}
                </code>
              </div>

              <!-- Expiry Notice -->
              <div style="padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>Important:</strong> Cette invitation expire le <strong>${expiryDate}</strong>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; line-height: 20px; text-align: center;">
                Vous recevez cet email car quelqu'un vous a invite a rejoindre Preem HR.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                &copy; ${new Date().getFullYear()} Preem HR. Tous droits reserves.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email for invitation
 */
export function generateInvitationEmailText(data: InvitationEmailData): string {
  const roleLabel = roleLabels[data.role] || data.role;
  const roleDescription = roleDescriptions[data.role] || '';
  const expiryDate = data.expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `
Bienvenue sur Preem HR

Bonjour,

${data.inviterName} vous invite a rejoindre ${data.companyName} sur Preem HR en tant que ${roleLabel}.

${data.personalMessage ? `Message: "${data.personalMessage}"\n` : ''}
En tant que ${roleLabel}, vous pourrez: ${roleDescription}

Pour accepter l'invitation, cliquez sur ce lien:
${data.inviteUrl}

IMPORTANT: Cette invitation expire le ${expiryDate}.

---
Vous recevez cet email car quelqu'un vous a invite a rejoindre Preem HR.
(c) ${new Date().getFullYear()} Preem HR. Tous droits reserves.
  `.trim();
}

/**
 * Generate email subject
 */
export function generateInvitationEmailSubject(companyName: string): string {
  return `[Preem HR] Invitation a rejoindre ${companyName}`;
}
