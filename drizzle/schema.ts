import { pgTable, index, unique, uuid, varchar, jsonb, integer, boolean, timestamp, pgPolicy, check, text, type AnyPgColumn, foreignKey, inet, date, numeric, pgView, customType, type PgTableWithColumns, pgEnum } from "drizzle-orm/pg-core"
import { sql, relations } from "drizzle-orm"

// Custom type for PostGIS/Postgres name type
const unknown = customType<{ data: string }>({
  dataType() {
    return 'name';
  },
});

// Rate type enum
export const rateTypeEnum = pgEnum('rate_type_enum', ['MONTHLY', 'DAILY', 'HOURLY']);

// Weekly hours regime enum (for daily workers)
export const weeklyHoursRegimeEnum = pgEnum('weekly_hours_regime_enum', ['40h', '44h', '48h', '52h', '56h']);

// Payment frequency enum (for daily workers)
export const paymentFrequencyEnum = pgEnum('payment_frequency_enum', ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);


export const countries = pgTable("countries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 2 }).notNull(),
	name: jsonb().notNull(),
	currencyCode: varchar("currency_code", { length: 3 }).notNull(),
	decimalPlaces: integer("decimal_places").default(0).notNull(),
	minimumWage: numeric("minimum_wage", { precision: 15, scale: 2 }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_countries_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	unique("countries_code_key").on(table.code),
]);

export const sectorConfigurations = pgTable("sector_configurations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull().references(() => countries.code, { onDelete: "restrict" }),
	sectorCode: varchar("sector_code", { length: 50 }).notNull(),
	name: jsonb().notNull(), // { fr: "Services", en: "Services" }
	workAccidentRate: numeric("work_accident_rate", { precision: 5, scale: 4 }).default('0.0200').notNull(),
	defaultComponents: jsonb("default_components").default([]).notNull(),
	smartDefaults: jsonb("smart_defaults"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sector_configurations_country_sector").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.sectorCode.asc().nullsLast().op("text_ops")),
	unique("sector_configurations_country_code_sector_code_key").on(table.countryCode, table.sectorCode),
	pgPolicy("sector_configurations_select_all", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const tenants = pgTable("tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	countryCode: text("country_code").default('CI').notNull(),
	sectorCode: varchar("sector_code", { length: 50 }).notNull(),
	currency: text().default('XOF').notNull(),
	timezone: text().default('Africa/Abidjan').notNull(),
	taxId: text("tax_id"),
	businessRegistration: text("business_registration"),
	industry: text(),
	cgeciSectorCode: varchar("cgeci_sector_code", { length: 50 }),
	genericSectorCode: varchar("generic_sector_code", { length: 50 }),
	plan: text().default('trial').notNull(),
	features: jsonb().default([]).notNull(),
	settings: jsonb().default({}).notNull(),
	status: text().default('active').notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tenants_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_tenants_country_sector").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.sectorCode.asc().nullsLast().op("text_ops")),
	index("idx_tenants_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("idx_tenants_status").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	foreignKey({
		columns: [table.countryCode, table.sectorCode],
		foreignColumns: [sectorConfigurations.countryCode, sectorConfigurations.sectorCode],
		name: "fk_tenants_sector_code"
	}).onDelete("restrict").onUpdate("cascade"),
	unique("tenants_slug_key").on(table.slug),
	pgPolicy("tenant_self_service", { as: "permissive", for: "all", to: ["public"], using: sql`((id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`  }),
	check("valid_country", sql`country_code ~ '^[A-Z]{2}$'::text`),
	check("valid_currency", sql`currency ~ '^[A-Z]{3}$'::text`),
	check("valid_plan", sql`plan = ANY (ARRAY['trial'::text, 'starter'::text, 'professional'::text, 'enterprise'::text])`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])`),
]);

export const users: PgTableWithColumns<any> = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id"),
	email: text().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	avatarUrl: text("avatar_url"),
	locale: text().default('fr').notNull(),
	role: text().default('employee').notNull(),
	permissions: jsonb().default([]).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	lastLoginIp: inet("last_login_ip"),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table): any => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_users_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("idx_users_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'active'::text)`),
	index("idx_users_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "fk_users_employee"
		}).onDelete("set null"),
	// Self-referencing FK removed - doesn't exist in database
	// foreignKey({
	// 		columns: [table.id],
	// 		foreignColumns: [table.id],
	// 		name: "users_id_fkey"
	// }).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "users_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("users_email_key").on(table.email),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_role", sql`role = ANY (ARRAY['super_admin'::text, 'tenant_admin'::text, 'hr_manager'::text, 'employee'::text])`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])`),
]);

export const taxSystems = pgTable("tax_systems", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	displayName: jsonb("display_name").notNull(),
	calculationMethod: varchar("calculation_method", { length: 50 }).notNull(),
	supportsFamilyDeductions: boolean("supports_family_deductions").default(false).notNull(),
	calculationBase: varchar("calculation_base", { length: 50 }).notNull(),
	taxCalculationBase: text("tax_calculation_base").default('gross_before_ss'),
	retirementContributionLabel: jsonb("retirement_contribution_label").default({"fr": "Retraite", "en": "Retirement"}),
	healthContributionLabel: jsonb("health_contribution_label").default({"fr": "Santé", "en": "Health"}),
	incomeTaxLabel: jsonb("income_tax_label").default({"fr": "Impôt", "en": "Income Tax"}),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tax_systems_country_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "tax_systems_country_code_fkey"
		}),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
]);

export const departments = pgTable("departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	code: text(),
	description: text(),
	parentDepartmentId: uuid("parent_department_id"),
	managerId: uuid("manager_id"),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_departments_parent").using("btree", table.parentDepartmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_departments_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'active'::text)`),
	index("idx_departments_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "departments_created_by_fkey"
		}),
	foreignKey({
			columns: [table.parentDepartmentId],
			foreignColumns: [table.id],
			name: "departments_parent_department_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "departments_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "departments_updated_by_fkey"
		}),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [employees.id],
			name: "fk_departments_manager"
		}).onDelete("set null"),
	unique("unique_department_code").on(table.tenantId, table.code),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'inactive'::text])`),
]);

export const taxBrackets = pgTable("tax_brackets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	taxSystemId: uuid("tax_system_id").notNull(),
	bracketOrder: integer("bracket_order").notNull(),
	minAmount: numeric("min_amount", { precision: 15, scale:  2 }).notNull(),
	maxAmount: numeric("max_amount", { precision: 15, scale:  2 }),
	rate: numeric({ precision: 6, scale:  4 }).notNull(),
	description: jsonb(),
}, (table) => [
	index("idx_tax_brackets_system").using("btree", table.taxSystemId.asc().nullsLast().op("int4_ops"), table.bracketOrder.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.taxSystemId],
			foreignColumns: [taxSystems.id],
			name: "tax_brackets_tax_system_id_fkey"
		}).onDelete("cascade"),
	unique("tax_brackets_tax_system_id_bracket_order_key").on(table.taxSystemId, table.bracketOrder),
	check("chk_bracket_amounts", sql`(max_amount IS NULL) OR (max_amount > min_amount)`),
	check("chk_rate_valid", sql`(rate >= (0)::numeric) AND (rate <= (1)::numeric)`),
]);

export const positions = pgTable("positions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	title: text().notNull(),
	code: text(),
	description: text(),
	departmentId: uuid("department_id"),
	reportsToPositionId: uuid("reports_to_position_id"),
	salaryBandId: uuid("salary_band_id"),
	minSalary: numeric("min_salary", { precision: 15, scale:  2 }),
	maxSalary: numeric("max_salary", { precision: 15, scale:  2 }),
	currency: text().default('XOF').notNull(),
	jobLevel: text("job_level"),
	// Job classification fields (from migration 20251030_enhance_positions_for_job_classification)
	jobFunction: varchar("job_function", { length: 255 }), // Fonction - broader role category
	jobTrade: varchar("job_trade", { length: 255 }), // Métier - specific job/trade performed
	employmentType: text("employment_type").default('full_time').notNull(),
	weeklyHours: numeric("weekly_hours", { precision: 5, scale:  2 }).default('40').notNull(),
	workSchedule: jsonb("work_schedule"),
	status: text().default('active').notNull(),
	headcount: integer().default(1).notNull(),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_positions_department").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_positions_effective").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("uuid_ops")),
	index("idx_positions_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'active'::text)`),
	index("idx_positions_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "positions_created_by_fkey"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "positions_department_id_fkey"
		}),
	foreignKey({
			columns: [table.reportsToPositionId],
			foreignColumns: [table.id],
			name: "positions_reports_to_position_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "positions_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "positions_updated_by_fkey"
		}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_employment_type", sql`employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'contract'::text])`),
	check("valid_salary_range", sql`(min_salary IS NULL) OR (max_salary IS NULL) OR (min_salary <= max_salary)`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'inactive'::text])`),
]);

export const familyDeductionRules = pgTable("family_deduction_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	taxSystemId: uuid("tax_system_id").notNull(),
	fiscalParts: numeric("fiscal_parts", { precision: 3, scale:  1 }).notNull(),
	deductionAmount: numeric("deduction_amount", { precision: 15, scale:  2 }).notNull(),
	description: jsonb(),
}, (table) => [
	index("idx_family_deductions_system").using("btree", table.taxSystemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.taxSystemId],
			foreignColumns: [taxSystems.id],
			name: "family_deduction_rules_tax_system_id_fkey"
		}).onDelete("cascade"),
	unique("family_deduction_rules_tax_system_id_fiscal_parts_key").on(table.taxSystemId, table.fiscalParts),
]);

export const employees: PgTableWithColumns<any> = pgTable("employees", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeNumber: text("employee_number").notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	preferredName: text("preferred_name"),
	dateOfBirth: date("date_of_birth"),
	gender: text(),
	email: text(),
	phone: text().notNull(),
	nationalId: text("national_id"),
	identityDocumentType: varchar("identity_document_type", { length: 20 }),
	addressLine1: text("address_line1"),
	addressLine2: text("address_line2"),
	city: text(),
	postalCode: text("postal_code"),
	countryCode: text("country_code").default('CI').notNull(),
	coefficient: integer().default(100).notNull(),
	rateType: rateTypeEnum("rate_type").default('MONTHLY').notNull(),
	categoryCode: varchar("category_code", { length: 10 }),
	dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
	primaryLocationId: uuid("primary_location_id"),
	hireDate: date("hire_date").notNull(),
	// Contract FK (contract details live in employment_contracts table)
	currentContractId: uuid("current_contract_id"),
	// Document expiry fields
	nationalIdExpiry: date("national_id_expiry"),
	workPermitExpiry: date("work_permit_expiry"),
	// Employment classification fields (for payroll calculations)
	sector: varchar({ length: 100 }),
	sectorCodeCgeci: varchar("sector_code_cgeci", { length: 50 }),
	conventionCode: varchar("convention_code", { length: 50 }),
	professionalLevel: integer("professional_level"),
	terminationDate: date("termination_date"),
	terminationReason: text("termination_reason"),
	terminationId: uuid("termination_id"),
	bankName: text("bank_name"),
	bankAccount: text("bank_account"),
	cnpsNumber: text("cnps_number"),
	taxNumber: text("tax_number"),
	taxDependents: integer("tax_dependents").default(0).notNull(),
	isExpat: boolean("is_expat").default(false).notNull(),
	// Personnel record fields (from migration 20251030_add_personnel_record_fields)
	nationalityZone: varchar("nationality_zone", { length: 20 }), // 'CEDEAO', 'HORS_CEDEAO', 'LOCAL'
	employeeType: varchar("employee_type", { length: 50 }), // 'LOCAL', 'EXPAT', 'DETACHE', 'STAGIAIRE'
	// Daily workers fields (Phase 2)
	weeklyHoursRegime: varchar("weekly_hours_regime", { length: 10 }).default('40h'),
	paymentFrequency: varchar("payment_frequency", { length: 20 }).default('MONTHLY'),
	fatherName: varchar("father_name", { length: 255 }),
	motherName: varchar("mother_name", { length: 255 }),
	emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	// Family status fields (for payroll correctness)
	maritalStatus: varchar("marital_status", { length: 20 }),
	dependentChildren: integer("dependent_children").default(0),
	fiscalParts: numeric("fiscal_parts", { precision: 3, scale: 1 }).default('1.0'),
	hasFamily: boolean("has_family").default(false),
	customFields: jsonb("custom_fields").default({}).notNull(),
	reportingManagerId: uuid("reporting_manager_id"),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table): any => [
	index("idx_employees_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_employees_hire_date").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.hireDate.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_number").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.employeeNumber.asc().nullsLast().op("text_ops")),
	index("idx_employees_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "employees_created_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employees_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "employees_updated_by_fkey"
		}),
	foreignKey({
			columns: [table.terminationId],
			foreignColumns: [employeeTerminations.id],
			name: "employees_termination_id_fkey"
		}),
	foreignKey({
			columns: [table.reportingManagerId],
			foreignColumns: [table.id],
			name: "employees_reporting_manager_id_fkey"
		}),
	foreignKey({
			columns: [table.currentContractId],
			foreignColumns: [employmentContracts.id],
			name: "employees_current_contract_id_fkey"
		}),
	unique("unique_employee_number").on(table.tenantId, table.employeeNumber),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_gender", sql`(gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])) OR (gender IS NULL)`),
	check("valid_marital_status", sql`(marital_status = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text])) OR (marital_status IS NULL)`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'terminated'::text, 'suspended'::text])`),
]);

