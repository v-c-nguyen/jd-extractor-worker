-- Bidders and contacts. Run once against your Neon database (psql, Neon SQL editor, etc.).
-- If CREATE TRIGGER fails on older Postgres, replace EXECUTE FUNCTION with EXECUTE PROCEDURE.

CREATE TABLE IF NOT EXISTS bidders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  rate_currency CHAR(3) NOT NULL,
  rate_amount NUMERIC(14, 4) NOT NULL CHECK (rate_amount >= 0),
  status TEXT NOT NULL,
  role TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bidder_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bidder_id UUID NOT NULL REFERENCES bidders (id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_bidder_contacts_bidder_id ON bidder_contacts (bidder_id);
CREATE INDEX IF NOT EXISTS idx_bidders_created_at ON bidders (created_at DESC);

CREATE OR REPLACE FUNCTION set_bidders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bidders_updated_at ON bidders;
CREATE TRIGGER trg_bidders_updated_at
  BEFORE UPDATE ON bidders
  FOR EACH ROW
  EXECUTE FUNCTION set_bidders_updated_at();
