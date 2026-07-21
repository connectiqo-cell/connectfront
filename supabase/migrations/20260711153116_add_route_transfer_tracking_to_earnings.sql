ALTER TABLE earnings
  ADD COLUMN IF NOT EXISTS route_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS route_transferred_at TIMESTAMPTZ;

ALTER TABLE mentor_profiles
  ADD COLUMN IF NOT EXISTS razorpay_account_status TEXT;

COMMENT ON COLUMN earnings.route_transfer_id IS 'Razorpay Route transfer id (trf_...) once the mentor''s cut has been split to their linked account';
COMMENT ON COLUMN earnings.route_transferred_at IS 'When the Route transfer for this earning was created';
COMMENT ON COLUMN mentor_profiles.razorpay_account_status IS 'Raw status from Razorpay linked account (created/under_review/needs_clarification/activated/suspended), synced via get-account-status';
