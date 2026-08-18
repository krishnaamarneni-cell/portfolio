-- Job Finder source layer v2 — stable job identity and honest source health.
--
-- Run in the Supabase SQL editor AFTER job_finder.sql, job_crawler.sql and
-- job_metadata.sql. Every statement is guarded, so re-running is safe.
--
-- Two things this fixes:
--
-- 1. DEDUPLICATION. Today the only key is lower(application_url). That works
--    until an employer changes a URL format, at which point the same role is
--    stored twice. Every ATS already assigns its own stable job id, so that is
--    the better primary key.
--
-- 2. SOURCE HEALTH. "Did it return jobs?" is not the same question as "does it
--    work?". A crawl over 80 employers found 8 sources returning zero jobs
--    while perfectly healthy — Robinhood, Carta, Chime, SoFi, Palantir,
--    AngelList, Tala, Dell. They are tech boards being queried with SAP
--    keywords. Treating zero-results as failure would disable eight working
--    sources and lose them the day they post a relevant role. So an explicit
--    no_matches state exists, separate from failing.


-- ─── 1. Job identity ───────────────────────────────────────────────────────
-- NOTE: no `ats` column is added. job_listings.source_type already stores the
-- platform ("workday", "greenhouse", "lever", "ashby", "smartrecruiters"), and
-- a second column holding the same value is a bug waiting to happen. Code
-- reads source_type AS the ATS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'external_id'
  ) THEN
    -- The ATS's own identifier for this posting. Nullable: a few sources do
    -- not expose one, and those fall back to the URL key below.
    ALTER TABLE job_listings ADD COLUMN external_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'source_url'
  ) THEN
    -- The board this was found on, as distinct from application_url, which is
    -- where a human goes to apply.
    ALTER TABLE job_listings ADD COLUMN source_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_listings' AND column_name = 'department'
  ) THEN
    ALTER TABLE job_listings ADD COLUMN department TEXT;
  END IF;
END $$;

-- Primary dedup key: platform + the ATS's own job id.
-- Partial, because external_id is nullable and NULLs must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS job_listings_ats_external_idx
  ON job_listings (source_type, external_id)
  WHERE external_id IS NOT NULL;

-- Secondary key: the normalized apply URL. Already present from job_finder.sql
-- (job_listings_url_idx on lower(application_url)) and still enforced — it is
-- the fallback for sources without an external id.

-- Deliberately NOT added: a unique constraint on
-- company + title + location + posted_at. It reads like a sensible third
-- tier, but the data will not support it — Workday caps posted_at at
-- "30+ Days Ago" and Accenture reports location as "Location Negotiable", so
-- two genuinely different roles collide. Duplicate detection on those fields
-- belongs in application code as an advisory flag, never as a constraint that
-- silently discards a real posting.


-- ─── 2. Source health ──────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'status'
  ) THEN
    ALTER TABLE job_source_health ADD COLUMN status TEXT NOT NULL DEFAULT 'unverified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'last_http_status'
  ) THEN
    ALTER TABLE job_source_health ADD COLUMN last_http_status INT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'jobs_added'
  ) THEN
    ALTER TABLE job_source_health ADD COLUMN jobs_added INT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'jobs_deduped'
  ) THEN
    ALTER TABLE job_source_health ADD COLUMN jobs_deduped INT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'rate_limit_ms'
  ) THEN
    ALTER TABLE job_source_health ADD COLUMN rate_limit_ms INT NOT NULL DEFAULT 250;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'enabled'
  ) THEN
    -- Manual kill switch. Distinct from status: a source can be healthy and
    -- switched off on purpose.
    ALTER TABLE job_source_health ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_source_health' AND column_name = 'first_seen_at'
  ) THEN
    ALTER TABLE job_source_health ADD COLUMN first_seen_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- The five states, as a constraint so an unexpected value cannot creep in.
--   producing    responded, returned matching jobs
--   no_matches   responded fine, nothing matched the keywords — HEALTHY
--   failing      HTTP error or exception; see consecutive_failures
--   unverified   registered but never crawled
--   inactive     manually disabled
-- Checked against pg_constraint, not information_schema: a CHECK constraint is
-- not dependably listed in constraint_column_usage, so that test can pass while
-- the constraint exists and the ALTER then fails on a re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_source_health_status_chk'
      AND conrelid = 'job_source_health'::regclass
  ) THEN
    ALTER TABLE job_source_health
      ADD CONSTRAINT job_source_health_status_chk
      CHECK (status IN ('producing', 'no_matches', 'failing', 'unverified', 'inactive'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS job_source_health_status_idx
  ON job_source_health (status, kind);


-- ─── 3. Backfill status from what the crawler already recorded ──────────────
-- Existing rows carry last_ok and last_jobs_found from previous runs, which is
-- enough to classify them without waiting for a fresh sweep.

UPDATE job_source_health
   SET status = CASE
     WHEN last_checked_at IS NULL              THEN 'unverified'
     WHEN last_ok IS NOT TRUE                  THEN 'failing'
     WHEN COALESCE(last_jobs_found, 0) > 0     THEN 'producing'
     ELSE 'no_matches'
   END
 WHERE status = 'unverified';

-- Per-platform rate limits. Workday is the only one queried once per keyword
-- per tenant, so it needs the most spacing; the rest are one request per board
-- per cycle.
UPDATE job_source_health SET rate_limit_ms = 250 WHERE kind = 'workday';
UPDATE job_source_health SET rate_limit_ms = 120 WHERE kind IN ('greenhouse', 'ashby', 'lever');
UPDATE job_source_health SET rate_limit_ms = 400 WHERE kind = 'smartrecruiters';


-- ─── 4. What this migration deliberately does not do ───────────────────────
--
-- It does not disable Lever, even though 5 Lever sources produced 1 stored
-- listing here. Turning a source off is a judgement call about crawl budget,
-- so it belongs in the app's Sources screen with a visible reason, not buried
-- in a migration that ran once.
--
-- It does not mark SmartRecruiters active. Those 4 sources have never been
-- reached by the round-robin cursor, so nothing about them is verified in this
-- database regardless of how they behaved when probed standalone. The backfill
-- above leaves them 'unverified', which is the honest state.
--
-- It adds no table for generic career-page crawling. That waits until the five
-- ATS connectors are stable, and each crawl target then needs its own
-- robots/terms review, rate limit and manual toggle.


-- ─── Verification — run these after applying ───────────────────────────────
-- SELECT status, kind, count(*) FROM job_source_health GROUP BY 1,2 ORDER BY 1,2;
-- SELECT count(*) AS missing_external_id FROM job_listings WHERE external_id IS NULL;
-- SELECT source_type, count(*) FROM job_listings GROUP BY 1 ORDER BY 2 DESC;
