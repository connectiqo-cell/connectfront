-- Learner's recording choice captured during checkout.
-- NULL is retained for bookings created before this preference was introduced.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recording_requested BOOLEAN;

COMMENT ON COLUMN public.bookings.recording_requested IS
  'Learner recording preference selected at booking. False blocks recording; true still requires live participant consent.';
