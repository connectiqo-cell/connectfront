-- Ensure promote columns + admin can set them via SECURITY DEFINER RPC.
-- Fixes promote failing when direct UPDATE is blocked by RLS.

ALTER TABLE public.mentor_videos
  ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mentor_videos_promoted_feed_idx
  ON public.mentor_videos (is_promoted DESC, promoted_at DESC NULLS LAST, created_at DESC);

-- Admins table OR profiles.is_admin (via jsonb so missing column does not error).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.admins a
      WHERE a.user_id = auth.uid()
    )
    OR COALESCE(
      (
        SELECT NULLIF(to_jsonb(p) ->> 'is_admin', '')::boolean
        FROM public.profiles p
        WHERE p.id = auth.uid()
      ),
      false
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "mentor_videos_admin_update" ON public.mentor_videos;
CREATE POLICY "mentor_videos_admin_update"
  ON public.mentor_videos
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "mentor_videos_admin_delete" ON public.mentor_videos;
CREATE POLICY "mentor_videos_admin_delete"
  ON public.mentor_videos
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_set_mentor_video_promoted(
  p_id UUID,
  p_promoted BOOLEAN
)
RETURNS SETOF public.mentor_videos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mentor_videos WHERE id = p_id) THEN
    RAISE EXCEPTION 'video not found';
  END IF;

  RETURN QUERY
  UPDATE public.mentor_videos
  SET
    is_promoted = COALESCE(p_promoted, false),
    promoted_at = CASE
      WHEN COALESCE(p_promoted, false) THEN now()
      ELSE NULL
    END
  WHERE id = p_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_mentor_video_promoted(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_mentor_video_promoted(UUID, BOOLEAN) TO authenticated;
