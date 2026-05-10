-- Phone and industry (vertical) on profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT '';
