-- Reschedule flow rework: moves the three client-side-only writes in
-- rescheduleApi.ts (markForReschedule, proposeSlot, declineProposal) behind
-- SECURITY DEFINER RPCs so every validation rule is enforced on the backend,
-- not just in the UI. Follows the same house style as the existing
-- accept_reschedule_proposal/complete_session_payment functions
-- (auth.uid() checks, FOR UPDATE row locks, json_build_object returns).
-- accept_reschedule_proposal itself is untouched — it already does the right
-- thing (creates a new confirmed booking, marks the old one rescheduled,
-- moves earnings) and isn't part of this rework.

-- Learner: mark a booking as needing reschedule after the mentor no-showed
-- or a technical issue ended the session early. Previously this was a plain
-- client .update() with no check that the session had actually ended, so a
-- learner could flip a booking to reschedule_needed before the session even
-- started. Resolves the real end time from availability_slots (via
-- slot_ids for continuous multi-slot bookings, falling back to slot_id),
-- anchored to Asia/Kolkata since that's the only locale used app-wide.
CREATE OR REPLACE FUNCTION public.request_reschedule(p_booking_id uuid, p_reason text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_booking bookings%ROWTYPE;
  v_end_date date;
  v_end_time time;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  IF v_booking.learner_id <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Booking is not in a state that can be marked for reschedule (status: %)', v_booking.status;
  END IF;
  IF p_reason NOT IN ('mentor_noshow', 'technical') THEN
    RAISE EXCEPTION 'Invalid reason';
  END IF;

  SELECT date, MAX(end_time) INTO v_end_date, v_end_time
  FROM availability_slots
  WHERE id = ANY(COALESCE(v_booking.slot_ids, ARRAY[v_booking.slot_id]))
  GROUP BY date;
  IF v_end_date IS NULL THEN
    RAISE EXCEPTION 'Could not resolve the booked slot';
  END IF;

  IF (v_end_date + v_end_time) AT TIME ZONE 'Asia/Kolkata' > now() THEN
    RAISE EXCEPTION 'This session has not ended yet';
  END IF;

  UPDATE bookings
  SET status = 'reschedule_needed',
      reschedule_reason = p_reason,
      reschedule_deadline = now() + interval '7 days'
  WHERE id = p_booking_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- Mentor: propose a new time for a booking awaiting reschedule. Previously a
-- plain client insert with no duration check, no conflict check, and no cap
-- on how many times a proposal can be declined. Enforces the proposed slot
-- runs exactly as long as the original session, doesn't conflict with any
-- of the mentor's other pending/confirmed bookings that day, and is in the
-- future. Also carries a safety-net check on the 3-decline cap in case the
-- client (or decline_reschedule_proposal below) is ever bypassed.
CREATE OR REPLACE FUNCTION public.propose_reschedule_slot(
  p_booking_id uuid, p_date date, p_start_time time, p_end_time time
) RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_booking bookings%ROWTYPE;
  v_orig_start time;
  v_orig_end time;
  v_required_minutes int;
  v_proposed_minutes int;
  v_declined_count int;
  v_conflict boolean;
  v_new_request_id uuid;
  v_expires_at timestamptz := now() + interval '48 hours';
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  IF v_booking.mentor_id <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_booking.status <> 'reschedule_needed' THEN
    RAISE EXCEPTION 'This booking is not awaiting a reschedule proposal (status: %)', v_booking.status;
  END IF;

  SELECT COUNT(*) INTO v_declined_count
  FROM reschedule_requests
  WHERE booking_id = p_booking_id AND status = 'declined';
  IF v_declined_count >= 3 THEN
    UPDATE bookings SET status = 'reschedule_unresolved' WHERE id = p_booking_id;
    RAISE EXCEPTION 'Reschedule attempt limit reached for this booking';
  END IF;

  IF (p_date + p_start_time) AT TIME ZONE 'Asia/Kolkata' <= now() THEN
    RAISE EXCEPTION 'Proposed time must be in the future';
  END IF;
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  SELECT MIN(start_time), MAX(end_time) INTO v_orig_start, v_orig_end
  FROM availability_slots
  WHERE id = ANY(COALESCE(v_booking.slot_ids, ARRAY[v_booking.slot_id]));
  IF v_orig_start IS NULL THEN
    RAISE EXCEPTION 'Could not resolve original slot duration';
  END IF;

  v_required_minutes := (EXTRACT(EPOCH FROM (v_orig_end - v_orig_start)) / 60)::int;
  v_proposed_minutes := (EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 60)::int;
  IF v_proposed_minutes <> v_required_minutes THEN
    RAISE EXCEPTION 'Proposed duration (% min) must match the original session length (% min)',
      v_proposed_minutes, v_required_minutes;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM bookings b
    JOIN availability_slots s ON s.id = ANY(COALESCE(b.slot_ids, ARRAY[b.slot_id]))
    WHERE b.mentor_id = v_booking.mentor_id
      AND b.id <> p_booking_id
      AND b.status IN ('pending', 'confirmed')
      AND s.date = p_date
      AND s.start_time < p_end_time
      AND s.end_time > p_start_time
  ) INTO v_conflict;
  IF v_conflict THEN
    RAISE EXCEPTION 'This time conflicts with another one of your booked sessions';
  END IF;

  UPDATE reschedule_requests
  SET status = 'expired', updated_at = now()
  WHERE booking_id = p_booking_id AND status = 'pending';

  INSERT INTO reschedule_requests (
    booking_id, mentor_id, learner_id, reason,
    proposed_date, proposed_start_time, proposed_end_time, expires_at
  )
  VALUES (
    p_booking_id, v_booking.mentor_id, v_booking.learner_id, v_booking.reschedule_reason,
    p_date, p_start_time, p_end_time, v_expires_at
  )
  RETURNING id INTO v_new_request_id;

  UPDATE bookings SET status = 'reschedule_proposed' WHERE id = p_booking_id;

  RETURN json_build_object('success', true, 'request_id', v_new_request_id, 'expires_at', v_expires_at);
