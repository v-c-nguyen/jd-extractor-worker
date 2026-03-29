-- Enforce predefined transaction statuses. Safe if 004 already added the same CHECK (no-op after constraint exists).

UPDATE bidder_transactions
SET status = 'Paid'
WHERE lower(trim(status)) = 'paid';

UPDATE bidder_transactions
SET status = 'Confirmed'
WHERE lower(trim(status)) IN ('confirmed', 'confirm');

UPDATE bidder_transactions
SET status = 'Pending'
WHERE lower(trim(status)) IN ('pending', '') OR status NOT IN ('Pending', 'Confirmed', 'Paid');

ALTER TABLE bidder_transactions DROP CONSTRAINT IF EXISTS bidder_transactions_status_check;
ALTER TABLE bidder_transactions
  ADD CONSTRAINT bidder_transactions_status_check
  CHECK (status IN ('Pending', 'Confirmed', 'Paid'));
