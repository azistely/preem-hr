import { pgTable, index, unique, uuid, varchar, jsonb, integer, boolean, timestamp, numeric, foreignKey, check, text, date, pgPolicy, type AnyPgColumn, inet, time, uniqueIndex, pgView, pgEnum, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// Custom type for PostGIS geography columns
const geography = customType<{ data: string }>({
  dataType() {
    return 'geography';
  },
});

// Custom type for PostgreSQL name type (used in system views)
const pgName = customType<{ data: string }>({
  dataType() {
    return 'name';
  },
});

export const rateTypeEnum = pgEnum("rate_type_enum", ['MONTHLY', 'DAILY', 'HOURLY'])
export const ruleScopeType = pgEnum("rule_scope_type", ['country', 'location', 'sector', 'tenant', 'employee'])
export const ruleType = pgEnum("rule_type", ['tax.bracket', 'tax.family_deduction', 'contribution.rate', 'contribution.sector_override', 'tax.other', 'component.definition', 'component.formula'])

// STC System Enums
export const departureTypeEnum = pgEnum("departure_type", [
	'FIN_CDD',
	'DEMISSION_CDI',
	'DEMISSION_CDD',
	'LICENCIEMENT',
	'RUPTURE_CONVENTIONNELLE',
	'RETRAITE',
	'DECES'
])

export const noticePeriodStatusEnum = pgEnum("notice_period_status", [
	'worked',
	'paid_by_employer',
	'paid_by_employee',
	'waived'
])

export const licenciementTypeEnum = pgEnum("licenciement_type", [
	'economique',
	'faute_simple',
	'faute_grave',
	'faute_lourde',
	'inaptitude'
])


export const countries = pgTable("countries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 2 }).notNull(),
	name: jsonb().notNull(),
	currencyCode: varchar("currency_code", { length: 3 }).notNull(),
	decimalPlaces: integer("decimal_places").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	minimumWage: numeric("minimum_wage").default('75000'),
}, (table) => [
	index("idx_countries_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	unique("countries_code_key").on(table.code),
]);

export const salaryBands = pgTable("salary_bands", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	code: text().notNull(),
	jobLevel: text("job_level").notNull(),
	minSalary: numeric("min_salary").notNull(),
	midSalary: numeric("mid_salary").notNull(),
	maxSalary: numeric("max_salary").notNull(),
	currency: text().default('XOF'),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_salary_bands_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_salary_bands_job_level").using("btree", table.jobLevel.asc().nullsLast().op("text_ops")),
	index("idx_salary_bands_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "salary_bands_tenant_id_fkey"
		}),
	unique("salary_bands_tenant_id_code_effective_from_key").on(table.tenantId, table.code, table.effectiveFrom),
	check("salary_bands_check", sql`(min_salary < mid_salary) AND (mid_salary < max_salary)`),
]);

export const tenants = pgTable("tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	countryCode: text("country_code").default('CI').notNull(),
	currency: text().default('XOF').notNull(),
	timezone: text().default('Africa/Abidjan').notNull(),
	taxId: text("tax_id"),
	businessRegistration: text("business_registration"),
	industry: text(),
	plan: text().default('trial').notNull(),
	features: jsonb().default([]).notNull(),
	settings: jsonb().default({}).notNull(),
	status: text().default('active').notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	sectorCode: varchar("sector_code", { length: 50 }).notNull(),
	cgeciSectorCode: varchar("cgeci_sector_code", { length: 50 }),
	genericSectorCode: varchar("generic_sector_code", { length: 50 }),
	workAccidentRate: numeric("work_accident_rate", { precision: 5, scale:  4 }).default('0.0200'),
	defaultDailyTransportRate: numeric("default_daily_transport_rate", { precision: 10, scale:  2 }).default('0'),
}, (table) => [
	index("idx_tenants_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_tenants_sector").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.sectorCode.asc().nullsLast().op("text_ops")),
	index("idx_tenants_slug").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("idx_tenants_status").using("btree", table.status.asc().nullsLast().op("text_ops")).where(sql`(status = 'active'::text)`),
	foreignKey({
			columns: [table.countryCode, table.sectorCode],
			foreignColumns: [sectorConfigurations.countryCode, sectorConfigurations.sectorCode],
			name: "fk_tenant_sector"
		}).onUpdate("cascade").onDelete("restrict"),
	unique("tenants_slug_key").on(table.slug),
	pgPolicy("tenant_self_service", { as: "permissive", for: "all", to: ["public"], using: sql`((id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text) OR (auth.jwt() IS NULL))`, withCheck: sql`((auth.jwt() IS NULL) OR (id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`  }),
	check("valid_country", sql`country_code ~ '^[A-Z]{2}$'::text`),
	check("valid_currency", sql`currency ~ '^[A-Z]{3}$'::text`),
	check("valid_plan", sql`plan = ANY (ARRAY['trial'::text, 'starter'::text, 'professional'::text, 'enterprise'::text])`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])`),
]);

export const users: any = pgTable("users", {
	id: uuid().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	activeTenantId: uuid("active_tenant_id"),
	employeeId: uuid("employee_id"),
	email: text(), // Nullable for phone-only users
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	avatarUrl: text("avatar_url"),
	locale: text().default('fr').notNull(),
	role: text().default('employee').notNull(),
	permissions: jsonb().default([]).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	lastLoginIp: inet("last_login_ip"),
	status: text().default('active').notNull(),
	// Phone authentication fields
	phone: text(),
	phoneVerified: boolean("phone_verified").default(false),
	authMethod: text("auth_method").default('email').notNull(),
	mfaEnabled: boolean("mfa_enabled").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_users_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("idx_users_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'active'::text)`),
	index("idx_users_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_users_active_tenant_id").using("btree", table.activeTenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "fk_users_employee"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "users_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.activeTenantId],
			foreignColumns: [tenants.id],
			name: "users_active_tenant_id_fkey"
		}).onDelete("set null"),
	unique("users_email_key").on(table.email),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((auth.jwt() ->> 'role'::text) = 'super_admin'::text) OR (id = ((auth.jwt() ->> 'sub'::text))::uuid) OR (tenant_id IN ( SELECT ut.tenant_id FROM user_tenants ut WHERE (ut.user_id = ((auth.jwt() ->> 'sub'::text))::uuid))) OR (tenant_id = (current_setting('app.tenant_id'::text, true))::uuid))`, withCheck: sql`((auth.jwt() IS NULL) OR (tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`  }),
	check("valid_role", sql`role = ANY (ARRAY['super_admin'::text, 'tenant_admin'::text, 'hr_manager'::text, 'employee'::text])`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])`),
	check("valid_auth_method", sql`auth_method = ANY (ARRAY['email'::text, 'phone'::text])`),
]);

export const userTenants = pgTable("user_tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	role: text().default('hr_manager').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_tenants_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_tenants_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_user_tenants_user_tenant").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_tenants_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "user_tenants_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_user_tenant").on(table.userId, table.tenantId),
]);

export const userTenantSwitches = pgTable("user_tenant_switches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	fromTenantId: uuid("from_tenant_id"),
	toTenantId: uuid("to_tenant_id").notNull(),
	switchedAt: timestamp("switched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
}, (table) => [
	index("idx_tenant_switches_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("idx_tenant_switches_switched_at").using("btree", table.switchedAt.desc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_tenant_switches_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fromTenantId],
			foreignColumns: [tenants.id],
			name: "user_tenant_switches_from_tenant_id_fkey"
		}),
	foreignKey({
			columns: [table.toTenantId],
			foreignColumns: [tenants.id],
			name: "user_tenant_switches_to_tenant_id_fkey"
		}),
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

export const sectorConfigurations = pgTable("sector_configurations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	sectorCode: varchar("sector_code", { length: 50 }).notNull(),
	name: jsonb().notNull(),
	workAccidentRate: numeric("work_accident_rate", { precision: 6, scale:  4 }).notNull(),
	defaultComponents: jsonb("default_components").default({}).notNull(),
	smartDefaults: jsonb("smart_defaults").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_sector_configs_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "sector_configurations_country_code_fkey"
		}),
	unique("sector_configurations_country_code_sector_code_key").on(table.countryCode, table.sectorCode),
]);

export const positions = pgTable("positions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	title: text().notNull(),
	code: text(),
	description: text(),
	departmentId: uuid("department_id"),
	reportsToPositionId: uuid("reports_to_position_id"),
	minSalary: numeric("min_salary", { precision: 15, scale:  2 }),
	maxSalary: numeric("max_salary", { precision: 15, scale:  2 }),
	currency: text().default('XOF').notNull(),
	jobLevel: text("job_level"),
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
	salaryBandId: uuid("salary_band_id"),
	jobFunction: varchar("job_function", { length: 255 }),
	jobTrade: varchar("job_trade", { length: 255 }),
}, (table) => [
	index("idx_positions_department").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_positions_effective").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_positions_job_function").using("btree", table.jobFunction.asc().nullsLast().op("text_ops")),
	index("idx_positions_salary_band").using("btree", table.salaryBandId.asc().nullsLast().op("uuid_ops")),
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
			columns: [table.salaryBandId],
			foreignColumns: [salaryBands.id],
			name: "positions_salary_band_id_fkey"
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

export const overtimeRules = pgTable("overtime_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	ruleType: text("rule_type").notNull(),
	displayName: jsonb("display_name").notNull(),
	description: jsonb(),
	multiplier: numeric({ precision: 4, scale:  2 }).notNull(),
	minHoursPerDay: numeric("min_hours_per_day", { precision: 4, scale:  2 }),
	maxHoursPerDay: numeric("max_hours_per_day", { precision: 4, scale:  2 }),
	maxHoursPerWeek: numeric("max_hours_per_week", { precision: 5, scale:  2 }),
	maxHoursPerMonth: numeric("max_hours_per_month", { precision: 6, scale:  2 }),
	appliesFromTime: time("applies_from_time"),
	appliesToTime: time("applies_to_time"),
	appliesToDays: jsonb("applies_to_days"),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_overtime_rules_country_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")),
	index("idx_overtime_rules_type").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.ruleType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "overtime_rules_country_code_fkey"
		}).onDelete("restrict"),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
	check("valid_multiplier", sql`(multiplier >= 1.0) AND (multiplier <= 3.0)`),
	check("valid_rule_type", sql`rule_type = ANY (ARRAY['hours_41_to_46'::text, 'hours_above_46'::text, 'night_work'::text, 'weekend'::text, 'saturday'::text, 'sunday'::text, 'holiday'::text, 'public_holiday'::text])`),
]);

export const timeOffPolicyTemplates = pgTable("time_off_policy_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	category: varchar({ length: 50 }).notNull(),
	complianceLevel: varchar("compliance_level", { length: 20 }).notNull(),
	legalReference: text("legal_reference"),
	policyType: varchar("policy_type", { length: 50 }).notNull(),
	accrualMethod: varchar("accrual_method", { length: 50 }).notNull(),
	defaultAccrualRate: numeric("default_accrual_rate", { precision: 5, scale:  2 }).notNull(),
	minAccrualRate: numeric("min_accrual_rate", { precision: 5, scale:  2 }),
	maxAccrualRate: numeric("max_accrual_rate", { precision: 5, scale:  2 }),
	specialAccrualRules: jsonb("special_accrual_rules"),
	defaultMaxBalance: numeric("default_max_balance", { precision: 6, scale:  2 }),
	carryoverMonths: integer("carryover_months"),
	isPaid: boolean("is_paid").default(true).notNull(),
	paymentRate: numeric("payment_rate", { precision: 4, scale:  2 }).default('1.0'),
	requiresApproval: boolean("requires_approval").default(true).notNull(),
	advanceNoticeDays: integer("advance_notice_days"),
	minDaysPerRequest: numeric("min_days_per_request", { precision: 4, scale:  1 }),
	maxDaysPerRequest: numeric("max_days_per_request", { precision: 6, scale:  2 }),
	minContinuousDays: integer("min_continuous_days"),
	defaultBlackoutPeriods: jsonb("default_blackout_periods"),
	canDeactivate: boolean("can_deactivate").default(true).notNull(),
	canModifyAccrual: boolean("can_modify_accrual").default(false).notNull(),
	customizableFields: jsonb("customizable_fields"),
	isActive: boolean("is_active").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_time_off_policy_templates_active").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_time_off_policy_templates_compliance").using("btree", table.complianceLevel.asc().nullsLast().op("text_ops")),
	index("idx_time_off_policy_templates_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "time_off_policy_templates_country_code_fkey"
		}).onDelete("restrict"),
	unique("unique_policy_template_per_country").on(table.countryCode, table.code),
	check("time_off_policy_templates_accrual_method_check", sql`(accrual_method)::text = ANY ((ARRAY['accrued_monthly'::character varying, 'accrued_yearly'::character varying, 'fixed'::character varying, 'none'::character varying])::text[])`),
	check("time_off_policy_templates_compliance_level_check", sql`(compliance_level)::text = ANY ((ARRAY['locked'::character varying, 'configurable'::character varying, 'freeform'::character varying])::text[])`),
]);

export const socialSecuritySchemes = pgTable("social_security_schemes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	agencyCode: varchar("agency_code", { length: 10 }).notNull(),
	agencyName: jsonb("agency_name").notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	defaultSectorCode: text("default_sector_code").default('SERVICES'),
}, (table) => [
	index("idx_social_schemes_country_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "social_security_schemes_country_code_fkey"
		}),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
]);

