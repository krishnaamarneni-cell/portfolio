-- Add resume fields to admin_settings.
-- Run this in Supabase SQL editor.
ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_name TEXT,
  ADD COLUMN IF NOT EXISTS resume_updated_at TIMESTAMPTZ;
