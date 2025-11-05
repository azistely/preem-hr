-- Fix RLS policy for shift_templates to use auth.jwt() like other tables
-- The previous fix used current_setting('app.current_tenant_id') but context.ts sets 'app.tenant_id'
-- The standard pattern used by all other tables is to read tenant_id from JWT token

DROP POLICY IF EXISTS tenant_isolation ON shift_templates;

CREATE POLICY tenant_isolation ON shift_templates
  FOR ALL
  USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    OR (auth.jwt() ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
