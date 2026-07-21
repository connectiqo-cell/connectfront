-- Private user reports submitted for moderator review.
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'harassment',
      'hate_or_abuse',
      'sexual_content',
      'spam_or_scam',
      'impersonation',
      'unsafe_behavior',
      'other'
    )
  ),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  context_type TEXT NOT NULL DEFAULT 'profile' CHECK (
    context_type IN ('profile', 'video', 'booking', 'call')
  ),
  context_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewing', 'actioned', 'dismissed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_not_self CHECK (reporter_id <> reported_user_id)
);

CREATE INDEX IF NOT EXISTS user_reports_reported_user_idx
  ON public.user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS user_reports_status_created_idx
  ON public.user_reports(status, created_at DESC);

-- A reporter cannot repeatedly submit the same unresolved profile report.
CREATE UNIQUE INDEX IF NOT EXISTS user_reports_one_open_per_target_idx
  ON public.user_reports(reporter_id, reported_user_id, context_type)
  WHERE status IN ('pending', 'reviewing');

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reports_insert_own" ON public.user_reports;
CREATE POLICY "user_reports_insert_own"
  ON public.user_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND reported_user_id <> auth.uid()
    AND status = 'pending'
  );

-- No SELECT/UPDATE/DELETE policy is intentionally provided. Reports and
-- moderation decisions remain private and are reviewed through service-role
-- administration.

REVOKE ALL ON TABLE public.user_reports FROM anon;
GRANT INSERT ON TABLE public.user_reports TO authenticated;