// Employee Dependents Table
export const employeeDependents: PgTableWithColumns<any> = pgTable("employee_dependents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	employeeId: uuid("employee_id").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	// Dependent information
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	dateOfBirth: date("date_of_birth").notNull(),
	relationship: varchar({ length: 50 }).notNull(), // 'child', 'spouse', 'other'
	// Verification status
	isVerified: boolean("is_verified").default(false).notNull(),
	requiresDocument: boolean("requires_document").default(false).notNull(), // TRUE if over 21
	// Document tracking (for dependents over 21)
	documentType: varchar("document_type", { length: 100 }), // 'certificat_frequentation', 'attestation_scolarite', 'carte_etudiant'
	documentNumber: varchar("document_number", { length: 100 }),
	documentIssueDate: date("document_issue_date"),
	documentExpiryDate: date("document_expiry_date"),
	documentUrl: text("document_url"), // Link to uploaded document in storage
	documentNotes: text("document_notes"),
	// Eligibility flags
	eligibleForFiscalParts: boolean("eligible_for_fiscal_parts").default(true).notNull(),
	eligibleForCmu: boolean("eligible_for_cmu").default(true).notNull(),
	// Additional metadata
	notes: text(),
	// Status
	status: varchar({ length: 20 }).default('active').notNull(), // 'active', 'inactive', 'expired'
	// Audit fields
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table): any => [
	index("idx_employee_dependents_employee_id").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_dependents_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_dependents_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.employeeId],
		foreignColumns: [employees.id],
		name: "employee_dependents_employee_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: "employee_dependents_tenant_id_fkey"
	}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
]);

// Employees Relations
export const employeesRelations = relations(employees, ({ one, many }) => ({
	tenant: one(tenants, {
		fields: [employees.tenantId],
		references: [tenants.id],
	}),
	createdByUser: one(users, {
		fields: [employees.createdBy],
		references: [users.id],
	}),
	updatedByUser: one(users, {
		fields: [employees.updatedBy],
		references: [users.id],
	}),
	termination: one(employeeTerminations, {
		fields: [employees.terminationId],
		references: [employeeTerminations.id],
	}),
	reportingManager: one(employees, {
		fields: [employees.reportingManagerId],
		references: [employees.id],
		relationName: "managerToTeam",
	}),
	teamMembers: many(employees, {
		relationName: "managerToTeam",
	}),
	dependents: many(employeeDependents),
	timeEntries: many(timeEntries),
	timeOffBalances: many(timeOffBalances),
	timeOffRequests: many(timeOffRequests),
	payslips: many(payslips),
}));

