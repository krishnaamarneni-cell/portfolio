-- What's working, learned from real reach and fed back into the writer.
-- Run in the Supabase SQL editor.
--
-- The analysis used to be prose the model wrote once and nobody kept. Storing
-- it as structured rows is what lets the post generator read it: "hooks that
-- open with a personal outcome average 432 impressions" is only useful if the
-- thing writing the next post can see it.

CREATE TABLE IF NOT EXISTS social_playbook (
  id INT PRIMARY KEY DEFAULT 1,
  -- Structured findings, not prose. See lib/social-playbook.ts for the shape.
  playbook JSONB NOT NULL DEFAULT '{}',
  -- Sample size behind it, so the UI can say how much to trust it.
  posts_analyzed INT NOT NULL DEFAULT 0,
  metrics_available BOOLEAN NOT NULL DEFAULT false,
  model_used TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_playbook_singleton CHECK (id = 1)
);

ALTER TABLE social_playbook ENABLE ROW LEVEL SECURITY;

-- Verify:
--   SELECT posts_analyzed, metrics_available, analyzed_at FROM social_playbook;