export const employeeTerminations = pgTable("employee_terminations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	terminationDate: date("termination_date").notNull(),
	terminationReason: text("termination_reason").notNull(),
	notes: text(),

	// Core STC fields
	departureType: departureTypeEnum("departure_type").default('LICENCIEMENT').notNull(),
	contractTypeAtTermination: varchar("contract_type_at_termination", { length: 20 }),
	gratificationAmount: numeric("gratification_amount", { precision: 15, scale: 2 }).default('0'),
	gratificationRate: numeric("gratification_rate", { precision: 5, scale: 4 }).default('0.75'),

	// Notice period configuration
	noticePeriodDays: integer("notice_period_days").notNull(),
	noticePaymentAmount: numeric("notice_payment_amount", { precision: 15, scale: 2 }),
	noticePeriodStatus: noticePeriodStatusEnum("notice_period_status").default('worked'),
	noticePeriodMonths: numeric("notice_period_months", { precision: 3, scale: 1 }),
	jobSearchDaysUsed: integer("job_search_days_used").default(0),

	// Indemnities
	severanceAmount: numeric("severance_amount", { precision: 15, scale: 2 }).default('0'),
	vacationPayoutAmount: numeric("vacation_payout_amount", { precision: 15, scale: 2 }).default('0'),
	cddEndIndemnity: numeric("cdd_end_indemnity", { precision: 15, scale: 2 }).default('0'),
	funeralExpenses: numeric("funeral_expenses", { precision: 15, scale: 2 }).default('0'),

	// Calculation metadata
	averageSalary12M: numeric("average_salary_12m", { precision: 15, scale: 2 }),
	yearsOfService: numeric("years_of_service", { precision: 5, scale: 2 }),
	severanceRate: integer("severance_rate"),

	// Specific departure types
	licenciementType: licenciementTypeEnum("licenciement_type"),
	ruptureNegotiatedAmount: numeric("rupture_negotiated_amount", { precision: 15, scale: 2 }),

	// Décès specific
	deathCertificateUrl: text("death_certificate_url"),
	beneficiaries: jsonb().$type<Array<{
		name: string;
		relationship: 'spouse' | 'child' | 'parent' | 'other';
		identityDocument: string;
		bankAccount: string;
		sharePercentage: number;
	}>>().default([]),

	// Documents (uploadedDocuments integration)
	workCertificateDocumentId: uuid("work_certificate_document_id"),
	workCertificateGeneratedAt: timestamp("work_certificate_generated_at", { withTimezone: true, mode: 'string' }),
	workCertificateUrl: text("work_certificate_url"), // Backward compat

	finalPayslipDocumentId: uuid("final_payslip_document_id"),
	finalPayslipGeneratedAt: timestamp("final_payslip_generated_at", { withTimezone: true, mode: 'string' }),
	finalPayslipUrl: text("final_payslip_url"), // Backward compat

	cnpsAttestationDocumentId: uuid("cnps_attestation_document_id"),
	cnpsAttestationGeneratedAt: timestamp("cnps_attestation_generated_at", { withTimezone: true, mode: 'string' }),
	cnpsAttestationUrl: text("cnps_attestation_url"), // Backward compat

	// Workflow
	status: text().default('pending').notNull(),

	// Processing progress tracking (for background Inngest processing)
	processingStatus: text("processing_status").default('idle'), // idle, pending, processing, completed, failed
	processingProgress: integer("processing_progress").default(0), // 0-100%
	processingCurrentStep: text("processing_current_step"), // French labels: "Calcul des indemnités...", etc.
	processingStartedAt: timestamp("processing_started_at", { withTimezone: true, mode: 'string' }),
	processingCompletedAt: timestamp("processing_completed_at", { withTimezone: true, mode: 'string' }),
	processingError: text("processing_error"),
	inngestRunId: text("inngest_run_id"),

	// STC calculation results (populated after background processing completes)
	stcCalculatedAt: timestamp("stc_calculated_at", { withTimezone: true, mode: 'string' }),
	proratedSalary: numeric("prorated_salary", { precision: 15, scale: 2 }),
	totalGross: numeric("total_gross", { precision: 15, scale: 2 }),
	totalNet: numeric("total_net", { precision: 15, scale: 2 }),

	// Audit
	createdBy: uuid("created_by"),
	createdByEmail: text("created_by_email"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedBy: uuid("updated_by"),
	updatedByEmail: text("updated_by_email"),
}, (table) => [
	// Indexes
	index("idx_terminations_date").using("btree", table.terminationDate.asc().nullsLast().op("date_ops")),
	index("idx_terminations_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_terminations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_terminations_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_terminations_departure_type").using("btree", table.departureType.asc().nullsLast()),
	index("idx_terminations_notice_status").using("btree", table.noticePeriodStatus.asc().nullsLast()),
	index("idx_terminations_work_cert_doc").using("btree", table.workCertificateDocumentId.asc().nullsLast()),
	index("idx_terminations_final_payslip_doc").using("btree", table.finalPayslipDocumentId.asc().nullsLast()),
	index("idx_terminations_cnps_doc").using("btree", table.cnpsAttestationDocumentId.asc().nullsLast()),
	index("idx_terminations_processing_status").using("btree", table.tenantId.asc().nullsLast(), table.processingStatus.asc().nullsLast()),

	// Foreign keys
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "employee_terminations_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_terminations_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employee_terminations_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "employee_terminations_updated_by_fkey"
		}),

	// Policies
	pgPolicy("Tenant isolation for terminations", { as: "permissive", for: "all", to: ["public"], using: sql`(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` }),

	// Constraints
	check("positive_notice_period", sql`notice_period_days >= 0`),
	check("positive_severance", sql`severance_amount >= (0)::numeric`),
	check("valid_severance_rate", sql`severance_rate = ANY (ARRAY[0, 30, 35, 40])`),
	check("valid_status", sql`status = ANY (ARRAY['pending'::text, 'notice_period'::text, 'documents_pending'::text, 'completed'::text])`),
	check("valid_termination_reason", sql`termination_reason = ANY (ARRAY['dismissal'::text, 'resignation'::text, 'retirement'::text, 'misconduct'::text, 'contract_end'::text, 'death'::text, 'other'::text])`),
]);

export const historicalPayrollData = pgTable("historical_payroll_data", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	migrationId: uuid("migration_id"),
	employeeNumber: text("employee_number").notNull(),
	employeeName: text("employee_name"),
	payrollPeriod: text("payroll_period").notNull(),
	grossSalary: numeric("gross_salary", { precision: 15, scale:  2 }),
	netSalary: numeric("net_salary", { precision: 15, scale:  2 }),
	cnpsEmployee: numeric("cnps_employee", { precision: 15, scale:  2 }),
	cnpsEmployer: numeric("cnps_employer", { precision: 15, scale:  2 }),
	its: numeric({ precision: 15, scale:  2 }),
	components: jsonb().default({}),
	deductions: jsonb().default({}),
	sourceData: jsonb("source_data"),
	paymentDate: date("payment_date"),
	paymentMethod: text("payment_method"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_historical_payroll_employee").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.employeeNumber.asc().nullsLast().op("text_ops")),
	index("idx_historical_payroll_period").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.payrollPeriod.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.migrationId],
			foreignColumns: [dataMigrations.id],
			name: "historical_payroll_data_migration_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "historical_payroll_data_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("historical_payroll_unique_period").on(table.tenantId, table.employeeNumber, table.payrollPeriod),
	pgPolicy("historical_payroll_data_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
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

export const overtimeRates = pgTable("overtime_rates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	periodType: varchar("period_type", { length: 30 }).notNull(),
	rateMultiplier: numeric("rate_multiplier", { precision: 3, scale:  2 }).notNull(),
	legalMinimum: numeric("legal_minimum", { precision: 3, scale:  2 }).notNull(),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	displayName: jsonb("display_name").default({"en":"","fr":""}).notNull(),
	description: jsonb(),
	legalReference: text("legal_reference"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_overtime_rates_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_overtime_rates_effective").using("btree", table.countryCode.asc().nullsLast().op("date_ops"), table.effectiveFrom.asc().nullsLast().op("text_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")).where(sql`(effective_to IS NULL)`),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "overtime_rates_country_code_fkey"
		}).onDelete("restrict"),
	pgPolicy("Everyone can view overtime rates", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Only super_admin can modify overtime rates", { as: "permissive", for: "all", to: ["public"] }),
	check("overtime_rates_check", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
	check("overtime_rates_legal_minimum_check", sql`(legal_minimum >= 1.00) AND (legal_minimum <= 3.00)`),
	check("overtime_rates_period_type_check", sql`(period_type)::text = ANY ((ARRAY['weekday_41_48'::character varying, 'weekday_48_plus'::character varying, 'saturday'::character varying, 'sunday'::character varying, 'holiday'::character varying, 'night'::character varying])::text[])`),
	check("overtime_rates_rate_multiplier_check", sql`(rate_multiplier >= 1.00) AND (rate_multiplier <= 3.00)`),
]);

export const leaveAccrualRules = pgTable("leave_accrual_rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	ageThreshold: integer("age_threshold"),
	seniorityYears: integer("seniority_years"),
	daysPerMonth: numeric("days_per_month", { precision: 3, scale:  1 }).notNull(),
	bonusDays: integer("bonus_days").default(0),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	displayName: jsonb("display_name").default({"en":"","fr":""}),
	description: jsonb(),
	legalReference: text("legal_reference"),
	priority: integer().default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_leave_accrual_age").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.ageThreshold.asc().nullsLast().op("int4_ops")),
	index("idx_leave_accrual_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_leave_accrual_seniority").using("btree", table.countryCode.asc().nullsLast().op("int4_ops"), table.seniorityYears.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "leave_accrual_rules_country_code_fkey"
		}).onDelete("restrict"),
	pgPolicy("Everyone can view leave accrual rules", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("Only super_admin can modify leave accrual rules", { as: "permissive", for: "all", to: ["public"] }),
	check("leave_accrual_rules_age_threshold_check", sql`(age_threshold IS NULL) OR (age_threshold > 0)`),
	check("leave_accrual_rules_bonus_days_check", sql`bonus_days >= 0`),
	check("leave_accrual_rules_check", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
	check("leave_accrual_rules_days_per_month_check", sql`(days_per_month >= (0)::numeric) AND (days_per_month <= 5.0)`),
	check("leave_accrual_rules_seniority_years_check", sql`(seniority_years IS NULL) OR (seniority_years >= 0)`),
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
	index("idx_formula_active_at").using("btree", table.componentId.asc().nullsLast().op("date_ops"), table.componentType.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("uuid_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_formula_audit").using("btree", table.changedBy.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_formula_component_history").using("btree", table.componentId.asc().nullsLast().op("text_ops"), table.componentType.asc().nullsLast().op("text_ops"), table.versionNumber.desc().nullsFirst().op("int4_ops")),
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [users.id],
			name: "salary_component_formula_versions_changed_by_fkey"
		}),
	unique("unique_version").on(table.componentId, table.componentType, table.versionNumber),
	pgPolicy("Authenticated users can create formula versions", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.role() = 'authenticated'::text)`  }),
	check("salary_component_formula_versions_component_type_check", sql`component_type = ANY (ARRAY['standard'::text, 'custom'::text])`),
	check("valid_date_range", sql`(effective_to IS NULL) OR (effective_to >= effective_from)`),
]);

export const taxSystems = pgTable("tax_systems", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	displayName: jsonb("display_name").notNull(),
	calculationMethod: varchar("calculation_method", { length: 50 }).notNull(),
	supportsFamilyDeductions: boolean("supports_family_deductions").default(false).notNull(),
	calculationBase: varchar("calculation_base", { length: 50 }).notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	taxCalculationBase: text("tax_calculation_base").default('gross_before_ss'),
	retirementContributionLabel: jsonb("retirement_contribution_label").default({"en":"Retirement","fr":"Retraite"}),
	healthContributionLabel: jsonb("health_contribution_label").default({"en":"Health","fr":"Santé"}),
	incomeTaxLabel: jsonb("income_tax_label").default({"en":"Income Tax","fr":"Impôt"}),
}, (table) => [
	index("idx_tax_systems_country_effective").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "tax_systems_country_code_fkey"
		}),
	check("chk_effective_dates", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
	check("tax_systems_tax_calculation_base_check", sql`tax_calculation_base = ANY (ARRAY['gross_before_ss'::text, 'gross_after_ss'::text])`),
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

export const jobSearchDays = pgTable("job_search_days", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	terminationId: uuid("termination_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	searchDate: date("search_date").notNull(),
	dayType: varchar("day_type", { length: 20 }).notNull(),
	hoursTaken: numeric("hours_taken", { precision: 4, scale:  2 }).default('8.00').notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_job_search_days_date").using("btree", table.searchDate.asc().nullsLast().op("date_ops")),
	index("idx_job_search_days_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_search_days_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_job_search_days_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_job_search_days_termination").using("btree", table.terminationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "job_search_days_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "job_search_days_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "job_search_days_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "job_search_days_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.terminationId],
			foreignColumns: [employeeTerminations.id],
			name: "job_search_days_termination_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "job_search_days_updated_by_fkey"
		}),
	unique("unique_search_date_per_termination").on(table.terminationId, table.searchDate),
	pgPolicy("job_search_days_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(tenant_id = (current_setting('app.current_tenant_id'::text))::uuid)` }),
	check("job_search_days_day_type_check", sql`(day_type)::text = ANY ((ARRAY['full_day'::character varying, 'half_day'::character varying])::text[])`),
	check("job_search_days_status_check", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])`),
]);

export const employeeSalaries = pgTable("employee_salaries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	baseSalary: numeric("base_salary", { precision: 15, scale:  2 }).notNull(),
	currency: text().default('XOF').notNull(),
	allowances: jsonb().default({}).notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	changeReason: text("change_reason"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	payFrequency: text("pay_frequency").default('monthly').notNull(),
	components: jsonb().default([]).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_employee_salaries_active").using("btree", table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")).where(sql`(effective_to IS NULL)`),
	index("idx_employee_salaries_components").using("gin", table.components.asc().nullsLast().op("jsonb_ops")),
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
	check("valid_pay_frequency", sql`pay_frequency = ANY (ARRAY['monthly'::text, 'biweekly'::text, 'weekly'::text])`),
]);

export const otherTaxes = pgTable("other_taxes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	taxRate: numeric("tax_rate", { precision: 6, scale:  4 }).notNull(),
	calculationBase: varchar("calculation_base", { length: 50 }).notNull(),
	paidBy: varchar("paid_by", { length: 20 }).notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliesToEmployeeType: varchar("applies_to_employee_type", { length: 20 }),
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

export const salaryComponentTemplates = pgTable("salary_component_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	description: text(),
	category: varchar({ length: 50 }).notNull(),
	metadata: jsonb().default({}).notNull(),
	suggestedAmount: numeric("suggested_amount", { precision: 15, scale:  2 }),
	isPopular: boolean("is_popular").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	complianceLevel: text("compliance_level").default('freeform'),
	legalReference: text("legal_reference"),
	customizableFields: jsonb("customizable_fields").default([]),
	canDeactivate: boolean("can_deactivate").default(true),
	canModify: boolean("can_modify").default(true),
}, (table) => [
	index("idx_salary_templates_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_salary_templates_popular").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.isPopular.asc().nullsLast().op("bool_ops")).where(sql`(is_popular = true)`),
	index("idx_templates_compliance_level").using("btree", table.complianceLevel.asc().nullsLast().op("bool_ops"), table.countryCode.asc().nullsLast().op("text_ops"), table.isPopular.asc().nullsLast().op("bool_ops")),
	index("idx_templates_legal_ref").using("btree", table.legalReference.asc().nullsLast().op("text_ops")).where(sql`(legal_reference IS NOT NULL)`),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "salary_component_templates_country_code_fkey"
		}),
	unique("salary_component_templates_country_code_code_key").on(table.countryCode, table.code),
	check("salary_component_templates_category_check", sql`(category)::text = ANY ((ARRAY['allowance'::character varying, 'bonus'::character varying, 'deduction'::character varying])::text[])`),
	check("salary_component_templates_compliance_level_check", sql`compliance_level = ANY (ARRAY['locked'::text, 'configurable'::text, 'freeform'::text])`),
]);

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
	index("idx_compliance_rules_country").using("btree", table.countryCode.asc().nullsLast().op("date_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_compliance_rules_type").using("btree", table.ruleType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "compliance_rules_country_code_fkey"
		}),
	pgPolicy("Public read access to compliance rules", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	pgPolicy("Super admins can manage compliance rules", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("valid_rule_type", sql`rule_type = ANY (ARRAY['minimum_wage'::text, 'seniority_bonus'::text, 'notice_period'::text, 'severance'::text, 'annual_leave'::text, 'maternity_leave'::text, 'overtime_rate'::text, 'transport_exemption'::text, 'housing_allowance_range'::text, 'hazard_pay_range'::text])`),
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
	paymentStatus: text("payment_status").default('pending').notNull(),
	employerCost: numeric("employer_cost", { precision: 15, scale:  2 }),
	totalOtherTaxes: numeric("total_other_taxes", { precision: 15, scale:  2 }).default('0'),
	otherTaxesDetails: jsonb("other_taxes_details").default([]).notNull(),
	hoursWorked: numeric("hours_worked", { precision: 6, scale:  2 }).default('0'),
	brutImposable: numeric("brut_imposable", { precision: 15, scale:  2 }),
	contributionDetails: jsonb("contribution_details").default('[]'),
}, (table) => [
	index("idx_payroll_line_items_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_line_items_run").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_line_items_run_employee").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops"), table.employeeId.asc().nullsLast().op("uuid_ops")),
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
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("payroll_line_items_hours_worked_check", sql`hours_worked >= (0)::numeric`),
	check("valid_payment_status", sql`payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text])`),
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
	paymentFrequency: varchar("payment_frequency", { length: 20 }).default('MONTHLY').notNull(),
	closureSequence: integer("closure_sequence"),
}, (table) => [
	index("idx_payroll_runs_pay_date").using("btree", table.payDate.asc().nullsLast().op("date_ops")),
	index("idx_payroll_runs_payment_frequency").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.paymentFrequency.asc().nullsLast().op("text_ops"), table.periodStart.asc().nullsLast().op("date_ops")),
	index("idx_payroll_runs_period").using("btree", table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("date_ops")),
	index("idx_payroll_runs_register_generation").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.paymentFrequency.asc().nullsLast().op("int4_ops"), table.closureSequence.asc().nullsLast().op("date_ops"), table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_runs_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_payroll_runs_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_runs_tenant_period").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.periodStart.asc().nullsLast().op("uuid_ops"), table.periodEnd.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_runs_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
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
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("closure_sequence_required", sql`((payment_frequency)::text = 'MONTHLY'::text) OR (((payment_frequency)::text = ANY ((ARRAY['WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'DAILY'::character varying])::text[])) AND (closure_sequence IS NOT NULL))`),
	check("valid_closure_sequence", sql`(((payment_frequency)::text = 'MONTHLY'::text) AND (closure_sequence IS NULL)) OR (((payment_frequency)::text = 'WEEKLY'::text) AND ((closure_sequence >= 1) AND (closure_sequence <= 4))) OR (((payment_frequency)::text = 'BIWEEKLY'::text) AND ((closure_sequence >= 1) AND (closure_sequence <= 2))) OR (((payment_frequency)::text = 'DAILY'::text) AND (closure_sequence >= 1))`),
	check("valid_payment_frequency_payroll", sql`(payment_frequency)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'MONTHLY'::character varying])::text[])`),
	check("valid_status_payroll", sql`status = ANY (ARRAY['draft'::text, 'calculating'::text, 'calculated'::text, 'approved'::text, 'paid'::text, 'failed'::text])`),
]);

export const payrollVerificationStatus = pgTable("payroll_verification_status", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	payrollRunId: uuid("payroll_run_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	status: text().notNull(),
	verifiedBy: uuid("verified_by"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payroll_verification_status_run").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_verification_status_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_verification_status_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_verification_status_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payroll_verification_status_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.payrollRunId],
			foreignColumns: [payrollRuns.id],
			name: "payroll_verification_status_payroll_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "payroll_verification_status_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.verifiedBy],
			foreignColumns: [users.id],
			name: "payroll_verification_status_verified_by_fkey"
		}),
	unique("payroll_verification_status_run_employee_key").on(table.payrollRunId, table.employeeId),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("valid_verification_status", sql`status = ANY (ARRAY['verified'::text, 'flagged'::text, 'unverified'::text, 'auto_ok'::text])`),
]);

export const payrollValidationIssues = pgTable("payroll_validation_issues", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	payrollRunId: uuid("payroll_run_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	issueType: text("issue_type").notNull(),
	category: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	expectedAmount: numeric("expected_amount", { precision: 15, scale:  2 }),
	actualAmount: numeric("actual_amount", { precision: 15, scale:  2 }),
	resolved: boolean().default(false).notNull(),
	resolvedBy: uuid("resolved_by"),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payroll_validation_issues_run").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_validation_issues_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_validation_issues_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_validation_issues_type").using("btree", table.issueType.asc().nullsLast().op("text_ops")),
	index("idx_payroll_validation_issues_resolved").using("btree", table.resolved.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payroll_validation_issues_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.payrollRunId],
			foreignColumns: [payrollRuns.id],
			name: "payroll_validation_issues_payroll_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "payroll_validation_issues_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resolvedBy],
			foreignColumns: [users.id],
			name: "payroll_validation_issues_resolved_by_fkey"
		}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("valid_issue_type", sql`issue_type = ANY (ARRAY['error'::text, 'warning'::text, 'info'::text])`),
	check("valid_category", sql`category = ANY (ARRAY['overtime'::text, 'comparison'::text, 'prorata'::text, 'deduction'::text, 'bonus'::text])`),
]);

