-- Auto-reply: kill switch + the audit trail the pipeline needs to stay honest.
-- Run in the Supabase SQL editor.
--
-- Two things this fixes.
--
-- 1. auto_reply_enabled never existed. lib/auto-reply.ts reads it as a kill
--    switch and treats "undefined" as off, so the whole pipeline has been inert
--    since the check was added. Adding the column is what makes the Settings
--    toggle able to save at all.
--
-- 2. replied_emails recorded only "we replied to this message id". That was not
--    enough to answer the questions that matter after the fact: who did we
--    reply to, how many times, what did we actually say in Krishna's name, and
--    was it sent or only attempted. Between June and July it sent 77 emails and
--    the table could not show that every single one went to Krishna himself or
--    back to its own sending address.

alter table admin_settings
  add column if not exists auto_reply_enabled boolean not null default false;

-- Thread identity, so "no more than 2 replies to one sender" can be enforced
-- against a real conversation rather than a subject line.
alter table replied_emails
  add column if not exists thread_id text,
  add column if not exists sender_email text,
  -- reserved -> sent | failed. A row is written BEFORE the send so a crash
  -- between "sent" and "recorded" can never cause a duplicate send; an
  -- unchecked write here is what would let one recruiter get the same email on
  -- every cron tick.
  add column if not exists status text not null default 'sent',
  add column if not exists match_pct int,
  add column if not exists category text,
  -- The exact body that went out over his name. Without it there is no way to
  -- audit what was said.
  add column if not exists body_sent text,
  add column if not exists error text;

-- Dedupe before the unique index below can be created. The old code used
-- .upsert() with no conflict target, which resolves against the primary key —
-- so it inserted every time and nothing actually enforced one-reply-per-message.
delete from replied_emails a
  using replied_emails b
  where a.gmail_message_id = b.gmail_message_id
    and a.ctid > b.ctid;

-- This index IS the dedup. reserveSend() inserts before sending and treats a
-- unique violation as "already handled", which closes the race the old
-- select-then-insert left open.
create unique index if not exists replied_emails_message_uniq
  on replied_emails (gmail_message_id);

create index if not exists replied_emails_sender_idx on replied_emails (lower(sender_email));
create index if not exists replied_emails_thread_idx on replied_emails (thread_id);
create index if not exists replied_emails_sent_at_idx on replied_emails (sent_at desc);

-- Backfill sender_email from the existing to_email so the per-sender cap counts
-- the historical loop rather than starting from zero.
update replied_emails set sender_email = to_email where sender_email is null;

-- Verify:
--   select auto_reply_enabled from admin_settings;
--   select status, count(*) from replied_emails group by status;
