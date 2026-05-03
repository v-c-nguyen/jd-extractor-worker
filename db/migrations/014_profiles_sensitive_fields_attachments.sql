-- Sensitive identifiers and free-text "additional information" on profiles.
-- Image files stored in profile_attachments (BYTEA); list/detail APIs omit bytes.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ssn_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dl_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS additional_information TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS profile_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  original_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_attachments_profile_id ON profile_attachments (profile_id);