export const cnpsDeclarationEdits = pgTable("cnps_declaration_edits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	month: integer().notNull(),
	year: integer().notNull(),
	countryCode: text("country_code").notNull(),
	originalData: jsonb("original_data").notNull(),
	edits: jsonb().notNull(),
	editReason: text("edit_reason"),
	editedBy: uuid("edited_by").notNull(),
	editedAt: timestamp("edited_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_cnps_declaration_edits_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_cnps_declaration_edits_period").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops"), table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_cnps_declaration_edits_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "cnps_declaration_edits_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "cnps_declaration_edits_country_code_fkey"
		}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
]);

export const bankingProfessionalLevels = pgTable("banking_professional_levels", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conventionId: uuid("convention_id").notNull(),
	levelNumber: integer("level_number").notNull(),
	levelName: varchar("level_name", { length: 10 }).notNull(),
	minimumSalary: numeric("minimum_salary", { precision: 15, scale:  2 }).notNull(),
	typicalPositions: text("typical_positions").array(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_banking_professional_levels_convention_id").using("btree", table.conventionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conventionId],
			foreignColumns: [conventionCollectives.id],
			name: "banking_professional_levels_convention_id_fkey"
		}).onDelete("cascade"),
	unique("banking_professional_levels_convention_id_level_number_key").on(table.conventionId, table.levelNumber),
	pgPolicy("public_read_banking_professional_levels", { as: "permissive", for: "select", to: ["tenant_user"], using: sql`true` }),
	pgPolicy("super_admin_manage_banking_professional_levels", { as: "permissive", for: "all", to: ["tenant_user"] }),
]);

export const bankingSeniorityBonuses = pgTable("banking_seniority_bonuses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	conventionId: uuid("convention_id").notNull(),
	yearsOfService: integer("years_of_service").notNull(),
	bonusPercentage: numeric("bonus_percentage", { precision: 5, scale:  2 }).notNull(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_banking_seniority_bonuses_convention_id").using("btree", table.conventionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.conventionId],
			foreignColumns: [conventionCollectives.id],
			name: "banking_seniority_bonuses_convention_id_fkey"
		}).onDelete("cascade"),
	unique("banking_seniority_bonuses_convention_id_years_of_service_key").on(table.conventionId, table.yearsOfService),
	pgPolicy("public_read_banking_seniority_bonuses", { as: "permissive", for: "select", to: ["tenant_user"], using: sql`true` }),
	pgPolicy("super_admin_manage_banking_seniority_bonuses", { as: "permissive", for: "all", to: ["tenant_user"] }),
]);

export const conventionCollectives = pgTable("convention_collectives", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	conventionCode: varchar("convention_code", { length: 50 }).notNull(),
	conventionName: varchar("convention_name", { length: 255 }).notNull(),
	isActive: boolean("is_active").default(true),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_convention_collectives_country_code").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "convention_collectives_country_code_fkey"
		}),
	unique("convention_collectives_country_code_convention_code_key").on(table.countryCode, table.conventionCode),
	pgPolicy("public_read_convention_collectives", { as: "permissive", for: "select", to: ["tenant_user"], using: sql`true` }),
	pgPolicy("super_admin_manage_convention_collectives", { as: "permissive", for: "all", to: ["tenant_user"] }),
]);

export const dataMigrations = pgTable("data_migrations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	migrationType: text("migration_type").notNull(),
	sourceSystem: text("source_system").notNull(),
	fileUrl: text("file_url"),
	fileName: text("file_name"),
	fileSizeBytes: integer("file_size_bytes"),
	totalRecords: integer("total_records").default(0),
	importedRecords: integer("imported_records").default(0),
	failedRecords: integer("failed_records").default(0),
	migrationStatus: text("migration_status").default('pending').notNull(),
	fieldMapping: jsonb("field_mapping"),
	validationResults: jsonb("validation_results"),
	errorLog: jsonb("error_log").default([]),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	migratedBy: uuid("migrated_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_data_migrations_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.migrationStatus.asc().nullsLast().op("uuid_ops")),
	index("idx_data_migrations_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_data_migrations_type").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.migrationType.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.migratedBy],
			foreignColumns: [users.id],
			name: "data_migrations_migrated_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "data_migrations_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("data_migrations_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
	check("data_migrations_count_check", sql`(imported_records + failed_records) <= total_records`),
	check("data_migrations_migration_status_check", sql`migration_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])`),
	check("data_migrations_migration_type_check", sql`migration_type = ANY (ARRAY['sage_employees'::text, 'sage_payroll'::text, 'sage_accounts'::text])`),
	check("data_migrations_source_system_check", sql`source_system = ANY (ARRAY['SAGE'::text, 'CIEL'::text, 'EXCEL'::text, 'CSV'::text])`),
]);

export const salaryComponentDefinitions = pgTable("salary_component_definitions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: jsonb().notNull(),
	category: varchar({ length: 50 }).notNull(),
	componentType: varchar("component_type", { length: 50 }).notNull(),
	isTaxable: boolean("is_taxable").default(true).notNull(),
	isSubjectToSocialSecurity: boolean("is_subject_to_social_security").default(true).notNull(),
	calculationMethod: varchar("calculation_method", { length: 50 }),
	defaultValue: numeric("default_value", { precision: 15, scale:  2 }),
	displayOrder: integer("display_order").default(0).notNull(),
	isCommon: boolean("is_common").default(false).notNull(),
	isReimbursement: boolean("is_reimbursement").default(false),
	requiresCapValidation: boolean("requires_cap_validation").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
	templateCode: text("template_code"),
	isPopular: boolean("is_popular").default(false),
}, (table) => [
	index("idx_component_definitions_common").using("btree", table.countryCode.asc().nullsLast().op("bool_ops"), table.isCommon.asc().nullsLast().op("bool_ops")).where(sql`(is_common = true)`),
	index("idx_component_definitions_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_popular_components").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.isPopular.asc().nullsLast().op("int4_ops"), table.displayOrder.asc().nullsLast().op("int4_ops")).where(sql`(is_popular = true)`),
	index("idx_salary_components_category").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops")),
	index("idx_salary_components_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	uniqueIndex("idx_template_code_country").using("btree", table.templateCode.asc().nullsLast().op("text_ops"), table.countryCode.asc().nullsLast().op("text_ops")).where(sql`(template_code IS NOT NULL)`),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "salary_component_definitions_country_code_fkey"
		}),
	unique("salary_component_definitions_country_code_code_key").on(table.countryCode, table.code),
	check("chk_category", sql`(category)::text = ANY ((ARRAY['allowance'::character varying, 'bonus'::character varying, 'deduction'::character varying])::text[])`),
]);

export const payslips = pgTable("payslips", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	paymentDate: date("payment_date").notNull(),
	grossSalary: numeric("gross_salary", { precision: 12, scale:  2 }).notNull(),
	netSalary: numeric("net_salary", { precision: 12, scale:  2 }).notNull(),
	employerContributions: numeric("employer_contributions", { precision: 12, scale:  2 }).default('0').notNull(),
	salaryComponents: jsonb("salary_components").default([]).notNull(),
	deductions: jsonb().default([]).notNull(),
	employerCosts: jsonb("employer_costs").default([]).notNull(),
	status: text().default('draft').notNull(),
	pdfUrl: text("pdf_url"),
	finalizedAt: timestamp("finalized_at", { withTimezone: true, mode: 'string' }),
	finalizedBy: uuid("finalized_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payslips_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payslips_period").using("btree", table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("date_ops")),
	index("idx_payslips_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_payslips_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
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
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payslips_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("payslips_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(tenant_id = (current_setting('app.current_tenant_id'::text))::uuid)` }),
	check("valid_amounts", sql`(gross_salary >= (0)::numeric) AND (net_salary >= (0)::numeric) AND (employer_contributions >= (0)::numeric)`),
	check("valid_status", sql`status = ANY (ARRAY['draft'::text, 'finalized'::text, 'paid'::text])`),
]);

export const geofenceConfigurations = pgTable("geofence_configurations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	latitude: numeric({ precision: 10, scale:  8 }).notNull(),
	longitude: numeric({ precision: 11, scale:  8 }).notNull(),
	radiusMeters: integer("radius_meters").default(100).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	appliesToAll: boolean("applies_to_all").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_geofence_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_geofence_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "geofence_configurations_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("geofence_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(tenant_id = (current_setting('app.current_tenant_id'::text))::uuid)` }),
	check("valid_latitude", sql`(latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)`),
	check("valid_longitude", sql`(longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)`),
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
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "geofence_employee_assignments_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.geofenceId],
			foreignColumns: [geofenceConfigurations.id],
			name: "geofence_employee_assignments_geofence_id_fkey"
		}).onDelete("cascade"),
	unique("geofence_employee_assignments_geofence_id_employee_id_key").on(table.geofenceId, table.employeeId),
	pgPolicy("geofence_assignments_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM geofence_configurations gc
  WHERE ((gc.id = geofence_employee_assignments.geofence_id) AND (gc.tenant_id = (current_setting('app.current_tenant_id'::text))::uuid))))` }),
]);

