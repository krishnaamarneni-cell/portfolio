-- Run this in the Supabase SQL editor once when setting up the project.
-- Dashboard -> SQL Editor -> New Query -> paste -> Run.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '',
  company text not null,
  location text not null default '',
  period text not null default '',
  logo_src text,
  logo_bg text not null default '#1a1a1a',
  description text not null default '',
  highlights text[] not null default '{}',
  tags text[] not null default '{}',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  number text not null default '',
  description text not null default '',
  link text not null default '',
  tags text[] not null default '{}',
  gradient text not null default 'from-[#ff6b00] to-[#ff8c38]',
  preview text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Public read access — the homepage hits these tables with the anon key.
alter table public.jobs enable row level security;
alter table public.projects enable row level security;

drop policy if exists "Public can read jobs" on public.jobs;
create policy "Public can read jobs" on public.jobs
  for select to anon, authenticated using (true);

drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects" on public.projects
  for select to anon, authenticated using (true);

-- Writes use the service_role key from the Next.js admin API routes,
-- which bypasses RLS by design. No write policy needed.

-- ============ Site content (singleton row) ============
create table if not exists public.site_content (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed empty row if missing.
insert into public.site_content (id, data) values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.site_content enable row level security;

drop policy if exists "Public can read site_content" on public.site_content;
create policy "Public can read site_content" on public.site_content
  for select to anon, authenticated using (true);

-- ============ Thoughts (admin-authored, public-readable when published) ============
create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  raw_text text,
  tags text[] not null default '{}',
  cover_image_url text,
  cover_image_credit text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add cover_image columns to existing installs.
alter table public.thoughts
  add column if not exists cover_image_url text,
  add column if not exists cover_image_credit text;

-- ============ Connectors (admin-only — secrets, never exposed to anon) ============
create table if not exists public.connectors (
  id text primary key,        -- e.g. 'wealthclaude'
  label text not null default '',
  base_url text not null default '',
  bearer_token text,           -- READ-only token from the target service
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.connectors enable row level security;

-- No public read policy. Service-role key (server-side admin code) is the
-- only thing that can read or write this table.

create index if not exists thoughts_published_idx
  on public.thoughts (published, published_at desc);

alter table public.thoughts enable row level security;

drop policy if exists "Public can read published thoughts" on public.thoughts;
create policy "Public can read published thoughts" on public.thoughts
  for select to anon, authenticated using (published = true);

-- ============ Personal notepad (Life Cockpit) ============
create table if not exists public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  tags text[] not null default '{}',
  -- Optional date the note's "event" happens (visa expiry, flight, move, …).
  event_date date,
  -- How many days before event_date the life-agent should start nagging.
  remind_before_days int,
  pinned boolean not null default false,
  archived boolean not null default false,
  source text not null default 'manual', -- 'manual' | 'agent' | 'import'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_notes_event_idx
  on public.personal_notes (event_date)
  where event_date is not null and archived = false;

alter table public.personal_notes enable row level security;
-- Service-role only. No public policy.

-- ============ Admin settings (singleton, includes Morning Briefing + Sunday Reflection config) ============
create table if not exists public.admin_settings (
  id text primary key default 'singleton',
  morning_briefing_enabled boolean not null default false,
  morning_briefing_to text,
  morning_briefing_last_run_at timestamptz,
  morning_briefing_last_status text,
  morning_briefing_last_subject text,
  updated_at timestamptz not null default now()
);
alter table public.admin_settings enable row level security;
-- Service-role only.

-- Sunday Reflection columns (added later — idempotent).
alter table public.admin_settings
  add column if not exists sunday_reflection_enabled boolean not null default false,
  add column if not exists sunday_reflection_to text,
  add column if not exists sunday_reflection_last_run_at timestamptz,
  add column if not exists sunday_reflection_last_status text,
  add column if not exists sunday_reflection_last_subject text;

-- TOTP 2FA columns (added later — idempotent).
alter table public.admin_settings
  add column if not exists totp_enabled boolean not null default false,
  add column if not exists totp_secret text,
  add column if not exists totp_backup_codes_hashed text[] not null default '{}',
  add column if not exists totp_setup_at timestamptz;

-- ============ Login attempt rate-limiting ============
create table if not exists public.login_attempts (
  ip text primary key,
  count int not null default 1,
  window_start timestamptz not null default now(),
  last_attempt timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
-- Service-role only.

-- ============ Trusted devices (skip OTP for 30 days on known device) ============
create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  token_hashed text not null unique,
  device_label text,
  ip text,
  user_agent text,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists trusted_devices_expires_idx on public.trusted_devices (expires_at);
alter table public.trusted_devices enable row level security;

-- ============ WebAuthn credentials (Face ID / Touch ID / Passkeys) ============
create table if not exists public.webauthn_credentials (
  id text primary key,
  public_key text not null,
  counter bigint not null default 0,
  device_label text,
  transports text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.webauthn_credentials enable row level security;

-- ============ Personal facts (central truths agents inject into every prompt) ============
create table if not exists public.personal_facts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  category text not null default 'general',
  expires_at date,
  source text not null default 'manual',
  updated_at timestamptz not null default now()
);
alter table public.personal_facts enable row level security;

-- ============ Chat threads + messages ============
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New chat',
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text,
  tool_calls jsonb,
  tool_call_id text,
  name text,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx
  on public.chat_messages (thread_id, created_at);
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

-- ============ Habits (daily checkboxes + streaks) ============
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  cadence text not null default 'daily', -- 'daily' | 'weekdays' | 'weekly'
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  done boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique(habit_id, date)
);
create index if not exists habit_checkins_date_idx
  on public.habit_checkins (habit_id, date desc);
alter table public.habits enable row level security;
alter table public.habit_checkins enable row level security;

-- ============ Reading list ============
create table if not exists public.reading_list (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  status text not null default 'reading' check (status in ('wishlist','reading','done','abandoned')),
  progress int, -- pages or %
  rating int check (rating between 1 and 5),
  notes text,
  cover_url text,
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.reading_list enable row level security;

-- ============ Gmail OAuth tokens (singleton row) ============
create table if not exists public.gmail_tokens (
  id text primary key default 'singleton',
  email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.gmail_tokens enable row level security;
-- No public read policy. Service-role key only.
