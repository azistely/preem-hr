CREATE ROLE "super_admin";--> statement-breakpoint
CREATE ROLE "tenant_user";--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"currency" text NOT NULL,
	"timezone" text NOT NULL,
	"payroll_rules" jsonb NOT NULL,
	"tax_brackets" jsonb NOT NULL,
	"contribution_rates" jsonb NOT NULL,
	"public_holidays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country_code" text DEFAULT 'CI' NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"timezone" text DEFAULT 'Africa/Abidjan' NOT NULL,
	"tax_id" text,
	"business_registration" text,
	"industry" text,
	"plan" text DEFAULT 'trial' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"avatar_url" text,
	"locale" text DEFAULT 'fr' NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_login_at" timestamp,
	"last_login_ip" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"parent_department_id" uuid,
	"manager_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"code" text,
	"description" text,
	"department_id" uuid,
	"reports_to_position_id" uuid,
	"min_salary" numeric(15, 2),
	"max_salary" numeric(15, 2),
	"currency" text DEFAULT 'XOF' NOT NULL,
	"job_level" text,
	"employment_type" text DEFAULT 'full_time' NOT NULL,
	"weekly_hours" numeric(5, 2) DEFAULT '40' NOT NULL,
	"work_schedule" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"headcount" integer DEFAULT 1 NOT NULL,
	"effective_from" date DEFAULT CURRENT_DATE NOT NULL,
	"effective_to" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_number" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"date_of_birth" date,
	"gender" text,
	"email" text NOT NULL,
	"phone" text,
	"national_id" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"postal_code" text,
	"country_code" text DEFAULT 'CI' NOT NULL,
	"hire_date" date NOT NULL,
	"termination_date" date,
	"termination_reason" text,
	"bank_name" text,
	"bank_account" text,
	"cnps_number" text,
	"tax_number" text,
	"tax_dependents" integer DEFAULT 0 NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"assignment_type" text DEFAULT 'primary' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"assignment_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employee_salaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"base_salary" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'XOF' NOT NULL,
	"pay_frequency" text DEFAULT 'monthly' NOT NULL,
	"housing_allowance" numeric(15, 2) DEFAULT '0',
	"transport_allowance" numeric(15, 2) DEFAULT '0',
	"meal_allowance" numeric(15, 2) DEFAULT '0',
	"allowances" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"other_allowances" jsonb DEFAULT '[]',
	"effective_from" date NOT NULL,
	"effective_to" date,
	"change_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "employee_salaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"employee_name" text,
	"employee_number" text,
	"position_title" text,
	"base_salary" numeric(15, 2) NOT NULL,
	"allowances" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"days_worked" numeric(5, 2) NOT NULL,
	"days_absent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"overtime_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"overtime_pay" numeric(15, 2) DEFAULT '0',
	"bonuses" numeric(15, 2) DEFAULT '0',
	"gross_salary" numeric(15, 2) NOT NULL,
	"earnings_details" jsonb DEFAULT '[]' NOT NULL,
	"tax_deductions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"employee_contributions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"other_deductions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deductions_details" jsonb DEFAULT '[]' NOT NULL,
	"cnps_employee" numeric(15, 2),
	"cmu_employee" numeric(15, 2),
	"its" numeric(15, 2),
	"total_deductions" numeric(15, 2) NOT NULL,
	"net_salary" numeric(15, 2) NOT NULL,
	"employer_contributions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cnps_employer" numeric(15, 2),
	"cmu_employer" numeric(15, 2),
	"total_other_taxes" numeric(15, 2) DEFAULT '0',
	"other_taxes_details" jsonb DEFAULT '[]' NOT NULL,
	"total_employer_cost" numeric(15, 2) NOT NULL,
	"employer_cost" numeric(15, 2),
	"payment_method" text DEFAULT 'bank_transfer' NOT NULL,
	"bank_account" text,
	"payment_reference" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_number" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"name" text,
	"description" text,
	"pay_date" date NOT NULL,
	"payment_method" text DEFAULT 'bank_transfer' NOT NULL,
	"country_code" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"calculated_at" timestamp,
	"approved_at" timestamp,
	"approved_by" uuid,
	"paid_at" timestamp,
	"processed_at" timestamp,
	"processed_by" uuid,
	"employee_count" integer,
	"total_gross" numeric(15, 2),
	"total_net" numeric(15, 2),
	"total_tax" numeric(15, 2),
	"total_employee_contributions" numeric(15, 2),
	"total_employer_contributions" numeric(15, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contribution_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" jsonb NOT NULL,
	"employee_rate" numeric(6, 4),
	"employer_rate" numeric(6, 4),
	"calculation_base" varchar(50) NOT NULL,
	"ceiling_amount" numeric(15, 2),
	"ceiling_period" varchar(20),
	"fixed_amount" numeric(15, 2),
	"is_variable_by_sector" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_deduction_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_system_id" uuid NOT NULL,
	"fiscal_parts" numeric(3, 1) NOT NULL,
	"deduction_amount" numeric(15, 2) NOT NULL,
	"description" jsonb
);
--> statement-breakpoint
CREATE TABLE "other_taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" jsonb NOT NULL,
	"tax_rate" numeric(6, 4) NOT NULL,
	"calculation_base" varchar(50) NOT NULL,
	"paid_by" varchar(20) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_component_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" jsonb NOT NULL,
	"category" varchar(50) NOT NULL,
	"component_type" varchar(50) NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"is_subject_to_social_security" boolean DEFAULT true NOT NULL,
	"calculation_method" varchar(50),
	"default_value" numeric(15, 2),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_common" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sector_contribution_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_type_id" uuid NOT NULL,
	"sector_code" varchar(50) NOT NULL,
	"sector_name" jsonb NOT NULL,
	"employer_rate" numeric(6, 4) NOT NULL,
	"risk_level" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "social_security_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"agency_code" varchar(10) NOT NULL,
	"agency_name" jsonb NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_brackets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_system_id" uuid NOT NULL,
	"bracket_order" integer NOT NULL,
	"min_amount" numeric(15, 2) NOT NULL,
	"max_amount" numeric(15, 2),
	"rate" numeric(6, 4) NOT NULL,
	"description" jsonb
);
--> statement-breakpoint
CREATE TABLE "tax_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" jsonb NOT NULL,
	"calculation_method" varchar(50) NOT NULL,
	"supports_family_deductions" boolean DEFAULT false NOT NULL,
	"calculation_base" varchar(50) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"clock_in" timestamp NOT NULL,
	"clock_out" timestamp,
	"total_hours" numeric(5, 2),
	"clock_in_location" text,
	"clock_out_location" text,
	"geofence_verified" boolean DEFAULT false,
	"clock_in_photo_url" text,
	"clock_out_photo_url" text,
	"entry_type" text DEFAULT 'regular' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_off_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"allocated" numeric(5, 2) DEFAULT '0' NOT NULL,
	"used" numeric(5, 2) DEFAULT '0' NOT NULL,
	"pending" numeric(5, 2) DEFAULT '0' NOT NULL,
	"carried_over" numeric(5, 2) DEFAULT '0' NOT NULL,
	"available" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_off_balances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_off_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"policy_type" text NOT NULL,
	"description" text,
	"days_per_year" numeric(5, 2),
	"accrual_rate" text,
	"max_carryover" numeric(5, 2),
	"max_accrual" numeric(5, 2),
	"requires_approval" boolean DEFAULT true NOT NULL,
	"minimum_increment" numeric(3, 2) DEFAULT '0.5',
	"advance_notice_required" integer DEFAULT 0,
	"blackout_periods" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "time_off_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"balance_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_requested" numeric(5, 2) NOT NULL,
	"reason" text,
	"notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"review_notes" text,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_off_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"action" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_fields" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"tenant_id" uuid,
	"aggregate_id" uuid,
	"data" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"correlation_id" uuid,
	"causation_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 0,
	"step_data" jsonb DEFAULT '{}' NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger_event" text NOT NULL,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "workflows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_salaries" ADD CONSTRAINT "employee_salaries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_line_items" ADD CONSTRAINT "payroll_line_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contribution_types" ADD CONSTRAINT "contribution_types_scheme_id_social_security_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."social_security_schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_deduction_rules" ADD CONSTRAINT "family_deduction_rules_tax_system_id_tax_systems_id_fk" FOREIGN KEY ("tax_system_id") REFERENCES "public"."tax_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "other_taxes" ADD CONSTRAINT "other_taxes_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_component_definitions" ADD CONSTRAINT "salary_component_definitions_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sector_contribution_overrides" ADD CONSTRAINT "sector_contribution_overrides_contribution_type_id_contribution_types_id_fk" FOREIGN KEY ("contribution_type_id") REFERENCES "public"."contribution_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_security_schemes" ADD CONSTRAINT "social_security_schemes_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_tax_system_id_tax_systems_id_fk" FOREIGN KEY ("tax_system_id") REFERENCES "public"."tax_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_systems" ADD CONSTRAINT "tax_systems_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_balances" ADD CONSTRAINT "time_off_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_balances" ADD CONSTRAINT "time_off_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_balances" ADD CONSTRAINT "time_off_balances_policy_id_time_off_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."time_off_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_policies" ADD CONSTRAINT "time_off_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_policy_id_time_off_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."time_off_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_balance_id_time_off_balances_id_fk" FOREIGN KEY ("balance_id") REFERENCES "public"."time_off_balances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "users" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("users"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("users"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "departments" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("departments"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("departments"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "positions" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("positions"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("positions"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "employees" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("employees"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("employees"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "assignments" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("assignments"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("assignments"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "employee_salaries" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("employee_salaries"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("employee_salaries"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payroll_line_items" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("payroll_line_items"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("payroll_line_items"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "payroll_runs" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("payroll_runs"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("payroll_runs"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "time_entries" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("time_entries"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("time_entries"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "time_off_balances" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("time_off_balances"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("time_off_balances"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "time_off_policies" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("time_off_policies"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("time_off_policies"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "time_off_requests" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("time_off_requests"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("time_off_requests"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_logs" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("audit_logs"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("audit_logs"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "events" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("events"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("events"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflow_instances" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("workflow_instances"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("workflow_instances"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workflows" AS PERMISSIVE FOR ALL TO "tenant_user" USING ("workflows"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid OR (auth.jwt() ->> 'role') = 'super_admin') WITH CHECK ("workflows"."tenant_id" = (auth.jwt() ->> 'tenant_id')::uuid);