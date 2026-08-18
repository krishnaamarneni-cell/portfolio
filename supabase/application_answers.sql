-- Answer library — the screening questions every ATS asks, answered once.
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  answer TEXT NOT NULL,
  -- Words that appear in the ATS's phrasing of this question. Matching on
  -- these is what lets a packet pre-fill a form it has never seen.
  keywords TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'general',
  sort_order INT DEFAULT 0,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_answers_order_idx
  ON application_answers (sort_order, created_at);

ALTER TABLE application_answers ENABLE ROW LEVEL SECURITY;

-- Starter set. Answers are placeholders on purpose — edit them in
-- Job Finder → Applications → Answer library before using a packet.
INSERT INTO application_answers (label, answer, keywords, category, sort_order)
SELECT * FROM (VALUES
  ('Work authorization', 'Yes — I am authorized to work in the United States.',
   ARRAY['authorized','work authorization','legally authorized','eligible to work'], 'eligibility', 10),
  ('Sponsorship required', 'No — I do not require visa sponsorship now or in the future.',
   ARRAY['sponsorship','visa','h-1b','h1b','require sponsorship'], 'eligibility', 20),
  ('Salary expectation', 'Open, and flexible for the right role — happy to align with your range for this position.',
   ARRAY['salary','compensation','expected pay','desired salary','rate'], 'compensation', 30),
  ('Notice period / availability', 'Two weeks from offer acceptance.',
   ARRAY['notice period','start date','availability','when can you start'], 'logistics', 40),
  ('Willing to relocate', 'Open to relocation for the right opportunity; currently targeting remote or hybrid roles in the United States.',
   ARRAY['relocate','relocation','willing to move'], 'logistics', 50),
  ('Years of SAP experience', '7+ years across SAP MM and SD, on both ECC and S/4HANA.',
   ARRAY['years of experience','how many years','experience with sap'], 'experience', 60),
  ('Why this company', 'Placeholder — write two specific sentences per company before submitting. Generic answers here are the fastest way to get screened out.',
   ARRAY['why do you want','why our company','why are you interested'], 'motivation', 70),
  ('Race / ethnicity (EEO)', 'Prefer not to disclose.',
   ARRAY['race','ethnicity','eeo'], 'eeo', 80),
  ('Gender (EEO)', 'Prefer not to disclose.',
   ARRAY['gender','sex'], 'eeo', 90),
  ('Veteran status', 'I am not a protected veteran.',
   ARRAY['veteran','military'], 'eeo', 100),
  ('Disability status', 'Prefer not to answer.',
   ARRAY['disability','disabled'], 'eeo', 110)
) AS seed(label, answer, keywords, category, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM application_answers);
