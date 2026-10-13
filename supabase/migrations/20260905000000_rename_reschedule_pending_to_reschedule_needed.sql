-- Reschedule flow rework: renames the `reschedule_pending` booking status to
-- `reschedule_needed`. The rename removes a confusing near-collision with the
-- unrelated `pending` status (awaiting the mentor's initial confirmation) and
-- makes room for two new explicit statuses shipped alongside this migration:
-- `reschedule_proposed` (mentor has proposed a new time, awaiting the
-- learner's response) and `reschedule_unresolved` (3 proposals declined —
-- terminal, no further action possible). See the accompanying
-- 20260905010000 migration for the RPCs that enforce these transitions.
--
-- The CHECK constraint below makes the full status model structurally
-- enforced rather than convention-only. An existing bookings_status_check
-- constraint (added outside this repo's migration history — it still listed
-- the old reschedule_pending value) is replaced rather than added alongside.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

UPDATE bookings SET status = 'reschedule_needed' WHERE status = 'reschedule_pending';

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'rescheduled',
      'reschedule_needed', 'reschedule_proposed', 'reschedule_unresolved'
    )
  );
