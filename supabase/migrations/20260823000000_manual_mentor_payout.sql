-- ============================================================
-- Manual mentor payout (UPI) — foundation
-- Replaces RazorpayX/Route payout automation with admin-fulfilled
-- withdrawal requests. Razorpay stays learner→platform collection only.
-- ============================================================

-- ── 1. New columns on withdrawal_requests for manual fulfilment ────────────
ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_method    TEXT,        -- 'upi' | 'imps' | 'neft'
  ADD COLUMN IF NOT EXISTS payout_reference TEXT,        -- UTR / bank reference
  ADD COLUMN IF NOT EXISTS paid_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_by     TEXT,        -- admin operator email
  ADD COLUMN IF NOT EXISTS rejected_reason  TEXT;

-- ── 2. THE MISSING RPC — deduct_wallet_for_withdrawal ──────────────────────
-- Atomic check-and-decrement. Does NOT touch total_withdrawn (that only
-- increments on admin_complete_withdrawal, when money actually leaves).
CREATE OR REPLACE FUNCTION deduct_wallet_for_withdrawal(
  p_mentor_id UUID,
  p_amount    NUMERIC
)
RETURNS NUMERIC   -- returns new balance
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT balance INTO v_balance
  FROM mentor_wallets
  WHERE id = p_mentor_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for mentor';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  UPDATE mentor_wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_mentor_id
  RETURNING balance INTO v_balance;

  RETURN v_balance;
END;
$$;

-- ── 3. Admin fulfilment RPCs (SECURITY DEFINER, row-locked, status-guarded) ─

CREATE OR REPLACE FUNCTION admin_mark_processing(
  p_id       UUID,
  p_operator TEXT
)
RETURNS SETOF withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE withdrawal_requests
  SET status = 'processing',
      processed_by = COALESCE(p_operator, processed_by),
      updated_at = now()
  WHERE id = p_id AND status = 'pending'
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION admin_complete_withdrawal(
  p_id        UUID,
  p_method    TEXT,
  p_reference TEXT,
  p_operator  TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS SETOF withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row withdrawal_requests%ROWTYPE;
BEGIN
  IF p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'UTR / payout reference is required to complete a withdrawal';
  END IF;

  SELECT * INTO v_row
  FROM withdrawal_requests
  WHERE id = p_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  -- idempotent no-op: already completed, don't double-count total_withdrawn
  IF v_row.status = 'completed' THEN
    RETURN QUERY SELECT * FROM withdrawal_requests WHERE id = p_id;
    RETURN;
  END IF;

  IF v_row.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Cannot complete a withdrawal in status %', v_row.status;
  END IF;

  UPDATE mentor_wallets
  SET total_withdrawn = total_withdrawn + v_row.amount,
      updated_at = now()
  WHERE id = v_row.mentor_id;

  RETURN QUERY
  UPDATE withdrawal_requests
  SET status = 'completed',
      payout_method = p_method,
      payout_reference = p_reference,
      paid_at = now(),
      processed_by = p_operator,
      admin_note = COALESCE(p_note, admin_note),
      updated_at = now()
  WHERE id = p_id
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_withdrawal(
  p_id       UUID,
  p_reason   TEXT,
  p_operator TEXT
)
RETURNS SETOF withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row withdrawal_requests%ROWTYPE;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT * INTO v_row
  FROM withdrawal_requests
  WHERE id = p_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;

  -- idempotent no-op: already rejected, don't double-refund the wallet
  IF v_row.status = 'rejected' THEN
    RETURN QUERY SELECT * FROM withdrawal_requests WHERE id = p_id;
    RETURN;
  END IF;

  IF v_row.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Cannot reject a withdrawal in status %', v_row.status;
  END IF;

  -- refund the balance that was held at request time
  UPDATE mentor_wallets
  SET balance = balance + v_row.amount,
      updated_at = now()
  WHERE id = v_row.mentor_id;

  RETURN QUERY
  UPDATE withdrawal_requests
  SET status = 'rejected',
      rejected_reason = p_reason,
      processed_by = p_operator,
      updated_at = now()
  WHERE id = p_id
  RETURNING *;
END;
$$;

-- No new RLS policy needed: mentors keep SELECT/INSERT-own only
-- (from 001_payment_tables.sql). These RPCs are SECURITY DEFINER and are
-- invoked by the admin app using the service-role key, bypassing RLS.
