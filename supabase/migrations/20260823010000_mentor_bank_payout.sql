-- ============================================================
-- Second manual payout channel: bank account (NEFT/IMPS)
-- Additive to UPI — a mentor can have UPI only, bank only, or both.
-- ============================================================

ALTER TABLE mentor_profiles
  ADD COLUMN IF NOT EXISTS bank_account        TEXT,
  ADD COLUMN IF NOT EXISTS ifsc                TEXT,
  ADD COLUMN IF NOT EXISTS account_holder_name TEXT;

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS ifsc TEXT;
