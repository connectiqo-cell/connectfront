-- Continuous multi-slot checkout creates one booking spanning several inventory slots.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS slot_ids UUID[] DEFAULT NULL;

COMMENT ON COLUMN public.bookings.slot_ids IS
  'All availability slot IDs covered by this booking. slot_id remains the first for FK/compat. One meeting spans the full continuous range.';

CREATE INDEX IF NOT EXISTS bookings_slot_ids_gin_idx
  ON public.bookings USING GIN (slot_ids);
