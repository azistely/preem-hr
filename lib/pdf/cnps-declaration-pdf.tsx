/**
 * CNPS Monthly Contribution Declaration PDF Generator
 *
 * Generates the official "APPEL DE COTISATION MENSUEL" form
 * required by CNPS for monthly contribution declaration.
 *
 * Layout matches the official CNPS paper form with:
 * - Header with company and period information
 * - Employee categorization by salary brackets
 * - Contribution breakdown by scheme
 * - Summary totals
 */

import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import type { CNPSDeclarationData } from '@/features/payroll/services/cnps-contribution-calculator';

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
  },
  companyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontWeight: 'bold',
    width: 120,
  },
  value: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    backgroundColor: '#e0e0e0',
    padding: 5,
  },
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#333',
    color: '#fff',
    padding: 5,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ccc',
    padding: 5,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1 solid #ccc',
    padding: 5,
    backgroundColor: '#f9f9f9',
    fontSize: 9,
  },
  col1: {
    width: '50%',
  },
  col2: {
    width: '15%',
    textAlign: 'right',
  },
  col3: {
    width: '20%',
    textAlign: 'right',
  },
  col4: {
    width: '15%',
    textAlign: 'right',
  },
  summarySection: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    border: '2 solid #333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTop: '2 solid #000',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTop: '1 solid #999',
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
});

// ========================================
// Helper Functions
// ========================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

function formatMonth(month: number, year: number): string {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return `${monthNames[month - 1]} ${year}`;
}

// ========================================
// PDF Document Component
// ========================================

interface CNPSDeclarationPDFProps {
  data: CNPSDeclarationData;
}

