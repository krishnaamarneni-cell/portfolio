-- Auto-drip: a library of images that the daily cron posts one-per-day,
-- generating a per-platform caption from each image and sending to all
-- connected Buffer channels (LinkedIn, X, Instagram).

create table if not exists social_drip (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  status text not null default 'pending',   -- pending | posted | failed
  linkedin text,                             -- generated caption (filled at post time)
  x text,
  instagram text,
  error text,
  created_at timestamptz default now(),
  posted_at timestamptz
);

-- Oldest pending first — the cron picks one per run.
create index if not exists idx_social_drip_pending
  on social_drip (created_at)
  where status = 'pending';

-- Single-row settings for the on/off switch.
create table if not exists social_drip_settings (
  id int primary key default 1,
  enabled boolean not null default false,
  updated_at timestamptz default now()
);

insert into social_drip_settings (id, enabled)
  values (1, false)
  on conflict (id) do nothing;
