-- Daily bid and interview counts per bidder. Run after 002_bidder_work.sql.

ALTER TABLE bidder_work_entries
  ADD COLUMN IF NOT EXISTS bid_count INT NOT NULL DEFAULT 0 CHECK (bid_count >= 0),
  ADD COLUMN IF NOT EXISTS interview_count INT NOT NULL DEFAULT 0 CHECK (interview_count >= 0);
