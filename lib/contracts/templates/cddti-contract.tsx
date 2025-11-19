/**
 * CDDTI Contract PDF Template
 * (Contrat à Durée Déterminée pour Travailleur Intermittent ou Temporaire)
 *
 * Special fixed-term contract for temporary/intermittent workers
 * Compliant with labor laws of French-speaking West Africa
 *
 * CRITICAL CONSTRAINTS:
 * - Maximum 12 months duration (CANNOT be exceeded)
 * - CANNOT be renewed (unlike regular CDD)
 * - Automatically converts to CDI if extended beyond 12 months
 * - Requires specific task description
 * - Used for: seasonal work, temporary missions, specific short-term projects
 *
 * Required legal clauses:
 * - Employee and employer identification
 * - Specific task/mission description (MANDATORY)
 * - Contract duration (max 12 months)
 * - End date (must be within 12 months)
 * - Remuneration and benefits
 * - Working hours and location
 * - 12-month automatic conversion warning
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
  criticalAlert: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f8d7da',
    border: '2 solid #dc3545',
    borderRadius: 3,
  },
  alertTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 5,
  },
  alertText: {
    fontSize: 10,
    color: '#721c24',
  },
  warningBox: {
    marginTop: 10,
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fff3cd',
    border: '1 solid #ffc107',
    borderRadius: 3,
  },
});

interface CDDTIContractData {
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

  // Contract duration (CDDTI-specific)
  startDate: string;
  endDate: string;
  cddtiTaskDescription: string; // Specific task/mission (MANDATORY)

  // Optional clauses
  collectiveAgreement?: string;
  additionalClauses?: string[];
}

export function CDDTIContractPDF({ data }: { data: CDDTIContractData }) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: fr });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount);
  };

  const calculateDuration = () => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMonths >= 1) {
      return `${diffMonths} mois`;
    } else {
      return `${diffDays} jours`;
    }
  };

  const isNear12Months = () => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30);
    return diffMonths > 11; // Warning if near 12 months
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CONTRAT DE TRAVAIL</Text>
          <Text style={styles.title}>À DURÉE DÉTERMINÉE</Text>
          <Text style={styles.title}>(TRAVAILLEUR INTERMITTENT / TEMPORAIRE)</Text>
          <Text style={styles.subtitle}>N° {data.contractNumber}</Text>
        </View>

        {/* Critical Legal Notice */}
        <View style={styles.criticalAlert}>
          <Text style={styles.alertTitle}>⚠️ CONTRAT CDDTI - DURÉE MAXIMALE 12 MOIS</Text>
          <Text style={styles.alertText}>
            Ce contrat est conclu pour une durée déterminée de {calculateDuration()}.{' '}
            <Text style={styles.bold}>IMPORTANT :</Text> Ce type de contrat ne peut excéder{' '}
            12 mois et ne peut être renouvelé. Toute prolongation au-delà de 12 mois entraîne{' '}
            automatiquement la transformation en Contrat à Durée Indéterminée (CDI).
          </Text>
        </View>

        {isNear12Months() && (
          <View style={styles.warningBox}>
            <Text style={styles.alertTitle}>⚠️ ATTENTION - PROCHE DE LA LIMITE LÉGALE</Text>
            <Text style={styles.alertText}>
              La durée de ce contrat approche ou dépasse la limite légale de 12 mois.{' '}
              Vérifiez la conformité avec le Code du Travail.
            </Text>
          </View>
        )}

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

        {/* Article 2: Duration & Task (CDDTI-specific) */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 2 - DURÉE ET MISSION SPÉCIFIQUE</Text>
          <Text style={styles.paragraph}>
            Le présent contrat est conclu pour une <Text style={styles.bold}>
            durée déterminée de {calculateDuration()}</Text>, à compter du {formatDate(data.startDate)}{' '}
            jusqu'au {formatDate(data.endDate)}.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Nature du contrat :</Text> Contrat à Durée Déterminée pour{' '}
            Travailleur Intermittent ou Temporaire (CDDTI), soumis aux dispositions spéciales du{' '}
            Code du Travail relatives aux emplois temporaires.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Mission spécifique confiée :</Text>
          </Text>
          <Text style={styles.paragraph}>
            {data.cddtiTaskDescription}
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Limites légales :</Text>
          </Text>
          <Text style={styles.paragraph}>
            • Durée maximale : 12 mois (sans possibilité de renouvellement){'\n'}
            • Conversion automatique en CDI si prolongation au-delà de 12 mois{'\n'}
            • Aucun avenant de renouvellement ne peut être conclu pour ce type de contrat
          </Text>
          <Text style={styles.paragraph}>
            Il est assorti d'une période d'essai de <Text style={styles.bold}>
            {data.probationPeriod} mois</Text>. Durant cette période, le contrat pourra être rompu{' '}
            par l'une ou l'autre des parties sans préavis ni indemnité.
          </Text>
        </View>

        {/* Article 3: Job Description */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 3 - FONCTIONS</Text>
          <Text style={styles.paragraph}>
            Dans le cadre de la mission définie ci-dessus, l'employé(e) exercera les fonctions suivantes :
          </Text>
          <Text style={styles.paragraph}>
            {data.positionDescription}
          </Text>
          <Text style={styles.paragraph}>
            L'employé(e) s'engage à exécuter ces fonctions avec compétence, diligence et loyauté,
            conformément aux instructions de la Direction et dans le respect de la mission temporaire
            qui lui est confiée.
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
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Indemnité de fin de contrat :</Text> À l'issue du présent contrat,{' '}
            si celui-ci va à son terme normal, l'employé(e) percevra une indemnité de précarité égale{' '}
            à 10% de la rémunération brute totale perçue pendant la durée du contrat, conformément{' '}
            aux dispositions légales applicables aux contrats temporaires.
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
          <Text style={styles.paragraph}>
            Les horaires pourront être adaptés en fonction des nécessités de la mission temporaire,
            dans le respect de la législation du travail en vigueur.
          </Text>
        </View>

        {/* Article 6: Termination */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 6 - FIN DU CONTRAT</Text>
          <Text style={styles.paragraph}>
            Le contrat prend fin de plein droit le <Text style={styles.bold}>
            {formatDate(data.endDate)}</Text>, sans qu'il soit nécessaire de donner un préavis.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Transformation automatique en CDI :</Text> Si le contrat se{' '}
            poursuit au-delà de 12 mois depuis la date de début, il sera automatiquement transformé{' '}
            en Contrat à Durée Indéterminée, conformément aux dispositions légales.
          </Text>
          <Text style={styles.paragraph}>
            Le contrat peut être rompu avant son terme dans les cas suivants :
          </Text>
          <Text style={styles.paragraph}>
            • Accord mutuel des parties{'\n'}
            • Faute grave ou lourde{'\n'}
            • Force majeure{'\n'}
            • Inaptitude médicalement constatée{'\n'}
            • Fin anticipée de la mission spécifique
          </Text>
        </View>

        {/* Article 7: No Renewal Clause */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>ARTICLE 7 - ABSENCE DE RENOUVELLEMENT</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>ATTENTION :</Text> Contrairement aux CDD classiques, le présent{' '}
            contrat CDDTI <Text style={styles.bold}>ne peut en aucun cas être renouvelé</Text>.
          </Text>
          <Text style={styles.paragraph}>
            Toute prolongation ou nouvelle mission au-delà de la date d'échéance ou après{' '}
            12 mois cumulés entraînera automatiquement la requalification du contrat en{' '}
            Contrat à Durée Indéterminée (CDI).
          </Text>
        </View>

        {/* Article 8: Collective Agreement */}
        {data.collectiveAgreement && (
          <View style={styles.section}>
            <Text style={styles.articleTitle}>ARTICLE 8 - CONVENTION COLLECTIVE</Text>
            <Text style={styles.paragraph}>
              Le présent contrat est soumis aux dispositions de la{' '}
              <Text style={styles.bold}>{data.collectiveAgreement}</Text>.
            </Text>
          </View>
        )}

        {/* Article 9: Confidentiality & Loyalty */}
        <View style={styles.section}>
          <Text style={styles.articleTitle}>
            ARTICLE {data.collectiveAgreement ? '9' : '8'} - CONFIDENTIALITÉ ET LOYAUTÉ
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
              ARTICLE {data.collectiveAgreement ? '10' : '9'} - CLAUSES PARTICULIÈRES
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
            Contrat de travail CDDTI - {data.companyName} - N° {data.contractNumber}
          </Text>
          <Text>
            Durée : {formatDate(data.startDate)} au {formatDate(data.endDate)} ({calculateDuration()})
          </Text>
          <Text>⚠️ LIMITE LÉGALE : 12 mois maximum - Pas de renouvellement possible</Text>
          <Text>Page 1/1</Text>
        </View>
      </Page>
    </Document>
  );
}
