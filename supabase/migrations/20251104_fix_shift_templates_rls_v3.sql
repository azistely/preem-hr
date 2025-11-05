-- Fix RLS policy for shift_templates to use current_setting('app.tenant_id')
-- The app uses postgres-js with transaction pooler, NOT Supabase Auth client
-- Therefore auth.jwt() doesn't work - we must use session variables
-- Context.ts sets: app.tenant_id, app.user_role, app.user_id

DROP POLICY IF EXISTS tenant_isolation ON shift_templates;

CREATE POLICY tenant_isolation ON shift_templates
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.user_role', true) = 'super_admin'
    OR current_setting('app.bypass_rls', true)::boolean = true
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true)::boolean = true
  );
