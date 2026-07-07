-- CRM Email Threads (cached Gmail conversations)
CREATE TABLE IF NOT EXISTS crm_email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_thread_id TEXT NOT NULL UNIQUE,
  contact_id UUID REFERENCES recruiter_contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL,
  subject TEXT,
  snippet TEXT,
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  participants TEXT[],
  direction TEXT DEFAULT 'unknown',
  intent TEXT,
  intent_confidence REAL,
  cached_messages JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_email_threads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_threads_contact ON crm_email_threads (contact_id);
CREATE INDEX IF NOT EXISTS idx_threads_company ON crm_email_threads (company_id);
CREATE INDEX IF NOT EXISTS idx_threads_gmail ON crm_email_threads (gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_msg ON crm_email_threads (last_message_at DESC);

-- CRM Enrichment Queue
CREATE TABLE IF NOT EXISTS crm_enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES recruiter_contacts(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  suggested_value TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'signature',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_enrichment_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_enrichment_pending ON crm_enrichment_queue (status) WHERE status = 'pending';

-- CRM Audience Rules
CREATE TABLE IF NOT EXISTS crm_audience_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{}',
  contact_count INT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_audience_rules ENABLE ROW LEVEL SECURITY;

-- CRM Outreach Exclusions
CREATE TABLE IF NOT EXISTS crm_outreach_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exclusion_type TEXT NOT NULL,
  exclusion_value TEXT NOT NULL,
  reason TEXT,
  is_permanent BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm_outreach_exclusions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exclusions_active ON crm_outreach_exclusions (active) WHERE active = TRUE;
