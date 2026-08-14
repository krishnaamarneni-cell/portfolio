-- Social Autopilot: AI-driven daily posting agent
-- Run this in Supabase SQL Editor

create table if not exists social_autopilot_settings (
  id int primary key default 1,
  enabled boolean not null default false,
  platforms text[] not null default '{linkedin,instagram}',
  channel_ids text[] not null default '{}',
  post_types text[] not null default '{text}',
  topics text[] not null default '{}',
  post_time text not null default '10:00',
  timezone text not null default 'America/Chicago',
  last_posted_on text,
  updated_at timestamptz default now()
);

insert into social_autopilot_settings (id, enabled)
  values (1, false)
  on conflict (id) do nothing;

create table if not exists social_autopilot_log (
  id uuid default gen_random_uuid() primary key,
  topic text not null,
  platforms_posted text[] not null default '{}',
  post_type text not null default 'text',
  image_url text,
  posts jsonb,
  analytics_context text,
  created_at timestamptz default now()
);

create index if not exists idx_autopilot_log_created
  on social_autopilot_log (created_at desc);
