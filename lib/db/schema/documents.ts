import { pgTable, uuid, timestamp, text, integer, jsonb, pgPolicy, boolean, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { employees } from './employees';
import { users } from './users';
import { payrollRuns } from './payroll';
import { tenantUser } from './roles';

/**
 * Document Templates (Legacy - kept for backward compatibility)
 * Stores customizable templates for different document types
 */
export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Template identification
  templateType: text('template_type').notNull(), // 'bulletin_de_paie', 'certificat_de_travail', 'solde_de_tout_compte'
  templateName: text('template_name').notNull(),

  // Template configuration
  templateData: jsonb('template_data'), // Layout, fonts, logo URL, styling options
  isDefault: boolean('is_default').default(false),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Payslip Templates (New - GAP-DOC-002)
 * Customizable pay slip templates with branding and layout options
 */
export const payslipTemplates = pgTable('payslip_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Template identification
  templateName: text('template_name').notNull(),
  isDefault: boolean('is_default').default(false),

  // Branding
  logoUrl: text('logo_url'),
  companyNameOverride: text('company_name_override'),
  headerText: text('header_text'),
  footerText: text('footer_text'),

  // Layout options
  layoutType: text('layout_type').default('STANDARD'), // 'STANDARD', 'COMPACT', 'DETAILED'
  fontFamily: text('font_family').default('Helvetica'),
  primaryColor: text('primary_color').default('#000000'),

  // Sections visibility
  showEmployerContributions: boolean('show_employer_contributions').default(true),
  showYearToDate: boolean('show_year_to_date').default(true),
  showLeaveBalance: boolean('show_leave_balance').default(true),

  // Custom fields (Handlebars variables)
  customFields: jsonb('custom_fields').$type<Array<{label: string; value: string}>>().default([]),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Generated Documents
 * Stores all generated documents with version tracking
 */
export const generatedDocuments = pgTable('generated_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),

  // Document identification
  documentType: text('document_type').notNull(), // 'bulletin_de_paie', 'certificat_de_travail', 'solde_de_tout_compte'
  documentSubtype: text('document_subtype'), // e.g., 'payslip_correction', 'work_certificate_resignation'
  period: text('period'), // 'YYYY-MM' for payslips

  // File storage
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size'),

  // Version tracking
  generationDate: timestamp('generation_date').notNull().defaultNow(),
  versionNumber: integer('version_number').notNull().default(1),
  replacesDocumentId: uuid('replaces_document_id').references((): any => generatedDocuments.id), // Self-reference for corrections
  generatedBy: uuid('generated_by').references(() => users.id),

  // Metadata (context-specific data)
  metadata: jsonb('metadata'), // { payrollLineItemId, payrollRunId, terminationDate, reason, etc. }

  // Access tracking
  accessedCount: integer('accessed_count').notNull().default(0),
  lastAccessedAt: timestamp('last_accessed_at'),

  // Document management (consistency with uploaded_documents)
  tags: text('tags').array(),
  isArchived: boolean('is_archived').default(false),

  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
  // Employees can view their own documents
  pgPolicy('employee_access', {
    as: 'permissive',
    for: 'select',
    to: tenantUser,
    using: sql`${table.employeeId} = (auth.jwt() ->> 'employee_id')::uuid`,
  }),
]);

/**
 * Document Access Log
 * Audit trail for document access (GDPR compliance)
 */
export const documentAccessLog = pgTable('document_access_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => generatedDocuments.id, { onDelete: 'cascade' }),
  accessedBy: uuid('accessed_by').notNull().references(() => users.id),

  // Access details
  accessType: text('access_type').notNull(), // 'view', 'download', 'email', 'print'
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  accessedAt: timestamp('accessed_at').notNull().defaultNow(),
});

/**
 * Bulk Generation Jobs
 * Track progress of bulk document generation
 */
