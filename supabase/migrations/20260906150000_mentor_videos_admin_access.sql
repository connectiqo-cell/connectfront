-- Full admin access to mentor library videos (app Videos tab).
-- SELECT already includes is_admin() via mentor_videos_select_visible.
-- Admins are rows in public.admins (user_id), not profiles.is_admin.

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

-- Allow admins to remove objects from mentor video buckets (best-effort; buckets may be public).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DROP POLICY IF EXISTS "mentor_videos_admin_storage_select" ON storage.objects;
    CREATE POLICY "mentor_videos_admin_storage_select"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id IN ('mentor-videos', 'mentor-videos-thumbnail')
        AND public.is_admin()
      );

    DROP POLICY IF EXISTS "mentor_videos_admin_storage_delete" ON storage.objects;
    CREATE POLICY "mentor_videos_admin_storage_delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id IN ('mentor-videos', 'mentor-videos-thumbnail')
        AND public.is_admin()
      );
  END IF;
END $$;
