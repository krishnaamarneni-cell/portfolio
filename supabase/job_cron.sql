-- Schedule the Job Finder crawl from Postgres instead of GitHub Actions.
--
-- ⚠️  DO NOT COMMIT YOUR SECRET. This repository is public. Replace the two
--     placeholders below in the Supabase SQL editor only — never in the file.
--
-- Why here rather than GitHub Actions:
--   • GitHub explicitly delays and drops scheduled runs when its queue is busy,
--     so a 15-minute cadence is really "roughly, when convenient".
--   • One fewer copy of the secret to keep in sync.
--   • pg_cron fires from the same infrastructure as the data it feeds.
--
-- Why not Vercel cron: the Hobby plan only fires once a day.
--
-- Trade-off worth knowing: pg_net is fire-and-forget, so a failed run will NOT
-- email you the way the GitHub Action did. That is covered — every tick writes
-- a row to job_crawl_runs, and Job Finder → Automation shows the last dozen
-- runs with what each one did. Check there, not your inbox.


-- ─── 1. Extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ─── 2. Store the secret out of the schedule ───────────────────────────────
-- Keeping the token in Vault rather than inline means it is not sitting in
-- plaintext inside cron.job, which anyone with database access can read.
-- Replace REPLACE_WITH_YOUR_CRON_SECRET with the same value as the Vercel
-- CRON_SECRET environment variable.
SELECT vault.create_secret(
  'REPLACE_WITH_YOUR_CRON_SECRET',
  'job_finder_cron_secret',
  'Bearer token for /api/cron/job-finder'
)
WHERE NOT EXISTS (
  SELECT 1 FROM vault.decrypted_secrets WHERE name = 'job_finder_cron_secret'
);


-- ─── 3. The scheduled call ─────────────────────────────────────────────────
-- Unscheduled first so re-running this file replaces the job cleanly rather
-- than erroring on a duplicate name.
SELECT cron.unschedule('job-finder-crawl')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-finder-crawl');

SELECT cron.schedule(
  'job-finder-crawl',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://krishnaamarneni.com/api/cron/job-finder?trigger=pg_cron',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets
                     WHERE name = 'job_finder_cron_secret')
    ),
    -- pg_net defaults to 5s, which would abandon every run mid-crawl. The
    -- endpoint budgets ~32s of work and returns well inside 60s.
    timeout_milliseconds := 60000
  );
  $$
);


-- ─── 4. Check it ───────────────────────────────────────────────────────────
-- Scheduled jobs:
--   SELECT jobid, jobname, schedule, active FROM cron.job;
--
-- Did the last few fire, and what did Postgres think of them:
--   SELECT start_time, status, return_message
--     FROM cron.job_run_details
--    WHERE jobname = 'job-finder-crawl'
--    ORDER BY start_time DESC LIMIT 10;
--
-- What the endpoint actually replied (pg_net logs responses separately):
--   SELECT id, status_code, LEFT(content, 300) AS body, created
--     FROM net._http_response
--    ORDER BY created DESC LIMIT 5;
--
-- What the crawl actually did — the real answer, and the one the UI shows:
--   SELECT started_at, sources_checked, jobs_added, jobs_scored, ok, errors
--     FROM job_crawl_runs
--    ORDER BY started_at DESC LIMIT 10;


-- ─── To stop it ────────────────────────────────────────────────────────────
--   SELECT cron.unschedule('job-finder-crawl');