export const employeeTerminations: PgTableWithColumns<any> = pgTable("employee_terminations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	// Termination details
	terminationDate: date("termination_date").notNull(),
	terminationReason: text("termination_reason").notNull(),
	notes: text(),
	// Notice period
	noticePeriodDays: integer("notice_period_days").notNull(),
	noticePaymentAmount: numeric("notice_payment_amount", { precision: 15, scale: 2 }),
	jobSearchDaysUsed: integer("job_search_days_used").default(0),
	// Financial calculations
	severanceAmount: numeric("severance_amount", { precision: 15, scale: 2 }).default('0').notNull(),
	vacationPayoutAmount: numeric("vacation_payout_amount", { precision: 15, scale: 2 }).default('0').notNull(),
	averageSalary12m: numeric("average_salary_12m", { precision: 15, scale: 2 }),
	yearsOfService: numeric("years_of_service", { precision: 5, scale: 2 }),
	severanceRate: integer("severance_rate"),
	// Document generation tracking
	workCertificateGeneratedAt: timestamp("work_certificate_generated_at", { withTimezone: true, mode: 'string' }),
	workCertificateUrl: text("work_certificate_url"),
	finalPayslipGeneratedAt: timestamp("final_payslip_generated_at", { withTimezone: true, mode: 'string' }),
	finalPayslipUrl: text("final_payslip_url"),
	cnpsAttestationGeneratedAt: timestamp("cnps_attestation_generated_at", { withTimezone: true, mode: 'string' }),
	cnpsAttestationUrl: text("cnps_attestation_url"),
	// Workflow status
	status: text().default('pending').notNull(),
	// Audit fields
	createdBy: uuid("created_by"),
	createdByEmail: text("created_by_email"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedBy: uuid("updated_by"),
	updatedByEmail: text("updated_by_email"),
}, (table): any => [
	index("idx_terminations_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_terminations_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_terminations_date").using("btree", table.terminationDate.asc().nullsLast().op("date_ops")),
	index("idx_terminations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employee_terminations_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_terminations_employee_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`(tenant_id = ((current_setting('app.current_tenant_id'::text, true))::uuid))`, withCheck: sql`(tenant_id = ((current_setting('app.current_tenant_id'::text, true))::uuid))`  }),
	check("valid_termination_reason", sql`termination_reason = ANY (ARRAY['dismissal'::text, 'resignation'::text, 'retirement'::text, 'misconduct'::text, 'contract_end'::text, 'death'::text, 'other'::text])`),
	check("valid_status", sql`status = ANY (ARRAY['pending'::text, 'notice_period'::text, 'documents_pending'::text, 'completed'::text])`),
	check("positive_notice_period", sql`notice_period_days >= 0`),
	check("positive_severance", sql`severance_amount >= 0`),
	check("valid_severance_rate", sql`severance_rate = ANY (ARRAY[0, 30, 35, 40])`),
]);

export const jobSearchDays = pgTable("job_search_days", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// Links
	tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
	terminationId: uuid("termination_id").notNull().references(() => employeeTerminations.id, { onDelete: "cascade" }),
	employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
	// Job search day details
	searchDate: date("search_date").notNull(),
	dayType: varchar("day_type", { length: 20 }).notNull(), // 'full_day' or 'half_day'
	hoursTaken: numeric("hours_taken", { precision: 4, scale: 2 }).default('8.00').notNull(),
	// Approval workflow
	status: varchar({ length: 20 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
	approvedBy: uuid("approved_by").references(() => users.id),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	// Notes
	notes: text(),
	// Audit
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").references(() => users.id),
	updatedBy: uuid("updated_by").references(() => users.id),
}, (table) => [
	index("idx_job_search_days_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_search_days_termination").using("btree", table.terminationId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_search_days_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_search_days_date").using("btree", table.searchDate.asc().nullsLast().op("date_ops")),
	index("idx_job_search_days_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("unique_search_date_per_termination").on(table.terminationId, table.searchDate),
	check("valid_day_type", sql`day_type = ANY (ARRAY['full_day'::text, 'half_day'::text])`),
	check("valid_status", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`(tenant_id = ((current_setting('app.current_tenant_id'::text, true))::uuid))`, withCheck: sql`(tenant_id = ((current_setting('app.current_tenant_id'::text, true))::uuid))`  }),
]);

export const employeeCategoryCoefficients = pgTable("employee_category_coefficients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	category: varchar({ length: 10 }).notNull(),
	labelFr: text("label_fr").notNull(),
	minCoefficient: integer("min_coefficient").notNull(),
	maxCoefficient: integer("max_coefficient").notNull(),
	noticePeriodDays: integer("notice_period_days").notNull(),
	noticeReductionPercent: integer("notice_reduction_percent").default(0),
	minimumWageBase: varchar("minimum_wage_base", { length: 20 }).default('SMIG').notNull(),
	legalReference: text("legal_reference"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	sectorCode: varchar("sector_code", { length: 50 }),
	actualMinimumWage: numeric("actual_minimum_wage", { precision: 10, scale: 2 }),
}, (table) => [
	index("idx_employee_categories_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_employee_categories_coefficient_range").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.minCoefficient.asc().nullsLast().op("int4_ops"), table.maxCoefficient.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "employee_category_coefficients_country_code_fkey"
		}).onDelete("cascade"),
	unique("uk_category_country").on(table.countryCode, table.category),
	unique("uk_coefficient_range").on(table.countryCode, table.minCoefficient, table.maxCoefficient),
	check("check_coefficient_order", sql`min_coefficient <= max_coefficient`),
	check("check_notice_period", sql`notice_period_days > 0`),
	check("check_notice_reduction", sql`notice_reduction_percent >= 0 AND notice_reduction_percent <= 100`),
	pgPolicy("Allow read access to all authenticated users", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const socialSecuritySchemes = pgTable("social_security_schemes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	agencyCode: varchar("agency_code", { length: 10 }).notNull(),
	agencyName: jsonb("agency_name").notNull(),
	defaultSectorCode: text("default_sector_code").default('SERVICES'),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_social_schemes_country_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "social_security_schemes_country_code_fkey"
		}),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
]);

export const assignments = pgTable("assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	positionId: uuid("position_id").notNull(),
	assignmentType: text("assignment_type").default('primary').notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	assignmentReason: text("assignment_reason"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_assignments_current").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.effectiveTo.asc().nullsLast().op("uuid_ops")).where(sql`(effective_to IS NULL)`),
	index("idx_assignments_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.effectiveFrom.desc().nullsFirst().op("date_ops")),
	index("idx_assignments_position").using("btree", table.positionId.asc().nullsLast().op("uuid_ops")),
	index("idx_assignments_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "assignments_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "assignments_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.positionId],
			foreignColumns: [positions.id],
			name: "assignments_position_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "assignments_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_assignment_reason", sql`(assignment_reason = ANY (ARRAY['hire'::text, 'promotion'::text, 'transfer'::text, 'demotion'::text, 'other'::text])) OR (assignment_reason IS NULL)`),
	check("valid_assignment_type", sql`assignment_type = ANY (ARRAY['primary'::text, 'secondary'::text, 'temporary'::text])`),
]);

export const assignmentsRelations = relations(assignments, ({ one }) => ({
	tenant: one(tenants, {
		fields: [assignments.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [assignments.employeeId],
		references: [employees.id],
	}),
	position: one(positions, {
		fields: [assignments.positionId],
		references: [positions.id],
	}),
}));

export const contributionTypes = pgTable("contribution_types", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	schemeId: uuid("scheme_id").notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	employeeRate: numeric("employee_rate", { precision: 6, scale:  4 }),
	employerRate: numeric("employer_rate", { precision: 6, scale:  4 }),
	calculationBase: varchar("calculation_base", { length: 50 }).notNull(),
	ceilingAmount: numeric("ceiling_amount", { precision: 15, scale:  2 }),
	ceilingPeriod: varchar("ceiling_period", { length: 20 }),
	fixedAmount: numeric("fixed_amount", { precision: 15, scale:  2 }),
	isVariableBySector: boolean("is_variable_by_sector").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
}, (table) => [
	index("idx_contribution_types_scheme").using("btree", table.schemeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.schemeId],
			foreignColumns: [socialSecuritySchemes.id],
			name: "contribution_types_scheme_id_fkey"
		}).onDelete("cascade"),
	unique("contribution_types_scheme_id_code_key").on(table.schemeId, table.code),
]);

export const contributionTypesV2 = pgTable("contribution_types_v2", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	employeeRate: numeric("employee_rate", { precision: 6, scale:  4 }),
	employerRate: numeric("employer_rate", { precision: 6, scale:  4 }),
	calculationBase: text("calculation_base").notNull(),
	ceilingAmount: numeric("ceiling_amount", { precision: 15, scale:  2 }),
	ceilingPeriod: text("ceiling_period"),
	fixedAmount: numeric("fixed_amount", { precision: 15, scale:  2 }),
	isVariableBySector: boolean("is_variable_by_sector").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_contribution_types_v2_country").using("btree", table.countryCode.asc().nullsLast()),
	unique("contribution_types_v2_country_code_key").on(table.countryCode, table.code),
]);