export const rules = pgTable("rules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ruleType: ruleType("rule_type").notNull(),
	code: varchar({ length: 100 }).notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	scopeType: ruleScopeType("scope_type").default('country').notNull(),
	scopeCountryCode: varchar("scope_country_code", { length: 2 }),
	scopeLocationId: uuid("scope_location_id"),
	scopeSectorCode: varchar("scope_sector_code", { length: 50 }),
	scopeTenantId: uuid("scope_tenant_id"),
	scopeEmployeeId: uuid("scope_employee_id"),
	ruleData: jsonb("rule_data").notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	supersededAt: timestamp("superseded_at", { withTimezone: true, mode: 'string' }),
	priority: integer().default(0).notNull(),
	createdBy: uuid("created_by"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_rules_code").using("btree", table.code.asc().nullsLast().op("text_ops"), table.ruleType.asc().nullsLast().op("enum_ops"), table.scopeType.asc().nullsLast().op("enum_ops")),
	index("idx_rules_country_scope").using("btree", table.scopeCountryCode.asc().nullsLast().op("text_ops"), table.ruleType.asc().nullsLast().op("enum_ops"), table.effectiveFrom.asc().nullsLast().op("text_ops")).where(sql`((scope_type = 'country'::rule_scope_type) AND (superseded_at IS NULL))`),
	index("idx_rules_employee_scope").using("btree", table.scopeEmployeeId.asc().nullsLast().op("uuid_ops"), table.ruleType.asc().nullsLast().op("enum_ops"), table.effectiveFrom.asc().nullsLast().op("enum_ops")).where(sql`((scope_type = 'employee'::rule_scope_type) AND (superseded_at IS NULL))`),
	index("idx_rules_location_scope").using("btree", table.scopeLocationId.asc().nullsLast().op("timestamptz_ops"), table.ruleType.asc().nullsLast().op("enum_ops"), table.effectiveFrom.asc().nullsLast().op("timestamptz_ops")).where(sql`((scope_type = 'location'::rule_scope_type) AND (superseded_at IS NULL))`),
	index("idx_rules_sector_scope").using("btree", table.scopeSectorCode.asc().nullsLast().op("timestamptz_ops"), table.scopeCountryCode.asc().nullsLast().op("timestamptz_ops"), table.ruleType.asc().nullsLast().op("timestamptz_ops"), table.effectiveFrom.asc().nullsLast().op("enum_ops")).where(sql`((scope_type = 'sector'::rule_scope_type) AND (superseded_at IS NULL))`),
	index("idx_rules_system_time").using("btree", table.publishedAt.asc().nullsLast().op("timestamptz_ops"), table.supersededAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_rules_tenant_scope").using("btree", table.scopeTenantId.asc().nullsLast().op("uuid_ops"), table.ruleType.asc().nullsLast().op("enum_ops"), table.effectiveFrom.asc().nullsLast().op("timestamptz_ops")).where(sql`((scope_type = 'tenant'::rule_scope_type) AND (superseded_at IS NULL))`),
	index("idx_rules_type_scope_effective").using("btree", table.ruleType.asc().nullsLast().op("timestamptz_ops"), table.scopeType.asc().nullsLast().op("enum_ops"), table.scopeCountryCode.asc().nullsLast().op("timestamptz_ops"), table.effectiveFrom.asc().nullsLast().op("enum_ops"), table.effectiveTo.asc().nullsLast().op("text_ops")).where(sql`(superseded_at IS NULL)`),
	pgPolicy("rules_read_policy", { as: "permissive", for: "select", to: ["public"], using: sql`((scope_type = 'country'::rule_scope_type) OR ((scope_type = 'tenant'::rule_scope_type) AND ((scope_tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))) OR ((scope_type = 'employee'::rule_scope_type) AND ((scope_employee_id)::text = (auth.jwt() ->> 'employee_id'::text))))` }),
	pgPolicy("rules_write_policy", { as: "permissive", for: "all", to: ["public"] }),
	check("scope_specificity", sql`((scope_type = 'employee'::rule_scope_type) AND (scope_employee_id IS NOT NULL)) OR ((scope_type = 'tenant'::rule_scope_type) AND (scope_tenant_id IS NOT NULL)) OR ((scope_type = 'sector'::rule_scope_type) AND (scope_sector_code IS NOT NULL)) OR ((scope_type = 'location'::rule_scope_type) AND (scope_location_id IS NOT NULL)) OR ((scope_type = 'country'::rule_scope_type) AND (scope_country_code IS NOT NULL))`),
	check("valid_business_time", sql`(effective_to IS NULL) OR (effective_to > effective_from)`),
	check("valid_system_time", sql`(superseded_at IS NULL) OR (superseded_at > published_at)`),
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

export const tenantSalaryComponentActivations = pgTable("tenant_salary_component_activations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	templateCode: varchar("template_code", { length: 50 }).notNull(),
	overrides: jsonb().default({}).notNull(),
	customName: text("custom_name"),
	isActive: boolean("is_active").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_activations_active").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_activations_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "tenant_salary_component_activations_created_by_fkey"
		}),
	foreignKey({
			columns: [table.countryCode, table.templateCode],
			foreignColumns: [salaryComponentDefinitions.countryCode, salaryComponentDefinitions.code],
			name: "tenant_salary_component_activations_definition_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tenant_salary_component_activations_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("tenant_salary_component_activ_tenant_id_country_code_templa_key").on(table.tenantId, table.countryCode, table.templateCode),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const publicHolidays = pgTable("public_holidays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	holidayDate: date("holiday_date").notNull(),
	name: jsonb().notNull(),
	description: jsonb(),
	isRecurring: boolean("is_recurring").default(true),
	isPaid: boolean("is_paid").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_public_holidays_country_code").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	index("idx_public_holidays_country_date").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.holidayDate.asc().nullsLast().op("text_ops")),
	index("idx_public_holidays_date").using("btree", table.holidayDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "public_holidays_country_code_fkey"
		}).onDelete("restrict"),
	unique("unique_country_holiday_date").on(table.countryCode, table.holidayDate),
	pgPolicy("public_holidays_read_all", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
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
	templateId: uuid("template_id"),
	complianceLevel: varchar("compliance_level", { length: 20 }),
	legalReference: text("legal_reference"),
	eligibleGender: text("eligible_gender"),
	metadata: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "time_off_policies_created_by_fkey"
		}),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [timeOffPolicyTemplates.id],
			name: "time_off_policies_template_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "time_off_policies_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_accrual_method", sql`accrual_method = ANY (ARRAY['fixed'::text, 'accrued_monthly'::text, 'accrued_hourly'::text])`),
	check("valid_policy_type", sql`policy_type = ANY (ARRAY['annual_leave'::text, 'sick_leave'::text, 'maternity'::text, 'paternity'::text, 'unpaid'::text])`),
]);

export const salaryReviews = pgTable("salary_reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	currentSalary: numeric("current_salary").notNull(),
	proposedSalary: numeric("proposed_salary").notNull(),
	proposedAllowances: jsonb("proposed_allowances").default({}),
	effectiveFrom: date("effective_from").notNull(),
	reason: text().notNull(),
	justification: text(),
	status: text().default('pending').notNull(),
	requestedBy: uuid("requested_by"),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_salary_reviews_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_salary_reviews_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_salary_reviews_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "salary_reviews_employee_id_fkey"
		}),
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
		}),
	check("salary_reviews_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])`),
]);

export const workSchedules = pgTable("work_schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	workDate: date("work_date").notNull(),
	startTime: time("start_time"),
	endTime: time("end_time"),
	hoursWorked: numeric("hours_worked", { precision: 5, scale:  2 }),
	isPresent: boolean("is_present").default(false).notNull(),
	scheduleType: varchar("schedule_type", { length: 20 }).default('FULL_DAY').notNull(),
	notes: text(),
	status: varchar({ length: 20 }).default('draft').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectedReason: text("rejected_reason"),
	weekStartDate: date("week_start_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_work_schedules_active").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("date_ops"), table.workDate.desc().nullsFirst().op("date_ops")).where(sql`((status)::text = 'approved'::text)`),
	index("idx_work_schedules_date").using("btree", table.workDate.asc().nullsLast().op("date_ops")),
	index("idx_work_schedules_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.workDate.desc().nullsFirst().op("date_ops")),
	index("idx_work_schedules_employee_date").using("btree", table.employeeId.asc().nullsLast().op("date_ops"), table.workDate.asc().nullsLast().op("date_ops")),
	index("idx_work_schedules_employee_week").using("btree", table.employeeId.asc().nullsLast().op("date_ops"), table.weekStartDate.asc().nullsLast().op("uuid_ops"), table.workDate.asc().nullsLast().op("uuid_ops")),
	index("idx_work_schedules_payroll").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.employeeId.asc().nullsLast().op("date_ops"), table.workDate.asc().nullsLast().op("date_ops")).where(sql`((status)::text = 'approved'::text)`),
	index("idx_work_schedules_status").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.status.asc().nullsLast().op("date_ops"), table.workDate.desc().nullsFirst().op("text_ops")).where(sql`((status)::text = ANY ((ARRAY['pending'::character varying, 'draft'::character varying])::text[]))`),
	index("idx_work_schedules_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_work_schedules_week").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.employeeId.asc().nullsLast().op("uuid_ops"), table.weekStartDate.asc().nullsLast().op("uuid_ops")).where(sql`(week_start_date IS NOT NULL)`),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "work_schedules_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "work_schedules_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "work_schedules_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "work_schedules_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "work_schedules_updated_by_fkey"
		}),
	unique("work_schedules_unique_employee_date").on(table.tenantId, table.employeeId, table.workDate),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	pgPolicy("work_schedules_tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"] }),
	check("work_schedules_time_consistency", sql`((start_time IS NULL) AND (end_time IS NULL)) OR ((start_time IS NOT NULL) AND (end_time IS NOT NULL))`),
	check("work_schedules_valid_hours", sql`(hours_worked IS NULL) OR ((hours_worked >= (0)::numeric) AND (hours_worked <= (24)::numeric))`),
	check("work_schedules_valid_status", sql`(status)::text = ANY ((ARRAY['draft'::character varying, 'pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])`),
	check("work_schedules_valid_type", sql`(schedule_type)::text = ANY ((ARRAY['FULL_DAY'::character varying, 'PARTIAL_DAY'::character varying, 'ABSENT'::character varying])::text[])`),
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
	index("idx_audit_entity").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_audit_logs_entity_type_id").using("btree", table.entityType.asc().nullsLast().op("timestamptz_ops"), table.entityId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_audit_logs_tenant_timestamp").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_audit_tenant_time").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_audit_user").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
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
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
]);

export const geofenceConfigs = pgTable("geofence_configs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	latitude: numeric({ precision: 10, scale:  8 }).notNull(),
	longitude: numeric({ precision: 11, scale:  8 }).notNull(),
	radiusMeters: integer("radius_meters").default(100).notNull(),
	effectiveFrom: date("effective_from").default(sql`CURRENT_DATE`).notNull(),
	effectiveTo: date("effective_to"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_geofence_configs_active").using("btree", table.tenantId.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_geofence_configs_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "geofence_configs_created_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "geofence_configs_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_latitude", sql`(latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)`),
	check("valid_longitude", sql`(longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)`),
	check("valid_radius", sql`(radius_meters > 0) AND (radius_meters <= 5000)`),
]);

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
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
]);

export const workflows = pgTable("workflows", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	triggerEvent: text("trigger_event").notNull(),
	definition: jsonb().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "workflows_created_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflows_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const workflowInstances = pgTable("workflow_instances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	workflowId: uuid("workflow_id").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id").notNull(),
	currentState: text("current_state").notNull(),
	status: text().default('running').notNull(),
	context: jsonb().default({}).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_workflow_instances_entity").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("idx_workflow_instances_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflow_instances_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflows.id],
			name: "workflow_instances_workflow_id_fkey"
		}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_status_workflow", sql`status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])`),
]);

export const bulkSalaryAdjustments = pgTable("bulk_salary_adjustments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	adjustmentType: text("adjustment_type").notNull(),
	adjustmentValue: numeric("adjustment_value"),
	effectiveFrom: date("effective_from").notNull(),
	status: text().default('draft').notNull(),
	filters: jsonb().default({}),
	affectedEmployeesCount: integer("affected_employees_count").default(0),
	totalCostImpact: numeric("total_cost_impact").default('0'),
	createdBy: uuid("created_by"),
	approvedBy: uuid("approved_by"),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_bulk_adjustments_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_bulk_adjustments_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
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
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bulk_salary_adjustments_tenant_id_fkey"
		}),
	check("bulk_salary_adjustments_adjustment_type_check", sql`adjustment_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text, 'custom'::text])`),
	check("bulk_salary_adjustments_status_check", sql`status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'processing'::text, 'completed'::text, 'failed'::text])`),
]);

export const bulkAdjustmentItems = pgTable("bulk_adjustment_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	adjustmentId: uuid("adjustment_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	currentSalary: numeric("current_salary").notNull(),
	newSalary: numeric("new_salary").notNull(),
	adjustmentAmount: numeric("adjustment_amount").notNull(),
	status: text().default('pending').notNull(),
	errorMessage: text("error_message"),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_bulk_adjustment_items_adjustment").using("btree", table.adjustmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_bulk_adjustment_items_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.adjustmentId],
			foreignColumns: [bulkSalaryAdjustments.id],
			name: "bulk_adjustment_items_adjustment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "bulk_adjustment_items_employee_id_fkey"
		}),
	check("bulk_adjustment_items_status_check", sql`status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text, 'skipped'::text])`),
]);

export const payslipTemplates = pgTable("payslip_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	templateName: varchar("template_name", { length: 100 }).notNull(),
	isDefault: boolean("is_default").default(false),
	logoUrl: text("logo_url"),
	companyNameOverride: varchar("company_name_override", { length: 255 }),
	headerText: text("header_text"),
	footerText: text("footer_text"),
	layoutType: varchar("layout_type", { length: 50 }).default('STANDARD'),
	fontFamily: varchar("font_family", { length: 50 }).default('Helvetica'),
	primaryColor: varchar("primary_color", { length: 7 }).default('#000000'),
	showEmployerContributions: boolean("show_employer_contributions").default(true),
	showYearToDate: boolean("show_year_to_date").default(true),
	showLeaveBalance: boolean("show_leave_balance").default(true),
	customFields: jsonb("custom_fields").default([]),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_payslip_templates_is_default").using("btree", table.tenantId.asc().nullsLast().op("bool_ops"), table.isDefault.asc().nullsLast().op("uuid_ops")).where(sql`(is_default = true)`),
	index("idx_payslip_templates_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payslip_templates_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("payslip_templates_tenant_id_template_name_key").on(table.tenantId, table.templateName),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	pgPolicy("tenant_isolation_payslip_templates", { as: "permissive", for: "all", to: ["tenant_user"] }),
]);

