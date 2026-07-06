-- Resume versions table — stores tailored resumes with analysis data
CREATE TABLE IF NOT EXISTS resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL DEFAULT '',
  job_description TEXT NOT NULL DEFAULT '',
  base_resume_text TEXT NOT NULL DEFAULT '',
  tailored_resume JSONB NOT NULL DEFAULT '{}',
  analysis JSONB NOT NULL DEFAULT '{}',
  ats_score INTEGER,
  tone TEXT NOT NULL DEFAULT 'strong',
  emphasis TEXT NOT NULL DEFAULT 'balanced',
  seniority TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resume_versions_company ON resume_versions (company_name);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created ON resume_versions (created_at DESC);
