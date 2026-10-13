-- Allow verified admins to review and update user_reports.
-- Mobile clients keep INSERT-only access; SELECT/UPDATE stay admin-gated.

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

DROP POLICY IF EXISTS "user_reports_admin_select" ON public.user_reports;
CREATE POLICY "user_reports_admin_select"
  ON public.user_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "user_reports_admin_update" ON public.user_reports;
CREATE POLICY "user_reports_admin_update"
  ON public.user_reports
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, UPDATE ON TABLE public.user_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_report_status(
  p_id UUID,
  p_status TEXT,
  p_operator TEXT DEFAULT NULL
)
RETURNS SETOF public.user_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'reviewing', 'actioned', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid report status: %', p_status;
  END IF;

  RETURN QUERY
  UPDATE public.user_reports
  SET status = p_status,
      updated_at = now()
  WHERE id = p_id
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_report_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_report_status(UUID, TEXT, TEXT) TO authenticated;
