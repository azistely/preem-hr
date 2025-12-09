/**
 * Document Requests Schema - Administrative Document Request Management
 *
 * Purpose: Enable employees to request administrative documents from HR
 * Use cases:
 * - Request attestation de travail, attestation de salaire, etc.
 * - Manager can request on behalf of team members
 * - HR reviews, generates, and delivers documents
 * - Complete audit trail for compliance
 *
 * Integration:
 * - Links to uploadedDocuments when document is generated
 * - Notifications for request submission and completion
 * - HR dashboard for pending requests
 *
 * Document Types:
 * - Attestation de travail (Work certificate)
 * - Attestation d'emploi (Employment attestation)
 * - Attestation de salaire (Salary attestation)
 * - Déclaration fiscale (Tax statement)
 * - Attestation CNPS (CNPS attestation)
 * - Domiciliation bancaire (Bank domiciliation letter)
 * - Copie du contrat (Contract copy)
 */

import { pgTable, uuid, varchar, text, boolean, timestamp, pgPolicy, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { uploadedDocuments } from './documents';
import { tenantUser } from './roles';

/**
 * ============================================================================
 * Document Request Types Enum
 * ============================================================================
 */
export const DocumentRequestType = {
  ATTESTATION_TRAVAIL: 'attestation_travail',
  ATTESTATION_EMPLOI: 'attestation_emploi',
  ATTESTATION_SALAIRE: 'attestation_salaire',
  DECLARATION_FISCALE: 'declaration_fiscale',
  ATTESTATION_CNPS: 'attestation_cnps',
  DOMICILIATION_BANCAIRE: 'domiciliation_bancaire',
  COPIE_CONTRAT: 'copie_contrat',
} as const;

export type DocumentRequestTypeValue = typeof DocumentRequestType[keyof typeof DocumentRequestType];

/**
 * Document Type Display Names (French)
 */
export const DocumentRequestTypeLabels: Record<DocumentRequestTypeValue, string> = {
  attestation_travail: 'Attestation de travail',
  attestation_emploi: "Attestation d'emploi",
  attestation_salaire: 'Attestation de salaire',
  declaration_fiscale: 'Déclaration fiscale',
  attestation_cnps: 'Attestation CNPS',
  domiciliation_bancaire: 'Domiciliation bancaire',
  copie_contrat: 'Copie du contrat',
};

/**
 * Document Type Descriptions (French) - for wizard
 */
export const DocumentRequestTypeDescriptions: Record<DocumentRequestTypeValue, string> = {
  attestation_travail: 'Certificat attestant que vous êtes employé par l\'entreprise',
  attestation_emploi: 'Confirmation de votre statut d\'employé et de votre poste',
  attestation_salaire: 'Document indiquant votre salaire actuel',
  declaration_fiscale: 'Relevé annuel pour déclaration d\'impôts',
  attestation_cnps: 'Attestation de cotisations sociales CNPS',
  domiciliation_bancaire: 'Lettre pour ouverture de compte ou crédit bancaire',
  copie_contrat: 'Copie de votre contrat de travail',
};

/**
 * ============================================================================
 * Document Request Status Enum
 * ============================================================================
 */
export const DocumentRequestStatus = {
  PENDING: 'pending',       // Awaiting HR review
  PROCESSING: 'processing', // HR is generating document
  READY: 'ready',           // Document generated, ready for download
  REJECTED: 'rejected',     // Request denied by HR
  CANCELLED: 'cancelled',   // Cancelled by requester
} as const;

export type DocumentRequestStatusValue = typeof DocumentRequestStatus[keyof typeof DocumentRequestStatus];

/**
 * Request Status Display Names (French)
 */
export const DocumentRequestStatusLabels: Record<DocumentRequestStatusValue, string> = {
  pending: 'En attente',
  processing: 'En cours de traitement',
  ready: 'Prêt',
  rejected: 'Refusé',
  cancelled: 'Annulé',
};

/**
 * ============================================================================
 * Table: document_requests
 * Main table tracking administrative document requests and their lifecycle
 * ============================================================================
 */
export const documentRequests = pgTable('document_requests', {
  // Primary & Relationships
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Request Details
  documentType: text('document_type').notNull(), // From DocumentRequestType enum
  requestNotes: text('request_notes'), // Optional notes from requester

  // Manager Proxy Pattern
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  requestedOnBehalfOf: boolean('requested_on_behalf_of').notNull().default(false), // True if manager submitted for employee

  // Status Tracking
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // Status: 'pending', 'processing', 'ready', 'rejected', 'cancelled'
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),

  // HR Review
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),

  // Generated Document Link
  generatedDocumentId: uuid('generated_document_id').references(() => uploadedDocuments.id),
  documentReadyAt: timestamp('document_ready_at'),

  // Employee Snapshot (for audit trail)
  employeeName: varchar('employee_name', { length: 255 }),
  employeeNumber: varchar('employee_number', { length: 50 }),

  // Audit Trail
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // Indexes for performance
  index('idx_document_requests_tenant_status').on(table.tenantId, table.status),
  index('idx_document_requests_employee').on(table.employeeId),
  index('idx_document_requests_requested_by').on(table.requestedBy),
  index('idx_document_requests_created_at').on(table.createdAt.desc()),

  // RLS Policy: Tenant Isolation
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * ============================================================================
 * Type-safe Inferred Types
 * ============================================================================
 */
export type DocumentRequest = typeof documentRequests.$inferSelect;
export type NewDocumentRequest = typeof documentRequests.$inferInsert;

// Convenience alias for shorter import (as Record<string, string> for easier indexing)
export const DocumentTypeLabels: Record<string, string> = DocumentRequestTypeLabels;
