/**
 * Pay Slip PDF Generator
 *
 * Generates French-language bulletin de paie (pay slip) PDFs
 * for Côte d'Ivoire employees compliant with local labor law.
 *
 * Required fields per CI labor law:
 * - Employer info (company name, address, CNPS number)
 * - Employee info (name, position, employee number, CNPS number)
 * - Period (month/year)
 * - Earnings breakdown
 * - Deductions breakdown
 * - Employer contributions
 * - Net salary (highlighted)
 * - Payment method and date
 */

import * as React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ========================================
// Types
// ========================================

export interface PayslipData {
  // Company info
  companyName: string;
  companyAddress?: string;
  companyCNPS?: string;
  companyTaxId?: string;

  // Employee info
  employeeName: string;
  employeeNumber: string;
  employeeCNPS?: string;
  employeePosition?: string;

  // Period
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;

  // Earnings
  baseSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  seniorityBonus?: number;
  familyAllowance?: number;
  overtimePay?: number;
  bonuses?: number;
  grossSalary: number;

  // Component-based earnings (new system)
  components?: Array<{
    code: string;
    name: string;
    amount: number;
  }>;

  // Deductions
  cnpsEmployee: number;
  cmuEmployee: number;
  its: number;
  totalDeductions: number;

  // Employer contributions
  cnpsEmployer: number;
  cmuEmployer: number;
  fdfp?: number;

  // Net
  netSalary: number;

  // Payment
  paymentMethod?: string;
  bankAccount?: string;

  // Days
  daysWorked?: number;
  daysInPeriod?: number;

  // CDDTI-specific fields (Phase 5)
  isCDDTI?: boolean;
  gratification?: number; // 6.25% - Prime annuelle de 75% répartie sur l'année
  congesPayes?: number; // 10.15% - Provision de 2.2 jours/mois
  indemnitePrecarite?: number; // 3% of (base + gratification + congés)
  hoursWorked?: number; // Total hours for daily workers
  timeEntriesSummary?: {
    regularHours: number;
    overtimeHours: number;
    saturdayHours: number;
    sundayHours: number;
    nightHours: number;
  };
  paymentFrequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  // Additional details (optional)
  earningsDetails?: Array<{ description: string; amount: number }>;
  deductionsDetails?: Array<{ description: string; amount: number }>;