const CNPSDeclarationPDF: React.FC<CNPSDeclarationPDFProps> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CAISSE NATIONALE DE PRÉVOYANCE SOCIALE</Text>
          <Text style={styles.subtitle}>APPEL DE COTISATION MENSUEL</Text>
        </View>

        {/* Company Information */}
        <View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Raison sociale:</Text>
            <Text style={styles.value}>{data.companyName}</Text>
          </View>
          {data.companyCNPS && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>N° Employeur:</Text>
              <Text style={styles.value}>{data.companyCNPS}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.label}>Période:</Text>
            <Text style={styles.value}>{formatMonth(data.month, data.year)}</Text>
          </View>
          {data.companyAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Adresse:</Text>
              <Text style={styles.value}>{data.companyAddress}</Text>
            </View>
          )}
        </View>

        {/* Total Employees */}
        <Text style={styles.sectionTitle}>
          TOTAL SALAIRES BRUTS PAYÉS AU COURS DE LA PÉRIODE: {formatCurrency(data.totalGrossSalary)}
        </Text>

        {/* Employee Categorization Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>CATÉGORIE DE SALARIÉS</Text>
            <Text style={styles.col2}>NOMBRE</Text>
            <Text style={styles.col3}>SALAIRE BRUT</Text>
            <Text style={styles.col4}>BASE COTIS.</Text>
          </View>

          {/* Daily/Hourly Workers */}
          <View style={styles.tableRow}>
            <Text style={styles.col1}>{data.dailyWorkers.category1.category}</Text>
            <Text style={styles.col2}>{data.dailyWorkers.category1.employeeCount}</Text>
            <Text style={styles.col3}>{formatCurrency(data.dailyWorkers.category1.totalGross)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.dailyWorkers.category1.contributionBase)}</Text>
          </View>
          <View style={styles.tableRowAlt}>
            <Text style={styles.col1}>{data.dailyWorkers.category2.category}</Text>
            <Text style={styles.col2}>{data.dailyWorkers.category2.employeeCount}</Text>
            <Text style={styles.col3}>{formatCurrency(data.dailyWorkers.category2.totalGross)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.dailyWorkers.category2.contributionBase)}</Text>
          </View>

          {/* Monthly Workers */}
          <View style={styles.tableRow}>
            <Text style={styles.col1}>{data.monthlyWorkers.category1.category}</Text>
            <Text style={styles.col2}>{data.monthlyWorkers.category1.employeeCount}</Text>
            <Text style={styles.col3}>{formatCurrency(data.monthlyWorkers.category1.totalGross)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.monthlyWorkers.category1.contributionBase)}</Text>
          </View>
          <View style={styles.tableRowAlt}>
            <Text style={styles.col1}>{data.monthlyWorkers.category2.category}</Text>
            <Text style={styles.col2}>{data.monthlyWorkers.category2.employeeCount}</Text>
            <Text style={styles.col3}>{formatCurrency(data.monthlyWorkers.category2.totalGross)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.monthlyWorkers.category2.contributionBase)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.col1}>{data.monthlyWorkers.category3.category}</Text>
            <Text style={styles.col2}>{data.monthlyWorkers.category3.employeeCount}</Text>
            <Text style={styles.col3}>{formatCurrency(data.monthlyWorkers.category3.totalGross)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.monthlyWorkers.category3.contributionBase)}</Text>
          </View>

          {/* Total Row */}
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>TOTAL</Text>
            <Text style={styles.col2}>{data.totalEmployeeCount}</Text>
            <Text style={styles.col3}>{formatCurrency(data.totalGrossSalary)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.totalContributionBase)}</Text>
          </View>
        </View>

        {/* Contribution Breakdown */}
        <Text style={styles.sectionTitle}>DÉCOMPTE DES COTISATIONS DUES</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>RÉGIME</Text>
            <Text style={styles.col2}>TAUX</Text>
            <Text style={styles.col3}>EMPLOYEUR</Text>
            <Text style={styles.col4}>SALARIÉ</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.col1}>{data.contributions.retirement.name}</Text>
            <Text style={styles.col2}>{data.contributions.retirement.rate.toFixed(2)}%</Text>
            <Text style={styles.col3}>{formatCurrency(data.contributions.retirement.employerAmount)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.contributions.retirement.employeeAmount)}</Text>
          </View>

          <View style={styles.tableRowAlt}>
            <Text style={styles.col1}>{data.contributions.maternity.name}</Text>
            <Text style={styles.col2}>{data.contributions.maternity.rate.toFixed(2)}%</Text>
            <Text style={styles.col3}>{formatCurrency(data.contributions.maternity.employerAmount)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.contributions.maternity.employeeAmount)}</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.col1}>{data.contributions.familyBenefits.name}</Text>
            <Text style={styles.col2}>{data.contributions.familyBenefits.rate.toFixed(2)}%</Text>
            <Text style={styles.col3}>{formatCurrency(data.contributions.familyBenefits.employerAmount)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.contributions.familyBenefits.employeeAmount)}</Text>
          </View>

          <View style={styles.tableRowAlt}>
            <Text style={styles.col1}>{data.contributions.workAccidents.name}</Text>
            <Text style={styles.col2}>{data.contributions.workAccidents.rate.toFixed(2)}%</Text>
            <Text style={styles.col3}>{formatCurrency(data.contributions.workAccidents.employerAmount)}</Text>
            <Text style={styles.col4}>{formatCurrency(data.contributions.workAccidents.employeeAmount)}</Text>
          </View>

          {data.contributions.cmu && (
            <View style={styles.tableRow}>
              <Text style={styles.col1}>{data.contributions.cmu.name}</Text>
              <Text style={styles.col2}>{data.contributions.cmu.rate.toFixed(2)}%</Text>
              <Text style={styles.col3}>{formatCurrency(data.contributions.cmu.employerAmount)}</Text>
              <Text style={styles.col4}>{formatCurrency(data.contributions.cmu.employeeAmount)}</Text>
            </View>
          )}
        </View>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Cotisations Employeur:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totalEmployerContributions)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Cotisations Salarié:</Text>
            <Text style={styles.summaryValue}>{formatCurrency(data.totalEmployeeContributions)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL COTISATIONS À PAYER:</Text>
            <Text style={styles.totalValue}>{formatCurrency(data.totalContributions)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Bordereau certifié exact. À {data.companyAddress || '____________'}, le {new Date(data.generatedAt).toLocaleDateString('fr-FR')}
          </Text>
          <Text style={{ marginTop: 10 }}>Signature et cachet</Text>
        </View>
      </Page>
    </Document>
  );
};

// ========================================
// Export Function
// ========================================

/**
 * Generate CNPS Declaration PDF as Buffer
 *
 * @param data - Complete CNPS declaration data
 * @returns PDF as Buffer
 */
export async function generateCNPSDeclarationPDF(
  data: CNPSDeclarationData
): Promise<Buffer> {
  const doc = <CNPSDeclarationPDF data={data} />;
  return await renderToBuffer(doc);
}

/**
 * Generate filename for CNPS declaration
 */
export function generateCNPSDeclarationFilename(month: number, year: number): string {
  const monthStr = String(month).padStart(2, '0');
  return `declaration-cnps-${year}-${monthStr}.pdf`;
}
