-- Details copied from the chain when the server verifies a reported transaction.
ALTER TABLE tx_requests
  ADD COLUMN to_address    TEXT,
  ADD COLUMN value_wei     NUMERIC(78, 0),
  ADD COLUMN block_number  BIGINT;
