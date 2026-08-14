-- Voice Learning Agent: stores extracted communication style
-- Run this in Supabase SQL Editor

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS voice_prompt text,
  ADD COLUMN IF NOT EXISTS voice_prompt_updated_at timestamptz;
