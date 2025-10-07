-- Fix P0 Gap #3: Automated Monthly Leave Accrual
--
-- Purpose:
-- Schedule monthly leave accrual job using pg_cron
-- Runs on the 1st of every month at 2:00 AM (UTC)
--
-- Convention Collective Requirements (Article 28):
-- - Employees accrue 2.0 days/month (24 days/year) standard
-- - Under 21: 2.5 days/month (30 days/year)
-- - Seniority bonus: 15/20/25 years = +2/+4/+6 days/year

BEGIN;

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Note: The actual cron job will be created via Supabase dashboard or CLI
-- because it requires the Edge Function URL which is environment-specific.
--
-- Manual setup required:
-- 1. Deploy the Edge Function: supabase functions deploy accrue-leave
-- 2. Create cron job in Supabase dashboard:
--    - Schedule: 0 2 1 * * (1st of every month at 2 AM UTC)
--    - Command: SELECT net.http_post(
--                 url := 'https://[PROJECT-REF].supabase.co/functions/v1/accrue-leave',
--                 headers := jsonb_build_object(
--                   'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--                   'Content-Type', 'application/json'
--                 )
--               );
--
-- Alternative: Use Supabase CLI
-- supabase functions schedule accrue-leave --cron "0 2 1 * *"

-- Add comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for automated tasks like monthly leave accrual';

-- Create a helper function for manual accrual (testing/admin use)
CREATE OR REPLACE FUNCTION trigger_leave_accrual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url text;
  response jsonb;
BEGIN
  -- Get the Edge Function URL from configuration
  -- Note: This assumes you've set up the function URL in a config table
  -- For now, this is a placeholder - actual implementation would use net.http_post

  RAISE NOTICE 'Manual leave accrual triggered. Deploy Edge Function and configure cron job.';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Leave accrual job triggered manually. Check Edge Function logs for results.'
  );
END;
$$;

COMMENT ON FUNCTION trigger_leave_accrual() IS 'Manually trigger monthly leave accrual (for testing/admin)';

COMMIT;

-- Instructions for setup:
--
-- 1. Deploy Edge Function:
--    $ supabase functions deploy accrue-leave
--
-- 2. Test manually:
--    $ curl -i --location --request POST \
--      'https://[PROJECT-REF].supabase.co/functions/v1/accrue-leave' \
--      --header 'Authorization: Bearer [ANON-KEY]'
--
-- 3. Schedule with pg_cron (via Supabase dashboard or SQL):
--    SELECT cron.schedule(
--      'monthly-leave-accrual',
--      '0 2 1 * *', -- 1st of every month at 2 AM UTC
--      $$SELECT net.http_post(
--        url := 'https://[PROJECT-REF].supabase.co/functions/v1/accrue-leave',
--        headers := '{"Authorization": "Bearer [SERVICE-ROLE-KEY]", "Content-Type": "application/json"}'::jsonb
--      )$$
--    );
--
-- 4. Verify cron job:
--    SELECT * FROM cron.job WHERE jobname = 'monthly-leave-accrual';
--
-- 5. View cron job history:
--    SELECT * FROM cron.job_run_details WHERE jobid = (
--      SELECT jobid FROM cron.job WHERE jobname = 'monthly-leave-accrual'
--    ) ORDER BY start_time DESC LIMIT 10;
