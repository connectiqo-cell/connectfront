-- Persist learner recording choice on the payment transaction (source of truth at checkout).
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recording_requested BOOLEAN;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS booking_message TEXT;

COMMENT ON COLUMN public.transactions.recording_requested IS
  'Learner recording preference captured when Razorpay order was created.';

COMMENT ON COLUMN public.transactions.booking_message IS
  'Learner session goal message captured when Razorpay order was created.';

-- Backfill bookings that were created before recording_requested was written on insert.
UPDATE public.bookings b
SET recording_requested = t.recording_requested
FROM public.transactions t
WHERE t.booking_id = b.id
  AND b.recording_requested IS NULL
  AND t.recording_requested IS NOT NULL;
