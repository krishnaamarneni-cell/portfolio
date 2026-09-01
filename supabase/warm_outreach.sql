-- Warm check-in outreach: keep relationships with recruiters who have actually
-- replied from going cold. Run in the Supabase SQL editor.
--
-- This is OUTBOUND mail to people who did not write first, which is a different
-- risk class from auto-reply. Everything here exists to make "have we already
-- bothered this person recently" answerable before a send, not after.

alter table admin_settings
  add column if not exists warm_outreach_enabled boolean not null default false;

create table if not exists outreach_log (
  id uuid primary key default gen_random_uuid(),
  contact_email text not null,
  contact_name text,
  subject text,
  -- The exact text sent, so what went out over Krishna's name is auditable.
  body_sent text,
  -- reserved -> sent | failed. Written BEFORE the send, same as replied_emails:
  -- a crash between sending and recording must not let the next run send again.
  status text not null default 'sent',
  error text,
  gmail_thread_id text,
  sent_at timestamptz not null default now()
);

-- The per-person cooldown is a lookup on this, so it needs to be fast and
-- case-insensitive: the same recruiter appears as Jane@Acme.com and
-- jane@acme.com depending on which header they were parsed from.
create index if not exists outreach_log_email_idx on outreach_log (lower(contact_email));
create index if not exists outreach_log_sent_at_idx on outreach_log (sent_at desc);

alter table outreach_log enable row level security;

-- Verify:
--   select warm_outreach_enabled from admin_settings;
--   select status, count(*) from outreach_log group by status;