export const employeeSalaries = pgTable("employee_salaries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	baseSalary: numeric("base_salary", { precision: 15, scale:  2 }).notNull(), // Denormalized for queries/constraints
	currency: text().default('XOF').notNull(),
	allowances: jsonb().default({}).notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	changeReason: text("change_reason"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	payFrequency: text("pay_frequency").default('monthly').notNull(),
	// Single source of truth: components JSONB array
	// Contains SalaryComponentInstance[] with code, name, amount, sourceType, metadata
	// Must always contain base salary component (code '11')
	components: jsonb().default([]).notNull(),
}, (table) => [
	index("idx_employee_salaries_active").using("btree", table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")).where(sql`(effective_to IS NULL)`),
	index("idx_employee_salaries_effective_dates").using("btree", table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_employee_salaries_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_salaries_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_salaries_updated_at").using("btree", table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "employee_salaries_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_salaries_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employee_salaries_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	// ✅ REMOVED: Hardcoded SMIG check (base_salary >= 75000)
	// REASON: Base salary can be below SMIG if gross salary (base + allowances) meets SMIG
	// VALIDATION: Now handled in gross-calculation.ts which validates gross salary
	check("valid_pay_frequency", sql`pay_frequency = ANY (ARRAY['monthly'::text, 'biweekly'::text, 'weekly'::text])`),
]);

export const salaryReviews = pgTable("salary_reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	currentSalary: numeric("current_salary", { precision: 15, scale: 2 }).notNull(),
	proposedSalary: numeric("proposed_salary", { precision: 15, scale: 2 }).notNull(),
	proposedAllowances: jsonb("proposed_allowances").default({}).notNull(),
	effectiveFrom: date("effective_from").notNull(),
	reason: text().notNull(),
	justification: text(),
	status: text().default('pending').notNull(),
	requestedBy: uuid("requested_by").notNull(),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_salary_reviews_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_salary_reviews_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_salary_reviews_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "salary_reviews_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [users.id],
			name: "salary_reviews_requested_by_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "salary_reviews_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "salary_reviews_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_status_salary_review", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])`),
]);

export const salaryBands = pgTable("salary_bands", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	code: text().notNull(),
	jobLevel: text("job_level").notNull(),
	minSalary: numeric("min_salary", { precision: 15, scale: 2 }).notNull(),
	midSalary: numeric("mid_salary", { precision: 15, scale: 2 }).notNull(),
	maxSalary: numeric("max_salary", { precision: 15, scale: 2 }).notNull(),
	currency: text(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	isActive: boolean("is_active"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_salary_bands_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "salary_bands_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_salary_band_code").on(table.tenantId, table.code),
]);

export const bulkSalaryAdjustments = pgTable("bulk_salary_adjustments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	adjustmentType: text("adjustment_type").notNull(),
	adjustmentValue: numeric("adjustment_value", { precision: 15, scale: 2 }),
	adjustmentPercentage: numeric("adjustment_percentage", { precision: 5, scale: 2 }),
	effectiveFrom: date("effective_from").notNull(),
	reason: text().notNull(),
	status: text().default('draft').notNull(),
	createdBy: uuid("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	executedBy: uuid("executed_by"),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_bulk_adjustments_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_bulk_adjustments_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "bulk_salary_adjustments_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "bulk_salary_adjustments_created_by_fkey"
		}),
	foreignKey({
			columns: [table.executedBy],
			foreignColumns: [users.id],
			name: "bulk_salary_adjustments_executed_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bulk_salary_adjustments_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_adjustment_type", sql`adjustment_type = ANY (ARRAY['flat'::text, 'percentage'::text])`),
	check("valid_status_bulk", sql`status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'executed'::text, 'cancelled'::text])`),
]);

export const bulkAdjustmentItems = pgTable("bulk_adjustment_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bulkAdjustmentId: uuid("bulk_adjustment_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	currentSalary: numeric("current_salary", { precision: 15, scale: 2 }).notNull(),
	proposedSalary: numeric("proposed_salary", { precision: 15, scale: 2 }).notNull(),
	adjustmentAmount: numeric("adjustment_amount", { precision: 15, scale: 2 }).notNull(),
	status: text().default('pending').notNull(),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_bulk_items_adjustment").using("btree", table.bulkAdjustmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_bulk_items_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.bulkAdjustmentId],
			foreignColumns: [bulkSalaryAdjustments.id],
			name: "bulk_adjustment_items_bulk_adjustment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "bulk_adjustment_items_employee_id_fkey"
		}).onDelete("cascade"),
	unique("unique_employee_per_adjustment").on(table.bulkAdjustmentId, table.employeeId),
	check("valid_status_item", sql`status = ANY (ARRAY['pending'::text, 'executed'::text, 'failed'::text, 'skipped'::text])`),
]);

export const sectorContributionOverrides = pgTable("sector_contribution_overrides", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contributionTypeId: uuid("contribution_type_id").notNull(),
	sectorCode: varchar("sector_code", { length: 50 }).notNull(),
	sectorName: jsonb("sector_name").notNull(),
	employerRate: numeric("employer_rate", { precision: 6, scale:  4 }).notNull(),
	riskLevel: varchar("risk_level", { length: 20 }),
}, (table) => [
	foreignKey({
			columns: [table.contributionTypeId],
			foreignColumns: [contributionTypes.id],
			name: "sector_contribution_overrides_contribution_type_id_fkey"
		}).onDelete("cascade"),
	unique("sector_contribution_overrides_contribution_type_id_sector_c_key").on(table.contributionTypeId, table.sectorCode),
]);

export const otherTaxes = pgTable("other_taxes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	taxRate: numeric("tax_rate", { precision: 6, scale:  4 }).notNull(),
	calculationBase: varchar("calculation_base", { length: 50 }).notNull(),
	paidBy: varchar("paid_by", { length: 20 }).notNull(),
	appliesToEmployeeType: varchar("applies_to_employee_type", { length: 20 }),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_other_taxes_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_other_taxes_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("text_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "other_taxes_country_code_fkey"
		}),
	unique("other_taxes_country_code_code_effective_from_key").on(table.countryCode, table.code, table.effectiveFrom),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
	check("chk_paid_by", sql`(paid_by)::text = ANY ((ARRAY['employer'::character varying, 'employee'::character varying, 'shared'::character varying])::text[])`),
	check("chk_tax_rate_valid", sql`(tax_rate >= (0)::numeric) AND (tax_rate <= (1)::numeric)`),
]);

export const payrollRuns = pgTable("payroll_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	runNumber: text("run_number").notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	payDate: date("pay_date").notNull(),
	paymentMethod: text("payment_method").default('bank_transfer').notNull(),
	countryCode: text("country_code").notNull(),
	status: text().default('draft').notNull(),
	totalGross: numeric("total_gross", { precision: 15, scale:  2 }),
	totalNet: numeric("total_net", { precision: 15, scale:  2 }),
	totalTax: numeric("total_tax", { precision: 15, scale:  2 }),
	totalEmployeeContributions: numeric("total_employee_contributions", { precision: 15, scale:  2 }),
	totalEmployerContributions: numeric("total_employer_contributions", { precision: 15, scale:  2 }),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	processedBy: uuid("processed_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
	name: text(),
	description: text(),
	calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: 'string' }),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	approvedBy: uuid("approved_by"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	employeeCount: integer("employee_count"),
	// Daily workers fields (Phase 5)
	paymentFrequency: varchar("payment_frequency", { length: 20 }).default('MONTHLY'),
	closureSequence: integer("closure_sequence"), // 1-4 for weekly, 1-2 for biweekly, null for monthly
}, (table) => [
	index("idx_payroll_runs_pay_date").using("btree", table.payDate.asc().nullsLast().op("date_ops")),
	index("idx_payroll_runs_period").using("btree", table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("date_ops")),
	index("idx_payroll_runs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_payroll_runs_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "payroll_runs_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "payroll_runs_created_by_fkey"
		}),
	foreignKey({
			columns: [table.processedBy],
			foreignColumns: [users.id],
			name: "payroll_runs_processed_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payroll_runs_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "payroll_runs_updated_by_fkey"
		}),
	unique("unique_run_number").on(table.tenantId, table.runNumber),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_status_payroll", sql`status = ANY (ARRAY['draft'::text, 'calculating'::text, 'calculated'::text, 'approved'::text, 'paid'::text, 'failed'::text])`),
]);

export const payrollLineItems = pgTable("payroll_line_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	payrollRunId: uuid("payroll_run_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	baseSalary: numeric("base_salary", { precision: 15, scale:  2 }).notNull(),
	allowances: jsonb().default({}).notNull(),
	daysWorked: numeric("days_worked", { precision: 5, scale:  2 }).notNull(),
	daysAbsent: numeric("days_absent", { precision: 5, scale:  2 }).default('0').notNull(),
	overtimeHours: jsonb("overtime_hours").default({}).notNull(),
	grossSalary: numeric("gross_salary", { precision: 15, scale:  2 }).notNull(),
	taxDeductions: jsonb("tax_deductions").default({}).notNull(),
	employeeContributions: jsonb("employee_contributions").default({}).notNull(),
	otherDeductions: jsonb("other_deductions").default({}).notNull(),
	totalDeductions: numeric("total_deductions", { precision: 15, scale:  2 }).notNull(),
	netSalary: numeric("net_salary", { precision: 15, scale:  2 }).notNull(),
	employerContributions: jsonb("employer_contributions").default({}).notNull(),
	totalEmployerCost: numeric("total_employer_cost", { precision: 15, scale:  2 }).notNull(),
	paymentMethod: text("payment_method").default('bank_transfer').notNull(),
	bankAccount: text("bank_account"),
	paymentReference: text("payment_reference"),
	status: text().default('pending').notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	employeeName: text("employee_name"),
	employeeNumber: text("employee_number"),
	positionTitle: text("position_title"),
	overtimePay: numeric("overtime_pay", { precision: 15, scale:  2 }).default('0'),
	bonuses: numeric({ precision: 15, scale:  2 }).default('0'),
	earningsDetails: jsonb("earnings_details").default([]).notNull(),
	deductionsDetails: jsonb("deductions_details").default([]).notNull(),
	cnpsEmployee: numeric("cnps_employee", { precision: 15, scale:  2 }),
	cmuEmployee: numeric("cmu_employee", { precision: 15, scale:  2 }),
	its: numeric({ precision: 15, scale:  2 }),
	cnpsEmployer: numeric("cnps_employer", { precision: 15, scale:  2 }),
	cmuEmployer: numeric("cmu_employer", { precision: 15, scale:  2 }),
	totalOtherTaxes: numeric("total_other_taxes", { precision: 15, scale:  2 }).default('0'),
	otherTaxesDetails: jsonb("other_taxes_details").default([]).notNull(),
	paymentStatus: text("payment_status").default('pending').notNull(),
	employerCost: numeric("employer_cost", { precision: 15, scale:  2 }),
}, (table) => [
	index("idx_payroll_line_items_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_line_items_run").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_line_items_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_payroll_line_items_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "payroll_line_items_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.payrollRunId],
			foreignColumns: [payrollRuns.id],
			name: "payroll_line_items_payroll_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payroll_line_items_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_employee_per_run").on(table.payrollRunId, table.employeeId),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_payment_status", sql`payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text])`),
]);

export const salaryComponentDefinitions = pgTable("salary_component_definitions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	templateCode: varchar("template_code", { length: 50 }),
	name: jsonb().notNull(),
	category: varchar({ length: 50 }).notNull(),
	componentType: varchar("component_type", { length: 50 }).notNull(),
	isTaxable: boolean("is_taxable").default(true).notNull(),
	isSubjectToSocialSecurity: boolean("is_subject_to_social_security").default(true).notNull(),
	calculationMethod: varchar("calculation_method", { length: 50 }),
	defaultValue: numeric("default_value", { precision: 15, scale:  2 }),
	displayOrder: integer("display_order").default(0).notNull(),
	isCommon: boolean("is_common").default(false).notNull(),
	isPopular: boolean("is_popular").default(false),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_salary_components_category").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops")),
	index("idx_salary_components_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "salary_component_definitions_country_code_fkey"
		}),
	unique("salary_component_definitions_country_code_code_key").on(table.countryCode, table.code),
	check("chk_category", sql`(category)::text = ANY ((ARRAY['allowance'::character varying, 'bonus'::character varying, 'deduction'::character varying])::text[])`),
]);

export const salaryComponentTemplates = pgTable("salary_component_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	description: text(),
	category: varchar({ length: 50 }).notNull(),
	metadata: jsonb().default({}).notNull(),
	suggestedAmount: numeric("suggested_amount", { precision: 15, scale: 2 }),
	isPopular: boolean("is_popular").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	// Compliance fields
	complianceLevel: text("compliance_level").default('freeform'),
	legalReference: text("legal_reference"),
	customizableFields: jsonb("customizable_fields").default([]).notNull(),
	canDeactivate: boolean("can_deactivate").default(true).notNull(),
	canModify: boolean("can_modify").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_salary_templates_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_salary_templates_popular").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.isPopular.asc().nullsLast().op("bool_ops")).where(sql`(is_popular = true)`),
	index("idx_templates_compliance_level").using("btree", table.complianceLevel.asc().nullsLast().op("text_ops"), table.countryCode.asc().nullsLast().op("text_ops"), table.isPopular.asc().nullsLast().op("bool_ops")),
	index("idx_templates_legal_ref").using("btree", table.legalReference.asc().nullsLast().op("text_ops")).where(sql`(legal_reference IS NOT NULL)`),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "salary_component_templates_country_code_fkey"
		}),
	unique("salary_component_templates_country_code_code_key").on(table.countryCode, table.code),
	check("chk_template_category", sql`(category)::text = ANY ((ARRAY['allowance'::character varying, 'bonus'::character varying, 'deduction'::character varying])::text[])`),
	check("chk_compliance_level", sql`(compliance_level)::text = ANY ((ARRAY['locked'::text, 'configurable'::text, 'freeform'::text]))`),
]);

export const customSalaryComponents = pgTable("custom_salary_components", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: text().notNull(),
	description: text(),
	templateCode: varchar("template_code", { length: 50 }),
	metadata: jsonb().default({}).notNull(),
	// Compliance metadata (copied from template)
	complianceLevel: varchar("compliance_level", { length: 20 }).default('freeform'),
	customizableFields: jsonb("customizable_fields").default([]),
	canModify: boolean("can_modify").default(true),
	canDeactivate: boolean("can_deactivate").default(true),
	legalReference: text("legal_reference"),
	isActive: boolean("is_active").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_custom_components_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_custom_components_active").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "custom_salary_components_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "custom_salary_components_created_by_fkey"
		}),
	unique("custom_salary_components_tenant_id_country_code_code_key").on(table.tenantId, table.countryCode, table.code),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
]);

// ============================================================================
// Tenant Salary Component Activations (Option B Architecture)
// ============================================================================
// Tenant activations of templates with customization overrides
// Single source of truth: template defines law, activation defines choice
export const tenantSalaryComponentActivations = pgTable("tenant_salary_component_activations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	templateCode: varchar("template_code", { length: 50 }).notNull(),

	// Overrides (ONLY customizable fields from template)
	overrides: jsonb().default({}).notNull(),

	// Tenant-specific metadata
	customName: text("custom_name"), // Optional: override display name
	isActive: boolean("is_active").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),

	// Audit
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_activations_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_activations_active").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_salary_component_activations_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "tenant_salary_component_activations_created_by_fkey"
		}),
	unique("tenant_salary_component_activations_tenant_country_template_key").on(table.tenantId, table.countryCode, table.templateCode),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
]);

export const salaryComponentFormulaVersions = pgTable("salary_component_formula_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	componentId: uuid("component_id").notNull(),
	componentType: text("component_type").notNull(),
	versionNumber: integer("version_number").notNull(),
	calculationRule: jsonb("calculation_rule").notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	changedBy: uuid("changed_by"),
	changeReason: text("change_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_formula_active_at").using("btree", table.componentId.asc().nullsLast().op("uuid_ops"), table.componentType.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")).where(sql`(effective_to IS NULL OR effective_to >= CURRENT_DATE)`),
	index("idx_formula_component_history").using("btree", table.componentId.asc().nullsLast().op("uuid_ops"), table.componentType.asc().nullsLast().op("text_ops"), table.versionNumber.desc().nullsLast().op("int4_ops")),
	index("idx_formula_audit").using("btree", table.changedBy.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [users.id],
			name: "salary_component_formula_versions_changed_by_fkey"
		}),
	unique("unique_version").on(table.componentId, table.componentType, table.versionNumber),
	check("component_type_check", sql`component_type IN ('standard', 'custom')`),
	check("valid_date_range", sql`effective_to IS NULL OR effective_to >= effective_from`),
	pgPolicy("Tenants can view their component formula versions", { as: "permissive", for: "select", to: ["public"], using: sql`((component_type = 'custom' AND component_id IN (SELECT id FROM custom_salary_components WHERE tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)) OR component_type = 'standard')` }),
	pgPolicy("Authenticated users can create formula versions", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`auth.role() = 'authenticated'` }),
]);

export const exportTemplates = pgTable("export_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	templateType: varchar("template_type", { length: 50 }).notNull(),
	providerCode: varchar("provider_code", { length: 50 }).notNull(),
	providerName: varchar("provider_name", { length: 200 }).notNull(),
	fileFormat: varchar("file_format", { length: 20 }).notNull(),
	delimiter: varchar({ length: 5 }),
	encoding: varchar({ length: 20 }).default('UTF-8'),
	columns: jsonb().notNull(),
	headers: jsonb(),
	footers: jsonb(),
	filenamePattern: varchar("filename_pattern", { length: 200 }),
	version: varchar({ length: 20 }).default('1.0').notNull(),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	isActive: boolean("is_active").default(true).notNull(),
	description: text(),
	portalUrl: text("portal_url"),
	documentationUrl: text("documentation_url"),
	sampleFileUrl: text("sample_file_url"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_export_templates_active").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("bool_ops"), table.effectiveFrom.asc().nullsLast().op("text_ops"), table.effectiveTo.asc().nullsLast().op("bool_ops")),
	index("idx_export_templates_country_type").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.templateType.asc().nullsLast().op("text_ops")),
	index("idx_export_templates_provider").using("btree", table.providerCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "export_templates_country_code_fkey"
		}),
]);

export const spatialRefSys = pgTable("spatial_ref_sys", {
	srid: integer().notNull(),
	authName: varchar("auth_name", { length: 256 }),
	authSrid: integer("auth_srid"),
	srtext: varchar({ length: 2048 }),
	proj4Text: varchar({ length: 2048 }),
}, (table) => [
	check("spatial_ref_sys_srid_check", sql`(srid > 0) AND (srid <= 998999)`),
]);

export const geofenceConfigs = pgTable("geofence_configs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	latitude: numeric({ precision: 10, scale: 8 }).notNull(),
	longitude: numeric({ precision: 11, scale: 8 }).notNull(),
	radiusMeters: integer("radius_meters").default(100).notNull(),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_geofence_configs_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_geofence_configs_active").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`is_active = true`),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: "geofence_configs_tenant_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "geofence_configs_created_by_fkey"
	}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
	check("valid_radius", sql`(radius_meters > 0) AND (radius_meters <= 5000)`),
	check("valid_latitude", sql`(latitude >= (-90)) AND (latitude <= 90)`),
	check("valid_longitude", sql`(longitude >= (-180)) AND (longitude <= 180)`),
]);

export const overtimeRules = pgTable("overtime_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	ruleType: text("rule_type").notNull(),
	displayName: jsonb("display_name").notNull(),
	description: jsonb(),
	multiplier: numeric({ precision: 4, scale: 2 }).notNull(),
	minHoursPerDay: numeric("min_hours_per_day", { precision: 4, scale: 2 }),
	maxHoursPerDay: numeric("max_hours_per_day", { precision: 4, scale: 2 }),
	maxHoursPerWeek: numeric("max_hours_per_week", { precision: 5, scale: 2 }),
	maxHoursPerMonth: numeric("max_hours_per_month", { precision: 6, scale: 2 }),
	appliesFromTime: text("applies_from_time"), // TIME type stored as text
	appliesToTime: text("applies_to_time"), // TIME type stored as text
	appliesToDays: jsonb("applies_to_days"),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_overtime_rules_country_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_overtime_rules_type").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.ruleType.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.countryCode],
		foreignColumns: [countries.code],
		name: "overtime_rules_country_code_fkey"
	}).onDelete("restrict"),
	check("valid_multiplier", sql`(multiplier >= 1.0) AND (multiplier <= 3.0)`),
	check("valid_rule_type", sql`rule_type = ANY (ARRAY['hours_41_to_46'::text, 'hours_above_46'::text, 'night_work'::text, 'weekend'::text, 'saturday'::text, 'sunday'::text, 'holiday'::text, 'public_holiday'::text])`),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
]);

export const publicHolidays = pgTable("public_holidays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	holidayDate: date("holiday_date").notNull(),
	name: jsonb().notNull(), // { fr: "Jour de l'An", en: "New Year's Day" }
	description: jsonb(),
	isRecurring: boolean("is_recurring").default(true),
	isPaid: boolean("is_paid").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_public_holidays_country_code").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_public_holidays_date").using("btree", table.holidayDate.asc().nullsLast().op("date_ops")),
	index("idx_public_holidays_country_date").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.holidayDate.asc().nullsLast().op("date_ops")),
	foreignKey({
		columns: [table.countryCode],
		foreignColumns: [countries.code],
		name: "public_holidays_country_code_fkey"
	}).onDelete("restrict"),
	unique("unique_country_holiday_date").on(table.countryCode, table.holidayDate),
	pgPolicy("public_holidays_read_all", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
]);

export const timeEntries = pgTable("time_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	clockIn: timestamp("clock_in", { withTimezone: true, mode: 'string' }).notNull(),
	clockOut: timestamp("clock_out", { withTimezone: true, mode: 'string' }),
	totalHours: numeric("total_hours", { precision: 5, scale:  2 }),
	entrySource: text("entry_source").default('clock_in_out').notNull(),
	locationId: uuid("location_id"),
	// TODO: failed to parse database type 'geography' - using text as workaround
	clockInLocation: text("clock_in_location"),
	// TODO: failed to parse database type 'geography' - using text as workaround
	clockOutLocation: text("clock_out_location"),
	geofenceVerified: boolean("geofence_verified").default(false),
	clockInPhotoUrl: text("clock_in_photo_url"),
	clockOutPhotoUrl: text("clock_out_photo_url"),
	entryType: text("entry_type").default('regular').notNull(),
	overtimeBreakdown: jsonb("overtime_breakdown").default({}),
	status: text().default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_time_entries_employee").using("btree", table.employeeId.asc().nullsLast().op("timestamptz_ops"), table.clockIn.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_time_entries_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_time_entries_entry_source").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.entrySource.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "time_entries_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "time_entries_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "time_entries_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_entry_type", sql`entry_type = ANY (ARRAY['regular'::text, 'overtime'::text, 'on_call'::text])`),
	check("valid_status_time_entry", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
	check("valid_time", sql`(clock_out IS NULL) OR (clock_out > clock_in)`),
	check("check_entry_source", sql`entry_source IN ('clock_in_out', 'manual')`),
]);

// Time Entries Relations
export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
	tenant: one(tenants, {
		fields: [timeEntries.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [timeEntries.employeeId],
		references: [employees.id],
	}),
	approvedByUser: one(users, {
		fields: [timeEntries.approvedBy],
		references: [users.id],
	}),
}));

export const timeOffPolicies = pgTable("time_off_policies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	policyType: text("policy_type").notNull(),
	accrualMethod: text("accrual_method").notNull(),
	accrualRate: numeric("accrual_rate", { precision: 5, scale:  2 }),
	maxBalance: numeric("max_balance", { precision: 5, scale:  2 }),
	requiresApproval: boolean("requires_approval").default(true).notNull(),
	advanceNoticeDays: integer("advance_notice_days").default(0),
	minDaysPerRequest: numeric("min_days_per_request", { precision: 3, scale:  1 }).default('0.5'),
	maxDaysPerRequest: numeric("max_days_per_request", { precision: 5, scale:  1 }),
	blackoutPeriods: jsonb("blackout_periods").default([]),
	isPaid: boolean("is_paid").default(true).notNull(),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "time_off_policies_created_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "time_off_policies_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_accrual_method", sql`accrual_method = ANY (ARRAY['fixed'::text, 'accrued_monthly'::text, 'accrued_hourly'::text])`),
	check("valid_policy_type", sql`policy_type = ANY (ARRAY['annual_leave'::text, 'sick_leave'::text, 'maternity'::text, 'paternity'::text, 'unpaid'::text])`),
]);

export const timeOffBalances = pgTable("time_off_balances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	policyId: uuid("policy_id").notNull(),
	balance: numeric({ precision: 5, scale:  2 }).default('0').notNull(),
	used: numeric({ precision: 5, scale:  2 }).default('0').notNull(),
	pending: numeric({ precision: 5, scale:  2 }).default('0').notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	lastAccrualDate: date("last_accrual_date"),
	expiresAt: date("expires_at"), // 6-month carryover limit (Article 28)
	metadata: jsonb().default({}).notNull(), // Track expired balances, carryover history
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "time_off_balances_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.policyId],
			foreignColumns: [timeOffPolicies.id],
			name: "time_off_balances_policy_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "time_off_balances_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_employee_policy_period").on(table.employeeId, table.policyId, table.periodStart),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const timeOffRequests = pgTable("time_off_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	policyId: uuid("policy_id").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	totalDays: numeric("total_days", { precision: 4, scale:  1 }).notNull(),
	reason: text(),
	notes: text(),
	status: text().default('pending').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_timeoff_requests_employee").using("btree", table.employeeId.asc().nullsLast().op("date_ops"), table.startDate.desc().nullsFirst().op("date_ops")),
	index("idx_timeoff_requests_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "time_off_requests_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.policyId],
			foreignColumns: [timeOffPolicies.id],
			name: "time_off_requests_policy_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewedBy],
			foreignColumns: [users.id],
			name: "time_off_requests_reviewed_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "time_off_requests_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_dates", sql`start_date <= end_date`),
	check("valid_status_request", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])`),
]);

