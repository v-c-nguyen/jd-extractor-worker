-- Interview records linked to profiles (scheduling and outcomes).

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  interview_date DATE NOT NULL,
  applied_date DATE,
  booked_date DATE,
  interview_type TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  pass_status TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  meeting_where TEXT NOT NULL DEFAULT '',
  practice_field TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  resume TEXT NOT NULL DEFAULT '',
  jd TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interviews_profile_id ON interviews (profile_id);
CREATE INDEX IF NOT EXISTS idx_interviews_interview_date ON interviews (interview_date DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews (created_at DESC);

CREATE OR REPLACE FUNCTION set_interviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_interviews_updated_at ON interviews;
CREATE TRIGGER trg_interviews_updated_at
  BEFORE UPDATE ON interviews
  FOR EACH ROW
  EXECUTE FUNCTION set_interviews_updated_at();
