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
    fontSize: 8,
    color: '#9ca3af',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
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
          <Text style={styles.sectionTitle}>Informations salarié</Text>
          <View style={styles.employeeInfoGrid}>
            <View style={styles.employeeInfoColumn}>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>Nom: {data.employeeName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoText}>Matricule: {data.employeeNumber}</Text>
              </View>
              {data.employeePosition && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Emploi: {data.employeePosition}</Text>
                </View>
              )}
              {data.employeeDepartment && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>Département: {data.employeeDepartment}</Text>
                </View>
              )}
            </View>
            <View style={styles.employeeInfoColumn}>
              {data.employeeCNPS && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>N° {socialSchemeName}: {data.employeeCNPS}</Text>
                </View>
              )}
              {data.employeeHireDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>
                    Date d'entrée: {format(data.employeeHireDate, 'dd/MM/yyyy', { locale: fr })}
                  </Text>
                </View>
              )}
              {data.daysWorked !== undefined && data.daysInPeriod !== undefined && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>
                    Jours travaillés: {data.daysWorked} / {data.daysInPeriod}
                  </Text>
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
        {/* COTISATIONS SOCIALES TABLE (6 columns) */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cotisations sociales</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.contribTableHeader}>
              <Text style={[styles.contribColDesignation, styles.tableHeaderTextSmall]}>Désignation</Text>
              <Text style={[styles.contribColBase, styles.tableHeaderTextSmall]}>Base</Text>
              <Text style={[styles.contribColTauxSal, styles.tableHeaderTextSmall]}>Taux sal.</Text>
              <Text style={[styles.contribColMontantSal, styles.tableHeaderTextSmall]}>Mont. sal.</Text>
              <Text style={[styles.contribColTauxPat, styles.tableHeaderTextSmall]}>Taux patr.</Text>
              <Text style={[styles.contribColMontantPat, styles.tableHeaderTextSmall]}>Mont. patr.</Text>
            </View>

            {/* CNPS / Social Security */}
            {data.countryConfig?.contributions && data.countryConfig.contributions.length > 0 ? (
              <>
                {/* Render from countryConfig */}
                {data.countryConfig.contributions.map((contrib) => {
                  const hasEmployee = (contrib.employeeAmount ?? 0) > 0;
                  const hasEmployer = (contrib.employerAmount ?? 0) > 0;
                  if (!hasEmployee && !hasEmployer) return null;

                  return (
                    <View key={contrib.code} style={styles.contribTableRow}>
                      <Text style={styles.contribColDesignation}>{contrib.name}</Text>
                      <Text style={styles.contribColBase}>
                        {contrib.base ? formatCurrency(contrib.base) : ''}
                      </Text>
                      <Text style={styles.contribColTauxSal}>
                        {hasEmployee ? `${(contrib.employeeRate * 100).toFixed(1)}%` : ''}
                      </Text>
                      <Text style={styles.contribColMontantSal}>
                        {hasEmployee ? formatCurrency(contrib.employeeAmount || 0) : ''}
                      </Text>
                      <Text style={styles.contribColTauxPat}>
                        {hasEmployer ? `${(contrib.employerRate * 100).toFixed(1)}%` : ''}
                      </Text>
                      <Text style={styles.contribColMontantPat}>
                        {hasEmployer ? formatCurrency(contrib.employerAmount || 0) : ''}
                      </Text>
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                {/* Fallback: CNPS row */}
                <View style={styles.contribTableRow}>
                  <Text style={styles.contribColDesignation}>{socialSchemeName} - Prestations familiales</Text>
                  <Text style={styles.contribColBase}>{formatCurrency(data.grossSalary)}</Text>
                  <Text style={styles.contribColTauxSal}>{(cnpsEmployeeRate * 100).toFixed(1)}%</Text>
                  <Text style={styles.contribColMontantSal}>{formatCurrency(data.cnpsEmployee)}</Text>
                  <Text style={styles.contribColTauxPat}>{(cnpsEmployerRate * 100).toFixed(1)}%</Text>
                  <Text style={styles.contribColMontantPat}>{formatCurrency(data.cnpsEmployer)}</Text>
                </View>

                {/* CMU row */}
                {(data.cmuEmployee > 0 || data.cmuEmployer > 0) && (
                  <View style={styles.contribTableRow}>
                    <Text style={styles.contribColDesignation}>CMU</Text>
                    <Text style={styles.contribColBase}></Text>
                    <Text style={styles.contribColTauxSal}>Fixe</Text>
                    <Text style={styles.contribColMontantSal}>{formatCurrency(data.cmuEmployee)}</Text>
                    <Text style={styles.contribColTauxPat}>
                      {data.cmuEmployer > 0 ? 'Fixe' : ''}
                    </Text>
                    <Text style={styles.contribColMontantPat}>
                      {data.cmuEmployer > 0 ? formatCurrency(data.cmuEmployer) : ''}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* ITS / Tax row */}
            <View style={styles.contribTableRow}>
              <Text style={styles.contribColDesignation}>{taxSystemName}</Text>
              <Text style={styles.contribColBase}>
                {data.brutImposable ? formatCurrency(data.brutImposable) : formatCurrency(data.grossSalary)}
              </Text>
              <Text style={styles.contribColTauxSal}>Progr.</Text>
              <Text style={styles.contribColMontantSal}>{formatCurrency(data.its)}</Text>
              <Text style={styles.contribColTauxPat}></Text>
              <Text style={styles.contribColMontantPat}></Text>
            </View>

            {/* Other employer taxes from countryConfig */}
            {data.countryConfig?.otherTaxes
              ?.filter((tax) => tax.paidBy === 'employer' && (tax.amount ?? 0) > 0)
              .map((tax) => (
                <View key={tax.code} style={styles.contribTableRow}>
                  <Text style={styles.contribColDesignation}>{tax.name}</Text>
                  <Text style={styles.contribColBase}>{formatCurrency(data.grossSalary)}</Text>
                  <Text style={styles.contribColTauxSal}></Text>
                  <Text style={styles.contribColMontantSal}></Text>
                  <Text style={styles.contribColTauxPat}>
                    {tax.rate ? `${(tax.rate * 100).toFixed(1)}%` : ''}
                  </Text>
                  <Text style={styles.contribColMontantPat}>{formatCurrency(tax.amount || 0)}</Text>
                </View>
              ))}

            {/* Additional deductions details */}
            {data.deductionsDetails?.map((detail, index) => (
              <View key={`deduction-${index}`} style={styles.contribTableRow}>
                <Text style={styles.contribColDesignation}>{detail.description}</Text>
                <Text style={styles.contribColBase}></Text>
                <Text style={styles.contribColTauxSal}></Text>
                <Text style={styles.contribColMontantSal}>{formatCurrency(detail.amount)}</Text>
                <Text style={styles.contribColTauxPat}></Text>
                <Text style={styles.contribColMontantPat}></Text>
              </View>
            ))}

            {/* Total row */}
            <View style={[styles.contribTableRow, styles.tableRowGray]}>
              <Text style={styles.contribColDesignation}>Total des cotisations</Text>
              <Text style={styles.contribColBase}></Text>
              <Text style={styles.contribColTauxSal}></Text>
              <Text style={styles.contribColMontantSal}>{formatCurrency(data.totalDeductions)}</Text>
              <Text style={styles.contribColTauxPat}></Text>
              <Text style={styles.contribColMontantPat}>
                {formatCurrency(data.totalEmployerContributions || (data.cnpsEmployer + data.cmuEmployer + (data.fdfp || 0)))}
              </Text>
            </View>
          </View>
        </View>

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
        {/* FOOTER */}
        {/* ============================================ */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🔒 Document sécurisé conforme à la législation
          </Text>
          <Text style={styles.footerText}>
            Généré le {format(new Date(), 'dd/MM/yyyy', { locale: fr })}
          </Text>
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
