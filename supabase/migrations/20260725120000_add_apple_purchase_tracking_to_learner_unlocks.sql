ALTER TABLE learner_unlocks
  ADD COLUMN IF NOT EXISTS apple_transaction_id TEXT;

COMMENT ON COLUMN learner_unlocks.apple_transaction_id IS 'Apple StoreKit transaction id for this unlock, when paid via Apple In-App Purchase instead of Razorpay/Play Billing. Used for idempotency in verify-apple-purchase.';
