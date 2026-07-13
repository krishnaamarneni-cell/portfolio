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

-- Shared "content memory": what Krishna usually posts. The Social Observer
-- writes it; other agents read it to decide whether a finding fits his style
-- before auto-saving it as an idea. (Optional — agents fall back to a built-in
-- default profile if this table/row is empty.)
create table if not exists social_profile (
  id int primary key default 1,
  profile text,
  updated_at timestamptz default now()
);
