-- Trending creators for the Welcome screen, with admin pin / hide overrides.
--
-- Automatic score (higher = more trending):
--   3 × bookings in the last 7 days
-- + 1 × bookings 8–30 days ago
-- + 2 × distinct learners who booked in the last 30 days
-- + 2 × reviews received in the last 30 days
-- + 2 × Bayesian rating (avg pulled toward the platform mean until a mentor
--       has ~5 reviews, so one 5★ review can't beat 200 4.8★ reviews)
-- + ln(1 + total_sessions) (small all-time popularity boost)
-- Cancelled / rejected / unresolved bookings are ignored.
--
-- Admin overrides (trending_mentor_overrides):
--   pinned_rank → shown first, in pinned_rank order, regardless of score
--   hidden      → never shown in trending
-- Frozen mentors / banned accounts are always excluded.
--
-- Safe to re-run.

CREATE INDEX IF NOT EXISTS bookings_mentor_created_idx ON public.bookings (mentor_id, created_at);
CREATE INDEX IF NOT EXISTS reviews_mentor_created_idx ON public.reviews (mentor_id, created_at);

-- ------------------------------------------------------------
-- Overrides table (admin-only; written via RPCs below)
-- ------------------------------------------------------------
-- FK targets profiles, NOT mentor_profiles: a second FK onto mentor_profiles.id
-- makes the app's `profiles:id(...)` embed ambiguous (PGRST201) and breaks every
-- mentor list query.
CREATE TABLE IF NOT EXISTS public.trending_mentor_overrides (
  mentor_id   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_rank integer CHECK (pinned_rank IS NULL OR pinned_rank >= 1),
  hidden      boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid DEFAULT auth.uid(),
  CHECK (NOT (hidden AND pinned_rank IS NOT NULL))
);

ALTER TABLE public.trending_mentor_overrides
  DROP CONSTRAINT IF EXISTS trending_mentor_overrides_mentor_id_fkey;
ALTER TABLE public.trending_mentor_overrides
  ADD CONSTRAINT trending_mentor_overrides_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';

ALTER TABLE public.trending_mentor_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trending_overrides_admin_select" ON public.trending_mentor_overrides;
CREATE POLICY "trending_overrides_admin_select"
  ON public.trending_mentor_overrides
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ------------------------------------------------------------
-- Internal: score every visible mentor (not callable by clients)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_trending_mentors(integer);
DROP FUNCTION IF EXISTS public.admin_get_trending_board();
DROP FUNCTION IF EXISTS public.trending_mentor_scores();

CREATE FUNCTION public.trending_mentor_scores()
RETURNS TABLE (
  id uuid,
  specialization text,
  bio text,
  experience_years integer,
  price_per_hour numeric,
  rating numeric,
  total_sessions integer,
  name text,
  email text,
  avatar_url text,
  bookings_7d integer,
  bookings_30d integer,
  learners_30d integer,
  reviews_30d integer,
  review_count integer,
  trending_score numeric,
  pinned_rank integer,
  hidden boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH prior AS (
    SELECT COALESCE(AVG(r.rating), 4.0)::numeric AS mean_rating
    FROM reviews r
  ),
  booking_stats AS (
    SELECT
      b.mentor_id,
      count(*) FILTER (WHERE b.created_at >= now() - interval '7 days') AS b7,
      count(*) AS b30,
      count(DISTINCT b.learner_id) AS learners30
    FROM bookings b
    WHERE b.created_at >= now() - interval '30 days'
      AND b.status NOT IN ('cancelled', 'rejected', 'reschedule_unresolved')
    GROUP BY b.mentor_id
  ),
  review_stats AS (
    SELECT
      r.mentor_id,
      count(*) AS review_count,
      AVG(r.rating)::numeric AS avg_rating,
      count(*) FILTER (WHERE r.created_at >= now() - interval '30 days') AS r30
    FROM reviews r
    GROUP BY r.mentor_id
  )
  SELECT
    mp.id,
    mp.specialization::text,
    mp.bio::text,
    mp.experience_years::integer,
    mp.price_per_hour::numeric,
    mp.rating::numeric,
    COALESCE(mp.total_sessions, 0)::integer,
    p.name::text,
    p.email::text,
    p.avatar_url::text,
    COALESCE(bs.b7, 0)::integer,
    COALESCE(bs.b30, 0)::integer,
    COALESCE(bs.learners30, 0)::integer,
    COALESCE(rs.r30, 0)::integer,
    COALESCE(rs.review_count, 0)::integer,
    round((
      3 * COALESCE(bs.b7, 0)
      + (COALESCE(bs.b30, 0) - COALESCE(bs.b7, 0))
      + 2 * COALESCE(bs.learners30, 0)
      + 2 * COALESCE(rs.r30, 0)
      + 2 * (
          (COALESCE(rs.review_count, 0) * COALESCE(rs.avg_rating, 0) + 5 * prior.mean_rating)
          / (COALESCE(rs.review_count, 0) + 5)
        )
      + ln(1 + GREATEST(COALESCE(mp.total_sessions, 0), 0)::numeric)
    )::numeric, 2),
    o.pinned_rank,
    COALESCE(o.hidden, false)
  FROM mentor_profiles mp
  JOIN profiles p ON p.id = mp.id
  CROSS JOIN prior
  LEFT JOIN booking_stats bs ON bs.mentor_id = mp.id
  LEFT JOIN review_stats rs ON rs.mentor_id = mp.id
  LEFT JOIN trending_mentor_overrides o ON o.mentor_id = mp.id
  WHERE NOT public.mentor_freeze_is_active(mp.mentor_frozen, mp.mentor_frozen_until)
    AND COALESCE(p.is_frozen, false) = false;
$$;

REVOKE ALL ON FUNCTION public.trending_mentor_scores() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Public: Welcome screen list (pinned first, hidden removed)
-- ------------------------------------------------------------
CREATE FUNCTION public.get_trending_mentors(p_limit integer DEFAULT 8)
RETURNS TABLE (
  id uuid,
  specialization text,
  bio text,
  experience_years integer,
  price_per_hour numeric,
  rating numeric,
  total_sessions integer,
  name text,
  avatar_url text,
  is_pinned boolean,
  trending_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.specialization, s.bio, s.experience_years, s.price_per_hour,
    s.rating, s.total_sessions, s.name, s.avatar_url,
    s.pinned_rank IS NOT NULL,
    s.trending_score
  FROM public.trending_mentor_scores() s
  WHERE NOT s.hidden
  ORDER BY s.pinned_rank ASC NULLS LAST,
           s.trending_score DESC,
           s.rating DESC NULLS LAST,
           s.total_sessions DESC,
           s.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_trending_mentors(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trending_mentors(integer) TO anon, authenticated;

-- ------------------------------------------------------------
-- Admin: full board (every visible mentor, with score breakdown)
-- ------------------------------------------------------------
CREATE FUNCTION public.admin_get_trending_board()
RETURNS TABLE (
  id uuid,
  specialization text,
  rating numeric,
  total_sessions integer,
  name text,
  email text,
  avatar_url text,
  bookings_7d integer,
  bookings_30d integer,
  learners_30d integer,
  reviews_30d integer,
  review_count integer,
  trending_score numeric,
  pinned_rank integer,
  hidden boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.specialization, s.rating, s.total_sessions, s.name, s.email, s.avatar_url,
    s.bookings_7d, s.bookings_30d, s.learners_30d, s.reviews_30d, s.review_count,
    s.trending_score, s.pinned_rank, s.hidden
  FROM public.trending_mentor_scores() s
  ORDER BY s.hidden ASC,
           s.pinned_rank ASC NULLS LAST,
           s.trending_score DESC,
           s.rating DESC NULLS LAST,
           s.total_sessions DESC,
           s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_trending_board() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_trending_board() TO authenticated;

-- ------------------------------------------------------------
-- Admin: replace the ordered pin list (index 1 = first slot)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_trending_pins(p_mentor_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE trending_mentor_overrides
  SET pinned_rank = NULL, updated_at = now(), updated_by = auth.uid()
  WHERE pinned_rank IS NOT NULL
    AND NOT (mentor_id = ANY(COALESCE(p_mentor_ids, '{}')));

  INSERT INTO trending_mentor_overrides (mentor_id, pinned_rank, hidden, updated_at, updated_by)
  SELECT t.mentor_id, t.ord::integer, false, now(), auth.uid()
  FROM unnest(COALESCE(p_mentor_ids, '{}')) WITH ORDINALITY AS t(mentor_id, ord)
  ON CONFLICT (mentor_id) DO UPDATE
  SET pinned_rank = EXCLUDED.pinned_rank,
      hidden = false,
      updated_at = now(),
      updated_by = auth.uid();

  DELETE FROM trending_mentor_overrides
  WHERE pinned_rank IS NULL AND hidden = false;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_trending_pins(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_trending_pins(uuid[]) TO authenticated;

-- ------------------------------------------------------------
-- Admin: hide / unhide one mentor (hiding also unpins)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_trending_hidden(p_mentor_id uuid, p_hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF COALESCE(p_hidden, false) THEN
    INSERT INTO trending_mentor_overrides (mentor_id, pinned_rank, hidden, updated_at, updated_by)
    VALUES (p_mentor_id, NULL, true, now(), auth.uid())
    ON CONFLICT (mentor_id) DO UPDATE
    SET pinned_rank = NULL, hidden = true, updated_at = now(), updated_by = auth.uid();
  ELSE
    DELETE FROM trending_mentor_overrides
    WHERE mentor_id = p_mentor_id AND pinned_rank IS NULL;
    UPDATE trending_mentor_overrides
    SET hidden = false, updated_at = now(), updated_by = auth.uid()
    WHERE mentor_id = p_mentor_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_trending_hidden(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_trending_hidden(uuid, boolean) TO authenticated;