export const workflowDefinitions = pgTable("workflow_definitions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	description: text(),
	triggerType: text("trigger_type").notNull(),
	triggerConfig: jsonb("trigger_config").default({}).notNull(),
	conditions: jsonb().default([]).notNull(),
	actions: jsonb().default([]).notNull(),
	status: text().default('draft').notNull(),
	createdBy: uuid("created_by").notNull(),
	version: integer().default(1).notNull(),
	executionCount: integer("execution_count").default(0).notNull(),
	lastExecutedAt: timestamp("last_executed_at", { withTimezone: true, mode: 'string' }),
	successCount: integer("success_count").default(0).notNull(),
	errorCount: integer("error_count").default(0).notNull(),
	isTemplate: boolean("is_template").default(false),
	templateCategory: text("template_category"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_workflow_definitions_is_template").using("btree", table.isTemplate.asc().nullsLast().op("bool_ops")),
	index("idx_workflow_definitions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_workflow_definitions_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "workflow_definitions_created_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflow_definitions_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("workflow_definitions_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
]);

export const batchOperations = pgTable("batch_operations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	operationType: text("operation_type").notNull(),
	entityType: text("entity_type").notNull(),
	entityIds: uuid("entity_ids").array().notNull(),
	params: jsonb().notNull(),
	status: text().default('pending').notNull(),
	totalCount: integer("total_count").notNull(),
	processedCount: integer("processed_count").default(0),
	successCount: integer("success_count").default(0),
	errorCount: integer("error_count").default(0),
	errors: jsonb().default([]).notNull(),
	startedBy: uuid("started_by").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	estimatedCompletionAt: timestamp("estimated_completion_at", { withTimezone: true, mode: 'string' }),
	resultData: jsonb("result_data").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_batch_operations_started_by").using("btree", table.startedBy.asc().nullsLast().op("uuid_ops")),
	index("idx_batch_operations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_batch_operations_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.startedBy],
			foreignColumns: [users.id],
			name: "batch_operations_started_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "batch_operations_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("batch_operations_tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const workflowExecutions = pgTable("workflow_executions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	workflowId: uuid("workflow_id").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	triggerEventId: uuid("trigger_event_id"),
	employeeId: uuid("employee_id"),
	status: text().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	durationMs: integer("duration_ms"),
	actionsExecuted: jsonb("actions_executed").default([]).notNull(),
	errorMessage: text("error_message"),
	executionLog: jsonb("execution_log").default([]).notNull(),
	workflowSnapshot: jsonb("workflow_snapshot").notNull(),
	triggerData: jsonb("trigger_data").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_workflow_executions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_workflow_executions_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_workflow_executions_workflow_id").using("btree", table.workflowId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "workflow_executions_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "workflow_executions_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.workflowId],
			foreignColumns: [workflowDefinitions.id],
			name: "workflow_executions_workflow_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("workflow_executions_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
]);

export const alerts = pgTable("alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	type: text().notNull(),
	severity: text().notNull(),
	message: text().notNull(),
	assigneeId: uuid("assignee_id").notNull(),
	employeeId: uuid("employee_id"),
	actionUrl: text("action_url"),
	actionLabel: text("action_label"),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	status: text().default('active').notNull(),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }),
	dismissedBy: uuid("dismissed_by"),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	completedBy: uuid("completed_by"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_alerts_assignee_id").using("btree", table.assigneeId.asc().nullsLast().op("uuid_ops")),
	index("idx_alerts_due_date").using("btree", table.dueDate.asc().nullsLast().op("timestamptz_ops")),
	index("idx_alerts_employee_id").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_alerts_severity").using("btree", table.severity.asc().nullsLast().op("text_ops")),
	index("idx_alerts_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_alerts_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.assigneeId],
			foreignColumns: [users.id],
			name: "alerts_assignee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.completedBy],
			foreignColumns: [users.id],
			name: "alerts_completed_by_fkey"
		}),
	foreignKey({
			columns: [table.dismissedBy],
			foreignColumns: [users.id],
			name: "alerts_dismissed_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "alerts_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "alerts_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("alerts_tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const payrollEvents = pgTable("payroll_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	eventType: text("event_type").notNull(),
	employeeId: uuid("employee_id").notNull(),
	payrollRunId: uuid("payroll_run_id"),
	eventDate: date("event_date").notNull(),
	metadata: jsonb().default({}).notNull(),
	amountCalculated: numeric("amount_calculated", { precision: 15, scale:  2 }),
	isProrated: boolean("is_prorated").default(false),
	workingDays: integer("working_days"),
	daysWorked: integer("days_worked"),
	prorationPercentage: numeric("proration_percentage", { precision: 5, scale:  2 }),
	processingStatus: text("processing_status").default('pending').notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	errorMessage: text("error_message"),
	impactedPayrollRuns: uuid("impacted_payroll_runs").array().default(["RAY"]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_payroll_events_employee_id").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_events_event_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("idx_payroll_events_payroll_run_id").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_payroll_events_processing_status").using("btree", table.processingStatus.asc().nullsLast().op("text_ops")),
	index("idx_payroll_events_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "payroll_events_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "payroll_events_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.payrollRunId],
			foreignColumns: [payrollRuns.id],
			name: "payroll_events_payroll_run_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "payroll_events_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("payroll_events_tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const employeeBonuses = pgTable("employee_bonuses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	bonusType: text("bonus_type").notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	description: text().notNull(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	status: text().default('pending').notNull(),
	requestedBy: uuid("requested_by").notNull(),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	paidInPayrollRunId: uuid("paid_in_payroll_run_id"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	isRecurring: boolean("is_recurring").default(false).notNull(),
	recurringFrequency: text("recurring_frequency"),
	recurringEndDate: date("recurring_end_date"),
	metadata: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_employee_bonuses_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_bonuses_payroll_run").using("btree", table.paidInPayrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_bonuses_period").using("btree", table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("date_ops")),
	index("idx_employee_bonuses_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_employee_bonuses_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "employee_bonuses_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_bonuses_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [users.id],
			name: "employee_bonuses_requested_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employee_bonuses_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("employee_bonuses_tenant_isolation", { as: "permissive", for: "all", to: ["authenticated"], using: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("valid_bonus_status", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text, 'cancelled'::text])`),
	check("valid_bonus_type", sql`bonus_type = ANY (ARRAY['performance'::text, 'sales_commission'::text, 'annual'::text, 'signing'::text, 'retention'::text, 'project'::text, 'overtime_adjustment'::text, 'other'::text])`),
	check("valid_recurring_frequency", sql`(recurring_frequency IS NULL) OR (recurring_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annually'::text]))`),
]);

export const employeeImportStaging = pgTable("employee_import_staging", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	migrationId: uuid("migration_id").notNull(),
	rowNumber: integer("row_number").notNull(),
	employeeNumber: text("employee_number").notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	categoryCode: text("category_code"),
	baseSalary: numeric("base_salary", { precision: 15, scale:  2 }),
	hireDate: date("hire_date"),
	department: text(),
	positionTitle: text("position_title"),
	email: text(),
	phone: text(),
	address: text(),
	familySituation: text("family_situation"),
	sourceData: jsonb("source_data").notNull(),
	validationStatus: text("validation_status").default('pending').notNull(),
	validationErrors: jsonb("validation_errors").default([]),
	validationWarnings: jsonb("validation_warnings").default([]),
	importedEmployeeId: uuid("imported_employee_id"),
	importError: text("import_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_employee_staging_migration").using("btree", table.migrationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.importedEmployeeId],
			foreignColumns: [employees.id],
			name: "employee_import_staging_imported_employee_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.migrationId],
			foreignColumns: [dataMigrations.id],
			name: "employee_import_staging_migration_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("employee_import_staging_via_migration", { as: "permissive", for: "all", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM data_migrations dm
  WHERE ((dm.id = employee_import_staging.migration_id) AND ((dm.tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text)))))` }),
	check("employee_import_staging_validation_status_check", sql`validation_status = ANY (ARRAY['pending'::text, 'valid'::text, 'invalid'::text, 'warning'::text])`),
]);

export const employeeRegisterEntries = pgTable("employee_register_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	entryType: varchar("entry_type", { length: 50 }).notNull(),
	entryDate: date("entry_date").notNull(),
	entryNumber: integer("entry_number").notNull(),
	employeeNumber: varchar("employee_number", { length: 50 }).notNull(),
	fullName: varchar("full_name", { length: 255 }).notNull(),
	dateOfBirth: date("date_of_birth"),
	nationality: varchar({ length: 100 }),
	position: varchar({ length: 255 }),
	department: varchar({ length: 255 }),
	hireDate: date("hire_date"),
	exitDate: date("exit_date"),
	exitReason: varchar("exit_reason", { length: 255 }),
	contractType: varchar("contract_type", { length: 50 }),
	cnpsNumber: varchar("cnps_number", { length: 50 }),
	qualification: varchar({ length: 255 }),
	registeredBy: uuid("registered_by"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_employee_register_entries_tenant_date").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.entryDate.desc().nullsFirst().op("uuid_ops")),
	index("idx_register_tenant_date").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.entryDate.desc().nullsFirst().op("date_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_register_entries_employee_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.registeredBy],
			foreignColumns: [users.id],
			name: "employee_register_entries_registered_by_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employee_register_entries_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_tenant_entry_number").on(table.tenantId, table.entryNumber),
	pgPolicy("register_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
	check("employee_register_entries_entry_type_check", sql`(entry_type)::text = ANY ((ARRAY['hire'::character varying, 'exit'::character varying, 'modification'::character varying])::text[])`),
]);

export const generatedDocuments = pgTable("generated_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id"),
	payrollRunId: uuid("payroll_run_id"),
	documentType: varchar("document_type", { length: 50 }).notNull(),
	fileUrl: text("file_url"),
	fileName: varchar("file_name", { length: 255 }),
	version: integer().default(1),
	generatedBy: uuid("generated_by"),
	generatedAt: timestamp("generated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_documents_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "generated_documents_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.generatedBy],
			foreignColumns: [users.id],
			name: "generated_documents_generated_by_fkey"
		}),
	foreignKey({
			columns: [table.payrollRunId],
			foreignColumns: [payrollRuns.id],
			name: "generated_documents_payroll_run_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "generated_documents_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("documents_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
]);

export const uploadedDocuments = pgTable("uploaded_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id"),
	documentCategory: text("document_category").notNull(),
	documentSubcategory: text("document_subcategory"),
	fileName: text("file_name").notNull(),
	fileUrl: text("file_url").notNull(),
	fileSize: integer("file_size").notNull(),
	mimeType: text("mime_type").notNull(),
	uploadedBy: uuid("uploaded_by").notNull(),
	uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	versionNumber: integer("version_number").default(1).notNull(),
	parentDocumentId: uuid("parent_document_id"),
	isLatestVersion: boolean("is_latest_version").default(true).notNull(),
	versionNotes: text("version_notes"),
	supersededAt: timestamp("superseded_at", { withTimezone: true, mode: 'string' }),
	supersededById: uuid("superseded_by_id"),
	expiryDate: date("expiry_date"),
	tags: text().array(),
	metadata: jsonb().default({}),
	approvalStatus: text("approval_status").default('approved'),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	isArchived: boolean("is_archived").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	signatureRequestId: varchar("signature_request_id", { length: 255 }),
	signatureProvider: varchar("signature_provider", { length: 50 }).default('dropbox_sign'),
	signatureStatus: varchar("signature_status", { length: 50 }),
	signatureUrl: text("signature_url"),
	signedAt: timestamp("signed_at", { withTimezone: true, mode: 'string' }),
	signatureMetadata: jsonb("signature_metadata").default({}),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "uploaded_documents_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "uploaded_documents_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "uploaded_documents_uploaded_by_fkey"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "uploaded_documents_approved_by_fkey"
		}),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid))` }),
	pgPolicy("employee_view_own", { as: "permissive", for: "select", to: ["public"], using: sql`((employee_id = ((auth.jwt() ->> 'employee_id'::text))::uuid))` }),
	pgPolicy("hr_manage_all", { as: "permissive", for: "all", to: ["public"], using: sql`((auth.jwt() ->> 'role'::text) = ANY (ARRAY['HR_MANAGER'::text, 'ADMIN'::text, 'SUPER_ADMIN'::text]))` }),
]);

export const signatureEvents = pgTable("signature_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	documentId: uuid("document_id").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	eventType: text("event_type").notNull(),
	eventTimestamp: timestamp("event_timestamp", { withTimezone: true, mode: 'string' }).defaultNow(),
	signerEmail: text("signer_email"),
	signerName: text("signer_name"),
	signerIpAddress: text("signer_ip_address"),
	signerUserAgent: text("signer_user_agent"),
	signatureProvider: text("signature_provider").default('dropbox_sign'),
	providerEventId: text("provider_event_id"),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [uploadedDocuments.id],
			name: "signature_events_document_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "signature_events_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid))` }),
]);

export const accountingAccounts = pgTable("accounting_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	accountCode: varchar("account_code", { length: 20 }).notNull(),
	accountName: varchar("account_name", { length: 255 }).notNull(),
	accountType: varchar("account_type", { length: 50 }),
	parentAccountCode: varchar("parent_account_code", { length: 20 }),
	isActive: boolean("is_active").default(true),
	accountingSystem: varchar("accounting_system", { length: 50 }).default('SYSCOHADA'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_accounting_accounts_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "accounting_accounts_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("accounting_accounts_tenant_id_account_code_key").on(table.tenantId, table.accountCode),
	pgPolicy("accounting_accounts_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
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
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	sectorCode: varchar("sector_code", { length: 50 }),
	actualMinimumWage: numeric("actual_minimum_wage", { precision: 15, scale:  2 }),
}, (table) => [
	index("idx_category_coefficients_generic").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops")).where(sql`(sector_code IS NULL)`),
	index("idx_category_coefficients_lookup").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("text_ops"), table.sectorCode.asc().nullsLast().op("text_ops")).where(sql`(sector_code IS NOT NULL)`),
	index("idx_employee_categories_coefficient_range").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.minCoefficient.asc().nullsLast().op("text_ops"), table.maxCoefficient.asc().nullsLast().op("int4_ops")),
	index("idx_employee_categories_country").using("btree", table.countryCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "employee_category_coefficients_country_code_fkey"
		}).onDelete("cascade"),
	unique("uk_category_country_sector").on(table.countryCode, table.category, table.sectorCode),
	pgPolicy("Allow read access to all authenticated users", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
	check("check_coefficient_order", sql`min_coefficient <= max_coefficient`),
	check("check_notice_period", sql`notice_period_days > 0`),
	check("check_notice_reduction", sql`(notice_reduction_percent >= 0) AND (notice_reduction_percent <= 100)`),
]);

export const glExports = pgTable("gl_exports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	payrollRunId: uuid("payroll_run_id"),
	exportDate: timestamp("export_date", { withTimezone: true, mode: 'string' }).defaultNow(),
	periodStart: date("period_start").notNull(),
	periodEnd: date("period_end").notNull(),
	exportFormat: varchar("export_format", { length: 50 }),
	fileUrl: text("file_url"),
	totalDebit: numeric("total_debit", { precision: 15, scale:  2 }),
	totalCredit: numeric("total_credit", { precision: 15, scale:  2 }),
	entryCount: integer("entry_count"),
	exportedBy: uuid("exported_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_gl_exports_payroll_run").using("btree", table.payrollRunId.asc().nullsLast().op("timestamptz_ops"), table.exportDate.desc().nullsFirst().op("uuid_ops")),
	index("idx_gl_exports_period").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.periodStart.asc().nullsLast().op("date_ops"), table.periodEnd.asc().nullsLast().op("uuid_ops")),
	index("idx_gl_exports_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.exportedBy],
			foreignColumns: [users.id],
			name: "gl_exports_exported_by_fkey"
		}),
	foreignKey({
			columns: [table.payrollRunId],
			foreignColumns: [payrollRuns.id],
			name: "gl_exports_payroll_run_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "gl_exports_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("gl_exports_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"] }),
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
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: date("expires_at"),
	metadata: jsonb().default({}),
}, (table) => [
	index("idx_leave_balances_employee_policy").using("btree", table.employeeId.asc().nullsLast().op("date_ops"), table.policyId.asc().nullsLast().op("uuid_ops"), table.periodStart.asc().nullsLast().op("uuid_ops")),
	index("idx_time_off_balances_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("date_ops")).where(sql`(expires_at IS NOT NULL)`),
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
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
]);

export const leavePlanningPeriods = pgTable('leave_planning_periods', {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid('tenant_id').notNull(),
	name: text().notNull(),
	year: integer().notNull(),
	quarter: integer(), // 1-4 or null for full year
	status: text().default('draft').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index('idx_leave_planning_periods_tenant').using('btree', table.tenantId.asc().nullsLast().op('uuid_ops')),
	index('idx_leave_planning_periods_year').using('btree', table.year.asc().nullsLast()),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: 'leave_planning_periods_tenant_id_fkey'
	}).onDelete('cascade'),
]);

export const notifications = pgTable('notifications', {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid('user_id').notNull(),
	type: text().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	actionUrl: text('action_url'),
	read: boolean().default(false).notNull(),
	readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index('idx_notifications_user_read').using('btree', table.userId.asc().nullsLast().op('uuid_ops'), table.read.asc().nullsLast(), table.createdAt.desc().nullsFirst()),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: 'notifications_user_id_fkey'
	}).onDelete('cascade'),
]);

export const timeOffRequests = pgTable("time_off_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	policyId: uuid("policy_id").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	returnDate: date("return_date").notNull(),
	totalDays: numeric("total_days", { precision: 4, scale:  1 }).notNull(),
	reason: text(),
	notes: text(),
	status: text().default('pending').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	reviewedBy: uuid("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	planningPeriodId: uuid('planning_period_id'),
	handoverNotes: text('handover_notes'),
	certificateGeneratedAt: timestamp('certificate_generated_at', { withTimezone: true, mode: 'string' }),
	reminder20dSentAt: timestamp('reminder_20d_sent_at', { withTimezone: true, mode: 'string' }),
	reminder15dSentAt: timestamp('reminder_15d_sent_at', { withTimezone: true, mode: 'string' }),
	// ACP (Allocations de Congés Payés) deductibility
	// TRUE = Deduct from paid days (unpaid leave: permission, congé sans solde, grève)
	// FALSE = Don't deduct from paid days (paid leave: congés annuels, maladie, maternité)
	isDeductibleForAcp: boolean("is_deductible_for_acp").default(true).notNull(),
	// Justificatif document for exceptional permissions (Article 25.12)
	justificationDocumentId: uuid("justification_document_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_leave_requests_employee_status").using("btree", table.employeeId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_leave_requests_tenant_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_timeoff_requests_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.startDate.desc().nullsFirst().op("uuid_ops")),
	index("idx_timeoff_requests_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_timeoff_requests_acp_deductible").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.isDeductibleForAcp.asc().nullsLast().op("bool_ops"), table.startDate.asc().nullsLast().op("date_ops"), table.endDate.asc().nullsLast().op("date_ops")),
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
	foreignKey({
			columns: [table.planningPeriodId],
			foreignColumns: [leavePlanningPeriods.id],
			name: "time_off_requests_planning_period_id_fkey"
		}),
	foreignKey({
			columns: [table.justificationDocumentId],
			foreignColumns: [uploadedDocuments.id],
			name: "time_off_requests_justification_document_id_fkey"
		}).onDelete("set null"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("valid_dates", sql`start_date <= end_date`),
	check("valid_status_request", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'planned'::text])`),
]);