END;
$function$;

-- Learner: decline a mentor's proposed time. Owns the 3-strike count: on the
-- 3rd decline for a booking, flips it to reschedule_unresolved instead of
-- back to reschedule_needed. Once unresolved, propose_reschedule_slot's own
-- status guard blocks all further proposals for free.
CREATE OR REPLACE FUNCTION public.decline_reschedule_proposal(p_request_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_req reschedule_requests%ROWTYPE;
  v_declined_count int;
  v_unresolved boolean := false;
BEGIN
  SELECT * INTO v_req FROM reschedule_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reschedule request not found';
  END IF;
  IF v_req.learner_id <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already handled (status: %)', v_req.status;
  END IF;

  UPDATE reschedule_requests SET status = 'declined', updated_at = now() WHERE id = p_request_id;

  SELECT COUNT(*) INTO v_declined_count
  FROM reschedule_requests
  WHERE booking_id = v_req.booking_id AND status = 'declined';

  IF v_declined_count >= 3 THEN
    v_unresolved := true;
    UPDATE bookings SET status = 'reschedule_unresolved' WHERE id = v_req.booking_id;
  ELSE
    UPDATE bookings SET status = 'reschedule_needed' WHERE id = v_req.booking_id;
  END IF;

  RETURN json_build_object('success', true, 'unresolved', v_unresolved, 'attempts_used', v_declined_count);
END;
$function$;

-- Live-update requirement: booking status changes were already realtime via
-- the bookings table, but reschedule_requests (proposals themselves) were
-- not, so a learner's "Review proposal" link never appeared without a manual
-- refresh. Guarded so this is safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reschedule_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reschedule_requests;
  END IF;
END $$;
