-- Add contact_type column to recruiter_contacts
-- Values: 'recruiter', 'personal', 'colleague', 'unknown'
ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'unknown';

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_contacts_type ON recruiter_contacts (contact_type);
