ALTER TABLE learner_unlocks
  ADD COLUMN IF NOT EXISTS play_purchase_token TEXT;

COMMENT ON COLUMN learner_unlocks.play_purchase_token IS 'Google Play Billing purchase token for this unlock, when paid via Play Billing instead of Razorpay. Used for idempotency in verify-play-purchase.';
