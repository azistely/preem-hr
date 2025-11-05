-- Fix RLS policy for shift_templates to include WITH CHECK for INSERT
-- The original policy only had USING clause which applies to SELECT/UPDATE/DELETE
-- INSERT operations need WITH CHECK clause

DROP POLICY IF EXISTS tenant_isolation ON shift_templates;

CREATE POLICY tenant_isolation ON shift_templates
  FOR ALL
  USING (
    tenant_id::text = current_setting('app.current_tenant_id', true)
    OR current_setting('app.bypass_rls', true)::boolean = true
  )
  WITH CHECK (
    tenant_id::text = current_setting('app.current_tenant_id', true)
    OR current_setting('app.bypass_rls', true)::boolean = true
  );
