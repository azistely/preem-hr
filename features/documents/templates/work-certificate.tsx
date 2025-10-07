/**
 * Work Certificate (Certificat de Travail) PDF Template
 *
 * Convention Collective Article 40 - Must be issued within 48 hours of termination
 *
 * Required content:
 * - Employee identity (full name, date of birth)
 * - Employment period (hire date → termination date)
 * - Positions held during employment
 * - Categories/coefficients progression
 * - Reason for leaving
 * - "Free of all obligations" clause
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
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
  positionsList: {
    marginLeft: 20,
    marginTop: 5,
  },
  positionItem: {
    marginBottom: 3,
    fontSize: 10,
  },
});

interface WorkCertificateData {
  // Company info
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;

  // Employee info
  employeeFirstName: string;
  employeeLastName: string;
  employeeDateOfBirth: string;

  // Employment details
  hireDate: string;
  terminationDate: string;
  terminationReason: string;

  // Positions held
  positions: Array<{
    title: string;
    category: string;
    coefficient: number;
    startDate: string;
    endDate: string | null;
  }>;

  // Document metadata
  issueDate: string;
  issuedBy: string;
}

export function WorkCertificatePDF({ data }: { data: WorkCertificateData }) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: fr });
  };

  const getTerminationReasonText = (reason: string) => {
    const reasons: Record<string, string> = {
      dismissal: 'licenciement',
      resignation: 'démission',
      retirement: 'départ à la retraite',
      misconduct: 'licenciement pour faute',
      contract_end: 'fin de contrat',
      death: 'décès',
      other: 'autre motif',
    };
    return reasons[reason] || reason;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyInfo}>{data.companyAddress}</Text>
          <Text style={styles.companyInfo}>{data.companyCity}, {data.companyCountry}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>CERTIFICAT DE TRAVAIL</Text>

        {/* Body */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Je soussigné(e), représentant(e) légal(e) de la société <Text style={styles.bold}>{data.companyName}</Text>,
            certifie par la présente que :
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>
              {data.employeeFirstName} {data.employeeLastName}
            </Text>
            {data.employeeDateOfBirth && `, né(e) le ${formatDate(data.employeeDateOfBirth)},`} a été employé(e)
            au sein de notre entreprise du <Text style={styles.bold}>{formatDate(data.hireDate)}</Text> au{' '}
            <Text style={styles.bold}>{formatDate(data.terminationDate)}</Text>.
          </Text>
        </View>

        {/* Positions held */}
        {data.positions && data.positions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.paragraph}>
              Au cours de son emploi, l'intéressé(e) a occupé les fonctions suivantes :
            </Text>
            <View style={styles.positionsList}>
              {data.positions.map((position, index) => (
                <Text key={index} style={styles.positionItem}>
                  • <Text style={styles.bold}>{position.title}</Text> - Catégorie {position.category}, Coefficient {position.coefficient}
                  {position.endDate && ` (${formatDate(position.startDate)} au ${formatDate(position.endDate)})`}
                  {!position.endDate && ` (depuis le ${formatDate(position.startDate)})`}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Termination reason */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Le contrat de travail a pris fin en raison d'un(e) <Text style={styles.bold}>{getTerminationReasonText(data.terminationReason)}</Text>.
          </Text>
        </View>

        {/* Free of obligations clause */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            L'intéressé(e) quitte notre entreprise <Text style={styles.bold}>libre de tout engagement</Text> envers celle-ci.
            Tous les salaires, indemnités et avantages dus ont été intégralement réglés.
          </Text>
        </View>

        {/* Purpose clause */}
        <View style={styles.section}>
          <Text style={styles.paragraph}>
            Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.
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
          Document généré le {formatDate(data.issueDate)} • {data.companyName}
        </Text>
      </Page>
    </Document>
  );
}
