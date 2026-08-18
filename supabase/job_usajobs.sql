-- Adds the sixth source state: needs_config.
-- Run in the Supabase SQL editor AFTER supabase/job_source_v2.sql.
--
-- A source that requires an API key which has not been supplied is not
-- failing, and not merely unverified — it cannot run until someone does
-- something. USAJOBS is the first of these: free, official, but key-gated.
-- Reporting it as "failing" would put a red dot next to a source that is
-- working exactly as designed, and "unverified" would imply the crawler simply
-- hasn't reached it yet.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_source_health_status_chk'
      AND conrelid = 'job_source_health'::regclass
  ) THEN
    ALTER TABLE job_source_health DROP CONSTRAINT job_source_health_status_chk;
  END IF;

  ALTER TABLE job_source_health
    ADD CONSTRAINT job_source_health_status_chk
    CHECK (status IN (
      'producing',    -- responded, returned matching jobs
      'no_matches',   -- responded fine, nothing matched the keywords — HEALTHY
      'failing',      -- HTTP error or exception
      'unverified',   -- registered but never crawled
      'inactive',     -- manually disabled
      'needs_config'  -- missing credentials; cannot run until supplied
    ));
END $$;

-- Verification:
-- SELECT status, count(*) FROM job_source_health GROUP BY 1 ORDER BY 1;
