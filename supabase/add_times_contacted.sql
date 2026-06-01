-- Add times_contacted column to recruiter_contacts.
-- Run this in Supabase SQL editor.
ALTER TABLE recruiter_contacts
  ADD COLUMN IF NOT EXISTS times_contacted INT NOT NULL DEFAULT 1;
