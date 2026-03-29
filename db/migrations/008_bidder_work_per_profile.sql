-- Per-profile daily work: one row per (bidder, profile, date). Run after 006 and 007.
-- Login accounts live in app_users; each bidder may reference one app user via bidders.app_user_id.

ALTER TABLE bidders
  ADD COLUMN IF NOT EXISTS app_user_id UUID REFERENCES app_users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bidders_app_user_id ON bidders (app_user_id);

ALTER TABLE bidder_work_entries
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles (id) ON DELETE CASCADE;

UPDATE bidder_work_entries w
SET profile_id = (
  SELECT p.id
  FROM profiles p
  WHERE p.bidder_id = w.bidder_id
  ORDER BY p.created_at ASC NULLS LAST, p.id ASC
  LIMIT 1
)
WHERE w.profile_id IS NULL;

DELETE FROM bidder_work_entries WHERE profile_id IS NULL;

ALTER TABLE bidder_work_entries
  ALTER COLUMN profile_id SET NOT NULL;

ALTER TABLE bidder_work_entries
  DROP CONSTRAINT IF EXISTS uq_bidder_work_day;

ALTER TABLE bidder_work_entries
  ADD CONSTRAINT uq_bidder_work_profile_day UNIQUE (bidder_id, profile_id, work_date);

CREATE INDEX IF NOT EXISTS idx_bidder_work_profile_id ON bidder_work_entries (profile_id);

DROP TABLE IF EXISTS user_daily_reports;
