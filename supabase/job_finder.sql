-- Job Finder — discovered job listings and approved crawl sources.
-- Run in the Supabase SQL editor.

-- ─── Job sources (approved company career pages) ───────────────────
CREATE TABLE IF NOT EXISTS job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  careers_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'crawler',
  ats TEXT,
  config JSONB DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  crawl_frequency TEXT DEFAULT 'daily',
  last_crawled_at TIMESTAMPTZ,
  last_crawl_status TEXT,
  last_crawl_error TEXT,
  last_crawl_jobs_found INT DEFAULT 0,
  total_jobs_found INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_sources_url_idx
  ON job_sources (lower(careers_url));

-- ─── Discovered job listings ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES job_sources(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  work_type TEXT,
  description TEXT,
  required_skills TEXT[],
  application_url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  salary_range TEXT,
  match_score INT,
  match_recommendation TEXT,
  match_skills TEXT[],
  missing_skills TEXT[],
  match_summary TEXT,
  resume_keywords TEXT[],
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT,
  notes TEXT,
  saved_at TIMESTAMPTZ,
  ignored_at TIMESTAMPTZ,
  source_type TEXT,
  raw_data JSONB,
  crawled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_listings_url_idx
  ON job_listings (lower(application_url));

CREATE INDEX IF NOT EXISTS job_listings_status_idx
  ON job_listings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS job_listings_match_idx
  ON job_listings (match_score DESC NULLS LAST)
  WHERE status IN ('new', 'saved');

CREATE INDEX IF NOT EXISTS job_listings_source_idx
  ON job_listings (source_id, crawled_at DESC);

-- ─── Link applications to discovered listings ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_applications' AND column_name = 'listing_id'
  ) THEN
    ALTER TABLE job_applications ADD COLUMN listing_id UUID REFERENCES job_listings(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_applications' AND column_name = 'follow_up_at'
  ) THEN
    ALTER TABLE job_applications ADD COLUMN follow_up_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_applications' AND column_name = 'resume_version'
  ) THEN
    ALTER TABLE job_applications ADD COLUMN resume_version TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'job_finder_settings'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN job_finder_settings JSONB DEFAULT '{}';
  END IF;
END $$;

ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_sources ENABLE ROW LEVEL SECURITY;