// Time-Off Relations
export const timeOffPoliciesRelations = relations(timeOffPolicies, ({ one, many }) => ({
	tenant: one(tenants, {
		fields: [timeOffPolicies.tenantId],
		references: [tenants.id],
	}),
	createdByUser: one(users, {
		fields: [timeOffPolicies.createdBy],
		references: [users.id],
	}),
	balances: many(timeOffBalances),
	requests: many(timeOffRequests),
}));

export const timeOffBalancesRelations = relations(timeOffBalances, ({ one }) => ({
	tenant: one(tenants, {
		fields: [timeOffBalances.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [timeOffBalances.employeeId],
		references: [employees.id],
	}),
	policy: one(timeOffPolicies, {
		fields: [timeOffBalances.policyId],
		references: [timeOffPolicies.id],
	}),
}));

export const timeOffRequestsRelations = relations(timeOffRequests, ({ one }) => ({
	tenant: one(tenants, {
		fields: [timeOffRequests.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [timeOffRequests.employeeId],
		references: [employees.id],
	}),
	policy: one(timeOffPolicies, {
		fields: [timeOffRequests.policyId],
		references: [timeOffPolicies.id],
	}),
	reviewedByUser: one(users, {
		fields: [timeOffRequests.reviewedBy],
		references: [users.id],
	}),
}));

export const events = pgTable("events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	eventType: text("event_type").notNull(),
	tenantId: uuid("tenant_id"),
	aggregateId: uuid("aggregate_id"),
	data: jsonb().notNull(),
	metadata: jsonb().default({}).notNull(),
	correlationId: uuid("correlation_id"),
	causationId: uuid("causation_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_events_aggregate").using("btree", table.aggregateId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("idx_events_tenant").using("btree", table.tenantId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_events_type").using("btree", table.eventType.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "events_created_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "events_tenant_id_fkey"
		}),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	userId: uuid("user_id"),
	userEmail: text("user_email").notNull(),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id"),
	oldValues: jsonb("old_values"),
	newValues: jsonb("new_values"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	requestId: uuid("request_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit_entity").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_audit_tenant_time").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_audit_user").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "audit_logs_tenant_id_fkey"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "audit_logs_user_id_fkey"
		}),
]);

