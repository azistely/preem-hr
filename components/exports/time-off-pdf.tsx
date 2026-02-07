/**
 * Time-Off Calendar PDF Document
 *
 * Generates a professional PDF report of time-off calendar data
 * Uses @react-pdf/renderer for document generation
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register fonts (optional - for better French character support)
// Font.register({
//   family: 'Roboto',
//   src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf',
// });

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f3f4f6',
    borderRadius: 5,
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 3,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#000',
    color: '#fff',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    padding: 8,
    fontSize: 9,
  },
  colEmployee: {
    width: '25%',
  },
  colPolicy: {
    width: '25%',
  },
  colDates: {
    width: '35%',
  },
  colStatus: {
    width: '15%',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10,
  },
});

interface TimeOffPDFProps {
  data: {
    title: string;
    generated: string;
    requests: Array<{
      employee: string;
      policyName: string;
      startDate: string;
      endDate: string;
      status: string;
      statusColor: string;
    }>;
    stats: {
      total: number;
      approved: number;
      pending: number;
    };
  };
}

export function TimeOffPDF({ data }: TimeOffPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>Généré le {data.generated}</Text>
        </View>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{data.stats.total}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Approuvés</Text>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>
              {data.stats.approved}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>En attente</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>
              {data.stats.pending}
            </Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colEmployee}>Employé</Text>
            <Text style={styles.colPolicy}>Type de congé</Text>
            <Text style={styles.colDates}>Période</Text>
            <Text style={styles.colStatus}>Statut</Text>
          </View>

          {/* Table Rows */}
          {data.requests.map((request, index) => (
            <View
              key={index}
              style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={styles.colEmployee}>{request.employee}</Text>
              <Text style={styles.colPolicy}>{request.policyName}</Text>
              <Text style={styles.colDates}>
                {request.startDate} → {request.endDate}
              </Text>
              <View style={styles.colStatus}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: request.statusColor },
                  ]}
                >
                  <Text>{request.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            Jamana - Système de Gestion des Ressources Humaines
          </Text>
          <Text>
            Document confidentiel - Page {' '}
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </Text>
        </View>
      </Page>
    </Document>
  );
}
