-- Closes a booking-race bug (note.txt #4: "Same time slot says after
-- booking & payments show booked by another"): verify-razorpay-payment
-- previously SELECTed availability_slots to check is_booked, then only
-- much later ran a separate UPDATE to actually flip is_booked to true,
-- with a booking INSERT sandwiched in between. Two learners paying for the
-- same slot within that window could both pass the check and both end up
-- with a paid, confirmed booking for one slot. The edge function's catch
-- for Postgres error 23505 assumed a unique constraint would block the
-- second writer, but no such constraint was ever added to bookings.slot_id
-- or slot_ids (both are plain/GIN indexes only) — so nothing ever caught it.
--
-- This RPC makes the claim atomic: the UPDATE ... WHERE is_booked = false
-- is the actual guard, not the earlier SELECT. Postgres row-locks each
-- targeted row during the UPDATE, so concurrent callers serialize on it —
-- at most one caller can ever flip a given slot from false to true. If any
-- requested slot didn't flip (already booked, wrong mentor, or doesn't
-- exist), the RAISE EXCEPTION aborts the whole function's transaction,
-- automatically rolling back any slots this same call *did* manage to
-- claim — no manual compensation needed. Booking + pending-earnings rows
-- are created in the same transaction so a mid-flight crash can no longer
-- strand a claimed-but-unbooked slot either.
CREATE OR REPLACE FUNCTION public.claim_and_book_slots(
  p_mentor_id uuid,
  p_learner_id uuid,
  p_slot_ids uuid[],
  p_message text,
  p_recording_requested boolean,
  p_mentor_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claimed_ids uuid[];
  v_booking_id uuid;
BEGIN
  IF p_slot_ids IS NULL OR array_length(p_slot_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No slots provided';
  END IF;

  WITH claimed AS (
    UPDATE availability_slots
    SET is_booked = true
    WHERE id = ANY(p_slot_ids)
      AND mentor_id = p_mentor_id
      AND is_booked = false
    RETURNING id
  )
  SELECT array_agg(id) INTO v_claimed_ids FROM claimed;

  IF v_claimed_ids IS NULL
     OR array_length(v_claimed_ids, 1) IS DISTINCT FROM array_length(p_slot_ids, 1) THEN
    RAISE EXCEPTION 'SLOT_ALREADY_BOOKED: one or more selected slots were just booked by someone else';
  END IF;

  -- p_slot_ids is expected pre-sorted by start_time (the edge function
  -- already sorts + validates contiguity before calling this); the first
  -- element becomes the booking's primary slot_id for FK/compat.
  INSERT INTO bookings (mentor_id, learner_id, slot_id, slot_ids, message, recording_requested, status)
  VALUES (p_mentor_id, p_learner_id, p_slot_ids[1], p_slot_ids, p_message, p_recording_requested, 'confirmed')
  RETURNING id INTO v_booking_id;

  IF p_mentor_amount IS NOT NULL AND p_mentor_amount > 0 THEN
    INSERT INTO earnings (mentor_id, booking_id, amount, status)
    VALUES (p_mentor_id, v_booking_id, p_mentor_amount, 'pending');
  END IF;

  RETURN v_booking_id;
END;
$function$;
