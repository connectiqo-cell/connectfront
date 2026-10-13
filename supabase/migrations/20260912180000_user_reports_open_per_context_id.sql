-- Allow one open report per concrete context item (e.g. each video),
-- not only one open "video" report per mentor overall.
DROP INDEX IF EXISTS public.user_reports_one_open_per_target_idx;

CREATE UNIQUE INDEX user_reports_one_open_per_target_idx
  ON public.user_reports (
    reporter_id,
    reported_user_id,
    context_type,
    (COALESCE(context_id, '00000000-0000-0000-0000-000000000000'::uuid))
  )
  WHERE status IN ('pending', 'reviewing');
