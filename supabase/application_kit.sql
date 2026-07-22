-- Application Kit — everything needed to apply to one job, prepared by the
-- agent so the human only reviews and submits.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- the job
  job_title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  job_url TEXT,
  job_description TEXT,
  source TEXT,                        -- jobs-scout | manual | jobdiva | indeed

  -- the prepared kit
  match_pct INT,
  tailored_resume JSONB,              -- output of the resume tailor
  cover_note TEXT,
  screening_answers JSONB,            -- [{question, answer}]
  keywords TEXT[],
  gaps TEXT[],                        -- honest weak spots to prep for

  -- workflow state (the human drives this)
  status TEXT NOT NULL DEFAULT 'prepared',  -- prepared | applied | interviewing | rejected | offer
  applied_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_applications_status_idx ON job_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_company_idx ON job_applications (lower(company));
-- Prevent preparing the same job twice.
CREATE UNIQUE INDEX IF NOT EXISTS job_applications_dedupe_idx
  ON job_applications (lower(job_title), lower(coalesce(company, '')));

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
