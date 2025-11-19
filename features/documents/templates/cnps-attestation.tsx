/**
 * CNPS Attestation PDF Template
 *
 * Convention Collective Article 40 - Must be issued within 15 days of termination
 *
 * Required content:
 * - Total CNPS contributions paid (employee + employer portions)
 * - Periods covered (monthly breakdown)
 * - Employee identification
 * - For employee to claim unemployment/retirement benefits
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  companyInfo: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 30,
    textDecoration: 'underline',
  },
  section: {
    marginBottom: 15,
  },
  paragraph: {
    marginBottom: 8,
    lineHeight: 1.5,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: 'bold',
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e0e0e0',
    padding: 8,
    fontSize: 10,
  },
  tableCol: {
    flex: 1,
  },
  tableColWide: {
    flex: 2,
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 5,
  },
  signature: {
    marginTop: 50,
    alignItems: 'flex-end',
  },
  signatureBlock: {
    width: 200,
  },
  signatureLine: {
    borderTop: '1 solid black',
    marginTop: 40,
    paddingTop: 5,
    fontSize: 10,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    borderTop: '1 solid #ddd',
    paddingTop: 10,
  },
  highlight: {
    backgroundColor: '#fffacd',
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
    fontSize: 10,
  },
});

interface CNPSContribution {
  period: string; // YYYY-MM format
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  baseSalary: number;
}

interface CNPSAttestationData {
  // Company info
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyCNPSNumber: string; // Company CNPS registration number

  // Employee info
  employeeFirstName: string;
  employeeLastName: string;
  employeeCNPSNumber: string; // Employee CNPS number
  employeeMatricule: string; // Employee ID/matricule

  // Employment details
  hireDate: string;
  terminationDate: string;

  // Contributions breakdown
  contributions: CNPSContribution[];
  totalEmployeeContribution: number;
  totalEmployerContribution: number;
  grandTotal: number;

  // Document metadata
  issueDate: string;
  issuedBy: string;
}

export function CNPSAttestationPDF({ data }: { data: CNPSAttestationData }) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: fr });
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return format(date, 'MMMM yyyy', { locale: fr });
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
          <Text style={styles.companyInfo}>{data.companyCity}, {data.companyCountry}</Text>
          <Text style={styles.companyInfo}>N° CNPS: {data.companyCNPSNumber}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>ATTESTATION DE COTISATIONS CNPS</Text>

        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Je soussigné(e), représentant(e) légal(e) de la société <Text style={styles.bold}>{data.companyName}</Text>,
            certifie par la présente que :
          </Text>
        </View>

        {/* Employee Info */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>
              {data.employeeFirstName} {data.employeeLastName}
            </Text>
          </Text>
          <Text style={styles.paragraph}>
            • Matricule: {data.employeeMatricule}
          </Text>
          <Text style={styles.paragraph}>
            • N° CNPS: {data.employeeCNPSNumber || 'Non renseigné'}
          </Text>
          <Text style={styles.paragraph}>
            • Période d'emploi: du {formatDate(data.hireDate)} au {formatDate(data.terminationDate)}
          </Text>
        </View>

        {/* Purpose */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Les cotisations sociales suivantes ont été versées à la Caisse Nationale de Prévoyance Sociale (CNPS)
            pour le compte de l'intéressé(e) :
          </Text>
        </View>

        {/* Contributions Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableColWide}>Période</Text>
            <Text style={styles.tableCol}>Salaire de base</Text>
            <Text style={styles.tableCol}>Part salarié</Text>
            <Text style={styles.tableCol}>Part employeur</Text>
            <Text style={styles.tableCol}>Total</Text>
          </View>

          {data.contributions.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableColWide, fontStyle: 'italic', color: '#666' }}>
                Aucune cotisation enregistrée (employé terminé avant versement de salaire)
              </Text>
              <Text style={styles.tableCol}></Text>
              <Text style={styles.tableCol}></Text>
              <Text style={styles.tableCol}></Text>
              <Text style={styles.tableCol}></Text>
            </View>
          ) : (
            data.contributions.map((contrib, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.tableColWide}>{formatPeriod(contrib.period)}</Text>
                <Text style={styles.tableCol}>{formatCurrency(contrib.baseSalary)} FCFA</Text>
                <Text style={styles.tableCol}>{formatCurrency(contrib.employeeContribution)} FCFA</Text>
                <Text style={styles.tableCol}>{formatCurrency(contrib.employerContribution)} FCFA</Text>
                <Text style={styles.tableCol}>{formatCurrency(contrib.totalContribution)} FCFA</Text>
              </View>
            ))
          )}

          <View style={styles.totalRow}>
            <Text style={styles.tableColWide}>TOTAL</Text>
            <Text style={styles.tableCol}></Text>
            <Text style={styles.tableCol}>{formatCurrency(data.totalEmployeeContribution)} FCFA</Text>
            <Text style={styles.tableCol}>{formatCurrency(data.totalEmployerContribution)} FCFA</Text>
            <Text style={styles.tableCol}>{formatCurrency(data.grandTotal)} FCFA</Text>
          </View>
        </View>

        {/* Summary */}
        <View style={styles.highlight}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Récapitulatif des cotisations:</Text>
          <Text>• Part salariale totale: {formatCurrency(data.totalEmployeeContribution)} FCFA</Text>
          <Text>• Part patronale totale: {formatCurrency(data.totalEmployerContribution)} FCFA</Text>
          <Text>• Total des cotisations versées: {formatCurrency(data.grandTotal)} FCFA</Text>
        </View>

        {/* Purpose clause */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Cette attestation est délivrée à l'intéressé(e) pour faire valoir ses droits auprès de la CNPS,
            notamment pour les prestations de retraite, d'invalidité ou de chômage.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Le présent document certifie que toutes les cotisations sociales ont été régulièrement versées
            à la CNPS durant la période d'emploi susmentionnée.
          </Text>
        </View>

        {/* Signature */}
        <View style={styles.signature}>
          <View style={styles.signatureBlock}>
            <Text style={{ marginBottom: 5 }}>
              Fait à {data.companyCity}, le {formatDate(data.issueDate)}
            </Text>
            <View style={styles.signatureLine}>
              <Text>{data.issuedBy}</Text>
              <Text style={{ fontSize: 9, color: '#666' }}>Représentant légal</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Document généré le {formatDate(data.issueDate)} • {data.companyName} • N° CNPS: {data.companyCNPSNumber}
        </Text>
      </Page>
    </Document>
  );
}
