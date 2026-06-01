-- Track which emails we've already auto-replied to (duplicate prevention).
-- Run this in Supabase SQL editor.
CREATE TABLE IF NOT EXISTS replied_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL UNIQUE,
  to_email TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE replied_emails ENABLE ROW LEVEL SECURITY;