export const acpConfiguration = pgTable("acp_configuration", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	daysPerMonthFactor: numeric("days_per_month_factor", { precision: 3, scale: 1 }).default('2.2').notNull(),
	calendarDayMultiplier: numeric("calendar_day_multiplier", { precision: 3, scale: 2 }).default('1.25').notNull(),
	defaultPaidDaysPerMonth: integer("default_paid_days_per_month").default(30).notNull(),
	includesBaseSalary: boolean("includes_base_salary").default(true).notNull(),
	includesTaxableAllowances: boolean("includes_taxable_allowances").default(true).notNull(),
	referencePeriodType: varchar("reference_period_type", { length: 20 }).default('since_last_leave').notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_acp_config_country").using("btree", table.countryCode.asc().nullsLast().op("varchar_ops")),
	index("idx_acp_config_effective").using("btree", table.countryCode.asc().nullsLast().op("varchar_ops"), table.effectiveFrom.desc().nullsFirst().op("date_ops")),
	foreignKey({
		columns: [table.countryCode],
		foreignColumns: [countries.code],
		name: "acp_configuration_country_code_fkey"
	}).onUpdate("cascade").onDelete("restrict"),
	unique("acp_configuration_country_code_effective_from_key").on(table.countryCode, table.effectiveFrom),
	check("acp_config_valid_multiplier", sql`(calendar_day_multiplier >= 1.0) AND (calendar_day_multiplier <= 2.0)`),
	check("acp_config_valid_days_factor", sql`(days_per_month_factor >= 0) AND (days_per_month_factor <= 5.0)`),
	check("acp_config_valid_reference_period", sql`reference_period_type = ANY (ARRAY['since_last_leave'::text, 'calendar_year'::text, 'rolling_12_months'::text])`),
]);

export const acpPaymentHistory = pgTable("acp_payment_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	payrollRunId: uuid("payroll_run_id").notNull(),
	referencePeriodStart: date("reference_period_start").notNull(),
	referencePeriodEnd: date("reference_period_end").notNull(),
	numberOfMonths: numeric("number_of_months", { precision: 5, scale: 2 }).notNull(),
	totalGrossTaxableSalary: numeric("total_gross_taxable_salary", { precision: 15, scale: 2 }).notNull(),
	totalPaidDays: integer("total_paid_days").notNull(),
	nonDeductibleAbsenceDays: integer("non_deductible_absence_days").default(0).notNull(),
	dailyAverageSalary: numeric("daily_average_salary", { precision: 15, scale: 2 }).notNull(),
	leaveDaysAccruedBase: numeric("leave_days_accrued_base", { precision: 5, scale: 2 }).notNull(),
	seniorityBonusDays: integer("seniority_bonus_days").default(0).notNull(),
	leaveDaysAccruedTotal: numeric("leave_days_accrued_total", { precision: 5, scale: 2 }).notNull(),
	leaveDaysTakenCalendar: numeric("leave_days_taken_calendar", { precision: 5, scale: 2 }).notNull(),
	acpAmount: numeric("acp_amount", { precision: 15, scale: 2 }).notNull(),
	acpConfigurationId: uuid("acp_configuration_id"),
	calculationMetadata: jsonb("calculation_metadata").default({}).notNull(),
	warnings: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_acp_history_created").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_acp_history_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_acp_history_payroll_run").using("btree", table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	index("idx_acp_history_reference_period").using("btree", table.referencePeriodStart.asc().nullsLast().op("date_ops"), table.referencePeriodEnd.asc().nullsLast().op("date_ops")),
	index("idx_acp_history_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.acpConfigurationId],
		foreignColumns: [acpConfiguration.id],
		name: "acp_payment_history_acp_configuration_id_fkey"
	}),
	foreignKey({
		columns: [table.createdBy],
		foreignColumns: [users.id],
		name: "acp_payment_history_created_by_fkey"
	}),
	foreignKey({
		columns: [table.employeeId],
		foreignColumns: [employees.id],
		name: "acp_payment_history_employee_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.payrollRunId],
		foreignColumns: [payrollRuns.id],
		name: "acp_payment_history_payroll_run_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: "acp_payment_history_tenant_id_fkey"
	}).onDelete("cascade"),
	uniqueIndex("idx_acp_history_unique_payment").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.payrollRunId.asc().nullsLast().op("uuid_ops")),
	pgPolicy("acp_history_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
	check("chk_acp_amount_non_negative", sql`acp_amount >= 0`),
	check("chk_daily_salary_positive", sql`daily_average_salary > 0`),
	check("chk_months_positive", sql`number_of_months > 0`),
	check("chk_reference_period_valid", sql`reference_period_end >= reference_period_start`),
]);

export const employeeSiteAssignments = pgTable("employee_site_assignments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	employeeId: uuid("employee_id").notNull(),
	locationId: uuid("location_id").notNull(),
	assignmentDate: date("assignment_date").notNull(),
	startTime: time("start_time"),
	endTime: time("end_time"),
	hoursWorked: numeric("hours_worked", { precision: 5, scale:  2 }),
	isPrimarySite: boolean("is_primary_site").default(false),
	isOvertimeEligible: boolean("is_overtime_eligible").default(true),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_site_assignments_date").using("btree", table.assignmentDate.asc().nullsLast().op("date_ops")),
	index("idx_site_assignments_employee_date").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.assignmentDate.asc().nullsLast().op("uuid_ops")),
	index("idx_site_assignments_location_date").using("btree", table.locationId.asc().nullsLast().op("date_ops"), table.assignmentDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_site_assignments_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "employee_site_assignments_location_id_fkey"
		}).onDelete("cascade"),
	unique("assignment_unique_employee_date").on(table.employeeId, table.locationId, table.assignmentDate),
	pgPolicy("site_assignments_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(EXISTS ( SELECT 1
   FROM employees
  WHERE ((employees.id = employee_site_assignments.employee_id) AND (((employees.tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text)))))`, withCheck: sql`(EXISTS ( SELECT 1
   FROM employees
  WHERE ((employees.id = employee_site_assignments.employee_id) AND ((employees.tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)))))`  }),
]);

export const bonuses = pgTable("bonuses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	bonusType: varchar("bonus_type", { length: 50 }).notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	currency: varchar({ length: 3 }).default('XOF').notNull(),
	period: date().notNull(),
	description: text(),
	notes: text(),
	isTaxable: boolean("is_taxable").default(true).notNull(),
	isSubjectToSocialSecurity: boolean("is_subject_to_social_security").default(true).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	rejectedReason: text("rejected_reason"),
	includedInPayrollRunId: uuid("included_in_payroll_run_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
}, (table) => [
	index("idx_bonuses_employee_created").using("btree", table.employeeId.asc().nullsLast().op("timestamp_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("idx_bonuses_payroll_run").using("btree", table.includedInPayrollRunId.asc().nullsLast().op("uuid_ops")).where(sql`(included_in_payroll_run_id IS NOT NULL)`),
	index("idx_bonuses_status_period").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops"), table.period.asc().nullsLast().op("date_ops")).where(sql`((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying])::text[]))`),
	index("idx_bonuses_tenant_employee_period").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.employeeId.asc().nullsLast().op("uuid_ops"), table.period.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "bonuses_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "bonuses_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "bonuses_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "bonuses_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("approved_fields_consistency", sql`(((status)::text = 'approved'::text) AND (approved_by IS NOT NULL) AND (approved_at IS NOT NULL)) OR ((status)::text <> 'approved'::text)`),
	check("bonuses_amount_check", sql`amount > (0)::numeric`),
	check("valid_bonus_type", sql`(bonus_type)::text = ANY ((ARRAY['performance'::character varying, 'holiday'::character varying, 'project'::character varying, 'sales_commission'::character varying, 'attendance'::character varying, 'retention'::character varying, 'other'::character varying])::text[])`),
	check("valid_period", sql`EXTRACT(day FROM period) = (1)::numeric`),
	check("valid_status", sql`(status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'paid'::character varying, 'cancelled'::character varying])::text[])`),
]);

export const cityTransportMinimums = pgTable("city_transport_minimums", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	countryCode: varchar("country_code", { length: 2 }).notNull(),
	cityName: varchar("city_name", { length: 100 }).notNull(),
	cityNameNormalized: varchar("city_name_normalized", { length: 100 }).notNull(),
	displayName: jsonb("display_name").notNull(),
	monthlyMinimum: numeric("monthly_minimum", { precision: 15, scale:  2 }).notNull(),
	dailyRate: numeric("daily_rate", { precision: 15, scale:  2 }).notNull(),
	taxExemptionCap: numeric("tax_exemption_cap", { precision: 15, scale:  2 }),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	legalReference: jsonb("legal_reference"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_city_transport_country_date").using("btree", table.countryCode.asc().nullsLast().op("date_ops"), table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_city_transport_normalized").using("btree", table.cityNameNormalized.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.countryCode],
			foreignColumns: [countries.code],
			name: "city_transport_minimums_country_code_fkey"
		}).onDelete("cascade"),
	unique("city_transport_minimums_country_code_city_name_normalized_e_key").on(table.countryCode, table.cityNameNormalized, table.effectiveFrom),
]);

export const variablePayInputs = pgTable("variable_pay_inputs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	componentCode: varchar("component_code", { length: 50 }).notNull(),
	period: date().notNull(),
	amount: numeric({ precision: 15, scale:  2 }).notNull(),
	notes: text(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	entryDate: date("entry_date").notNull(),
}, (table) => [
	index("idx_variable_pay_component").using("btree", table.componentCode.asc().nullsLast().op("text_ops")),
	index("idx_variable_pay_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_variable_pay_lookup").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.employeeId.asc().nullsLast().op("uuid_ops"), table.period.asc().nullsLast().op("uuid_ops")),
	index("idx_variable_pay_period").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.period.asc().nullsLast().op("uuid_ops")),
	index("idx_variable_pay_period_sum").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.employeeId.asc().nullsLast().op("uuid_ops"), table.period.asc().nullsLast().op("uuid_ops")),
	index("idx_variable_pay_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "variable_pay_inputs_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "variable_pay_inputs_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "variable_pay_inputs_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_employee_component_date").on(table.tenantId, table.employeeId, table.componentCode, table.entryDate),
	pgPolicy("super_admin_access", { as: "permissive", for: "all", to: ["authenticated"], using: sql`((auth.jwt() ->> 'role'::text) = 'super_admin'::text)`, withCheck: sql`((auth.jwt() ->> 'role'::text) = 'super_admin'::text)`  }),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"] }),
	check("variable_pay_inputs_amount_check", sql`amount >= (0)::numeric`),
]);

export const contractComplianceAlerts = pgTable("contract_compliance_alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	contractId: uuid("contract_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	alertType: varchar("alert_type", { length: 50 }).notNull(),
	alertSeverity: varchar("alert_severity", { length: 20 }).default('warning').notNull(),
	alertDate: date("alert_date").notNull(),
	alertMessage: text("alert_message").notNull(),
	isDismissed: boolean("is_dismissed").default(false).notNull(),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }),
	dismissedBy: uuid("dismissed_by"),
	actionTaken: varchar("action_taken", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_alerts_active").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.alertDate.asc().nullsLast().op("date_ops"), table.isDismissed.asc().nullsLast().op("date_ops")).where(sql`(is_dismissed = false)`),
	index("idx_alerts_contract").using("btree", table.contractId.asc().nullsLast().op("uuid_ops")),
	index("idx_alerts_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [employmentContracts.id],
			name: "contract_compliance_alerts_contract_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.dismissedBy],
			foreignColumns: [users.id],
			name: "contract_compliance_alerts_dismissed_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "contract_compliance_alerts_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contract_compliance_alerts_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("contract_compliance_alerts_action_taken_check", sql`(action_taken)::text = ANY ((ARRAY['converted_to_cdi'::character varying, 'renewed'::character varying, 'terminated'::character varying, 'ignored'::character varying])::text[])`),
	check("contract_compliance_alerts_alert_severity_check", sql`(alert_severity)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::text[])`),
	check("contract_compliance_alerts_alert_type_check", sql`(alert_type)::text = ANY ((ARRAY['90_day_warning'::character varying, '60_day_warning'::character varying, '30_day_warning'::character varying, '2_year_limit'::character varying, '2_renewal_limit'::character varying, 'renewal_warning'::character varying])::text[])`),
]);

export const dailyHoursEntries = pgTable("daily_hours_entries", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	period: date().notNull(),
	entryDate: date("entry_date").notNull(),
	regularHours: numeric("regular_hours", { precision: 5, scale:  2 }).default('0').notNull(),
	overtimeHours: numeric("overtime_hours", { precision: 5, scale:  2 }).default('0'),
	entryType: text("entry_type").default('regular').notNull(),
	locationId: uuid("location_id"),
	status: text().default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	notes: text(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_daily_hours_entry_date").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.entryDate.asc().nullsLast().op("uuid_ops")),
	index("idx_daily_hours_period_sum").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.employeeId.asc().nullsLast().op("date_ops"), table.period.asc().nullsLast().op("uuid_ops")),
	index("idx_daily_hours_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "daily_hours_entries_approved_by_fkey"
		}),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "daily_hours_entries_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "daily_hours_entries_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "daily_hours_entries_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("unique_employee_date").on(table.tenantId, table.employeeId, table.entryDate),
	pgPolicy("tenant_isolation_daily_hours", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
]);

export const timeEntries = pgTable("time_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	clockIn: timestamp("clock_in", { withTimezone: true, mode: 'string' }).notNull(),
	clockOut: timestamp("clock_out", { withTimezone: true, mode: 'string' }),
	totalHours: numeric("total_hours", { precision: 5, scale:  2 }),
	clockInLocation: geography("clock_in_location"),
	clockOutLocation: geography("clock_out_location"),
	geofenceVerified: boolean("geofence_verified").default(false),
	clockInPhotoUrl: text("clock_in_photo_url"),
	clockOutPhotoUrl: text("clock_out_photo_url"),
	entryType: text("entry_type").default('regular').notNull(),
	status: text().default('pending').notNull(),
	approvedBy: uuid("approved_by"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectionReason: text("rejection_reason"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	overtimeBreakdown: jsonb("overtime_breakdown").default({}),
	locationId: uuid("location_id"),
	entrySource: text("entry_source").default('clock_in_out').notNull(),
	importMetadata: jsonb("import_metadata"),
}, (table) => [
	index("idx_time_entries_employee").using("btree", table.employeeId.asc().nullsLast().op("timestamptz_ops"), table.clockIn.desc().nullsFirst().op("uuid_ops")),
	index("idx_time_entries_employee_date").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops"), table.clockIn.asc().nullsLast().op("uuid_ops")),
	index("idx_time_entries_entry_source").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.entrySource.asc().nullsLast().op("text_ops")),
	index("idx_time_entries_biometric").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.entrySource.asc().nullsLast().op("text_ops"), table.clockIn.desc().nullsFirst().op("timestamptz_ops")).where(sql`(entry_source = 'biometric'::text)`),
	index("idx_time_entries_location").using("btree", table.locationId.asc().nullsLast().op("uuid_ops")).where(sql`(location_id IS NOT NULL)`),
	index("idx_time_entries_status").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_time_entries_status_pending").using("btree", table.tenantId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.clockIn.desc().nullsFirst().op("text_ops")).where(sql`(status = 'pending'::text)`),
	index("idx_time_entries_tenant_clock_in").using("btree", table.tenantId.asc().nullsLast().op("timestamptz_ops"), table.clockIn.desc().nullsFirst().op("timestamptz_ops")),
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
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "time_entries_location_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "time_entries_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("check_entry_source", sql`entry_source = ANY (ARRAY['clock_in_out'::text, 'manual'::text, 'biometric'::text])`),
	check("valid_entry_type", sql`entry_type = ANY (ARRAY['regular'::text, 'overtime'::text, 'on_call'::text])`),
	check("valid_status_time_entry", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
	check("valid_time", sql`(clock_out IS NULL) OR (clock_out > clock_in)`),
]);

export const contractRenewalHistory = pgTable("contract_renewal_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	originalContractId: uuid("original_contract_id").notNull(),
	renewalNumber: integer("renewal_number").notNull(),
	renewalContractId: uuid("renewal_contract_id"),
	previousEndDate: date("previous_end_date").notNull(),
	newEndDate: date("new_end_date").notNull(),
	renewalDurationMonths: integer("renewal_duration_months").notNull(),
	cumulativeDurationMonths: integer("cumulative_duration_months").notNull(),
	renewalReason: text("renewal_reason"),
	renewedBy: uuid("renewed_by"),
	renewedAt: timestamp("renewed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_renewal_history_original").using("btree", table.originalContractId.asc().nullsLast().op("int4_ops"), table.renewalNumber.asc().nullsLast().op("int4_ops")),
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
	check("valid_duration", sql`(renewal_duration_months > 0) AND (cumulative_duration_months > 0)`),
	check("valid_renewal_dates", sql`new_end_date > previous_end_date`),
	check("valid_renewal_number", sql`renewal_number > 0`),
]);

export const employeeDependents = pgTable("employee_dependents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	employeeId: uuid("employee_id").notNull(),
	tenantId: uuid("tenant_id").notNull(),
	firstName: varchar("first_name", { length: 100 }).notNull(),
	lastName: varchar("last_name", { length: 100 }).notNull(),
	dateOfBirth: date("date_of_birth").notNull(),
	relationship: varchar({ length: 50 }).notNull(),
	gender: varchar({ length: 20 }),
	cnpsNumber: varchar("cnps_number", { length: 50 }),
	cmuNumber: varchar("cmu_number", { length: 50 }),
	coveredByOtherEmployer: boolean("covered_by_other_employer").default(false).notNull(),
	coverageCertificateType: varchar("coverage_certificate_type", { length: 100 }),
	coverageCertificateNumber: varchar("coverage_certificate_number", { length: 100 }),
	coverageCertificateUrl: text("coverage_certificate_url"),
	coverageCertificateExpiryDate: date("coverage_certificate_expiry_date"),
	isVerified: boolean("is_verified").default(false).notNull(),
	requiresDocument: boolean("requires_document").default(false).notNull(),
	documentType: varchar("document_type", { length: 100 }),
	documentNumber: varchar("document_number", { length: 100 }),
	documentIssueDate: date("document_issue_date"),
	documentExpiryDate: date("document_expiry_date"),
	documentUrl: text("document_url"),
	documentNotes: text("document_notes"),
	eligibleForFiscalParts: boolean("eligible_for_fiscal_parts").default(true).notNull(),
	eligibleForCmu: boolean("eligible_for_cmu").default(true).notNull(),
	notes: text(),
	status: varchar({ length: 20 }).default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_employee_dependents_document_expiry").using("btree", table.documentExpiryDate.asc().nullsLast().op("date_ops")).where(sql`((document_expiry_date IS NOT NULL) AND ((status)::text = 'active'::text))`),
	index("idx_employee_dependents_employee_id").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_dependents_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_employee_dependents_tenant_id").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
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
	pgPolicy("tenant_isolation_delete", { as: "permissive", for: "delete", to: ["public"], using: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)` }),
	pgPolicy("tenant_isolation_insert", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("tenant_isolation_select", { as: "permissive", for: "select", to: ["public"] }),
	pgPolicy("tenant_isolation_update", { as: "permissive", for: "update", to: ["public"] }),
]);

