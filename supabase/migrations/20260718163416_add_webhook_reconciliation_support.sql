-- Tracks video-subscription orders so the Razorpay webhook can reconcile a
-- payment even if the client never calls verify-video-subscription (crash,
-- offline, killed app). Not surfaced in any UI — service-role access only.
CREATE TABLE IF NOT EXISTS video_order_intents (
  razorpay_order_id TEXT PRIMARY KEY,
  mentor_id  UUID NOT NULL REFERENCES profiles(id),
  learner_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE video_order_intents ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role key (used by edge functions) can read/write this table.

-- Prevents two concurrent processes (e.g. the client's verify call racing the
-- new webhook) from both creating a booking for the same slot. Cancelled
-- bookings are excluded so a slot can still be legitimately rebooked after
-- cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_unique
  ON bookings(slot_id)
  WHERE status <> 'cancelled';

COMMENT ON TABLE video_order_intents IS 'Pending video-subscription orders, written by create-video-order, read by the razorpay-webhook reconciler when the client never confirms.';
