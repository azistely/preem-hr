/**
 * Template Preview Component
 *
 * Shows live preview of payslip template with sample data
 */

'use client';

interface TemplatePreviewProps {
  template: {
    templateName?: string;
    layoutType?: string;
    logoUrl?: string;
    headerText?: string;
    footerText?: string;
    primaryColor?: string;
    showEmployerContributions?: boolean;
    showYearToDate?: boolean;
    showLeaveBalance?: boolean;
  };
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const sampleData = {
    employeeName: 'KOUAME Jean-Pierre',
    employeeNumber: 'EMP-001',
    period: 'Octobre 2025',
    baseSalary: 500000,
    grossSalary: 650000,
    netSalary: 520000,
    cnps: 65000,
    its: 40000,
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <div
        className="p-6 text-center"
        style={{ backgroundColor: template.primaryColor || '#000000', color: 'white' }}
      >
        {template.logoUrl && (
          <img
            src={template.logoUrl}
            alt="Logo"
            className="h-12 mx-auto mb-3 object-contain"
          />
        )}
        <h2 className="text-xl font-bold">
          {template.headerText || 'BULLETIN DE PAIE'}
        </h2>
      </div>

      <div className="p-6 space-y-6 text-sm">
        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-muted-foreground">Nom:</span>
            <span className="ml-2 font-medium">{sampleData.employeeName}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Matricule:</span>
            <span className="ml-2 font-medium">{sampleData.employeeNumber}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Période:</span>
            <span className="ml-2 font-medium">{sampleData.period}</span>
          </div>
        </div>

        {/* Earnings */}
        {template.layoutType !== 'COMPACT' && (
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Gains</h3>
            <div className="flex justify-between">
              <span>Salaire de base</span>
              <span className="font-medium">
                {sampleData.baseSalary.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold">Salaire brut</span>
              <span className="font-semibold">
                {sampleData.grossSalary.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        )}

        {/* Deductions */}
        <div className="space-y-2">
          <h3 className="font-semibold text-base">Retenues</h3>
          <div className="flex justify-between">
            <span>CNPS Employé</span>
            <span>{sampleData.cnps.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div className="flex justify-between">
            <span>ITS</span>
            <span>{sampleData.its.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        {/* Employer Contributions */}
        {template.showEmployerContributions && template.layoutType === 'DETAILED' && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-semibold text-base text-muted-foreground">
              Cotisations patronales (à titre indicatif)
            </h3>
            <div className="flex justify-between text-muted-foreground">
              <span>CNPS Employeur</span>
              <span>85,000 FCFA</span>
            </div>
          </div>
        )}

        {/* Net Salary */}
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: template.primaryColor
              ? `${template.primaryColor}15`
              : '#00000015',
          }}
        >
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">NET À PAYER</span>
            <span className="text-2xl font-bold">
              {sampleData.netSalary.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>

        {/* Year to Date */}
        {template.showYearToDate && template.layoutType === 'DETAILED' && (
          <div className="border-t pt-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Cumul brut annuel</span>
              <span>6,500,000 FCFA</span>
            </div>
            <div className="flex justify-between">
              <span>Cumul ITS annuel</span>
              <span>400,000 FCFA</span>
            </div>
          </div>
        )}

        {/* Leave Balance */}
        {template.showLeaveBalance && (
          <div className="border-t pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Solde de congés</span>
              <span className="font-medium">15 jours</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {template.footerText && (
        <div className="px-6 py-4 bg-muted text-xs text-center text-muted-foreground border-t">
          {template.footerText}
        </div>
      )}
    </div>
  );
}
