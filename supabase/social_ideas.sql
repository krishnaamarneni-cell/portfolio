-- Post-idea inbox: agents (or you, from chat) save a worthy topic here; you
-- review it in Social → Ideas and one-click draft it in the Composer.

create table if not exists social_ideas (
  id uuid default gen_random_uuid() primary key,
  topic text not null,
  note text,
  source text,                            -- 'chat' | 'observer' | 'manual' | agent key
  status text not null default 'new',     -- new | drafted | dismissed
  created_at timestamptz default now()
);

create index if not exists idx_social_ideas_created on social_ideas (created_at desc);
