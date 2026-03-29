-- One-time cleanup if an older 008 added app_users.bidder_id. Safe to run on fresh DBs (no-op).

ALTER TABLE bidders
  ADD COLUMN IF NOT EXISTS app_user_id UUID REFERENCES app_users (id) ON DELETE SET NULL;

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_users'
      AND column_name = 'bidder_id'
  ) THEN
    UPDATE bidders b
    SET app_user_id = u.id
    FROM app_users u
    WHERE u.bidder_id IS NOT NULL
      AND u.bidder_id = b.id
      AND b.app_user_id IS NULL;
    ALTER TABLE app_users DROP COLUMN bidder_id;
    DROP INDEX IF EXISTS app_users_bidder_id_idx;
  END IF;
END $mig$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bidders_app_user_id ON bidders (app_user_id);
