-- Track server-sent FCM session reminders (15 min before start).
-- Used by edge function notify-session-reminders for idempotency.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

COMMENT ON COLUMN public.bookings.reminder_sent_at IS
  'When the 15-minute pre-session FCM reminder was sent; null = not yet reminded.';

CREATE INDEX IF NOT EXISTS bookings_reminder_pending_idx
  ON public.bookings (status)
  WHERE reminder_sent_at IS NULL
    AND status IN ('pending', 'confirmed');
