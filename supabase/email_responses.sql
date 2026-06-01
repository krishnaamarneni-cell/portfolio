-- Email learning system — tracks how Krishna responds to recruiter emails.
-- The AI uses this data to improve future auto-reply drafts.
-- Run this in Supabase SQL editor.
CREATE TABLE IF NOT EXISTS email_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  to_name TEXT NOT NULL DEFAULT '',
  subject TEXT,
  match_pct INT,
  ai_draft TEXT NOT NULL DEFAULT '',
  final_body TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT 'sent',  -- sent | edited_sent | discarded
  got_reply BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;