export const benefitPlans = pgTable("benefit_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	planName: varchar("plan_name", { length: 255 }).notNull(),
	planCode: varchar("plan_code", { length: 50 }).notNull(),
	benefitType: varchar("benefit_type", { length: 50 }).notNull(),
	description: text(),
	providerName: varchar("provider_name", { length: 255 }),
	coverageLevel: varchar("coverage_level", { length: 50 }),
	employeeCost: numeric("employee_cost", { precision: 12, scale:  2 }),
	employerCost: numeric("employer_cost", { precision: 12, scale:  2 }),
	totalCost: numeric("total_cost", { precision: 12, scale:  2 }),
	currency: varchar({ length: 3 }).default('XOF'),
	costFrequency: varchar("cost_frequency", { length: 20 }).default('monthly'),
	eligibleEmployeeTypes: jsonb("eligible_employee_types"),
	waitingPeriodDays: integer("waiting_period_days").default(0),
	requiresDependentVerification: boolean("requires_dependent_verification").default(false),
	isActive: boolean("is_active").default(true),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
	linksToSalaryComponentId: uuid("links_to_salary_component_id"),
	customFields: jsonb("custom_fields").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_benefit_plans_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_benefit_plans_effective_dates").using("btree", table.effectiveFrom.asc().nullsLast().op("date_ops"), table.effectiveTo.asc().nullsLast().op("date_ops")),
	index("idx_benefit_plans_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_benefit_plans_type").using("btree", table.benefitType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "benefit_plans_created_by_fkey"
		}),
	foreignKey({
			columns: [table.linksToSalaryComponentId],
			foreignColumns: [salaryComponentDefinitions.id],
			name: "benefit_plans_links_to_salary_component_id_fkey"
		}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "benefit_plans_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "benefit_plans_updated_by_fkey"
		}),
	unique("benefit_plans_tenant_id_plan_code_key").on(table.tenantId, table.planCode),
	check("valid_benefit_type", sql`(benefit_type)::text = ANY ((ARRAY['health'::character varying, 'dental'::character varying, 'vision'::character varying, 'life_insurance'::character varying, 'retirement'::character varying, 'disability'::character varying, 'transport'::character varying, 'meal'::character varying, 'other'::character varying])::text[])`),
	check("valid_cost_frequency", sql`(cost_frequency)::text = ANY ((ARRAY['monthly'::character varying, 'annual'::character varying, 'per_payroll'::character varying])::text[])`),
]);

export const employeeBenefitEnrollments = pgTable("employee_benefit_enrollments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	benefitPlanId: uuid("benefit_plan_id").notNull(),
	enrollmentDate: date("enrollment_date").notNull(),
	effectiveDate: date("effective_date").notNull(),
	terminationDate: date("termination_date"),
	enrollmentNumber: varchar("enrollment_number", { length: 100 }),
	policyNumber: varchar("policy_number", { length: 100 }),
	coverageLevel: varchar("coverage_level", { length: 50 }),
	coveredDependents: jsonb("covered_dependents").default([]),
	employeeCostOverride: numeric("employee_cost_override", { precision: 12, scale:  2 }),
	employerCostOverride: numeric("employer_cost_override", { precision: 12, scale:  2 }),
	enrollmentStatus: varchar("enrollment_status", { length: 50 }).default('active'),
	terminationReason: varchar("termination_reason", { length: 255 }),
	enrollmentDocumentUrl: text("enrollment_document_url"),
	beneficiaryDesignation: jsonb("beneficiary_designation"),
	notes: text(),
	customFields: jsonb("custom_fields").default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
}, (table) => [
	index("idx_employee_benefit_enrollments_effective_date").using("btree", table.effectiveDate.asc().nullsLast().op("date_ops")),
	index("idx_employee_benefit_enrollments_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_benefit_enrollments_enrollment_number").using("btree", table.enrollmentNumber.asc().nullsLast().op("text_ops")).where(sql`(enrollment_number IS NOT NULL)`),
	index("idx_employee_benefit_enrollments_plan").using("btree", table.benefitPlanId.asc().nullsLast().op("uuid_ops")),
	index("idx_employee_benefit_enrollments_status").using("btree", table.enrollmentStatus.asc().nullsLast().op("text_ops")).where(sql`((enrollment_status)::text = 'active'::text)`),
	index("idx_employee_benefit_enrollments_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.benefitPlanId],
			foreignColumns: [benefitPlans.id],
			name: "employee_benefit_enrollments_benefit_plan_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "employee_benefit_enrollments_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_benefit_enrollments_employee_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employee_benefit_enrollments_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "employee_benefit_enrollments_updated_by_fkey"
		}),
	check("valid_enrollment_dates", sql`effective_date >= enrollment_date`),
	check("valid_enrollment_status", sql`(enrollment_status)::text = ANY ((ARRAY['active'::character varying, 'pending'::character varying, 'terminated'::character varying, 'suspended'::character varying])::text[])`),
	check("valid_termination_date", sql`(termination_date IS NULL) OR (termination_date >= effective_date)`),
]);

export const employmentContracts: any = pgTable("employment_contracts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	employeeId: uuid("employee_id").notNull(),
	contractType: varchar("contract_type", { length: 20 }).notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	renewalCount: integer("renewal_count").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
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
	cddtiTaskDescription: text("cddti_task_description"),
	contractHtmlContent: text("contract_html_content"),
	contractTemplateSource: varchar("contract_template_source", { length: 50 }),
}, (table) => [
	index("idx_contracts_employee").using("btree", table.employeeId.asc().nullsLast().op("uuid_ops")),
	index("idx_employment_contracts_cddti").using("btree", table.employeeId.asc().nullsLast().op("date_ops"), table.contractType.asc().nullsLast().op("date_ops"), table.startDate.asc().nullsLast().op("date_ops")).where(sql`((contract_type)::text = 'CDDTI'::text)`),
	index("idx_employment_contracts_employee_active").using("btree", table.employeeId.asc().nullsLast().op("bool_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "employment_contracts_created_by_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employment_contracts_employee_id_fkey"
		}).onDelete("restrict"),
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
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employment_contracts_tenant_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("contracts_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))` }),
	check("cddti_task_recommended", sql`((contract_type)::text <> 'CDDTI'::text) OR (cddti_task_description IS NOT NULL)`),
	check("valid_cdd_end_date", sql`(((contract_type)::text = ANY ((ARRAY['CDI'::character varying, 'CDDTI'::character varying])::text[])) AND (end_date IS NULL)) OR (((contract_type)::text = ANY ((ARRAY['CDD'::character varying, 'INTERIM'::character varying, 'STAGE'::character varying])::text[])) AND (end_date IS NOT NULL))`),
	check("valid_contract_type", sql`(contract_type)::text = ANY ((ARRAY['CDI'::character varying, 'CDD'::character varying, 'CDDTI'::character varying, 'INTERIM'::character varying, 'STAGE'::character varying])::text[])`),
	check("valid_dates", sql`(end_date IS NULL) OR (end_date > start_date)`),
	check("valid_renewal_count", sql`(renewal_count >= 0) AND (renewal_count <= 2)`),
]);

export const employeeBenefitEnrollmentHistory = pgTable("employee_benefit_enrollment_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	enrollmentId: uuid("enrollment_id").notNull(),
	changeType: varchar("change_type", { length: 50 }).notNull(),
	changeDescription: text("change_description"),
	previousValues: jsonb("previous_values"),
	newValues: jsonb("new_values"),
	changeDate: date("change_date").notNull(),
	changeReason: varchar("change_reason", { length: 255 }),
	effectiveDate: date("effective_date").notNull(),
	changedBy: uuid("changed_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_employee_benefit_enrollment_history_change_date").using("btree", table.changeDate.asc().nullsLast().op("date_ops")),
	index("idx_employee_benefit_enrollment_history_enrollment").using("btree", table.enrollmentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.changedBy],
			foreignColumns: [users.id],
			name: "employee_benefit_enrollment_history_changed_by_fkey"
		}),
	foreignKey({
			columns: [table.enrollmentId],
			foreignColumns: [employeeBenefitEnrollments.id],
			name: "employee_benefit_enrollment_history_enrollment_id_fkey"
		}).onDelete("cascade"),
	check("valid_change_type", sql`(change_type)::text = ANY ((ARRAY['enrolled'::character varying, 'modified'::character varying, 'terminated'::character varying, 'cost_changed'::character varying, 'dependent_added'::character varying, 'dependent_removed'::character varying, 'status_changed'::character varying])::text[])`),
]);

