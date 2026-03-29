-- Per-bidder daily work log. Run after 001_bidders.sql.

CREATE TABLE IF NOT EXISTS bidder_work_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bidder_id UUID NOT NULL REFERENCES bidders (id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_bidder_work_day UNIQUE (bidder_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_bidder_work_bidder_date ON bidder_work_entries (bidder_id, work_date DESC);

CREATE OR REPLACE FUNCTION set_bidder_work_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bidder_work_entries_updated_at ON bidder_work_entries;
CREATE TRIGGER trg_bidder_work_entries_updated_at
  BEFORE UPDATE ON bidder_work_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_bidder_work_entries_updated_at();

-- Then run 003_bidder_work_counts.sql for daily bid_count and interview_count.
