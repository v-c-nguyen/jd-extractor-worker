-- Per-bidder payment / ledger rows (fees, retainers, on-chain transfers). Run after 001_bidders.sql.

CREATE TABLE IF NOT EXISTS bidder_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bidder_id UUID NOT NULL REFERENCES bidders (id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  entry_type TEXT NOT NULL,
  amount NUMERIC(24, 8) NOT NULL CHECK (amount >= 0),
  network TEXT NOT NULL CHECK (network IN ('BEP20', 'ERC20', 'OTHER')),
  status TEXT NOT NULL,
  tx_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bidder_transactions_bidder_occurred
  ON bidder_transactions (bidder_id, occurred_on DESC, id DESC);

CREATE OR REPLACE FUNCTION set_bidder_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bidder_transactions_updated_at ON bidder_transactions;
CREATE TRIGGER trg_bidder_transactions_updated_at
  BEFORE UPDATE ON bidder_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_bidder_transactions_updated_at();