// NOTE: Views below (geography_columns, geometry_columns) are PostGIS system views
// They are NOT exported to prevent Drizzle initialization issues
// If you need them, query them directly with raw SQL
// NOTE: workflows and workflowInstances are imported from @/lib/db/schema/workflows

export const complianceRules = pgTable("compliance_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: text("country_code").notNull(),
	ruleType: text("rule_type").notNull(),
	isMandatory: boolean("is_mandatory").default(true).notNull(),
	canExceed: boolean("can_exceed").default(false),
	legalReference: text("legal_reference").notNull(),
	validationLogic: jsonb("validation_logic").notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_compliance_rules_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_compliance_rules_type").using("btree", table.ruleType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "compliance_rules_country_code_fkey"
		}),
	pgPolicy("public_read_compliance_rules", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true`  }),
	pgPolicy("super_admins_manage_compliance_rules", { as: "permissive", for: "all", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'::text)`, withCheck: sql`EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'::text)`  }),
	check("valid_rule_type", sql`rule_type = ANY (ARRAY['minimum_wage'::text, 'seniority_bonus'::text, 'notice_period'::text, 'severance'::text, 'annual_leave'::text, 'maternity_leave'::text, 'overtime_rate'::text, 'transport_exemption'::text, 'housing_allowance_range'::text, 'hazard_pay_range'::text])`),
]);

// ============================================================================
// Payslips Schema
// ============================================================================

export const payslips = pgTable("payslips", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),

	// Period
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	paymentDate: date("payment_date").notNull(),

	// Amounts (FCFA, stored as numeric for precision)
	grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).notNull(),
	netSalary: numeric("net_salary", { precision: 12, scale: 2 }).notNull(),
	employerContributions: numeric("employer_contributions", { precision: 12, scale: 2 }).default("0").notNull(),

	// Breakdown (JSONB for flexibility)
	salaryComponents: jsonb("salary_components").default([]).notNull(), // [{component_id, name, type, amount, taxable}]
	deductions: jsonb("deductions").default([]).notNull(),        // [{type, name, amount, rate}]
	employerCosts: jsonb("employer_costs").default([]).notNull(),    // [{type, name, amount, rate}]

	// Metadata
	status: text().default('draft').notNull(), // draft, finalized, paid
	pdfUrl: text("pdf_url"),
	finalizedAt: timestamp("finalized_at", { withTimezone: true, mode: 'string' }),
	finalizedBy: uuid("finalized_by"),

	// Lifecycle
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payslips_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_payslips_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payslips_period").using("btree", table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("date_ops")),
	index("idx_payslips_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payslips_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "payslips_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.finalizedBy],
			foreignColumns: [users.id],
			name: "payslips_finalized_by_fkey"
		}),
	pgPolicy("payslips_tenant_isolation", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_status", sql`status = ANY (ARRAY['draft'::text, 'finalized'::text, 'paid'::text])`),
	check("valid_amounts", sql`(gross_salary >= 0::numeric) AND (net_salary >= 0::numeric) AND (employer_contributions >= 0::numeric)`),
]);

