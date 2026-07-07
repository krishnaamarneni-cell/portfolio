-- CRM Companies table
CREATE TABLE IF NOT EXISTS crm_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  industry TEXT,
  notes TEXT,
  contact_count INT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  is_current_employer BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_from_bulk BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_companies_domain ON crm_companies (domain);
CREATE INDEX IF NOT EXISTS idx_companies_name ON crm_companies (name);