export const employees: any = pgTable("employees", {
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
	addressLine1: text("address_line1"),
	addressLine2: text("address_line2"),
	city: text(),
	postalCode: text("postal_code"),
	countryCode: text("country_code").default('CI').notNull(),
	hireDate: date("hire_date").notNull(),
	terminationDate: date("termination_date"),
	terminationReason: text("termination_reason"),
	bankName: text("bank_name"),
	bankAccount: text("bank_account"),
	cnpsNumber: text("cnps_number"),
	taxNumber: text("tax_number"),
	taxDependents: integer("tax_dependents").default(0).notNull(),
	customFields: jsonb("custom_fields").default({}).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
	coefficient: integer().default(100).notNull(),
	terminationId: uuid("termination_id"),
	reportingManagerId: uuid("reporting_manager_id"),
	maritalStatus: varchar("marital_status", { length: 20 }),
	dependentChildren: integer("dependent_children").default(0),
	fiscalParts: numeric("fiscal_parts", { precision: 3, scale:  1 }).default('1.0'),
	hasFamily: boolean("has_family").default(false),
	nationalIdExpiry: date("national_id_expiry"),
	workPermitExpiry: date("work_permit_expiry"),
	rateType: rateTypeEnum("rate_type").default('MONTHLY').notNull(),
	conventionCode: varchar("convention_code", { length: 50 }),
	professionalLevel: integer("professional_level"),
	sector: varchar({ length: 50 }).default('services'),
	categoryCode: varchar("category_code", { length: 10 }),
	sectorCodeCgeci: varchar("sector_code_cgeci", { length: 50 }),
	primaryLocationId: uuid("primary_location_id"),
	dailyRate: numeric("daily_rate", { precision: 10, scale:  2 }),
	hourlyRate: numeric("hourly_rate", { precision: 10, scale:  2 }),
	isExpat: boolean("is_expat").default(false).notNull(),
	identityDocumentType: varchar("identity_document_type", { length: 20 }),
	nationalityZone: varchar("nationality_zone", { length: 20 }),
	employeeType: varchar("employee_type", { length: 50 }),
	fatherName: varchar("father_name", { length: 255 }),
	motherName: varchar("mother_name", { length: 255 }),
	emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
	placeOfBirth: varchar("place_of_birth", { length: 255 }),
	nationality: varchar({ length: 100 }),
	emergencyContactPhone: varchar("emergency_contact_phone", { length: 50 }),
	contractType: varchar("contract_type", { length: 50 }),
	jobTitle: text("job_title"),
	profession: text(),
	qualification: varchar({ length: 100 }),
	employmentClassification: varchar("employment_classification", { length: 50 }),
	salaryRegime: varchar("salary_regime", { length: 50 }),
	workSite: text("work_site"),
	section: text(),
	service: text(),
	division: text(),
	establishment: text(),
	cmuNumber: text("cmu_number"),
	categoricalSalary: numeric("categorical_salary", { precision: 15, scale:  2 }),
	salaryPremium: numeric("salary_premium", { precision: 15, scale:  2 }),
	// Historical leave data (before system implementation)
	initialLeaveBalance: numeric("initial_leave_balance", { precision: 5, scale:  2 }),
	historicalUnpaidLeaveDays: numeric("historical_unpaid_leave_days", { precision: 5, scale:  2 }),
	lastAnnualLeaveEndDate: date("last_annual_leave_end_date"), // Date employee returned from last annual leave (used for ACP reference period)
	weeklyHoursRegime: varchar("weekly_hours_regime", { length: 10 }).default('40h').notNull(),
	paymentFrequency: varchar("payment_frequency", { length: 20 }).default('MONTHLY').notNull(),
	currentContractId: uuid("current_contract_id"),
	// ACP (Allocations de Congés Payés) fields
	acpPaymentDate: date("acp_payment_date"),
	acpPaymentActive: boolean("acp_payment_active").default(false),
	acpLastPaidAt: timestamp("acp_last_paid_at", { withTimezone: true, mode: 'string' }),
	acpNotes: text("acp_notes"),

	// Employee Protection fields (for labor law compliance)
	// Note: Medical certificates are stored in uploaded_documents table with versioning/signatures
	isPregnant: boolean("is_pregnant").default(false),
	pregnancyStartDate: date("pregnancy_start_date"),
	expectedDeliveryDate: date("expected_delivery_date"),
	medicalExemptionNightWork: boolean("medical_exemption_night_work").default(false),
	medicalExemptionExpiryDate: date("medical_exemption_expiry_date"),
}, (table) => [
	index("idx_employees_cgeci_category").using("btree", table.categoryCode.asc().nullsLast().op("text_ops"), table.sectorCodeCgeci.asc().nullsLast().op("text_ops")).where(sql`(category_code IS NOT NULL)`),
	index("idx_employees_cmu_number").using("btree", table.cmuNumber.asc().nullsLast().op("text_ops")),
	index("idx_employees_coefficient").using("btree", table.coefficient.asc().nullsLast().op("int4_ops")),
	index("idx_employees_contract_type").using("btree", table.contractType.asc().nullsLast().op("text_ops")),
	index("idx_employees_convention_code").using("btree", table.conventionCode.asc().nullsLast().op("text_ops")),
	index("idx_employees_country_cgeci").using("btree", table.countryCode.asc().nullsLast().op("text_ops"), table.categoryCode.asc().nullsLast().op("text_ops"), table.sectorCodeCgeci.asc().nullsLast().op("text_ops")).where(sql`(category_code IS NOT NULL)`),
	index("idx_employees_current_contract").using("btree", table.currentContractId.asc().nullsLast().op("uuid_ops")).where(sql`(current_contract_id IS NOT NULL)`),
	index("idx_employees_division").using("btree", table.division.asc().nullsLast().op("text_ops")),
	index("idx_employees_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("idx_employees_employee_type").using("btree", table.employeeType.asc().nullsLast().op("text_ops")),
	index("idx_employees_establishment").using("btree", table.establishment.asc().nullsLast().op("text_ops")),
	index("idx_employees_hire_date").using("btree", table.tenantId.asc().nullsLast().op("date_ops"), table.hireDate.asc().nullsLast().op("date_ops")),
	index("idx_employees_nationality_zone").using("btree", table.nationalityZone.asc().nullsLast().op("text_ops")),
	index("idx_employees_number").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.employeeNumber.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_payment_frequency").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.paymentFrequency.asc().nullsLast().op("uuid_ops")).where(sql`(status = 'active'::text)`),
	index("idx_employees_primary_location").using("btree", table.primaryLocationId.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_professional_level").using("btree", table.professionalLevel.asc().nullsLast().op("int4_ops")),
	index("idx_employees_rate_type").using("btree", table.rateType.asc().nullsLast().op("enum_ops")),
	index("idx_employees_reporting_manager").using("btree", table.reportingManagerId.asc().nullsLast().op("uuid_ops")).where(sql`(reporting_manager_id IS NOT NULL)`),
	index("idx_employees_sector").using("btree", table.sector.asc().nullsLast().op("text_ops")).where(sql`(sector IS NOT NULL)`),
	index("idx_employees_status").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_termination").using("btree", table.terminationId.asc().nullsLast().op("uuid_ops")),
	index("idx_employees_weekly_hours").using("btree", table.weeklyHoursRegime.asc().nullsLast().op("text_ops")),
	index("idx_employees_work_site").using("btree", table.workSite.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "employees_created_by_fkey"
		}),
	foreignKey({
			columns: [table.currentContractId],
			foreignColumns: [employmentContracts.id],
			name: "employees_current_contract_id_fkey"
		}),
	foreignKey({
			columns: [table.primaryLocationId],
			foreignColumns: [locations.id],
			name: "employees_primary_location_id_fkey"
		}),
	foreignKey({
			columns: [table.reportingManagerId],
			foreignColumns: [table.id],
			name: "employees_reporting_manager_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "employees_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.terminationId],
			foreignColumns: [employeeTerminations.id],
			name: "employees_termination_id_fkey"
		}),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [users.id],
			name: "employees_updated_by_fkey"
		}),
	unique("unique_employee_number").on(table.tenantId, table.employeeNumber),
	pgPolicy("tenant_isolation", { as: "permissive", for: "all", to: ["tenant_user"], using: sql`((tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`(tenant_id = ((auth.jwt() ->> 'tenant_id'::text))::uuid)`  }),
	check("check_coefficient_range", sql`(coefficient >= 90) AND (coefficient <= 1000)`),
	check("employees_employee_type_check", sql`(employee_type)::text = ANY ((ARRAY['LOCAL'::character varying, 'EXPAT'::character varying, 'DETACHE'::character varying, 'STAGIAIRE'::character varying])::text[])`),
	check("employees_nationality_zone_check", sql`(nationality_zone)::text = ANY (ARRAY[('CEDEAO'::character varying)::text, ('HORS_CEDEAO'::character varying)::text, ('LOCAL'::character varying)::text])`),
	check("valid_gender", sql`(gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text, 'prefer_not_to_say'::text])) OR (gender IS NULL)`),
	check("valid_marital_status", sql`((marital_status)::text = ANY (ARRAY['single'::text, 'married'::text, 'divorced'::text, 'widowed'::text])) OR (marital_status IS NULL)`),
	check("valid_payment_frequency", sql`(payment_frequency)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'MONTHLY'::character varying])::text[])`),
	check("valid_status", sql`status = ANY (ARRAY['active'::text, 'terminated'::text, 'suspended'::text])`),
	check("valid_weekly_hours_regime", sql`(weekly_hours_regime)::text = ANY ((ARRAY['40h'::character varying, '44h'::character varying, '48h'::character varying, '52h'::character varying, '56h'::character varying])::text[])`),
]);

export const locations = pgTable("locations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	locationCode: varchar("location_code", { length: 20 }).notNull(),
	locationName: varchar("location_name", { length: 255 }).notNull(),
	locationType: varchar("location_type", { length: 50 }).notNull(),
	addressLine1: text("address_line1"),
	addressLine2: text("address_line2"),
	city: varchar({ length: 100 }),
	postalCode: varchar("postal_code", { length: 20 }),
	countryCode: varchar("country_code", { length: 2 }).default('CI'),
	latitude: numeric({ precision: 10, scale:  8 }),
	longitude: numeric({ precision: 11, scale:  8 }),
	geofenceRadiusMeters: integer("geofence_radius_meters").default(100),
	transportAllowance: numeric("transport_allowance", { precision: 15, scale:  2 }).default('0'),
	mealAllowance: numeric("meal_allowance", { precision: 15, scale:  2 }).default('0'),
	sitePremium: numeric("site_premium", { precision: 15, scale:  2 }).default('0'),
	hazardPayRate: numeric("hazard_pay_rate", { precision: 6, scale:  4 }).default('0'),
	isActive: boolean("is_active").default(true),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	createdBy: uuid("created_by"),
	updatedBy: uuid("updated_by"),
	commune: varchar({ length: 100 }),
}, (table) => [
	index("idx_locations_code").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.locationCode.asc().nullsLast().op("uuid_ops")),
	index("idx_locations_commune").using("btree", table.commune.asc().nullsLast().op("text_ops")),
	index("idx_locations_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops")).where(sql`(is_active = true)`),
	index("idx_locations_type").using("btree", table.locationType.asc().nullsLast().op("text_ops")).where(sql`(is_active = true)`),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "locations_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("locations_unique_code").on(table.tenantId, table.locationCode),
	pgPolicy("locations_tenant_isolation", { as: "permissive", for: "all", to: ["public"], using: sql`(((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text)) OR ((auth.jwt() ->> 'role'::text) = 'super_admin'::text))`, withCheck: sql`((tenant_id)::text = (auth.jwt() ->> 'tenant_id'::text))`  }),
	check("location_type_valid", sql`(location_type)::text = ANY ((ARRAY['headquarters'::character varying, 'branch'::character varying, 'construction_site'::character varying, 'client_site'::character varying])::text[])`),
]);
export const geographyColumns = pgView("geography_columns", {
	fTableCatalog: pgName("f_table_catalog"),
	fTableSchema: pgName("f_table_schema"),
	fTableName: pgName("f_table_name"),
	fGeographyColumn: pgName("f_geography_column"),
	coordDimension: integer("coord_dimension"),
	srid: integer(),
	type: text(),
}).as(sql`SELECT current_database() AS f_table_catalog, n.nspname AS f_table_schema, c.relname AS f_table_name, a.attname AS f_geography_column, postgis_typmod_dims(a.atttypmod) AS coord_dimension, postgis_typmod_srid(a.atttypmod) AS srid, postgis_typmod_type(a.atttypmod) AS type FROM pg_class c, pg_attribute a, pg_type t, pg_namespace n WHERE t.typname = 'geography'::name AND a.attisdropped = false AND a.atttypid = t.oid AND a.attrelid = c.oid AND c.relnamespace = n.oid AND (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text)`);

export const geometryColumns = pgView("geometry_columns", {
	fTableCatalog: varchar("f_table_catalog", { length: 256 }),
	fTableSchema: pgName("f_table_schema"),
	fTableName: pgName("f_table_name"),
	fGeometryColumn: pgName("f_geometry_column"),
	coordDimension: integer("coord_dimension"),
	srid: integer(),
	type: varchar({ length: 30 }),
}).as(sql`SELECT current_database()::character varying(256) AS f_table_catalog, n.nspname AS f_table_schema, c.relname AS f_table_name, a.attname AS f_geometry_column, COALESCE(postgis_typmod_dims(a.atttypmod), sn.ndims, 2) AS coord_dimension, COALESCE(NULLIF(postgis_typmod_srid(a.atttypmod), 0), sr.srid, 0) AS srid, replace(replace(COALESCE(NULLIF(upper(postgis_typmod_type(a.atttypmod)), 'GEOMETRY'::text), st.type, 'GEOMETRY'::text), 'ZM'::text, ''::text), 'Z'::text, ''::text)::character varying(30) AS type FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped JOIN pg_namespace n ON c.relnamespace = n.oid JOIN pg_type t ON a.atttypid = t.oid LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, replace(split_part(s.consrc, ''''::text, 2), ')'::text, ''::text) AS type FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~~* '%geometrytype(% = %'::text) st ON st.connamespace = n.oid AND st.conrelid = c.oid AND (a.attnum = ANY (st.conkey)) LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text)::integer AS ndims FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~~* '%ndims(% = %'::text) sn ON sn.connamespace = n.oid AND sn.conrelid = c.oid AND (a.attnum = ANY (sn.conkey)) LEFT JOIN ( SELECT s.connamespace, s.conrelid, s.conkey, replace(replace(split_part(s.consrc, ' = '::text, 2), ')'::text, ''::text), '('::text, ''::text)::integer AS srid FROM ( SELECT pg_constraint.connamespace, pg_constraint.conrelid, pg_constraint.conkey, pg_get_constraintdef(pg_constraint.oid) AS consrc FROM pg_constraint) s WHERE s.consrc ~~* '%srid(% = %'::text) sr ON sr.connamespace = n.oid AND sr.conrelid = c.oid AND (a.attnum = ANY (sr.conkey)) WHERE (c.relkind = ANY (ARRAY['r'::"char", 'v'::"char", 'm'::"char", 'f'::"char", 'p'::"char"])) AND NOT c.relname = 'raster_columns'::name AND t.typname = 'geometry'::name AND NOT pg_is_other_temp_schema(c.relnamespace) AND has_table_privilege(c.oid, 'SELECT'::text)`);

export const taxBracketsV2 = pgView("tax_brackets_v2", {	id: uuid(),
	countryCode: varchar("country_code", { length: 2 }),
	bracketOrder: integer("bracket_order"),
	minAmount: numeric("min_amount"),
	maxAmount: numeric("max_amount"),
	rate: numeric(),
	description: jsonb(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT id, scope_country_code AS country_code, (rule_data ->> 'bracket_order'::text)::integer AS bracket_order, (rule_data ->> 'min_amount'::text)::numeric AS min_amount, (rule_data ->> 'max_amount'::text)::numeric AS max_amount, (rule_data ->> 'rate'::text)::numeric AS rate, description, effective_from, effective_to, created_at, updated_at FROM rules WHERE rule_type = 'tax.bracket'::rule_type AND superseded_at IS NULL ORDER BY scope_country_code, ((rule_data ->> 'bracket_order'::text)::integer)`);

export const contributionTypesV2 = pgView("contribution_types_v2", {	id: uuid(),
	code: varchar({ length: 100 }),
	name: jsonb(),
	countryCode: varchar("country_code", { length: 2 }),
	employeeRate: numeric("employee_rate"),
	employerRate: numeric("employer_rate"),
	calculationBase: text("calculation_base"),
	ceilingAmount: numeric("ceiling_amount"),
	ceilingPeriod: text("ceiling_period"),
	fixedAmount: numeric("fixed_amount"),
	isVariableBySector: boolean("is_variable_by_sector"),
	displayOrder: integer("display_order"),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }),
	effectiveTo: timestamp("effective_to", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT id, code, name, scope_country_code AS country_code, (rule_data ->> 'employee_rate'::text)::numeric AS employee_rate, (rule_data ->> 'employer_rate'::text)::numeric AS employer_rate, rule_data ->> 'calculation_base'::text AS calculation_base, (rule_data ->> 'ceiling_amount'::text)::numeric AS ceiling_amount, rule_data ->> 'ceiling_period'::text AS ceiling_period, (rule_data ->> 'fixed_amount'::text)::numeric AS fixed_amount, (rule_data ->> 'is_variable_by_sector'::text)::boolean AS is_variable_by_sector, (rule_data ->> 'display_order'::text)::integer AS display_order, effective_from, effective_to, created_at, updated_at FROM rules WHERE rule_type = 'contribution.rate'::rule_type AND scope_type = 'country'::rule_scope_type AND superseded_at IS NULL ORDER BY scope_country_code, ((rule_data ->> 'display_order'::text)::integer)`);