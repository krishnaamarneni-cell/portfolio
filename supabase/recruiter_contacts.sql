-- Recruiter contacts extracted from Gmail by Email Intelligence agent.
-- Run this in Supabase SQL editor.
CREATE TABLE IF NOT EXISTS recruiter_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  company TEXT,
  role_pitched TEXT,
  match_pct INT,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  emailed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS but allow service-role full access (admin-only table).
ALTER TABLE recruiter_contacts ENABLE ROW LEVEL SECURITY;
