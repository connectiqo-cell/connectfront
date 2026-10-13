-- Mentor-side timed freeze (Instagram-style): hide mentor presence + videos,
-- pause unlocks for others, keep learner login/access. Full account ban remains
-- profiles.is_frozen.

ALTER TABLE public.mentor_profiles
  ADD COLUMN IF NOT EXISTS mentor_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mentor_frozen_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mentor_freeze_reason TEXT;

COMMENT ON COLUMN public.mentor_profiles.mentor_frozen IS
  'When true and not expired, mentor side is suspended: profile/videos hidden, unlocks paused.';
COMMENT ON COLUMN public.mentor_profiles.mentor_frozen_until IS
  'Freeze end time. NULL means indefinite while mentor_frozen is true.';
COMMENT ON COLUMN public.mentor_profiles.mentor_freeze_reason IS
  'Optional admin note shown internally / to the mentor.';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.mentor_freeze_is_active(
  p_frozen boolean,
  p_until timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p_frozen, false)
    AND (p_until IS NULL OR p_until > now());
$$;

GRANT EXECUTE ON FUNCTION public.mentor_freeze_is_active(boolean, timestamptz)
  TO anon, authenticated;

-- Public catalog: frozen mentors hidden except self + admins.
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_profiles_select_public" ON public.mentor_profiles;
CREATE POLICY "mentor_profiles_select_public"
  ON public.mentor_profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR NOT public.mentor_freeze_is_active(mentor_frozen, mentor_frozen_until)
  );

-- Videos: hide frozen mentors' library from everyone except owner + admins.
ALTER TABLE public.mentor_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_videos_select_visible" ON public.mentor_videos;
CREATE POLICY "mentor_videos_select_visible"
  ON public.mentor_videos
  FOR SELECT
  TO anon, authenticated
  USING (
    mentor_id = auth.uid()
    OR public.is_admin()
    OR NOT EXISTS (
      SELECT 1
      FROM public.mentor_profiles mp
      WHERE mp.id = mentor_videos.mentor_id
        AND public.mentor_freeze_is_active(mp.mentor_frozen, mp.mentor_frozen_until)
    )
  );

-- Keep owner mutate policies if missing (insert/update/delete own videos).
DROP POLICY IF EXISTS "mentor_videos_insert_own" ON public.mentor_videos;
CREATE POLICY "mentor_videos_insert_own"
  ON public.mentor_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentor_videos_update_own" ON public.mentor_videos;
CREATE POLICY "mentor_videos_update_own"
  ON public.mentor_videos
  FOR UPDATE
  TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS "mentor_videos_delete_own" ON public.mentor_videos;
CREATE POLICY "mentor_videos_delete_own"
  ON public.mentor_videos
  FOR DELETE
  TO authenticated
  USING (mentor_id = auth.uid());

GRANT SELECT ON TABLE public.mentor_videos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.mentor_videos TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_freeze_mentor(
  p_id UUID,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_operator TEXT DEFAULT NULL
)
RETURNS SETOF public.mentor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_until IS NOT NULL AND p_until <= now() THEN
    RAISE EXCEPTION 'Freeze end time must be in the future';
  END IF;

  RETURN QUERY
  UPDATE public.mentor_profiles
  SET mentor_frozen = true,
      mentor_frozen_until = p_until,
      mentor_freeze_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
  WHERE id = p_id
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentor profile not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unfreeze_mentor(
  p_id UUID,
  p_operator TEXT DEFAULT NULL
)
RETURNS SETOF public.mentor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  RETURN QUERY
  UPDATE public.mentor_profiles
  SET mentor_frozen = false,
      mentor_frozen_until = NULL,
      mentor_freeze_reason = NULL
  WHERE id = p_id
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentor profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_freeze_mentor(UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unfreeze_mentor(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_freeze_mentor(UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unfreeze_mentor(UUID, TEXT) TO authenticated;