  // Country configuration for dynamic labels
  countryConfig?: {
    taxSystemName: string;
    socialSchemeName: string;
    laborCodeReference?: string;
    contributions: Array<{
      code: string;
      name: string;
      employeeRate: number;
      employerRate: number;
      employeeAmount?: number;
      employerAmount?: number;
    }>;
    otherTaxes: Array<{
      code: string;
      name: string;
      paidBy: 'employee' | 'employer';
      amount?: number;
    }>;
  };
}

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    color: '#4a4a4a',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '2 solid #000000',
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '50%',
    fontSize: 9,
    color: '#4a4a4a',
  },
  value: {
    width: '50%',
    fontSize: 9,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  table: {
    marginTop: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e0e0e0',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
    borderBottom: '2 solid #000000',
  },
  col1: {
    width: '60%',
    paddingLeft: 5,
  },
  col2: {
    width: '40%',
    textAlign: 'right',
    paddingRight: 5,
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  netRow: {
    flexDirection: 'row',
    marginTop: 15,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  netLabel: {
    width: '60%',
    paddingLeft: 5,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  netValue: {
    width: '40%',
    textAlign: 'right',
    paddingRight: 5,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: '1 solid #000000',
    fontSize: 8,
    color: '#666666',
  },
  footerText: {
    marginBottom: 3,
  },
  // CDDTI-specific styles (Phase 5)
  highlightBox: {
    backgroundColor: '#fff8e1',
    border: '2 solid #ffa726',
    padding: 10,
    marginBottom: 15,
    borderRadius: 4,
  },
  highlightTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#e65100',
    marginBottom: 8,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  highlightLabel: {
    fontSize: 9,
    color: '#4a4a4a',
    fontWeight: 'bold',
  },
  highlightValue: {
    fontSize: 9,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
});

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): string => {
  // Format with fr-FR locale, then replace narrow no-break space (U+202F) with regular space
  // @react-pdf/renderer doesn't render U+202F correctly, showing it as a slash
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return formatted.replace(/\u202F/g, ' ');
};

const formatPeriod = (start: Date, end: Date): string => {
  return format(start, 'MMMM yyyy', { locale: fr }).toUpperCase();
};

// ========================================
// PDF Document Component
// ========================================

export const PayslipDocument: React.FC<{ data: PayslipData }> = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>BULLETIN DE PAIE</Text>
        <Text style={styles.subtitle}>{formatPeriod(data.periodStart, data.periodEnd)}</Text>
      </View>

      {/* Company & Employee Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INFORMATIONS</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Employeur :</Text>
          <Text style={styles.value}>{data.companyName}</Text>
        </View>
        {data.companyAddress && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Adresse :</Text>
            <Text style={styles.value}>{data.companyAddress}</Text>
          </View>
        )}
        {data.companyCNPS && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>N° CNPS Employeur :</Text>
            <Text style={styles.value}>{data.companyCNPS}</Text>
          </View>
        )}
        {data.companyTaxId && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>N° CC/DGI :</Text>
            <Text style={styles.value}>{data.companyTaxId}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Salarié :</Text>
          <Text style={styles.value}>{data.employeeName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Matricule :</Text>
          <Text style={styles.value}>{data.employeeNumber}</Text>
        </View>
        {data.employeePosition && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Poste :</Text>
            <Text style={styles.value}>{data.employeePosition}</Text>
          </View>
        )}
        {data.employeeCNPS && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>N° CNPS Salarié :</Text>
            <Text style={styles.value}>{data.employeeCNPS}</Text>
          </View>
        )}
        {data.daysWorked !== undefined && data.daysInPeriod !== undefined && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Jours travaillés :</Text>
            <Text style={styles.value}>
              {data.daysWorked} / {data.daysInPeriod}
            </Text>
          </View>
        )}
      </View>

      {/* Earnings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GAINS</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.col1}>Libellé</Text>
            <Text style={styles.col2}>Montant (FCFA)</Text>
          </View>

          {/* Render from components array if available (new system) */}
          {data.components && data.components.length > 0 ? (
            <>
              {data.components.map((component, index) => (
                <View key={`component-${index}`} style={styles.tableRow}>
                  <Text style={styles.col1}>{component.name}</Text>
                  <Text style={styles.col2}>{formatCurrency(component.amount)}</Text>
                </View>
              ))}
              {data.overtimePay && data.overtimePay > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Heures supplémentaires</Text>
                  <Text style={styles.col2}>{formatCurrency(data.overtimePay)}</Text>
                </View>
              )}
              {data.bonuses && data.bonuses > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Primes et bonus</Text>
                  <Text style={styles.col2}>{formatCurrency(data.bonuses)}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              {/* Fallback to hardcoded fields for backward compatibility */}
              <View style={styles.tableRow}>
                <Text style={styles.col1}>Salaire de base</Text>
                <Text style={styles.col2}>{formatCurrency(data.baseSalary)}</Text>
              </View>
              {data.housingAllowance && data.housingAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Prime de logement</Text>
                  <Text style={styles.col2}>{formatCurrency(data.housingAllowance)}</Text>
                </View>
              )}
              {data.transportAllowance && data.transportAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Prime de transport</Text>
                  <Text style={styles.col2}>{formatCurrency(data.transportAllowance)}</Text>
                </View>
              )}
              {data.mealAllowance && data.mealAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Prime de panier</Text>
                  <Text style={styles.col2}>{formatCurrency(data.mealAllowance)}</Text>
                </View>
              )}
              {data.seniorityBonus && data.seniorityBonus > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Prime d'ancienneté</Text>
                  <Text style={styles.col2}>{formatCurrency(data.seniorityBonus)}</Text>
                </View>
              )}
              {data.familyAllowance && data.familyAllowance > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Allocations familiales</Text>
                  <Text style={styles.col2}>{formatCurrency(data.familyAllowance)}</Text>
                </View>
              )}
              {data.overtimePay && data.overtimePay > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Heures supplémentaires</Text>
                  <Text style={styles.col2}>{formatCurrency(data.overtimePay)}</Text>
                </View>
              )}
              {data.bonuses && data.bonuses > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.col1}>Primes et bonus</Text>
                  <Text style={styles.col2}>{formatCurrency(data.bonuses)}</Text>
                </View>
              )}
              {data.earningsDetails?.map((detail, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.col1}>{detail.description}</Text>
                  <Text style={styles.col2}>{formatCurrency(detail.amount)}</Text>
                </View>
              ))}
            </>
          )}
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.col1}>SALAIRE BRUT</Text>
          <Text style={styles.col2}>{formatCurrency(data.grossSalary)}</Text>
        </View>
      </View>

      {/* CDDTI Highlight Box (Phase 5) */}
      {data.isCDDTI && (
        <View style={styles.highlightBox}>
          <Text style={styles.highlightTitle}>
            COMPOSANTES CDDTI (Contrat à Durée Déterminée à Terme Imprécis)
          </Text>
          {data.gratification && data.gratification > 0 && (
            <View style={styles.highlightRow}>
              <Text style={styles.highlightLabel}>Gratification (6,25%) :</Text>
              <Text style={styles.highlightValue}>{formatCurrency(data.gratification)}</Text>
            </View>
          )}
          {data.congesPayes && data.congesPayes > 0 && (
            <View style={styles.highlightRow}>
              <Text style={styles.highlightLabel}>Congés payés (10,15%) :</Text>
              <Text style={styles.highlightValue}>{formatCurrency(data.congesPayes)}</Text>
            </View>
          )}
          {data.indemnitePrecarite && data.indemnitePrecarite > 0 && (
            <View style={styles.highlightRow}>
              <Text style={styles.highlightLabel}>Indemnité de précarité (3%) :</Text>
              <Text style={styles.highlightValue}>{formatCurrency(data.indemnitePrecarite)}</Text>
            </View>
          )}
          {data.daysWorked !== undefined && (
            <View style={styles.highlightRow}>
              <Text style={styles.highlightLabel}>Jours travaillés :</Text>
              <Text style={styles.highlightValue}>{data.daysWorked}</Text>
            </View>
          )}
          {data.hoursWorked !== undefined && (
            <View style={styles.highlightRow}>
              <Text style={styles.highlightLabel}>Heures travaillées :</Text>
              <Text style={styles.highlightValue}>{data.hoursWorked} h</Text>
            </View>
          )}
          {data.paymentFrequency && data.paymentFrequency !== 'MONTHLY' && (
            <View style={styles.highlightRow}>
              <Text style={styles.highlightLabel}>Fréquence de paiement :</Text>
              <Text style={styles.highlightValue}>
                {data.paymentFrequency === 'WEEKLY'
                  ? 'Hebdomadaire'
                  : data.paymentFrequency === 'BIWEEKLY'
                  ? 'Quinzaine'
                  : 'Journalier'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Time Entries Summary (for daily workers) */}
      {data.timeEntriesSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DÉTAIL DES HEURES</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.col1}>Type d'heures</Text>
              <Text style={styles.col2}>Heures</Text>
            </View>
            {data.timeEntriesSummary.regularHours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>Heures normales</Text>
                <Text style={styles.col2}>{data.timeEntriesSummary.regularHours} h</Text>
              </View>
            )}
            {data.timeEntriesSummary.overtimeHours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>Heures supplémentaires</Text>
                <Text style={styles.col2}>{data.timeEntriesSummary.overtimeHours} h</Text>
              </View>
            )}
            {data.timeEntriesSummary.saturdayHours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>Heures samedi</Text>
                <Text style={styles.col2}>{data.timeEntriesSummary.saturdayHours} h</Text>
              </View>
            )}
            {data.timeEntriesSummary.sundayHours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>Heures dimanche/férié</Text>
                <Text style={styles.col2}>{data.timeEntriesSummary.sundayHours} h</Text>
              </View>
            )}
            {data.timeEntriesSummary.nightHours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>Heures de nuit</Text>
                <Text style={styles.col2}>{data.timeEntriesSummary.nightHours} h</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Deductions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RETENUES SALARIALES</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.col1}>Libellé</Text>
            <Text style={styles.col2}>Montant (FCFA)</Text>
          </View>

          {/* Dynamic contribution labels from country config */}
          {data.countryConfig?.contributions
            .filter((contrib) => (contrib.employeeAmount ?? 0) > 0)
            .map((contrib) => (
              <View key={contrib.code} style={styles.tableRow}>
                <Text style={styles.col1}>
                  {contrib.name} ({(contrib.employeeRate * 100).toFixed(1)}%)
                </Text>
                <Text style={styles.col2}>
                  {formatCurrency(contrib.employeeAmount || 0)}
                </Text>
              </View>
            ))}

          {/* Fallback to hardcoded labels if no country config */}
          {!data.countryConfig && (
            <>
              <View style={styles.tableRow}>
                <Text style={styles.col1}>CNPS Salarié (6,3%)</Text>
                <Text style={styles.col2}>{formatCurrency(data.cnpsEmployee)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col1}>CMU Salarié</Text>
                <Text style={styles.col2}>{formatCurrency(data.cmuEmployee)}</Text>
              </View>
            </>
          )}

          {/* Tax */}
          <View style={styles.tableRow}>
            <Text style={styles.col1}>
              {data.countryConfig?.taxSystemName || 'Impôt sur Traitement et Salaire (ITS)'}
            </Text>
            <Text style={styles.col2}>{formatCurrency(data.its)}</Text>
          </View>

          {data.deductionsDetails?.map((detail, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{detail.description}</Text>
              <Text style={styles.col2}>{formatCurrency(detail.amount)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.col1}>TOTAL RETENUES</Text>
          <Text style={styles.col2}>{formatCurrency(data.totalDeductions)}</Text>
        </View>
      </View>

      {/* Employer Contributions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CHARGES PATRONALES (Information)</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.col1}>Libellé</Text>
            <Text style={styles.col2}>Montant (FCFA)</Text>
          </View>

          {/* Dynamic employer contribution labels from country config */}
          {data.countryConfig?.contributions
            .filter((contrib) => (contrib.employerAmount ?? 0) > 0)
            .map((contrib) => (
              <View key={contrib.code} style={styles.tableRow}>
                <Text style={styles.col1}>
                  {contrib.name} Patronale ({(contrib.employerRate * 100).toFixed(1)}%)
                </Text>
                <Text style={styles.col2}>
                  {formatCurrency(contrib.employerAmount || 0)}
                </Text>
              </View>
            ))}

          {/* Fallback to hardcoded labels if no country config */}
          {!data.countryConfig && (
            <>
              <View style={styles.tableRow}>
                <Text style={styles.col1}>CNPS Patronale (7,7% + 5% + 2-5%)</Text>
                <Text style={styles.col2}>{formatCurrency(data.cnpsEmployer)}</Text>
              </View>
              <View style={styles.tableRow}>
                <Text style={styles.col1}>CMU Patronale</Text>
                <Text style={styles.col2}>{formatCurrency(data.cmuEmployer)}</Text>
              </View>
            </>
          )}

          {/* Other employer taxes */}
          {data.countryConfig?.otherTaxes
            ?.filter((tax) => tax.paidBy === 'employer' && (tax.amount ?? 0) > 0)
            .map((tax) => (
              <View key={tax.code} style={styles.tableRow}>
                <Text style={styles.col1}>{tax.name}</Text>
                <Text style={styles.col2}>{formatCurrency(tax.amount || 0)}</Text>
              </View>
            ))}

          {/* Fallback FDFP for legacy payslips */}
          {!data.countryConfig && data.fdfp && data.fdfp > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.col1}>FDFP (Formation professionnelle)</Text>
              <Text style={styles.col2}>{formatCurrency(data.fdfp)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Net Salary */}
      <View style={styles.netRow}>
        <Text style={styles.netLabel}>SALAIRE NET À PAYER</Text>
        <Text style={styles.netValue}>{formatCurrency(data.netSalary)} FCFA</Text>
      </View>

      {/* Payment Info */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Mode de paiement :</Text>
          <Text style={styles.value}>{data.paymentMethod || 'Virement bancaire'}</Text>
        </View>
        {data.bankAccount && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Compte bancaire :</Text>
            <Text style={styles.value}>{data.bankAccount}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Date de paiement :</Text>
          <Text style={styles.value}>
            {format(data.payDate, 'dd MMMM yyyy', { locale: fr })}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {data.countryConfig?.laborCodeReference ||
           'Ce bulletin de paie est conforme aux dispositions du Code du Travail.'}
        </Text>
        <Text style={styles.footerText}>
          Document généré le {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}
        </Text>
      </View>
    </Page>
  </Document>
);

/**
 * Generate pay slip file name
 */
export const generatePayslipFilename = (
  employeeName: string,
  periodStart: Date
): string => {
  const sanitizedName = employeeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const month = format(periodStart, 'MM', { locale: fr });
  const year = format(periodStart, 'yyyy', { locale: fr });
  return `Bulletin_Paie_${sanitizedName}_${month}_${year}.pdf`;
};
