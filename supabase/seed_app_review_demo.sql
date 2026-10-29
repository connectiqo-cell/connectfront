-- App Review demo data seed
-- ---------------------------------------------------------------------------
-- Gives the App Store / Play reviewer an account where every paid surface is
-- already unlocked, so they never hit Razorpay checkout (live key — they cannot
-- complete an Indian UPI/card payment) and never see an empty screen.
--
-- BEFORE RUNNING THIS: create both accounts through normal signup in the app,
-- so GoTrue builds proper auth.users + auth.identities rows and the passwords
-- actually work. Hand-inserting into auth.users is the usual way this breaks.
--
--   1. Reviewer account  -> the credentials you give Apple
--   2. Counterpart account -> the "mentor" the reviewer books and calls
--
-- Then set the two emails below and run this whole file in the Supabase SQL
-- editor (it runs as postgres, so RLS does not apply).
--
-- Re-runnable: refreshes slots and keeps exactly one upcoming demo booking.

BEGIN;

DO $$
DECLARE
  -- ── EDIT THESE TWO ────────────────────────────────────────────────────────
  v_reviewer_email text := 'appreview@connectiqo.com';
  v_mentor_email   text := 'demomentor@connectiqo.com';
  -- ──────────────────────────────────────────────────────────────────────────

  v_reviewer uuid;
  v_mentor   uuid;
  v_slot_id  uuid;
  v_booking  uuid;
  v_existing uuid;
  d          date;
BEGIN
  SELECT id INTO v_reviewer FROM auth.users WHERE email = v_reviewer_email;
  SELECT id INTO v_mentor   FROM auth.users WHERE email = v_mentor_email;

  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'No auth user for %. Sign this account up in the app first.', v_reviewer_email;
  END IF;
  IF v_mentor IS NULL THEN
    RAISE EXCEPTION 'No auth user for %. Sign this account up in the app first.', v_mentor_email;
  END IF;

  -- ── Profiles ──────────────────────────────────────────────────────────────
  UPDATE profiles SET name = 'App Review' WHERE id = v_reviewer;
  UPDATE profiles SET name = 'Demo Mentor', role = 'mentor' WHERE id = v_mentor;

  -- ── Mentor profile: bookable, with a priced video library ─────────────────
  INSERT INTO mentor_profiles (id, specialization, bio, experience_years,
                               price_per_hour, rating, total_sessions,
                               category, unlock_price)
  VALUES (v_mentor, 'Content Strategy',
          'Demo creator account used for App Review. Books, calls and payouts are pre-seeded.',
          5, 500, 5, 12, 'Business', 299)
  ON CONFLICT (id) DO UPDATE
    SET specialization   = EXCLUDED.specialization,
        bio              = EXCLUDED.bio,
        price_per_hour   = EXCLUDED.price_per_hour,
        unlock_price     = EXCLUDED.unlock_price,
        category         = EXCLUDED.category;

  -- ── Fresh availability: 30 days out, so the seed does not go stale mid-review
  -- Only unbooked demo slots are cleared, so the seeded booking below survives
  -- a re-run.
  DELETE FROM availability_slots
   WHERE mentor_id = v_mentor AND is_booked = false;

  FOR d IN SELECT generate_series(CURRENT_DATE + 1, CURRENT_DATE + 30, '1 day')::date LOOP
    INSERT INTO availability_slots (mentor_id, date, start_time, end_time, is_booked)
    VALUES (v_mentor, d, '10:00:00', '11:00:00', false),
           (v_mentor, d, '11:00:00', '12:00:00', false),
           (v_mentor, d, '15:00:00', '16:00:00', false);
  END LOOP;

  -- ── One pre-paid confirmed booking, so Join works without any payment ─────
  -- claim_and_book_slots is the same RPC verify-razorpay-payment calls, so the
  -- booking and its pending earnings row are identical to a real paid one.
  SELECT b.id INTO v_existing
    FROM bookings b
    JOIN availability_slots s ON s.id = b.slot_id
   WHERE b.learner_id = v_reviewer
     AND b.mentor_id  = v_mentor
     AND b.status     = 'confirmed'
     AND s.date >= CURRENT_DATE
   LIMIT 1;

  IF v_existing IS NULL THEN
    SELECT id INTO v_slot_id
      FROM availability_slots
     WHERE mentor_id = v_mentor
       AND date = CURRENT_DATE + 7
       AND start_time = '10:00:00'
     LIMIT 1;

    v_booking := claim_and_book_slots(
      v_mentor, v_reviewer, ARRAY[v_slot_id],
      'App Review demo session — already paid, no checkout required.',
      false, 400
    );
    RAISE NOTICE 'Seeded booking %', v_booking;
  ELSE
    RAISE NOTICE 'Upcoming booking % already present, left alone', v_existing;
  END IF;

  -- ── Video library unlocked for the reviewer ───────────────────────────────
  -- Mirrors what a website membership grants, so the reader-pattern gate in
  -- VideosScreen opens without any purchase inside the app.
  INSERT INTO learner_unlocks (learner_id, mentor_id, amount_paid)
  VALUES (v_reviewer, v_mentor, 299)
  ON CONFLICT (learner_id, mentor_id) DO UPDATE SET amount_paid = EXCLUDED.amount_paid;

  RAISE NOTICE 'Demo seed complete: reviewer=% mentor=%', v_reviewer, v_mentor;
END $$;

COMMIT;
