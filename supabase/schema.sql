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
