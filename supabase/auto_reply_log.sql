-- Why the auto-reply did or did not answer each email. Run in the SQL editor.
--
-- The pipeline already computes a reason for every decision — classified
-- personal, 62% is below 70%, already replied twice in this thread, outside the
-- send window — and then returns it to a cron endpoint where nobody reads it.
-- So "it didn't reply to anything" and "it never ran" look identical from the
-- outside, and neither can be told apart from "it read them and scored them
-- low", which is the actual question.
--
-- One row per evaluated email makes that answerable.

create table if not exists auto_reply_log (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text,
  from_email text,
  subject text,
  -- job | personal | marketing | automated | suspicious | other, when the
  -- classifier got far enough to decide.
  category text,
  match_pct int,
  -- sent | skipped | failed
  decision text not null,
  -- Human-readable and specific: this is the column the UI shows.
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists auto_reply_log_created_idx on auto_reply_log (created_at desc);

alter table auto_reply_log enable row level security;

-- Run-level heartbeat, so "no runs recorded" is distinguishable from
-- "ran and rejected everything". Without this, a cron that never fires is
-- invisible.
alter table admin_settings
  add column if not exists auto_reply_last_run_at timestamptz,
  add column if not exists auto_reply_last_summary text;

-- Verify:
--   select auto_reply_last_run_at, auto_reply_last_summary from admin_settings;
--   select decision, count(*) from auto_reply_log group by decision;
