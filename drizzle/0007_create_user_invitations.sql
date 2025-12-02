-- Create user_invitations table for managing user invitations
CREATE TABLE IF NOT EXISTS "user_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,

  -- Invitation details
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'employee',
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,

  -- Token (URL-safe base64, 43 chars)
  "token" text NOT NULL UNIQUE,

  -- Lifecycle
  "status" text NOT NULL DEFAULT 'pending',
  "expires_at" timestamp with time zone NOT NULL,

  -- Tracking - who invited
  "invited_by" uuid NOT NULL REFERENCES "users"("id"),

  -- Tracking - acceptance
  "accepted_at" timestamp with time zone,
  "accepted_by_user_id" uuid REFERENCES "users"("id"),

  -- Tracking - revocation
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid REFERENCES "users"("id"),

  -- Email tracking
  "email_sent_at" timestamp with time zone,
  "email_resent_count" integer NOT NULL DEFAULT 0,
  "last_email_sent_at" timestamp with time zone,

  -- Audit
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS "idx_user_invitations_tenant" ON "user_invitations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_user_invitations_email_tenant" ON "user_invitations" ("email", "tenant_id");
CREATE INDEX IF NOT EXISTS "idx_user_invitations_token" ON "user_invitations" ("token");
CREATE INDEX IF NOT EXISTS "idx_user_invitations_status" ON "user_invitations" ("status");

-- Unique constraint: only one pending invitation per email per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_invitations_pending_unique"
ON "user_invitations" ("email", "tenant_id")
WHERE "status" = 'pending';

-- Add check constraints for valid status and role values
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_status_check"
CHECK ("status" IN ('pending', 'accepted', 'expired', 'revoked'));

ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_role_check"
CHECK ("role" IN ('employee', 'manager', 'hr_manager', 'tenant_admin'));
