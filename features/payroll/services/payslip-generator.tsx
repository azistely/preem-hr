/**
 * Pay Slip PDF Generator
 *
 * Generates French-language bulletin de paie (pay slip) PDFs
 * for West African countries compliant with local labor law.
 *
 * Layout inspired by professional French payslip design with:
 * - Company header (2-column layout)
 * - Employee information (2-column grid)
 * - Gains table (4 columns: Désignation, Base, Taux, Montant)
 * - Cotisations sociales (6 columns: employee + employer breakdown)
 * - Bottom summary (YTD cumuls + Net à payer)
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
  employeeDepartment?: string;
  employeeHireDate?: Date;
  employeeContractType?: string; // e.g., "CDI", "CDD", "CDDTI"

  // Bank and administrative details (Coordonnées bancaires & administratives)
  socialSecurityNumber?: string;
  iban?: string;
  healthInsurance?: string; // Mutuelle name
  pensionScheme?: string; // Régime retraite
  email?: string;
  phone?: string;

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
  brutImposable?: number; // Taxable gross (after tax-exempt deductions)

  // Component-based earnings (new system)
  components?: Array<{
    code: string;
    name: string;
    amount: number;
    base?: string; // e.g., "21 jours", "151.67 h"
    rate?: string; // e.g., "3%", "22.50 €"
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
  totalEmployerContributions?: number;

  // Net
  netSalary: number;

  // Payment
  paymentMethod?: string;
  bankAccount?: string;

  // Days
  daysWorked?: number;
  daysInPeriod?: number;

  // YTD Cumulative totals
  ytdGross?: number;
  ytdTaxableNet?: number;
  ytdNetPaid?: number;

  // CDDTI-specific fields (Phase 5)
  isCDDTI?: boolean;
  gratification?: number;
  congesPayes?: number;
  indemnitePrecarite?: number;
  hoursWorked?: number;
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

  // Leave and absences data (Absences et congés + Soldes de congés)
  absencesDuringPeriod?: Array<{
    type: string; // e.g., "Congés payés", "Arrêt maladie", "Congés événements familiaux"
    startDate: Date;
    endDate: Date;
    duration: number; // in days
    treatment: 'paid' | 'unpaid' | 'not_processed'; // "Payé (Déduit des congés)", "Non payé", "Non traité"
    impact?: string;
  }>;
  leaveBalances?: {
    paidLeave?: { total: number; used: number }; // Congés payés (30 days/year in West Africa)
    sickLeave?: { total: number | 'unlimited'; used: number }; // Arrêt maladie (unlimited with certificate)
    familyEvents?: { total: number | 'by_event'; used: number }; // Congés événements familiaux (variable by event)
  };

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
      base?: number; // Calculation base
    }>;
    otherTaxes: Array<{
      code: string;
      name: string;
      paidBy: 'employee' | 'employer';
      amount?: number;
      rate?: number;
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

  // Header section (company + document info)
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 16,
    marginBottom: 16,
  },
  headerLeft: {
    width: '50%',
  },
  headerRight: {
    width: '50%',
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  companyInfo: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },

  // Employee information section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    borderBottom: '1 solid #e5e7eb',
    paddingBottom: 4,
  },
  employeeInfoGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  employeeInfoColumn: {
    width: '50%',
  },
  infoRow: {
    marginBottom: 5,
  },
  infoText: {
    fontSize: 10,
    color: '#6b7280',
  },

  // Tables - 4 column (Gains)
  table: {
    marginTop: 6,
    border: '1 solid #e5e7eb',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRowGray: {
    backgroundColor: '#f9fafb',
    fontWeight: 'bold',
    borderTop: '1 solid #e5e7eb',
  },

  // Gains table columns (4 columns)
  colDesignation: {
    width: '45%',
    fontSize: 10,
    color: '#111827',
  },
  colBase: {
    width: '20%',
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'right',
  },
  colTaux: {
    width: '15%',
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'right',
  },
  colMontant: {
    width: '20%',
    fontSize: 10,
    color: '#111827',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  colMontantDeduction: {
    width: '20%',
    fontSize: 10,
    color: '#dc2626', // Red color for deductions
    textAlign: 'right',
    fontWeight: 'bold',
  },

  // Contributions table columns (6 columns)
  contribColDesignation: {
    width: '28%',
    fontSize: 9,
    color: '#111827',
  },
  contribColBase: {
    width: '14%',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  contribColTauxSal: {
    width: '13%',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  contribColMontantSal: {
    width: '15%',
    fontSize: 9,
    color: '#111827',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  contribColTauxPat: {
    width: '13%',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  contribColMontantPat: {
    width: '17%',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },

  // Contributions table (compact spacing)
  contribTableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  contribTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  // Header text styles
  tableHeaderText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableHeaderTextSmall: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },

  // Bottom summary section
  summaryContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 20,
  },
  summaryLeft: {
    width: '48%',
    backgroundColor: '#e0e7ff', // Light lavender/blue matching design
    padding: 16,
    borderRadius: 4,
    border: '1 solid #c7d2fe',
  },
  summaryRight: {
    width: '48%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 4,
    border: '1 solid #e5e7eb',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 4,
    borderBottom: '1 solid #e5e7eb',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#111827',
  },
  summaryValue: {
    fontSize: 10,
    color: '#111827',
    fontWeight: 'bold',
  },
  netAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  paymentDetail: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },

  // Footer
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTop: '1 solid #e5e7eb',
  },
  footerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
  footerBranding: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    borderTop: '1 solid #f3f4f6',
  },
  footerBrandText: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  footerBrandName: {
    fontWeight: 'bold',
    color: '#4f46e5', // Preem brand color (indigo)
  },
  footerWebsite: {
    fontSize: 7,
    color: '#9ca3af',
    fontStyle: 'italic',
  },

  // CDDTI highlight box
  highlightBox: {
    backgroundColor: '#fef3c7',
    border: '2 solid #fbbf24',
    padding: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  highlightTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 8,
  },
  highlightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  highlightLabel: {
    fontSize: 9,
    color: '#78350f',
    fontWeight: 'bold',
  },
  highlightValue: {
    fontSize: 9,
    color: '#78350f',
    fontWeight: 'bold',
  },

  // Absences et congés table (5 columns)
  absencesTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  absencesTableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  absencesColType: {
    width: '20%',
    fontSize: 9,
    color: '#111827',
  },
  absencesColPeriode: {
    width: '30%',
    fontSize: 9,
    color: '#6b7280',
  },
  absencesColDuree: {
    width: '15%',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'right',
  },
  absencesColTraitement: {
    width: '25%',
    fontSize: 9,
    color: '#111827',
  },
  absencesColImpact: {
    width: '10%',
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Leave balance cards section
  leaveBalancesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  leaveBalanceCard: {
    width: '23%',
    backgroundColor: '#ffffff',
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 8,
  },
  leaveBalanceLabel: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 4,
  },
  leaveBalanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 2,
  },
  leaveBalanceSubtext: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

// ========================================
// Helper Functions
// ========================================

const formatCurrency = (amount: number): string => {
  // Format with fr-FR locale (space thousands separator)
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return formatted.replace(/\u202F/g, ' ');
};

const formatPeriod = (start: Date, end: Date): string => {
  return format(start, 'MMMM yyyy', { locale: fr });
};

// Calculate contribution rate from amount and base
const calculateRate = (amount: number, base: number): string => {
  if (base === 0) return '-';
  const rate = (amount / base) * 100;
  return `${rate.toFixed(1)}%`;
};

// ========================================
// PDF Document Component
// ========================================

export const PayslipDocument: React.FC<{ data: PayslipData }> = ({ data }) => {
  // Determine social security scheme name
  const socialSchemeName = data.countryConfig?.socialSchemeName || 'CNPS';
  const taxSystemName = data.countryConfig?.taxSystemName || 'ITS';

  // Calculate rates if not provided in countryConfig
  const cnpsEmployeeRate = data.countryConfig?.contributions.find(c => c.code === 'cnps_employee')?.employeeRate
    || (data.cnpsEmployee / data.grossSalary);
  const cnpsEmployerRate = data.countryConfig?.contributions.find(c => c.code === 'cnps_employer')?.employerRate
    || (data.cnpsEmployer / data.grossSalary);
  const fdfpRate = data.fdfp && data.grossSalary > 0 ? data.fdfp / data.grossSalary : 0.012;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ============================================ */}
        {/* HEADER: Company Info (left) + Document Info (right) */}
        {/* ============================================ */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{data.companyName.toUpperCase()}</Text>
            {data.companyAddress && (
              <Text style={styles.companyInfo}>{data.companyAddress}</Text>
            )}
            {data.companyCNPS && (
              <Text style={styles.companyInfo}>N° {socialSchemeName}: {data.companyCNPS}</Text>
            )}
            {data.companyTaxId && (
              <Text style={styles.companyInfo}>CC/DGI: {data.companyTaxId}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentTitle}>Bulletin de salaire</Text>
            <Text style={styles.documentTitle}>
              Période: {formatPeriod(data.periodStart, data.periodEnd)}
            </Text>
            <Text style={styles.documentTitle}>
              Date d'émission: {format(data.payDate, 'dd/MM/yyyy', { locale: fr })}
            </Text>
          </View>
        </View>

        {/* ============================================ */}
        {/* EMPLOYEE INFORMATION (2-column grid) */}
        {/* ============================================ */}
        <View style={styles.section}>
          <View style={styles.employeeInfoGrid}>
            {/* Left column: Informations salarié */}
            <View style={styles.employeeInfoColumn}>
              <Text style={styles.sectionTitle}>Informations salarié</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>Nom: {data.employeeName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>Matricule: {data.employeeNumber}</Text>
              </View>
              {data.employeePosition && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Poste: {data.employeePosition}</Text>
                </View>
              )}
              {data.employeeDepartment && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Département: {data.employeeDepartment}</Text>
                </View>
              )}
              {data.employeeHireDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>
                    Date d'entrée: {format(data.employeeHireDate, 'dd/MM/yyyy', { locale: fr })}
                  </Text>
                </View>
              )}
              {data.employeeContractType && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Type de contrat: {data.employeeContractType}</Text>
                </View>
              )}
            </View>

            {/* Right column: Coordonnées bancaires & administratives */}
            <View style={styles.employeeInfoColumn}>
              <Text style={styles.sectionTitle}>Coordonnées bancaires & administratives</Text>
              {data.socialSecurityNumber && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>N° Sécurité Sociale: {data.socialSecurityNumber}</Text>
                </View>
              )}
              {data.iban && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>IBAN: {data.iban}</Text>
                </View>
              )}
              {data.healthInsurance && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Mutuelle: {data.healthInsurance}</Text>
                </View>
              )}
              {data.pensionScheme && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Régime retraite: {data.pensionScheme}</Text>
                </View>
              )}
              {data.email && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Email: {data.email}</Text>
                </View>
              )}
              {data.phone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Téléphone: {data.phone}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* GAINS TABLE (4 columns) */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Éléments de rémunération</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colDesignation, styles.tableHeaderText]}>Désignation</Text>
              <Text style={[styles.colBase, styles.tableHeaderText]}>Base</Text>
              <Text style={[styles.colTaux, styles.tableHeaderText]}>Taux</Text>
              <Text style={[styles.colMontant, styles.tableHeaderText]}>Montant</Text>
            </View>

            {/* Render from components array if available */}
            {data.components && data.components.length > 0 ? (
              <>
                {data.components.map((component, index) => (
                  <View key={`component-${index}`} style={styles.tableRow}>
                    <Text style={styles.colDesignation}>{component.name}</Text>
                    <Text style={styles.colBase}>{component.base || ''}</Text>
                    <Text style={styles.colTaux}>{component.rate || ''}</Text>
                    <Text style={styles.colMontant}>{formatCurrency(component.amount)}</Text>
                  </View>
                ))}
                {data.overtimePay && data.overtimePay > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Heures supplémentaires</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.overtimePay)}</Text>
                  </View>
                )}
                {data.bonuses && data.bonuses > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Primes et bonus</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.bonuses)}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Fallback to hardcoded fields */}
                <View style={styles.tableRow}>
                  <Text style={styles.colDesignation}>Salaire de base</Text>
                  <Text style={styles.colBase}>
                    {data.daysWorked ? `${data.daysWorked} jours` : ''}
                  </Text>
                  <Text style={styles.colTaux}></Text>
                  <Text style={styles.colMontant}>{formatCurrency(data.baseSalary)}</Text>
                </View>
                {data.seniorityBonus && data.seniorityBonus > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Prime d'ancienneté</Text>
                    <Text style={styles.colBase}>{formatCurrency(data.baseSalary)}</Text>
                    <Text style={styles.colTaux}>
                      {calculateRate(data.seniorityBonus, data.baseSalary)}
                    </Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.seniorityBonus)}</Text>
                  </View>
                )}
                {data.transportAllowance && data.transportAllowance > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Prime de transport</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.transportAllowance)}</Text>
                  </View>
                )}
                {data.housingAllowance && data.housingAllowance > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Prime de logement</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.housingAllowance)}</Text>
                  </View>
                )}
                {data.mealAllowance && data.mealAllowance > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Prime de panier</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.mealAllowance)}</Text>
                  </View>
                )}
                {data.familyAllowance && data.familyAllowance > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Allocations familiales</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.familyAllowance)}</Text>
                  </View>
                )}
                {data.overtimePay && data.overtimePay > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Heures supplémentaires</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.overtimePay)}</Text>
                  </View>
                )}
                {data.bonuses && data.bonuses > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>Primes et bonus</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.bonuses)}</Text>
                  </View>
                )}
                {data.earningsDetails?.map((detail, index) => (
                  <View key={index} style={styles.tableRow}>
                    <Text style={styles.colDesignation}>{detail.description}</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}></Text>
                    <Text style={styles.colMontant}>{formatCurrency(detail.amount)}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Subtotal: Gross Salary */}
            <View style={[styles.tableRow, styles.tableRowGray]}>
              <Text style={styles.colDesignation}>Salaire brut</Text>
              <Text style={styles.colBase}></Text>
              <Text style={styles.colTaux}></Text>
              <Text style={styles.colMontant}>{formatCurrency(data.grossSalary)}</Text>
            </View>
          </View>
        </View>

        {/* CDDTI Highlight Box */}
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
          </View>
        )}

        {/* Time Entries Summary */}
        {data.timeEntriesSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Détail des heures</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colDesignation, styles.tableHeaderText]}>Type d'heures</Text>
                <Text style={[styles.colMontant, styles.tableHeaderText]}>Heures</Text>
              </View>
              {data.timeEntriesSummary.regularHours > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesignation}>Heures normales</Text>
                  <Text style={styles.colMontant}>{data.timeEntriesSummary.regularHours} h</Text>
                </View>
              )}
              {data.timeEntriesSummary.overtimeHours > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesignation}>Heures supplémentaires</Text>
                  <Text style={styles.colMontant}>{data.timeEntriesSummary.overtimeHours} h</Text>
                </View>
              )}
              {data.timeEntriesSummary.saturdayHours > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesignation}>Heures samedi</Text>
                  <Text style={styles.colMontant}>{data.timeEntriesSummary.saturdayHours} h</Text>
                </View>
              )}
              {data.timeEntriesSummary.sundayHours > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesignation}>Heures dimanche/férié</Text>
                  <Text style={styles.colMontant}>{data.timeEntriesSummary.sundayHours} h</Text>
                </View>
              )}
              {data.timeEntriesSummary.nightHours > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.colDesignation}>Heures de nuit</Text>
                  <Text style={styles.colMontant}>{data.timeEntriesSummary.nightHours} h</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* RETENUES EMPLOYÉ (Employee Deductions) */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Retenues employé</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colDesignation, styles.tableHeaderText]}>Désignation</Text>
              <Text style={[styles.colBase, styles.tableHeaderText]}>Base</Text>
              <Text style={[styles.colTaux, styles.tableHeaderText]}>Taux</Text>
              <Text style={[styles.colMontant, styles.tableHeaderText]}>Montant</Text>
            </View>

            {/* Employee contributions from countryConfig */}
            {data.countryConfig?.contributions && data.countryConfig.contributions.length > 0 ? (
              <>
                {data.countryConfig.contributions
                  .filter((contrib) => (contrib.employeeAmount ?? 0) > 0)
                  .map((contrib) => (
                    <View key={`emp-${contrib.code}`} style={styles.tableRow}>
                      <Text style={styles.colDesignation}>{contrib.name}</Text>
                      <Text style={styles.colBase}>
                        {contrib.base ? formatCurrency(contrib.base) : ''}
                      </Text>
                      <Text style={styles.colTaux}>
                        {`${(contrib.employeeRate * 100).toFixed(1)}%`}
                      </Text>
                      <Text style={styles.colMontantDeduction}>
                        -{formatCurrency(contrib.employeeAmount || 0)}
                      </Text>
                    </View>
                  ))}
              </>
            ) : (
              <>
                {/* Fallback: CNPS Employee */}
                {data.cnpsEmployee > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>{socialSchemeName} - Prestations familiales</Text>
                    <Text style={styles.colBase}>{formatCurrency(data.grossSalary)}</Text>
                    <Text style={styles.colTaux}>{(cnpsEmployeeRate * 100).toFixed(1)}%</Text>
                    <Text style={styles.colMontantDeduction}>-{formatCurrency(data.cnpsEmployee)}</Text>
                  </View>
                )}

                {/* CMU Employee */}
                {data.cmuEmployee > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>CMU</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}>Fixe</Text>
                    <Text style={styles.colMontantDeduction}>-{formatCurrency(data.cmuEmployee)}</Text>
                  </View>
                )}
              </>
            )}

            {/* ITS / Tax */}
            {data.its > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.colDesignation}>{taxSystemName}</Text>
                <Text style={styles.colBase}>
                  {data.brutImposable ? formatCurrency(data.brutImposable) : formatCurrency(data.grossSalary)}
                </Text>
                <Text style={styles.colTaux}>Progr.</Text>
                <Text style={styles.colMontantDeduction}>-{formatCurrency(data.its)}</Text>
              </View>
            )}

            {/* Additional employee deductions */}
            {data.deductionsDetails?.map((detail, index) => (
              <View key={`emp-deduction-${index}`} style={styles.tableRow}>
                <Text style={styles.colDesignation}>{detail.description}</Text>
                <Text style={styles.colBase}></Text>
                <Text style={styles.colTaux}></Text>
                <Text style={styles.colMontantDeduction}>-{formatCurrency(detail.amount)}</Text>
              </View>
            ))}

            {/* Total employee deductions */}
            <View style={[styles.tableRow, styles.tableRowGray]}>
              <Text style={styles.colDesignation}>Total retenues employé</Text>
              <Text style={styles.colBase}></Text>
              <Text style={styles.colTaux}></Text>
              <Text style={styles.colMontantDeduction}>-{formatCurrency(data.totalDeductions)}</Text>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* CHARGES PATRONALES (Employer Contributions) */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Charges patronales</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colDesignation, styles.tableHeaderText]}>Désignation</Text>
              <Text style={[styles.colBase, styles.tableHeaderText]}>Base</Text>
              <Text style={[styles.colTaux, styles.tableHeaderText]}>Taux</Text>
              <Text style={[styles.colMontant, styles.tableHeaderText]}>Montant</Text>
            </View>

            {/* Employer contributions from countryConfig */}
            {data.countryConfig?.contributions && data.countryConfig.contributions.length > 0 ? (
              <>
                {data.countryConfig.contributions
                  .filter((contrib) => (contrib.employerAmount ?? 0) > 0)
                  .map((contrib) => (
                    <View key={`er-${contrib.code}`} style={styles.tableRow}>
                      <Text style={styles.colDesignation}>{contrib.name}</Text>
                      <Text style={styles.colBase}>
                        {contrib.base ? formatCurrency(contrib.base) : ''}
                      </Text>
                      <Text style={styles.colTaux}>
                        {`${(contrib.employerRate * 100).toFixed(1)}%`}
                      </Text>
                      <Text style={styles.colMontant}>
                        {formatCurrency(contrib.employerAmount || 0)}
                      </Text>
                    </View>
                  ))}
              </>
            ) : (
              <>
                {/* Fallback: CNPS Employer */}
                {data.cnpsEmployer > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>{socialSchemeName} - Prestations familiales</Text>
                    <Text style={styles.colBase}>{formatCurrency(data.grossSalary)}</Text>
                    <Text style={styles.colTaux}>{(cnpsEmployerRate * 100).toFixed(1)}%</Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.cnpsEmployer)}</Text>
                  </View>
                )}

                {/* CMU Employer */}
                {data.cmuEmployer > 0 && (
                  <View style={styles.tableRow}>
                    <Text style={styles.colDesignation}>CMU</Text>
                    <Text style={styles.colBase}></Text>
                    <Text style={styles.colTaux}>Fixe</Text>
                    <Text style={styles.colMontant}>{formatCurrency(data.cmuEmployer)}</Text>
                  </View>
                )}
              </>
            )}

            {/* Other employer taxes from countryConfig */}
            {data.countryConfig?.otherTaxes
              ?.filter((tax) => tax.paidBy === 'employer' && (tax.amount ?? 0) > 0)
              .map((tax) => (
                <View key={`er-tax-${tax.code}`} style={styles.tableRow}>
                  <Text style={styles.colDesignation}>{tax.name}</Text>
                  <Text style={styles.colBase}>{formatCurrency(data.grossSalary)}</Text>
                  <Text style={styles.colTaux}>
                    {tax.rate ? `${(tax.rate * 100).toFixed(1)}%` : 'Fixe'}
                  </Text>
                  <Text style={styles.colMontant}>{formatCurrency(tax.amount || 0)}</Text>
                </View>
              ))}

            {/* Total employer contributions */}
            <View style={[styles.tableRow, styles.tableRowGray]}>
              <Text style={styles.colDesignation}>Total charges patronales</Text>
              <Text style={styles.colBase}></Text>
              <Text style={styles.colTaux}></Text>
              <Text style={styles.colMontant}>
                {formatCurrency(data.totalEmployerContributions || (data.cnpsEmployer + data.cmuEmployer + (data.fdfp || 0)))}
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* ABSENCES ET CONGÉS (Leave/absences during this period) */}
        {/* ============================================ */}
        {data.absencesDuringPeriod && data.absencesDuringPeriod.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Absences et congés</Text>
            <View style={styles.table}>
              {/* Header */}
              <View style={styles.absencesTableHeader}>
                <Text style={[styles.absencesColType, styles.tableHeaderTextSmall]}>TYPE</Text>
                <Text style={[styles.absencesColPeriode, styles.tableHeaderTextSmall]}>PÉRIODE</Text>
                <Text style={[styles.absencesColDuree, styles.tableHeaderTextSmall]}>DURÉE</Text>
                <Text style={[styles.absencesColTraitement, styles.tableHeaderTextSmall]}>TRAITEMENT</Text>
                <Text style={[styles.absencesColImpact, styles.tableHeaderTextSmall]}>IMPACT</Text>
              </View>

              {/* Absence rows */}
              {data.absencesDuringPeriod.map((absence, index) => (
                <View key={`absence-${index}`} style={styles.absencesTableRow}>
                  <Text style={styles.absencesColType}>{absence.type}</Text>
                  <Text style={styles.absencesColPeriode}>
                    Du {format(absence.startDate, 'dd/MM/yyyy', { locale: fr })} au{' '}
                    {format(absence.endDate, 'dd/MM/yyyy', { locale: fr })}
                  </Text>
                  <Text style={styles.absencesColDuree}>
                    {absence.duration} {absence.duration === 1 ? 'jour' : 'jours'}
                  </Text>
                  <Text style={styles.absencesColTraitement}>
                    {absence.treatment === 'paid'
                      ? 'Payé (Déduit des congés)'
                      : absence.treatment === 'unpaid'
                      ? 'Non payé'
                      : 'Non traité'}
                  </Text>
                  <Text style={styles.absencesColImpact}>{absence.impact || '-'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* BOTTOM SUMMARY: Cumuls (left) + Net à payer (right) */}
        {/* ============================================ */}
        <View style={styles.summaryContainer}>
          {/* Left: YTD Cumuls */}
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryTitle}>Cumuls</Text>
            {data.ytdGross !== undefined && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Brut année</Text>
                <Text style={styles.summaryValue}>{formatCurrency(data.ytdGross)} FCFA</Text>
              </View>
            )}
            {data.ytdTaxableNet !== undefined && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net imposable année</Text>
                <Text style={styles.summaryValue}>{formatCurrency(data.ytdTaxableNet)} FCFA</Text>
              </View>
            )}
            {data.ytdNetPaid !== undefined && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Net payé année</Text>
                <Text style={styles.summaryValue}>{formatCurrency(data.ytdNetPaid)} FCFA</Text>
              </View>
            )}
            {/* If no YTD data, show placeholder */}
            {data.ytdGross === undefined && data.ytdNetPaid === undefined && (
              <Text style={styles.infoText}>Cumuls non disponibles</Text>
            )}
          </View>

          {/* Right: Net à payer */}
          <View style={styles.summaryRight}>
            <Text style={styles.summaryTitle}>Net à payer</Text>
            <Text style={styles.netAmount}>{formatCurrency(data.netSalary)} FCFA</Text>
            <Text style={styles.paymentDetail}>
              {data.paymentMethod || 'Virement bancaire'} effectué le{' '}
              {format(data.payDate, 'dd/MM/yyyy', { locale: fr })}
            </Text>
            {data.bankAccount && (
              <Text style={styles.paymentDetail}>
                IBAN: {data.bankAccount.replace(/(.{4})(.{4})(.{4})(.{4})/, '$1 **** **** $4')}
              </Text>
            )}
          </View>
        </View>

        {/* ============================================ */}
        {/* SOLDES DE CONGÉS (Leave balances) */}
        {/* ============================================ */}
        {data.leaveBalances && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soldes de congés</Text>
            <View style={styles.leaveBalancesContainer}>
              {/* Congés payés (Paid leave - 30 days/year in West Africa) */}
              {data.leaveBalances.paidLeave && (
                <View style={styles.leaveBalanceCard}>
                  <Text style={styles.leaveBalanceLabel}>Congés payés</Text>
                  <Text style={styles.leaveBalanceValue}>
                    {data.leaveBalances.paidLeave.total - data.leaveBalances.paidLeave.used} /{' '}
                    {data.leaveBalances.paidLeave.total}
                  </Text>
                  <Text style={styles.leaveBalanceSubtext}>
                    Utilisés: {data.leaveBalances.paidLeave.used}
                  </Text>
                </View>
              )}

              {/* Arrêt maladie (Sick leave - unlimited with medical certificate) */}
              {data.leaveBalances.sickLeave && (
                <View style={styles.leaveBalanceCard}>
                  <Text style={styles.leaveBalanceLabel}>Arrêt maladie</Text>
                  <Text style={styles.leaveBalanceValue}>
                    {data.leaveBalances.sickLeave.total === 'unlimited' ? 'Illimité' : data.leaveBalances.sickLeave.total}
                  </Text>
                  <Text style={styles.leaveBalanceSubtext}>
                    Utilisés: {data.leaveBalances.sickLeave.used} jour(s)
                  </Text>
                </View>
              )}

              {/* Événements familiaux (Family events) */}
              {data.leaveBalances.familyEvents && (
                <View style={styles.leaveBalanceCard}>
                  <Text style={styles.leaveBalanceLabel}>Événements familiaux</Text>
                  <Text style={styles.leaveBalanceValue}>
                    {data.leaveBalances.familyEvents.total === 'by_event' ? 'Selon événement' : data.leaveBalances.familyEvents.total}
                  </Text>
                  <Text style={styles.leaveBalanceSubtext}>
                    Utilisés: {data.leaveBalances.familyEvents.used} jour(s)
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* FOOTER */}
        {/* ============================================ */}
        <View style={styles.footer}>
          <View style={styles.footerTop}>
            <Text style={styles.footerText}>
              🔒 Document sécurisé conforme à la législation
            </Text>
            <Text style={styles.footerText}>
              Généré le {format(new Date(), 'dd/MM/yyyy', { locale: fr })}
            </Text>
          </View>
          <View style={styles.footerBranding}>
            <Text style={styles.footerBrandText}>
              Généré par <Text style={styles.footerBrandName}>Preem</Text> - Logiciel RH pour l'Afrique
            </Text>
            <Text style={styles.footerWebsite}>preemhr.com</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

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