export const bulkGenerationJobs = pgTable('bulk_generation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  payrollRunId: uuid('payroll_run_id').references(() => payrollRuns.id, { onDelete: 'cascade' }),

  // Job details
  documentType: text('document_type').notNull(),
  totalDocuments: integer('total_documents').notNull().default(0),
  generatedDocuments: integer('generated_documents').notNull().default(0),
  failedDocuments: integer('failed_documents').notNull().default(0),

  // Status tracking
  jobStatus: text('job_status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'completed_with_errors', 'failed'
  errorLog: jsonb('error_log'), // Array of error objects

  // Timing
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),

  // Audit
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Document Categories
 * Reference table for document category metadata (labels, icons, permissions)
 */
export const documentCategories = pgTable('document_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // contract, id_card, diploma, etc.
  labelFr: text('label_fr').notNull(), // "Contrat de travail"
  icon: text('icon').notNull(), // Lucide icon name: "FileText"
  allowsUpload: boolean('allows_upload').default(true),
  allowsGeneration: boolean('allows_generation').default(false),
  requiresHrApproval: boolean('requires_hr_approval').default(false),
  employeeCanUpload: boolean('employee_can_upload').default(false),
  displayOrder: integer('display_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Uploaded Documents
 * Stores all user-uploaded documents (contracts, IDs, medical certs, etc.)
 * Features: Approval workflow, expiry tracking, soft delete
 */
export const uploadedDocuments = pgTable('uploaded_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }), // Nullable for company-wide docs

  // Document classification
  documentCategory: text('document_category').notNull(), // contract, id_card, diploma, medical, performance, policy, other
  documentSubcategory: text('document_subcategory'), // CDI, CDD, passport, performance_review, etc.

  // File information
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(), // Supabase Storage URL
  fileSize: integer('file_size').notNull(), // Bytes
  mimeType: text('mime_type').notNull(), // application/pdf, image/jpeg, etc.

  // Upload metadata
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow(),

  // Version tracking
  versionNumber: integer('version_number').notNull().default(1),
  parentDocumentId: uuid('parent_document_id').references((): any => uploadedDocuments.id, { onDelete: 'set null' }),
  isLatestVersion: boolean('is_latest_version').notNull().default(true),
  versionNotes: text('version_notes'),
  supersededAt: timestamp('superseded_at'),
  supersededById: uuid('superseded_by_id').references((): any => uploadedDocuments.id, { onDelete: 'set null' }),

  // Optional fields
  expiryDate: date('expiry_date'), // For IDs, contracts with end dates
  tags: text('tags').array(), // Flexible categorization
  metadata: jsonb('metadata').default({}), // Extensible field for custom data

  // Approval workflow
  approvalStatus: text('approval_status').default('approved'), // pending, approved, rejected
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),

  // Soft delete
  isArchived: boolean('is_archived').default(false),

  // E-Signature integration (Dropbox Sign)
  signatureRequestId: text('signature_request_id'),
  signatureProvider: text('signature_provider').default('dropbox_sign'),
  signatureStatus: text('signature_status'), // pending, partially_signed, signed, declined, cancelled
  signatureUrl: text('signature_url'),
  signedAt: timestamp('signed_at'),
  signatureMetadata: jsonb('signature_metadata').default({}),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
  // Employees can view their own documents
  pgPolicy('employee_view_own', {
    as: 'permissive',
    for: 'select',
    to: tenantUser,
    using: sql`${table.employeeId} = (auth.jwt() ->> 'employee_id')::uuid`,
  }),
  // HR/Admin can manage all documents
  pgPolicy('hr_manage_all', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`(auth.jwt() ->> 'role') IN ('HR_MANAGER', 'ADMIN', 'SUPER_ADMIN')`,
  }),
]);

/**
 * Signature Events
 * Audit trail of all e-signature events for legal compliance
 */
export const signatureEvents = pgTable('signature_events', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Link to document
  documentId: uuid('document_id').notNull().references(() => uploadedDocuments.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Event details
  eventType: text('event_type').notNull(), // 'request_sent', 'viewed', 'signed', 'declined', 'cancelled', 'completed'
  eventTimestamp: timestamp('event_timestamp').defaultNow(),

  // Signer information
  signerEmail: text('signer_email'),
  signerName: text('signer_name'),
  signerIpAddress: text('signer_ip_address'),
  signerUserAgent: text('signer_user_agent'),

  // Provider data
  signatureProvider: text('signature_provider').default('dropbox_sign'),
  providerEventId: text('provider_event_id'),

  // Additional metadata
  metadata: jsonb('metadata').default({}),

  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

/**
 * Document Version Changelog
 * Optional audit trail of changes between document versions
 */
export const documentVersionChangelog = pgTable('document_version_changelog', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => uploadedDocuments.id, { onDelete: 'cascade' }),
  previousVersionId: uuid('previous_version_id').references(() => uploadedDocuments.id, { onDelete: 'set null' }),
  changeSummary: text('change_summary').notNull(),
  changedFields: jsonb('changed_fields'),
  changedBy: uuid('changed_by').references(() => users.id),
  changedAt: timestamp('changed_at').defaultNow(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
}, (table) => [
  pgPolicy('tenant_isolation', {
    as: 'permissive',
    for: 'all',
    to: tenantUser,
    using: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin'`,
    withCheck: sql`${table.tenantId} = (auth.jwt() ->> 'tenant_id')::uuid`,
  }),
]);

// Type exports
export type DocumentCategory = typeof documentCategories.$inferSelect;
export type NewDocumentCategory = typeof documentCategories.$inferInsert;

export type UploadedDocument = typeof uploadedDocuments.$inferSelect;
export type NewUploadedDocument = typeof uploadedDocuments.$inferInsert;

export type SignatureEvent = typeof signatureEvents.$inferSelect;
export type NewSignatureEvent = typeof signatureEvents.$inferInsert;

export type DocumentVersionChangelog = typeof documentVersionChangelog.$inferSelect;
export type NewDocumentVersionChangelog = typeof documentVersionChangelog.$inferInsert;
