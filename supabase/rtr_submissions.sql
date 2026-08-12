-- RTR (Right-to-Represent) Submissions Tracker
-- Tracks every staffing-agency submission: who submitted, to which client,
-- what role/rate, and current status. Enables follow-up workflows.
--
-- Run manually: paste into Supabase SQL Editor → Run

create table if not exists rtr_submissions (
  id            uuid primary key default gen_random_uuid(),
  thread_id     text,
  recruiter_email text not null,
  recruiter_name  text,
  staffing_company text,
  client_company   text,
  job_title        text,
  location         text,
  rate             text,
  employment_type  text,  -- W2, C2C, 1099
  status           text not null default 'submitted',
    -- submitted | interviewing | rejected | offered | accepted | declined | no_response
  notes            text,
  submitted_at     timestamptz default now(),
  followed_up_at   timestamptz,
  contact_id       uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Fast lookups
create index if not exists idx_rtr_submissions_status on rtr_submissions(status);
create index if not exists idx_rtr_submissions_recruiter on rtr_submissions(recruiter_email);
create index if not exists idx_rtr_submissions_thread on rtr_submissions(thread_id);

-- RLS: service-role only (admin dashboard)
alter table rtr_submissions enable row level security;
