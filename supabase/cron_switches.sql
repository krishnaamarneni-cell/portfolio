-- Per-job on/off switches for the scheduled jobs. Run in the Supabase SQL editor.
--
-- The point is to cut Vercel Fluid Active CPU, so the switch is read by GitHub
-- Actions BEFORE it calls Vercel, not inside the route. A flag checked inside
-- the route still costs a function invocation on every tick — about 330 a day
-- across these jobs — which is most of what we are trying to avoid. Reading it
-- from Supabase instead costs Vercel nothing at all.
--
-- That is why this table is world-readable: the workflow authenticates with the
-- publishable key, which is already public in the browser bundle. Only booleans
-- and labels live here, never a secret. Writes stay admin-only (service role).
--
-- Until now the only way to stop a job was commenting out the cron line in its
-- workflow YAML, which is what is currently done to all five.

create table if not exists cron_switches (
  key text primary key,
  label text not null,
  -- What the workflow runs when enabled; shown in the admin card so the
  -- schedule and the switch can never disagree silently.
  schedule text,
  enabled boolean not null default true,
  -- Written by the route itself, so the card can show whether it is really running.
  last_run_at timestamptz,
  last_status text,
  updated_at timestamptz not null default now()
);

insert into cron_switches (key, label, schedule, enabled) values
  ('auto-reply',    'Auto-reply to recruiters', '*/5, 9am-6pm New York', false),
  ('job-finder',    'Job Finder crawl + scoring', 'every 15 min', false),
  ('social-drip',   'Social Autopilot + queue',   'every 15 min', false),
  ('agents',        'Agent crew (news, inbox)',   '4x daily',     false),
  ('warm-outreach', 'Warm check-in outreach',     'weekdays 10am NY', false)
on conflict (key) do nothing;

alter table cron_switches enable row level security;

-- Read-only to anyone with the publishable key; that is what lets the workflow
-- check the switch without spending Vercel CPU.
drop policy if exists cron_switches_public_read on cron_switches;
create policy cron_switches_public_read on cron_switches for select using (true);

-- Verify:
--   select key, enabled, schedule, last_run_at from cron_switches order by key;
