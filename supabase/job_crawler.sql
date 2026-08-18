-- Job Finder automation — crawl run log and per-source health.
-- Run in the Supabase SQL editor AFTER supabase/job_finder.sql.

-- ─── Run log ───────────────────────────────────────────────────────────────
-- One row per cron tick, so the UI can show what the automation actually did
-- and a stalled crawl is visible rather than silent.
CREATE TABLE IF NOT EXISTS job_crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  trigger TEXT NOT NULL DEFAULT 'cron',
  sources_checked INT NOT NULL DEFAULT 0,
  jobs_seen INT NOT NULL DEFAULT 0,
  jobs_added INT NOT NULL DEFAULT 0,
  jobs_scored INT NOT NULL DEFAULT 0,
  relevant_found INT NOT NULL DEFAULT 0,
  cursor_start INT,
  cursor_end INT,
  duration_ms INT,
  errors TEXT[],
  ok BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS job_crawl_runs_recent_idx
  ON job_crawl_runs (started_at DESC);

-- ─── Per-source health ─────────────────────────────────────────────────────
-- Keyed by company+kind rather than a FK, because the source registry lives in
-- code (probed and version-controlled), not in a user-editable table.
CREATE TABLE IF NOT EXISTS job_source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  kind TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ,
  last_ok BOOLEAN,
  last_error TEXT,
  last_jobs_found INT DEFAULT 0,
  total_jobs_found INT DEFAULT 0,
  consecutive_failures INT DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS job_source_health_key_idx
  ON job_source_health (lower(company), lower(kind));

-- ─── Crawler state on the settings singleton ───────────────────────────────
-- Holds the round-robin cursor so each tick continues where the last stopped
-- instead of re-checking the same handful of employers forever.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'job_crawler_state'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN job_crawler_state JSONB DEFAULT '{}';
  END IF;
END $$;

ALTER TABLE job_crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_source_health ENABLE ROW LEVEL SECURITY;
