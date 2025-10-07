/**
 * Final Payslip PDF Template
 *
 * Professional payslip for terminated employees including:
 * - Regular prorated salary for final month
 * - Terminal payments (severance, vacation payout, notice)
 * - Tax-free vs taxable breakdown for severance
 * - Full deductions breakdown (CNPS, CMU, ITS)
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  companyInfo: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  employeeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1 solid #ddd',
  },
  table: {
    marginBottom: 15,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableRowHighlight: {
    flexDirection: 'row',
    backgroundColor: '#fffacd',
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontWeight: 'bold',
  },
  tableCellLeft: {
    flex: 2,
    fontSize: 9,
  },
  tableCellRight: {
    flex: 1,
    textAlign: 'right',
    fontSize: 9,
  },
  tableCellBold: {
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 5,
    fontWeight: 'bold',
  },
  netPayBox: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: 15,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 4,
    textAlign: 'center',
  },
  netPayLabel: {
    fontSize: 11,
    marginBottom: 5,
  },
  netPayAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    borderTop: '1 solid #ddd',
    paddingTop: 10,
  },
  note: {
    fontSize: 8,
    color: '#666',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
});

interface PayslipEarning {
  type: string;
  description: string;
  amount: number;
}

interface PayslipDeduction {
  type: string;
  description: string;
  amount: number;
}

interface FinalPayslipData {
  // Company info
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyCNPSNumber?: string;

  // Employee info
  employeeFirstName: string;
  employeeLastName: string;
  employeeNumber: string;
  employeeCNPSNumber?: string;
  positionTitle: string;

  // Pay period
  periodStart: string;
  periodEnd: string;
  payDate: string;
  daysWorked: number;
  daysInPeriod: number;

  // Earnings
  baseSalary: number;
  proratedBaseSalary: number;
  allowances: number;
  overtimePay: number;
  bonuses: number;
  earningsDetails: PayslipEarning[];

  // Terminal payments
  severancePayTaxFree: number;
  severancePayTaxable: number;
  vacationPayout: number;
  noticePeriodPayment: number;

  // Deductions
  cnpsEmployee: number;
  cmuEmployee: number;
  its: number;
  deductionsDetails: PayslipDeduction[];

  // Totals
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;

  // Employer contributions
  cnpsEmployer: number;
  cmuEmployer: number;
  totalEmployerCost: number;

  // Document metadata
  issueDate: string;
  isFinalPayslip: boolean;
}

export function FinalPayslipPDF({ data }: { data: FinalPayslipData }) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  const formatDateLong = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: fr });
  };

  const formatCurrency = (amount: number) => {
    // Format with fr-FR locale, then replace narrow no-break space (U+202F) with regular space
    // @react-pdf/renderer doesn't render U+202F correctly, showing it as a slash
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return formatted.replace(/\u202F/g, ' ');
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyInfo}>{data.companyAddress}</Text>
          <Text style={styles.companyInfo}>
            {data.companyCity}, {data.companyCountry}
          </Text>
          {data.companyCNPSNumber && (
            <Text style={styles.companyInfo}>N° CNPS: {data.companyCNPSNumber}</Text>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {data.isFinalPayslip ? 'BULLETIN DE PAIE FINAL' : 'BULLETIN DE PAIE'}
        </Text>
        <Text style={styles.subtitle}>
          Période du {formatDate(data.periodStart)} au {formatDate(data.periodEnd)}
        </Text>

        {/* Employee Info */}
        <View style={styles.employeeInfo}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Nom complet</Text>
            <Text style={styles.infoValue}>
              {data.employeeFirstName} {data.employeeLastName}
            </Text>

            <Text style={styles.infoLabel}>Poste</Text>
            <Text style={styles.infoValue}>{data.positionTitle}</Text>
          </View>

          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Matricule</Text>
            <Text style={styles.infoValue}>{data.employeeNumber}</Text>

            {data.employeeCNPSNumber && (
              <>
                <Text style={styles.infoLabel}>N° CNPS</Text>
                <Text style={styles.infoValue}>{data.employeeCNPSNumber}</Text>
              </>
            )}
          </View>

          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Jours travaillés</Text>
            <Text style={styles.infoValue}>
              {data.daysWorked} / {data.daysInPeriod}
            </Text>

            <Text style={styles.infoLabel}>Date de paiement</Text>
            <Text style={styles.infoValue}>{formatDate(data.payDate)}</Text>
          </View>
        </View>

        {/* Earnings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RÉMUNÉRATION BRUTE</Text>
          <View style={styles.table}>
            {/* Base salary */}
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLeft}>Salaire de base</Text>
              <Text style={styles.tableCellRight}>{formatCurrency(data.baseSalary)} FCFA</Text>
            </View>

            {data.proratedBaseSalary !== data.baseSalary && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>
                  Salaire proratisé ({data.daysWorked}/{data.daysInPeriod} jours)
                </Text>
                <Text style={styles.tableCellRight}>
                  {formatCurrency(data.proratedBaseSalary)} FCFA
                </Text>
              </View>
            )}

            {/* Allowances */}
            {data.allowances > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>Indemnités et primes</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(data.allowances)} FCFA</Text>
              </View>
            )}

            {/* Overtime */}
            {data.overtimePay > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>Heures supplémentaires</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(data.overtimePay)} FCFA</Text>
              </View>
            )}

            {/* Bonuses */}
            {data.bonuses > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>Primes exceptionnelles</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(data.bonuses)} FCFA</Text>
              </View>
            )}

            {/* Terminal payments (if final payslip) */}
            {data.isFinalPayslip && (
              <>
                {data.severancePayTaxFree > 0 && (
                  <View style={styles.tableRowHighlight}>
                    <Text style={[styles.tableCellLeft, styles.tableCellBold]}>
                      Indemnité de licenciement (exonérée)
                    </Text>
                    <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                      {formatCurrency(data.severancePayTaxFree)} FCFA
                    </Text>
                  </View>
                )}

                {data.severancePayTaxable > 0 && (
                  <View style={styles.tableRowHighlight}>
                    <Text style={[styles.tableCellLeft, styles.tableCellBold]}>
                      Indemnité de licenciement (imposable)
                    </Text>
                    <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                      {formatCurrency(data.severancePayTaxable)} FCFA
                    </Text>
                  </View>
                )}

                {data.vacationPayout > 0 && (
                  <View style={styles.tableRowHighlight}>
                    <Text style={[styles.tableCellLeft, styles.tableCellBold]}>
                      Solde de congés payés
                    </Text>
                    <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                      {formatCurrency(data.vacationPayout)} FCFA
                    </Text>
                  </View>
                )}

                {data.noticePeriodPayment > 0 && (
                  <View style={styles.tableRowHighlight}>
                    <Text style={[styles.tableCellLeft, styles.tableCellBold]}>
                      Indemnité de préavis
                    </Text>
                    <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                      {formatCurrency(data.noticePeriodPayment)} FCFA
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Total gross */}
            <View style={styles.totalRow}>
              <Text style={[styles.tableCellLeft, styles.tableCellBold]}>TOTAL BRUT</Text>
              <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                {formatCurrency(data.grossSalary)} FCFA
              </Text>
            </View>
          </View>
        </View>

        {/* Deductions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RETENUES ET COTISATIONS</Text>
          <View style={styles.table}>
            {/* CNPS Employee */}
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLeft}>CNPS Retraite (part salariale - 3.2%)</Text>
              <Text style={styles.tableCellRight}>{formatCurrency(data.cnpsEmployee)} FCFA</Text>
            </View>

            {/* CMU Employee */}
            {data.cmuEmployee > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>CMU (part salariale - 1%)</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(data.cmuEmployee)} FCFA</Text>
              </View>
            )}

            {/* ITS */}
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLeft}>ITS (Impôt sur Traitement et Salaires)</Text>
              <Text style={styles.tableCellRight}>{formatCurrency(data.its)} FCFA</Text>
            </View>

            {/* Total deductions */}
            <View style={styles.totalRow}>
              <Text style={[styles.tableCellLeft, styles.tableCellBold]}>TOTAL RETENUES</Text>
              <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                {formatCurrency(data.totalDeductions)} FCFA
              </Text>
            </View>
          </View>
        </View>

        {/* Net Pay */}
        <View style={styles.netPayBox}>
          <Text style={styles.netPayLabel}>NET À PAYER</Text>
          <Text style={styles.netPayAmount}>{formatCurrency(data.netSalary)} FCFA</Text>
        </View>

        {/* Employer Contributions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CHARGES PATRONALES (Information)</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLeft}>CNPS (part patronale)</Text>
              <Text style={styles.tableCellRight}>{formatCurrency(data.cnpsEmployer)} FCFA</Text>
            </View>

            {data.cmuEmployer > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellLeft}>CMU (part patronale)</Text>
                <Text style={styles.tableCellRight}>{formatCurrency(data.cmuEmployer)} FCFA</Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={[styles.tableCellLeft, styles.tableCellBold]}>
                COÛT TOTAL EMPLOYEUR
              </Text>
              <Text style={[styles.tableCellRight, styles.tableCellBold]}>
                {formatCurrency(data.totalEmployerCost)} FCFA
              </Text>
            </View>
          </View>
        </View>

        {/* Final payslip note */}
        {data.isFinalPayslip && (
          <View style={styles.note}>
            <Text>
              Ce bulletin de paie final inclut les indemnités de fin de contrat conformément à la
              Convention Collective Interprofessionnelle de Côte d'Ivoire.
            </Text>
            <Text style={{ marginTop: 5 }}>
              Les indemnités de licenciement jusqu'au montant légal minimum sont exonérées
              d'impôts. Tout excédent est soumis à l'ITS.
            </Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Document généré le {formatDateLong(data.issueDate)} • {data.companyName}
          {data.companyCNPSNumber && ` • N° CNPS: ${data.companyCNPSNumber}`}
        </Text>
      </Page>
    </Document>
  );
}
