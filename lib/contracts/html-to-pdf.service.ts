/**
 * HTML to PDF Conversion Service
 *
 * Converts HTML contract content (from Tiptap editor) to professional PDF documents
 * using Puppeteer with Chromium rendering engine.
 *
 * Features:
 * - Consistent professional styling
 * - French typography support
 * - A4 page format
 * - Headers and footers
 * - Page numbering
 */

import puppeteer from 'puppeteer';

interface HtmlToPdfOptions {
  // Document metadata
  title?: string;
  author?: string;
  subject?: string;
  contractNumber?: string;
  companyName?: string;

  // PDF options
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };

  // Header/Footer
  displayHeader?: boolean;
  displayFooter?: boolean;
  footerText?: string;
}

const DEFAULT_OPTIONS: HtmlToPdfOptions = {
  format: 'A4',
  margin: {
    top: '2cm',
    right: '2cm',
    bottom: '3cm',
    left: '2cm',
  },
  displayHeader: false,
  displayFooter: true,
};

/**
 * Generates professional PDF stylesheet for contract documents
 */
function generatePdfStyles(): string {
  return `
    <style>
      @page {
        size: A4;
        margin: 2cm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: 'Helvetica', 'Arial', sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #000;
        margin: 0;
        padding: 0;
      }

      /* Typography */
      h1 {
        font-size: 18pt;
        font-weight: bold;
        margin: 20pt 0 10pt 0;
        text-align: center;
        text-transform: uppercase;
      }

      h2 {
        font-size: 14pt;
        font-weight: bold;
        margin: 15pt 0 8pt 0;
        text-decoration: underline;
      }

      h3 {
        font-size: 12pt;
        font-weight: bold;
        margin: 12pt 0 6pt 0;
      }

      p {
        margin: 8pt 0;
        text-align: justify;
      }

      strong, b {
        font-weight: bold;
      }

      em, i {
        font-style: italic;
      }

      /* Lists */
      ul, ol {
        margin: 8pt 0;
        padding-left: 30pt;
      }

      li {
        margin: 4pt 0;
      }

      /* Page breaks */
      h1, h2 {
        page-break-after: avoid;
      }

      p {
        orphans: 3;
        widows: 3;
      }

      /* Print-specific adjustments */
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }

      /* Signature blocks */
      .signature-block {
        display: flex;
        justify-content: space-between;
        margin-top: 40pt;
        page-break-inside: avoid;
      }

      .signature-item {
        width: 45%;
      }

      .signature-line {
        border-top: 1pt solid #000;
        margin-top: 40pt;
        padding-top: 5pt;
        font-size: 9pt;
      }
    </style>
  `;
}

/**
 * Wraps HTML content in complete HTML document structure
 */
function wrapHtmlContent(html: string, options: HtmlToPdfOptions): string {
  const { title, contractNumber, companyName } = options;

  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title || 'Contrat de Travail'}</title>
      ${generatePdfStyles()}
    </head>
    <body>
      ${html}

      ${options.displayFooter !== false ? `
        <div style="position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #666; border-top: 1pt solid #ddd; padding-top: 8pt;">
          ${options.footerText || `${companyName || 'Document'} ${contractNumber ? `- N° ${contractNumber}` : ''} - Page <span class="pageNumber"></span> / <span class="totalPages"></span>`}
        </div>
      ` : ''}
    </body>
    </html>
  `;
}

/**
 * Converts HTML to PDF using Puppeteer
 *
 * @param html - HTML content to convert
 * @param options - PDF generation options
 * @returns PDF file as Buffer
 */
export async function convertHtmlToPdf(
  html: string,
  options: HtmlToPdfOptions = {}
): Promise<Buffer> {
  // Validate HTML input
  if (!html || typeof html !== 'string') {
    throw new Error('HTML content is required and must be a string');
  }

  // Ensure options is an object
  const safeOptions = options || {};
  const config = { ...DEFAULT_OPTIONS, ...safeOptions };

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    // Create new page
    const page = await browser.newPage();

    // Wrap HTML in complete document
    const fullHtml = wrapHtmlContent(html, config);

    // Set content
    await page.setContent(fullHtml, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: config.format,
      margin: config.margin,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: config.displayHeader || config.displayFooter,
      headerTemplate: config.displayHeader ? '<div></div>' : undefined,
      footerTemplate: config.displayFooter
        ? `
          <div style="font-size: 8pt; text-align: center; width: 100%; color: #666;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `
        : undefined,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Error converting HTML to PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Always close browser
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generates PDF from contract HTML with pre-populated data
 *
 * @param htmlContent - Contract content as HTML
 * @param contractData - Contract metadata for header/footer
 * @returns PDF Buffer
 */
export async function generateContractPdf(
  htmlContent: string,
  contractData: {
    contractNumber?: string;
    contractType: string;
    employeeName: string;
    companyName: string;
  }
): Promise<Buffer> {
  // Validate inputs
  if (!htmlContent || typeof htmlContent !== 'string') {
    throw new Error('Invalid HTML content: must be a non-empty string');
  }

  if (!contractData) {
    throw new Error('Contract data is required');
  }

  if (!contractData.contractType) {
    throw new Error('Contract type is required');
  }

  if (!contractData.employeeName) {
    throw new Error('Employee name is required');
  }

  if (!contractData.companyName) {
    throw new Error('Company name is required');
  }

  const title = `Contrat ${contractData.contractType} - ${contractData.employeeName}`;

  return convertHtmlToPdf(htmlContent, {
    title,
    contractNumber: contractData.contractNumber,
    companyName: contractData.companyName,
    subject: `Contrat de travail ${contractData.contractType}`,
    author: contractData.companyName,
    displayFooter: true,
    footerText: `${contractData.companyName} - Contrat ${contractData.contractType} ${contractData.contractNumber ? `N° ${contractData.contractNumber}` : ''}`,
  });
}