export const payslipsRelations = relations(payslips, ({ one }) => ({
	tenant: one(tenants, {
		fields: [payslips.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [payslips.employeeId],
		references: [employees.id],
	}),
	finalizedByUser: one(users, {
		fields: [payslips.finalizedBy],
		references: [users.id],
	}),
}));

// ============================================================================
// Geofence Configurations Schema
// ============================================================================

export const geofenceConfigurations = pgTable("geofence_configurations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),

	// Location
	name: text().notNull(),
	description: text(),
	latitude: numeric({ precision: 10, scale: 8 }).notNull(),
	longitude: numeric({ precision: 11, scale: 8 }).notNull(),
	radiusMeters: integer("radius_meters").default(100).notNull(),

	// Scope
	isActive: boolean("is_active").default(true).notNull(),
	appliesToAll: boolean("applies_to_all").default(true).notNull(),

	// Lifecycle
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_geofence_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_geofence_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "geofence_configurations_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("geofence_tenant_isolation", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_latitude", sql`(latitude >= '-90'::numeric) AND (latitude <= '90'::numeric)`),
	check("valid_longitude", sql`(longitude >= '-180'::numeric) AND (longitude <= '180'::numeric)`),
	check("valid_radius", sql`(radius_meters > 0) AND (radius_meters <= 10000)`),
]);

