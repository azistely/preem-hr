/**
 * CDI Contract (Contrat à Durée Indéterminée) PDF Template
 *
 * Permanent employment contract template for French-speaking West Africa
 * Compliant with labor laws of: Côte d'Ivoire, Senegal, Burkina Faso, Mali
 *
 * Required legal clauses:
 * - Employee and employer identification
 * - Position and job description
 * - Remuneration and benefits
 * - Working hours and location
 * - Probation period
 * - Notice period for termination
 * - Applicable collective agreement
 */

import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  articleTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    textDecoration: 'underline',
  },
  paragraph: {
    marginBottom: 8,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: 'bold',
  },
  signatures: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 10,
    marginBottom: 3,
  },
  signatureLine: {
    borderTop: '1 solid black',
    marginTop: 40,
    paddingTop: 5,
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
    borderTop: '1 solid #ddd',
    paddingTop: 8,
  },
  parties: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 3,
  },
  partyTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  partyInfo: {
    fontSize: 10,
    marginLeft: 10,
    marginBottom: 2,
  },
});

interface CDIContractData {
  // Contract metadata
  contractNumber: string;
  contractDate: string;

  // Employer (Company)
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyRegistrationNumber?: string;
  companyRepresentative: string;
  companyRepresentativeTitle: string;

  // Employee
  employeeFirstName: string;
  employeeLastName: string;
  employeeAddress: string;
  employeeCity: string;
  employeeDateOfBirth: string;
  employeeNationalId?: string;

  // Position details
  positionTitle: string;
  positionDescription: string;
  department?: string;
  workLocation: string;

  // Remuneration
  baseSalary: number;
  salaryPeriod: 'mensuel' | 'horaire';
  currency: string;
  benefits?: string[];

  // Working conditions
  weeklyHours: number;
  workSchedule: string;
  probationPeriod: number; // in months
  noticePeriod: number; // in days

  // Contract start
  startDate: string;

  // Optional clauses
  collectiveAgreement?: string;
  additionalClauses?: string[];
}

