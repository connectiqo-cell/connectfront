-- Allow admins to review session recordings for moderation.
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

DROP POLICY IF EXISTS "recordings_admin_select" ON public.recordings;
CREATE POLICY "recordings_admin_select"
  ON public.recordings
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
