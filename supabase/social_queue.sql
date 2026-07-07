create table if not exists social_queue (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  platform text not null,
  channel_id text not null,
  channel_name text,
  image_url text,
  due_at timestamptz not null,
  status text not null default 'pending',
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

create index if not exists idx_social_queue_pending
  on social_queue (due_at)
  where status = 'pending';