export function CDIContractPDF({ data }: { data: CDIContractData }) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: fr });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CONTRAT DE TRAVAIL</Text>
          <Text style={styles.title}>À DURÉE INDÉTERMINÉE (CDI)</Text>
          <Text style={styles.subtitle}>N° {data.contractNumber}</Text>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={{ marginBottom: 10 }}>
            <Text style={styles.partyTitle}>ENTRE LES SOUSSIGNÉS :</Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={styles.partyTitle}>L'EMPLOYEUR :</Text>
            <Text style={styles.partyInfo}>{data.companyName}</Text>
            <Text style={styles.partyInfo}>{data.companyAddress}, {data.companyCity}</Text>
            <Text style={styles.partyInfo}>{data.companyCountry}</Text>
            {data.companyRegistrationNumber && (
              <Text style={styles.partyInfo}>
                N° d'immatriculation : {data.companyRegistrationNumber}
              </Text>
            )}
            <Text style={styles.partyInfo}>
              Représentée par {data.companyRepresentative}, {data.companyRepresentativeTitle}
            </Text>
          </View>

          <Text style={styles.partyTitle}>ET</Text>

          <View style={{ marginTop: 8 }}>
            <Text style={styles.partyTitle}>L'EMPLOYÉ(E) :</Text>
            <Text style={styles.partyInfo}>
              {data.employeeFirstName} {data.employeeLastName}
            </Text>
            <Text style={styles.partyInfo}>
              Né(e) le {formatDate(data.employeeDateOfBirth)}
            </Text>
            <Text style={styles.partyInfo}>{data.employeeAddress}, {data.employeeCity}</Text>
            {data.employeeNationalId && (
              <Text style={styles.partyInfo}>
                Pièce d'identité : {data.employeeNationalId}
              </Text>
            )}
          </View>
        </View>

        <Text style={styles.paragraph}>
          <Text style={styles.bold}>IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :</Text>
        </Text>

        {/* Article 1: Object */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 1 - OBJET</Text>
          <Text style={styles.paragraph}>
            Le présent contrat a pour objet de définir les conditions d'emploi de{' '}
            {data.employeeFirstName} {data.employeeLastName} au sein de la société{' '}
            {data.companyName}.
          </Text>
          <Text style={styles.paragraph}>
            L'employé(e) est engagé(e) à compter du {formatDate(data.startDate)} en qualité de{' '}
            <Text style={styles.bold}>{data.positionTitle}</Text>
            {data.department && <Text> au sein du département {data.department}</Text>}.
          </Text>
        </View>

        {/* Article 2: Job Description */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 2 - FONCTIONS</Text>
          <Text style={styles.paragraph}>
            L'employé(e) exercera les fonctions suivantes :
          </Text>
          <Text style={styles.paragraph}>
            {data.positionDescription}
          </Text>
          <Text style={styles.paragraph}>
            L'employé(e) s'engage à exécuter ces fonctions avec compétence, diligence et loyauté,
            conformément aux instructions de la Direction.
          </Text>
        </View>

        {/* Article 3: Duration */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 3 - DURÉE DU CONTRAT</Text>
          <Text style={styles.paragraph}>
            Le présent contrat est conclu pour une <Text style={styles.bold}>
            durée indéterminée</Text> et prend effet à compter du {formatDate(data.startDate)}.
          </Text>
          <Text style={styles.paragraph}>
            Il est assorti d'une période d'essai de <Text style={styles.bold}>
            {data.probationPeriod} mois</Text>, renouvelable une fois. Durant cette période,
            le contrat pourra être rompu par l'une ou l'autre des parties sans préavis ni
            indemnité.
          </Text>
        </View>

        {/* Article 4: Remuneration */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 4 - RÉMUNÉRATION</Text>
          <Text style={styles.paragraph}>
            En contrepartie de son travail, l'employé(e) percevra une rémunération brute{' '}
            {data.salaryPeriod === 'mensuel' ? 'mensuelle' : 'horaire'} de{' '}
            <Text style={styles.bold}>
              {formatCurrency(data.baseSalary)} {data.currency}
            </Text>
            , payable à la fin de chaque mois.
          </Text>
          {data.benefits && data.benefits.length > 0 && (
            <Text style={styles.paragraph}>
              Cette rémunération comprend également les avantages suivants : {data.benefits.join(', ')}.
            </Text>
          )}
          <Text style={styles.paragraph}>
            Cette rémunération est soumise aux retenues fiscales et sociales obligatoires.
          </Text>
        </View>

        {/* Article 5: Working Hours */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 5 - DURÉE DU TRAVAIL</Text>
          <Text style={styles.paragraph}>
            La durée hebdomadaire de travail est fixée à{' '}
            <Text style={styles.bold}>{data.weeklyHours} heures</Text>, réparties selon
            l'horaire suivant : {data.workSchedule}.
          </Text>
          <Text style={styles.paragraph}>
            L'employé(e) exercera ses fonctions au sein du site de <Text style={styles.bold}>
            {data.workLocation}</Text>.
          </Text>
        </View>

        {/* Article 6: Termination Notice */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 6 - RUPTURE DU CONTRAT</Text>
          <Text style={styles.paragraph}>
            Après la période d'essai, le contrat pourra être rompu par l'une ou l'autre des
            parties moyennant un préavis de <Text style={styles.bold}>{data.noticePeriod} jours</Text>,
            sauf en cas de faute grave ou lourde.
          </Text>
          <Text style={styles.paragraph}>
            Le préavis commence à courir le lendemain du jour de la notification de la rupture.
          </Text>
        </View>

        {/* Article 7: Collective Agreement */}
        {data.collectiveAgreement && (
          <View style={styles.section}>
            <Text style={styles.articleTitle}>ARTICLE 7 - CONVENTION COLLECTIVE</Text>
            <Text style={styles.paragraph}>
              Le présent contrat est soumis aux dispositions de la{' '}
              <Text style={styles.bold}>{data.collectiveAgreement}</Text>.
            </Text>
          </View>
        )}

        {/* Article 8: Confidentiality & Loyalty */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>
            ARTICLE {data.collectiveAgreement ? '8' : '7'} - CONFIDENTIALITÉ ET LOYAUTÉ
          </Text>
          <Text style={styles.paragraph}>
            L'employé(e) s'engage à ne divulguer aucune information confidentielle concernant
            l'entreprise, ses clients, ses projets ou ses méthodes de travail, pendant la durée
            du contrat et après sa cessation.
          </Text>
          <Text style={styles.paragraph}>
            L'employé(e) s'engage également à faire preuve de loyauté envers l'entreprise et à
            ne pas exercer d'activité concurrente durant la période d'emploi.
          </Text>
        </View>

        {/* Additional Clauses */}
        {data.additionalClauses && data.additionalClauses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.articleTitle}>
              ARTICLE {data.collectiveAgreement ? '9' : '8'} - CLAUSES PARTICULIÈRES
            </Text>
            {data.additionalClauses.map((clause, index) => (
              <Text key={index} style={styles.paragraph}>
                {clause}
              </Text>
            ))}
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Fait à {data.companyCity},</Text>
            <Text style={styles.signatureLabel}>Le {formatDate(data.contractDate)}</Text>
            <Text style={styles.signatureLine}>L'Employeur</Text>
            <Text style={{ fontSize: 9, marginTop: 2 }}>
              {data.companyRepresentative}
            </Text>
          </View>

          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Fait à {data.employeeCity},</Text>
            <Text style={styles.signatureLabel}>Le {formatDate(data.contractDate)}</Text>
            <Text style={styles.signatureLine}>L'Employé(e)</Text>
            <Text style={{ fontSize: 9, marginTop: 2 }}>
              {data.employeeFirstName} {data.employeeLastName}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Contrat de travail CDI - {data.companyName} - N° {data.contractNumber}
          </Text>
          <Text>Page 1/1</Text>
        </View>
      </Page>
    </Document>
  );
}
