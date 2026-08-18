-- Structured facts pulled out of each posting, so a card can show what a
-- recruiter actually screens on instead of a wall of description text.
-- Run in the Supabase SQL editor AFTER supabase/job_finder.sql.

DO $$
DECLARE c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['seniority','sponsorship','clearance','employment_type']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'job_listings' AND column_name = c
    ) THEN
      EXECUTE format('ALTER TABLE job_listings ADD COLUMN %I TEXT', c);
    END IF;
  END LOOP;
END $$;

-- Freshness index — the "Today" feed is the most-hit query.
CREATE INDEX IF NOT EXISTS job_listings_fresh_idx
  ON job_listings (created_at DESC)
  WHERE status IN ('new', 'saved');
