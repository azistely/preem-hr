/**
 * Email Templates for Termination Documents
 *
 * Professional HTML email templates in French
 */

interface TerminationDocumentsEmailData {
  employeeFirstName: string;
  employeeLastName: string;
  companyName: string;
  terminationDate: string;
  documents: {
    workCertificate?: { url: string; generatedAt: string };
    cnpsAttestation?: { url: string; generatedAt: string };
    finalPayslip?: { url: string; generatedAt: string; netAmount: number };
  };
}

/**
 * Email to employee with termination documents
 */
export function generateEmployeeTerminationEmail(data: TerminationDocumentsEmailData): string {
  const { employeeFirstName, employeeLastName, companyName, terminationDate, documents } = data;

  const hasDocuments = documents.workCertificate || documents.cnpsAttestation || documents.finalPayslip;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documents de cessation de contrat</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .document-card {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .document-title {
      font-weight: bold;
      color: #4CAF50;
      margin-bottom: 5px;
    }
    .document-meta {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    .download-button {
      display: inline-block;
      background-color: #4CAF50;
      color: white;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
    }
    .download-button:hover {
      background-color: #45a049;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .highlight {
      background-color: #fffacd;
      padding: 15px;
      border-left: 4px solid #ffd700;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Documents de cessation de contrat</h1>
  </div>

  <div class="content">
    <p>Bonjour ${employeeFirstName} ${employeeLastName},</p>

    <p>Suite à la cessation de votre contrat de travail avec ${companyName} en date du ${new Date(terminationDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}, nous vous transmettons ci-dessous les documents obligatoires.</p>

    ${hasDocuments ? `
    <div style="margin: 20px 0;">
      ${documents.workCertificate ? `
      <div class="document-card">
        <div class="document-title">📄 Certificat de travail</div>
        <div class="document-meta">
          Généré le ${new Date(documents.workCertificate.generatedAt).toLocaleDateString('fr-FR')}
        </div>
        <p style="font-size: 14px; margin: 10px 0;">
          Document légal attestant de votre emploi au sein de notre entreprise.
        </p>
        <a href="${documents.workCertificate.url}" class="download-button">Télécharger le certificat</a>
      </div>
      ` : ''}

      ${documents.finalPayslip ? `
      <div class="document-card">
        <div class="document-title">💰 Bulletin de paie final</div>
        <div class="document-meta">
          Généré le ${new Date(documents.finalPayslip.generatedAt).toLocaleDateString('fr-FR')} • Net à payer: ${documents.finalPayslip.netAmount.toLocaleString('fr-FR')} FCFA
        </div>
        <p style="font-size: 14px; margin: 10px 0;">
          Comprend votre salaire proratisé, l'indemnité de licenciement et le solde de congés.
        </p>
        <a href="${documents.finalPayslip.url}" class="download-button">Télécharger le bulletin</a>
      </div>
      ` : ''}

      ${documents.cnpsAttestation ? `
      <div class="document-card">
        <div class="document-title">🏛️ Attestation CNPS</div>
        <div class="document-meta">
          Généré le ${new Date(documents.cnpsAttestation.generatedAt).toLocaleDateString('fr-FR')}
        </div>
        <p style="font-size: 14px; margin: 10px 0;">
          Récapitulatif de vos cotisations sociales pour faire valoir vos droits.
        </p>
        <a href="${documents.cnpsAttestation.url}" class="download-button">Télécharger l'attestation</a>
      </div>
      ` : ''}
    </div>
    ` : '<p><em>Aucun document disponible pour le moment.</em></p>'}

    <div class="highlight">
      <strong>⚠️ Important:</strong> Conservez précieusement ces documents. Ils vous seront nécessaires pour:
      <ul>
        <li>Justifier votre ancienneté auprès de votre futur employeur</li>
        <li>Faire valoir vos droits à la retraite (CNPS)</li>
        <li>Vos démarches administratives</li>
      </ul>
    </div>

    <p>Si vous avez des questions concernant ces documents, n'hésitez pas à contacter le service RH.</p>

    <p>Cordialement,<br>
    <strong>${companyName}</strong></p>
  </div>

  <div class="footer">
    <p>Cet email a été généré automatiquement par le système RH de ${companyName}.</p>
    <p>Les documents sont disponibles en téléchargement pendant 90 jours.</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Email to HR with termination summary
 */
export function generateHRTerminationEmail(data: TerminationDocumentsEmailData & { hrRecipient: string }): string {
  const { employeeFirstName, employeeLastName, companyName, terminationDate, documents, hrRecipient } = data;

  const documentsGenerated = [
    documents.workCertificate && 'Certificat de travail',
    documents.cnpsAttestation && 'Attestation CNPS',
    documents.finalPayslip && 'Bulletin de paie final',
  ].filter(Boolean);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation - Documents de cessation générés</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #2196F3;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .summary-box {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .summary-item:last-child {
      border-bottom: none;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-success {
      background-color: #4CAF50;
      color: white;
    }
    .status-pending {
      background-color: #FFC107;
      color: #333;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Documents de cessation générés</h1>
  </div>

  <div class="content">
    <p>Bonjour ${hrRecipient},</p>

    <p>Les documents suivants ont été générés pour la cessation du contrat de <strong>${employeeFirstName} ${employeeLastName}</strong> en date du ${new Date(terminationDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} :</p>

    <div class="summary-box">
      ${documentsGenerated.map(doc => `
        <div class="summary-item">
          <span>${doc}</span>
          <span class="status-badge status-success">Généré</span>
        </div>
      `).join('')}

      ${!documents.workCertificate ? `
      <div class="summary-item">
        <span>Certificat de travail</span>
        <span class="status-badge status-pending">En attente</span>
      </div>
      ` : ''}

      ${!documents.finalPayslip ? `
      <div class="summary-item">
        <span>Bulletin de paie final</span>
        <span class="status-badge status-pending">En attente</span>
      </div>
      ` : ''}

      ${!documents.cnpsAttestation ? `
      <div class="summary-item">
        <span>Attestation CNPS</span>
        <span class="status-badge status-pending">En attente</span>
      </div>
      ` : ''}
    </div>

    <p><strong>Actions requises:</strong></p>
    <ul>
      <li>Les documents ont été automatiquement envoyés à l'employé par email</li>
      <li>Vous pouvez accéder à tous les documents depuis la page <a href="${process.env.NEXT_PUBLIC_APP_URL}/terminations">Cessations</a></li>
      <li>Assurez-vous que tous les paiements sont effectués dans les délais légaux</li>
    </ul>

    <p><strong>Rappel des délais légaux (Convention Collective):</strong></p>
    <ul>
      <li>Certificat de travail: 48 heures ✅</li>
      <li>Paiement final: 8 jours</li>
      <li>Attestation CNPS: 15 jours</li>
    </ul>

    <p>Cordialement,<br>
    <strong>Système RH ${companyName}</strong></p>
  </div>

  <div class="footer">
    <p>Notification automatique du système RH</p>
  </div>
</body>
</html>
  `.trim();
}
