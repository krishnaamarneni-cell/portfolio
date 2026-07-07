-- Extend recruiter_contacts for full CRM
ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS excluded_from_bulk BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS priority INT;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS last_gmail_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_company ON recruiter_contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON recruiter_contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_contacts_dnc ON recruiter_contacts (do_not_contact) WHERE do_not_contact = TRUE;
