-- Open tracking for bulk sends. Run in the Supabase SQL editor.
--
-- Read this before trusting the number it produces.
--
-- An "open" is recorded when the recipient's mail client loads a 1x1 image from
-- our server. That makes it a weak signal in both directions:
--   * UNDER-counts, because many clients block remote images by default. A
--     recruiter can read the whole email and never register.
--   * OVER-counts, because machines load images too. Apple Mail Privacy
--     Protection pre-fetches every image whether or not the mail is opened, and
--     corporate filters (Proofpoint, Mimecast, Barracuda) fetch them on arrival.
--
-- So opens are directional, not factual. `prefetch_count` below exists to make
-- part of that visible rather than hidden: a load within seconds of sending is
-- a scanner, not a person, and is counted separately.

ALTER TABLE bulk_sends
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ,
  -- Loads at least a few seconds after sending — a person, probably.
  ADD COLUMN IF NOT EXISTS open_count INT NOT NULL DEFAULT 0,
  -- Loads within seconds of sending — a scanner, essentially always.
  ADD COLUMN IF NOT EXISTS prefetch_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bulk_sends_opened_idx ON bulk_sends (opened_at DESC);

-- Verify:
--   SELECT count(*) FILTER (WHERE open_count > 0) AS opened,
--          count(*) FILTER (WHERE prefetch_count > 0) AS scanner_only,
--          count(*) AS total
--   FROM bulk_sends;
