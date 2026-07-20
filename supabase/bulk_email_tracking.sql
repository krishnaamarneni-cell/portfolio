-- Bulk-email response + deliverability tracking.
-- Records every bulk send so an agent can later correlate replies and bounces
-- back to it: who actually responds, and which addresses are dead.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS bulk_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  subject TEXT,
  provider_message_id TEXT,
  campaign TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- filled in by the tracking agent
  replied BOOLEAN NOT NULL DEFAULT FALSE,
  replied_at TIMESTAMPTZ,
  reply_count INT NOT NULL DEFAULT 0,
  bounced BOOLEAN NOT NULL DEFAULT FALSE,
  bounce_reason TEXT,
  bounced_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bulk_sends_email_idx ON bulk_sends (lower(email));
CREATE INDEX IF NOT EXISTS bulk_sends_sent_at_idx ON bulk_sends (sent_at DESC);
CREATE INDEX IF NOT EXISTS bulk_sends_open_idx ON bulk_sends (replied, bounced, sent_at DESC);

ALTER TABLE bulk_sends ENABLE ROW LEVEL SECURITY;

-- Contact-level memory: "which ones respond" survives individual campaigns.
ALTER TABLE recruiter_contacts ADD COLUMN IF NOT EXISTS replied_count INT NOT NULL DEFAULT 0;
ALTER TABLE recruiter_contacts ADD COLUMN IF NOT EXISTS last_replied_at TIMESTAMPTZ;
ALTER TABLE recruiter_contacts ADD COLUMN IF NOT EXISTS bounced BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE recruiter_contacts ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
ALTER TABLE recruiter_contacts ADD COLUMN IF NOT EXISTS bounce_detected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS recruiter_contacts_bounced_idx ON recruiter_contacts (bounced);
CREATE INDEX IF NOT EXISTS recruiter_contacts_replied_idx ON recruiter_contacts (replied_count DESC);