export const geofenceEmployeeAssignments = pgTable("geofence_employee_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	geofenceId: uuid("geofence_id").notNull(),
	employeeId: uuid("employee_id").notNull(),

	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_geofence_assignments_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.geofenceId],
			foreignColumns: [geofenceConfigurations.id],
			name: "geofence_employee_assignments_geofence_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "geofence_employee_assignments_employee_id_fkey"
		}).onDelete("cascade"),
	unique("unique_geofence_employee").on(table.geofenceId, table.employeeId),
	pgPolicy("geofence_assignments_tenant_isolation", { as: "permissive", for: "all", to: ["authenticated"], using: sql`EXISTS (SELECT 1 FROM geofence_configurations gc WHERE gc.id = geofence_employee_assignments.geofence_id AND gc.tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`, withCheck: sql`EXISTS (SELECT 1 FROM geofence_configurations gc WHERE gc.id = geofence_employee_assignments.geofence_id AND gc.tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const geofenceEmployeeAssignmentsRelations = relations(geofenceEmployeeAssignments, ({ one }) => ({
	geofence: one(geofenceConfigurations, {
		fields: [geofenceEmployeeAssignments.geofenceId],
		references: [geofenceConfigurations.id],
	}),
	employee: one(employees, {
		fields: [geofenceEmployeeAssignments.employeeId],
		references: [employees.id],
	}),
}));

export const geofenceConfigurationsRelations = relations(geofenceConfigurations, ({ one, many }) => ({
	tenant: one(tenants, {
		fields: [geofenceConfigurations.tenantId],
		references: [tenants.id],
	}),
	employeeAssignments: many(geofenceEmployeeAssignments),
}));

// ============================================================================
// CDD Compliance Tracking Schema
// ============================================================================

export const employmentContracts = pgTable("employment_contracts", {
	// IMPORTANT: Column order MUST match database for Drizzle inserts to work
	// Database column order (from migrations):
	// id, tenant_id, employee_id, contract_type, start_date, end_date, renewal_count,
	// is_active, created_at, contract_number, termination_date, termination_reason,
	// original_contract_id, replaces_contract_id, cdd_reason, cdd_total_duration_months,
	// signed_date, contract_file_url, notes, updated_at, created_by, cddti_task_description

	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	contractType: varchar("contract_type", { length: 50 }).notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	renewalCount: integer("renewal_count").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	contractNumber: varchar("contract_number", { length: 50 }),
	terminationDate: date("termination_date"),
	terminationReason: varchar("termination_reason", { length: 255 }),
	originalContractId: uuid("original_contract_id"),
	replacesContractId: uuid("replaces_contract_id"),
	cddReason: varchar("cdd_reason", { length: 255 }),
	cddTotalDurationMonths: integer("cdd_total_duration_months"),
	signedDate: date("signed_date"),
	contractFileUrl: text("contract_file_url"),
	notes: text(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	cddtiTaskDescription: text("cddti_task_description"), // Required by Article 4 Convention Collective
}, (table) => [
	index("idx_contracts_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_contracts_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_contracts_end_date").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.endDate.asc().nullsLast().op("date_ops")).where(sql`contract_type = 'CDD' AND is_active = true`),
	index("idx_contracts_original").using("btree", table.originalContractId.asc().nullsLast().op("uuid_ops")).where(sql`original_contract_id IS NOT NULL`),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: "employment_contracts_tenant_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.employeeId],
		foreignColumns: [employees.id],
		name: "employment_contracts_employee_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.originalContractId],
		foreignColumns: [table.id],
		name: "employment_contracts_original_contract_id_fkey"
	}),
	foreignKey({
		columns: [table.replacesContractId],
		foreignColumns: [table.id],
		name: "employment_contracts_replaces_contract_id_fkey"
	}),
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "employment_contracts_created_by_fkey"
	}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
	check("valid_contract_type", sql`contract_type IN ('CDI', 'CDD', 'CDDTI', 'INTERIM', 'STAGE')`),
	check("valid_cdd_end_date", sql`(contract_type IN ('CDI', 'CDDTI') AND end_date IS NULL) OR (contract_type IN ('CDD', 'INTERIM', 'STAGE') AND end_date IS NOT NULL)`),
	check("valid_dates", sql`end_date IS NULL OR end_date > start_date`),
	check("valid_renewal_count", sql`renewal_count >= 0 AND renewal_count <= 2`),
]);

export const contractComplianceAlerts = pgTable("contract_compliance_alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	contractId: uuid("contract_id").notNull(),
	employeeId: uuid("employee_id").notNull(),

	// Alert details
	alertType: varchar("alert_type", { length: 50 }).notNull(),
	alertSeverity: varchar("alert_severity", { length: 20 }).default('warning').notNull(),
	alertDate: date("alert_date").notNull(),
	alertMessage: text("alert_message").notNull(),

	// Alert lifecycle
	isDismissed: boolean("is_dismissed").default(false).notNull(),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }),
	dismissedBy: uuid("dismissed_by"),
	actionTaken: varchar("action_taken", { length: 50 }),

	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_alerts_active").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.alertDate.asc().nullsLast().op("date_ops"), table.isDismissed.asc().nullsLast().op("bool_ops")).where(sql`is_dismissed = false`),
	index("idx_alerts_contract").using("btree", table.contractId.asc().nullsLast().op("uuid_ops")),
	index("idx_alerts_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: "contract_compliance_alerts_tenant_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.contractId],
		foreignColumns: [employmentContracts.id],
		name: "contract_compliance_alerts_contract_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.employeeId],
		foreignColumns: [employees.id],
		name: "contract_compliance_alerts_employee_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.dismissedBy],
		foreignColumns: [users.id],
		name: "contract_compliance_alerts_dismissed_by_fkey"
	}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
	check("valid_alert_type", sql`alert_type IN ('90_day_warning', '60_day_warning', '30_day_warning', '2_year_limit', '2_renewal_limit', 'renewal_warning')`),
	check("valid_alert_severity", sql`alert_severity IN ('info', 'warning', 'critical')`),
	check("valid_action_taken", sql`action_taken IS NULL OR action_taken IN ('converted_to_cdi', 'renewed', 'terminated', 'ignored')`),
]);

export const contractRenewalHistory = pgTable("contract_renewal_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	originalContractId: uuid("original_contract_id").notNull(),
	renewalNumber: integer("renewal_number").notNull(),
	renewalContractId: uuid("renewal_contract_id"),

	// Renewal details
	previousEndDate: date("previous_end_date").notNull(),
	newEndDate: date("new_end_date").notNull(),
	renewalDurationMonths: integer("renewal_duration_months").notNull(),
	cumulativeDurationMonths: integer("cumulative_duration_months").notNull(),
	renewalReason: text("renewal_reason"),

	// Audit
	renewedBy: uuid("renewed_by"),
	renewedAt: timestamp("renewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_renewal_history_original").using("btree", table.originalContractId.asc().nullsLast().op("uuid_ops"), table.renewalNumber.asc().nullsLast().op("int4_ops")),
	foreignKey({
		columns: [table.originalContractId],
		foreignColumns: [employmentContracts.id],
		name: "contract_renewal_history_original_contract_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.renewalContractId],
		foreignColumns: [employmentContracts.id],
		name: "contract_renewal_history_renewal_contract_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.renewedBy],
		foreignColumns: [users.id],
		name: "contract_renewal_history_renewed_by_fkey"
	}),
	check("valid_renewal_dates", sql`new_end_date > previous_end_date`),
	check("valid_renewal_number", sql`renewal_number > 0`),
	check("valid_duration", sql`renewal_duration_months > 0 AND cumulative_duration_months > 0`),
]);

export const employmentContractsRelations = relations(employmentContracts, ({ one, many }) => ({
	tenant: one(tenants, {
		fields: [employmentContracts.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [employmentContracts.employeeId],
		references: [employees.id],
	}),
	originalContract: one(employmentContracts, {
		fields: [employmentContracts.originalContractId],
		references: [employmentContracts.id],
		relationName: "contractRenewals",
	}),
	replacesContract: one(employmentContracts, {
		fields: [employmentContracts.replacesContractId],
		references: [employmentContracts.id],
	}),
	renewals: many(employmentContracts, {
		relationName: "contractRenewals",
	}),
	alerts: many(contractComplianceAlerts),
	renewalHistory: many(contractRenewalHistory),
	createdByUser: one(users, {
		fields: [employmentContracts.createdBy],
		references: [users.id],
	}),
}));

export const contractComplianceAlertsRelations = relations(contractComplianceAlerts, ({ one }) => ({
	tenant: one(tenants, {
		fields: [contractComplianceAlerts.tenantId],
		references: [tenants.id],
	}),
	contract: one(employmentContracts, {
		fields: [contractComplianceAlerts.contractId],
		references: [employmentContracts.id],
	}),
	employee: one(employees, {
		fields: [contractComplianceAlerts.employeeId],
		references: [employees.id],
	}),
	dismissedByUser: one(users, {
		fields: [contractComplianceAlerts.dismissedBy],
		references: [users.id],
	}),
}));

export const contractRenewalHistoryRelations = relations(contractRenewalHistory, ({ one }) => ({
	originalContract: one(employmentContracts, {
		fields: [contractRenewalHistory.originalContractId],
		references: [employmentContracts.id],
	}),
	renewalContract: one(employmentContracts, {
		fields: [contractRenewalHistory.renewalContractId],
		references: [employmentContracts.id],
	}),
	renewedByUser: one(users, {
		fields: [contractRenewalHistory.renewedBy],
		references: [users.id],
	}),
}));

// ============================================================================
// Employee Benefits Management System
// ============================================================================

export const benefitPlans = pgTable("benefit_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

	// Plan identification
	planName: varchar("plan_name", { length: 255 }).notNull(),
	planCode: varchar("plan_code", { length: 50 }).notNull(),
	benefitType: varchar("benefit_type", { length: 50 }).notNull(), // 'health', 'dental', 'vision', 'life_insurance', 'retirement', 'disability', 'transport', 'meal', 'other'

	// Plan details
	description: text(),
	providerName: varchar("provider_name", { length: 255 }),
	coverageLevel: varchar("coverage_level", { length: 50 }), // 'individual', 'family', 'employee_spouse', 'employee_children'

	// Cost structure
	employeeCost: numeric("employee_cost", { precision: 12, scale: 2 }),
	employerCost: numeric("employer_cost", { precision: 12, scale: 2 }),
	totalCost: numeric("total_cost", { precision: 12, scale: 2 }),
	currency: varchar("currency", { length: 3 }).default('XOF'),
	costFrequency: varchar("cost_frequency", { length: 20 }).default('monthly'), // 'monthly', 'annual', 'per_payroll'

	// Eligibility rules
	eligibleEmployeeTypes: jsonb("eligible_employee_types"), // ['LOCAL', 'EXPAT'] or null for all types
	waitingPeriodDays: integer("waiting_period_days").default(0),
	requiresDependentVerification: boolean("requires_dependent_verification").default(false),

	// Plan lifecycle
	isActive: boolean("is_active").default(true),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),

	// Payroll integration
	linksToSalaryComponentId: uuid("links_to_salary_component_id").references(() => salaryComponentDefinitions.id),

	// Metadata
	customFields: jsonb("custom_fields").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").references(() => users.id),
	updatedBy: uuid("updated_by").references(() => users.id),
}, (table) => [
	index("idx_benefit_plans_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_benefit_plans_type").using("btree", table.benefitType.asc().nullsLast().op("text_ops")),
	index("idx_benefit_plans_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_benefit_plans_effective_dates").using("btree", table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	unique("benefit_plans_tenant_code_unique").on(table.tenantId, table.planCode),
]);

export const employeeBenefitEnrollments = pgTable("employee_benefit_enrollments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
	employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
	benefitPlanId: uuid("benefit_plan_id").notNull().references(() => benefitPlans.id, { onDelete: "restrict" }),

	// Enrollment lifecycle
	enrollmentDate: date("enrollment_date").notNull(),
	effectiveDate: date("effective_date").notNull(),
	terminationDate: date("termination_date"),

	// External enrollment identification
	enrollmentNumber: varchar("enrollment_number", { length: 100 }), // N° CMU for CI
	policyNumber: varchar("policy_number", { length: 100 }),

	// Coverage details
	coverageLevel: varchar("coverage_level", { length: 50 }),
	coveredDependents: jsonb("covered_dependents").default([]).notNull(), // [{dependent_id, name, relationship}]

	// Cost overrides
	employeeCostOverride: numeric("employee_cost_override", { precision: 12, scale: 2 }),
	employerCostOverride: numeric("employer_cost_override", { precision: 12, scale: 2 }),

	// Enrollment status
	enrollmentStatus: varchar("enrollment_status", { length: 50 }).default('active'), // 'active', 'pending', 'terminated', 'suspended'
	terminationReason: varchar("termination_reason", { length: 255 }),

	// Supporting documents
	enrollmentDocumentUrl: text("enrollment_document_url"),
	beneficiaryDesignation: jsonb("beneficiary_designation"), // [{name, relationship, percentage}]

	// Metadata
	notes: text(),
	customFields: jsonb("custom_fields").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by").references(() => users.id),
	updatedBy: uuid("updated_by").references(() => users.id),
}, (table) => [
	index("idx_employee_benefit_enrollments_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_benefit_enrollments_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_benefit_enrollments_plan").using("btree", table.benefitPlanId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_benefit_enrollments_status").using("btree", table.enrollmentStatus.asc().nullsLast().op("text_ops")).where(sql`(enrollment_status = 'active'::text)`),
	index("idx_employee_benefit_enrollments_effective_date").using("btree", table.effectiveDate.asc().nullsLast().op("date_ops")),
	index("idx_employee_benefit_enrollments_enrollment_number").using("btree", table.enrollmentNumber.asc().nullsLast().op("text_ops")).where(sql`(enrollment_number IS NOT NULL)`),
]);

export const employeeBenefitEnrollmentHistory = pgTable("employee_benefit_enrollment_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	enrollmentId: uuid("enrollment_id").notNull().references(() => employeeBenefitEnrollments.id, { onDelete: "cascade" }),

	// What changed
	changeType: varchar("change_type", { length: 50 }).notNull(), // 'enrolled', 'modified', 'terminated', 'cost_changed', 'dependent_added', 'dependent_removed', 'status_changed'
	changeDescription: text("change_description"),

	// Change tracking
	previousValues: jsonb("previous_values"),
	newValues: jsonb("new_values"),

	// When and why
	changeDate: date("change_date").notNull(),
	changeReason: varchar("change_reason", { length: 255 }),
	effectiveDate: date("effective_date").notNull(),

	// Who made the change
	changedBy: uuid("changed_by").references(() => users.id),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_employee_benefit_enrollment_history_enrollment").using("btree", table.enrollmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_benefit_enrollment_history_change_date").using("btree", table.changeDate.asc().nullsLast().op("date_ops")),
]);

export const benefitPlansRelations = relations(benefitPlans, ({ one, many }) => ({
	tenant: one(tenants, {
		fields: [benefitPlans.tenantId],
		references: [tenants.id],
	}),
	salaryComponent: one(salaryComponentDefinitions, {
		fields: [benefitPlans.linksToSalaryComponentId],
		references: [salaryComponentDefinitions.id],
	}),
	enrollments: many(employeeBenefitEnrollments),
	createdByUser: one(users, {
		fields: [benefitPlans.createdBy],
		references: [users.id],
	}),
	updatedByUser: one(users, {
		fields: [benefitPlans.updatedBy],
		references: [users.id],
	}),
}));

export const employeeBenefitEnrollmentsRelations = relations(employeeBenefitEnrollments, ({ one, many }) => ({
	tenant: one(tenants, {
		fields: [employeeBenefitEnrollments.tenantId],
		references: [tenants.id],
	}),
	employee: one(employees, {
		fields: [employeeBenefitEnrollments.employeeId],
		references: [employees.id],
	}),
	benefitPlan: one(benefitPlans, {
		fields: [employeeBenefitEnrollments.benefitPlanId],
		references: [benefitPlans.id],
	}),
	history: many(employeeBenefitEnrollmentHistory),
	createdByUser: one(users, {
		fields: [employeeBenefitEnrollments.createdBy],
		references: [users.id],
	}),
	updatedByUser: one(users, {
		fields: [employeeBenefitEnrollments.updatedBy],
		references: [users.id],
	}),
}));

export const employeeBenefitEnrollmentHistoryRelations = relations(employeeBenefitEnrollmentHistory, ({ one }) => ({
	enrollment: one(employeeBenefitEnrollments, {
		fields: [employeeBenefitEnrollmentHistory.enrollmentId],
		references: [employeeBenefitEnrollments.id],
	}),
	changedByUser: one(users, {
		fields: [employeeBenefitEnrollmentHistory.changedBy],
		references: [users.id],
	}),
}));

// ============================================================================
// Policy Configuration Schema
// ============================================================================

export { overtimeRates, leaveAccrualRules } from '@/lib/db/schema/policies';

// ============================================================================
// Workflow Automation Schema
// ============================================================================

export {
  workflowDefinitions,
  workflowExecutions,
  workflows,
  workflowInstances
} from '@/lib/db/schema/workflows';

export {
  alerts,
  batchOperations,
  payrollEvents,
  alertsRelations,
  batchOperationsRelations,
  payrollEventsRelations
} from '@/lib/db/schema/automation';

// PostGIS system views - NOT EXPORTED
// Commented out to prevent Drizzle schema initialization errors
// If needed, query these views directly with raw SQL

// export const geographyColumns = pgView("geography_columns", {...});
// export const geometryColumns = pgView("geometry_columns", {...});