-- Auto-drip: a library of images that a 15-min cron posts one-per-day, at the
-- time chosen in the admin UI. Each run generates a per-platform caption from
-- the image and sends it to all connected Buffer channels (LinkedIn, X, IG).

create table if not exists social_drip (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  status text not null default 'pending',   -- pending | posting | posted | failed
  linkedin text,                             -- generated caption (filled at post time)
  x text,
  instagram text,
  error text,
  created_at timestamptz default now(),
  posted_at timestamptz
);

-- Oldest pending first — the cron claims one per run.
create index if not exists idx_social_drip_pending
  on social_drip (created_at)
  where status = 'pending';

-- Single-row settings: on/off switch + front-end schedule.
create table if not exists social_drip_settings (
  id int primary key default 1,
  enabled boolean not null default false,
  post_time text not null default '09:00',        -- HH:MM in `timezone`
  timezone text not null default 'Asia/Kolkata',  -- IANA tz name
  last_posted_on text,                            -- YYYY-MM-DD (in tz) of last auto post
  cron_token text,                                -- gate for the public cron URL
  updated_at timestamptz default now()
);

insert into social_drip_settings (id, enabled)
  values (1, false)
  on conflict (id) do nothing;

-- Backfill columns for installs created before scheduling was added.
alter table social_drip_settings add column if not exists post_time text not null default '09:00';
alter table social_drip_settings add column if not exists timezone text not null default 'Asia/Kolkata';
alter table social_drip_settings add column if not exists last_posted_on text;
alter table social_drip_settings add column if not exists cron_token text;
