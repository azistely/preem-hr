/**
 * Leave Certificate PDF Template
 *
 * Official "Attestation de départ en congés annuels" template
 * Compliant with West African labor law requirements
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { LeaveCertificateData } from '@/lib/documents/leave-certificate-service';

// Register fonts (optional - uses default if not provided)
// Font.register({
//   family: 'Inter',
//   src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
// });

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.6,
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 10,
    color: '#666',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 20,
    textTransform: 'uppercase',
    textDecoration: 'underline',
  },
  certNumber: {
    fontSize: 9,
    textAlign: 'right',
    color: '#666',
    marginBottom: 20,
  },
  content: {
    marginTop: 20,
    marginBottom: 30,
  },
  paragraph: {
    marginBottom: 15,
    textAlign: 'justify',
  },
  section: {
    marginTop: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textDecoration: 'underline',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 150,
    fontWeight: 'bold',
  },
  value: {
    flex: 1,
  },
  handoverBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    border: '1 solid #ddd',
  },
  handoverTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  handoverText: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  signature: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '40%',
  },
  signatureLabel: {
    fontSize: 10,
    marginBottom: 40,
    textAlign: 'center',
  },
  signatureLine: {
    borderTop: '1 solid #000',
    marginTop: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    borderTop: '1 solid #ddd',
    paddingTop: 10,
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
  },
  highlight: {
    fontWeight: 'bold',
    color: '#000',
  },
});

interface LeaveCertificatePDFProps {
  data: LeaveCertificateData;
}

export function LeaveCertificatePDF({ data }: LeaveCertificatePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.tenant.name}</Text>
          <Text style={styles.companyDetails}>
            Adresse : {data.tenant.address}
          </Text>
          <Text style={styles.companyDetails}>
            Tél : {data.tenant.phone} | Email : {data.tenant.email}
          </Text>
        </View>

        {/* Certificate Number and Date */}
        <View style={styles.certNumber}>
          <Text>Certificat N° : {data.certificateNumber}</Text>
          <Text>Émis le : {data.issueDate}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          Attestation de départ en congés annuels
        </Text>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.paragraph}>
            Je soussigné(e), représentant(e) légal(e) de <Text style={styles.highlight}>{data.tenant.name}</Text>,
            atteste par la présente que :
          </Text>

          {/* Employee Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations sur le salarié :</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Nom et Prénom :</Text>
              <Text style={styles.value}>
                {data.employee.firstName} {data.employee.lastName}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Matricule :</Text>
              <Text style={styles.value}>{data.employee.employeeNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Poste :</Text>
              <Text style={styles.value}>{data.employee.position}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Département :</Text>
              <Text style={styles.value}>{data.employee.department}</Text>
            </View>
          </View>

          {/* Leave Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations sur le congé :</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Type de congé :</Text>
              <Text style={styles.value}>{data.leave.type}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Date de début :</Text>
              <Text style={styles.value}>{data.leave.startDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Dernier jour de congé :</Text>
              <Text style={styles.value}>{data.leave.endDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Date de reprise :</Text>
              <Text style={styles.value}>{data.leave.returnDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Durée totale :</Text>
              <Text style={styles.value}>{data.leave.totalDays} jours ouvrés</Text>
            </View>
          </View>

          <Text style={styles.paragraph}>
            Le salarié susmentionné est autorisé à prendre ses congés annuels durant la période indiquée ci-dessus.
            Cette attestation est délivrée conformément aux dispositions du Code du Travail en vigueur.
          </Text>

          {/* Handover Notes */}
          {data.handoverNotes && (
            <View style={styles.handoverBox}>
              <Text style={styles.handoverTitle}>Notes de passation :</Text>
              <Text style={styles.handoverText}>{data.handoverNotes}</Text>
            </View>
          )}

          <Text style={[styles.paragraph, { marginTop: 20 }]}>
            Cette attestation est établie pour servir et valoir ce que de droit.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.signature}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>L'Employeur</Text>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 9, textAlign: 'center', marginTop: 5 }}>
              Signature et cachet
            </Text>
          </View>

          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Le Salarié</Text>
            <View style={styles.signatureLine} />
            <Text style={{ fontSize: 9, textAlign: 'center', marginTop: 5 }}>
              Pour réception
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Document officiel - {data.tenant.name} - Généré le {data.issueDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
