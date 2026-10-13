-- Reschedule flow rework: closes a gap found by inspecting the live RLS
-- policies (pg_policies) after shipping the 3 new RPCs in the previous
-- migration. "Participants update bookings" had no WITH CHECK (it silently
-- fell back to its USING clause, which only checks row ownership, never the
-- new value), and reschedule_requests' mentor/learner policies granted full
-- INSERT/UPDATE. Together these meant a participant could still bypass
-- request_reschedule/propose_reschedule_slot/decline_reschedule_proposal
-- entirely via a direct PostgREST call — flipping a booking to
-- reschedule_needed before the session ended, inserting a proposal with any
-- date/time (skipping the duration-match and conflict checks), or declining
-- a proposal without ever tripping the 3-strike -> reschedule_unresolved
-- transition.
--
-- The 3 RPCs are SECURITY DEFINER, owned by the table owner, so they bypass
-- RLS entirely (already proven true today by accept_reschedule_proposal's
-- cross-table writes) — tightening these client-facing policies doesn't
-- affect the RPCs. It also doesn't affect the two other legitimate direct
-- writes to bookings.status (cancelBooking -> 'cancelled',
-- updateBookingStatus -> 'completed'), since neither is in the blocked list.

ALTER POLICY "Participants update bookings" ON bookings
  WITH CHECK (
    (auth.uid() = learner_id OR auth.uid() = mentor_id)
    AND status NOT IN ('reschedule_needed', 'reschedule_proposed', 'reschedule_unresolved')
  );

-- Mentor-side reschedule_requests writes (insert a proposal) now happen
-- exclusively inside propose_reschedule_slot. Narrow to read-only so a
-- mentor can still see their own proposals' status (e.g. the attempt
-- counter) but can't write one directly.
DROP POLICY IF EXISTS "mentor_reschedule_all" ON reschedule_requests;
CREATE POLICY "mentor_reschedule_select" ON reschedule_requests
  FOR SELECT USING (auth.uid() = mentor_id);

-- Learner-side accept/decline now happen exclusively inside
-- accept_reschedule_proposal / decline_reschedule_proposal. learner_reschedule_select
-- (read-only) stays untouched.
DROP POLICY IF EXISTS "learner_reschedule_update" ON reschedule_requests;
