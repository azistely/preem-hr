CREATE TABLE "export_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"template_type" varchar(50) NOT NULL,
	"provider_code" varchar(50) NOT NULL,
	"provider_name" varchar(200) NOT NULL,
	"file_format" varchar(20) NOT NULL,
	"delimiter" varchar(5),
	"encoding" varchar(20) DEFAULT 'UTF-8',
	"columns" jsonb NOT NULL,
	"headers" jsonb,
	"footers" jsonb,
	"filename_pattern" varchar(200),
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"effective_from" date DEFAULT now() NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"portal_url" text,
	"documentation_url" text,
	"sample_file_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "export_templates" ADD CONSTRAINT "export_templates_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;